import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from 'react'
import { ApiError, useAdmin } from '../../hooks/useAdmin'
import { CloseIcon, KeyIcon, ListIcon, PlusIcon, RadarIcon, SearchIcon, UserIcon } from '../Icons'
import { Overview } from './AdminOverview'
import { ScoreHistogram, ScoreRace, type RaceSeries } from './AdminStudentCharts'
import { Overlay, StudentDetail } from './AdminStudentDetail'

/* ───────────────────────── types ───────────────────────── */
interface Student { id: string; fullName: string; email: string; phone: string; institution: string; branch: string; rollNumber: string; score: number; createdAt: string; solved: number; attempts: number }
interface Flag { id: number; title: string; points: number; level: 'easy' | 'medium' | 'hard'; frozen: boolean; answer: string; questionUrl: string; sortOrder: number; attempts: number; captures: number }
interface Submission { id: number; answer: string; correct: 0 | 1; created_at: string; student_id: string; student: string; email: string; flag_id: number; flag: string; points: number }
type Tab = 'overview' | 'students' | 'flags' | 'submissions'
type Toast = { kind: 'ok' | 'error'; text: string } | null

const TABS: { key: Tab; cmd: string; desc: string }[] = [
  { key: 'overview', cmd: 'status', desc: 'Live totals, solve rates and recent activity.' },
  { key: 'students', cmd: 'students', desc: 'Add, edit and score participants.' },
  { key: 'flags', cmd: 'flags', desc: 'Create flags, set points, freeze or remove them.' },
  { key: 'submissions', cmd: 'submissions', desc: 'Audit every attempt and undo mistakes.' },
]
const TAB_ICON: Record<Tab, ReactNode> = {
  overview: <RadarIcon />, students: <UserIcon />, flags: <KeyIcon />, submissions: <ListIcon />,
}
const fmtAt =(iso: string) => new Date(iso).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', hour12: false })

/** Admin console: overview, student CRUD, flag CRUD (question link + answer), submission audit. */
export function AdminDashboard() {
  const [tab, setTab] = useState<Tab>(() => (new URLSearchParams(location.search).get('tab') as Tab) || 'overview')
  const [toast, setToast] = useState<Toast>(null)
  useEffect(() => { history.replaceState(null, '', tab === 'overview' ? '/admin' : `/admin?tab=${tab}`) }, [tab])
  useEffect(() => {
    if (!toast) return
    const t = window.setTimeout(() => setToast(null), 3500)
    return () => window.clearTimeout(t)
  }, [toast])

  return (
    <>
      <div className="dash-head adm-head">
        <span className="adm-head-art" aria-hidden="true" />
        <p className="tprompt"><span className="tp-user">root@cyberops</span><span className="tp-path">:~#</span> <span className="tp-cmd">./console --{TABS.find((t) => t.key === tab)?.cmd}</span></p>
        <h1>Admin console</h1>
        <p className="adm-lede">{TABS.find((t) => t.key === tab)?.desc}</p>
        <nav className="adm-tabs" role="tablist" aria-label="Section">
          {TABS.map((t) => (
            <button key={t.key} role="tab" type="button" aria-selected={tab === t.key} onClick={() => setTab(t.key)}>{TAB_ICON[t.key]}{t.key}</button>
          ))}
        </nav>
      </div>

      <div className="adm-toast" aria-live="polite">
        {toast && <p className={`term-toast ${toast.kind}`}><b>{toast.kind === 'ok' ? '[✓]' : '[✗]'}</b> {toast.text}</p>}
      </div>

      {tab === 'overview' && <Overview go={setTab} />}
      {tab === 'students' && <Students notify={setToast} />}
      {tab === 'flags' && <Flags notify={setToast} />}
      {tab === 'submissions' && <Submissions notify={setToast} />}
    </>
  )
}


/* ───────────────────────── shared bits ───────────────────────── */
function Field({ id, label, error, children, hint }: { id: string; label: string; error?: string; hint?: string; children: ReactNode }) {
  return (
    <div className={`adm-field${error ? ' err' : ''}`}>
      <label htmlFor={id}>{label}</label>
      {children}
      {error ? <p className="adm-err" id={`${id}-err`} role="alert">{error}</p> : hint ? <p className="adm-hint">{hint}</p> : null}
    </div>
  )
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = prev }
  }, [onClose])
  return (
    <Overlay>
      <div className="adm-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose() }}>
        <div className="adm-modal" role="dialog" aria-modal="true" aria-labelledby="adm-modal-h">
          <div className="adm-modal-head">
            <h2 id="adm-modal-h" className="dcard-h"><span className="tp-dollar">$</span> {title}</h2>
            <button type="button" className="adm-icon" onClick={onClose} aria-label="Close"><CloseIcon /></button>
          </div>
          {children}
        </div>
      </div>
    </Overlay>
  )
}

function Confirm({ text, detail, onYes, onNo, busy }: { text: string; detail?: string; onYes: () => void; onNo: () => void; busy: boolean }) {
  return (
    <Modal title="confirm --destructive" onClose={onNo}>
      <p className="adm-confirm">{text}</p>
      {detail && <p className="tmuted adm-confirm-sub">{detail}</p>}
      <div className="adm-actions">
        <button type="button" className="adm-btn" onClick={onNo} disabled={busy}>cancel</button>
        <button type="button" className="adm-btn danger" onClick={onYes} disabled={busy} aria-busy={busy} autoFocus>{busy ? 'deleting…' : 'yes, delete'}</button>
      </div>
    </Modal>
  )
}

/* ───────────────────────── students ───────────────────────── */
const EMPTY_STUDENT = { fullName: '', email: '', phone: '', institution: '', branch: '', rollNumber: '' }

