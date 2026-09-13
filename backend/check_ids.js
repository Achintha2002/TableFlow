require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
async function run() {
  const { data: authUsers, error: authError } = await supabase.auth.admin.listUsers();
  const { data: publicUsers, error: publicError } = await supabase.from('users').select('id, email, role');
  
  console.log("Auth Users:");
  authUsers.users.forEach(u => {
    if(u.email === 'tableflow@gmail.com' || u.email === 'achintha123@sportify.com') {
      console.log(u.email, '-> auth.uid:', u.id);
    }
  });

  console.log("\nPublic Users:");
  publicUsers.forEach(u => {
    if(u.email === 'tableflow@gmail.com' || u.email === 'achintha123@sportify.com') {
      console.log(u.email, '-> public.users.id:', u.id, 'role:', u.role);
    }
  });
}
run();
