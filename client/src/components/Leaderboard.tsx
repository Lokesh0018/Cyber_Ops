import { useEffect, useMemo, useRef, useState } from 'react'
import { useAuth } from '../hooks/useAuth'
import { SCORE_EVENT } from './FlagBoard'

interface Row { id: string; name: string; institution: string; score: number }
interface Series { id: string; name: string; points: { t: string; score: number }[] }
interface Board { all: Row[]; top: Row[]; series: Series[]; me: { id: string; score: number; rank: number; total: number } }

/** Eight validated categorical hues (dark surface); slots 9–10 reuse 1–2 with a dashed stroke so identity is never colour-alone. */
const HUES = ['#3987e5', '#d95926', '#199e70', '#c98500', '#d55181', '#008300', '#9085e9', '#e66767']
const styleFor = (i: number) => ({ color: HUES[i % HUES.length], dash: i >= HUES.length ? '6 4' : undefined })

const fmtTime = (d: Date) => d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: false })
const POLL_MS = 10_000
const truncate = (s: string, n: number) => (s.length > n ? s.slice(0, n - 1) + '…' : s)

/**
 * CTF scoreboard, modelled on a CTFd board: score-over-time lines for the top 10 (legend + hover crosshair),
 * then the full ranking table. Data: /api/auth/leaderboard (score_events awarded by organisers).
 */
