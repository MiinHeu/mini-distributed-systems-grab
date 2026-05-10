import axios from 'axios';

async function test() {
  try {
    console.log('--- Test Estimate API ---');
    const res = await axios.post('http://localhost:3000/trips/estimate', {
      pickup_lat: 10.762622,
      pickup_lng: 106.660172,
      dropoff_lat: 10.773598,
      dropoff_lng: 106.704866
    });
    console.log('Response:', JSON.stringify(res.data, null, 2));
  } catch (e) {
    console.error('Lỗi:', e.response?.data || e.message);
  }
}

test();
