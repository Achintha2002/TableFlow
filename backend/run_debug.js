const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  const { data, error } = await supabase.rpc('get_pg_policies');
  console.log('policies:', JSON.stringify(data, null, 2));
  console.log('error:', error);
}
run();
