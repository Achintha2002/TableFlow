require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
async function run() {
  const { error } = await supabase.from('users').update({ role: 'admin' }).eq('email', 'achinthaedirisinghe67@gmail.com');
  console.log('Update Error:', error);
}
run();
