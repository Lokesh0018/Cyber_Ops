import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { useAdmin } from '../../hooks/useAdmin'
import { CloseIcon } from '../Icons'
import { useWidth } from './AdminOverview'

export interface DetailStudent { id: string; fullName: string; email: string; phone: string; institution: string; branch: string; rollNumber: string; score: number; createdAt: string; solved: number; attempts: number }
interface FlagRow { id: number; title: string; points: number; level: 'easy' | 'medium' | 'hard'; frozen: boolean; attempts: number; solved: boolean; solvedAt: string | null; firstAt: string | null; lastAt: string | null }
interface Sub { id: number; answer: string; correct: 0 | 1; created_at: string; flag_id: number; flag: string; points: number }
interface Ev { id: number; points: number; note: string; created_at: string }
interface Detail { student: DetailStudent; rank: number; total: number; maxAttempts: number; flags: FlagRow[]; submissions: Sub[]; events: Ev[] }

/**
 * Renders overlays (drawer, modals) at the dashboard root instead of inside the card that opened them.
 * Inside a card, `position: fixed` can be anchored to the card (an ancestor with an animation/transform becomes its containing block),
 * so the overlay would size and position itself to the card, which changes with the number of rows. The root is `.dash`, not <body>,
 * because the theme's --term-* colour variables are defined on `.dash`.
 */
export function Overlay({ children }: { children: ReactNode }) {
  return createPortal(children, document.querySelector('.dash') ?? document.body)
}

const fmt = (iso: string) => new Date(iso).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', hour12: false })
const num = (n: number) => n.toLocaleString('en-IN')

/** Compact cumulative-score step chart for one student (events oldest to newest). The event list below is its table alternative. */
function ScoreTrail({ events }: { events: Ev[] }) {
  const [ref, width] = useWidth<HTMLDivElement>()
  const pts = useMemo(() => {
    let run = 0
    return [...events].reverse().map((e) => ({ t: new Date(e.created_at).getTime(), score: (run += e.points) }))
  }, [events])
  if (pts.length === 0) return <p className="tmuted sd-none">No points awarded yet.</p>
  const H = 110, m = { t: 12, r: 10, b: 20, l: 10 }
  const tMin = pts[0].t, tMax = Math.max(Date.now(), pts[pts.length - 1].t)
  const hi = Math.max(1, ...pts.map((p) => p.score)), lo = Math.min(0, ...pts.map((p) => p.score))
  const iw = Math.max(0, width - m.l - m.r), ih = H - m.t - m.b
  const x = (t: number) => m.l + ((t - tMin) / Math.max(1, tMax - tMin)) * iw
  const y = (v: number) => m.t + ih - ((v - lo) / Math.max(1, hi - lo)) * ih
  let d = `M${x(tMin).toFixed(1)},${y(0).toFixed(1)}`
  for (const p of pts) d += ` H${x(p.t).toFixed(1)} V${y(p.score).toFixed(1)}`
  d += ` H${x(tMax).toFixed(1)}`
  const last = pts[pts.length - 1]
  return (
    <div ref={ref} className="sd-trail">
      {width > 0 && (
        <svg width={width} height={H} role="img" aria-label={`Score over time, ending at ${num(last.score)} points`}>
          <line x1={m.l} x2={width - m.r} y1={y(0)} y2={y(0)} className="ov-grid" />
          <path d={`${d} V${y(0)} H${x(tMin)} Z`} fill="var(--term-cyan)" opacity="0.1" />
          <path d={d} fill="none" stroke="var(--term-cyan)" strokeWidth="2" strokeLinejoin="round" />
          <circle cx={x(tMax)} cy={y(last.score)} r="4" fill="var(--term-cyan)" className="ov-dot" />
          <text x={m.l} y={H - 5} className="ov-axis">{fmt(new Date(tMin).toISOString())}</text>
          <text x={width - m.r} y={H - 5} textAnchor="end" className="ov-axis">now · {num(last.score)} pts</text>
        </svg>
      )}
    </div>
  )
}

