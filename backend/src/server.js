// Backend server entry point
const express = require('express');
const cors = require('cors');
const multer = require('multer');
const crypto = require('crypto');
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

// 1. Customer places an order (Hardened with Idempotency, Server Price Recomputation, and Validation)
app.post('/api/orders', authMiddleware, async (req, res) => {
  try {
    const { 
      items, 
      total_amount, 
      reservation_id, 
      table_id, 
      special_notes,
      payment_method = 'cash',
      coupon_code,
      redeem_points = 0
    } = req.body;
    
    // Idempotency check: prevent duplicate submissions
    const idempotencyKey = req.headers['idempotency-key'] || req.body.idempotency_key;
    if (idempotencyKey) {
      const { data: existingOrder } = await supabaseAdmin
        .from('orders')
        .select('*, order_items(*)')
        .eq('idempotency_key', idempotencyKey)
        .maybeSingle();
      if (existingOrder) {
        return res.status(200).json({ 
          message: 'Order already exists (idempotent)', 
          order: existingOrder 
        });
      }
    }

    if (!items || items.length === 0) {
      return res.status(400).json({ error: 'Order must contain items' });
    }

    // 1. Recompute Prices Server-Side from menu_items
    const itemIds = items.map(i => i.menu_item_id);
    const { data: menuItems, error: menuErr } = await supabaseAdmin
      .from('menu_items')
      .select('id, name, price, prep_time_minutes, is_available')
      .in('id', itemIds);

    if (menuErr) throw menuErr;

    const menuMap = new Map();
    (menuItems || []).forEach(m => menuMap.set(m.id, m));

    let serverSubtotal = 0;
    let maxPrepTime = 15;

    for (const item of items) {
      const dbItem = menuMap.get(item.menu_item_id);
      if (!dbItem) {
        return res.status(400).json({ error: `Menu item with ID ${item.menu_item_id} not found` });
      }
      if (dbItem.is_available === false) {
        return res.status(400).json({ error: `Item "${dbItem.name}" is currently sold out / unavailable.` });
      }
      const quantity = parseInt(item.quantity, 10) || 1;
      const unitPrice = parseFloat(dbItem.price);
      item.unit_price = unitPrice; // Enforce server-side price
      serverSubtotal += unitPrice * quantity;
      if (dbItem.prep_time_minutes && dbItem.prep_time_minutes > maxPrepTime) {
        maxPrepTime = dbItem.prep_time_minutes;
      }
    }

    // 2. Validate Coupon Server-Side
    let couponDiscount = 0;
    let couponRecord = null;
    if (coupon_code) {
      const { data: coupon } = await supabaseAdmin
        .from('coupons')
        .select('*')
        .eq('code', coupon_code.trim().toUpperCase())
        .eq('is_active', true)
        .maybeSingle();

      if (coupon) {
        const isNotExpired = !coupon.valid_until || new Date(coupon.valid_until) > new Date();
        const meetsMinAmount = serverSubtotal >= (coupon.min_order_amount || 0);
        
        // Check user redemption limit
        const { count: userRedemptions } = await supabaseAdmin
          .from('coupon_redemptions')
          .select('*', { count: 'exact', head: true })
          .eq('coupon_id', coupon.id)
          .eq('user_id', req.user.id);

        if (isNotExpired && meetsMinAmount && (userRedemptions || 0) < (coupon.max_uses_per_user || 1)) {
          couponRecord = coupon;
          if (coupon.discount_percent > 0) {
            couponDiscount = (serverSubtotal * coupon.discount_percent) / 100;
          } else if (coupon.discount_amount > 0) {
            couponDiscount = Math.min(coupon.discount_amount, serverSubtotal);
          }
        }
      }
    }

    // 3. Validate Loyalty Points Redemption
    let pointsDiscount = 0;
    const pointsToRedeem = Math.max(0, parseInt(redeem_points, 10) || 0);
    if (pointsToRedeem > 0) {
      const { data: userProfile } = await supabaseAdmin
        .from('users')
        .select('loyalty_points')
        .eq('id', req.user.id)
        .single();
      
      const userBalance = userProfile?.loyalty_points || 0;
      if (pointsToRedeem > userBalance) {
        return res.status(400).json({ error: `Insufficient loyalty points. Current balance: ${userBalance}` });
      }
      pointsDiscount = Math.min(pointsToRedeem, Math.max(0, serverSubtotal - couponDiscount));
    }

    // 4. Financial Breakdown
    const totalDiscount = Math.round((couponDiscount + pointsDiscount) * 100) / 100;
    const discountedSubtotal = Math.max(0, serverSubtotal - totalDiscount);
    const serviceCharge = Math.round(discountedSubtotal * 0.10 * 100) / 100; // 10%
    const taxAmount = Math.round(discountedSubtotal * 0.08 * 100) / 100; // 8% VAT
    const serverTotal = Math.round((discountedSubtotal + serviceCharge + taxAmount) * 100) / 100;

    // 5. Target Serve Time Calculation
    let targetServeTime = new Date();
    targetServeTime.setMinutes(targetServeTime.getMinutes() + maxPrepTime);

    if (reservation_id) {
      const { data: resData } = await supabaseAdmin
        .from('reservations')
        .select('reservation_date, reservation_time')
        .eq('id', reservation_id)
        .maybeSingle();
      
      if (resData) {
        const resDateTime = new Date(`${resData.reservation_date}T${resData.reservation_time}`);
        if (!isNaN(resDateTime.getTime())) {
          targetServeTime = resDateTime;
        }
      }
    }

    // 6. Create the Order
    const insertPayload = {
      user_id: req.user.id,
      reservation_id: reservation_id || null,
      table_id: table_id || null,
      subtotal: serverSubtotal,
      discount_amount: totalDiscount,
      service_charge: serviceCharge,
      tax_amount: taxAmount,
      total_amount: serverTotal,
      status: 'pending',
      payment_status: payment_method === 'online_card' ? 'processing' : 'pending',
      payment_method: payment_method,
      prep_time_minutes: maxPrepTime,
      target_serve_time: targetServeTime.toISOString(),
      special_notes: special_notes || null,
      idempotency_key: idempotencyKey || null
    };

    const { data: newOrder, error: orderErr } = await supabaseAdmin
      .from('orders')
      .insert(insertPayload)
      .select()
      .single();

    if (orderErr) throw orderErr;

    // 7. Create Order Items with verified prices
    const orderItems = items.map(item => ({
      order_id: newOrder.id,
      menu_item_id: item.menu_item_id,
      quantity: item.quantity,
      unit_price: item.unit_price,
      special_instructions: item.item_notes || item.special_instructions || null
    }));

    const { error: itemsErr } = await supabaseAdmin
      .from('order_items')
      .insert(orderItems);

    if (itemsErr) throw itemsErr;

    // 8. Record coupon redemption if applicable
    if (couponRecord) {
      await supabaseAdmin.from('coupon_redemptions').insert({
        coupon_id: couponRecord.id,
        user_id: req.user.id,
        order_id: newOrder.id
      }).catch(err => console.warn('Coupon redemption log notice:', err.message));
    }

    // 9. Atomic Loyalty Points Deduction
    if (pointsDiscount > 0) {
      await supabaseAdmin.rpc('redeem_loyalty_points', {
        p_user_id: req.user.id,
        p_points: pointsDiscount,
        p_order_id: newOrder.id
      }).catch(async () => {
        // Fallback if RPC not yet run
        const { data: u } = await supabaseAdmin.from('users').select('loyalty_points').eq('id', req.user.id).single();
        if (u) {
          await supabaseAdmin.from('users').update({ loyalty_points: Math.max(0, u.loyalty_points - pointsDiscount) }).eq('id', req.user.id);
        }
      });
    }

    // 10. Update table status to occupied if dine-in table is specified
    if (table_id) {
      await supabaseAdmin
        .from('restaurant_tables')
        .update({ status: 'occupied' })
        .eq('id', table_id)
        .catch(err => console.warn('Table occupancy update notice:', err.message));
    }

    res.status(201).json({ 
      message: 'Order placed successfully', 
      order: newOrder,
      breakdown: {
        subtotal: serverSubtotal,
        discount: totalDiscount,
        service_charge: serviceCharge,
        tax: taxAmount,
        total: serverTotal
      }
    });
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

// ==========================================
// Signed Table QR Code Endpoints
// ==========================================
const QR_SECRET = process.env.QR_HMAC_SECRET || 'tableflow-qr-secret-key-2026';

function generateTableToken(tableId) {
  const timestamp = Date.now();
  const signature = crypto.createHmac('sha256', QR_SECRET)
    .update(`${tableId}:${timestamp}`)
    .digest('hex');
  return Buffer.from(`${tableId}:${timestamp}:${signature}`).toString('base64');
}

function verifyTableToken(token) {
  try {
    const decoded = Buffer.from(token, 'base64').toString('utf8');
    const [tableId, timestamp, signature] = decoded.split(':');
    if (!tableId || !timestamp || !signature) return { valid: false, error: 'Invalid QR token format' };

    const expectedSignature = crypto.createHmac('sha256', QR_SECRET)
      .update(`${tableId}:${timestamp}`)
      .digest('hex');

    if (signature !== expectedSignature) {
      return { valid: false, error: 'Invalid or forged QR signature' };
    }
    return { valid: true, tableId: parseInt(tableId, 10), timestamp: parseInt(timestamp, 10) };
  } catch (e) {
    return { valid: false, error: 'Malformed QR token' };
  }
}

app.get('/api/tables/:id/qr-token', async (req, res) => {
  try {
    const tableId = req.params.id;
    const { data: table, error } = await supabaseAdmin
      .from('restaurant_tables')
      .select('id, table_number, capacity, status')
      .eq('id', tableId)
      .single();

    if (error || !table) {
      return res.status(404).json({ error: 'Table not found' });
    }

    const token = generateTableToken(table.id);
    const qrData = `tableflow://table?token=${encodeURIComponent(token)}&tableId=${table.id}&tableNumber=${table.table_number}`;
    res.json({ table, token, qrData });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/tables/verify-qr', async (req, res) => {
  try {
    const { token, rawCode } = req.body;
    let tableId = null;

    if (token) {
      const verification = verifyTableToken(token);
      if (!verification.valid) {
        return res.status(400).json({ error: verification.error });
      }
      tableId = verification.tableId;
    } else if (rawCode) {
      // Manual code fallback (e.g. Table Number entered directly)
      const parsed = parseInt(String(rawCode).replace(/[^0-9]/g, ''), 10);
      if (!parsed) return res.status(400).json({ error: 'Invalid table number format' });
      
      const { data: tData } = await supabaseAdmin
        .from('restaurant_tables')
        .select('id')
        .eq('table_number', parsed)
        .maybeSingle();
      if (!tData) return res.status(404).json({ error: `Table #${parsed} not found` });
      tableId = tData.id;
    } else {
      return res.status(400).json({ error: 'Token or table code required' });
    }

    const { data: table, error } = await supabaseAdmin
      .from('restaurant_tables')
      .select('id, table_number, capacity, status')
      .eq('id', tableId)
      .single();

    if (error || !table) return res.status(404).json({ error: 'Table not found' });

    res.json({
      valid: true,
      table,
      isOccupied: table.status === 'occupied'
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ==========================================
// Coupon Validation Endpoint
// ==========================================
app.post('/api/coupons/validate', async (req, res) => {
  try {
    const { code, subtotal, user_id } = req.body;
    if (!code) return res.status(400).json({ error: 'Coupon code required' });

    const { data: coupon, error } = await supabaseAdmin
      .from('coupons')
      .select('*')
      .eq('code', code.trim().toUpperCase())
      .eq('is_active', true)
      .maybeSingle();

    if (error || !coupon) {
      return res.status(404).json({ error: 'Invalid or inactive promo code.' });
    }

    if (coupon.valid_until && new Date(coupon.valid_until) < new Date()) {
      return res.status(400).json({ error: 'This promo code has expired.' });
    }

    const orderSubtotal = parseFloat(subtotal) || 0;
    if (orderSubtotal < (coupon.min_order_amount || 0)) {
      return res.status(400).json({ 
        error: `Minimum order amount of LKR ${coupon.min_order_amount} required for this code.` 
      });
    }

    if (user_id) {
      const { count: userUses } = await supabaseAdmin
        .from('coupon_redemptions')
        .select('*', { count: 'exact', head: true })
        .eq('coupon_id', coupon.id)
        .eq('user_id', user_id);

      if ((userUses || 0) >= (coupon.max_uses_per_user || 1)) {
        return res.status(400).json({ error: 'You have already used this promo code.' });
      }
    }

    let discountAmount = 0;
    if (coupon.discount_percent > 0) {
      discountAmount = (orderSubtotal * coupon.discount_percent) / 100;
    } else if (coupon.discount_amount > 0) {
      discountAmount = Math.min(coupon.discount_amount, orderSubtotal);
    }

    res.json({
      valid: true,
      coupon: {
        id: coupon.id,
        code: coupon.code,
        description: coupon.description,
        discount_percent: coupon.discount_percent,
        discount_amount: Math.round(discountAmount * 100) / 100
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ==========================================
// Service Requests (Call Waiter / Water / Bill)
// ==========================================
app.post('/api/service-requests', async (req, res) => {
  try {
    const { table_id, request_type, user_id } = req.body;
    if (!table_id || !request_type) {
      return res.status(400).json({ error: 'Table ID and request type are required' });
    }

    // Rate limiting: prevent spamming more than 1 request per table in 30 seconds
    const thirtySecsAgo = new Date(Date.now() - 30 * 1000).toISOString();
    const { data: recent } = await supabaseAdmin
      .from('service_requests')
      .select('id')
      .eq('table_id', table_id)
      .eq('request_type', request_type)
      .eq('status', 'pending')
      .gt('created_at', thirtySecsAgo)
      .maybeSingle();

    if (recent) {
      return res.status(429).json({ error: 'A staff member has already been notified. Please wait a moment!' });
    }

    const { data, error } = await supabaseAdmin
      .from('service_requests')
      .insert({
        table_id,
        user_id: user_id || null,
        request_type,
        status: 'pending'
      })
      .select()
      .single();

    if (error) throw error;
    res.status(201).json({ message: 'Request sent to staff', request: data });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/service-requests', async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('service_requests')
      .select('*, restaurant_tables(table_number)')
      .eq('status', 'pending')
      .order('created_at', { ascending: true });

    if (error) throw error;
    res.json(data || []);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.patch('/api/service-requests/:id/attend', async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('service_requests')
      .update({ status: 'attended', attended_at: new Date().toISOString() })
      .eq('id', req.params.id)
      .select()
      .single();

    if (error) throw error;
    res.json({ message: 'Request marked as attended', request: data });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ==========================================
// Cashier / POS Endpoints
// ==========================================
app.get('/api/pos/active-tables', async (req, res) => {
  try {
    const { data: tables, error: tErr } = await supabaseAdmin
      .from('restaurant_tables')
      .select(`
        id, 
        table_number, 
        capacity, 
        status,
        orders (
          id, 
          status, 
          payment_status, 
          payment_method, 
          subtotal, 
          discount_amount, 
          tax_amount, 
          service_charge, 
          total_amount, 
          created_at,
          locked_by,
          locked_at,
          order_items (
            quantity, 
            unit_price, 
            menu_items (name)
          ),
          users (full_name, phone_number)
        )
      `)
      .order('table_number', { ascending: true });

    if (tErr) throw tErr;

    const result = (tables || []).map(t => {
      const activeOrders = (t.orders || []).filter(o => o.payment_status === 'pending');
      const runningTotal = activeOrders.reduce((acc, o) => acc + parseFloat(o.total_amount || 0), 0);
      return {
        ...t,
        activeOrders,
        runningTotal
      };
    });

    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/pos/orders/:id/lock', authMiddleware, async (req, res) => {
  try {
    const orderId = req.params.id;
    const cashierId = req.user.id;

    const { data: order, error } = await supabaseAdmin
      .from('orders')
      .select('locked_by, locked_at')
      .eq('id', orderId)
      .single();

    if (error || !order) return res.status(404).json({ error: 'Order not found' });

    if (order.locked_by && order.locked_by !== cashierId) {
      const lockAgeMins = (Date.now() - new Date(order.locked_at).getTime()) / 60000;
      if (lockAgeMins < 5) {
        return res.status(409).json({ error: 'Bill currently being settled by another staff member.' });
      }
    }

    await supabaseAdmin
      .from('orders')
      .update({ locked_by: cashierId, locked_at: new Date().toISOString() })
      .eq('id', orderId);

    res.json({ message: 'Lock acquired' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/pos/orders/:id/settle', authMiddleware, async (req, res) => {
  try {
    const orderId = req.params.id;
    const { payment_method = 'cash', discount_amount = 0, table_id } = req.body;

    const { data: order, error: oErr } = await supabaseAdmin
      .from('orders')
      .select('id, total_amount, table_id')
      .eq('id', orderId)
      .single();

    if (oErr || !order) return res.status(404).json({ error: 'Order not found' });

    const { data: settled, error: sErr } = await supabaseAdmin
      .from('orders')
      .update({
        payment_status: 'paid',
        status: 'served',
        payment_method,
        discount_amount,
        locked_by: null,
        locked_at: null
      })
      .eq('id', orderId)
      .select()
      .single();

    if (sErr) throw sErr;

    const targetTable = table_id || order.table_id;
    if (targetTable) {
      await supabaseAdmin
        .from('restaurant_tables')
        .update({ status: 'cleaning' })
        .eq('id', targetTable);
    }

    res.json({ message: 'Bill settled successfully and table freed', order: settled });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

