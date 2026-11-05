import { useEffect, useRef, useState, type CSSProperties, type FormEvent } from 'react'
import { useAuth } from '../hooks/useAuth'
import { ArrowRightIcon } from './Icons'

interface Flag { id: number; title: string; points: number; level: Tier; frozen: boolean; question_url: string; attempts: number; solved: boolean; lastAt: string | null }
interface Board { maxAttempts: number; flags: Flag[] }
interface Result { kind: 'ok' | 'error'; text: string }

/** Fired after a correct submission so the scoreboard re-fetches. */
export const SCORE_EVENT = 'cyberops:score'

/** Level is set by the organisers per flag; flags are grouped into levels by it. */
type Tier = 'easy' | 'medium' | 'hard'
const tier = (f: Flag): Tier => f.level ?? 'easy'
const LEVELS: { key: Tier; n: number; label: string }[] = [
  { key: 'easy', n: 1, label: 'recon' },
  { key: 'medium', n: 2, label: 'exploit' },
  { key: 'hard', n: 3, label: 'privesc' },
]
const fmtTime = (iso: string) => new Date(iso).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: false })

/**
 * CTF flag submission as a terminal table: one row per flag with aligned columns
 * (number · title · points · attempts · prompt input · submit · question link). The server enforces
 * the attempt limit and checks the hashed answer; the UI mirrors its counts.
 */
