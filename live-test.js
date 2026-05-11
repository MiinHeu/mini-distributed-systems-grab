/**
 * LIVE TEST — Hệ thống Gọi Xe Phân Tán
 * Toàn diện: Health, Auth, Routing, Replication, Failover, Recovery, Read-only Mode, Concurrency
 */

const axios = require('axios');
const { execSync } = require('child_process');

const API_URL = 'http://localhost:3000';
let PASS = 0;
let FAIL = 0;

function log(msg) { console.log(msg); }
function ok(label) { PASS++; log(`  ✅ PASS: ${label}`); }
function fail(label, detail) { FAIL++; log(`  ❌ FAIL: ${label} -> ${detail}`); }
function section(title) { log(`\n============================================================\n  ${title}\n============================================================`); }

async function req(method, url, data = null, token = null) {
  try {
    const headers = token ? { Authorization: `Bearer ${token}` } : {};
    const res = await axios({ method, url: `${API_URL}${url}`, data, headers, timeout: 5000 });
    return { status: res.status, body: res.data };
  } catch (e) {
    return { status: e.response?.status || 500, body: e.response?.data || e.message };
  }
}

// ─── AUTH DATA ────────────────────────────────────────────────────────────────

let TOKEN_NORTH = '';
let TOKEN_SOUTH = '';
let TOKEN_DRIVER = '';

async function testHealth() {
  section('HEALTH CHECK — 4 nodes + replication');

  const r = await req('GET', '/health');
  if (r.status !== 200) return fail('GET /health', `status=${r.status}`);
  ok('GET /health returns 200');

  const data = r.body.data;
  const nodes = data.nodes;
  
  const expectedNodes = ['NORTH_PRIMARY', 'NORTH_REPLICA', 'SOUTH_PRIMARY', 'SOUTH_REPLICA'];
  expectedNodes.forEach(name => {
    const node = nodes[name];
    if (node && node.status === 'online') ok(`${name} is online (${node.responseTimeMs}ms)`);
    else fail(`${name} is offline`, JSON.stringify(node));
  });

  if (data.serviceLevel.NORTH === 'full') ok('NORTH serviceLevel = full');
  if (data.serviceLevel.SOUTH === 'full') ok('SOUTH serviceLevel = full');

  if (data.replication.NORTH?.connected) ok('NORTH replication connected (WAL streaming)');
  if (data.replication.SOUTH?.connected) ok('SOUTH replication connected (WAL streaming)');

  log(`  ℹ️  Uptime: ${data.uptimeSeconds}s`);
}

async function testAuth() {
  section('AUTH — Login / Register');

  const r1 = await req('POST', '/auth/login', { email: 'bac1@test.com', password: '123456' });
  if (r1.status === 201) {
    TOKEN_NORTH = r1.body.data.token;
    ok('Login bac1@test.com → token OK (status=201)');
  } else fail('Login bac1@test.com', `status=${r1.status}`);

  const r2 = await req('POST', '/auth/login', { email: 'nam1@test.com', password: '123456' });
  if (r2.status === 201) {
    TOKEN_SOUTH = r2.body.data.token;
    ok('Login nam1@test.com → token OK');
  } else fail('Login nam1@test.com', `status=${r2.status}`);

  const r3 = await req('POST', '/auth/login', { email: 'driver_bac@test.com', password: '123456' });
  if (r3.status === 201) {
    TOKEN_DRIVER = r3.body.data.token;
    ok('Login driver_bac@test.com → token OK');
  } else fail('Login driver_bac@test.com', `status=${r3.status}`);

  const r4 = await req('GET', '/auth/me', null, TOKEN_NORTH);
  if (r4.status === 200 && r4.body.data.email === 'bac1@test.com') ok('GET /auth/me → user data OK');
  else fail('GET /auth/me', `status=${r4.status}`);

  const r5 = await req('POST', '/auth/register', {
    email: `test_${Date.now()}@test.com`,
    password: '123456',
    name: 'User HCM',
    phone: '0987654321',
    role: 'customer',
    latitude: 10.7769,
    longitude: 106.7009
  });
  if (r5.status === 201) ok('Register new user (GPS HCM) → Đăng ký thành công (Miền Nam)');
  else fail('Register new user', `status=${r5.status} msg=${JSON.stringify(r5.body)}`);
}

async function clearActiveTrips(token) {
  const res = await req('GET', '/trips/history', null, token);
  if (res.status === 200 && res.body.data) {
    const active = res.body.data.filter(t => t.status === 'pending' || t.status === 'accepted');
    for (const t of active) {
      await req('PATCH', `/trips/${t.id}/cancel`, {}, token);
    }
  }
}

async function testPatchMe() {
  section('AUTH — PATCH /auth/me (patchMe SQL fix)');
  const r = await req('PATCH', '/auth/me', { name: 'Khach Bac Updated' }, TOKEN_NORTH);
  if (r.status === 200 && r.body.data?.name === 'Khach Bac Updated') {
    ok('PATCH /auth/me → 200 OK, name updated correctly');
  } else fail('PATCH /auth/me', `status=${r.status}`);
}

