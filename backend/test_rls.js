require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);
async function run() {
  const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
    email: 'achinthaedirisinghe67@gmail.com',
    password: 'password123'
  });
  if (signInError) {
    console.log('Login error', signInError.message);
  } else {
    console.log('Logged in as', signInData.user.email);
    const { data: users, error: uError } = await supabase.from('users').select('*', { count: 'exact', head: true }).eq('role', 'customer');
    console.log('Users Query:', { count: users, error: uError });
    
    const { data: orders, error: oError } = await supabase.from('orders').select('*', { count: 'exact', head: true });
    console.log('Orders Query:', { count: orders, error: oError });
  }
}
run();
