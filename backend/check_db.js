const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
async function run() {
  const { data, error } = await supabase.from('reviews').select('*').limit(5);
  console.log('reviews rows:', data, 'error:', error);

  // Check table definition columns
  const { data: cols, error: cErr } = await supabase.rpc('get_table_columns', { table_name: 'reviews' }).catch(() => ({}));
  if (cols) console.log('cols:', cols);

  // Check RLS policies on reviews table
  const { data: policies, error: pErr } = await supabase
    .from('pg_policies')
    .select('*')
    .eq('tablename', 'reviews');
  console.log('policies:', policies, 'pErr:', pErr);
}
run();
