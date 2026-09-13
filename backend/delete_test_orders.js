const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);
async function test() {
  const { data, error } = await supabase.from('orders').delete().eq('status', 'pending');
  console.log("Deleted pending orders:", error);
}
test();
