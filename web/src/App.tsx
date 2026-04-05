import { useState } from 'react';
import AdminUsers from './AdminUsers';
import AdminDrivers from './AdminDrivers';

function App() {
  const [tab, setTab] = useState<'users' | 'drivers'>('users');

  return (
    <div style={{ minHeight: '100vh', background: '#13131f', color: 'white', fontFamily: 'sans-serif' }}>
      <nav style={{ background: '#1a1a2e', padding: '0 32px', display: 'flex', alignItems: 'center', gap: 8, borderBottom: '1px solid #2a2a3e' }}>
        <span style={{ fontWeight: 'bold', fontSize: 18, marginRight: 32, padding: '16px 0' }}>🚖 Mini Grab Admin</span>
        <button onClick={() => setTab('users')} style={{ ...navBtn, borderBottom: tab === 'users' ? '2px solid #6c63ff' : '2px solid transparent', color: tab === 'users' ? '#6c63ff' : '#aaa' }}>
          👥 Quản lý User
        </button>
        <button onClick={() => setTab('drivers')} style={{ ...navBtn, borderBottom: tab === 'drivers' ? '2px solid #00b894' : '2px solid transparent', color: tab === 'drivers' ? '#00b894' : '#aaa' }}>
          🚗 Quản lý Tài xế
        </button>
      </nav>

      {/* Dùng display thay vì unmount để giữ state khi đổi tab */}
      <div style={{ display: tab === 'users' ? 'block' : 'none' }}>
        <AdminUsers />
      </div>
      <div style={{ display: tab === 'drivers' ? 'block' : 'none' }}>
        <AdminDrivers />
      </div>
    </div>
  );
}

const navBtn: any = { background: 'none', border: 'none', color: '#aaa', padding: '16px 16px', cursor: 'pointer', fontSize: 14, fontWeight: 600 };

export default App;