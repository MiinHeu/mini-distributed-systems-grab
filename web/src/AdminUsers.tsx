import { useState, useEffect, useCallback } from 'react'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? ''
const TOKEN_KEY = 'grab_auth_token'

type User = { id: number; name: string; email: string; role: string; is_suspended?: boolean; created_at: string; }

const ROLE_BADGE: Record<string, string> = { admin: 'badge-blue', driver: 'badge-green', customer: 'badge-gray' }
const ROLE_LABEL: Record<string, string> = { admin: 'Quản trị', driver: 'Tài xế', customer: 'Khách hàng' }

export default function AdminUsers() {
  const [users, setUsers] = useState<User[]>([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(false)
  const token = localStorage.getItem(TOKEN_KEY) ?? ''

  const fetchUsers = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`${API_BASE_URL}/admin/users`, { headers: { Authorization: `Bearer ${token}` } })
      const json = await res.json()
      setUsers(json.data ?? json ?? [])
    } catch {
    } finally {
      setLoading(false)
    }
  }, [token])

  useEffect(() => { fetchUsers() }, [fetchUsers])

  const handleSuspend = async (id: number) => {
    await fetch(`${API_BASE_URL}/admin/users/${id}/suspend`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${token}` }
    })
    setUsers(prev => prev.map(u => u.id === id ? { ...u, is_suspended: true } : u))
  }

  const handleUnsuspend = async (id: number) => {
    await fetch(`${API_BASE_URL}/admin/users/${id}/unsuspend`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${token}` }
    })
    setUsers(prev => prev.map(u => u.id === id ? { ...u, is_suspended: false } : u))
  }

  const handleDelete = async (id: number) => {
    if (!confirm('Bạn chắc chắn muốn xóa người dùng này?')) return
    await fetch(`${API_BASE_URL}/admin/users/${id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` }
    })
    setUsers(prev => prev.filter(u => u.id !== id))
  }

  const filtered = users.filter(u =>
    u.name?.toLowerCase().includes(search.toLowerCase()) ||
    u.email?.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <h2 style={{ fontSize: 20, fontWeight: 800, color: 'white' }}>Quản lý người dùng</h2>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <input className="search-input" placeholder="Tìm kiếm theo tên hoặc email..." value={search} onChange={e => setSearch(e.target.value)} />
          <button className="btn-success" onClick={fetchUsers}>Tải lại</button>
        </div>
      </div>
      {loading ? <p style={{ color: '#8892B0' }}>Đang tải...</p> : (
        <table className="data-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Tên</th>
              <th>Email</th>
              <th>Vai trò</th>
              <th>Trạng thái</th>
              <th>Ngày tạo</th>
              <th>Hành động</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr><td colSpan={7} style={{ textAlign: 'center', color: '#5A6380', padding: 32 }}>Không tìm thấy người dùng</td></tr>
            ) : filtered.map(u => (
              <tr key={u.id}>
                <td style={{ color: '#5A6380' }}>#{u.id}</td>
                <td style={{ fontWeight: 600 }}>{u.name}</td>
                <td style={{ color: '#8892B0' }}>{u.email}</td>
                <td><span className={`badge ${ROLE_BADGE[u.role] ?? 'badge-gray'}`}>{ROLE_LABEL[u.role] ?? u.role}</span></td>
                <td>
                  {u.is_suspended ? (
                    <span className="badge badge-red">Đã khóa</span>
                  ) : (
                    <span className="badge badge-green">Hoạt động</span>
                  )}
                </td>
                <td style={{ color: '#5A6380', fontSize: 12 }}>{new Date(u.created_at).toLocaleDateString('vi-VN')}</td>
                <td style={{ display: 'flex', gap: 6 }}>
                  {u.is_suspended ? (
                    <button className="btn-success" onClick={() => handleUnsuspend(u.id)}>Mở khóa</button>
                  ) : (
                    <button className="btn-warning" onClick={() => handleSuspend(u.id)}>Khóa</button>
                  )}
                  <button className="btn-danger" onClick={() => handleDelete(u.id)}>Xóa</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}
