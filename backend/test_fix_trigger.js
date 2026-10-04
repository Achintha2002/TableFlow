const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function test() {
  // Test if we can insert a dummy reservation and see the exact error
  const { data, error } = await supabase.from('reservations').insert({
    user_id: '00000000-0000-0000-0000-000000000000',
    table_id: 1,
    reservation_date: '2026-10-04',
    reservation_time: '23:59:00',
    status: 'confirmed',
    pax: 2
  });
  console.log('Insert test result:', { error: error?.message, code: error?.code });
}

test();
