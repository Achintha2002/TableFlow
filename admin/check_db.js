const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(
  'https://azjjndqecpemltvdbkvy.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF6ampuZHFlY3BlbWx0dmRia3Z5Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4Njc5MDc4MSwiZXhwIjoyMTAyMzY2NzgxfQ.PABzNyeosSFNCyghhZRjG7skcdR741G1Swudbxq9E9M'
);

async function check() {
  console.log('Fetching users...');
  const { data: users, error: usersErr } = await supabase.from('users').select('id, loyalty_points, loyalty_tier');
  console.log('Users:', users || usersErr);
  
  const { data: orders, error: ordersErr } = await supabase.from('orders').select('id, user_id, status, total_amount').order('created_at', { ascending: false }).limit(5);
  console.log('Orders:', orders || ordersErr);
}

check();
