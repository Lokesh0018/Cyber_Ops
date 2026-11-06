import { useMemo, useState } from 'react'
import { niceAxis, useWidth } from './AdminOverview'

export interface RaceSeries { id: string; name: string; institution: string; score: number; points: { t: string; score: number }[] }

// Categorical slots 1-6 of the reference palette, dark-mode column, in fixed order (validated for adjacent pairs on lines).
// Identity is never colour-alone: every line also has a legend entry and a direct label at its end.
const COLORS = ['#3987e5', '#d95926', '#199e70', '#c98500', '#d55181', '#008300']
const num = (n: number) => n.toLocaleString('en-IN')
const firstName = (n: string) => n.trim().split(/\s+/)[0] ?? n

/** Score race: cumulative score of the top students over time (step lines, since score only changes at an award). */
export function ScoreRace({ series }: { series: RaceSeries[] }) {
  const [ref, width] = useWidth<HTMLDivElement>()
  const [hoverT, setHoverT] = useState<number | null>(null)
  const [focus, setFocus] = useState<string | null>(null)

  const data = useMemo(() => {
    const s = series.map((r, i) => ({ ...r, color: COLORS[i % COLORS.length], pts: r.points.map((p) => ({ t: new Date(p.t).getTime(), score: p.score })) }))
    const stamps = s.flatMap((r) => r.pts.map((p) => p.t))
    if (!stamps.length) return null
    const tMin = Math.min(...stamps)
    const tMax = Math.max(Date.now(), ...stamps)
    const max = Math.max(1, ...s.map((r) => r.pts[r.pts.length - 1]?.score ?? 0))
    return { s, tMin, tMax, ...niceAxis(max) }
  }, [series])

  if (!data) return <p className="tmuted st-viz-empty">No score activity yet. The race appears as students earn points.</p>

  const H = 300, wide = width > 560
  const m = { t: 14, r: wide ? 128 : 14, b: 28, l: 46 }
  const iw = Math.max(0, width - m.l - m.r), ih = H - m.t - m.b
  const x = (t: number) => m.l + ((t - data.tMin) / Math.max(1, data.tMax - data.tMin)) * iw
  const y = (v: number) => m.t + ih - (v / data.top) * ih
  const scoreAt = (pts: { t: number; score: number }[], t: number) => pts.reduce((v, p) => (p.t <= t ? p.score : v), 0)
  const path = (pts: { t: number; score: number }[]) => {
    let d = `M${x(data.tMin).toFixed(1)},${y(0).toFixed(1)}`
    for (const p of pts) d += ` H${x(p.t).toFixed(1)} V${y(p.score).toFixed(1)}` // hold the old score until the award, then step
    return d + ` H${x(data.tMax).toFixed(1)}` // extend to "now"
  }
  const spanDays = (data.tMax - data.tMin) / 86400000
  const fmtT = (t: number) => (spanDays > 1.5
    ? new Date(t).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })
    : new Date(t).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: false }))
  const xt = [0, 0.25, 0.5, 0.75, 1].map((f) => data.tMin + f * (data.tMax - data.tMin))
  const yt = [0, 1, 2, 3, 4].map((k) => k * data.step)

  // direct labels at the right edge, nudged apart so they never overlap
  const ends = data.s.map((r) => ({ r, y: y(r.pts[r.pts.length - 1]?.score ?? 0) })).sort((a, b) => a.y - b.y)
  for (let i = 1; i < ends.length; i++) if (ends[i].y - ends[i - 1].y < 14) ends[i].y = ends[i - 1].y + 14

  const onMove = (e: React.PointerEvent<SVGRectElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    const f = Math.max(0, Math.min(1, (e.clientX - rect.left) / Math.max(1, rect.width)))
    setHoverT(data.tMin + f * (data.tMax - data.tMin))
  }
  const tip = hoverT == null ? null : data.s.map((r) => ({ r, v: scoreAt(r.pts, hoverT) })).sort((a, b) => b.v - a.v)
  const tipLeft = hoverT == null ? 0 : Math.min(Math.max(x(hoverT), 100), Math.max(100, width - 100))
  const op = (id: string) => (focus && focus !== id ? 0.18 : 1)

  return (
    <div className="st-race">
      <ul className="st-legend" aria-label="Students (click to focus one)">
        {data.s.map((r) => (
          <li key={r.id}>
            <button type="button" aria-pressed={focus === r.id} onClick={() => setFocus((f) => (f === r.id ? null : r.id))}>
              <i style={{ background: r.color }} aria-hidden="true" />{firstName(r.name)} <b>{num(r.score)}</b>
            </button>
          </li>
        ))}
      </ul>
      <div className="ov-chart" ref={ref}>
        {width > 0 && (
          <svg width={width} height={H} role="img" aria-label={`Score over time for the top ${data.s.length} students. Leader: ${data.s[0].name} with ${num(data.s[0].score)} points.`}>
            {yt.map((t) => (
              <g key={t}>
                <line x1={m.l} x2={width - m.r} y1={y(t)} y2={y(t)} className="ov-grid" />
                <text x={m.l - 8} y={y(t) + 4} textAnchor="end" className="ov-axis">{num(t)}</text>
              </g>
            ))}
            {xt.map((t, i) => (
              <text key={i} x={x(t)} y={H - 8} textAnchor={i === 0 ? 'start' : i === xt.length - 1 ? 'end' : 'middle'} className="ov-axis">{fmtT(t)}</text>
            ))}
            {data.s.map((r) => (
              <path key={r.id} d={path(r.pts)} fill="none" stroke={r.color} strokeWidth={focus === r.id ? 3 : 2} strokeLinejoin="round" opacity={op(r.id)} style={{ transition: 'opacity .2s ease' }} />
            ))}
            {wide && ends.map(({ r, y: ey }) => (
              <g key={r.id} opacity={op(r.id)} pointerEvents="none">
                <line x1={width - m.r + 6} x2={width - m.r + 16} y1={ey} y2={ey} stroke={r.color} strokeWidth="2" />
                <text x={width - m.r + 22} y={ey + 4} className="ov-axis st-endlbl">{firstName(r.name).slice(0, 10)} {num(r.pts[r.pts.length - 1]?.score ?? 0)}</text>
              </g>
            ))}
            {hoverT != null && tip && (
              <g pointerEvents="none">
                <line x1={x(hoverT)} x2={x(hoverT)} y1={m.t} y2={m.t + ih} className="ov-cross" />
                {tip.map(({ r, v }) => <circle key={r.id} cx={x(hoverT)} cy={y(v)} r="4" fill={r.color} className="ov-dot" opacity={op(r.id)} />)}
              </g>
            )}
            <rect x={m.l} y={m.t} width={iw} height={ih} fill="transparent" onPointerMove={onMove} onPointerDown={onMove} onPointerLeave={() => setHoverT(null)} style={{ touchAction: 'pan-y' }} />
          </svg>
        )}
        {hoverT != null && tip && (
          <div className="ov-tip st-tip" style={{ left: tipLeft }} role="status">
            <b>{new Date(hoverT).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', hour12: false })}</b>
            {tip.map(({ r, v }) => <span key={r.id}><i style={{ background: r.color }} /> {firstName(r.name)} <em>{num(v)}</em></span>)}
          </div>
        )}
        <table className="sr-only">
          <caption>Current score of the top students</caption>
          <thead><tr><th>Student</th><th>College</th><th>Score</th></tr></thead>
          <tbody>{data.s.map((r) => <tr key={r.id}><td>{r.name}</td><td>{r.institution}</td><td>{r.score}</td></tr>)}</tbody>
        </table>
      </div>
    </div>
  )
}

