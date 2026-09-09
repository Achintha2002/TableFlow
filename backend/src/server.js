// Backend server entry point
const express = require('express');
const cors = require('cors');
require('dotenv').config();

const authMiddleware = require('./middleware/auth');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

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
        await supabaseAdmin.from('users').insert({
          id: user.id,
          email: user.email,
          full_name: fullName,
          phone_number: phone,
          role: 'customer'
        });
        synced++;
      }
    }
    res.json({ message: `Successfully synced ${synced} missing users.` });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/admin/create-admin', async (req, res) => {
  try {
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return res.status(500).json({ error: 'SUPABASE_SERVICE_ROLE_KEY is required' });
    }

    const { email, password, full_name } = req.body;
    if (!email || !password || !full_name) {
      return res.status(400).json({ error: 'Email, password, and full name are required' });
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

    // Force role to admin
    const { error: dbError } = await supabaseAdmin.from('users')
      .update({ role: 'admin' })
      .eq('id', authData.user.id);
      
    if (dbError) throw dbError;

    res.json({ message: 'Admin user created successfully!', user: authData.user });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
// Start server
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
