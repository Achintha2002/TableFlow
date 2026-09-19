// test_reports_export.js - Automated verification for Phase 11 Reports & CSV Export
const http = require('http');

function get(url) {
  return new Promise((resolve, reject) => {
    http.get(url, (res) => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          data
        });
      });
    }).on('error', reject);
  });
}

async function runTests() {
  console.log('=== PHASE 11: SALES REPORTS & CSV EXPORT AUTOMATED VERIFICATION ===\n');
  let passed = 0;
  let total = 0;

  function assert(condition, message) {
    total++;
    if (condition) {
      console.log(`✅ [PASS] ${message}`);
      passed++;
    } else {
      console.error(`❌ [FAIL] ${message}`);
    }
  }

  try {
    // 1. Test /api/admin/reports/summary (Default 'this_week')
    console.log('--- Test 1: GET /api/admin/reports/summary (this_week) ---');
    const resSummary = await get('http://localhost:3000/api/admin/reports/summary?range=this_week');
    assert(resSummary.statusCode === 200, `Summary status is 200 (Got ${resSummary.statusCode})`);
    
    const summaryJson = JSON.parse(resSummary.data);
    assert(summaryJson.range === 'this_week', `Summary range is 'this_week'`);
    assert(summaryJson.summary && typeof summaryJson.summary.grossRevenue === 'number', `Gross revenue is numeric (${summaryJson.summary.grossRevenue})`);
    assert(typeof summaryJson.summary.ordersCount === 'number', `Orders count is numeric (${summaryJson.summary.ordersCount})`);
    assert(Array.isArray(summaryJson.paymentBreakdown), `Payment breakdown is an array (length: ${summaryJson.paymentBreakdown.length})`);
    assert(Array.isArray(summaryJson.topSellingItems), `Top selling items is an array`);
    assert(Array.isArray(summaryJson.timeSeries), `Time series is an array (length: ${summaryJson.timeSeries.length})`);
    assert(summaryJson.shiftSummary && typeof summaryJson.shiftSummary.grossSales === 'number', `Z-Report shift summary present`);

    // 2. Test /api/admin/reports/summary for 'today' (Hourly distribution)
    console.log('\n--- Test 2: GET /api/admin/reports/summary (today) ---');
    const resToday = await get('http://localhost:3000/api/admin/reports/summary?range=today');
    assert(resToday.statusCode === 200, `Today summary status is 200`);
    const todayJson = JSON.parse(resToday.data);
    assert(todayJson.timeSeries.length === 24, `Today time series contains 24 hourly buckets (Got ${todayJson.timeSeries.length})`);

    // 3. Test /api/admin/reports/summary for 'custom' range
    console.log('\n--- Test 3: GET /api/admin/reports/summary (custom dates) ---');
    const resCustom = await get('http://localhost:3000/api/admin/reports/summary?range=custom&startDate=2026-09-01&endDate=2026-09-19');
    assert(resCustom.statusCode === 200, `Custom summary status is 200`);
    const customJson = JSON.parse(resCustom.data);
    assert(customJson.range === 'custom', `Range returned is 'custom'`);

    // 4. Test /api/admin/reports/orders/export CSV download
    console.log('\n--- Test 4: GET /api/admin/reports/orders/export (CSV streaming) ---');
    const resExport = await get('http://localhost:3000/api/admin/reports/orders/export?range=this_week');
    assert(resExport.statusCode === 200, `CSV Export status is 200`);
    assert(resExport.headers['content-type'].includes('text/csv'), `Content-Type is text/csv (Got ${resExport.headers['content-type']})`);
    assert(resExport.headers['content-disposition'].includes('attachment; filename='), `Content-Disposition has attachment filename`);
    
    // Check UTF-8 BOM and headers
    const hasBomAndHeader = resExport.data.charCodeAt(0) === 0xFEFF && resExport.data.includes('Order ID');
    assert(hasBomAndHeader, `CSV starts with UTF-8 BOM and standard RFC4180 headers`);
    const lines = resExport.data.trim().split('\r\n');
    assert(lines.length >= 1, `CSV contains at least header row (Total lines: ${lines.length})`);
    console.log(`Sample CSV Header: ${lines[0]}`);
    if (lines.length > 1) {
      console.log(`Sample First Row: ${lines[1].slice(0, 100)}...`);
    }

    // 5. Test mathematical consistency of summary metrics
    console.log('\n--- Test 5: Mathematical Consistency ---');
    const { grossRevenue, totalDiscounts, netRevenue, paidCount, pendingCount, ordersCount } = summaryJson.summary;
    assert(netRevenue === Math.max(0, grossRevenue - totalDiscounts), `Net Revenue (${netRevenue}) = Gross Revenue (${grossRevenue}) - Total Discounts (${totalDiscounts})`);
    assert(paidCount + pendingCount === ordersCount, `Paid Count (${paidCount}) + Pending Count (${pendingCount}) = Total Orders (${ordersCount})`);

    console.log(`\n======================================================`);
    console.log(`RESULTS: ${passed}/${total} assertions passed (${Math.round((passed/total)*100)}%)`);
    console.log(`======================================================\n`);

    if (passed === total) {
      process.exit(0);
    } else {
      process.exit(1);
    }
  } catch (err) {
    console.error('Test execution error:', err);
    process.exit(1);
  }
}

runTests();
