import { useEffect, useState } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  LineChart, Line, ResponsiveContainer,
} from 'recharts'

const API = 'http://localhost:3000'

type RevenueRow = { region: string; total_trips: number; total_revenue: string; avg_fare: string }
type TripRow = { date: string; region: string; total: number }
type DriverRow = { driver_id: number; total_trips: number; total_earned: string }

export default function Dashboard() {
  const [revenue, setRevenue] = useState<RevenueRow[]>([])
  const [trips, setTrips] = useState<TripRow[]>([])
  const [drivers, setDrivers] = useState<DriverRow[]>([])
  const [warning, setWarning] = useState<string | null>(null)
  const [readOnly, setReadOnly] = useState(false)

  useEffect(() => {
    async function load() {
      const [r1, r2, r3] = await Promise.all([
        fetch(`${API}/reports/revenue?latitude=16.0`).then(r => r.json()),
        fetch(`${API}/reports/trips?latitude=16.0`).then(r => r.json()),
        fetch(`${API}/reports/drivers/top?latitude=16.0`).then(r => r.json()),
      ])
      setRevenue(r1.data ?? [])
      setTrips(r2.data ?? [])
      setDrivers(r3.data ?? [])
      setWarning(r1.warning)
      setReadOnly(r1.readOnly)
    }
    load()
    const id = setInterval(load, 30000)
    return () => clearInterval(id)
  }, [])

  const totalTrips = revenue.reduce((s, r) => s + r.total_trips, 0)
  const totalRevenue = revenue.reduce((s, r) => s + Number(r.total_revenue), 0)

  const lineData = Object.values(
    trips.reduce((acc: Record<string, { date: string; NORTH: number; SOUTH: number }>, row) => {
      const d = row.date.slice(0, 10)
      if (!acc[d]) acc[d] = { date: d, NORTH: 0, SOUTH: 0 }
      acc[d][row.region as 'NORTH' | 'SOUTH'] += row.total
      return acc
    }, {})
  ).sort((a, b) => a.date.localeCompare(b.date))

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', padding: 24, fontFamily: 'system-ui', color: '#111' }}>
      <h1 style={{ marginBottom: 4 }}>📊 Dashboard — Mini Grab</h1>

      {readOnly && (
        <div style={{ background: '#fef3c7', border: '1px solid #f59e0b', borderRadius: 8, padding: '10px 16px', marginBottom: 16 }}>
          ⚠️ {warning}
        </div>
      )}

      {/* Thẻ số */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 32 }}>
        {[
          { label: 'Tổng chuyến', value: totalTrips.toLocaleString() },
          { label: 'Tổng doanh thu', value: totalRevenue.toLocaleString('vi-VN') + ' ₫' },
          { label: 'Số vùng active', value: revenue.length },
        ].map(card => (
          <div key={card.label} style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 12, padding: 20 }}>
            <div style={{ color: '#64748b', fontSize: 14 }}>{card.label}</div>
            <div style={{ fontSize: 28, fontWeight: 700, marginTop: 4 }}>{card.value}</div>
          </div>
        ))}
      </div>

      {/* Bar chart */}
      <div style={{ marginBottom: 40 }}>
        <h2>Doanh thu theo vùng</h2>
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={revenue}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="region" />
            <YAxis />
            <Tooltip formatter={(v: number) => v.toLocaleString('vi-VN') + ' ₫'} />
            <Legend />
            <Bar dataKey="total_revenue" name="Doanh thu (₫)" fill="#6366f1" />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Line chart */}
      <div style={{ marginBottom: 40 }}>
        <h2>Số chuyến theo ngày</h2>
        <ResponsiveContainer width="100%" height={280}>
          <LineChart data={lineData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="date" />
            <YAxis />
            <Tooltip />
            <Legend />
            <Line type="monotone" dataKey="NORTH" stroke="#6366f1" strokeWidth={2} />
            <Line type="monotone" dataKey="SOUTH" stroke="#f59e0b" strokeWidth={2} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Bảng top tài xế */}
      <div>
        <h2>Top 10 tài xế</h2>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: '#f1f5f9' }}>
              {['Driver ID', 'Số chuyến', 'Tổng thu'].map(h => (
                <th key={h} style={{ padding: '10px 16px', textAlign: 'left', fontWeight: 600 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {drivers.map((d, i) => (
              <tr key={d.driver_id} style={{ borderTop: '1px solid #e2e8f0', background: i % 2 ? '#f8fafc' : '#fff' }}>
                <td style={{ padding: '10px 16px' }}>#{d.driver_id}</td>
                <td style={{ padding: '10px 16px' }}>{d.total_trips}</td>
                <td style={{ padding: '10px 16px' }}>{Number(d.total_earned).toLocaleString('vi-VN')} ₫</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}