/** Right-hand drawer with everything about one student: profile, per-flag progress, every submitted answer and every score event. */
export function StudentDetail({ id, version, onClose, onAward, onEdit, onChanged }: {
  id: string; version: number; onClose: () => void; onAward: (s: DetailStudent) => void; onEdit: (s: DetailStudent) => void; onChanged: () => void
}) {
  const { api } = useAdmin()
  const [d, setD] = useState<Detail | null>(null)
  const [err, setErr] = useState('')
  const [filter, setFilter] = useState<'all' | 'correct' | 'wrong'>('all')
  const closeRef = useRef<HTMLButtonElement>(null)
  const [rm, setRm] = useState<Sub | null>(null) // submission pending removal (confirm dialog open)
  const [refund, setRefund] = useState(true)
  const [rmBusy, setRmBusy] = useState(false)
  const [rmErr, setRmErr] = useState('')
  const [notice, setNotice] = useState('')
  const [tick, setTick] = useState(0) // bumps after a removal so the drawer refetches

  useEffect(() => {
    let alive = true
    api<Detail>(`/students/${encodeURIComponent(id)}/detail`)
      .then((r) => { if (alive) { setD(r); setErr('') } })
      .catch((e: Error) => { if (alive) setErr(e.message) })
    return () => { alive = false }
  }, [api, id, version, tick])

  // modal behaviour: focus the close button, close on Escape, lock page scroll, give focus back to whatever opened the drawer
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose // keep the latest callback without re-running the effect below on every parent render
  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null
    closeRef.current?.focus()
    const onKey = (e: KeyboardEvent) => {
      // let an open modal (award / edit) handle its own Escape first
      if (e.key === 'Escape' && !document.querySelector('.adm-backdrop')) onCloseRef.current()
    }
    document.addEventListener('keydown', onKey)
    const prev = document.documentElement.style.overflow
    document.documentElement.style.overflow = 'hidden'
    return () => { document.removeEventListener('keydown', onKey); document.documentElement.style.overflow = prev; opener?.focus?.({ preventScroll: true }) }
  }, [])

  const doRemove = async () => {
    if (!rm || rmBusy) return
    setRmBusy(true); setRmErr('')
    try {
      const r = await api<{ refunded: number }>(`/submissions/${rm.id}${rm.correct && refund ? '?refund=1' : ''}`, { method: 'DELETE' })
      setNotice(`Removed the ${rm.correct ? 'correct' : 'wrong'} submission for ${rm.flag}${r.refunded ? ` and took back ${num(r.refunded)} points` : ''}.`)
      setRm(null); setTick((t) => t + 1); onChanged()
    } catch (e) { setRmErr((e as Error).message) } finally { setRmBusy(false) }
  }

  // per-flag attempt history (oldest first) for the attempt dots, and each submission's "attempt n of max"
  const { dots, attemptNo } = useMemo(() => {
    const byFlag = new Map<number, Sub[]>()
    const no = new Map<number, number>()
    for (const s of d ? [...d.submissions].reverse() : []) {
      const list = byFlag.get(s.flag_id) ?? []
      list.push(s); byFlag.set(s.flag_id, list); no.set(s.id, list.length)
    }
    return { dots: byFlag, attemptNo: no }
  }, [d])

  const s = d?.student
  const shownSubs = d ? d.submissions.filter((x) => filter === 'all' || (filter === 'correct') === !!x.correct) : []
  const wrong = d ? d.submissions.filter((x) => !x.correct).length : 0
  const right = d ? d.submissions.length - wrong : 0
  const balance = useMemo(() => {
    const m = new Map<number, number>()
    let run = 0
    for (const e of d ? [...d.events].reverse() : []) { run += e.points; m.set(e.id, run) }
    return m
  }, [d])

  return (
    <Overlay>
    <div className="sd-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <aside className="sd" role="dialog" aria-modal="true" aria-labelledby="sd-title">
        <header className="sd-head">
          <span className="st-avatar sd-avatar" aria-hidden="true">{(s?.fullName ?? id).trim().charAt(0).toUpperCase()}</span>
          <div className="sd-who">
            <h2 id="sd-title">{s?.fullName ?? 'Student'}</h2>
            <p className="tmuted">{s ? <>{s.email} · {s.phone}</> : id}</p>
            {s && <p className="sd-meta"><span>{s.institution}</span><span className="st-pill">{s.branch}</span><code>{s.rollNumber}</code></p>}
          </div>
          <button ref={closeRef} type="button" className="adm-icon" onClick={onClose} aria-label="Close student details"><CloseIcon /></button>
        </header>

        {notice && <p className="sd-notice" role="status"><b>[✓]</b> {notice}<button type="button" className="sd-notice-x" onClick={() => setNotice('')} aria-label="Dismiss message"><CloseIcon /></button></p>}
        {err && <p className="terr" role="alert"><b>[✗]</b> {err}</p>}
        {!d && !err && <p className="tmuted sd-pad"><span className="tspin" aria-hidden="true" /> loading…</p>}

        {d && s && (
          <div className="sd-body">
            <div className="sd-actions">
              <button type="button" className="adm-btn sm" onClick={() => onAward(s)}>± adjust points</button>
              <button type="button" className="adm-btn sm" onClick={() => onEdit(s)}>edit profile</button>
            </div>

            <ul className="sd-kpis" aria-label="Summary">
              <li><small>score</small><b>{num(s.score)}</b></li>
              <li><small>rank</small><b>#{d.rank}</b><span>of {d.total}</span></li>
              <li><small>flags</small><b>{s.solved}</b><span>of {d.flags.length}</span></li>
              <li><small>hit rate</small><b>{d.submissions.length ? Math.round((right / d.submissions.length) * 100) : 0}%</b><span>{right} ok · {wrong} wrong</span></li>
            </ul>

            <section aria-labelledby="sd-h-trail">
              <h3 id="sd-h-trail" className="sd-h">Score over time</h3>
              <ScoreTrail events={d.events} />
            </section>

            <section aria-labelledby="sd-h-flags">
              <h3 id="sd-h-flags" className="sd-h">Flags <span className="tmuted">· {d.maxAttempts} attempts each</span></h3>
              <ul className="sd-flags">
                {d.flags.map((f) => {
                  const list = dots.get(f.id) ?? []
                  const locked = !f.solved && f.attempts >= d.maxAttempts
                  const state = f.solved ? 'solved' : locked ? 'locked' : f.attempts ? 'trying' : 'none'
                  return (
                    <li key={f.id} className={`sd-flag s-${state}`}>
                      <div className="sd-flag-top">
                        <b>{f.title}</b>
                        <span className={`adm-lvl t-${f.level}`}>{f.level}</span>
                        <span className="tmuted sd-pts">{num(f.points)} pts</span>
                        <span className={`sd-chip s-${state}`}>
                          {state === 'solved' ? '[✓] solved' : state === 'locked' ? '[✗] out of attempts' : state === 'trying' ? `[…] trying ${f.attempts}/${d.maxAttempts}` : '[ ] not tried'}
                        </span>
                      </div>
                      <div className="sd-flag-sub">
                        <span className="sd-dots" role="img" aria-label={list.length ? list.map((x, i) => `attempt ${i + 1} ${x.correct ? 'correct' : 'wrong'}`).join(', ') : 'no attempts'}>
                          {Array.from({ length: d.maxAttempts }, (_, i) => {
                            const x = list[i]
                            return <i key={i} className={x ? (x.correct ? 'ok' : 'bad') : ''} />
                          })}
                        </span>
                        <span className="tmuted adm-small">
                          {f.solved && f.solvedAt ? `solved ${fmt(f.solvedAt)}` : f.lastAt ? `last try ${fmt(f.lastAt)}` : 'no attempts yet'}
                        </span>
                      </div>
                    </li>
                  )
                })}
              </ul>
            </section>

            <section aria-labelledby="sd-h-subs">
              <div className="sd-h-row">
                <h3 id="sd-h-subs" className="sd-h">Submissions <span className="tmuted">· {d.submissions.length}</span></h3>
                <div className="st-chips sd-filter" role="group" aria-label="Filter submissions">
                  {(['all', 'correct', 'wrong'] as const).map((k) => (
                    <button key={k} type="button" aria-pressed={filter === k} onClick={() => setFilter(k)}>{k} <i>{k === 'all' ? d.submissions.length : k === 'correct' ? right : wrong}</i></button>
                  ))}
                </div>
              </div>
              {shownSubs.length === 0 ? <p className="tmuted sd-none">{d.submissions.length ? 'Nothing in this filter.' : 'No submissions yet.'}</p> : (
                <ol className="sd-subs">
                  {shownSubs.map((x) => (
                    <li key={x.id} className={x.correct ? 'ok' : 'bad'}>
                      <div className="sd-sub-top">
                        <span className="sd-sub-res">{x.correct ? '[✓] correct' : '[✗] wrong'}</span>
                        <b>{x.flag}</b>
                        <span className="tmuted adm-small">attempt {attemptNo.get(x.id)}/{d.maxAttempts}</span>
                        {x.correct ? <span className="sd-sub-pts">+{num(x.points)}</span> : null}
                        <time className="tmuted adm-small" dateTime={x.created_at}>{fmt(x.created_at)}</time>
                        <button type="button" className="adm-btn sm danger sd-rm" onClick={() => { setRmErr(''); setRefund(true); setRm(x) }} aria-label={`Remove this ${x.correct ? 'correct' : 'wrong'} submission for ${x.flag}`}>remove</button>
                      </div>
                      <code className="sd-answer">{x.answer}</code>
                    </li>
                  ))}
                </ol>
              )}
            </section>

            <section aria-labelledby="sd-h-ev">
              <h3 id="sd-h-ev" className="sd-h">Score history <span className="tmuted">· {d.events.length} events</span></h3>
              {d.events.length === 0 ? <p className="tmuted sd-none">No points awarded yet.</p> : (
                <ol className="sd-events">
                  {d.events.map((e) => (
                    <li key={e.id}>
                      <b className={e.points >= 0 ? 'pos' : 'neg'}>{e.points >= 0 ? '+' : '−'}{num(Math.abs(e.points))}</b>
                      <span className="sd-ev-note">{e.note || 'points'}</span>
                      <span className="tmuted adm-small">→ {num(balance.get(e.id) ?? 0)}</span>
                      <time className="tmuted adm-small" dateTime={e.created_at}>{fmt(e.created_at)}</time>
                    </li>
                  ))}
                </ol>
              )}
            </section>
          </div>
        )}
      </aside>
    </div>
    {rm && (
      <div className="adm-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget && !rmBusy) setRm(null) }} onKeyDown={(e) => { if (e.key === 'Escape' && !rmBusy) setRm(null) }}>
        <div className="adm-modal sd-confirm" role="alertdialog" aria-modal="true" aria-labelledby="sd-rm-h" aria-describedby="sd-rm-d">
          <div className="adm-modal-head">
            <h2 id="sd-rm-h" className="dcard-h"><span className="tp-dollar">$</span> submissions --remove</h2>
            <button type="button" className="adm-icon" onClick={() => setRm(null)} disabled={rmBusy} aria-label="Cancel"><CloseIcon /></button>
          </div>
          <div id="sd-rm-d">
            <p className="adm-confirm">Remove this {rm.correct ? 'correct' : 'wrong'} submission for {rm.flag}?</p>
            <code className="sd-answer">{rm.answer}</code>
            <p className="tmuted adm-confirm-sub">
              {rm.correct
                ? `The flag shows as unsolved again for ${s?.fullName ?? 'the student'}, and they get the attempt back.`
                : `${s?.fullName ?? 'The student'} gets this attempt back on ${rm.flag}.`}
            </p>
            {rm.correct ? (
              <label className="sd-check">
                <input type="checkbox" checked={refund} onChange={(e) => setRefund(e.target.checked)} />
                <span>Also take back the points this capture awarded ({num(rm.points)}). Leave this ticked unless you plan to adjust the score yourself, otherwise they could earn the flag a second time.</span>
              </label>
            ) : null}
            {rmErr && <p className="terr" role="alert"><b>[✗]</b> {rmErr}</p>}
          </div>
          <div className="adm-actions">
            <button type="button" className="adm-btn" onClick={() => setRm(null)} disabled={rmBusy} autoFocus>cancel</button>
            <button type="button" className="adm-btn danger" onClick={doRemove} disabled={rmBusy} aria-busy={rmBusy}>{rmBusy ? 'removing…' : 'yes, remove'}</button>
          </div>
        </div>
      </div>
    )}
    </Overlay>
  )
}
