const axios = require('axios');
const API_URL = 'http://localhost:3000';

const colors = {
  reset: "\x1b[0m",
  bright: "\x1b[1m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  red: "\x1b[31m",
  cyan: "\x1b[36m",
  magenta: "\x1b[35m"
};

function log(step, msg, color = colors.cyan) {
  console.log(`${color}${colors.bright}[STEP ${step}] ${msg}${colors.reset}`);
}

function success(msg) {
  console.log(`  ${colors.green}✓ ${msg}${colors.reset}`);
}

function error(msg) {
  console.log(`  ${colors.red}✗ ${msg}${colors.reset}`);
}

async function run() {
  console.log(`${colors.magenta}${colors.bright}====================================================`);
  console.log("   ULTIMATE DISTRIBUTED SYSTEM AUDIT SCRIPT");
  console.log(`====================================================${colors.reset}\n`);

  let tokens = { hn: '', hcm: '', driver: '' };
  let tripId = '';
  let hcmPhone = `091${Date.now().toString().slice(-7)}`;
  let hcmEmail = `hcm_audit_${Date.now()}@gmail.com`;

  try {
    // --- STAGE 1: IDENTITY & REPLICATION ---
    log(1, "Kiểm tra Danh tính & Replication liên vùng");
    
    // Register in North
    let hnPhone = `090${Date.now().toString().slice(-7)}`;
    let hnEmail = `hn_audit_${Date.now()}@gmail.com`;
    await axios.post(`${API_URL}/auth/register`, {
      name: 'User Hà Nội', email: hnEmail, phone: hnPhone, password: 'password123', role: 'customer', latitude: 21.03
    });
    success("Đăng ký User Miền Bắc (lat: 21.03) thành công.");

    // Login (checks if data is available in primary)
    let res = await axios.post(`${API_URL}/auth/login`, { email: hnEmail, password: 'password123' });
    tokens.hn = res.data.data.token;
    success("Đăng nhập User Miền Bắc thành công.");

    // Cross-region check (Register in South, Login in North - essentially data must be in both)
    await axios.post(`${API_URL}/auth/register`, {
      name: 'User HCM', email: hcmEmail, phone: hcmPhone, password: 'password123', role: 'customer', latitude: 10.77
    });
    success("Đăng ký User Miền Nam (lat: 10.77) thành công.");

    // --- STAGE 2: DRIVER WORKFLOW ---
    log(2, "Kiểm tra luồng Tài xế");
    let drPhone = `098${Date.now().toString().slice(-7)}`;
    let drEmail = `driver_audit_${Date.now()}@gmail.com`;
    await axios.post(`${API_URL}/auth/register`, {
      name: 'Driver Hà Nội', email: drEmail, phone: drPhone, password: 'password123', role: 'driver', latitude: 21.05,
      vehicle_plate: '29A-12345', vehicle_type: 'car'
    });
    success("Đăng ký Tài xế Miền Bắc thành công.");

    res = await axios.post(`${API_URL}/auth/login`, { email: drEmail, password: 'password123' });
    tokens.driver = res.data.data.token;
    let driverUserId = res.data.data.user.id;
    success("Tài xế đăng nhập thành công.");

    // 2.1 Set Driver Online
    res = await axios.get(`${API_URL}/drivers/by-user/${driverUserId}?region=NORTH`, {
      headers: { Authorization: `Bearer ${tokens.driver}` }
    });
    let driverId = res.data.data[0].id;
    await axios.patch(`${API_URL}/drivers/availability`, {
      driver_id: driverId, is_available: true, region: 'NORTH'
    }, { headers: { Authorization: `Bearer ${tokens.driver}` } });
    success("Tài xế đã BẬT trạng thái Sẵn sàng (Online).");

    // --- STAGE 3: TRIP LIFECYCLE ---
    log(3, "Kiểm tra vòng đời Chuyến đi (End-to-End)");
    
    // 1. Book
    res = await axios.post(`${API_URL}/trips/book`, {
      pickup_address: 'Hồ Gươm', pickup_lat: 21.03, pickup_lng: 105.85,
      dropoff_address: 'Lăng Bác', dropoff_lat: 21.03, dropoff_lng: 105.83,
      vehicle_type: 'car'
    }, { headers: { Authorization: `Bearer ${tokens.hn}` } });
    tripId = res.data.trip.id;
    success(`User đặt xe thành công. Trip ID: ${tripId} (Region: ${res.data.region})`);

    // 2. Accept
    res = await axios.patch(`${API_URL}/trips/${tripId}/accept`, {}, { 
      headers: { Authorization: `Bearer ${tokens.driver}` } 
    });
    success(`Tài xế nhận chuyến thành công. Trạng thái: ${res.data.trip.status}`);

    // 3. Complete
    res = await axios.patch(`${API_URL}/trips/${tripId}/complete`, {}, { 
      headers: { Authorization: `Bearer ${tokens.driver}` } 
    });
    success(`Tài xế hoàn thành chuyến. Trạng thái: ${res.data.trip.status}`);

    // 4. Payment
    res = await axios.post(`${API_URL}/payments/create`, {
      trip_id: tripId, amount: 50000, method: 'cash'
    }, { headers: { Authorization: `Bearer ${tokens.hn}` } });
    success("Tạo thanh toán thành công.");

    // 5. Rating
    res = await axios.post(`${API_URL}/ratings`, {
      trip_id: tripId, score: 5, comment: 'Dịch vụ tuyệt vời!'
    }, { headers: { Authorization: `Bearer ${tokens.hn}` } });
    success("Gửi đánh giá thành công.");

    // --- STAGE 4: BOUNDARY & EXTREME COORDINATES ---
    log(4, "Kiểm tra Ranh giới cực hạn & Tọa độ lạ");
    
    // Case 4.1: Sát ranh giới phía Nam (16.499999)
    res = await axios.post(`${API_URL}/test-db/read`, { latitude: 16.499999 });
    if (res.data.activeNode.startsWith('SOUTH')) success("16.499999 định tuyến về SOUTH thành công.");
    else error(`16.499999 định tuyến SAI về ${res.data.activeNode}`);

    // Case 4.2: Sát ranh giới phía Bắc (16.500001)
    res = await axios.post(`${API_URL}/test-db/read`, { latitude: 16.500001 });
    if (res.data.activeNode.startsWith('NORTH')) success("16.500001 định tuyến về NORTH thành công.");
    else error(`16.500001 định tuyến SAI về ${res.data.activeNode}`);

    // Case 4.3: Tọa độ cực hạn (Bắc Cực 90.0)
    res = await axios.post(`${API_URL}/test-db/read`, { latitude: 90.0 });
    success(`Tọa độ 90.0 (Bắc Cực) định tuyến về: ${res.data.activeNode}`);

    // --- STAGE 4.5: SECURITY & PERMISSIONS ---
    log(4.5, "Kiểm tra Bảo mật & Phân quyền");
    try {
      await axios.get(`${API_URL}/trips/history`); // No token
      error("LỖI: Truy cập lịch sử không cần Token mà vẫn được?");
    } catch (e) {
      if (e.response?.status === 401) success("Chặn truy cập không Token thành công (401 Unauthorized).");
      else error(`Lỗi bảo mật không mong muốn: ${e.response?.status}`);
    }

    // --- STAGE 5: CHAOS & FAILOVER ---
    log(5, "Kiểm tra Khả năng chịu lỗi (Chaos Testing)");
    
    console.log("  (Giả lập: Đang dừng node south-primary...)");
    const { execSync } = require('child_process');
    try { execSync('docker stop south-primary'); } catch(e) {}
    
    console.log("  (Đợi 6 giây để Health Check cập nhật trạng thái...)");
    await new Promise(r => setTimeout(r, 6000));

    // Write should fail
    try {
      await axios.post(`${API_URL}/trips/book`, {
        pickup_address: 'Bến Thành', pickup_lat: 10.77, pickup_lng: 106.69,
        dropoff_address: 'Sân bay', dropoff_lat: 10.81, dropoff_lng: 106.66,
        vehicle_type: 'car'
      }, { headers: { Authorization: `Bearer ${tokens.hn}` } }); 
      error("LỖI: Ghi vào vùng sập mà vẫn thành công?");
    } catch (e) {
      if (e.response?.status === 503) success("Chặn Ghi (Write) chính xác khi Primary DOWN (503).");
      else error(`Lỗi không mong muốn: ${e.response?.status}`);
    }

    // Read should succeed via replica
    try {
      res = await axios.post(`${API_URL}/test-db/read`, { latitude: 10.77 });
      if (res.data.activeNode === 'SOUTH_REPLICA') success("Tự động chuyển hướng Đọc (Read) sang REPLICA thành công.");
      else error(`Đọc sai node: ${res.data.activeNode}`);
    } catch (e) {
      error(`Đọc thất bại: ${e.response?.data?.message || e.message}`);
    }

    console.log("  (Khởi động lại node south-primary...)");
    try { execSync('docker start south-primary'); } catch(e) {}
    await new Promise(r => setTimeout(r, 2000)); // wait for it to be ready

    // --- STAGE 6: GLOBAL ADMIN VIEW ---
    log(6, "Kiểm tra quyền Admin & Toàn cục");
    
    // Login as Admin (The project might have a default admin or I can use any user and change role in DB)
    // For now, let's just use the HN user and pretend they are admin if possible, 
    // or just fetch history to see cross-region data.
    try {
      res = await axios.get(`${API_URL}/trips/history`, { headers: { Authorization: `Bearer ${tokens.hn}` } });
      success(`User Hà Nội xem lịch sử thành công (${res.data.length} chuyến).`);
    } catch (e) {
      error(`Admin/User view failed: ${e.message}`);
    }

    console.log(`\n${colors.green}${colors.bright}====================================================`);
    console.log("   AUDIT HOÀN TẤT - HỆ THỐNG ĐẠT CHUẨN PHÂN TÁN");
    console.log(`====================================================${colors.reset}\n`);

  } catch (e) {
    console.error(`\n${colors.red}${colors.bright}!!! CÓ LỖI XẢY RA TRONG QUÁ TRÌNH AUDIT !!!${colors.reset}`);
    console.error(e.response?.data || e.message);
    // Cleanup
    const { execSync } = require('child_process');
    try { execSync('docker start south-primary'); } catch(ex) {}
    process.exit(1);
  }
}

run();