/** Score distribution: how many students sit in each score band. One series, so one colour; counts printed on the bars. */
export function ScoreHistogram({ scores }: { scores: number[] }) {
  const [ref, width] = useWidth<HTMLDivElement>()
  const [hover, setHover] = useState<number | null>(null)
  const BINS = 5
  const size = Math.max(50, Math.ceil(Math.max(1, ...scores) / BINS / 50) * 50) // band width, rounded up to a multiple of 50
  const bins = Array.from({ length: BINS }, (_, i) => ({ lo: i * size, hi: (i + 1) * size, n: 0 }))
  for (const s of scores) bins[Math.min(BINS - 1, Math.floor(Math.max(0, s) / size))].n++
  const maxN = Math.max(1, ...bins.map((b) => b.n))
  const H = 220, m = { t: 22, r: 8, b: 30, l: 8 }
  const iw = Math.max(0, width - m.l - m.r), ih = H - m.t - m.b
  const bw = iw / BINS

  return (
    <div className="ov-chart" ref={ref}>
      {width > 0 && (
        <svg width={width} height={H} role="img" aria-label={`Score distribution: ${bins.map((b) => `${b.n} students at ${b.lo} to ${b.hi}`).join('; ')}`}>
          <line x1={m.l} x2={width - m.r} y1={m.t + ih} y2={m.t + ih} className="ov-grid" />
          {bins.map((b, i) => {
            const h = (b.n / maxN) * ih
            const bx = m.l + i * bw + 3
            return (
              <g key={i} onPointerEnter={() => setHover(i)} onPointerLeave={() => setHover(null)} opacity={hover == null || hover === i ? 1 : 0.5}>
                <rect x={m.l + i * bw} y={m.t} width={bw} height={ih} fill="transparent" />
                {b.n > 0 && <path d={`M${bx},${m.t + ih} V${m.t + ih - h + 4} Q${bx},${m.t + ih - h} ${bx + 4},${m.t + ih - h} H${bx + bw - 10} Q${bx + bw - 6},${m.t + ih - h} ${bx + bw - 6},${m.t + ih - h + 4} V${m.t + ih} Z`} fill="var(--term-cyan)" />}
                {b.n > 0 && <text x={bx + (bw - 6) / 2} y={m.t + ih - h - 6} textAnchor="middle" className="ov-axis st-barlbl">{b.n}</text>}
                <text x={bx + (bw - 6) / 2} y={H - 10} textAnchor="middle" className="ov-axis">{num(b.lo)}–{num(b.hi)}</text>
              </g>
            )
          })}
        </svg>
      )}
      <table className="sr-only">
        <caption>Students per score band</caption>
        <thead><tr><th>Score band</th><th>Students</th></tr></thead>
        <tbody>{bins.map((b, i) => <tr key={i}><td>{b.lo}–{b.hi}</td><td>{b.n}</td></tr>)}</tbody>
      </table>
    </div>
  )
}
