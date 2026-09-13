const fetch = require('node-fetch');
async function run() {
  const res = await fetch('http://localhost:3000/api/admin/analytics');
  console.log(res.status, await res.text());
}
run();
