require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function main() {
  const { data, error } = await supabase.auth.admin.createUser({
    email: 'hello@tableflow.com',
    password: 'Password123!',
    email_confirm: true,
    user_metadata: { full_name: 'Hello Tester', phone: '0771234567' }
  });

  if (error) {
    console.error('Error creating user:', error);
  } else {
    console.log('User created successfully:', data.user.email);
  }
}

main();
