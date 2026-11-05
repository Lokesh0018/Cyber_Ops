import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useAdmin } from '../../hooks/useAdmin'
import { KeyIcon, ListIcon, TrophyIcon, UserIcon } from '../Icons'

/* ───────────────────────── types ───────────────────────── */
type Range = '1h' | '6h' | '24h'
interface Bucket { attempts: number; captures: number }
interface Stats {
  students: number; points: number; colleges: number; flags: number; totalPoints: number; submissions: number; captures: number
  perFlag: { id: number; title: string; points: number; attempts: number; captures: number }[]
  recent: { id: number; correct: 0 | 1; created_at: string; answer: string; student: string; flag: string }[]
  range: { key: Range; bucketSec: number; buckets: number }
  timeline: Bucket[]
  topStudents: { id: number; name: string; institution: string; score: number }[]
  byCollege: { institution: string; students: number; points: number }[]
  serverNow: number
}
type Tab = 'overview' | 'students' | 'flags' | 'submissions'

const POLL_MS = 5000
const RANGES: { key: Range; label: string }[] = [{ key: '1h', label: '1h' }, { key: '6h', label: '6h' }, { key: '24h', label: '24h' }]
// Series colours come from the console's terminal tokens; identity is also carried by the legend + line style, never colour alone.
const C_ATTEMPTS = 'var(--term-cyan)'
const C_CAPTURES = 'var(--term-green)'

const fmtAt = (iso: string) => new Date(iso).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', hour12: false })
const hhmm = (ms: number) => new Date(ms).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: false })
const num = (n: number) => n.toLocaleString('en-IN')
const reduceMotion = () => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches

/** Fill in the chart fields so a server that predates them (not restarted yet) degrades to empty charts instead of crashing. */
function normalize(d: Partial<Stats> & Pick<Stats, 'students' | 'points' | 'colleges' | 'flags' | 'totalPoints' | 'submissions' | 'captures' | 'perFlag' | 'recent'>, range: Range): Stats {
  return {
    ...d,
    range: d.range ?? { key: range, bucketSec: 0, buckets: 24 },
    timeline: d.timeline ?? Array.from({ length: 24 }, () => ({ attempts: 0, captures: 0 })),
    topStudents: d.topStudents ?? [],
    byCollege: d.byCollege ?? [],
    serverNow: d.serverNow ?? Date.now(),
  }
}

/* ───────────────────────── hooks ───────────────────────── */
/** Smoothly tweens a number toward its latest value (instant under reduced motion). */
function useCountUp(target: number, ms = 600) {
  const [v, setV] = useState(target)
  const from = useRef(target)
  useEffect(() => {
    if (reduceMotion() || from.current === target) { from.current = target; setV(target); return }
    const start = performance.now(), a = from.current
    let raf = 0
    const tick = (t: number) => {
      const p = Math.min(1, (t - start) / ms)
      const e = 1 - Math.pow(1 - p, 3)
      setV(Math.round(a + (target - a) * e))
      if (p < 1) raf = requestAnimationFrame(tick); else from.current = target
    }
    raf = requestAnimationFrame(tick)
    return () => { cancelAnimationFrame(raf); from.current = target }
  }, [target, ms])
  return v
}

/** Width of an element in real pixels, so SVG text stays a constant size. */
function useWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null)
  const [w, setW] = useState(0)
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    setW(el.clientWidth)
    const ro = new ResizeObserver(() => setW(el.clientWidth))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  return [ref, w] as const
}

/** Round a max up to a tidy axis with 4 equal steps (1/2/5 x 10^k). */
function niceAxis(max: number) {
  const raw = Math.max(1, max) / 4
  const mag = Math.pow(10, Math.floor(Math.log10(raw)))
  const step = ([1, 2, 5, 10].map((m) => m * mag).find((s) => s >= raw) ?? 10 * mag)
  return { step, top: step * 4 }
}

/* ───────────────────────── small charts ───────────────────────── */
function Sparkline({ values, color }: { values: number[]; color: string }) {
  const max = Math.max(1, ...values)
  const w = 96, h = 28
  const pts = values.map((v, i) => `${(i / Math.max(1, values.length - 1)) * w},${h - 2 - (v / max) * (h - 6)}`).join(' ')
  return (
    <svg className="ov-spark" viewBox={`0 0 ${w} ${h}`} width={w} height={h} aria-hidden="true">
      <polyline points={pts} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  )
}

