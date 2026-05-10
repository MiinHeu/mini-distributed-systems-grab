import { useEffect, useRef, useState, useCallback } from 'react'

type NodeDetail = { status: 'online' | 'offline'; responseTimeMs: number | null }
type ServiceLevel = 'full' | 'readonly' | 'unavailable'
type ReplicationInfo = { applicationName: string; state: string; syncState: string; sentLsn: string | null; writeLsn: string | null; flushLsn: string | null; replayLsn: string | null; writeLagMs: string | null; flushLagMs: string | null; replayLagMs: string | null; }
type RegionRepl = { connected: boolean; replicas: ReplicationInfo[] }
type HealthData = {
  nodes: {
    NORTH_PRIMARY: NodeDetail;
    NORTH_REPLICA: NodeDetail;
    SOUTH_PRIMARY: NodeDetail;
    SOUTH_REPLICA: NodeDetail;
  };
  serviceLevel: {
    NORTH: ServiceLevel;
    SOUTH: ServiceLevel;
  };
  replication: {
    NORTH: RegionRepl;
    SOUTH: RegionRepl;
  };
  lastCheckedAt: string | null;
  uptimeSeconds: number;
  tripCounts: {
    NORTH: number;
    SOUTH: number;
  };
}
type TimelineEntry = { timestamp: string; changes: string[] }

const API = import.meta.env.VITE_API_BASE_URL ?? ''

const SVC_COLOR: Record<ServiceLevel, string> = { full: '#00E676', readonly: '#FFAB00', unavailable: '#FF1744' }
const SVC_BG: Record<ServiceLevel, string> = { full: 'rgba(0,230,118,0.12)', readonly: 'rgba(255,171,0,0.12)', unavailable: 'rgba(255,23,68,0.12)' }
const SVC_LABEL: Record<ServiceLevel, string> = { full: 'HOẠT ĐỘNG TỐT', readonly: 'CHỈ ĐỌC (REPLICA)', unavailable: 'MẤT KẾT NỐI' }
const NODE_COLOR = (s: string) => s === 'online' ? '#00E676' : '#FF1744'

function fmtUptime(s: number) {
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const ss = s % 60;
  return `${h} giờ ${m} phút ${ss} giây`
}

