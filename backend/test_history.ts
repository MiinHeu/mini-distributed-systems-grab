import axios from 'axios';

async function test() {
  try {
    console.log('--- Đăng nhập User 5 (dai1@gmail.com) ---');
    const login = await axios.post('http://localhost:3000/auth/login', {
      email: 'dai1@gmail.com',
      password: '123456'
    });
    console.log('Login Response:', JSON.stringify(login.data, null, 2));
    const token = login.data.data.token;
    if (!token) throw new Error('Token is missing!');
    console.log('Login OK. Token:', token.substring(0, 20) + '...');

    console.log('--- Lấy lịch sử ---');
    const history = await axios.get('http://localhost:3000/trips/history', {
      headers: { Authorization: `Bearer ${token}` }
    });
    console.log('History Response Data:', JSON.stringify(history.data.data, null, 2));
  } catch (e) {
    console.error('Lỗi:', e.response?.data || e.message);
  }
}

test();
