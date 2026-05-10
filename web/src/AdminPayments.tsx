import { useEffect, useState, useCallback } from 'react'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? ''
const TOKEN_KEY = 'grab_auth_token'

type Payment = { id: number; trip_id: number; amount: number; method: string; status: string; vnpay_transaction_id: string | null; created_at: string; pickup_address?: string; dropoff_address?: string; customer_name?: string; }

const STATUS_BADGE: Record<string, string> = { completed: 'badge-green', failed: 'badge-red', pending: 'badge-yellow' }
const STATUS_LABEL: Record<string, string> = { completed: 'Thành công', failed: 'Thất bại', pending: 'Chờ xử lý' }
const METHOD_BADGE: Record<string, string> = { cash: 'badge-gray', vnpay: 'badge-blue' }

export default function AdminPayments() {
  const [payments, setPayments] = useState<Payment[]>([])
  const [status, setStatus] = useState('')
  const [loading, setLoading] = useState(false)
  const token = localStorage.getItem(TOKEN_KEY) ?? ''

  const fetchPayments = useCallback(async () => {
    setLoading(true)
    try {
      const url = status ? `${API_BASE_URL}/payments/admin/all?status=${status}` : `${API_BASE_URL}/payments/admin/all`
      const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } })
      const json = await res.json()
      setPayments(json.data ?? [])
    } catch {
    } finally {
      setLoading(false)
    }
  }, [status, token])

  useEffect(() => { fetchPayments() }, [fetchPayments])

  const total = payments.reduce((s, p) => s + (p.status === 'completed' ? Number(p.amount) : 0), 0)

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div>
          <h2 style={{ fontSize: 20, fontWeight: 800, color: 'white', marginBottom: 4 }}>Lịch sử thanh toán</h2>
          <p style={{ fontSize: 13, color: '#8892B0' }}>Tổng thu: <span style={{ color: '#00E676', fontWeight: 700 }}>{total.toLocaleString('vi-VN')} đ</span></p>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <select className="filter-select" value={status} onChange={e => setStatus(e.target.value)}>
            <option value="">Tất cả trạng thái</option>
            <option value="pending">Chờ xử lý</option>
            <option value="completed">Thành công</option>
            <option value="failed">Thất bại</option>
          </select>
          <button className="btn-success" onClick={fetchPayments}>Tải lại</button>
        </div>
      </div>
      {loading ? <p style={{ color: '#8892B0' }}>Đang tải...</p> : (
        <table className="data-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Khách hàng</th>
              <th>Điểm đón</th>
              <th>Điểm trả</th>
              <th>Số tiền</th>
              <th>Phương thức</th>
              <th>Trạng thái</th>
              <th>Ngày</th>
            </tr>
          </thead>
          <tbody>
            {payments.length === 0 ? (
              <tr><td colSpan={8} style={{ textAlign: 'center', color: '#5A6380', padding: 32 }}>Không có giao dịch nào</td></tr>
            ) : payments.map(p => (
              <tr key={p.id}>
                <td style={{ color: '#5A6380' }}>#{p.id}</td>
                <td style={{ fontWeight: 600 }}>{p.customer_name ?? '-'}</td>
                <td style={{ color: '#8892B0', maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.pickup_address ?? '-'}</td>
                <td style={{ color: '#8892B0', maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.dropoff_address ?? '-'}</td>
                <td style={{ fontWeight: 700, color: '#00E676' }}>{Number(p.amount).toLocaleString('vi-VN')} đ</td>
                <td><span className={`badge ${METHOD_BADGE[p.method] ?? 'badge-gray'}`}>{p.method?.toUpperCase()}</span></td>
                <td><span className={`badge ${STATUS_BADGE[p.status] ?? 'badge-gray'}`}>{STATUS_LABEL[p.status] ?? p.status}</span></td>
                <td style={{ color: '#5A6380', fontSize: 12 }}>{new Date(p.created_at).toLocaleDateString('vi-VN')}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}
