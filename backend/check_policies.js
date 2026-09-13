require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
async function run() {
  const { data, error } = await supabase.rpc('get_policies_for_table', { tablename: 'users' });
  if (error) {
    // let's try direct sql query via rest if possible, or just psql? No psql. 
    // We can just fetch via a standard REST query on pg_policies? No, usually not exposed.
    console.log("RPC Error:", error.message);
  } else {
    console.log(data);
  }
}
run();
