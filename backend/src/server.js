// Backend server entry point
const express = require('express');
const cors = require('cors');
const multer = require('multer');
require('dotenv').config();

const authMiddleware = require('./middleware/auth');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Set up Multer for memory storage
const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
});

// Admin Image Upload
app.post('/api/admin/upload-image', upload.single('image'), async (req, res) => {
  try {
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return res.status(500).json({ error: 'SUPABASE_SERVICE_ROLE_KEY is required' });
    }
    if (!req.file) {
      return res.status(400).json({ error: 'No image file provided' });
    }

    const fileBuffer = req.file.buffer;
    const originalName = req.file.originalname;
    const fileExt = originalName.split('.').pop();
    const fileName = `${Date.now()}_${Math.round(Math.random() * 1000)}.${fileExt}`;

    // Upload to Supabase Storage
    const { data, error } = await supabaseAdmin.storage
      .from('menu-images')
      .upload(fileName, fileBuffer, {
        contentType: req.file.mimetype,
        cacheControl: '3600',
        upsert: false
      });

    if (error) throw error;

    // Get public URL
    const { data: { publicUrl } } = supabaseAdmin.storage
      .from('menu-images')
      .getPublicUrl(fileName);

    res.json({ url: publicUrl });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Basic health check route
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', message: 'TableFlow API is running!' });
});

// Protected test route
app.get('/api/me', authMiddleware, (req, res) => {
  res.status(200).json({
    message: 'Successfully authenticated with backend!',
    user: req.user
  });
});
// Admin APIs
const { createClient } = require('@supabase/supabase-js');
const supabaseAdmin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY // fallback to anon if missing, though it will fail RLS
);

