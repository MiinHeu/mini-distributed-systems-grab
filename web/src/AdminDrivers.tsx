import { useState, useEffect, useCallback } from 'react'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? ''
const TOKEN_KEY = 'grab_auth_token'

type Driver = { id: string; name?: string; vehicle_plate: string; vehicle_type: string; region: string; is_available: boolean; rating: number; total_trips: number; }

export default function AdminDrivers() {
  const [drivers, setDrivers] = useState<Driver[]>([])
  const [region, setRegion] = useState('')
  const [loading, setLoading] = useState(false)
  const token = localStorage.getItem(TOKEN_KEY) ?? ''

  const fetchDrivers = useCallback(async () => {
    setLoading(true)
    try {
      const url = region ? `${API_BASE_URL}/admin/drivers?region=${region}` : `${API_BASE_URL}/admin/drivers`
      const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } })
      const json = await res.json()
      setDrivers(json.data ?? json ?? [])
    } catch {
    } finally {
      setLoading(false)
    }
  }, [region, token])

  useEffect(() => { fetchDrivers() }, [fetchDrivers])

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <h2 style={{ fontSize: 20, fontWeight: 800, color: 'white' }}>Quản lý tài xế</h2>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <select className="filter-select" value={region} onChange={e => setRegion(e.target.value)}>
            <option value="">Tất cả vùng</option>
            <option value="NORTH">Miền Bắc</option>
            <option value="SOUTH">Miền Nam</option>
          </select>
          <button className="btn-success" onClick={fetchDrivers}>Tải lại</button>
        </div>
      </div>
      {loading ? <p style={{ color: '#8892B0' }}>Đang tải...</p> : (
        <table className="data-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Biển số</th>
              <th>Loại xe</th>
              <th>Vùng</th>
              <th>Trạng thái</th>
              <th>Đánh giá</th>
              <th>Số chuyến</th>
            </tr>
          </thead>
          <tbody>
            {drivers.length === 0 ? (
              <tr><td colSpan={7} style={{ textAlign: 'center', color: '#5A6380', padding: 32 }}>Không có tài xế nào</td></tr>
            ) : drivers.map((d, i) => (
              <tr key={d.id ?? i}>
                <td style={{ color: '#5A6380', fontSize: 12, fontFamily: 'monospace' }}>{String(d.id).slice(0, 8)}...</td>
                <td style={{ fontWeight: 700, fontSize: 15 }}>{d.vehicle_plate}</td>
                <td><span className="badge badge-gray">{d.vehicle_type?.toUpperCase()}</span></td>
                <td>
                  <span className={`badge ${d.region === 'NORTH' ? 'badge-blue' : 'badge-red'}`}>
                    {d.region === 'NORTH' ? 'Miền Bắc' : 'Miền Nam'}
                  </span>
                </td>
                <td>
                  {d.is_available ? (
                    <span className="badge badge-green">Sẵn sàng</span>
                  ) : (
                    <span className="badge badge-gray">Đang nghỉ</span>
                  )}
                </td>
                <td style={{ color: '#FCD34D', fontWeight: 700 }}>{Number(d.rating ?? 0).toFixed(1)} sao</td>
                <td style={{ fontWeight: 600 }}>{d.total_trips ?? 0}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}
