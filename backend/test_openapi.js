const https = require('https');
require('dotenv').config();
const options = {
  hostname: 'azjjndqecpemltvdbkvy.supabase.co',
  path: '/rest/v1/',
  method: 'GET',
  headers: {
    'apikey': process.env.SUPABASE_ANON_KEY
  }
};
const req = https.request(options, (res) => {
  let data = '';
  res.on('data', (chunk) => { data += chunk; });
  res.on('end', () => {
    const spec = JSON.parse(data);
    console.log(JSON.stringify(spec.definitions.order_items, null, 2));
  });
});
req.end();
