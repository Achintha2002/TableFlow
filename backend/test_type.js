const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);
async function test() {
  const { data, error } = await supabase.from('order_items').insert({ order_id: "6569b966-a98a-4aeb-8cb8-e94c106f4d3c", menu_item_id: "wagyu", quantity: 1, unit_price: 100 });
  console.log("Error:", error);
}
test();
