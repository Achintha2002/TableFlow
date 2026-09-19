// Test Suite for TableFlow Phase 10: Waiter Floor Mode, RBAC, Unpaid Order Guard & Atomic Attendance
require('dotenv').config();
const http = require('http');
const { createClient } = require('@supabase/supabase-js');

const BASE_URL = 'http://localhost:3000';
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

function makeRequest(method, path, body = null, headers = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE_URL);
    const payload = body ? (typeof body === 'object' ? JSON.stringify(body) : body) : null;
    const options = {
      method,
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      headers: {
        'Content-Type': 'application/json',
        ...(payload ? { 'Content-Length': Buffer.byteLength(payload) } : {}),
        ...headers
      }
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          resolve({ status: res.statusCode, data: parsed });
        } catch (_) {
          resolve({ status: res.statusCode, data });
        }
      });
    });

    req.on('error', reject);
    if (payload) {
      req.write(payload);
    }
    req.end();
  });
}

async function runFloorTests() {
  console.log('\n=============================================================');
  console.log('🧪 Starting TableFlow Phase 10: Waiter Floor Mode Test Suite');
  console.log('=============================================================\n');

  let passed = 0;
  let total = 0;

  async function assertTest(name, fn) {
    total++;
    try {
      await fn();
      console.log(`✅ [PASS] ${name}`);
      passed++;
    } catch (err) {
      console.error(`❌ [FAIL] ${name}:`, err.message);
    }
  }

  // Obtain an admin/staff token for testing
  const { data: adminAuth, error: authErr } = await supabase.auth.signInWithPassword({
    email: 'tableflow@gmail.com',
    password: 'adminPassword123!'
  });

  if (authErr || !adminAuth.session) {
    console.error('Failed to log in admin test user:', authErr?.message);
    process.exit(1);
  }

  const staffToken = adminAuth.session.access_token;
  const staffAuthHeader = { 'Authorization': `Bearer ${staffToken}` };

  // 1. RBAC: Unauthenticated calls rejected with 401
  await assertTest('RBAC: Unauthenticated calls to Floor endpoints rejected with 401', async () => {
    const res = await makeRequest('PATCH', '/api/tables/2/status', { status: 'occupied' });
    if (res.status !== 401) throw new Error(`Expected 401, got ${res.status}`);
  });

  // 2. RBAC: Staff/Admin token permitted
  await assertTest('RBAC: Staff authenticated token accepted on table status patch', async () => {
    const res = await makeRequest('PATCH', '/api/tables/2/status', { status: 'occupied' }, staffAuthHeader);
    if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}: ${JSON.stringify(res.data)}`);
    if (res.data.table?.status !== 'occupied') throw new Error(`Expected status 'occupied'`);
  });

  // 3. Unpaid Order Guard: Prevents marking table available if an unpaid active order exists
  await assertTest('Unpaid Order Guard: Rejects marking table available with 409 Conflict', async () => {
    // Fetch a reservation to satisfy legacy orders_check constraint if active
    const { data: resData } = await supabase.from('reservations').select('id').limit(1).single();

    const { data: testOrder, error: insErr } = await supabase
      .from('orders')
      .insert({
        table_id: 2,
        user_id: adminAuth.user.id,
        total_amount: 4200,
        status: 'preparing',
        reservation_id: resData?.id
      })
      .select()
      .single();

    if (insErr) throw new Error(`Setup testOrder failed: ${insErr.message}`);

    try {
      // Try to mark table available without force
      const res = await makeRequest('PATCH', '/api/tables/2/status', { status: 'available' }, staffAuthHeader);
      if (res.status !== 409) {
        throw new Error(`Expected 409 Conflict, got ${res.status}: ${JSON.stringify(res.data)}`);
      }
      if (!res.data.error.includes('unsettled order')) {
        throw new Error(`Expected error message mentioning unsettled order, got: ${res.data.error}`);
      }

      // Try with force=true: should succeed
      const forceRes = await makeRequest('PATCH', '/api/tables/2/status', { status: 'available', force: true }, staffAuthHeader);
      if (forceRes.status !== 200) {
        throw new Error(`Expected 200 with force=true, got ${forceRes.status}`);
      }
    } finally {
      // Cleanup test order
      if (testOrder?.id) {
        await supabase.from('orders').delete().eq('id', testOrder.id);
      }
    }
  });

  // 4. Service Requests: Customer creation & Staff listing
  let createdRequestId = null;
  await assertTest('Service Requests: Customer creates request and staff retrieves it', async () => {
    const postRes = await makeRequest('POST', '/api/service-requests', {
      table_id: 3,
      request_type: 'water',
      user_id: adminAuth.user.id
    });
    if (postRes.status !== 201) throw new Error(`Expected 201, got ${postRes.status}`);
    createdRequestId = postRes.data.request?.id;
    if (!createdRequestId) throw new Error('Missing request ID');

    const getRes = await makeRequest('GET', '/api/service-requests', null, staffAuthHeader);
    if (getRes.status !== 200) throw new Error(`Expected 200, got ${getRes.status}`);
    if (!Array.isArray(getRes.data)) throw new Error('Expected array of requests');
  });

  // 5. Atomic Attendance: Only one staff member claims request, second receives 409 Conflict
  await assertTest('Atomic Attendance: First call marks attended (200), duplicate gets 409 Conflict', async () => {
    if (!createdRequestId) throw new Error('No test request ID available');

    // First call: Attend
    const res1 = await makeRequest('PATCH', `/api/service-requests/${createdRequestId}/attend`, {}, staffAuthHeader);
    if (res1.status !== 200) throw new Error(`Expected 200 on first attend, got ${res1.status}`);

    // Second call: Race condition simulation
    const res2 = await makeRequest('PATCH', `/api/service-requests/${createdRequestId}/attend`, {}, staffAuthHeader);
    if (res2.status !== 409) throw new Error(`Expected 409 Conflict on second attend, got ${res2.status}`);
    if (!res2.data.error.includes('Already attended')) {
      throw new Error(`Expected 'Already attended' in error message`);
    }
  });

  // 6. Staff Order Punch-in & Merging into Table Session
  await assertTest('Staff Orders: Merges into existing table bill instead of creating split duplicate', async () => {
    // Step A: Punch in first dish for Table 5
    const order1 = await makeRequest('POST', '/api/staff/orders', {
      table_id: 5,
      items: [{ id: 4, quantity: 1, item_notes: 'First course' }]
    }, staffAuthHeader);

    if (order1.status !== 201 && order1.status !== 200) {
      throw new Error(`Expected 201/200, got ${order1.status}: ${JSON.stringify(order1.data)}`);
    }
    const originalOrderId = order1.data.order_id;

    try {
      // Step B: Waiter punches in second dish for same table
      const order2 = await makeRequest('POST', '/api/staff/orders', {
        table_id: 5,
        items: [{ id: 8, quantity: 2, item_notes: 'Table drinks' }]
      }, staffAuthHeader);

      if (order2.status !== 200) {
        throw new Error(`Expected 200 for merged order, got ${order2.status}`);
      }
      if (order2.data.mode !== 'merged') {
        throw new Error(`Expected mode: 'merged', got ${order2.data.mode}`);
      }
      if (order2.data.order_id !== originalOrderId) {
        throw new Error(`Expected same order ID ${originalOrderId}, but got new ID ${order2.data.order_id}`);
      }
      console.log(`   (Successfully merged drinks into Table #5 Order #${originalOrderId})`);
    } finally {
      // Clean up test order
      if (originalOrderId) {
        await supabase.from('orders').delete().eq('id', originalOrderId);
      }
      // Revert table 5 to available
      await supabase.from('restaurant_tables').update({ status: 'available' }).eq('id', 5);
      await supabase.from('restaurant_tables').update({ status: 'available' }).eq('id', 2);
    }
  });

  console.log('\n=============================================================');
  console.log(`📊 Test Results: ${passed}/${total} Passed (${Math.round((passed / total) * 100)}%)`);
  console.log('=============================================================\n');

  if (passed === total) {
    process.exit(0);
  } else {
    process.exit(1);
  }
}

runFloorTests().catch(err => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