app.post('/api/admin/sync-users', async (req, res) => {
  try {
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return res.status(500).json({ error: 'SUPABASE_SERVICE_ROLE_KEY is required' });
    }
    
    // Fetch all auth users
    const { data: { users }, error: listError } = await supabaseAdmin.auth.admin.listUsers();
    if (listError) throw listError;

    let synced = 0;
    for (const user of users) {
      // Check if user exists in public.users
      const { data: existingUser } = await supabaseAdmin.from('users').select('id').eq('id', user.id).single();
      
      if (!existingUser) {
        // Insert into public.users
        const fullName = user.user_metadata?.full_name || 'User';
        const phone = user.user_metadata?.phone || '';
        const { error: insertError } = await supabaseAdmin.from('users').insert({
          id: user.id,
          email: user.email,
          full_name: fullName,
          phone_number: phone,
          role: 'customer'
        });
        if (insertError) {
          console.error("Failed to insert user:", user.email, insertError);
        } else {
          synced++;
        }
      }
    }
    res.json({ message: `Successfully synced ${synced} missing users.` });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/admin/create-staff', async (req, res) => {
  try {
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return res.status(500).json({ error: 'SUPABASE_SERVICE_ROLE_KEY is required' });
    }

    const { email, password, full_name, role } = req.body;
    if (!email || !password || !full_name || !role) {
      return res.status(400).json({ error: 'Email, password, full name, and role are required' });
    }

    // Validate role
    if (!['admin', 'manager', 'cashier', 'kitchen', 'staff'].includes(role)) {
      return res.status(400).json({ error: 'Invalid role specified' });
    }

    // Create auth user
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name }
    });
    if (authError) throw authError;

    // The database trigger might run, but let's wait a second just in case
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Force role to selected role
    const { error: dbError } = await supabaseAdmin.from('users')
      .update({ role: role })
      .eq('id', authData.user.id);
      
    if (dbError) throw dbError;

    res.json({ message: 'Staff user created successfully!', user: authData.user });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/admin/my-role', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ error: 'Missing token' });
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
    if (authError || !user) return res.status(401).json({ error: 'Invalid token' });
    
    const { data: userRecord, error: dbError } = await supabaseAdmin.from('users').select('role, full_name').eq('id', user.id).single();
    if (dbError) throw dbError;
    
    res.json({ role: userRecord.role, full_name: userRecord.full_name, email: user.email });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/admin/users', async (req, res) => {
  try {
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return res.status(500).json({ error: 'SUPABASE_SERVICE_ROLE_KEY is required' });
    }
    const { data, error } = await supabaseAdmin.from('users').select('*').order('created_at', { ascending: false });
    if (error) throw error;
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
app.delete('/api/admin/users/:id', async (req, res) => {
  try {
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return res.status(500).json({ error: 'SUPABASE_SERVICE_ROLE_KEY is required' });
    }

    const userId = req.params.id;
    if (!userId) {
      return res.status(400).json({ error: 'User ID is required' });
    }

    // Delete user from auth (this cascades to public.users because of ON DELETE CASCADE)
    const { error } = await supabaseAdmin.auth.admin.deleteUser(userId);
    
    if (error) throw error;

    res.json({ message: 'User deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ==========================================
// KDS & Orders Endpoints
// ==========================================

// Create a Supabase client that uses the user's JWT for RLS
function getSupabaseClient(req) {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return supabaseAdmin; // Fallback to admin (not recommended for user actions)
  const { createClient } = require('@supabase/supabase-js');
  return createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${token}` } }
  });
}

// 1. Customer places an order
app.post('/api/orders', authMiddleware, async (req, res) => {
  try {
    const sb = getSupabaseClient(req);
    const { items, total_amount, reservation_id, table_id, special_notes } = req.body;
    
    if (!items || items.length === 0) {
      return res.status(400).json({ error: 'Order must contain items' });
    }

    // 1. Calculate Prep Time (MAX of item prep times)
    const itemIds = items.map(i => i.menu_item_id);
    const { data: menuItems, error: menuErr } = await sb
      .from('menu_items')
      .select('id, prep_time_minutes')
      .in('id', itemIds);

    if (menuErr) throw menuErr;

    let maxPrepTime = 15; // default 15
    if (menuItems && menuItems.length > 0) {
      maxPrepTime = Math.max(...menuItems.map(m => m.prep_time_minutes || 15));
    }

    // 2. Calculate Target Serve Time
    let targetServeTime = new Date();
    targetServeTime.setMinutes(targetServeTime.getMinutes() + maxPrepTime); // Default: dine-in-now

    if (reservation_id) {
      // Fetch reservation time
      const { data: resData, error: resErr } = await sb
        .from('reservations')
        .select('reservation_date, reservation_time')
        .eq('id', reservation_id)
        .single();
      
      if (!resErr && resData) {
        // Construct target time from reservation date and time
        const resDateTime = new Date(`${resData.reservation_date}T${resData.reservation_time}`);
        if (!isNaN(resDateTime.getTime())) {
          targetServeTime = resDateTime;
        }
      }
    }

    // 3. Create the Order
    const { data: newOrder, error: orderErr } = await sb
      .from('orders')
      .insert({
        user_id: req.user.id,
        reservation_id: reservation_id || null,
        table_id: table_id || null,
        total_amount: total_amount,
        status: 'pending',
        payment_status: 'pending',
        prep_time_minutes: maxPrepTime,
        target_serve_time: targetServeTime.toISOString(),
        special_notes: special_notes || null
      })
      .select()
      .single();

    if (orderErr) throw orderErr;

    // 4. Create Order Items
    const orderItems = items.map(item => ({
      order_id: newOrder.id,
      menu_item_id: item.menu_item_id,
      quantity: item.quantity,
      unit_price: item.unit_price,
      item_notes: item.item_notes || null
    }));

    const { error: itemsErr } = await sb
      .from('order_items')
      .insert(orderItems);

    if (itemsErr) throw itemsErr;

    res.status(201).json({ message: 'Order placed successfully', order: newOrder });
  } catch (error) {
    console.error('Order creation error:', error);
    res.status(500).json({ error: error.message });
  }
});

// 2. Get active kitchen orders (Kitchen Staff only)
app.get('/api/kitchen/orders', authMiddleware, async (req, res) => {
  try {
    const sb = getSupabaseClient(req);
    
    const { data, error } = await sb
      .from('orders')
      .select(`
        *,
        order_items(quantity, unit_price, item_notes, menu_items(name)),
        users(full_name),
        restaurant_tables(table_number)
      `)
      .in('status', ['pending', 'preparing', 'ready'])
      .order('target_serve_time', { ascending: true }); // most urgent first

    if (error) {
      throw error; 
    }

    res.json(data || []);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 3. Update order status (Kitchen Staff only)
app.patch('/api/kitchen/orders/:id/status', authMiddleware, async (req, res) => {
  try {
    const sb = getSupabaseClient(req);
    const { status } = req.body;
    const orderId = req.params.id;

    if (!['pending', 'preparing', 'ready', 'served'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }

    // Fetch current status to validate transition
    const { data: currentOrder, error: fetchErr } = await sb
      .from('orders')
      .select('status')
      .eq('id', orderId)
      .single();

    if (fetchErr || !currentOrder) {
      return res.status(404).json({ error: 'Order not found' });
    }

    const currentStatus = currentOrder.status;
    const isValidTransition = 
      (currentStatus === 'pending' && status === 'preparing') ||
      (currentStatus === 'preparing' && status === 'ready') ||
      (currentStatus === 'ready' && status === 'served');

    if (!isValidTransition && currentStatus !== status) {
      return res.status(400).json({ error: `Invalid transition from ${currentStatus} to ${status}` });
    }

    const { data, error } = await sb
      .from('orders')
      .update({ status })
      .eq('id', orderId)
      .select()
      .single();

    if (error) throw error;
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ==========================================
// Waitlist (Queue) Endpoints
// ==========================================

app.get('/api/queue/:id/position', async (req, res) => {
  try {
    // using the anon client or user client for queue is fine
    const sb = getSupabaseClient(req);
    const { id } = req.params;

    // Get the queue_number of this entry
    const { data: myEntry, error: err1 } = await sb
      .from('queue_entries')
      .select('queue_number')
      .eq('id', id)
      .single();
    
    if (err1 || !myEntry) return res.status(404).json({ error: 'Entry not found' });
    if (myEntry.queue_number == null) return res.json({ position: 1, ahead: 0 }); // fallback

    // Count how many are waiting before it
    const { count, error: err2 } = await sb
      .from('queue_entries')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'waiting')
      .lt('queue_number', myEntry.queue_number);

    if (err2) throw err2;

    // position is people ahead + 1
    res.json({ position: count + 1, ahead: count, queue_number: myEntry.queue_number });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