export function Leaderboard() {
  const { session } = useAuth()
  const [board, setBoard] = useState<Board | null>(null)
  const [error, setError] = useState('')
  const [focus, setFocus] = useState<number | null>(null) // series index highlighted via legend/hover
  const [cursor, setCursor] = useState<number | null>(null) // hovered time (ms)
  const [query, setQuery] = useState('')
  const svgRef = useRef<SVGSVGElement>(null)

  const [tick, setTick] = useState(0)
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null)
  // Live board: re-fetch right after one of our own flags is accepted (SCORE_EVENT), and poll every
  // POLL_MS so other students' captures appear too. Polling pauses while the tab is hidden.
  useEffect(() => {
    const bump = () => setTick((t) => t + 1)
    window.addEventListener(SCORE_EVENT, bump)
    const timer = window.setInterval(() => { if (document.visibilityState === 'visible') bump() }, POLL_MS)
    const onVisible = () => { if (document.visibilityState === 'visible') bump() }
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      window.removeEventListener(SCORE_EVENT, bump)
      window.clearInterval(timer)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [])
  useEffect(() => {
    if (!session) return
    let cancelled = false
    fetch('/api/auth/leaderboard', { headers: { Authorization: `Bearer ${session.token}` } })
      .then(async (r) => {
        if (!r.ok) throw new Error('Scoreboard unavailable right now.')
        return (await r.json()) as Board
      })
      .then((b) => { if (!cancelled) { setBoard(b); setError(''); setUpdatedAt(new Date()) } })
      .catch((e: Error) => !cancelled && !board && setError(e.message)) // keep the last good board on a transient failure
    return () => { cancelled = true }
  }, [session, tick]) // eslint-disable-line react-hooks/exhaustive-deps

  // ---- chart model: every series starts at 0 at the first event time and holds its last value to the end
  const model = useMemo(() => {
    const series = (board?.series ?? []).map((s, i) => ({
      ...s,
      idx: i,
      pts: s.points.map((p) => ({ t: new Date(p.t).getTime(), score: p.score })),
      ...styleFor(i),
    }))
    const times = series.flatMap((s) => s.pts.map((p) => p.t))
    if (!times.length) return null
    // One continuous axis from the first capture to the latest (at least a minute wide).
    const t0 = Math.min(...times), t1 = Math.max(...times)
    const span = Math.max(t1 - t0, 60_000)
    const max = Math.max(10, ...series.flatMap((s) => s.pts.map((p) => p.score)))
    return { series, t0, t1: t0 + span, span, max }
  }, [board])

  // ---- geometry (viewBox units)
  const W = 720, H = 260, L = 48, R = 16, T = 12, B = 30
  const pw = W - L - R, ph = H - T - B
  const x = (t: number) => model ? L + ((t - model.t0) / model.span) * pw : L
  /** x → time (inverse of x, for the hover crosshair). */
  const tAt = (px: number) => model ? model.t0 + Math.min(1, Math.max(0, (px - L) / pw)) * model.span : 0
  const y = (v: number) => model ? T + ph - (v / model.max) * ph : T + ph
  const path = (pts: { t: number; score: number }[]) => {
    if (!model) return ''
    const start = `M${x(model.t0)},${y(0)}`
    const segs = pts.map((p) => `L${x(p.t)},${y(p.score)}`).join(' ')
    const last = pts[pts.length - 1]
    return `${start} ${segs} L${x(model.t1)},${y(last?.score ?? 0)}`
  }
  const valueAt = (pts: { t: number; score: number }[], t: number) => {
    let v = 0
    for (const p of pts) { if (p.t <= t) v = p.score; else break }
    return v
  }
  const yTicks = useMemo(() => {
    if (!model) return []
    const step = Math.pow(10, Math.floor(Math.log10(model.max))) / 2
    const n = Math.ceil(model.max / step)
    const s = n > 6 ? step * 2 : step
    return Array.from({ length: Math.floor(model.max / s) + 1 }, (_, i) => i * s)
  }, [model])
  const xTicks = useMemo(() => {
    if (!model) return []
    return Array.from({ length: 6 }, (_, i) => model.t0 + (model.span * i) / 5)
  }, [model])

  const onMove = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!model || !svgRef.current) return
    const rect = svgRef.current.getBoundingClientRect()
    const px = ((e.clientX - rect.left) / rect.width) * W
    setCursor(tAt(px))
  }

  const rows = board?.all ?? []
  const q = query.trim().toLowerCase()
  const shown = q ? rows.filter((r) => r.name.toLowerCase().includes(q) || r.institution.toLowerCase().includes(q)) : rows
  const hasScores = rows.some((r) => r.score > 0)

  return (
    <section className="dcard dcard-wide lb" aria-labelledby="d-lb">
      <div className="dcard-head">
        <h2 id="d-lb" className="dcard-h"><span className="tp-dollar">$</span> ./scoreboard</h2>
        {board && (
          <p className="lb-me">
            <span className="tmuted">your position</span> <b>#{board.me.rank}</b> <span className="tmuted">of {board.me.total}</span>
            <span className="lb-sep" aria-hidden="true">·</span><span className="tmuted">score</span> <b>{board.me.score}</b>
          </p>
        )}
      </div>

      {error && <p className="terr" role="alert"><b>[✗]</b> {error}</p>}
      {!board && !error && <p className="tmuted lb-wait"><span className="tspin" aria-hidden="true" /> loading scoreboard…</p>}

      {board && (
        <>
          <h3 className="lb-sub">
            Top {model?.series.length ?? 0} users
            {updatedAt && <span className="lb-live"><span className="dot" aria-hidden="true" /> live · updated {updatedAt.toLocaleTimeString('en-IN', { hour12: false })}</span>}
          </h3>
          {!hasScores && <p className="lb-empty"><b>[*]</b> No scores yet — the chart fills in as flags are captured on day 2.</p>}

          {model && (
            <figure className="lb-fig">
              <svg
                ref={svgRef}
                className="lb-svg"
                viewBox={`0 0 ${W} ${H}`}
                role="img"
                aria-label={`Score over time for the top ${model.series.length} users`}
                onMouseMove={onMove}
                onMouseLeave={() => setCursor(null)}
              >
                {yTicks.map((v) => (
                  <g key={v}>
                    <line x1={L} x2={W - R} y1={y(v)} y2={y(v)} className="lb-grid" />
                    <text x={L - 8} y={y(v)} className="lb-tick lb-tick-y">{v.toLocaleString('en-IN')}</text>
                  </g>
                ))}
                {xTicks.map((t, i) => (
                  <text key={t} x={x(t)} y={H - 8} className={`lb-tick lb-tick-x ${i === 0 ? 'start' : i === xTicks.length - 1 ? 'end' : ''}`}>{fmtTime(new Date(t))}</text>
                ))}
                <line x1={L} x2={W - R} y1={y(0)} y2={y(0)} className="lb-axis" />

                {model.series.map((s) => {
                  const dim = focus !== null && focus !== s.idx
                  return (
                    <g key={s.id} className={dim ? 'lb-line dim' : 'lb-line'} onMouseEnter={() => setFocus(s.idx)} onMouseLeave={() => setFocus(null)}>
                      {/* wide invisible stroke = hit target */}
                      <path d={path(s.pts)} className="lb-hit-path" />
                      <path d={path(s.pts)} stroke={s.color} strokeDasharray={s.dash} className="lb-path" />
                      {s.pts.map((p, k) => (
                        <circle key={k} cx={x(p.t)} cy={y(p.score)} r={3.5} fill={s.color} className="lb-dot" />
                      ))}
                    </g>
                  )
                })}

                {cursor !== null && (
                  <g className="lb-cross">
                    <line x1={x(cursor)} x2={x(cursor)} y1={T} y2={y(0)} />
                    {model.series.map((s) => (
                      <circle key={s.id} cx={x(cursor)} cy={y(valueAt(s.pts, cursor))} r={4} fill={s.color} className={focus !== null && focus !== s.idx ? 'dim' : ''} />
                    ))}
                  </g>
                )}
              </svg>

              {cursor !== null && (
                <div className="lb-tip" role="status" style={{ left: `${(x(cursor) / W) * 100}%` }}>
                  <b>{fmtTime(new Date(cursor))}</b>
                  {[...model.series]
                    .sort((a, b) => valueAt(b.pts, cursor) - valueAt(a.pts, cursor))
                    .slice(0, 10)
                    .map((s) => (
                      <span key={s.id} className={focus !== null && focus !== s.idx ? 'dim' : ''}>
                        <i style={{ background: s.color, borderStyle: s.dash ? 'dashed' : 'solid' }} /> {truncate(s.name, 18)} <em>{valueAt(s.pts, cursor)}</em>
                      </span>
                    ))}
                </div>
              )}

              <ul className="lb-legend" aria-label="Series">
                {model.series.map((s) => (
                  <li key={s.id}>
                    <button
                      type="button"
                      className={focus !== null && focus !== s.idx ? 'dim' : ''}
                      aria-pressed={focus === s.idx}
                      onClick={() => setFocus(focus === s.idx ? null : s.idx)}
                      onMouseEnter={() => setFocus(s.idx)}
                      onMouseLeave={() => setFocus(null)}
                    >
                      <i style={{ background: s.color, borderStyle: s.dash ? 'dashed' : 'solid' }} aria-hidden="true" />
                      {truncate(s.name, 16)}{s.id === board.me.id ? ' (you)' : ''}
                    </button>
                  </li>
                ))}
              </ul>
            </figure>
          )}

          <div className="lb-tablehead">
            <h3 className="lb-sub">Ranking <span className="tmuted">· {rows.length} students</span></h3>
            <label className="lb-search">
              <span className="sr-only">Search students</span>
              <input type="search" placeholder="find a student…" value={query} onChange={(e) => setQuery(e.target.value)} />
            </label>
          </div>
          <div className="lb-scroll">
            <table className="lb-table">
              <thead><tr><th>Place</th><th>User</th><th>Institution</th><th>Score</th></tr></thead>
              <tbody>
                {shown.map((r) => {
                  const place = rows.indexOf(r) + 1
                  const me = r.id === board.me.id
                  return (
                    <tr key={r.id} className={me ? 'me' : ''}>
                      <td>{place}</td>
                      <td>{r.name}{me ? ' (you)' : ''}</td>
                      <td className="tmuted">{r.institution}</td>
                      <td>{r.score}</td>
                    </tr>
                  )
                })}
                {!shown.length && <tr><td colSpan={4} className="tmuted">No match.</td></tr>}
              </tbody>
            </table>
          </div>
        </>
      )}
    </section>
  )
}
