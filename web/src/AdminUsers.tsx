import { useState, useEffect } from 'react';

const roleColor: any = {
  admin: '#6c63ff',
  driver: '#00b894',
  customer: '#0984e3',
};

export default function AdminUsers() {
  const [users, setUsers] = useState<any[]>([]);
  const [search, setSearch] = useState('');

  const fetchUsers = () => {
    fetch('/admin/users')
      .then(res => res.json())
      .then(data => setUsers(data));
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const filteredUsers = users.filter((u) =>
    u.name.toLowerCase().includes(search.toLowerCase()) ||
    u.email.toLowerCase().includes(search.toLowerCase())
  );

  const handleSuspend = (id: string) => {
    fetch(`/admin/users/${id}/suspend`, { method: 'PATCH' })
      .then(() => setUsers(prev => prev.map(u =>
        u.id === id ? { ...u, is_suspended: true } : u
      )));
  };

  const handleUnsuspend = (id: string) => {
    fetch(`/admin/users/${id}/unsuspend`, { method: 'PATCH' })
      .then(() => setUsers(prev => prev.map(u =>
        u.id === id ? { ...u, is_suspended: false } : u
      )));
  };

  const handleDelete = (id: string) => {
    if (!confirm('Bạn chắc chắn muốn xóa user này?')) return;
    fetch(`/admin/users/${id}`, { method: 'DELETE' })
      .then(() => setUsers(prev => prev.filter(u => u.id !== id)));
  };

  return (
    <div style={{ padding: '24px 32px' }}>
      <h2 style={{ marginBottom: 16, fontSize: 22 }}>👥 Quản lý User</h2>
      <input
        placeholder="🔍 Tìm kiếm theo tên hoặc email..."
        value={search}
        onChange={e => setSearch(e.target.value)}
        style={{
          marginBottom: 16, padding: '8px 14px', width: 320,
          borderRadius: 8, border: '1px solid #444',
          background: '#2a2a3e', color: 'white', fontSize: 14,
        }}
      />
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
        <thead>
          <tr style={{ background: '#2a2a3e', color: '#aaa', textAlign: 'left' }}>
            <th style={th}>ID</th>
            <th style={th}>Tên</th>
            <th style={th}>Email</th>
            <th style={th}>Role</th>
            <th style={th}>Trạng thái</th>
            <th style={th}>Hành động</th>
          </tr>
        </thead>
        <tbody>
          {filteredUsers.length === 0 ? (
            <tr><td colSpan={6} style={{ textAlign: 'center', padding: 20, color: '#aaa' }}>Không tìm thấy user</td></tr>
          ) : (
            filteredUsers.map((u, i) => (
              <tr key={u.id} style={{ background: i % 2 === 0 ? '#1e1e2e' : '#23233a' }}>
                <td style={td}>{u.id}</td>
                <td style={td}>{u.name}</td>
                <td style={td}>{u.email}</td>
                <td style={td}>
                  <span style={{ background: roleColor[u.role] || '#555', color: 'white', padding: '2px 10px', borderRadius: 12, fontSize: 12 }}>
                    {u.role}
                  </span>
                </td>
                <td style={td}>
                  {u.is_suspended
                    ? <span style={{ color: '#e74c3c' }}>🔒 Đã khóa</span>
                    : <span style={{ color: '#00b894' }}>✅ Hoạt động</span>
                  }
                </td>
                <td style={td}>
                  {u.is_suspended ? (
                    <button onClick={() => handleUnsuspend(u.id)} style={btnGreen}>🔓 Mở khóa</button>
                  ) : (
                    <button onClick={() => handleSuspend(u.id)} style={btnOrange}>🔒 Khóa</button>
                  )}
                  <button onClick={() => handleDelete(u.id)} style={btnRed}>🗑 Xóa</button>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

const th: any = { padding: '10px 14px', fontWeight: 600, borderBottom: '1px solid #333' };
const td: any = { padding: '10px 14px', borderBottom: '1px solid #2a2a3e' };
const btnOrange: any = { marginRight: 8, background: '#e67e22', color: 'white', border: 'none', padding: '5px 12px', borderRadius: 6, cursor: 'pointer', fontSize: 13 };
const btnGreen: any = { marginRight: 8, background: '#00b894', color: 'white', border: 'none', padding: '5px 12px', borderRadius: 6, cursor: 'pointer', fontSize: 13 };
const btnRed: any = { background: '#e74c3c', color: 'white', border: 'none', padding: '5px 12px', borderRadius: 6, cursor: 'pointer', fontSize: 13 };