export function FlagBoard() {
  const { session } = useAuth()
  const [board, setBoard] = useState<Board | null>(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState<number | null>(null)
  const [results, setResults] = useState<Record<number, Result>>({})
  const [folded, setFolded] = useState<Record<string, boolean>>({})
  const [shake, setShake] = useState<number | null>(null)
  const [drafts, setDrafts] = useState<Record<number, string>>({})
  const userFolded = useRef<Set<string>>(new Set())

  const load = () => {
    if (!session) return
    fetch('/api/flags', { headers: { Authorization: `Bearer ${session.token}` } })
      .then(async (r) => { if (!r.ok) throw new Error('Flags unavailable right now.'); return (await r.json()) as Board })
      .then(setBoard)
      .catch((e: Error) => setError(e.message))
  }
  useEffect(load, [session]) // eslint-disable-line react-hooks/exhaustive-deps

  const submit = async (e: FormEvent<HTMLFormElement>, flag: Flag) => {
    e.preventDefault()
    if (!session || busy !== null) return
    const form = e.currentTarget
    const answer = String(new FormData(form).get('answer') ?? '')
    setBusy(flag.id)
    try {
      const r = await fetch(`/api/flags/${flag.id}/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.token}` },
        body: JSON.stringify({ answer }),
      })
      const data = (await r.json().catch(() => ({}))) as { message?: string; correct?: boolean; attempts?: number }
      if (!r.ok && r.status !== 429 && r.status !== 409) throw new Error(data.message ?? 'Submission failed.')
      setResults((m) => ({ ...m, [flag.id]: { kind: data.correct ? 'ok' : 'error', text: data.message ?? '' } }))
      if (data.correct) {
        form.reset()
        window.dispatchEvent(new Event(SCORE_EVENT))
      }
      load() // refresh attempts/solved from the server (the source of truth)
      if (!data.correct) {
        setShake(flag.id)
        window.setTimeout(() => setShake(null), 500)
        window.setTimeout(() => (form.elements.namedItem('answer') as HTMLInputElement | null)?.select(), 0)
      }
    } catch (err) {
      setResults((m) => ({ ...m, [flag.id]: { kind: 'error', text: (err as Error).message } }))
    } finally {
      setBusy(null)
    }
  }

  /** Auto-fold a level once it is fully captured, unless the user has toggled it by hand. */
  useEffect(() => {
    if (!board) return
    const next: Record<string, boolean> = {}
    for (const lv of LEVELS) {
      const g = board.flags.filter((f) => tier(f) === lv.key)
      if (g.length && g.every((f) => f.solved) && !userFolded.current.has(lv.key)) next[lv.key] = true
    }
    setFolded((m) => ({ ...m, ...next }))
  }, [board])

  const toggle = (key: string) => {
    userFolded.current.add(key)
    setFolded((m) => ({ ...m, [key]: !m[key] }))
  }


  const flags = board?.flags ?? []
  const solved = flags.filter((f) => f.solved)
  const earned = solved.reduce((a, f) => a + f.points, 0)
  const total = flags.reduce((a, f) => a + f.points, 0)

  return (
    <section className="dcard dcard-wide fb" aria-labelledby="d-flags">
      <div className="dcard-head">
        <h2 id="d-flags" className="dcard-h"><span className="tp-dollar">$</span> ./submit-flag --list</h2>
        {board && (
          <p className="fb-sum">
            <span className="tmuted">captured</span> <b>{solved.length}</b><span className="tmuted">/{flags.length}</span>
            <span className="lb-sep" aria-hidden="true">·</span>
            <span className="tmuted">points</span> <b>{earned}</b><span className="tmuted">/{total}</span>
            <span className="lb-sep" aria-hidden="true">·</span>
            <span className="tmuted">{board.maxAttempts} attempts per flag</span>
          </p>
        )}
      </div>

      {board && flags.length > 0 && (
        <div className="fb-total">
          <span className="fb-totalbar" role="progressbar" aria-valuemin={0} aria-valuemax={total} aria-valuenow={earned} aria-label="Overall points captured">
            <i style={{ width: `${total ? (earned / total) * 100 : 0}%` }} />
          </span>
          <span className="fb-totaltxt">
            {solved.length === flags.length
              ? <><b className="ok">[✓] all flags captured</b> <span className="tmuted">— nothing left to pwn. GG.</span></>
              : (() => {
                  const nxt = flags.find((f) => !f.solved && !f.frozen && f.attempts < board.maxAttempts)
                  return nxt
                    ? <><span className="tmuted">next target</span> <a className="fb-next" href={`#flag-${nxt.id}`}>{nxt.title}</a> <span className="tmuted">· +{nxt.points} pts</span></>
                    : <span className="tmuted">no open flags — all remaining flags are locked</span>
                })()}
          </span>
        </div>
      )}

      {error && <p className="terr" role="alert"><b>[✗]</b> {error}</p>}
      {!board && !error && <p className="tmuted"><span className="tspin" aria-hidden="true" /> loading flags…</p>}

      {board && (
        <ol className="fb-ov" aria-label="Level overview">
          {LEVELS.map((lv) => {
            const g = flags.filter((f) => tier(f) === lv.key)
            if (!g.length) return null
            const done = g.filter((f) => f.solved).length
            const pts = g.filter((f) => f.solved).reduce((a, f) => a + f.points, 0)
            const max = g.reduce((a, f) => a + f.points, 0)
            const pct = max ? Math.round((pts / max) * 100) : 0
            return (
              <li key={lv.key} className={['fb-ovi', `t-${lv.key}`, done === g.length ? 'clear' : ''].filter(Boolean).join(' ')}>
                <a className="fb-ovlink" href={`#fb-lv-${lv.key}`}>
                  <span className="fb-ring" style={{ '--p': pct } as CSSProperties} role="img" aria-label={`Level ${lv.n}: ${pct}% of points captured`}>
                    <b>{pct}<small>%</small></b>
                  </span>
                  <span className="fb-ovtxt">
                    <span className="fb-ovname">L{lv.n} <span className="tmuted">// {lv.key}</span></span>
                    <span className="fb-ovmeta"><b>{done}</b><span className="tmuted">/{g.length} flags</span> <span className="lb-sep" aria-hidden="true">·</span> <b>{pts}</b><span className="tmuted">/{max} pts</span></span>
                  </span>
                </a>
              </li>
            )
          })}
        </ol>
      )}

      {board && (
        <div className="fb-levels">
          {LEVELS.map((lv) => {
            const group = flags.filter((f) => tier(f) === lv.key)
            if (!group.length) return null
            const got = group.filter((f) => f.solved)
            const lvEarned = got.reduce((a, f) => a + f.points, 0)
            const lvTotal = group.reduce((a, f) => a + f.points, 0)
            const pct = lvTotal ? Math.round((lvEarned / lvTotal) * 100) : 0
            const clear = got.length === group.length
            return (
              <section
                key={lv.key}
                className={['fb-level', `t-${lv.key}`, clear ? 'clear' : ''].filter(Boolean).join(' ')}
                id={`fb-lv-${lv.key}`}
                aria-labelledby={`fb-lvh-${lv.key}`}
              >
                <header className={`fb-lvhead${folded[lv.key] ? ' folded' : ''}`}>
                  <button
                    type="button"
                    className="fb-lvtoggle"
                    aria-expanded={!folded[lv.key]}
                    aria-controls={`fb-lvbody-${lv.key}`}
                    onClick={() => toggle(lv.key)}
                    title={folded[lv.key] ? 'Expand level' : 'Collapse level'}
                  >
                    <span className="fb-lvtag" aria-hidden="true">L{lv.n}</span>
                    <span className="fb-chev" aria-hidden="true" />
                    <span className="sr-only">{folded[lv.key] ? 'Expand' : 'Collapse'} level {lv.n}</span>
                  </button>
                  <h3 id={`fb-lvh-${lv.key}`} className="fb-lvname">
                    level {lv.n} <span className="fb-lvsub">// {lv.key} · {lv.label}</span>
                  </h3>
                  <span className="fb-lvstat">
                    <span className="tmuted">flags</span> <b>{got.length}</b><span className="tmuted">/{group.length}</span>
                    <span className="lb-sep" aria-hidden="true">·</span>
                    <span className="tmuted">pts</span> <b>{lvEarned}</b><span className="tmuted">/{lvTotal}</span>
                    {clear && <span className="fb-lvclear">[✓] cleared</span>}
                  </span>
                  <span className="fb-lvbar" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct} aria-label={`Level ${lv.n} progress`}>
                    <i style={{ width: `${pct}%` }} />
                  </span>
                </header>

                <ol className="fb-qs" id={`fb-lvbody-${lv.key}`} aria-label={`Level ${lv.n} flags`} hidden={!!folded[lv.key]}>
                  {group.map((f, i) => {
                    const left = board.maxAttempts - f.attempts
                    const out = !f.solved && left <= 0
                    const frozen = !f.solved && f.frozen
                    const locked = f.solved || out || frozen
                    const res = results[f.id]
                    const id = `flag-${f.id}`
                    const num = `${lv.n}.${i + 1}`
                    const status = f.solved ? 'captured' : frozen ? 'frozen' : out ? 'locked' : f.attempts ? 'in progress' : 'open'
                    return (
                      <li key={f.id} id={`flag-${f.id}`} className={['fb-q', f.solved ? 'solved' : '', out ? 'out' : '', frozen ? 'frozen' : '', shake === f.id ? 'shake' : '', left === 1 && !locked ? 'last' : ''].filter(Boolean).join(' ')} style={{ '--i': flags.indexOf(f) } as CSSProperties}>
                        <form className="fb-qform" onSubmit={(e) => submit(e, f)}>
                          <span className="fb-qnum" aria-hidden="true">
                            <small>flag</small><b>{num}</b>
                          </span>

                          <span className="fb-qmain">
                            <span className="fb-qtitle">
                              <span className="fb-qname">{f.title}</span>
                              <span className={`fb-qstatus s-${status.replace(' ', '-')}`}>
                                <i aria-hidden="true" />{status}
                              </span>
                            </span>
                            <span className="fb-qmeta">
                              <span className="fb-qpts"><b>+{f.points}</b> pts</span>
                              <span className="lb-sep" aria-hidden="true">·</span>
                              <span className="fb-tries" aria-label={f.solved ? 'solved' : `${f.attempts} of ${board.maxAttempts} attempts used`}>
                                {f.solved
                                  ? <b className="ok">[✓] solved{f.lastAt && <span className="tmuted"> at {fmtTime(f.lastAt)}</span>}</b>
                                  : <>
                                      {Array.from({ length: board.maxAttempts }, (_, k) => <i key={k} className={k < f.attempts ? 'used' : ''} />)}
                                      <span className={left <= 1 ? 'warn' : 'tmuted'}>{left} {left === 1 ? 'try' : 'tries'} left</span>
                                    </>}
                              </span>
                            </span>
                          </span>

                          <span className="fb-answer">
                            {f.solved ? (
                              <span className="fb-captured">captured — +{f.points} pts added to your score</span>
                            ) : frozen ? (
                              <span className="fb-frozen">[❄] frozen by organisers — submissions paused</span>
                            ) : out ? (
                              <span className="fb-locked">[✗] no attempts left — flag locked</span>
                            ) : (
                              <span className="fb-prompt">
                                <span className="tp-gt" aria-hidden="true">&gt;</span>
                                <label htmlFor={id} className="sr-only">Answer for {f.title}</label>
                                <input
                                  id={id}
                                  name="answer"
                                  className="fb-input"
                                  type="text"
                                  placeholder="paste your flag"
                                  disabled={locked || busy === f.id}
                                  required
                                  spellCheck={false}
                                  autoComplete="off"
                                  autoCapitalize="off"
                                  aria-invalid={res?.kind === 'error' && !drafts[f.id] ? true : undefined}
                                  onChange={(ev) => {
                                    setDrafts((m) => ({ ...m, [f.id]: ev.target.value }))
                                    if (res) setResults((m) => { const n = { ...m }; delete n[f.id]; return n })
                                  }}
                                />
                              </span>
                            )}
                            {res && !f.solved && <span className={`fb-res ${res.kind}`} role="status">{res.kind === 'ok' ? '[✓]' : '[✗]'} {res.text}</span>}
                          </span>

                          <span className="fb-actions">
                            {!locked && (
                              <button className="fb-submit" type="submit" disabled={busy === f.id} aria-busy={busy === f.id}>
                                {busy === f.id ? <span className="tspin" aria-hidden="true" /> : left === 1 ? <>last try <ArrowRightIcon /></> : <>submit <ArrowRightIcon /></>}
                              </button>
                            )}
                            <a className="fb-view" href={f.question_url || '#'} target="_blank" rel="noopener noreferrer" title={`Question & assets for ${f.title}`}>
                              <span aria-hidden="true">[?]</span><span className="sr-only">Question and assets</span>
                            </a>
                          </span>
                        </form>
                      </li>
                    )
                  })}
                </ol>
              </section>
            )
          })}
        </div>
      )}
    </section>
  )
}