export default function SystemMonitor() {
  const [health, setHealth] = useState<HealthData | null>(null)
  const [timeline, setTimeline] = useState<TimelineEntry[]>([])
  const [error, setError] = useState<string | null>(null)
  const [countdown, setCountdown] = useState(5)
  const [tab, setTab] = useState<'overview' | 'replication' | 'timeline'>('overview')
  const prevRef = useRef<HealthData | null>(null)

  const poll = useCallback(async () => {
    try {
      const [hRes, tRes] = await Promise.all([
        fetch(`${API}/health`).then(r => r.json()),
        fetch(`${API}/health/history`).then(r => r.json()),
      ])
      setHealth(hRes.data)
      setTimeline(tRes.data?.timeline ?? [])
      setError(null)
      prevRef.current = hRes.data
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e))
    }
    setCountdown(5)
  }, [])

  useEffect(() => { poll(); const id = setInterval(poll, 5000); return () => clearInterval(id) }, [poll])
  useEffect(() => { const id = setInterval(() => setCountdown(c => Math.max(0, c - 1)), 1000); return () => clearInterval(id) }, [])

  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(135deg, #0A0E27 0%, #1A1040 40%, #0D1933 100%)', color: '#E0E6F0', fontFamily: "'Inter', system-ui, sans-serif", margin: '-24px -16px', padding: 0 }}>
      {/* Header */}
      <div style={{ background: 'rgba(255,255,255,0.03)', borderBottom: '1px solid rgba(255,255,255,0.06)', padding: '14px 28px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 10, height: 10, borderRadius: '50%', background: error ? '#FF1744' : '#00E676', boxShadow: `0 0 12px ${error ? '#FF1744' : '#00E676'}` }} />
          <div style={{ width: 36, height: 36, borderRadius: 10, background: '#00AF50', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 900, color: 'white' }}>MG</div>
          <h1 style={{ margin: 0, fontSize: 20, fontWeight: 800, background: 'linear-gradient(90deg, #7C4DFF, #00E5FF)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>Giám Sát Hệ Thống Phân Tán</h1>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 20, fontSize: 13, color: '#8892B0' }}>
          {health && <span>Uptime: <b style={{ color: '#00E5FF' }}>{fmtUptime(health.uptimeSeconds)}</b></span>}
          {health?.lastCheckedAt && <span>{new Date(health.lastCheckedAt).toLocaleTimeString()}</span>}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{ width: 80, height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.08)', overflow: 'hidden' }}>
              <div style={{ width: `${(countdown / 5) * 100}%`, height: '100%', background: 'linear-gradient(90deg, #7C4DFF, #00E5FF)', borderRadius: 2, transition: 'width 1s linear' }} />
            </div>
            <span style={{ fontSize: 11 }}>{countdown}s</span>
          </div>
        </div>
      </div>

      {error && <div style={{ margin: '12px 28px', padding: '10px 16px', background: 'rgba(255,23,68,0.1)', border: '1px solid rgba(255,23,68,0.3)', borderRadius: 10, color: '#FF6E7F', fontSize: 13 }}>Lỗi kết nối: {error}</div>}

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 2, padding: '12px 28px 0', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        {(['overview', 'replication', 'timeline'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)} style={{ background: tab === t ? 'rgba(124,77,255,0.15)' : 'transparent', border: 'none', borderBottom: tab === t ? '2px solid #7C4DFF' : '2px solid transparent', color: tab === t ? '#CDB4FF' : '#5A6380', padding: '10px 20px', cursor: 'pointer', fontSize: 14, fontWeight: 600, borderRadius: '8px 8px 0 0', transition: 'all 0.2s' }}>
            {t === 'overview' ? 'Tổng quan' : t === 'replication' ? 'Đồng bộ (Replication)' : 'Nhật ký (Timeline)'}
          </button>
        ))}
      </div>

      <div style={{ padding: '20px 28px' }}>
        {!health && !error && <div style={{ textAlign: 'center', color: '#5A6380', padding: 60 }}>Đang kết nối tới hệ thống...</div>}
        {health && tab === 'overview' && <OverviewTab health={health} />}
        {health && tab === 'replication' && <ReplicationTab health={health} />}
        {tab === 'timeline' && <TimelineTab timeline={timeline} />}
      </div>

      <style>{`@keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} } @keyframes slideIn { from{opacity:0;transform:translateY(-6px)} to{opacity:1;transform:translateY(0)} }`}</style>
    </div>
  )
}

function OverviewTab({ health }: { health: HealthData }) {
  const nodes = [
    { key: 'NORTH_PRIMARY', label: 'Miền Bắc (Primary)', role: 'PRIMARY', port: '5432', data: health.nodes.NORTH_PRIMARY },
    { key: 'NORTH_REPLICA', label: 'Miền Bắc (Replica)', role: 'REPLICA', port: '5433', data: health.nodes.NORTH_REPLICA },
    { key: 'SOUTH_PRIMARY', label: 'Miền Nam (Primary)', role: 'PRIMARY', port: '5434', data: health.nodes.SOUTH_PRIMARY },
    { key: 'SOUTH_REPLICA', label: 'Miền Nam (Replica)', role: 'REPLICA', port: '5435', data: health.nodes.SOUTH_REPLICA },
  ]
  const maxLatency = Math.max(...nodes.map(n => n.data.responseTimeMs ?? 0), 1)

  return (
    <>
      {/* Service level cards */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 20 }}>
        {(['NORTH', 'SOUTH'] as const).map(r => {
          const level = health.serviceLevel[r]
          return (
            <div key={r} style={{ background: SVC_BG[level], border: `1px solid ${SVC_COLOR[level]}30`, borderRadius: 16, padding: '18px 22px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: 11, color: '#5A6380', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 }}>{r === 'NORTH' ? 'MIỀN BẮC' : 'MIỀN NAM'}</div>
                <div style={{ fontSize: 24, fontWeight: 900, color: SVC_COLOR[level] }}>{SVC_LABEL[level]}</div>
                <div style={{ fontSize: 12, color: '#5A6380', marginTop: 4 }}>Dữ liệu: {health.tripCounts[r]} chuyến xe</div>
              </div>
              <div style={{ width: 44, height: 44, borderRadius: '50%', background: `${SVC_COLOR[level]}15`, display: 'flex', alignItems: 'center', justifyContent: 'center', border: `2px solid ${SVC_COLOR[level]}40` }}>
                <div style={{ width: 14, height: 14, borderRadius: '50%', background: SVC_COLOR[level], animation: level === 'full' ? 'pulse 2s infinite' : 'none' }} />
              </div>
            </div>
          )
        })}
      </div>

      {/* Node cards */}
      <div style={{ fontSize: 11, color: '#5A6380', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10 }}>Trạng thái các Node CSDL</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 20 }}>
        {nodes.map(n => (
          <div key={n.key} style={{ background: 'rgba(255,255,255,0.03)', border: `1px solid ${n.data.status === 'online' ? 'rgba(0,230,118,0.2)' : 'rgba(255,23,68,0.25)'}`, borderRadius: 14, padding: 16, textAlign: 'center', position: 'relative', overflow: 'hidden' }}>
            <div style={{ position: 'absolute', top: 0, left: '50%', transform: 'translateX(-50%)', width: 60, height: 3, borderRadius: '0 0 3px 3px', background: NODE_COLOR(n.data.status) }} />
            <div style={{ width: 36, height: 36, borderRadius: '50%', margin: '8px auto 10px', background: `${NODE_COLOR(n.data.status)}15`, display: 'flex', alignItems: 'center', justifyContent: 'center', border: `2px solid ${NODE_COLOR(n.data.status)}40` }}>
              <div style={{ width: 12, height: 12, borderRadius: '50%', background: NODE_COLOR(n.data.status), animation: n.data.status === 'online' ? 'pulse 2s infinite' : 'none' }} />
            </div>
            <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 2 }}>{n.label}</div>
            <div style={{ fontSize: 10, color: n.role === 'PRIMARY' ? '#7C4DFF' : '#00E5FF', fontWeight: 700, marginBottom: 6 }}>{n.role} :{n.port}</div>
            <div style={{ fontSize: 13, fontWeight: 800, color: NODE_COLOR(n.data.status) }}>{n.data.status === 'online' ? 'ONLINE' : 'OFFLINE'}</div>
            {n.data.responseTimeMs !== null && (
              <div style={{ marginTop: 8 }}>
                <div style={{ height: 3, borderRadius: 2, background: 'rgba(255,255,255,0.06)', overflow: 'hidden', marginBottom: 4 }}>
                  <div style={{ width: `${Math.min((n.data.responseTimeMs / maxLatency) * 100, 100)}%`, height: '100%', background: n.data.responseTimeMs < 50 ? '#00E676' : n.data.responseTimeMs < 150 ? '#FFAB00' : '#FF1744', borderRadius: 2 }} />
                </div>
                <div style={{ fontSize: 12, fontWeight: 700, color: n.data.responseTimeMs < 50 ? '#00E676' : n.data.responseTimeMs < 150 ? '#FFAB00' : '#FF1744' }}>{n.data.responseTimeMs}ms</div>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Topology */}
      <div style={{ fontSize: 11, color: '#5A6380', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10 }}>Mô hình kết nối (Topology)</div>
      <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 14, padding: 20, display: 'flex', justifyContent: 'space-around', gap: 16, flexWrap: 'wrap' }}>
        {(['NORTH', 'SOUTH'] as const).map(r => {
          const primary = r === 'NORTH' ? health.nodes.NORTH_PRIMARY : health.nodes.SOUTH_PRIMARY
          const replica = r === 'NORTH' ? health.nodes.NORTH_REPLICA : health.nodes.SOUTH_REPLICA
          const repl = health.replication[r]
          return (
            <div key={r} style={{ textAlign: 'center', flex: '1 1 280px' }}>
              <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 14, color: r === 'NORTH' ? '#448AFF' : '#FF5252' }}>{r === 'NORTH' ? 'CỤM MIỀN BẮC' : 'CỤM MIỀN NAM'}</div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
                <div style={{ padding: '12px 18px', borderRadius: 10, background: `${NODE_COLOR(primary.status)}10`, border: `2px solid ${NODE_COLOR(primary.status)}40`, minWidth: 110 }}>
                  <div style={{ fontSize: 10, color: '#7C4DFF', fontWeight: 700 }}>PRIMARY</div>
                  <div style={{ fontSize: 11, color: '#5A6380', marginTop: 2 }}>:{r === 'NORTH' ? '5432' : '5434'}</div>
                  <div style={{ fontSize: 14, fontWeight: 800, color: NODE_COLOR(primary.status), marginTop: 6 }}>{primary.status === 'online' ? 'ONLINE' : 'OFFLINE'}</div>
                  {primary.responseTimeMs !== null && <div style={{ fontSize: 11, color: '#8892B0', marginTop: 3 }}>{primary.responseTimeMs}ms</div>}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                  <div style={{ fontSize: 9, color: repl.connected ? '#00E676' : '#FF1744', fontWeight: 700 }}>{repl.connected ? 'SYNCING' : 'DISCONNECTED'}</div>
                  <div style={{ width: 40, height: 2, background: repl.connected ? '#00E676' : '#FF1744', opacity: 0.6 }} />
                  <div style={{ fontSize: 16, color: repl.connected ? '#00E676' : '#FF1744' }}>-&gt;</div>
                </div>
                <div style={{ padding: '12px 18px', borderRadius: 10, background: `${NODE_COLOR(replica.status)}10`, border: `2px solid ${NODE_COLOR(replica.status)}40`, minWidth: 110 }}>
                  <div style={{ fontSize: 10, color: '#00E5FF', fontWeight: 700 }}>REPLICA</div>
                  <div style={{ fontSize: 11, color: '#5A6380', marginTop: 2 }}>:{r === 'NORTH' ? '5433' : '5435'}</div>
                  <div style={{ fontSize: 14, fontWeight: 800, color: NODE_COLOR(replica.status), marginTop: 6 }}>{replica.status === 'online' ? 'ONLINE' : 'OFFLINE'}</div>
                  {replica.responseTimeMs !== null && <div style={{ fontSize: 11, color: '#8892B0', marginTop: 3 }}>{replica.responseTimeMs}ms</div>}
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </>
  )
}

function ReplicationTab({ health }: { health: HealthData }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
      {(['NORTH', 'SOUTH'] as const).map(r => {
        const repl = health.replication[r]
        return (
          <div key={r} style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 14, padding: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
              <span style={{ fontSize: 16, color: r === 'NORTH' ? '#448AFF' : '#FF5252' }}>{r === 'NORTH' ? '[Bắc]' : '[Nam]'}</span>
              <span style={{ fontSize: 15, fontWeight: 700 }}>Trạng thái đồng bộ {r}</span>
              <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 999, background: repl.connected ? 'rgba(0,230,118,0.15)' : 'rgba(255,23,68,0.15)', color: repl.connected ? '#00E676' : '#FF1744', fontWeight: 700 }}>{repl.connected ? 'Đang kết nối' : 'Mất kết nối'}</span>
            </div>
            {repl.replicas.length === 0 ? (
              <div style={{ color: '#5A6380', fontSize: 13, padding: 16, textAlign: 'center', background: 'rgba(255,255,255,0.02)', borderRadius: 10 }}>Không có replica nào đang đồng bộ.</div>
            ) : repl.replicas.map((rep, i) => (
              <div key={i} style={{ background: 'rgba(255,255,255,0.02)', borderRadius: 10, padding: 14, marginBottom: 8, border: '1px solid rgba(255,255,255,0.04)' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, fontSize: 12 }}>
                  {[['Ứng dụng', rep.applicationName], ['Trạng thái', rep.state], ['Kiểu sync', rep.syncState], ['Độ trễ Ghi', rep.writeLagMs || 'N/A'], ['Độ trễ Flush', rep.flushLagMs || 'N/A'], ['Độ trễ Replay', rep.replayLagMs || 'N/A']].map(([label, value]) => (
                    <div key={label}>
                      <div style={{ fontSize: 9, color: '#5A6380', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5 }}>{label}</div>
                      <div style={{ fontSize: 12, fontWeight: 600, color: label === 'Trạng thái' && value === 'streaming' ? '#00E676' : '#C0C8E0', marginTop: 2 }}>{value}</div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )
      })}
    </div>
  )
}

function TimelineTab({ timeline }: { timeline: TimelineEntry[] }) {
  return (
    <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 14, overflow: 'hidden' }}>
      <div style={{ padding: '14px 20px', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>Nhật ký sự kiện (Timeline)</h3>
        <span style={{ fontSize: 12, color: '#5A6380' }}>{timeline.length} sự kiện</span>
      </div>
      {timeline.length === 0 ? (
        <div style={{ padding: 40, textAlign: 'center', color: '#5A6380' }}>Chưa có thay đổi trạng thái nào được ghi nhận.</div>
      ) : (
        <div style={{ maxHeight: 480, overflow: 'auto' }}>
          {timeline.map((e, i) => (
            <div key={i} style={{ padding: '12px 20px', borderBottom: '1px solid rgba(255,255,255,0.04)', animation: 'slideIn 0.3s ease', display: 'flex', gap: 14, alignItems: 'flex-start' }}>
              <div style={{ paddingTop: 5 }}><div style={{ width: 8, height: 8, borderRadius: '50%', background: '#7C4DFF' }} /></div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 11, color: '#5A6380', marginBottom: 4 }}>{new Date(e.timestamp).toLocaleTimeString()}</div>
                {e.changes.map((c, j) => {
                  const isOnline = c.includes('ONLINE')
                  return (
                    <div key={j} style={{ fontSize: 12, padding: '3px 8px', marginBottom: 2, borderRadius: 5, background: isOnline ? 'rgba(0,230,118,0.08)' : 'rgba(255,23,68,0.08)', color: isOnline ? '#69F0AE' : '#FF8A80', fontFamily: 'monospace' }}>{c}</div>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
