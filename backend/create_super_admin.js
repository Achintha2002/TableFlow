require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env");
  process.exit(1);
}

const supabaseAdmin = createClient(supabaseUrl, supabaseKey, {
  auth: { autoRefreshToken: false, persistSession: false }
});

async function main() {
  const email = 'superadmin@tableflow.com';
  const password = 'SuperAdmin@2026';
  const fullName = 'Super Admin';
  const role = 'super_admin';

  console.log(`Checking/Creating Super Admin user (${email})...`);

  // 1. List users to check if already exists
  const { data: { users }, error: listErr } = await supabaseAdmin.auth.admin.listUsers();
  if (listErr) {
    console.error("Error listing auth users:", listErr.message);
    process.exit(1);
  }

  let authUser = users?.find(u => u.email === email);

  if (!authUser) {
    console.log("Creating new Supabase Auth user...");
    const { data, error: createErr } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: fullName, role }
    });
    if (createErr) {
      console.error("Failed to create auth user:", createErr.message);
      process.exit(1);
    }
    authUser = data.user;
    console.log("Auth user created with ID:", authUser.id);
  } else {
    console.log("Auth user already exists with ID:", authUser.id);
    // Update password & metadata
    const { error: updateErr } = await supabaseAdmin.auth.admin.updateUserById(authUser.id, {
      password: password,
      user_metadata: { full_name: fullName, role }
    });
    if (updateErr) {
      console.warn("Notice updating password/metadata:", updateErr.message);
    } else {
      console.log("Updated auth user credentials.");
    }
  }

  // 2. Upsert in public.users
  console.log("Upserting into public.users table...");
  const { data: dbData, error: dbErr } = await supabaseAdmin.from('users').upsert({
    id: authUser.id,
    email: email,
    full_name: fullName,
    role: role
  }, { onConflict: 'id' }).select();

  if (dbErr) {
    console.error("DB Error on public.users:", dbErr.message);
    if (dbErr.message.includes('user_role') || dbErr.message.includes('enum') || dbErr.message.includes('invalid input value')) {
      console.log("\n⚠️ ATTENTION: The PostgreSQL enum 'user_role' needs to have 'super_admin' added.");
      console.log("Please run this in your Supabase SQL Editor:");
      console.log("ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'super_admin';");
    }
    process.exit(1);
  }

  console.log("\n✅ SUCCESS: Super Admin account is ready!");
  console.log("Email:", email);
  console.log("Password:", password);
  console.log("Role:", role);
  console.log("User Record:", dbData);
}

main().catch(err => {
  console.error("Unexpected error:", err);
  process.exit(1);
});
