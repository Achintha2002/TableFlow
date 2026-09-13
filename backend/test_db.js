const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);
async function test() {
  const { data: q, error: e1 } = await supabase.from('queue_entries').select('*');
  console.log("Queue:", q, e1);
  const { data: o, error: e2 } = await supabase.from('orders').select('*');
  console.log("Orders:", o, e2);
  const { data: r, error: e3 } = await supabase.from('reservations').select('*');
  console.log("Reservations:", r, e3);
}
test();