async function testLocationRouting() {
  section('YC1 — LOCATION ROUTING (Định tuyến theo vị trí)');
  await clearActiveTrips(TOKEN_NORTH);
  await clearActiveTrips(TOKEN_SOUTH);

  const r1 = await req('POST', '/trips/book', {
    pickup_lat: 21.0285, pickup_lng: 105.8542,
    pickup_address: 'Hoàn Kiếm', dropoff_address: 'Cầu Giấy', fare: 45000
  }, TOKEN_NORTH);
  if (r1.status === 201 && r1.body.trip?.region === 'NORTH') {
    ok('TC-01: lat=21.03 (HN) → region=NORTH, activeNode=NORTH_PRIMARY');
  } else fail('TC-01: HN → NORTH_PRIMARY', `status=${r1.status}, msg=${JSON.stringify(r1.body)}`);

  const r2 = await req('POST', '/trips/book', {
    pickup_lat: 10.7769, pickup_lng: 106.7009,
    pickup_address: 'Quận 1', dropoff_address: 'Quận 7', fare: 60000
  }, TOKEN_SOUTH);
  if (r2.status === 201 && r2.body.trip?.region === 'SOUTH') {
    ok('TC-02: lat=10.77 (HCM) → region=SOUTH, activeNode=SOUTH_PRIMARY');
  } else fail('TC-02: HCM → SOUTH_PRIMARY', `status=${r2.status}, msg=${JSON.stringify(r2.body)}`);
}

async function testReplication() {
  section('YC2 — REPLICATION (Nhân bản dữ liệu)');
  await clearActiveTrips(TOKEN_NORTH);

  const r = await req('POST', '/trips/book', {
    pickup_lat: 21.0285, pickup_lng: 105.8542,
    pickup_address: 'HN Rep', dropoff_address: 'HN Rep', fare: 99000
  }, TOKEN_NORTH);
  if (r.status !== 201) return fail('Tạo trip để test replication', `status=${r.status}`);
  
  const tripId = r.body.trip.id;
  ok(`Tạo trip ${tripId} trên NORTH_PRIMARY`);

  await new Promise(res => setTimeout(res, 1200));
  const r2 = await req('GET', `/trips/${tripId}?region=NORTH`, null, TOKEN_NORTH);
  if (r2.status === 200) ok(`TC-REP-01: Trip ${tripId} xuất hiện trên NORTH_REPLICA`);
  else fail('TC-REP-01: Replication lag', `status=${r2.status}`);

  const r4 = await req('GET', '/health/north');
  if (r4.body.data?.replication?.NORTH?.connected) ok('TC-REP: pg_stat_replication state=streaming (WAL đang đồng bộ)');
  else fail('TC-REP: Replication state', JSON.stringify(r4.body.data?.replication));
}

async function testNearbyDrivers() {
  section('DRIVERS — Tìm tài xế lân cận');
  const r = await req('GET', '/drivers/nearby?lat=21.0285&lng=105.8542&vehicle_type=bike&radius_km=10');
  if (r.status === 200 && r.body.data) {
    ok(`GET /drivers/nearby (HN) → ${r.body.metadata?.total_found} tài xế`);
    if (r.body.metadata?.region_routed_to === 'NORTH') ok('Nearby drivers routed to NORTH correctly');
  } else fail('GET /drivers/nearby', `status=${r.status}`);
}

async function testWebMonitor() {
  section('WEB MONITOR — /health endpoints');
  const endpoints = ['/health', '/health/north', '/health/south', '/health/history'];
  for (const ep of endpoints) {
    const r = await req('GET', ep);
    if (r.status === 200) ok(`GET ${ep} → 200 OK`);
    else fail(`GET ${ep}`, `status=${r.status}`);
  }
}

async function testSwagger() {
    section('SWAGGER — API Documentation');
    const r = await req('GET', '/api/docs');
    if (r.status === 200 || r.status === 301 || r.status === 302) ok('GET /api/docs → Swagger UI accessible');
    else fail('GET /api/docs', `status=${r.status}`);
  }

async function testFailover() {
  section('YC3 — FAILOVER (Cơ chế chuyển đổi dự phòng)');
  log('  → Tắt south-primary...');
  execSync('docker stop south-primary');
  
  let detected = false;
  for (let i = 0; i < 15; i++) {
    const r = await req('GET', '/health');
    const node = r.body.data.nodes.SOUTH_PRIMARY;
    if (node.status === 'offline') { detected = true; break; }
    await new Promise(res => setTimeout(res, 1000));
  }
  if (detected) ok('TC-FAIL-01: SOUTH_PRIMARY detected offline');
  else fail('TC-FAIL-01: SOUTH_PRIMARY detection timeout');

  const r2 = await req('GET', '/health');
  if (r2.body.data.nodes.SOUTH_REPLICA.status === 'online') ok('TC-FAIL-02: SOUTH_REPLICA vẫn online');
  if (r2.body.data.serviceLevel.SOUTH === 'readonly') ok('TC-FAIL-02: serviceLevel SOUTH = readonly (failover thành công)');

  if (r2.body.data.serviceLevel.NORTH === 'full') ok('TC-FAIL: NORTH không bị ảnh hưởng khi SOUTH down (isolation)');

  await new Promise(res => setTimeout(res, 2000)); // Đợi timeline ghi nhận
  const r3 = await req('GET', '/health/history');
  const timeline = r3.body.data?.timeline?.filter(e => e.node === 'SOUTH_PRIMARY' && e.event === 'OFFLINE') || [];
  if (timeline.length > 0) ok('TC-FAIL: Timeline ghi nhận sự kiện SOUTH_PRIMARY OFFLINE');
  else fail('TC-FAIL: Timeline ghi nhận sự kiện', `timeline empty. Body: ${JSON.stringify(r3.body).slice(0,100)}`);
}

