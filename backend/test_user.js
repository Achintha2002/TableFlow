const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);
async function test() {
  const { data: orders, error: e1 } = await supabase.from('orders').select('user_id').limit(1);
  if (orders && orders.length > 0) {
    const userId = orders[0].user_id;
    const { data: user, error: e2 } = await supabase.from('users').select('*').eq('id', userId);
    console.log("User details:", user, e2);
  }
}
test();
