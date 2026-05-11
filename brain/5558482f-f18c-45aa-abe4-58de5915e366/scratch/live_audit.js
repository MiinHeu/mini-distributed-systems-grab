/**
 * LIVE AUDIT SCRIPT (Native Fetch version) - Mini Distributed Systems Grab
 */

const API_BASE = 'http://localhost:3000';
let TEST_TOKEN = '';

async function runAudit() {
  console.log('🚀 BẮT ĐẦU KIỂM TRA HỆ THỐNG TOÀN DIỆN...');
  
  try {
    // 1. KIỂM TRA KẾT NỐI VÀ LOCALIZATION
    console.log('\n--- [1] Kiểm tra Kết nối & Việt hóa ---');
    try {
      const res = await fetch(`${API_BASE}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'wrong@test.com', password: '123' })
      });
      const data = await res.json();
      console.log(`Thông báo lỗi login sai: "${data.message}"`);
      if (data.message === 'invalid credentials') {
        console.warn('❌ CẢNH BÁO: Lỗi login chưa được Việt hóa');
      } else {
        console.log('✅ Việt hóa login: OK');
      }
    } catch (e) {
      console.error('❌ Không thể kết nối Backend. Hãy đảm bảo "npm run dev" đang chạy ở folder backend.');
      return;
    }

    // 2. KIỂM TRA REGISTRATION
    console.log('\n--- [2] Kiểm tra Đăng ký User mới ---');
    const testEmail = `test_${Date.now()}@audit.com`;
    const regRes = await fetch(`${API_BASE}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Audit User',
        phone: '09' + Math.floor(Math.random()*100000000),
        email: testEmail,
        password: 'password123',
        role: 'customer'
      })
    });
    const regData = await regRes.json();
    if (regRes.ok) {
      console.log('✅ Đăng ký: THÀNH CÔNG');
    } else {
      console.error('❌ Đăng ký: THẤT BẠI', regData);
    }

    // 3. KIỂM TRA LOGIN & JWT
    console.log('\n--- [3] Kiểm tra Đăng nhập & JWT ---');
    const loginRes = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: testEmail, password: 'password123' })
    });
    const loginData = await loginRes.json();
    if (loginRes.ok) {
      TEST_TOKEN = loginData.token;
      console.log('✅ Đăng nhập: THÀNH CÔNG');
    } else {
      console.error('❌ Đăng nhập: THẤT BẠI', loginData);
      return;
    }

    // 4. KIỂM TRA ĐỊNH TUYẾN DỮ LIỆU
    console.log('\n--- [4] Kiểm tra Định tuyến Dữ liệu (Booking) ---');
    const bookRes = await fetch(`${API_BASE}/trips/book`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${TEST_TOKEN}`
      },
      body: JSON.stringify({
        pickup: 'Hà Nội',
        pickup_lat: 21.0,
        pickup_lng: 105.8,
        dropoff: 'Hải Phòng',
        dropoff_lat: 20.8,
        dropoff_lng: 106.6,
        fare: 500000
      })
    });
    const bookData = await bookRes.json();
    if (bookRes.ok) {
      console.log('✅ Đặt xe Miền Bắc: THÀNH CÔNG');
      console.log(`Vùng xử lý: ${bookData.region}, Node: ${bookData.activeNode}`);
    } else {
      console.error('❌ Đặt xe: THẤT BẠI', bookData);
    }

    // 5. KIỂM TRA FAILOVER (REPORTS)
    console.log('\n--- [5] Kiểm tra Khả năng chịu lỗi (Reports) ---');
    const reportRes = await fetch(`${API_BASE}/reports/revenue`, {
      headers: { 'Authorization': `Bearer ${TEST_TOKEN}` }
    });
    const reportData = await reportRes.json();
    if (reportRes.ok) {
      console.log('✅ Lấy báo cáo doanh thu: THÀNH CÔNG');
      if (reportData.warning) console.warn(`⚠️ CẢNH BÁO: ${reportData.warning}`);
    } else {
      console.error('❌ Lấy báo cáo: THẤT BẠI', reportData);
    }

    console.log('\n--- TỔNG KẾT ---');
    console.log('Hệ thống đã được kiểm tra toàn diện.');

  } catch (e) {
    console.error('❌ LỖI HỆ THỐNG:', e.message);
  }
}

runAudit();
