const http = require('http');

function postJson(path, body, token) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify(body);
    const options = {
      hostname: 'localhost',
      port: 3000,
      path: path,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload),
        'Authorization': `Bearer ${token}`
      }
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(data) });
        } catch (e) {
          resolve({ status: res.statusCode, raw: data });
        }
      });
    });

    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

async function runTests() {
  console.log('=== PHASE 8: AUTOMATED CUSTOMIZATION VALIDATION TESTS ===\n');

  // Sign in as a test user
  const { createClient } = require('@supabase/supabase-js');
  require('dotenv').config();
  const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

  const { data: authData, error: authErr } = await supabase.auth.signInWithPassword({
    email: 'tableflow@gmail.com',
    password: 'adminPassword123!'
  });

  if (authErr || !authData?.session) {
    console.error('Failed to authenticate test user:', authErr);
    process.exit(1);
  }

  const token = authData.session.access_token;
  let passed = 0;
  let total = 0;

  async function test(name, fn) {
    total++;
    try {
      await fn();
      console.log(`✓ PASS: ${name}`);
      passed++;
    } catch (err) {
      console.error(`✗ FAIL: ${name} ->`, err.message);
    }
  }

  const { data: resv } = await supabase.from('reservations').select('id').limit(1).single();
  const testReservationId = resv?.id;

  // TEST 1: Valid Order with Portion Size + Signature Sauce + Gourmet Extra
  await test('Valid order: King Cut Short Rib (+1200) + Truffle Peppercorn (+250) + Extra Mash (+450)', async () => {
    const res = await postJson('/api/orders', {
      reservation_id: testReservationId,
      items: [
        {
          menu_item_id: 4, // Braised Short Rib (Base 4200)
          quantity: 1,
          unit_price: 99999, // Tampered client price (should be overridden)
          selected_customizations: {
            size: { id: 'large', name: 'King Cut (400g)' },
            addons: [
              { group_id: 'sauce', id: 'truffle_pepper', name: 'Truffle Peppercorn', qty: 1 },
              { group_id: 'gourmet_extras', id: 'extra_mash', name: 'Extra Truffle Mash', qty: 1 }
            ],
            preference: 'Medium Rare',
            special_instructions: 'Extra warm plate'
          }
        }
      ],
      payment_method: 'cash'
    }, token);

    if (res.status !== 201 && res.status !== 200) {
      throw new Error(`Expected 201/200, got ${res.status}: ${JSON.stringify(res.data)}`);
    }

    // Expected price: 4200 (base) + 1200 (large) + 250 (sauce) + 450 (mash) = 6100
    const subtotal = res.data.breakdown.subtotal;
    if (subtotal !== 6100) {
      throw new Error(`Expected subtotal 6100, got ${subtotal}`);
    }
  });

  // TEST 2: Missing Required Group (Signature Sauce has min_select: 1)
  await test('Missing required sauce group is rejected with 400', async () => {
    const res = await postJson('/api/orders', {
      items: [
        {
          menu_item_id: 4,
          quantity: 1,
          selected_customizations: {
            size: { id: 'reg', name: 'Regular Portion (250g)' },
            addons: [] // Missing required sauce!
          }
        }
      ],
      payment_method: 'cash'
    }, token);

    if (res.status !== 400) {
      throw new Error(`Expected status 400, got ${res.status}: ${JSON.stringify(res.data)}`);
    }
    if (!res.data.error || !res.data.error.includes('Signature Sauce')) {
      throw new Error(`Expected error about Signature Sauce, got: ${res.data.error}`);
    }
  });

  // TEST 3: Add-on Marked is_available: false (foie_gras is sold out)
  await test('Selecting sold-out add-on (Seared Foie Gras) is rejected with 400', async () => {
    const res = await postJson('/api/orders', {
      items: [
        {
          menu_item_id: 4,
          quantity: 1,
          selected_customizations: {
            size: { id: 'reg', name: 'Regular Portion (250g)' },
            addons: [
              { group_id: 'sauce', id: 'red_wine', name: 'Red Wine Glaze', qty: 1 },
              { group_id: 'gourmet_extras', id: 'foie_gras', name: 'Seared Foie Gras', qty: 1 } // Sold out!
            ]
          }
        }
      ],
      payment_method: 'cash'
    }, token);

    if (res.status !== 400) {
      throw new Error(`Expected status 400, got ${res.status}: ${JSON.stringify(res.data)}`);
    }
    if (!res.data.error || !res.data.error.includes('sold out') && !res.data.error.includes('unavailable')) {
      throw new Error(`Expected error about sold out add-on, got: ${res.data.error}`);
    }
  });

  // TEST 4: Exceeding max_qty on an addon (bone_marrow has max_qty: 1)
  await test('Exceeding max_qty for add-on is rejected with 400', async () => {
    const res = await postJson('/api/orders', {
      items: [
        {
          menu_item_id: 4,
          quantity: 1,
          selected_customizations: {
            size: { id: 'reg', name: 'Regular Portion (250g)' },
            addons: [
              { group_id: 'sauce', id: 'red_wine', name: 'Red Wine Glaze', qty: 1 },
              { group_id: 'gourmet_extras', id: 'bone_marrow', name: 'Roasted Bone Marrow', qty: 2 } // Exceeds max_qty: 1 (but <= group max 3)
            ]
          }
        }
      ],
      payment_method: 'cash'
    }, token);

    if (res.status !== 400) {
      throw new Error(`Expected status 400, got ${res.status}: ${JSON.stringify(res.data)}`);
    }
    if (!res.data.error || !res.data.error.includes('Maximum quantity')) {
      throw new Error(`Expected error about Maximum quantity, got: ${res.data.error}`);
    }
  });

  // TEST 5: Exceeding group max_select (Gourmet Add-ons has max_select: 3)
  await test('Exceeding group max_select is rejected with 400', async () => {
    const res = await postJson('/api/orders', {
      items: [
        {
          menu_item_id: 4,
          quantity: 1,
          selected_customizations: {
            size: { id: 'reg', name: 'Regular Portion (250g)' },
            addons: [
              { group_id: 'sauce', id: 'red_wine', name: 'Red Wine Glaze', qty: 1 },
              { group_id: 'gourmet_extras', id: 'extra_mash', name: 'Extra Truffle Mash', qty: 2 },
              { group_id: 'gourmet_extras', id: 'asparagus', name: 'Charred Asparagus', qty: 1 },
              { group_id: 'gourmet_extras', id: 'bone_marrow', name: 'Roasted Bone Marrow', qty: 1 } // Total 4 > max_select 3
            ]
          }
        }
      ],
      payment_method: 'cash'
    }, token);

    if (res.status !== 400) {
      throw new Error(`Expected status 400, got ${res.status}: ${JSON.stringify(res.data)}`);
    }
    if (!res.data.error || !res.data.error.includes('at most 3 option(s)')) {
      throw new Error(`Expected error about max_select, got: ${res.data.error}`);
    }
  });

  console.log(`\n=== RESULTS: ${passed}/${total} TESTS PASSED ===\n`);
  if (passed === total) {
    process.exit(0);
  } else {
    process.exit(1);
  }
}

runTests();