/** Attempts vs captures over time. Line + soft area, 2px lines, recessive grid, crosshair tooltip on hover/touch. */
function ActivityChart({ data, bucketSec, nowMs }: { data: Bucket[]; bucketSec: number; nowMs: number }) {
  const [ref, width] = useWidth<HTMLDivElement>()
  const [hover, setHover] = useState<number | null>(null)
  const H = 230, m = { t: 14, r: 14, b: 28, l: 38 }
  const iw = Math.max(0, width - m.l - m.r), ih = H - m.t - m.b
  const { step, top } = niceAxis(Math.max(...data.map((d) => d.attempts), 0))
  const n = data.length
  const x = (i: number) => m.l + (n <= 1 ? 0 : (i / (n - 1)) * iw)
  const y = (v: number) => m.t + ih - (v / top) * ih
  const line = (k: keyof Bucket) => data.map((d, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(d[k]).toFixed(1)}`).join(' ')
  const area = (k: keyof Bucket) => `${line(k)} L${x(n - 1).toFixed(1)},${y(0)} L${x(0).toFixed(1)},${y(0)} Z`
  const tEnd = (i: number) => nowMs - (n - 1 - i) * bucketSec * 1000
  const ticks = [0, 1, 2, 3, 4].map((k) => k * step)
  const xt = [0, 6, 12, 18, 23].filter((i) => i < n)
  const total = data.reduce((a, d) => a + d.attempts, 0)

  const onMove = (e: React.PointerEvent<SVGRectElement>) => {
    const r = e.currentTarget.getBoundingClientRect()
    const rel = (e.clientX - r.left) / Math.max(1, r.width)
    setHover(Math.max(0, Math.min(n - 1, Math.round(rel * (n - 1)))))
  }
  const hv = hover != null ? data[hover] : null
  const tipLeft = hover != null ? Math.min(Math.max(x(hover), 90), Math.max(90, width - 90)) : 0

  return (
    <div className="ov-chart" ref={ref}>
      {width > 0 && (
        <svg width={width} height={H} role="img" aria-label={`Activity: ${total} attempts in the selected window, ${data.reduce((a, d) => a + d.captures, 0)} captures.`}>
          {ticks.map((t) => (
            <g key={t}>
              <line x1={m.l} x2={width - m.r} y1={y(t)} y2={y(t)} className="ov-grid" />
              <text x={m.l - 8} y={y(t) + 4} textAnchor="end" className="ov-axis">{t}</text>
            </g>
          ))}
          {xt.map((i) => (
            <text key={i} x={x(i)} y={H - 8} textAnchor={i === 0 ? 'start' : i === n - 1 ? 'end' : 'middle'} className="ov-axis">{hhmm(tEnd(i))}</text>
          ))}
          <path d={area('attempts')} fill={C_ATTEMPTS} opacity="0.10" />
          <path d={line('attempts')} fill="none" stroke={C_ATTEMPTS} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
          <path d={line('captures')} fill="none" stroke={C_CAPTURES} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" strokeDasharray="5 4" />
          {hover != null && hv && (
            <g pointerEvents="none">
              <line x1={x(hover)} x2={x(hover)} y1={m.t} y2={m.t + ih} className="ov-cross" />
              <circle cx={x(hover)} cy={y(hv.attempts)} r="4.5" fill={C_ATTEMPTS} className="ov-dot" />
              <circle cx={x(hover)} cy={y(hv.captures)} r="4.5" fill={C_CAPTURES} className="ov-dot" />
            </g>
          )}
          <rect x={m.l} y={m.t} width={iw} height={ih} fill="transparent" onPointerMove={onMove} onPointerDown={onMove} onPointerLeave={() => setHover(null)} style={{ touchAction: 'pan-y' }} />
        </svg>
      )}
      {hover != null && hv && (
        <div className="ov-tip" style={{ left: tipLeft }} role="status">
          <b>{hhmm(tEnd(hover) - bucketSec * 1000)}–{hhmm(tEnd(hover))}</b>
          <span><i style={{ background: C_ATTEMPTS }} /> attempts <em>{hv.attempts}</em></span>
          <span><i className="ov-dashed" style={{ background: C_CAPTURES }} /> captures <em>{hv.captures}</em></span>
        </div>
      )}
      <table className="sr-only">
        <caption>Attempts and captures per time bucket</caption>
        <thead><tr><th>Until</th><th>Attempts</th><th>Captures</th></tr></thead>
        <tbody>{data.map((d, i) => <tr key={i}><td>{hhmm(tEnd(i))}</td><td>{d.attempts}</td><td>{d.captures}</td></tr>)}</tbody>
      </table>
    </div>
  )
}

/** Hit-rate ring: one headline number, so a ring (not a pie) with the share in the centre. */
function HitRing({ captures, total }: { captures: number; total: number }) {
  const pct = total ? Math.round((captures / total) * 100) : 0
  const shown = useCountUp(pct)
  const R = 52, C = 2 * Math.PI * R
  return (
    <div className="ov-ring">
      <svg viewBox="0 0 140 140" width="140" height="140" role="img" aria-label={`Hit rate ${pct} percent: ${captures} correct of ${total} submissions`}>
        <circle cx="70" cy="70" r={R} fill="none" className="ov-ring-track" strokeWidth="12" />
        <circle cx="70" cy="70" r={R} fill="none" stroke={C_CAPTURES} strokeWidth="12" strokeLinecap="round" strokeDasharray={`${(pct / 100) * C} ${C}`} transform="rotate(-90 70 70)" className="ov-ring-arc" />
      </svg>
      <div className="ov-ring-mid"><b>{shown}%</b><span>hit rate</span></div>
    </div>
  )
}

/** Horizontal bar rows: thin bars, rounded data-end, label + value as text (never inside the colour). */
function BarRows({ rows, max, color = C_ATTEMPTS }: { rows: { key: string | number; label: ReactNode; value: number; valueLabel: string; sub?: string }[]; max: number; color?: string }) {
  return (
    <ul className="ov-bars">
      {rows.map((r) => (
        <li key={r.key}>
          <div className="ov-bar-top"><span className="ov-bar-lbl">{r.label}</span><span className="ov-bar-val">{r.valueLabel}</span></div>
          <span className="ov-bar" role="presentation"><i style={{ width: `${max ? Math.max(r.value > 0 ? 2 : 0, (r.value / max) * 100) : 0}%`, background: color }} /></span>
          {r.sub && <small className="ov-bar-sub">{r.sub}</small>}
        </li>
      ))}
    </ul>
  )
}

/* ───────────────────────── overview ───────────────────────── */
export function Overview({ go }: { go: (t: Tab) => void }) {
  const { api } = useAdmin()
  const [range, setRange] = useState<Range>('6h')
  const [s, setS] = useState<Stats | null>(null)
  const [err, setErr] = useState('')
  const [paused, setPaused] = useState(false)
  const [updatedAt, setUpdatedAt] = useState(0)
  const [, setTick] = useState(0)
  const [fresh, setFresh] = useState<Set<number>>(new Set())
  const lastId = useRef<number | null>(null)

  // Poll every 5s while visible and not paused; keep the last good data if a poll fails.
  useEffect(() => {
    let alive = true, timer = 0
    const load = () => {
      api<Parameters<typeof normalize>[0]>(`/stats?range=${range}`).then((raw) => {
        if (!alive) return
        const d = normalize(raw, range)
        const newest = d.recent[0]?.id ?? 0
        if (lastId.current != null && newest > lastId.current) setFresh(new Set(d.recent.filter((r) => r.id > (lastId.current as number)).map((r) => r.id)))
        lastId.current = Math.max(lastId.current ?? 0, newest)
        setS(d); setErr(''); setUpdatedAt(Date.now())
      }).catch((e: Error) => { if (alive) setErr(e.message) })
    }
    const start = () => { load(); timer = window.setInterval(load, POLL_MS) }
    const stop = () => window.clearInterval(timer)
    const onVis = () => { stop(); if (!document.hidden && !paused) start() }
    if (!document.hidden && !paused) start()
    document.addEventListener('visibilitychange', onVis)
    return () => { alive = false; stop(); document.removeEventListener('visibilitychange', onVis) }
  }, [api, range, paused])

  // re-render once a second so "updated 3s ago" stays honest
  useEffect(() => { const id = window.setInterval(() => setTick((t) => t + 1), 1000); return () => window.clearInterval(id) }, [])

  const students = useCountUp(s?.students ?? 0), flags = useCountUp(s?.flags ?? 0), subs = useCountUp(s?.submissions ?? 0), points = useCountUp(s?.points ?? 0)
  const windowAttempts = useMemo(() => s?.timeline.reduce((a, d) => a + d.attempts, 0) ?? 0, [s])

  if (!s) return err ? <p className="terr" role="alert"><b>[✗]</b> {err}</p> : <p className="tmuted"><span className="tspin" aria-hidden="true" /> loading…</p>

  const rate = s.submissions ? Math.round((s.captures / s.submissions) * 100) : 0
  const ago = Math.max(0, Math.round((Date.now() - updatedAt) / 1000))
  const live = !paused && !err
  const avg = s.students ? Math.round(s.points / s.students) : 0
  const topMax = Math.max(1, ...s.topStudents.map((t) => t.score))
  const colMax = Math.max(1, ...s.byCollege.map((c) => c.points))

  const windowCaptures = s.timeline.reduce((a, d) => a + d.captures, 0)
  const tiles: { label: string; icon: ReactNode; value: number; sub: string; to: Tab; delta?: string; spark?: number[]; sparkColor?: string }[] = [
    { label: 'students', icon: <UserIcon />, value: students, sub: `${s.colleges} ${s.colleges === 1 ? 'college' : 'colleges'}`, to: 'students' },
    { label: 'flags', icon: <KeyIcon />, value: flags, sub: `${num(s.totalPoints)} pts available`, to: 'flags' },
    { label: 'submissions', icon: <ListIcon />, value: subs, sub: `${s.captures} captures · ${rate}% hit rate`, to: 'submissions', delta: `+${windowAttempts} in ${range}`, spark: s.timeline.map((d) => d.attempts), sparkColor: C_ATTEMPTS },
    { label: 'points awarded', icon: <TrophyIcon />, value: points, sub: `avg ${num(avg)} per student`, to: 'students', delta: windowCaptures ? `+${windowCaptures} captures in ${range}` : undefined },
  ]

  return (
    <div className="ov">
      <div className="ov-bar-head">
        <p className={`ov-live${live ? ' on' : ''}`} role="status">
          <span className="ov-live-dot" aria-hidden="true" />
          {err ? <>offline · showing last data <button type="button" className="adm-btn sm" onClick={() => setPaused(false)}>retry</button></> : paused ? 'paused' : <>live · updated {ago}s ago</>}
        </p>
        <div className="ov-tools">
          <div className="ov-seg" role="group" aria-label="Time window">
            {RANGES.map((r) => <button key={r.key} type="button" aria-pressed={range === r.key} onClick={() => setRange(r.key)}>{r.label}</button>)}
          </div>
          <button type="button" className="adm-btn sm" onClick={() => setPaused((p) => !p)} aria-pressed={paused}>{paused ? 'resume' : 'pause'}</button>
        </div>
      </div>

      <section className="ov-tiles" aria-label="Headline numbers">
        {tiles.map((t) => (
          <button key={t.label} type="button" className="ov-tile" onClick={() => go(t.to)}>
            <span className="ov-tile-head"><span className="ov-tile-ico" aria-hidden="true">{t.icon}</span><small>{t.label}</small></span>
            <b>{num(t.value)}</b>
            <span className="ov-tile-sub">{t.sub}</span>
            {t.delta && <span className="ov-delta">{t.delta}</span>}
            {t.spark && <Sparkline values={t.spark} color={t.sparkColor ?? C_ATTEMPTS} />}
          </button>
        ))}
      </section>

      <div className="dash-grid ov-grid2">
        <section className="dcard ov-s-act" aria-labelledby="ov-act">
          <div className="dcard-head">
            <h2 id="ov-act" className="dcard-h"><span className="tp-dollar">$</span> ./activity --last {range}</h2>
            <ul className="ov-legend" aria-label="Legend">
              <li><i style={{ background: C_ATTEMPTS }} /> attempts <b>{windowAttempts}</b></li>
              <li><i className="ov-dashed" style={{ background: C_CAPTURES }} /> captures <b>{windowCaptures}</b></li>
            </ul>
          </div>
          {windowAttempts === 0 && <p className="tmuted ov-empty">No submissions in this window yet. The chart updates live as students submit.</p>}
          <ActivityChart data={s.timeline} bucketSec={s.range.bucketSec} nowMs={updatedAt || s.serverNow} />
        </section>

        <section className="dcard" aria-labelledby="ov-hit">
          <h2 id="ov-hit" className="dcard-h"><span className="tp-dollar">$</span> ./hit-rate</h2>
          <div className="ov-hit">
            <HitRing captures={s.captures} total={s.submissions} />
            <ul className="ov-kv">
              <li><span><i style={{ background: C_CAPTURES }} /> correct</span><b>{num(s.captures)}</b></li>
              <li><span><i style={{ background: 'var(--term-red)' }} /> wrong</span><b>{num(s.submissions - s.captures)}</b></li>
              <li><span>total</span><b>{num(s.submissions)}</b></li>
            </ul>
          </div>
        </section>

        <section className="dcard" aria-labelledby="ov-top">
          <div className="dcard-head">
            <h2 id="ov-top" className="dcard-h"><span className="tp-dollar">$</span> ./leaderboard --top 5</h2>
            <button type="button" className="adm-btn sm" onClick={() => go('students')}>all</button>
          </div>
          {s.topStudents.length === 0 ? <p className="tmuted">No scores yet.</p> : (
            <BarRows max={topMax} color={C_CAPTURES} rows={s.topStudents.map((t, i) => ({ key: t.id, label: <><span className="ov-rank">{i + 1}</span>{t.name}</>, value: t.score, valueLabel: `${num(t.score)} pts`, sub: t.institution }))} />
          )}
        </section>

        <section className="dcard" aria-labelledby="a-pf">
          <h2 id="a-pf" className="dcard-h"><span className="tp-dollar">$</span> ./flags --solve-rate</h2>
          {s.perFlag.length === 0 && <p className="tmuted">No flags yet.</p>}
          <BarRows max={100} rows={s.perFlag.map((f) => {
            const pct = s.students ? Math.round((f.captures / s.students) * 100) : 0
            return { key: f.id, label: <b>{f.title}</b>, value: pct, valueLabel: `${pct}%`, sub: `${f.points} pts · ${f.captures}/${s.students} solved · ${f.attempts} tries` }
          })} />
        </section>

        <section className="dcard" aria-labelledby="ov-col">
          <h2 id="ov-col" className="dcard-h"><span className="tp-dollar">$</span> ./colleges --points</h2>
          {s.byCollege.length === 0 ? <p className="tmuted">No colleges yet.</p> : (
            <BarRows max={colMax} rows={s.byCollege.map((c) => ({ key: c.institution, label: <b>{c.institution || '—'}</b>, value: c.points, valueLabel: `${num(c.points)} pts`, sub: `${c.students} ${c.students === 1 ? 'student' : 'students'}` }))} />
          )}
        </section>

        <section className="dcard ov-s-feed" aria-labelledby="a-rec">
          <h2 id="a-rec" className="dcard-h"><span className="tp-dollar">$</span> tail -f submissions.log</h2>
          {s.recent.length === 0 && <p className="tmuted">Nothing submitted yet.</p>}
          <ol className="mlog-list adm-recent">
            {s.recent.map((r) => (
              <li key={r.id} className={`mlog-row k-${r.correct ? 'capture' : 'miss'}${fresh.has(r.id) ? ' ov-new' : ''}`}>
                <span className="mlog-time">{fmtAt(r.created_at)}</span>
                <span className="mlog-tag" aria-hidden="true">{r.correct ? '[✓]' : '[✗]'}</span>
                <span className="mlog-msg"><b>{r.student}</b> → {r.flag} {r.correct ? <span className="mlog-pts">captured</span> : <code className="adm-ans">{r.answer}</code>}</span>
              </li>
            ))}
          </ol>
        </section>
      </div>
    </div>
  )
}
