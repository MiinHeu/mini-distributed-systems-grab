import { useState, useEffect } from 'react';

export default function AdminDrivers() {
  const [drivers, setDrivers] = useState([]);
  const [region, setRegion] = useState('');

  useEffect(() => {
    const url = region
      ? `http://localhost:3000/admin/drivers?region=${region}`
      : `http://localhost:3000/admin/drivers`;
    fetch(url).then(res => res.json()).then(data => setDrivers(data));
  }, [region]);

  return (
    <div style={{ padding: '24px 32px' }}>
      <h2 style={{ marginBottom: 16, fontSize: 22 }}>🚗 Quản lý Tài xế</h2>
      <select
        value={region}
        onChange={e => setRegion(e.target.value)}
        style={{
          marginBottom: 16, padding: '8px 14px',
          borderRadius: 8, border: '1px solid #444',
          background: '#2a2a3e', color: 'white', fontSize: 14,
        }}
      >
        <option value="">Tất cả vùng</option>
        <option value="NORTH">🔵 Miền Bắc</option>
        <option value="SOUTH">🔴 Miền Nam</option>
      </select>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
        <thead>
          <tr style={{ background: '#2a2a3e', color: '#aaa', textAlign: 'left' }}>
            <th style={th}>ID</th>
            <th style={th}>Tên</th>
            <th style={th}>Biển số</th>
            <th style={th}>Vùng</th>
            <th style={th}>Trạng thái</th>
          </tr>
        </thead>
        <tbody>
          {drivers.map((d: any, i: number) => (
            <tr key={d.id} style={{ background: i % 2 === 0 ? '#1e1e2e' : '#23233a' }}>
              <td style={td}>{d.id}</td>
              <td style={td}>{d.name}</td>
              <td style={td}>{d.vehicle_plate}</td>
              <td style={td}>
                <span style={{
                  background: d.region === 'NORTH' ? '#0984e3' : '#d63031',
                  color: 'white', padding: '2px 10px',
                  borderRadius: 12, fontSize: 12,
                }}>
                  {d.region === 'NORTH' ? '🔵 Miền Bắc' : '🔴 Miền Nam'}
                </span>
              </td>
              <td style={td}>
                {d.is_available
                  ? <span style={{ color: '#00b894', fontWeight: 600 }}>✅ Sẵn sàng</span>
                  : <span style={{ color: '#e74c3c', fontWeight: 600 }}>❌ Bận</span>
                }
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const th: any = { padding: '10px 14px', fontWeight: 600, borderBottom: '1px solid #333' };
const td: any = { padding: '10px 14px', borderBottom: '1px solid #2a2a3e' };