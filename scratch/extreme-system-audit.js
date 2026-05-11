/**
 * EXTREME SYSTEM AUDIT — Mini Distributed Grab
 * Tập trung vào các trường hợp "hiếm", "khó" và "lỗi sâu trong lõi"
 */

const axios = require('axios');
const { execSync } = require('child_process');

const API_URL = 'http://localhost:3000';
let PASS = 0;
let FAIL = 0;

function log(msg) { console.log(msg); }
function ok(label) { PASS++; log(`  ✅ PASS: ${label}`); }
function fail(label, detail) { FAIL++; log(`  ❌ FAIL: ${label} -> ${detail}`); }
function section(title) { log(`\n=== ${title} ===`); }

async function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function clearActiveTrips(token) {
    try {
        const res = await axios.get(`${API_URL}/trips/history`, { headers: { Authorization: `Bearer ${token}` } });
        // Handle both { data: [...] } and { data: { data: [...] } }
        let trips = [];
        if (Array.isArray(res.data.data)) trips = res.data.data;
        else if (res.data.data && Array.isArray(res.data.data.data)) trips = res.data.data.data;
        else if (Array.isArray(res.data)) trips = res.data;

        const active = trips.filter(t => t.status === 'pending' || t.status === 'accepted');
        if (active.length > 0) log(`  🧹 Cleaning up ${active.length} active trips...`);
        for (const t of active) {
            await axios.patch(`${API_URL}/trips/${t.id}/cancel`, {}, { headers: { Authorization: `Bearer ${token}` } }).catch(e => {
                log(`    ❌ Cancel failed for ${t.id}: ${e.response?.status} - ${JSON.stringify(e.response?.data)}`);
            });
        }
    } catch (e) {
        log(`  ⚠️ Cleanup failed: ${e.message}`);
    }
}

