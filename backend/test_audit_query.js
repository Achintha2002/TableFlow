require('dotenv').config({ path: '/Users/achinthaedirisinghe/Desktop/TableFlow/backend/.env' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function testQuery() {
  console.log('Testing query from paymentAudit.js line 624...');
  const { data: orders, error } = await supabase
    .from('orders')
    .select(`
      *,
      users(id, full_name, email, phone_number),
      restaurant_tables(id, table_number),
      order_items(
        id,
        quantity,
        unit_price,
        item_notes,
        selected_customizations,
        menu_items(id, name, price, image_url)
      )
    `)
    .in('status', ['payment_pending', 'payment_rejected'])
    .order('created_at', { ascending: false });

  if (error) {
    console.error('SUPABASE QUERY ERROR:', error);
  } else {
    console.log('SUCCESS! Found orders count:', orders.length);
    console.log('Sample order:', JSON.stringify(orders[0] || null, null, 2));
  }
}

testQuery();
