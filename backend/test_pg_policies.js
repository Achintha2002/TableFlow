const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);
async function test() {
  const { data, error } = await supabase.from('pg_policies').select('*').eq('tablename', 'order_items');
  console.log("Policies:", data, error);
}
test();
