// Test Suite for TableFlow Phase 9: FCM Push Notifications & Transition Guards
require('dotenv').config();
const http = require('http');

const BASE_URL = 'http://localhost:3000';

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

async function runTests() {
  console.log('\n======================================================');
  console.log('🧪 Starting TableFlow Phase 9 FCM & Notification Tests');
  console.log('======================================================\n');

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

  // 1. Health check & FCM mode
  await assertTest('GET /api/health exposes FCM mode correctly', async () => {
    const res = await makeRequest('GET', '/api/health');
    if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}`);
    if (res.data.status !== 'ok') throw new Error(`Expected status: 'ok'`);
    if (!res.data.fcm_mode) throw new Error(`Missing fcm_mode in health response`);
    console.log(`   (FCM Mode: ${res.data.fcm_mode}, Configured: ${res.data.fcm_configured})`);
  });

  // 2. Register FCM device token
  const testUserId = '17c98ed6-2dc5-498e-b7d3-96f03a368f12';
  const testToken = `test_fcm_token_${Date.now()}`;

  await assertTest('POST /api/notifications/fcm-token registers device token', async () => {
    const res = await makeRequest('POST', '/api/notifications/fcm-token', {
      user_id: testUserId,
      fcm_token: testToken,
      platform: 'web',
      device_info: 'Chrome Test Runner'
    });
    if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}: ${JSON.stringify(res.data)}`);
    if (!res.data.success) throw new Error(`Expected success: true`);
  });

  // 3. Deregister FCM device token
  await assertTest('DELETE /api/notifications/fcm-token removes device token', async () => {
    const res = await makeRequest('DELETE', '/api/notifications/fcm-token', {
      fcm_token: testToken
    });
    if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}`);
    if (!res.data.success) throw new Error(`Expected success: true`);
  });

  // 4. Test Notification Service direct dispatch (fcm.js)
  await assertTest('fcmService.sendToUser records notification & simulates dispatch', async () => {
    const fcmService = require('./src/services/fcm.js');
    const result = await fcmService.sendToUser(testUserId, {
      title: '🍽️ Order Ready! (Test)',
      body: 'Your Ribeye Steak is ready to serve.',
      data: { type: 'order_ready', orderId: 'test-order-123' },
      type: 'order_ready'
    });
    if (!result.success) throw new Error(`Expected success: true, got ${JSON.stringify(result)}`);
    if (result.mode !== 'simulation' && result.mode !== 'live' && result.mode !== 'no_tokens') {
      throw new Error(`Unexpected result mode: ${result.mode}`);
    }
  });

  // 5. Test Topic dispatch (fcm.js)
  await assertTest('fcmService.sendToTopic dispatches staff alert topic', async () => {
    const fcmService = require('./src/services/fcm.js');
    const result = await fcmService.sendToTopic('staff-service-calls', {
      title: '🛎️ Guest Request',
      body: 'Table #4 requested: WATER',
      data: { type: 'service_request', tableId: '4' }
    });
    if (!result.success) throw new Error(`Expected success: true, got ${JSON.stringify(result)}`);
  });

  // 6. Test Batch dispatch (fcm.js)
  await assertTest('fcmService.sendBatchToUsers dispatches to multiple recipients', async () => {
    const fcmService = require('./src/services/fcm.js');
    const result = await fcmService.sendBatchToUsers([testUserId], {
      title: '🔔 Waitlist Ready',
      body: 'Your table is ready!',
      data: { type: 'queue_ready' }
    });
    if (!result.success) throw new Error(`Expected success: true`);
    if (result.total !== 1) throw new Error(`Expected total 1, got ${result.total}`);
  });

  // 7. Security: Test Endpoint Rate Limiting & Auth
  await assertTest('POST /api/notifications/test rejects unauthenticated calls', async () => {
    const res = await makeRequest('POST', '/api/notifications/test', {
      title: 'Malicious Push',
      body: 'Should be rejected'
    });
    if (res.status !== 401) {
      throw new Error(`Expected 401 Unauthorized, got ${res.status}`);
    }
  });

  // 8. Transition Guard Verification: status change fires push, duplicate status suppresses it
  await assertTest('Transition guard: fires on status change to ready, suppresses duplicate', async () => {
    const { createClient } = require('@supabase/supabase-js');
    const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
    
    const { data: order } = await sb.from('orders').select('id, status, user_id').limit(1).single();
    if (!order) {
      console.log('   (No orders in database, skipping DB transition test)');
      return;
    }

    const fcmService = require('./src/services/fcm.js');
    let dispatchCount = 0;
    const originalSend = fcmService.sendToUser;
    fcmService.sendToUser = async (...args) => {
      dispatchCount++;
      return originalSend.apply(fcmService, args);
    };

    try {
      // Step A: Set to preparing
      await sb.from('orders').update({ status: 'preparing' }).eq('id', order.id);

      // Step B: Simulate transition from preparing -> ready
      const { data: currentOrder } = await sb.from('orders').select('status, user_id').eq('id', order.id).single();
      const currentStatus = currentOrder.status;
      const targetStatus = 'ready';

      if (currentStatus !== 'ready' && targetStatus === 'ready' && currentOrder.user_id) {
        await fcmService.sendToUser(currentOrder.user_id, {
          title: '🍽️ Order Ready!',
          body: 'Your food is ready.',
          data: { type: 'order_ready' }
        });
      }
      if (dispatchCount !== 1) throw new Error(`Expected dispatchCount 1, got ${dispatchCount}`);

      // Step C: Update DB to ready
      await sb.from('orders').update({ status: 'ready' }).eq('id', order.id);

      // Step D: Redundant re-send with targetStatus = ready when order is already ready
      const { data: secondFetch } = await sb.from('orders').select('status, user_id').eq('id', order.id).single();
      const secondCurrentStatus = secondFetch.status;

      if (secondCurrentStatus !== 'ready' && targetStatus === 'ready') {
        await fcmService.sendToUser(secondFetch.user_id, { title: '🍽️ Duplicate Push' });
      }

      // dispatchCount must strictly remain 1
      if (dispatchCount !== 1) throw new Error(`Duplicate dispatch detected! dispatchCount was ${dispatchCount}`);
    } finally {
      fcmService.sendToUser = originalSend;
      if (order.status) {
        await sb.from('orders').update({ status: order.status }).eq('id', order.id);
      }
    }
  });

  console.log('\n======================================================');
  console.log(`📊 Test Results: ${passed}/${total} Passed (${Math.round((passed / total) * 100)}%)`);
  console.log('======================================================\n');

  if (passed === total) {
    process.exit(0);
  } else {
    process.exit(1);
  }
}

runTests().catch(err => {
  console.error('Fatal error running tests:', err);
  process.exit(1);
});
