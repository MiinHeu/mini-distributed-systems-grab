import { useEffect, useMemo, useRef, useState } from 'react'

type NodeStatus = 'online' | 'offline'
type ServiceLevel = 'full' | 'readonly' | 'unavailable'

type HealthResponse = {
  nodes: {
    northPrimary: NodeStatus
    northReplica: NodeStatus
    southPrimary: NodeStatus
    southReplica: NodeStatus
  }
  serviceLevel: {
    north: ServiceLevel
    south: ServiceLevel
  }
}

type TimelineEntry = {
  at: number
  changes: string[]
  snapshot: HealthResponse
}

const API_BASE = import.meta.env.VITE_API_BASE ?? 'http://localhost:3000'

async function fetchHealth(): Promise<HealthResponse> {
  const res = await fetch(`${API_BASE}/health`)
  if (!res.ok) throw new Error(await res.text())
  return (await res.json()) as HealthResponse
}

function badgeStyle(color: 'green' | 'red' | 'yellow') {
  const map = {
    green: { bg: '#16a34a', fg: '#052e16' },
    red: { bg: '#dc2626', fg: '#450a0a' },
    yellow: { bg: '#f59e0b', fg: '#3a2907' },
  } as const
  return map[color]
}

function getNodeColor(status: NodeStatus) {
  return status === 'online' ? 'green' : 'red'
}

function getServiceColor(level: ServiceLevel) {
  if (level === 'full') return 'green'
  if (level === 'readonly') return 'yellow'
  return 'red'
}

function formatTime(ts: number) {
  return new Date(ts).toLocaleTimeString()
}

function diffHealth(prev: HealthResponse, next: HealthResponse): string[] {
  const changes: string[] = []

  const nodeKeys = ['northPrimary', 'northReplica', 'southPrimary', 'southReplica'] as const
  for (const key of nodeKeys) {
    if (prev.nodes[key] !== next.nodes[key]) {
      changes.push(`${key}: ${prev.nodes[key]} -> ${next.nodes[key]}`)
    }
  }

  const serviceKeys = ['north', 'south'] as const
  for (const key of serviceKeys) {
    if (prev.serviceLevel[key] !== next.serviceLevel[key]) {
      changes.push(`serviceLevel.${key}: ${prev.serviceLevel[key]} -> ${next.serviceLevel[key]}`)
    }
  }

  return changes
}

export default function SystemMonitor() {
  const [health, setHealth] = useState<HealthResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [timeline, setTimeline] = useState<TimelineEntry[]>([])

  const lastSnapshotRef = useRef<HealthResponse | null>(null)

  const pollEveryMs = 5000

  const containerStyle = useMemo(
    () => ({
      textAlign: 'left' as const,
      maxWidth: 980,
      margin: '0 auto',
      padding: 16,
      fontFamily:
        '-apple-system, BlinkMacSystemFont, Segoe UI, Roboto, Helvetica, Arial, sans-serif, Apple Color Emoji, Segoe UI Emoji',
    }),
    []
  )

  async function pollOnce() {
    setLoading(true)
    setError(null)
    try {
      const next = await fetchHealth()
      const prev = lastSnapshotRef.current

      if (prev) {
        const changes = diffHealth(prev, next)
        // Chỉ ghi timeline khi có thay đổi thật
        if (changes.length > 0) {
          setTimeline((prevTimeline) => [
            {
              at: Date.now(),
              changes,
              snapshot: next,
            },
            ...prevTimeline,
          ].slice(0, 50))
        }
      }

      lastSnapshotRef.current = next
      setHealth(next)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    pollOnce()
    const id = setInterval(() => {
      pollOnce()
    }, pollEveryMs)

    return () => clearInterval(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div style={containerStyle}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
        <h1 style={{ margin: '8px 0 16px 0' }}>System Monitor</h1>
        <div style={{ color: '#6b7280', fontSize: 14 }}>
          Mỗi {Math.round(pollEveryMs / 1000)}s cập nhật {loading ? '(đang kiểm tra...)' : ''}
        </div>
      </div>

      {error && (
        <div
          style={{
            padding: 12,
            border: '1px solid #dc2626',
            color: '#dc2626',
            borderRadius: 10,
            marginBottom: 12,
          }}
        >
          Lỗi: {error}
        </div>
      )}

      {!health && !error && <div style={{ color: '#6b7280' }}>Đang chờ dữ liệu...</div>}

      {health && (
        <>
          <section style={{ marginBottom: 18 }}>
            <h2 style={{ margin: '0 0 10px 0' }}>Service Level</h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }}>
              {(['north', 'south'] as const).map((region) => {
                const level = health.serviceLevel[region]
                const c = getServiceColor(level)
                const { bg, fg } = badgeStyle(c)
                return (
                  <div
                    key={region}
                    style={{
                      border: '1px solid #e5e7eb',
                      borderRadius: 12,
                      padding: 12,
                      background: '#fff',
                    }}
                  >
                    <div style={{ fontWeight: 700, marginBottom: 8 }}>{region}</div>
                    <div
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        padding: '6px 10px',
                        borderRadius: 999,
                        background: bg,
                        color: fg,
                        fontWeight: 800,
                      }}
                    >
                      {level}
                    </div>
                  </div>
                )
              })}
            </div>
          </section>

          <section style={{ marginBottom: 18 }}>
            <h2 style={{ margin: '0 0 10px 0' }}>Nodes</h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }}>
              {(
                [
                  ['northPrimary', health.nodes.northPrimary],
                  ['northReplica', health.nodes.northReplica],
                  ['southPrimary', health.nodes.southPrimary],
                  ['southReplica', health.nodes.southReplica],
                ] as const
              ).map(([key, status]) => {
                const c = getNodeColor(status)
                const { bg, fg } = badgeStyle(c)
                return (
                  <div
                    key={key}
                    style={{
                      border: '1px solid #e5e7eb',
                      borderRadius: 12,
                      padding: 12,
                      background: '#fff',
                    }}
                  >
                    <div style={{ fontWeight: 700, marginBottom: 8 }}>{key}</div>
                    <div
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        padding: '6px 10px',
                        borderRadius: 999,
                        background: bg,
                        color: fg,
                        fontWeight: 800,
                        minWidth: 90,
                      }}
                    >
                      {status}
                    </div>
                  </div>
                )
              })}
            </div>
          </section>

          <section>
            <h2 style={{ margin: '0 0 10px 0' }}>Timeline</h2>
            {timeline.length === 0 ? (
              <div style={{ color: '#6b7280' }}>Chưa có thay đổi trạng thái.</div>
            ) : (
              <div
                style={{
                  border: '1px solid #e5e7eb',
                  borderRadius: 12,
                  overflow: 'auto',
                  maxHeight: 280,
                  background: '#fff',
                }}
              >
                <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                  {timeline.map((entry, idx) => (
                    <li
                      key={`${entry.at}-${idx}`}
                      style={{
                        padding: '10px 12px',
                        borderBottom: idx === timeline.length - 1 ? 'none' : '1px solid #f3f4f6',
                      }}
                    >
                      <div style={{ fontWeight: 700, marginBottom: 6 }}>{formatTime(entry.at)}</div>
                      <div style={{ color: '#374151', fontSize: 14 }}>
                        {entry.changes.map((c, i) => (
                          <div key={i}>{c}</div>
                        ))}
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </section>
        </>
      )}
    </div>
  )
}

