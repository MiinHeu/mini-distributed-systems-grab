const axios = require('axios');
const assert = require('assert');

const API_URL = 'http://localhost:3000';

async function run() {
  console.log('=== STARTING LIVE INTEGRATION TEST ===\n');
  
  let tokenNorth = '';
  let tokenSouth = '';

  try {
    // 1. Đăng ký & Đăng nhập User Miền Bắc
    console.log('1. Đăng ký khách hàng Hà Nội...');
    let phoneHN = `090${Date.now().toString().slice(-7)}`;
    let pass = 'password123';
    let emailHN = `hanoiuser${Math.floor(Math.random()*10000)}@gmail.com`;
    await axios.post(`${API_URL}/auth/register`, {
      name: 'User HN', email: emailHN, phone: phoneHN, password: pass, role: 'customer'
    });
    let res = await axios.post(`${API_URL}/auth/login`, { email: emailHN, password: pass });
    tokenNorth = res.data.data.token;
    console.log('✅ Token HN:', tokenNorth.substring(0, 20) + '...');

    // 2. Đăng ký & Đăng nhập User Miền Nam
    console.log('\n2. Đăng ký khách hàng TP.HCM...');
    let phoneHCM = `091${Date.now().toString().slice(-7)}`;
    let emailHCM = `hcmuser${Math.floor(Math.random()*10000)}@gmail.com`;
    await axios.post(`${API_URL}/auth/register`, {
      name: 'User HCM', email: emailHCM, phone: phoneHCM, password: pass, role: 'customer'
    });
    res = await axios.post(`${API_URL}/auth/login`, { email: emailHCM, password: pass });
    tokenSouth = res.data.data.token;
    console.log('✅ Token HCM:', tokenSouth.substring(0, 20) + '...');

    // 3. Đặt xe ở Hà Nội (Vĩ độ 21.03)
    console.log('\n3. Đặt xe từ Hà Nội (lat: 21.03)...');
    res = await axios.post(`${API_URL}/trips/book`, {
      pickup_address: 'Hồ Gươm, Hà Nội',
      pickup_lat: 21.03, pickup_lng: 105.85,
      dropoff_address: 'Lăng Bác, Hà Nội',
      dropoff_lat: 21.03, dropoff_lng: 105.83,
      vehicle_type: 'car'
    }, { headers: { Authorization: `Bearer ${tokenNorth}` } });
    console.log('✅ Booking HN Result:', res.data.trip?.status || res.data.message, 'Region:', res.data.region);

    // 4. Đặt xe ở TP.HCM (Vĩ độ 10.77)
    console.log('\n4. Đặt xe từ TP.HCM (lat: 10.77)...');
    res = await axios.post(`${API_URL}/trips/book`, {
      pickup_address: 'Chợ Bến Thành, TP.HCM',
      pickup_lat: 10.77, pickup_lng: 106.69,
      dropoff_address: 'Sân bay Tân Sơn Nhất',
      dropoff_lat: 10.81, dropoff_lng: 106.66,
      vehicle_type: 'car'
    }, { headers: { Authorization: `Bearer ${tokenSouth}` } });
    console.log('✅ Booking HCM Result:', res.data.trip?.status || res.data.message, 'Region:', res.data.region);

    // 5. Kiểm tra Lịch sử chuyến đi
    console.log('\n5. Kiểm tra lịch sử chuyến đi của User HN (đọc từ NORTH)...');
    res = await axios.get(`${API_URL}/trips/history`, { headers: { Authorization: `Bearer ${tokenNorth}` } });
    console.log(`✅ Lịch sử HN: ${res.data.length !== undefined ? res.data.length : res.data.trips?.length || 0} chuyến`);

    console.log('\n5. Kiểm tra lịch sử chuyến đi của User HCM (đọc từ SOUTH)...');
    res = await axios.get(`${API_URL}/trips/history`, { headers: { Authorization: `Bearer ${tokenSouth}` } });
    console.log(`✅ Lịch sử HCM: ${res.data.length !== undefined ? res.data.length : res.data.trips?.length || 0} chuyến`);

    console.log('\n=== LIVE TEST GIAI ĐOẠN 2 SUCCESS ===\n');

  } catch (error) {
    console.error('❌ ERROR:', error.response?.data || error.message);
    process.exit(1);
  }
}

run();
