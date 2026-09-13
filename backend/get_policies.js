const { Client } = require('pg');
require('dotenv').config();

// The SUPABASE_URL is https://azjjndqecpemltvdbkvy.supabase.co
// Connection string for postgres:
const connString = `postgres://postgres.azjjndqecpemltvdbkvy:${process.env.SUPABASE_DB_PASSWORD || process.env.SUPABASE_SERVICE_ROLE_KEY}@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres`;

async function run() {
  const client = new Client({ connectionString: connString });
  try {
    // Note: I don't have the DB password. I can't use `pg`. I only have the Service Role Key.
  } catch(e) {}
}
run();
