require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function check() {
  const { data, error } = await supabase.from('restaurant_tables').select('*').limit(1);
  console.log("TABLE COLUMNS:", data && data.length > 0 ? Object.keys(data[0]) : "No tables", error);
}
check();
