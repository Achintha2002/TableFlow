const fetch = require('node-fetch');
require('dotenv').config();

async function testSqlApi() {
  const url = `${process.env.SUPABASE_URL}/pg/query`;
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
        'apikey': process.env.SUPABASE_SERVICE_ROLE_KEY
      },
      body: JSON.stringify({ query: 'SELECT 1;' })
    });
    console.log('pg/query status:', res.status, await res.text());
  } catch (e) {
    console.error('pg/query fetch error:', e.message);
  }
}

testSqlApi();
