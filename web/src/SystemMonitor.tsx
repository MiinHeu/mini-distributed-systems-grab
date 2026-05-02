import { useEffect, useRef, useState, useCallback } from 'react'

type NodeDetail = { status: 'online' | 'offline'; responseTimeMs: number | null }
type ServiceLevel = 'full' | 'readonly' | 'unavailable'
type ReplicationInfo = {
  applicationName: string; state: string; syncState: string
  sentLsn: string | null; writeLsn: string | null; flushLsn: string | null; replayLsn: string | null
  writeLagMs: string | null; flushLagMs: string | null; replayLagMs: string | null
}
type RegionRepl = { connected: boolean; replicas: ReplicationInfo[] }
type HealthData = {
  nodes: { northPrimary: NodeDetail; northReplica: NodeDetail; southPrimary: NodeDetail; southReplica: NodeDetail }
  serviceLevel: { north: ServiceLevel; south: ServiceLevel }
  replication: { north: RegionRepl; south: RegionRepl }
  lastCheckedAt: string | null
  uptimeSeconds: number
}
type TimelineEntry = { timestamp: string; changes: string[] }

const API = import.meta.env.VITE_API_BASE ?? 'http://localhost:3000'

export default function SystemMonitor() {
  const [health, setHealth] = useState<HealthData | null>(null)
  const [timeline, setTimeline] = useState<TimelineEntry[]>([])
  const [error, setError] = useState<string | null>(null)
  const [countdown, setCountdown] = useState(5)
  const [tab, setTab] = useState<'overview' | 'replication' | 'timeline'>('overview')
  const prevRef = useRef<HealthData | null>(null)
  const localTimeline = useRef<{ at: number; changes: string[] }[]>([])

  const poll = useCallback(async () => {
    try {
      const [hRes, tRes] = await Promise.all([
        fetch(`${API}/health`).then(r => r.json()),
        fetch(`${API}/health/history`).then(r => r.json()),
      ])
      const d: HealthData = hRes.data
      setHealth(d)
      setTimeline(tRes.data?.timeline ?? [])
      setError(null)

      if (prevRef.current) {
        const changes: string[] = []
        for (const k of ['northPrimary','northReplica','southPrimary','southReplica'] as const) {
          if (prevRef.current.nodes[k].status !== d.nodes[k].status)
            changes.push(`${k}: ${prevRef.current.nodes[k].status} → ${d.nodes[k].status}`)
        }
        if (changes.length > 0) localTimeline.current.unshift({ at: Date.now(), changes })
      }
      prevRef.current = d
    } catch (e: unknown) { setError(e instanceof Error ? e.message : String(e)) }
    setCountdown(5)
  }, [])

  // eslint-disable-next-line
  useEffect(() => { poll(); const id = setInterval(poll, 5000); return () => clearInterval(id) }, [poll])
  useEffect(() => { const id = setInterval(() => setCountdown(c => Math.max(0, c - 1)), 1000); return () => clearInterval(id) }, [])

  const svcColor = (l: ServiceLevel) => l === 'full' ? '#00e676' : l === 'readonly' ? '#ffab00' : '#ff1744'
  const svcGlow = (l: ServiceLevel) => l === 'full' ? '0 0 20px #00e67644' : l === 'readonly' ? '0 0 20px #ffab0044' : '0 0 20px #ff174444'
  const nodeColor = (s: string) => s === 'online' ? '#00e676' : '#ff1744'
  const fmtUptime = (s: number) => { const h = Math.floor(s/3600); const m = Math.floor((s%3600)/60); const ss = s%60; return `${h}h ${m}m ${ss}s` }

  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(135deg, #0a0e27 0%, #1a1040 40%, #0d1933 100%)', color: '#e0e6f0', fontFamily: "'Inter', 'Segoe UI', system-ui, sans-serif", margin: '-1.5rem -1rem', padding: '0' }}>
      {/* Header */}
      <div style={{ background: 'rgba(255,255,255,0.03)', borderBottom: '1px solid rgba(255,255,255,0.06)', padding: '16px 32px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 10, height: 10, borderRadius: '50%', background: error ? '#ff1744' : '#00e676', boxShadow: error ? '0 0 12px #ff1744' : '0 0 12px #00e676', animation: 'pulse 2s infinite' }} />
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, background: 'linear-gradient(90deg, #7c4dff, #00e5ff)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>🖥️ System Health Monitor</h1>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 20, fontSize: 13, color: '#8892b0' }}>
          {health && <span>⏱ Uptime: <b style={{ color: '#00e5ff' }}>{fmtUptime(health.uptimeSeconds)}</b></span>}
          {health?.lastCheckedAt && <span>🕐 {new Date(health.lastCheckedAt).toLocaleTimeString()}</span>}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{ width: 100, height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.1)', overflow: 'hidden' }}>
              <div style={{ width: `${(countdown / 5) * 100}%`, height: '100%', background: 'linear-gradient(90deg, #7c4dff, #00e5ff)', borderRadius: 2, transition: 'width 1s linear' }} />
            </div>
            <span style={{ fontSize: 11 }}>{countdown}s</span>
          </div>
        </div>
      </div>

      {error && <div style={{ margin: '16px 32px', padding: '12px 20px', background: 'rgba(255,23,68,0.1)', border: '1px solid rgba(255,23,68,0.3)', borderRadius: 12, color: '#ff6e7f' }}>⚠️ {error}</div>}

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, padding: '16px 32px 0', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        {(['overview', 'replication', 'timeline'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)} style={{ background: tab === t ? 'rgba(124,77,255,0.15)' : 'transparent', border: 'none', borderBottom: tab === t ? '2px solid #7c4dff' : '2px solid transparent', color: tab === t ? '#cdb4ff' : '#5a6380', padding: '10px 20px', cursor: 'pointer', fontSize: 14, fontWeight: 600, borderRadius: '8px 8px 0 0', transition: 'all 0.2s' }}>
            {t === 'overview' ? '📊 Overview' : t === 'replication' ? '🔄 Replication' : '📜 Timeline'}
          </button>
        ))}
      </div>

      <div style={{ padding: '24px 32px' }}>
        {!health && !error && <div style={{ textAlign: 'center', color: '#5a6380', padding: 60, fontSize: 16 }}>Đang kết nối tới hệ thống...</div>}

        {health && tab === 'overview' && <OverviewTab health={health} nodeColor={nodeColor} svcColor={svcColor} svcGlow={svcGlow} />}
        {health && tab === 'replication' && <ReplicationTab health={health} />}
        {/* eslint-disable-next-line */}
        {tab === 'timeline' && <TimelineTab timeline={timeline} localTimeline={localTimeline.current} />}
      </div>

      <style>{`
        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }
        @keyframes glow { 0%, 100% { box-shadow: 0 0 8px currentColor; } 50% { box-shadow: 0 0 24px currentColor; } }
        @keyframes slideIn { from { opacity: 0; transform: translateY(-8px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>
    </div>
  )
}

/* ───── Overview Tab ───── */
function OverviewTab({ health, nodeColor, svcColor, svcGlow }: { health: HealthData; nodeColor: (s: string) => string; svcColor: (l: ServiceLevel) => string; svcGlow: (l: ServiceLevel) => string }) {
  const nodes = [
    { key: 'northPrimary', label: 'North Primary', role: 'PRIMARY', region: 'NORTH', data: health.nodes.northPrimary },
    { key: 'northReplica', label: 'North Replica', role: 'REPLICA', region: 'NORTH', data: health.nodes.northReplica },
    { key: 'southPrimary', label: 'South Primary', role: 'PRIMARY', region: 'SOUTH', data: health.nodes.southPrimary },
    { key: 'southReplica', label: 'South Replica', role: 'REPLICA', region: 'SOUTH', data: health.nodes.southReplica },
  ]
  const maxLatency = Math.max(...nodes.map(n => n.data.responseTimeMs ?? 0), 1)

  return (
    <>
      {/* Service Level Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 24 }}>
        {(['north', 'south'] as const).map(r => {
          const level = health.serviceLevel[r]
          return (
            <div key={r} style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 16, padding: '20px 24px', boxShadow: svcGlow(level), transition: 'box-shadow 0.5s' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontSize: 12, color: '#5a6380', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1 }}>{r === 'north' ? '🔵 Miền Bắc' : '🔴 Miền Nam'}</div>
                  <div style={{ fontSize: 28, fontWeight: 800, marginTop: 4, color: svcColor(level) }}>{level.toUpperCase()}</div>
                </div>
                <div style={{ width: 48, height: 48, borderRadius: '50%', background: `${svcColor(level)}15`, display: 'flex', alignItems: 'center', justifyContent: 'center', border: `2px solid ${svcColor(level)}40` }}>
                  <div style={{ width: 16, height: 16, borderRadius: '50%', background: svcColor(level), animation: level === 'full' ? 'pulse 2s infinite' : level === 'unavailable' ? 'glow 1s infinite' : 'none', color: svcColor(level) }} />
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Node Topology */}
      <h3 style={{ fontSize: 14, color: '#5a6380', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12 }}>🌐 Database Nodes</h3>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 24 }}>
        {nodes.map(n => (
          <div key={n.key} style={{ background: 'rgba(255,255,255,0.03)', border: `1px solid ${n.data.status === 'online' ? 'rgba(0,230,118,0.2)' : 'rgba(255,23,68,0.3)'}`, borderRadius: 16, padding: 20, textAlign: 'center', transition: 'all 0.3s', position: 'relative', overflow: 'hidden' }}>
            {/* Glow effect */}
            <div style={{ position: 'absolute', top: 0, left: '50%', transform: 'translateX(-50%)', width: 80, height: 3, borderRadius: '0 0 4px 4px', background: nodeColor(n.data.status), opacity: 0.8 }} />
            {/* Status dot */}
            <div style={{ width: 40, height: 40, borderRadius: '50%', margin: '0 auto 12px', background: `${nodeColor(n.data.status)}20`, display: 'flex', alignItems: 'center', justifyContent: 'center', border: `2px solid ${nodeColor(n.data.status)}50` }}>
              <div style={{ width: 14, height: 14, borderRadius: '50%', background: nodeColor(n.data.status), animation: n.data.status === 'online' ? 'pulse 2s infinite' : 'glow 0.8s infinite', color: nodeColor(n.data.status) }} />
            </div>
            <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 2 }}>{n.label}</div>
            <div style={{ fontSize: 11, color: n.role === 'PRIMARY' ? '#7c4dff' : '#00e5ff', fontWeight: 600, marginBottom: 8 }}>{n.role}</div>
            <div style={{ fontSize: 22, fontWeight: 800, color: nodeColor(n.data.status), marginBottom: 4 }}>
              {n.data.status === 'online' ? '● ONLINE' : '○ OFFLINE'}
            </div>
            {/* Latency */}
            {n.data.responseTimeMs !== null && (
              <div style={{ marginTop: 10 }}>
                <div style={{ fontSize: 11, color: '#5a6380', marginBottom: 4 }}>Latency</div>
                <div style={{ height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.06)', overflow: 'hidden' }}>
                  <div style={{ width: `${Math.min((n.data.responseTimeMs / maxLatency) * 100, 100)}%`, height: '100%', background: n.data.responseTimeMs < 50 ? '#00e676' : n.data.responseTimeMs < 150 ? '#ffab00' : '#ff1744', borderRadius: 2, transition: 'width 0.5s' }} />
                </div>
                <div style={{ fontSize: 13, fontWeight: 700, marginTop: 4, color: n.data.responseTimeMs < 50 ? '#00e676' : n.data.responseTimeMs < 150 ? '#ffab00' : '#ff1744' }}>
                  {n.data.responseTimeMs}ms
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Connection lines visualization */}
      <h3 style={{ fontSize: 14, color: '#5a6380', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12 }}>🔗 Topology Map</h3>
      <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 16, padding: 24, display: 'flex', justifyContent: 'space-around', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
        {(['north', 'south'] as const).map(r => {
          const primary = r === 'north' ? health.nodes.northPrimary : health.nodes.southPrimary
          const replica = r === 'north' ? health.nodes.northReplica : health.nodes.southReplica
          const repl = health.replication[r]
          return (
            <div key={r} style={{ textAlign: 'center', flex: '1 1 300px' }}>
              <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 16, color: r === 'north' ? '#448aff' : '#ff5252' }}>
                {r === 'north' ? '🔵 NORTH CLUSTER' : '🔴 SOUTH CLUSTER'}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 16 }}>
                {/* Primary */}
                <div style={{ padding: '14px 22px', borderRadius: 12, background: `${nodeColor(primary.status)}10`, border: `2px solid ${nodeColor(primary.status)}40`, minWidth: 120 }}>
                  <div style={{ fontSize: 11, color: '#7c4dff', fontWeight: 700 }}>PRIMARY</div>
                  <div style={{ fontSize: 12, color: '#5a6380', marginTop: 2 }}>Port {r === 'north' ? '5432' : '5434'}</div>
                  <div style={{ marginTop: 6, fontSize: 16, fontWeight: 800, color: nodeColor(primary.status) }}>{primary.status === 'online' ? '●' : '○'} {primary.status.toUpperCase()}</div>
                  {primary.responseTimeMs !== null && <div style={{ fontSize: 11, color: '#8892b0', marginTop: 4 }}>{primary.responseTimeMs}ms</div>}
                </div>
                {/* Arrow */}
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                  <div style={{ fontSize: 10, color: repl.connected ? '#00e676' : '#ff1744', fontWeight: 600 }}>
                    {repl.connected ? 'STREAMING' : 'DISCONNECTED'}
                  </div>
                  <div style={{ width: 50, height: 2, background: repl.connected ? '#00e676' : '#ff1744', opacity: 0.5 }} />
                  <div style={{ fontSize: 18, color: repl.connected ? '#00e676' : '#ff1744' }}>→</div>
                </div>
                {/* Replica */}
                <div style={{ padding: '14px 22px', borderRadius: 12, background: `${nodeColor(replica.status)}10`, border: `2px solid ${nodeColor(replica.status)}40`, minWidth: 120 }}>
                  <div style={{ fontSize: 11, color: '#00e5ff', fontWeight: 700 }}>REPLICA</div>
                  <div style={{ fontSize: 12, color: '#5a6380', marginTop: 2 }}>Port {r === 'north' ? '5433' : '5435'}</div>
                  <div style={{ marginTop: 6, fontSize: 16, fontWeight: 800, color: nodeColor(replica.status) }}>{replica.status === 'online' ? '●' : '○'} {replica.status.toUpperCase()}</div>
                  {replica.responseTimeMs !== null && <div style={{ fontSize: 11, color: '#8892b0', marginTop: 4 }}>{replica.responseTimeMs}ms</div>}
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </>
  )
}

/* ───── Replication Tab ───── */
function ReplicationTab({ health }: { health: HealthData }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
      {(['north', 'south'] as const).map(r => {
        const repl = health.replication[r]
        return (
          <div key={r} style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 16, padding: 24 }}>
            <h3 style={{ margin: '0 0 16px', display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ color: r === 'north' ? '#448aff' : '#ff5252' }}>{r === 'north' ? '🔵' : '🔴'}</span>
              {r.toUpperCase()} Replication
              <span style={{ fontSize: 12, padding: '2px 10px', borderRadius: 12, background: repl.connected ? 'rgba(0,230,118,0.15)' : 'rgba(255,23,68,0.15)', color: repl.connected ? '#00e676' : '#ff1744', fontWeight: 600 }}>
                {repl.connected ? '● Connected' : '○ Disconnected'}
              </span>
            </h3>
            {repl.replicas.length === 0 ? (
              <div style={{ color: '#5a6380', fontSize: 14, padding: 20, textAlign: 'center', background: 'rgba(255,255,255,0.02)', borderRadius: 12 }}>
                Không có replica nào đang kết nối
              </div>
            ) : (
              repl.replicas.map((rep, i) => (
                <div key={i} style={{ background: 'rgba(255,255,255,0.02)', borderRadius: 12, padding: 16, marginBottom: 8, border: '1px solid rgba(255,255,255,0.04)' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, fontSize: 13 }}>
                    <Field label="Application" value={rep.applicationName} />
                    <Field label="State" value={rep.state} color={rep.state === 'streaming' ? '#00e676' : '#ffab00'} />
                    <Field label="Sync" value={rep.syncState} />
                    <Field label="Write Lag" value={rep.writeLagMs || 'N/A'} />
                    <Field label="Flush Lag" value={rep.flushLagMs || 'N/A'} />
                    <Field label="Replay Lag" value={rep.replayLagMs || 'N/A'} />
                    <Field label="Sent LSN" value={rep.sentLsn || 'N/A'} />
                    <Field label="Replay LSN" value={rep.replayLsn || 'N/A'} />
                  </div>
                </div>
              ))
            )}
          </div>
        )
      })}
    </div>
  )
}

function Field({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div>
      <div style={{ fontSize: 10, color: '#5a6380', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 }}>{label}</div>
      <div style={{ fontSize: 13, fontWeight: 600, color: color ?? '#c0c8e0', marginTop: 2 }}>{value}</div>
    </div>
  )
}

/* ───── Timeline Tab ───── */
function TimelineTab({ timeline, localTimeline }: { timeline: TimelineEntry[]; localTimeline: { at: number; changes: string[] }[] }) {
  const merged = [
    ...timeline.map(e => ({ time: new Date(e.timestamp).getTime(), timeStr: new Date(e.timestamp).toLocaleTimeString(), changes: e.changes, source: 'server' as const })),
    ...localTimeline.map(e => ({ time: e.at, timeStr: new Date(e.at).toLocaleTimeString(), changes: e.changes, source: 'client' as const })),
  ].sort((a, b) => b.time - a.time).slice(0, 50)

  return (
    <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 16, overflow: 'hidden' }}>
      <div style={{ padding: '16px 24px', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>📜 Event Timeline</h3>
        <span style={{ fontSize: 12, color: '#5a6380' }}>{merged.length} events</span>
      </div>
      {merged.length === 0 ? (
        <div style={{ padding: 40, textAlign: 'center', color: '#5a6380' }}>Chưa có thay đổi trạng thái nào được ghi nhận.</div>
      ) : (
        <div style={{ maxHeight: 500, overflow: 'auto' }}>
          {merged.map((e, i) => (
            <div key={`${e.time}-${i}`} style={{ padding: '14px 24px', borderBottom: '1px solid rgba(255,255,255,0.04)', animation: 'slideIn 0.3s ease', display: 'flex', gap: 16, alignItems: 'flex-start' }}>
              <div style={{ minWidth: 10, paddingTop: 6 }}>
                <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#7c4dff', border: '2px solid #1a1040' }} />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 12, color: '#5a6380', marginBottom: 4, display: 'flex', gap: 8, alignItems: 'center' }}>
                  <span>{e.timeStr}</span>
                  <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 4, background: e.source === 'server' ? 'rgba(124,77,255,0.15)' : 'rgba(0,229,255,0.15)', color: e.source === 'server' ? '#b388ff' : '#80deea' }}>{e.source}</span>
                </div>
                {e.changes.map((c, j) => {
                  const isOnline = c.includes('→ online')
                  return (
                    <div key={j} style={{ fontSize: 13, padding: '4px 10px', marginBottom: 2, borderRadius: 6, background: isOnline ? 'rgba(0,230,118,0.08)' : 'rgba(255,23,68,0.08)', color: isOnline ? '#69f0ae' : '#ff8a80', fontFamily: 'monospace' }}>
                      {c}
                    </div>
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
