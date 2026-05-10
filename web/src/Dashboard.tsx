import { useEffect, useState, useCallback } from 'react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, LineChart, Line, ResponsiveContainer } from 'recharts'

const API = import.meta.env.VITE_API_BASE_URL ?? ''

type RevenueRow = { region: string; total_trips: number; total_revenue: string; avg_fare: string }
type TripRow = { date: string; region: string; total: number }
type DriverRow = { driver_id: number; total_trips: number; total_earned: string }

export default function Dashboard() {
  const [revenue, setRevenue] = useState<RevenueRow[]>([])
  const [trips, setTrips] = useState<TripRow[]>([])
  const [drivers, setDrivers] = useState<DriverRow[]>([])
  const [warning, setWarning] = useState<string | null>(null)
  const [readOnly, setReadOnly] = useState(false)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [r1, r2, r3] = await Promise.all([
        fetch(`${API}/reports/revenue`).then(r => r.json()),
        fetch(`${API}/reports/trips`).then(r => r.json()),
        fetch(`${API}/reports/drivers/top`).then(r => r.json()),
      ])
      setRevenue(r1.data ?? [])
      setTrips(r2.data ?? [])
      setDrivers(r3.data ?? [])
      setWarning(r1.warning)
      setReadOnly(r1.readOnly)
    } catch {
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
    const id = setInterval(load, 30000)
    return () => clearInterval(id)
  }, [load])

  const totalTrips = revenue.reduce((s, r) => s + r.total_trips, 0)
  const totalRevenue = revenue.reduce((s, r) => s + Number(r.total_revenue), 0)
  const avgFare = totalTrips > 0 ? totalRevenue / totalTrips : 0

  const lineData = Object.values(
    trips.reduce((acc: Record<string, { date: string; NORTH: number; SOUTH: number }>, row) => {
      const d = row.date.slice(0, 10)
      if (!acc[d]) acc[d] = { date: d, NORTH: 0, SOUTH: 0 }
      acc[d][row.region as 'NORTH' | 'SOUTH'] += row.total
      return acc
    }, {})
  ).sort((a, b) => a.date.localeCompare(b.date))

  if (loading) return <div style={{ textAlign: 'center', padding: 60, color: '#6B7280' }}>Đang tải dữ liệu...</div>

  return (
    <div className="dashboard-wrap">
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 24, fontWeight: 900, color: '#111827', marginBottom: 4 }}>Bảng Điều Khiển</h1>
        <p style={{ fontSize: 14, color: '#6B7280' }}>Tổng quan hoạt động Mini Grab</p>
      </div>

      {readOnly && warning && (
        <div className="warning-banner">
          <span className="warning-banner-icon">⚠️</span>
          <span className="warning-banner-text">{warning}</span>
        </div>
      )}

      <div className="stat-cards">
        {[
          { label: 'Tổng chuyến xe', value: totalTrips.toLocaleString(), sub: 'Tất cả các vùng', color: '#00AF50' },
          { label: 'Tổng doanh thu', value: totalRevenue.toLocaleString('vi-VN') + ' đ', sub: 'Chuyến hoàn thành', color: '#1D4ED8' },
          { label: 'Giá trung bình', value: Math.round(avgFare).toLocaleString('vi-VN') + ' đ', sub: 'Mỗi chuyến', color: '#F59E0B' },
          { label: 'Vùng hoạt động', value: revenue.length.toString(), sub: 'Miền Bắc + Miền Nam', color: '#8B5CF6' },
        ].map(card => (
          <div key={card.label} className="stat-card">
            <div className="stat-card-label">{card.label}</div>
            <div className="stat-card-value" style={{ color: card.color }}>{card.value}</div>
            <div className="stat-card-sub">{card.sub}</div>
          </div>
        ))}
      </div>

      <div className="chart-card">
        <h3 className="chart-title">Doanh thu theo vùng</h3>
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={revenue} margin={{ top: 5, right: 20, left: 20, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" />
            <XAxis dataKey="region" tick={{ fontSize: 13, fontWeight: 600 }} />
            <YAxis tick={{ fontSize: 12 }} />
            <Tooltip formatter={(v: number) => [v.toLocaleString('vi-VN') + ' đ', 'Doanh thu']} />
            <Bar dataKey="total_revenue" name="Doanh thu" fill="#00AF50" radius={[6, 6, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="chart-card">
        <h3 className="chart-title">Số chuyến theo ngày</h3>
        <ResponsiveContainer width="100%" height={260}>
          <LineChart data={lineData} margin={{ top: 5, right: 20, left: 20, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" />
            <XAxis dataKey="date" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 12 }} />
            <Tooltip />
            <Legend />
            <Line type="monotone" dataKey="NORTH" stroke="#1D4ED8" strokeWidth={2.5} dot={{ r: 4 }} name="Miền Bắc" />
            <Line type="monotone" dataKey="SOUTH" stroke="#00AF50" strokeWidth={2.5} dot={{ r: 4 }} name="Miền Nam" />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="chart-card">
        <h3 className="chart-title">Top 10 tài xế tiêu biểu</h3>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
          <thead>
            <tr style={{ borderBottom: '2px solid #F3F4F6' }}>
              {['#', 'ID Tài xế', 'Số chuyến', 'Tổng thu nhập'].map(h => <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 700, color: '#6B7280', fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.5px' }}>{h}</th>)}
            </tr>
          </thead>
          <tbody>
            {drivers.map((d, i) => (
              <tr key={d.driver_id} style={{ borderBottom: '1px solid #F3F4F6', background: i % 2 ? '#F9FAFB' : 'white' }}>
                <td style={{ padding: '12px 14px', color: '#9CA3AF', fontWeight: 700 }}>#{i + 1}</td>
                <td style={{ padding: '12px 14px', fontWeight: 600 }}>Tài xế #{d.driver_id}</td>
                <td style={{ padding: '12px 14px' }}><span style={{ background: '#E8F8EF', color: '#065F46', padding: '3px 10px', borderRadius: 999, fontSize: 13, fontWeight: 700 }}>{d.total_trips} chuyến</span></td>
                <td style={{ padding: '12px 14px', fontWeight: 800, color: '#00AF50', fontSize: 15 }}>{Number(d.total_earned).toLocaleString('vi-VN')} đ</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
