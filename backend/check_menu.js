const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY
);

async function run() {
  const { data, error } = await supabase
    .from('menu_items')
    .select('id, name, category, price, is_available');
  if (error) {
    console.error('Error:', error);
  } else {
    console.log(`Found ${data.length} items:`);
    console.log(data);
  }
}
run();