async function testReadOnly() {
  section('YC4 — READ-ONLY MODE (Chế độ chỉ đọc)');

  const r1 = await req('GET', '/trips/history', null, TOKEN_NORTH);
  if (r1.status === 200 && r1.body.readOnly === true) {
    ok(`TC-RO-01: GET /trips/history → 200 OK, readOnly=true`);
  } else fail('TC-RO-01: GET /trips/history khi primary down', `status=${r1.status}`);

  if (r1.body.activeNode === 'SOUTH_REPLICA') ok('TC-RO-01: activeNode = SOUTH_REPLICA (đang đọc từ replica)');

  await clearActiveTrips(TOKEN_NORTH);
  const r2 = await req('POST', '/trips/book', { pickup_lat: 10.77, pickup_lng: 106.7, fare: 50000 }, TOKEN_NORTH);
  if (r2.status === 503) ok('TC-RO-02: POST /trips/book (SOUTH) → 503 Service Unavailable');
  else fail('TC-RO-02: POST /trips/book bị chặn 503', `status=${r2.status}`);

  await clearActiveTrips(TOKEN_NORTH);
  const r3 = await req('POST', '/trips/book', {
    pickup_lat: 21.02, pickup_lng: 105.8, pickup_address: 'HN', dropoff_address: 'HN', fare: 40000
  }, TOKEN_NORTH);
  if (r3.status === 201) ok('TC-RO: NORTH vẫn ghi được khi SOUTH down (cross-region isolation)');
  else fail('TC-RO: NORTH ghi được khi SOUTH down', `status=${r3.status}`);
}

async function testRecovery() {
  section('YC3 — RECOVERY (Phục hồi tự động)');
  log('  → Khởi động lại south-primary...');
  execSync('docker start south-primary');
  await new Promise(res => setTimeout(res, 2000));

  let recovered = false;
  for (let i = 0; i < 15; i++) {
    const r = await req('GET', '/health');
    if (r.body.data.nodes.SOUTH_PRIMARY.status === 'online' && r.body.data.serviceLevel.SOUTH === 'full') { recovered = true; break; }
    await new Promise(res => setTimeout(res, 1000));
  }
  if (recovered) ok('TC-FAIL-03: SOUTH_PRIMARY phục hồi → online & serviceLevel=full');
  else fail('TC-FAIL-03: SOUTH_PRIMARY recovery timeout');

  await clearActiveTrips(TOKEN_SOUTH);
  const r2 = await req('POST', '/trips/book', { pickup_lat: 10.77, pickup_lng: 106.7, fare: 50000 }, TOKEN_SOUTH);
  if (r2.status === 201) ok('TC-RO-04: POST /trips/book sau phục hồi → 201 Created');
}

async function testBothDown() {
  section('TC-FAIL-04 — Cả Primary + Replica đều down');
  log('  → Tắt cả south-primary và south-replica...');
  execSync('docker stop south-primary south-replica');
  await new Promise(res => setTimeout(res, 2000));

  const r = await req('GET', '/health');
  if (r.body.data.serviceLevel.SOUTH === 'unavailable') ok('serviceLevel SOUTH = unavailable khi cả 2 down');

  const r2 = await req('GET', '/trips/history', null, TOKEN_NORTH);
  if (r2.body.warning?.includes('không khả dụng')) ok('Warning message: "Miền Nam không khả dụng..."');

  execSync('docker start south-primary south-replica');
  log('  → Khởi động lại south-primary và south-replica...');
}

async function main() {
  log('\n' + '█'.repeat(60));
  log('  LIVE TEST — Hệ thống Gọi Xe Phân Tán');
  log('  Time: ' + new Date().toLocaleString('vi-VN'));
  log('█'.repeat(60));

  try {
    await testHealth();
    await testAuth();
    await testPatchMe();
    await testLocationRouting();
    await testReplication();
    await testNearbyDrivers();
    await testWebMonitor();
    await testSwagger();
    await testFailover();
    await testReadOnly();
    await testRecovery();
    await testBothDown();
  } catch (e) {
    log(`\n💥 UNEXPECTED ERROR: ${e.message}\n${e.stack}`);
  }

  log('\n' + '='.repeat(60));
  log('  KẾT QUẢ TỔNG HỢP');
  log(`  ✅ PASS: ${PASS} | ❌ FAIL: ${FAIL}`);
  log('='.repeat(60));
}

main();
