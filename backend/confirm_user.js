const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function confirmUser() {
  console.log('Fetching users...');
  const { data: usersData, error: listError } = await supabase.auth.admin.listUsers();
  
  if (listError) {
    console.error('Error fetching users:', listError);
    return;
  }
  
  const targetEmail = 'achinthaedirisinghe67@gmail.com';
  const user = usersData.users.find(u => u.email === targetEmail);
  
  if (!user) {
    console.error(`User with email ${targetEmail} not found.`);
    return;
  }
  
  console.log(`Found user ${targetEmail} with ID ${user.id}. Updating email confirmation...`);
  
  const { data, error } = await supabase.auth.admin.updateUserById(
    user.id,
    { email_confirm: true }
  );
  
  if (error) {
    console.error('Error confirming email:', error);
  } else {
    console.log('Successfully confirmed email for', targetEmail);
  }
}

confirmUser();
