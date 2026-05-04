import { useEffect, useState } from 'react'

const API_BASE_URL = ''
const TOKEN_KEY = 'grab_auth_token'

type Payment = {
  id: number
  trip_id: number
  amount: number
  method: string
  status: string
  vnpay_transaction_id: string | null
  created_at: string
  pickup_address: string
  dropoff_address: string
  customer_name: string
}

export default function AdminPayments() {
  const [payments, setPayments] = useState<Payment[]>([])
  const [status, setStatus] = useState('')
  const [loading, setLoading] = useState(false)

  const fetchPayments = async () => {
    setLoading(true)
    const token = localStorage.getItem(TOKEN_KEY) ?? ''
    const url = status
      ? `${API_BASE_URL}/payments/admin/all?status=${status}`
      : `${API_BASE_URL}/payments/admin/all`
    try {
      const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } })
      const json = await res.json()
      setPayments(json.data ?? [])
    } catch {
      setPayments([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchPayments() }, [status])

  return (
    <div style={{ padding: 32 }}>
      <h2 style={{ color: 'white', marginBottom: 16 }}>💳 Lịch sử thanh toán</h2>
      <select
        value={status}
        onChange={e => setStatus(e.target.value)}
        style={{ marginBottom: 16, padding: '8px 16px', borderRadius: 6, background: '#1a1a2e', color: 'white', border: '1px solid #2a2a3e' }}
      >
        <option value="">Tất cả</option>
        <option value="pending">Pending</option>
        <option value="completed">Completed</option>
        <option value="failed">Failed</option>
      </select>

      {loading ? <p style={{ color: '#aaa' }}>Đang tải...</p> : (
        <table style={{ width: '100%', borderCollapse: 'collapse', color: 'white' }}>
          <thead>
            <tr style={{ background: '#1a1a2e' }}>
              <th style={th}>ID</th>
              <th style={th}>Khách hàng</th>
              <th style={th}>Điểm đón</th>
              <th style={th}>Điểm trả</th>
              <th style={th}>Số tiền</th>
              <th style={th}>Phương thức</th>
              <th style={th}>Trạng thái</th>
              <th style={th}>Ngày</th>
            </tr>
          </thead>
          <tbody>
            {payments.map(p => (
              <tr key={p.id} style={{ borderBottom: '1px solid #2a2a3e' }}>
                <td style={td}>{p.id}</td>
                <td style={td}>{p.customer_name}</td>
                <td style={td}>{p.pickup_address}</td>
                <td style={td}>{p.dropoff_address}</td>
                <td style={td}>{Number(p.amount).toLocaleString()}đ</td>
                <td style={td}>{p.method}</td>
                <td style={td}>
                  <span style={{
                    padding: '2px 8px', borderRadius: 4,
                    background: p.status === 'completed' ? '#00b894' : p.status === 'failed' ? '#d63031' : '#fdcb6e',
                    color: 'black', fontSize: 12
                  }}>{p.status}</span>
                </td>
                <td style={td}>{new Date(p.created_at).toLocaleDateString('vi-VN')}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {!loading && payments.length === 0 && <p style={{ color: '#aaa' }}>Không có dữ liệu</p>}
    </div>
  )
}

const th: any = { padding: '10px 12px', textAlign: 'left', color: '#aaa', fontWeight: 600 }
const td: any = { padding: '10px 12px', fontSize: 14 }