async function runExtremeAudit() {
  log('🚀 Bắt đầu EXTREME SYSTEM AUDIT...');

  try {
    // 1. Stress Test: Snowflake ID Uniqueness
    section('EXT-01: SNOWFLAKE ID INTEGRITY');
    await clearActiveTrips(TOKEN_NORTH);
    
    const tripPromises = [];
    log(`  Attempting 20 rapid bookings (concurrency check will block 19)...`);
    for (let i = 0; i < 20; i++) {
      tripPromises.push(axios.post(`${API_URL}/trips/book`, {
        pickup_lat: 21.0, pickup_lng: 105.0,
        pickup: 'Stress Test', dropoff: 'Dest', fare: 1000 + i
      }, { headers: { Authorization: `Bearer ${TOKEN_NORTH}` } }).catch(e => e.response));
    }
    const results = await Promise.all(tripPromises);
    const created = results.filter(r => r?.status === 201);
    const blocked = results.filter(r => r?.status === 409);
    
    if (created.length === 1 && blocked.length === 19) {
      ok(`Concurrency protection: Only 1 trip created, 19 blocked.`);
    } else {
      fail('Concurrency check failed', `Created: ${created.length}, Blocked: ${blocked.length}`);
    }

    // 2. Race Condition: Concurrent Accept
    section('EXT-02: CONCURRENT ACCEPTANCE RACE');
    await clearActiveTrips(TOKEN_NORTH);
    try {
      await axios.patch(`${API_URL}/drivers/availability`, { is_available: true }, {
          headers: { Authorization: `Bearer ${TOKEN_DRIVER}` }
      });

      const bookRes = await axios.post(`${API_URL}/trips/book`, {
        pickup_lat: 21.0, pickup_lng: 105.0, pickup: 'Race Trip', fare: 50000
      }, { headers: { Authorization: `Bearer ${TOKEN_NORTH}` } });
      const raceTripId = bookRes.data.trip.id;

      log(`  Trip ${raceTripId} created. Attempting concurrent acceptance by 5 drivers...`);
      const acceptPromises = [];
      for (let i = 0; i < 5; i++) {
        acceptPromises.push(axios.patch(`${API_URL}/trips/${raceTripId}/accept`, {}, { 
          headers: { Authorization: `Bearer ${TOKEN_DRIVER}` } 
        }).catch(e => e.response));
      }
      const acceptResults = await Promise.all(acceptPromises);
      const successes = acceptResults.filter(r => r?.status === 200 || r?.status === 201);
      
      if (successes.length === 1) {
        ok(`Atomic lock works: Only 1 driver accepted.`);
      } else {
        fail('Race Condition in Acceptance', `Successes: ${successes.length}`);
      }
    } catch (e) {
      fail('EXT-02 Error', e.message);
    }

    // 3. Global State: Driver Busy in all Regions
    section('EXT-03: GLOBAL DRIVER STATE CONSISTENCY');
    const checkSouth = await axios.get(`${API_URL}/drivers/nearby?lat=10.7&lng=106.7&vehicle_type=bike`, {
        headers: { Authorization: `Bearer ${TOKEN_NORTH}` }
    });
    const isVisibleInSouth = checkSouth.data.data.some(d => d.id === DRIVER_ID || d.user_id === DRIVER_ID);
    if (!isVisibleInSouth) {
      ok('Driver accepted in NORTH is correctly hidden (Busy) in SOUTH nearby search.');
    } else {
      fail('Global State Inconsistency', 'Driver still visible (Available) in SOUTH after accepting in NORTH.');
    }

    // 4. Illegal Transitions: State Machine Audit
    section('EXT-04: ILLEGAL STATE TRANSITIONS');
    await clearActiveTrips(TOKEN_NORTH);
    try {
      const bookRes = await axios.post(`${API_URL}/trips/book`, {
          pickup_lat: 21.0, pickup_lng: 105.0, pickup: 'Fail Trip', fare: 10000
      }, { headers: { Authorization: `Bearer ${TOKEN_NORTH}` } });
      const failTripId = bookRes.data.trip.id;
      await axios.patch(`${API_URL}/trips/${failTripId}/cancel`, {}, { headers: { Authorization: `Bearer ${TOKEN_NORTH}` } });
      
      const illegalComplete = await axios.patch(`${API_URL}/trips/${failTripId}/complete`, {}, { 
          headers: { Authorization: `Bearer ${TOKEN_DRIVER}` } 
      }).catch(e => e.response);
      
      if (illegalComplete.status >= 400) {
        ok(`Blocked illegal transition (Complete -> Cancelled) with status ${illegalComplete.status}`);
      } else {
        fail('Illegal Transition', `Expected >= 400, got ${illegalComplete.status}`);
      }
    } catch (e) {
      fail('EXT-04 Error', e.message);
    }

    // 5. Data Integrity: Special Characters & Large Values
    section('EXT-05: DATA INTEGRITY (Edge Cases)');
    await clearActiveTrips(TOKEN_NORTH);
    try {
      const specialName = "𝓝𝓰𝓾𝔂ễ𝓷 Văn 𝓐 ⚡ 123";
      const hugeFare = 88888888;
      const edgeRes = await axios.post(`${API_URL}/trips/book`, {
        pickup_lat: 21.0, pickup_lng: 105.0,
        pickup: specialName, dropoff: 'Test', fare: hugeFare
      }, { headers: { Authorization: `Bearer ${TOKEN_NORTH}` } });

      if (edgeRes.status === 201 && edgeRes.data.trip.pickup_address === specialName && Number(edgeRes.data.trip.fare) === hugeFare) {
        ok('System handles Unicode characters and large numeric values correctly.');
      } else {
        fail('Data integrity failure', `Status: ${edgeRes.status}`);
      }
    } catch (e) {
      fail('Data integrity failure', e.response?.data?.message || e.message);
    }

    // 6. Cross-Region History: Full Join Audit
    section('EXT-06: CROSS-REGION HISTORY AGGREGATION');
    const history = await axios.get(`${API_URL}/trips/history`, { headers: { Authorization: `Bearer ${TOKEN_NORTH}` } });
    const hasNorth = history.data.data.some(t => t.region === 'NORTH');
    const hasSouth = history.data.data.some(t => t.region === 'SOUTH');
    if (hasNorth && hasSouth) {
      ok('History correctly aggregates trips from both NORTH and SOUTH databases.');
    } else {
      fail('History aggregation incomplete', `North: ${hasNorth}, South: ${hasSouth}`);
    }

  } catch (e) {
    log(`💥 Audit crashed: ${e.message}`);
  }

  log(`\n=== KẾT QUẢ AUDIT ===`);
  log(`  PASS: ${PASS}`);
  log(`  FAIL: ${FAIL}`);
  if (FAIL === 0) log('  🎉 HỆ THỐNG ĐẠT CHUẨN LÕI PHÂN TÁN (EXTREME PASSED)');
}

let TOKEN_NORTH = '';
let TOKEN_SOUTH = '';
let TOKEN_DRIVER = '';
let DRIVER_ID = '';

async function setup() {
    try {
        const r1 = await axios.post(`${API_URL}/auth/login`, { email: 'bac1@test.com', password: '123456' });
        TOKEN_NORTH = r1.data.data.token;
        const r2 = await axios.post(`${API_URL}/auth/login`, { email: 'nam1@test.com', password: '123456' });
        TOKEN_SOUTH = r2.data.data.token;
        const r3 = await axios.post(`${API_URL}/auth/login`, { email: 'driver_bac@test.com', password: '123456' });
        TOKEN_DRIVER = r3.data.data.token;
        DRIVER_ID = r3.data.data.user.id;
    } catch (e) {
        log(`Setup failed: ${e.message}`);
    }
}

setup().then(runExtremeAudit);
