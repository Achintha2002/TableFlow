const supabaseAdmin = require('../src/config/supabase');

async function check() {
  const { data: tables, error: tErr } = await supabaseAdmin
    .from('restaurant_tables')
    .select('id, table_number, status')
    .in('table_number', [1, 2, 3, 4, 5, 6]);
  console.log('Tables:', tables);

  const { data: res, error: rErr } = await supabaseAdmin
    .from('reservations')
    .select('id, table_id, status, reservation_date, reservation_time, created_at, admin_reply')
    .in('status', ['confirmed', 'pending']);
  console.log('Active reservations:', res);
}

check().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