function Students({ notify }: { notify: (t: Toast) => void }) {
  const { api } = useAdmin()
  const [rows, setRows] = useState<Student[] | null>(null)
  const [q, setQ] = useState('')
  const [edit, setEdit] = useState<Student | 'new' | null>(null)
  const [award, setAward] = useState<Student | null>(null)
  const [del, setDel] = useState<Student | null>(null)
  const [busy, setBusy] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})

  const [totalFlags, setTotalFlags] = useState(0)
  const [race, setRace] = useState<RaceSeries[] | null>(null)
  const [open, setOpen] = useState<string | null>(null) // id (email) of the student whose detail drawer is open
  const [ver, setVer] = useState(0) // bumps on every reload so the drawer refetches
  const [college, setCollege] = useState('all')
  const [sort, setSort] = useState<'score' | 'name' | 'solved' | 'new'>('score')

  const load = useCallback(() => {
    api<{ students: Student[]; totalFlags?: number }>(`/students?q=${encodeURIComponent(q)}`)
      .then((d) => { setRows(d.students); setTotalFlags(d.totalFlags ?? 0); setVer((v) => v + 1) })
      .catch((e: Error) => notify({ kind: 'error', text: e.message }))
    // the race chart is independent of the search box; a missing endpoint (server not restarted yet) just hides it
    api<{ series: RaceSeries[] }>('/students/series?top=6').then((d) => setRace(d.series)).catch(() => setRace([]))
  }, [api, q, notify])

  // Derived view: server returns score order; rank is that order, and the filter/sort only change what is shown.
  const view = useMemo(() => {
    const all = rows ?? []
    const colleges = Array.from(new Set(all.map((s) => s.institution))).sort((a, b) => a.localeCompare(b))
    const activeCollege = colleges.includes(college) ? college : 'all'
    const rank = new Map(all.map((s, i) => [s.id, i + 1]))
    const shown = all.filter((s) => activeCollege === 'all' || s.institution === activeCollege)
    const cmp: Record<typeof sort, (a: Student, b: Student) => number> = {
      score: (a, b) => b.score - a.score || a.fullName.localeCompare(b.fullName),
      name: (a, b) => a.fullName.localeCompare(b.fullName),
      solved: (a, b) => b.solved - a.solved || b.score - a.score,
      new: (a, b) => b.createdAt.localeCompare(a.createdAt),
    }
    shown.sort(cmp[sort])
    const maxScore = Math.max(1, ...all.map((s) => s.score))
    const flagsTotal = totalFlags || Math.max(1, ...all.map((s) => s.solved))
    return {
      colleges, activeCollege, shown, rank, maxScore, flagsTotal,
      avg: all.length ? Math.round(all.reduce((a, s) => a + s.score, 0) / all.length) : 0,
      captures: all.reduce((a, s) => a + s.solved, 0),
      attempts: all.reduce((a, s) => a + s.attempts, 0),
    }
  }, [rows, college, sort, totalFlags])
  useEffect(() => { const t = window.setTimeout(load, q ? 250 : 0); return () => window.clearTimeout(t) }, [load, q])

  const save = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (busy || !edit) return
    const body = Object.fromEntries(new FormData(e.currentTarget)) as typeof EMPTY_STUDENT
    setBusy(true); setErrors({})
    try {
      if (edit === 'new') { await api('/students', { method: 'POST', body }); notify({ kind: 'ok', text: `${body.fullName} added.` }) }
      else {
        await api(`/students/${encodeURIComponent(edit.id)}`, { method: 'PUT', body }); notify({ kind: 'ok', text: `${body.fullName} updated.` })
        if (open === edit.id) setOpen(String(body.email).trim().toLowerCase()) // the id is the email; keep the drawer on the same student
      }
      setEdit(null); load()
    } catch (err) {
      setErrors((err as ApiError).errors ?? {})
      notify({ kind: 'error', text: (err as Error).message })
    } finally { setBusy(false) }
  }
  const doAward = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (busy || !award) return
    const fd = new FormData(e.currentTarget)
    setBusy(true)
    try {
      await api(`/students/${encodeURIComponent(award.id)}/score`, { method: 'POST', body: { points: Number(fd.get('points')), note: fd.get('note') } })
      notify({ kind: 'ok', text: `Score updated for ${award.fullName}.` }); setAward(null); load()
    } catch (err) { notify({ kind: 'error', text: (err as Error).message }) } finally { setBusy(false) }
  }
  const doDelete = async () => {
    if (busy || !del) return
    setBusy(true)
    try { await api(`/students/${encodeURIComponent(del.id)}`, { method: 'DELETE' }); notify({ kind: 'ok', text: `${del.fullName} removed.` }); if (open === del.id) setOpen(null); setDel(null); load() }
    catch (err) { notify({ kind: 'error', text: (err as Error).message }) } finally { setBusy(false) }
  }

  const cur = edit && edit !== 'new' ? edit : EMPTY_STUDENT
  // clickable column header that drives the same sort as the dropdown (name A-Z; score and flags high-to-low)
  const sortTh = (key: typeof sort, label: string, cls = '') => (
    <th className={cls} aria-sort={sort === key ? (key === 'name' ? 'ascending' : 'descending') : 'none'}>
      <button type="button" className={`st-th${sort === key ? ' on' : ''}`} onClick={() => setSort(key)} title={`Sort by ${label}`}>
        {label}<i aria-hidden="true" />
      </button>
    </th>
  )
  return (
    <section className="dcard dcard-wide st" aria-labelledby="a-st">
      <div className="dcard-head">
        <h2 id="a-st" className="dcard-h"><span className="tp-dollar">$</span> ./students --list {rows && <span className="tmuted">({view.shown.length}{view.shown.length !== rows.length ? ` of ${rows.length}` : ''})</span>}</h2>
        <div className="adm-tools">
          <label className="adm-search">
            <SearchIcon /><span className="sr-only">Search students</span>
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="name, email, college, roll" />
            {q && <button type="button" className="st-clear" onClick={() => setQ('')} aria-label="Clear search"><CloseIcon /></button>}
          </label>
          <button type="button" className="adm-btn primary" onClick={() => { setErrors({}); setEdit('new') }}><PlusIcon /> add student</button>
        </div>
      </div>

      {rows && rows.length > 0 && (
        <>
          <ul className="st-stats" aria-label="Summary">
            <li><small>students</small><b>{rows.length}</b></li>
            <li><small>colleges</small><b>{view.colleges.length}</b></li>
            <li><small>avg score</small><b>{view.avg.toLocaleString('en-IN')}</b></li>
            <li><small>captures</small><b>{view.captures}</b><span>{view.attempts ? Math.round((view.captures / view.attempts) * 100) : 0}% hit rate</span></li>
          </ul>
          <div className="st-viz">
            <section className="st-viz-card st-viz-wide" aria-labelledby="st-race-h">
              <h3 id="st-race-h" className="st-viz-h">Score race <span className="tmuted">· top 6 over time</span></h3>
              {race === null ? <p className="tmuted"><span className="tspin" aria-hidden="true" /> loading…</p> : <ScoreRace series={race} />}
            </section>
            <section className="st-viz-card" aria-labelledby="st-dist-h">
              <h3 id="st-dist-h" className="st-viz-h">Score distribution <span className="tmuted">· students per band</span></h3>
              <ScoreHistogram scores={rows.map((s) => s.score)} />
            </section>
          </div>
          <div className="st-filters">
            <div className="st-chips" role="group" aria-label="Filter by college">
              <button type="button" aria-pressed={view.activeCollege === 'all'} onClick={() => setCollege('all')}>all <i>{rows.length}</i></button>
              {view.colleges.map((c) => (
                <button key={c} type="button" aria-pressed={view.activeCollege === c} onClick={() => setCollege(c)}>{c} <i>{rows.filter((s) => s.institution === c).length}</i></button>
              ))}
            </div>
            <label className="adm-select st-sort"><span className="sr-only">Sort by</span>
              <select value={sort} onChange={(e) => setSort(e.target.value as typeof sort)}>
                <option value="score">sort: score</option>
                <option value="solved">sort: flags solved</option>
                <option value="name">sort: name</option>
                <option value="new">sort: newest</option>
              </select>
            </label>
          </div>
        </>
      )}

      {!rows && <p className="tmuted"><span className="tspin" aria-hidden="true" /> loading…</p>}
      {rows && rows.length === 0 && (
        <div className="st-empty">
          <p><b>{q ? 'No students match your search.' : 'No students yet.'}</b></p>
          <p className="tmuted">{q ? 'Try a name, email, college or roll number.' : 'Students appear here when they register, or add one yourself.'}</p>
          {q ? <button type="button" className="adm-btn sm" onClick={() => setQ('')}>clear search</button> : <button type="button" className="adm-btn primary sm" onClick={() => { setErrors({}); setEdit('new') }}><PlusIcon /> add student</button>}
        </div>
      )}
      {rows && rows.length > 0 && view.shown.length === 0 && <p className="tmuted">No students in this college.</p>}

      {view.shown.length > 0 && (
        <>
          <div className="adm-tablewrap st-table">
            <table className="lb-table adm-table">
              <colgroup><col className="c-rank" /><col className="c-student" /><col className="c-college" /><col className="c-roll" /><col className="c-flags" /><col className="c-score" /><col className="c-actions" /></colgroup>
              <thead><tr><th>rank</th>{sortTh('name', 'student')}<th>college</th><th>roll</th>{sortTh('solved', 'flags solved')}{sortTh('score', 'score', 'th-num')}<th className="sr-only">actions</th></tr></thead>
              <tbody>
                {view.shown.map((s) => {
                  const rank = view.rank.get(s.id) ?? 0
                  return (
                    <tr key={s.id} className={`st-row${open === s.id ? ' on' : ''}`} onClick={() => setOpen(s.id)}>
                      <td><span className={`st-rank r${rank <= 3 ? rank : 'n'}`}>{rank}</span></td>
                      <td>
                        <span className="st-who">
                          <span className="st-avatar" aria-hidden="true">{s.fullName.trim().charAt(0).toUpperCase()}</span>
                          <span className="st-id">
                            <button type="button" className="st-open" onClick={(e) => { e.stopPropagation(); setOpen(s.id) }} aria-label={`View details for ${s.fullName}`}>{s.fullName}</button>
                            <span className="tmuted adm-small">{s.email} · {s.phone}</span>
                          </span>
                        </span>
                      </td>
                      <td className="st-college"><span className="st-clip" title={s.institution}>{s.institution}</span><span className="st-pill">{s.branch}</span></td>
                      <td><code className="st-roll">{s.rollNumber}</code></td>
                      <td>
                        <span className="st-prog" title={`${s.solved} of ${view.flagsTotal} flags · ${s.attempts} attempts`}>
                          <span className="st-prog-n"><b>{s.solved}</b> / {view.flagsTotal}</span>
                          <span className="st-bar" role="presentation"><i style={{ width: `${Math.min(100, (s.solved / view.flagsTotal) * 100)}%` }} /></span>
                          <small className="tmuted">{s.attempts} tries</small>
                        </span>
                      </td>
                      <td className="adm-num">
                        <span className="st-score" title={`${s.score.toLocaleString('en-IN')} points · ${Math.round((s.score / view.maxScore) * 100)}% of the leader`}>
                          <span className="st-score-n"><b>{s.score.toLocaleString('en-IN')}</b> pts</span>
                          <span className="st-bar st-bar-g" role="presentation"><i style={{ width: `${Math.max(s.score > 0 ? 2 : 0, (s.score / view.maxScore) * 100)}%` }} /></span>
                          <small className="tmuted">{s.score > 0 && s.score === view.maxScore ? 'leader' : `${Math.round((s.score / view.maxScore) * 100)}% of leader`}</small>
                        </span>
                      </td>
                      <td className="adm-rowactions" onClick={(e) => e.stopPropagation()}>
                        <button type="button" className="adm-btn sm" onClick={() => setAward(s)} aria-label={`Adjust points for ${s.fullName}`}>± pts</button>
                        <button type="button" className="adm-btn sm" onClick={() => { setErrors({}); setEdit(s) }} aria-label={`Edit ${s.fullName}`}>edit</button>
                        <button type="button" className="adm-btn sm danger" onClick={() => setDel(s)} aria-label={`Delete ${s.fullName}`}>delete</button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          <ul className="st-cards" aria-label="Students">
            {view.shown.map((s) => {
              const rank = view.rank.get(s.id) ?? 0
              return (
                <li key={s.id} className="st-card">
                  <div className="st-card-top">
                    <span className={`st-rank r${rank <= 3 ? rank : 'n'}`}>{rank}</span>
                    <span className="st-avatar" aria-hidden="true">{s.fullName.trim().charAt(0).toUpperCase()}</span>
                    <span className="st-id">
                      <button type="button" className="st-open" onClick={() => setOpen(s.id)} aria-label={`View details for ${s.fullName}`}>{s.fullName}</button>
                      <span className="tmuted adm-small">{s.email}</span>
                    </span>
                    <span className="st-card-score"><b>{s.score.toLocaleString('en-IN')}</b><small>pts</small></span>
                  </div>
                  <div className="st-card-meta"><span>{s.institution}</span><span className="st-pill">{s.branch}</span><code>{s.rollNumber}</code></div>
                  <div className="st-prog"><span className="st-prog-n"><b>{s.solved}</b> / {view.flagsTotal} flags</span><span className="st-bar" role="presentation"><i style={{ width: `${Math.min(100, (s.solved / view.flagsTotal) * 100)}%` }} /></span></div>
                  <div className="st-card-actions">
                    <button type="button" className="adm-btn sm" onClick={() => setAward(s)}>± pts</button>
                    <button type="button" className="adm-btn sm" onClick={() => { setErrors({}); setEdit(s) }}>edit</button>
                    <button type="button" className="adm-btn sm danger" onClick={() => setDel(s)}>delete</button>
                  </div>
                </li>
              )
            })}
          </ul>
        </>
      )}

      {open && (
        <StudentDetail id={open} version={ver} onClose={() => setOpen(null)}
          onAward={(s) => setAward(s)} onEdit={(s) => { setErrors({}); setEdit(s) }} onChanged={load} />
      )}
      {edit && (
        <Modal title={edit === 'new' ? 'students --add' : `students --edit ${edit.id}`} onClose={() => setEdit(null)}>
          <form className="adm-form-grid" onSubmit={save} noValidate>
            <Field id="st-name" label="Full name" error={errors.fullName}><input id="st-name" name="fullName" defaultValue={cur.fullName} required autoFocus /></Field>
            <Field id="st-email" label="Email" error={errors.email}><input id="st-email" name="email" type="email" defaultValue={cur.email} required /></Field>
            <Field id="st-phone" label="Mobile" error={errors.phone} hint="10 digits"><input id="st-phone" name="phone" inputMode="numeric" defaultValue={cur.phone} required /></Field>
            <Field id="st-roll" label="Roll number" error={errors.rollNumber} hint="Used as the login secret"><input id="st-roll" name="rollNumber" defaultValue={cur.rollNumber} required /></Field>
            <Field id="st-inst" label="Institution" error={errors.institution}><input id="st-inst" name="institution" defaultValue={cur.institution} required /></Field>
            <Field id="st-branch" label="Branch" error={errors.branch}><input id="st-branch" name="branch" defaultValue={cur.branch} required /></Field>
            <div className="adm-actions span2">
              <button type="button" className="adm-btn" onClick={() => setEdit(null)} disabled={busy}>cancel</button>
              <button type="submit" className="adm-btn primary" disabled={busy} aria-busy={busy}>{busy ? 'saving…' : edit === 'new' ? 'add student' : 'save changes'}</button>
            </div>
          </form>
        </Modal>
      )}
      {award && (
        <Modal title={`score --adjust "${award.fullName}"`} onClose={() => setAward(null)}>
          <p className="tmuted adm-confirm-sub">Current score <b className="adm-strong">{award.score}</b>. Positive adds, negative deducts. Logged on the scoreboard timeline.</p>
          <form className="adm-form-grid" onSubmit={doAward} noValidate>
            <Field id="aw-pts" label="Points" hint="e.g. 50 or -100"><input id="aw-pts" name="points" type="number" step={1} required autoFocus /></Field>
            <Field id="aw-note" label="Note" hint="Shown in score history"><input id="aw-note" name="note" placeholder="bonus: best write-up" maxLength={120} /></Field>
            <div className="adm-actions span2">
              <button type="button" className="adm-btn" onClick={() => setAward(null)} disabled={busy}>cancel</button>
              <button type="submit" className="adm-btn primary" disabled={busy} aria-busy={busy}>{busy ? 'applying…' : 'apply'}</button>
            </div>
          </form>
        </Modal>
      )}
      {del && <Confirm text={`Delete ${del.fullName}?`} detail="Their submissions and score history go too. This cannot be undone." onYes={doDelete} onNo={() => setDel(null)} busy={busy} />}
    </section>
  )
}

/* ───────────────────────── flags ───────────────────────── */
/** " 3 students re-scored (+100 each)." when changing a flag's points also changed scores of students who had already solved it. */
const rescoreNote = (r: { rescored?: number; delta?: number }) =>
  r.rescored ? ` ${r.rescored} student${r.rescored === 1 ? '' : 's'} who already solved it ${r.rescored === 1 ? 'was' : 'were'} re-scored (${(r.delta ?? 0) > 0 ? '+' : ''}${r.delta} each).` : ''
const EMPTY_FLAG ={ title: '', points: 100, level: 'easy' as const, frozen: false, answer: '', questionUrl: '', sortOrder: 0 }

function Flags({ notify }: { notify: (t: Toast) => void }) {
  const { api } = useAdmin()
  const [rows, setRows] = useState<Flag[] | null>(null)
  const [reveal, setReveal] = useState<Record<number, boolean>>({})
  const [edit, setEdit] = useState<Flag | 'new' | null>(null)
  const [del, setDel] = useState<Flag | null>(null)
  const [busy, setBusy] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [ptsEdit, setPtsEdit] = useState<number | null>(null)
  const [ptsDraft, setPtsDraft] = useState('')
  const [ptsErr, setPtsErr] = useState('')
  const [students, setStudents] = useState(0)
  const [lvl, setLvl] = useState<'all' | 'easy' | 'medium' | 'hard' | 'frozen'>('all')
  const [sort, setSort] = useState<'order' | 'points' | 'solved' | 'tries'>('order')
  const [copied, setCopied] = useState<number | null>(null)
  const ptsActive = useRef<number | null>(null) // id of the flag whose points editor is open; null once committed or cancelled

  const load = useCallback(() => {
    api<{ flags: Flag[]; students?: number }>('/flags').then((d) => { setRows(d.flags); setStudents(d.students ?? 0) }).catch((e: Error) => notify({ kind: 'error', text: e.message }))
  }, [api, notify])
  useEffect(load, [load])

  const save = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (busy || !edit) return
    const fd = new FormData(e.currentTarget)
    const body = { title: fd.get('title'), points: Number(fd.get('points')), level: fd.get('level'), frozen: fd.get('frozen') === 'on', answer: fd.get('answer'), questionUrl: fd.get('questionUrl'), sortOrder: Number(fd.get('sortOrder')) }
    setBusy(true); setErrors({})
    try {
      if (edit === 'new') { await api('/flags', { method: 'POST', body }); notify({ kind: 'ok', text: `${body.title} created.` }) }
      else {
        const r = await api<{ rescored?: number; delta?: number }>(`/flags/${edit.id}`, { method: 'PUT', body })
        notify({ kind: 'ok', text: `${body.title} saved.${rescoreNote(r)}` })
      }
      setEdit(null); load()
    } catch (err) {
      setErrors((err as ApiError).errors ?? {})
      notify({ kind: 'error', text: (err as Error).message })
    } finally { setBusy(false) }
  }
  const doDelete = async () => {
    if (busy || !del) return
    setBusy(true)
    try { await api(`/flags/${del.id}`, { method: 'DELETE' }); notify({ kind: 'ok', text: `${del.title} deleted.` }); setDel(null); load() }
    catch (err) { notify({ kind: 'error', text: (err as Error).message }) } finally { setBusy(false) }
  }

  const toggleFreeze = async (f: Flag) => {
    if (busy) return
    setBusy(true)
    try {
      await api(`/flags/${f.id}/freeze`, { method: 'PATCH', body: { frozen: !f.frozen } })
      notify({ kind: 'ok', text: f.frozen ? `${f.title} unfrozen — submissions open.` : `${f.title} frozen — no one can submit.` }); load()
    } catch (err) { notify({ kind: 'error', text: (err as Error).message }) } finally { setBusy(false) }
  }

  // Inline points editor: no buttons. Enter or clicking away saves a changed value; Esc cancels; an invalid value keeps the editor open with an error.
  const openPoints = (f: Flag) => { ptsActive.current = f.id; setPtsDraft(String(f.points)); setPtsErr(''); setPtsEdit(f.id) }
  const closePoints = () => { ptsActive.current = null; setPtsErr(''); setPtsEdit(null) }
  const savePoints = async (f: Flag) => {
    if (ptsActive.current !== f.id) return // not editing this flag, or the commit was already claimed
    const raw = ptsDraft.trim()
    const pts = Number(raw)
    if (raw === '' || !Number.isInteger(pts) || pts < 1 || pts > 100000) { setPtsErr('Whole number 1–100000.'); return }
    if (pts === f.points) { closePoints(); return } // nothing changed: just leave edit mode
    ptsActive.current = null // claim the commit so a second blur/submit can't save again
    setBusy(true); setPtsErr('')
    try {
      const r = await api<{ rescored?: number; delta?: number }>(`/flags/${f.id}/points`, { method: 'PATCH', body: { points: pts } })
      notify({ kind: 'ok', text: `${f.title} is now worth ${pts} pts.${rescoreNote(r)}` }); setPtsEdit(null); load()
    } catch (err) { ptsActive.current = f.id; setPtsErr((err as Error).message) } finally { setBusy(false) }
  }

  const view = useMemo(() => {
    const all = rows ?? []
    const n = Math.max(1, students || Math.max(1, ...all.map((f) => f.captures))) // students who could solve it
    const rate = (f: Flag) => Math.min(100, Math.round((f.captures / n) * 100))
    const shown = all.filter((f) => (lvl === 'all' ? true : lvl === 'frozen' ? f.frozen : f.level === lvl))
    const cmp: Record<typeof sort, (a: Flag, b: Flag) => number> = {
      order: (a, b) => a.sortOrder - b.sortOrder || a.id - b.id,
      points: (a, b) => b.points - a.points || a.sortOrder - b.sortOrder,
      solved: (a, b) => b.captures - a.captures || a.sortOrder - b.sortOrder,
      tries: (a, b) => b.attempts - a.attempts || a.sortOrder - b.sortOrder,
    }
    shown.sort(cmp[sort])
    const attempts = all.reduce((a, f) => a + f.attempts, 0)
    const captures = all.reduce((a, f) => a + f.captures, 0)
    return {
      n, rate, shown,
      counts: { all: all.length, easy: all.filter((f) => f.level === 'easy').length, medium: all.filter((f) => f.level === 'medium').length, hard: all.filter((f) => f.level === 'hard').length, frozen: all.filter((f) => f.frozen).length },
      points: all.reduce((a, f) => a + f.points, 0), attempts, captures,
      avgRate: all.length ? Math.round(all.reduce((a, f) => a + rate(f), 0) / all.length) : 0,
      hit: attempts ? Math.round((captures / attempts) * 100) : 0,
    }
  }, [rows, students, lvl, sort])

  const copyAnswer = (f: Flag) => {
    navigator.clipboard?.writeText(f.answer).then(() => { setCopied(f.id); window.setTimeout(() => setCopied((c) => (c === f.id ? null : c)), 1500) }).catch(() => {})
  }
  // clickable column header that drives the same sort as the dropdown
  const flTh = (key: typeof sort, label: string) => (
    <th aria-sort={sort === key ? (key === 'order' ? 'ascending' : 'descending') : 'none'}>
      <button type="button" className={`st-th${sort === key ? ' on' : ''}`} onClick={() => setSort(key)} title={`Sort by ${label}`}>{label}<i aria-hidden="true" /></button>
    </th>
  )

  // pieces shared by the table row and the phone card
  const pointsEditor = (f: Flag) => (
    <>
      {ptsEdit === f.id ? (
        <form className="adm-ptsform" onSubmit={(e) => { e.preventDefault(); savePoints(f) }} noValidate>
          <label className="sr-only" htmlFor={`pts-${f.id}`}>Points for {f.title}. Press Enter to save, Escape to cancel.</label>
          <input id={`pts-${f.id}`} type="number" min={1} max={100000} step={1} inputMode="numeric" value={ptsDraft} readOnly={busy} autoFocus
            onFocus={(e) => e.currentTarget.select()}
            onChange={(e) => { setPtsDraft(e.target.value); setPtsErr('') }}
            onBlur={() => { if (document.hasFocus()) savePoints(f) }} // clicking elsewhere commits; switching windows doesn't
            onKeyDown={(e) => { if (e.key === 'Escape') { e.preventDefault(); closePoints() } }}
            aria-invalid={!!ptsErr} aria-busy={busy} className={busy ? 'saving' : undefined} title="Enter to save · Esc to cancel" />
        </form>
      ) : (
        <button type="button" className="adm-pts" onClick={() => openPoints(f)} aria-label={`Edit points for ${f.title}, currently ${f.points}`} title="Edit points">
          {f.points.toLocaleString('en-IN')} pts <span aria-hidden="true">✎</span>
        </button>
      )}
      {ptsEdit === f.id && ptsErr && <span className="adm-ptserr" role="alert">{ptsErr}</span>}
    </>
  )
  const statusSwitch = (f: Flag) => (
    <button type="button" role="switch" aria-checked={!f.frozen} className={`fl-switch${f.frozen ? '' : ' on'}`} onClick={() => toggleFreeze(f)} disabled={busy}
      aria-label={`${f.title}: submissions ${f.frozen ? 'paused' : 'open'}. Toggle`} title={f.frozen ? 'Frozen: click to open submissions' : 'Live: click to freeze submissions'}>
      <i aria-hidden="true" /><span>{f.frozen ? 'frozen' : 'live'}</span>
    </button>
  )
  const answerCell = (f: Flag) => (
    <span className="fl-answer">
      <code>{reveal[f.id] ? f.answer || <i className="tmuted">(not set)</i> : '••••••••••'}</code>
      <button type="button" className="adm-btn sm" onClick={() => setReveal((m) => ({ ...m, [f.id]: !m[f.id] }))} aria-pressed={!!reveal[f.id]} aria-label={`${reveal[f.id] ? 'Hide' : 'Show'} answer for ${f.title}`}>{reveal[f.id] ? 'hide' : 'show'}</button>
      <button type="button" className="adm-btn sm" onClick={() => copyAnswer(f)} disabled={!f.answer} aria-label={`Copy answer for ${f.title}`}>{copied === f.id ? 'copied' : 'copy'}</button>
    </span>
  )
  const solvedCell = (f: Flag) => {
    const pct = view.rate(f)
    return (
      <span className="st-prog" title={`${f.captures} of ${view.n} students solved it · ${f.attempts} attempts`}>
        <span className="st-prog-n"><b>{f.captures}</b> / {view.n} solved</span>
        <span className="st-bar" role="presentation"><i style={{ width: `${Math.max(f.captures > 0 ? 2 : 0, pct)}%` }} /></span>
        <small className="tmuted">{f.attempts} tries · {f.attempts ? Math.round((f.captures / f.attempts) * 100) : 0}% hit</small>
      </span>
    )
  }
  const questionLink = (f: Flag) => (f.questionUrl
    ? <a className="fl-link" href={f.questionUrl} target="_blank" rel="noopener noreferrer" title={f.questionUrl}>{f.questionUrl.replace(/^https?:\/\//, '')}<span aria-hidden="true"> ↗</span></a>
    : <span className="tmuted">—</span>)
  const rowActions = (f: Flag) => (
    <>
      <button type="button" className="adm-btn sm" onClick={() => { setErrors({}); setEdit(f) }} aria-label={`Edit ${f.title}`}>edit</button>
      <button type="button" className="adm-btn sm danger" onClick={() => setDel(f)} aria-label={`Delete ${f.title}`}>delete</button>
    </>
  )

  const cur = edit && edit !== 'new' ? edit : { ...EMPTY_FLAG, sortOrder: rows?.length ?? 0 }
  return (
    <section className="dcard dcard-wide st fl" aria-labelledby="a-fl">
      <div className="dcard-head">
        <h2 id="a-fl" className="dcard-h"><span className="tp-dollar">$</span> ./flags --manage {rows && <span className="tmuted">({view.shown.length}{view.shown.length !== rows.length ? ` of ${rows.length}` : ''})</span>}</h2>
        <div className="adm-tools">
          <button type="button" className="adm-btn primary" onClick={() => { setErrors({}); setEdit('new') }}><PlusIcon /> new flag</button>
        </div>
      </div>

      {rows && rows.length > 0 && (
        <>
          <ul className="st-stats" aria-label="Summary">
            <li><small>flags</small><b>{rows.length}</b><span className={view.counts.frozen ? 'fl-warn' : undefined}>{rows.length - view.counts.frozen} live{view.counts.frozen ? ` · ${view.counts.frozen} frozen` : ''}</span></li>
            <li><small>points available</small><b>{view.points.toLocaleString('en-IN')}</b></li>
            <li><small>avg solve rate</small><b>{view.avgRate}%</b><span>of {view.n} students</span></li>
            <li><small>attempts</small><b>{view.attempts}</b><span>{view.captures} captures · {view.hit}% hit</span></li>
          </ul>
          <div className="st-filters">
            <div className="st-chips" role="group" aria-label="Filter flags">
              {(['all', 'easy', 'medium', 'hard', 'frozen'] as const).map((k) => (
                <button key={k} type="button" data-lvl={k} aria-pressed={lvl === k} onClick={() => setLvl(k)}>{k} <i>{view.counts[k]}</i></button>
              ))}
            </div>
            <label className="adm-select st-sort"><span className="sr-only">Sort by</span>
              <select value={sort} onChange={(e) => setSort(e.target.value as typeof sort)}>
                <option value="order">sort: order</option>
                <option value="points">sort: points</option>
                <option value="solved">sort: most solved</option>
                <option value="tries">sort: most attempts</option>
              </select>
            </label>
          </div>
        </>
      )}

      {!rows && <p className="tmuted"><span className="tspin" aria-hidden="true" /> loading…</p>}
      {rows && rows.length === 0 && (
        <div className="st-empty">
          <p><b>No flags yet.</b></p>
          <p className="tmuted">Create the first challenge. Students see it on their board straight away.</p>
          <button type="button" className="adm-btn primary sm" onClick={() => { setErrors({}); setEdit('new') }}><PlusIcon /> new flag</button>
        </div>
      )}
      {rows && rows.length > 0 && view.shown.length === 0 && <p className="tmuted">No flags match this filter.</p>}

      {view.shown.length > 0 && (
        <>
          <div className="adm-tablewrap st-table fl-table">
            <table className="lb-table adm-table">
              <colgroup><col className="c-fl-order" /><col /><col className="c-fl-state" /><col className="c-fl-answer" /><col className="c-fl-q" /><col className="c-fl-solved" /><col className="c-fl-actions" /></colgroup>
              <thead><tr>{flTh('order', 'order')}<th>flag</th><th>state</th><th>answer</th><th>question</th>{flTh('solved', 'solved')}<th className="sr-only">actions</th></tr></thead>
              <tbody>
                {view.shown.map((f) => (
                  <tr key={f.id} className={`fl-row t-${f.level}${f.frozen ? ' frozen' : ''}`}>
                    <td><span className="st-rank rn">{f.sortOrder}</span></td>
                    <td>
                      <span className="fl-name"><b>{f.title}</b><span className={`adm-lvl t-${f.level}`}>{f.level}</span></span>
                      <span className="fl-pts">{pointsEditor(f)}</span>
                    </td>
                    <td>{statusSwitch(f)}</td>
                    <td>{answerCell(f)}</td>
                    <td className="fl-q">{questionLink(f)}</td>
                    <td>{solvedCell(f)}</td>
                    <td className="adm-rowactions">{rowActions(f)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <ul className="st-cards fl-cards" aria-label="Flags">
            {view.shown.map((f) => (
              <li key={f.id} className={`st-card fl-card t-${f.level}${f.frozen ? ' frozen' : ''}`}>
                <div className="st-card-top">
                  <span className="st-rank rn">{f.sortOrder}</span>
                  <span className="st-id"><span className="fl-name"><b>{f.title}</b><span className={`adm-lvl t-${f.level}`}>{f.level}</span></span><span className="fl-pts">{pointsEditor(f)}</span></span>
                  {statusSwitch(f)}
                </div>
                {solvedCell(f)}
                <div className="fl-card-row">{answerCell(f)}</div>
                <div className="fl-card-row">{questionLink(f)}</div>
                <div className="st-card-actions">{rowActions(f)}</div>
              </li>
            ))}
          </ul>
        </>
      )}

      {edit && (
        <Modal title={edit === 'new' ? 'flags --new' : `flags --edit "${edit.title}"`} onClose={() => setEdit(null)}>
          <form className="adm-form-grid" onSubmit={save} noValidate>
            <Field id="fl-title" label="Title" error={errors.title}><input id="fl-title" name="title" defaultValue={cur.title} maxLength={80} required autoFocus /></Field>
            <Field id="fl-points" label="Points" error={errors.points}><input id="fl-points" name="points" type="number" min={1} step={1} defaultValue={cur.points} required /></Field>
            <Field id="fl-level" label="Level" error={errors.level} hint="Groups the flag on the student board">
              <select id="fl-level" name="level" defaultValue={cur.level} required>
                <option value="easy">easy · level 1 · recon</option>
                <option value="medium">medium · level 2 · exploit</option>
                <option value="hard">hard · level 3 · privesc</option>
              </select>
            </Field>
            <div className="adm-field adm-check">
              <label htmlFor="fl-frozen"><input id="fl-frozen" name="frozen" type="checkbox" defaultChecked={cur.frozen} /> Frozen — visible to students, submissions paused</label>
            </div>
            <Field id="fl-answer" label="Answer (flag)" error={errors.answer} hint="Compared case-insensitively, whitespace trimmed. Changing it does not undo past captures."><input id="fl-answer" name="answer" defaultValue={cur.answer} placeholder="CYBEROPS{…}" maxLength={200} spellCheck={false} autoComplete="off" required /></Field>
            <Field id="fl-url" label="Question / assets URL" error={errors.questionUrl} hint="Opens from the [?] button on the student board"><input id="fl-url" name="questionUrl" type="url" defaultValue={cur.questionUrl} placeholder="https://… or /#ctf" maxLength={300} /></Field>
            <Field id="fl-order" label="Sort order" hint="Lower prints first within its level"><input id="fl-order" name="sortOrder" type="number" step={1} defaultValue={cur.sortOrder} /></Field>
            <div className="adm-actions span2">
              <button type="button" className="adm-btn" onClick={() => setEdit(null)} disabled={busy}>cancel</button>
              <button type="submit" className="adm-btn primary" disabled={busy} aria-busy={busy}>{busy ? 'saving…' : edit === 'new' ? 'create flag' : 'save flag'}</button>
            </div>
          </form>
        </Modal>
      )}
      {del && <Confirm text={`Delete ${del.title}?`} detail={`${del.attempts} submissions on it will be removed. Points already awarded stay on the scoreboard.`} onYes={doDelete} onNo={() => setDel(null)} busy={busy} />}
    </section>
  )
}

/* ───────────────────────── submissions ───────────────────────── */
const SUB_LIMIT = 300 // the server returns at most this many rows
/** "just now" / "5m ago" / "3h ago", then the date. */
const ago = (iso: string) => {
  const s = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 1000))
  if (s < 60) return 'just now'
  if (s < 3600) return `${Math.floor(s / 60)}m ago`
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`
  return fmtAt(iso)
}

function Submissions({ notify }: { notify: (t: Toast) => void }) {
  const { api } = useAdmin()
  const [rows, setRows] = useState<Submission[] | null>(null)
  const [flags, setFlags] = useState<Flag[]>([])
  const [maxAttempts, setMaxAttempts] = useState(3)
  const [q, setQ] = useState('')
  const [flag, setFlag] = useState('')
  const [result, setResult] = useState<'all' | 'correct' | 'wrong'>('all') // client-side, so the chips can show counts for every result
  const [del, setDel] = useState<Submission | null>(null)
  const [refund, setRefund] = useState(true)
  const [busy, setBusy] = useState(false)
  const [fresh, setFresh] = useState<Set<number>>(new Set()) // ids that arrived since the last refresh (briefly highlighted)
  const lastId = useRef<number | null>(null)
  const [, setTick] = useState(0)

  useEffect(() => {
    api<{ flags: Flag[]; maxAttempts?: number }>('/flags').then((d) => { setFlags(d.flags); if (d.maxAttempts) setMaxAttempts(d.maxAttempts) }).catch(() => {})
  }, [api])

  const load = useCallback((quiet = false) => {
    const p = new URLSearchParams()
    if (q) p.set('q', q)
    if (flag) p.set('flag', flag)
    api<{ submissions: Submission[] }>(`/submissions?${p}`).then((d) => {
      const newest = d.submissions[0]?.id ?? 0
      if (lastId.current != null && newest > lastId.current) setFresh(new Set(d.submissions.filter((r) => r.id > (lastId.current as number)).map((r) => r.id)))
      lastId.current = Math.max(lastId.current ?? 0, newest)
      setRows(d.submissions)
    }).catch((e: Error) => { if (!quiet) notify({ kind: 'error', text: e.message }) })
  }, [api, q, flag, notify])
  useEffect(() => { lastId.current = null; setFresh(new Set()) }, [q, flag]) // a new filter is a new baseline, not "new activity"
  useEffect(() => { const t = window.setTimeout(() => load(), q ? 250 : 0); return () => window.clearTimeout(t) }, [load, q])
  // keep the audit log live: refresh every 10s while the tab is visible, and re-render relative times every 30s
  useEffect(() => {
    const poll = () => { if (document.visibilityState === 'visible') load(true) }
    const a = window.setInterval(poll, 10000)
    const b = window.setInterval(() => setTick((t) => t + 1), 30000)
    document.addEventListener('visibilitychange', poll)
    return () => { window.clearInterval(a); window.clearInterval(b); document.removeEventListener('visibilitychange', poll) }
  }, [load])

  const view = useMemo(() => {
    const all = rows ?? []
    const level = new Map(flags.map((f) => [f.id, f.level]))
    const right = all.filter((r) => r.correct).length
    const shown = all.filter((r) => result === 'all' || (result === 'correct') === !!r.correct)
    // "attempt n of max" per student and flag; only trustworthy while the list isn't cut off at the server limit
    const seen = new Map<string, number>()
    const attempt = new Map<number, number>()
    for (const r of [...all].reverse()) { const k = `${r.student_id}|${r.flag_id}`; const n = (seen.get(k) ?? 0) + 1; seen.set(k, n); attempt.set(r.id, n) }
    return {
      all, shown, level, attempt, right, wrong: all.length - right, complete: all.length < SUB_LIMIT,
      students: new Set(all.map((r) => r.student_id)).size, flagsN: new Set(all.map((r) => r.flag_id)).size,
      hit: all.length ? Math.round((right / all.length) * 100) : 0,
    }
  }, [rows, flags, result])

  const doDelete = async () => {
    if (busy || !del) return
    setBusy(true)
    try {
      const r = await api<{ refunded?: number }>(`/submissions/${del.id}${del.correct && refund ? '?refund=1' : ''}`, { method: 'DELETE' })
      notify({ kind: 'ok', text: `Submission removed. ${del.student} gets that attempt back${r.refunded ? ` and ${r.refunded.toLocaleString('en-IN')} points were taken back` : ''}.` })
      setDel(null); load()
    } catch (err) { notify({ kind: 'error', text: (err as Error).message }) } finally { setBusy(false) }
  }

  const resultBadge = (r: Submission) => (
    <span className={`sb-badge ${r.correct ? 'ok' : 'bad'}`}>
      {r.correct ? `[✓] correct +${r.points.toLocaleString('en-IN')}` : '[✗] wrong'}
    </span>
  )
  const attemptNote = (r: Submission) => (view.complete ? <small className="tmuted sb-attempt">attempt {view.attempt.get(r.id)}/{maxAttempts}</small> : null)
  const avatar = (name: string) => <span className="st-avatar" aria-hidden="true">{name.trim().charAt(0).toUpperCase()}</span>
  const flagCell = (r: Submission) => (
    <>
      <span className="fl-name"><b>{r.flag}</b>{view.level.get(r.flag_id) && <span className={`adm-lvl t-${view.level.get(r.flag_id)}`}>{view.level.get(r.flag_id)}</span>}</span>
      <small className="tmuted">{r.points.toLocaleString('en-IN')} pts</small>
    </>
  )
  const removeBtn = (r: Submission) => (
    <button type="button" className="adm-btn sm danger" onClick={() => { setRefund(true); setDel(r) }} aria-label={`Remove this ${r.correct ? 'correct' : 'wrong'} submission by ${r.student} for ${r.flag}`}>remove</button>
  )

  return (
    <section className="dcard dcard-wide st sb" aria-labelledby="a-sub">
      <div className="dcard-head">
        <h2 id="a-sub" className="dcard-h"><span className="tp-dollar">$</span> ./submissions --audit {rows && <span className="tmuted">({view.shown.length}{view.shown.length !== rows.length ? ` of ${rows.length}` : ''}{rows.length >= SUB_LIMIT ? '+' : ''})</span>}</h2>
        <div className="adm-tools">
          <label className="adm-search">
            <SearchIcon /><span className="sr-only">Search by student</span>
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="student name or email" />
            {q && <button type="button" className="st-clear" onClick={() => setQ('')} aria-label="Clear search"><CloseIcon /></button>}
          </label>
        </div>
      </div>

      {rows && (
        <>
          <ul className="st-stats" aria-label="Summary">
            <li><small>submissions</small><b>{view.all.length}{view.complete ? '' : '+'}</b><span>{view.students} student{view.students === 1 ? '' : 's'} · {view.flagsN} flag{view.flagsN === 1 ? '' : 's'}</span></li>
            <li><small>correct</small><b className="sb-n-ok">{view.right}</b><span>{view.hit}% hit rate</span></li>
            <li><small>wrong</small><b className="sb-n-bad">{view.wrong}</b></li>
            <li><small>live</small><b className="sb-live"><i aria-hidden="true" />on</b><span>refreshes every 10s</span></li>
          </ul>
          <div className="st-filters">
            <div className="st-chips" role="group" aria-label="Filter by result">
              {(['all', 'correct', 'wrong'] as const).map((k) => (
                <button key={k} type="button" data-res={k} aria-pressed={result === k} onClick={() => setResult(k)}>{k} <i>{k === 'all' ? view.all.length : k === 'correct' ? view.right : view.wrong}</i></button>
              ))}
            </div>
            <label className="adm-select st-sort"><span className="sr-only">Flag</span>
              <select value={flag} onChange={(e) => setFlag(e.target.value)}><option value="">all flags</option>{flags.map((f) => <option key={f.id} value={f.id}>{f.title}</option>)}</select>
            </label>
          </div>
        </>
      )}

      {!rows && <p className="tmuted"><span className="tspin" aria-hidden="true" /> loading…</p>}
      {rows && rows.length === 0 && (
        <div className="st-empty">
          <p><b>{q || flag ? 'No submissions match these filters.' : 'No submissions yet.'}</b></p>
          <p className="tmuted">{q || flag ? 'Try a different name, email or flag.' : 'Attempts appear here live as students submit flags.'}</p>
          {(q || flag) && <button type="button" className="adm-btn sm" onClick={() => { setQ(''); setFlag('') }}>clear filters</button>}
        </div>
      )}
      {rows && rows.length > 0 && view.shown.length === 0 && <p className="tmuted">No {result} submissions in this view.</p>}

      {view.shown.length > 0 && (
        <>
          <div className="adm-tablewrap st-table sb-table">
            <table className="lb-table adm-table">
              <colgroup><col className="c-sb-when" /><col /><col className="c-sb-flag" /><col className="c-sb-ans" /><col className="c-sb-res" /><col className="c-sb-act" /></colgroup>
              <thead><tr><th>when</th><th>student</th><th>flag</th><th>answer</th><th>result</th><th className="sr-only">actions</th></tr></thead>
              <tbody>
                {view.shown.map((r) => (
                  <tr key={r.id} className={`sb-row ${r.correct ? 'ok' : 'bad'}${fresh.has(r.id) ? ' ov-new' : ''}`}>
                    <td className="sb-when"><time dateTime={r.created_at} title={fmtAt(r.created_at)}>{ago(r.created_at)}</time><small className="tmuted">{fmtAt(r.created_at)}</small></td>
                    <td><span className="st-who">{avatar(r.student)}<span className="st-id"><b>{r.student}</b><span className="tmuted adm-small">{r.email}</span></span></span></td>
                    <td>{flagCell(r)}</td>
                    <td><code className="sb-ans" title={r.answer}>{r.answer}</code></td>
                    <td>{resultBadge(r)}{attemptNote(r)}</td>
                    <td className="adm-rowactions">{removeBtn(r)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <ul className="st-cards sb-cards" aria-label="Submissions">
            {view.shown.map((r) => (
              <li key={r.id} className={`st-card sb-card ${r.correct ? 'ok' : 'bad'}${fresh.has(r.id) ? ' ov-new' : ''}`}>
                <div className="st-card-top">
                  {avatar(r.student)}
                  <span className="st-id"><b>{r.student}</b><span className="tmuted adm-small">{r.email}</span></span>
                  <time className="tmuted adm-small" dateTime={r.created_at}>{ago(r.created_at)}</time>
                </div>
                <div className="sb-card-row">{resultBadge(r)}{attemptNote(r)}</div>
                <div className="sb-card-flag">{flagCell(r)}</div>
                <code className="sb-ans" title={r.answer}>{r.answer}</code>
                <div className="st-card-actions">{removeBtn(r)}</div>
              </li>
            ))}
          </ul>
        </>
      )}

      {del && (
        <Modal title="submissions --remove" onClose={() => { if (!busy) setDel(null) }}>
          <p className="adm-confirm">Remove this {del.correct ? 'correct' : 'wrong'} submission by {del.student} for {del.flag}?</p>
          <code className="sd-answer">{del.answer}</code>
          <p className="tmuted adm-confirm-sub">{del.correct ? 'The flag shows as unsolved again for them, and they get the attempt back.' : 'They get this attempt back on the flag.'}</p>
          {del.correct && (
            <label className="sd-check">
              <input type="checkbox" checked={refund} onChange={(e) => setRefund(e.target.checked)} />
              <span>Also take back the points this capture awarded. Leave this ticked unless you plan to adjust the score yourself, otherwise they could earn the flag a second time.</span>
            </label>
          )}
          <div className="adm-actions">
            <button type="button" className="adm-btn" onClick={() => setDel(null)} disabled={busy} autoFocus>cancel</button>
            <button type="button" className="adm-btn danger" onClick={doDelete} disabled={busy} aria-busy={busy}>{busy ? 'removing…' : 'yes, remove'}</button>
          </div>
        </Modal>
      )}
    </section>
  )
}
