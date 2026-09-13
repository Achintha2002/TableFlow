const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(
  'https://azjjndqecpemltvdbkvy.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF6ampuZHFlY3BlbWx0dmRia3Z5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY3OTA3ODEsImV4cCI6MjEwMjM2Njc4MX0.grBF4XJu0696MnrvKC-ZccppLGxPEM9KIHED8viZELc'
);
async function test() {
  const { data: users, error } = await supabase.from('users').select('*');
  console.log("Users:", users);
}
test();
