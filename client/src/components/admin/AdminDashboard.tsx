import { useCallback, useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react'
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
const EMPTY_FLAG = { title: '', points: 100, level: 'easy' as const, frozen: false, answer: '', questionUrl: '', sortOrder: 0 }

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

  const load = useCallback(() => {
    api<{ flags: Flag[] }>('/flags').then((d) => setRows(d.flags)).catch((e: Error) => notify({ kind: 'error', text: e.message }))
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
      else { await api(`/flags/${edit.id}`, { method: 'PUT', body }); notify({ kind: 'ok', text: `${body.title} saved.` }) }
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

  const savePoints = async (f: Flag) => {
    if (busy) return
    const pts = Number(ptsDraft)
    if (!Number.isInteger(pts) || pts < 1 || pts > 100000) { setPtsErr('Whole number 1–100000.'); return }
    if (pts === f.points) { setPtsEdit(null); return }
    setBusy(true); setPtsErr('')
    try {
      await api(`/flags/${f.id}/points`, { method: 'PATCH', body: { points: pts } })
      notify({ kind: 'ok', text: `${f.title} is now worth ${pts} pts.` }); setPtsEdit(null); load()
    } catch (err) { setPtsErr((err as Error).message) } finally { setBusy(false) }
  }

  const cur = edit && edit !== 'new' ? edit : { ...EMPTY_FLAG, sortOrder: rows?.length ?? 0 }
  return (
    <section className="dcard dcard-wide" aria-labelledby="a-fl">
      <div className="dcard-head">
        <h2 id="a-fl" className="dcard-h"><span className="tp-dollar">$</span> ./flags --manage {rows && <span className="tmuted">({rows.length})</span>}</h2>
        <div className="adm-tools">
          <span className="tmuted adm-small">frozen flags stay visible but accept no submissions</span>
          <button type="button" className="adm-btn primary" onClick={() => { setErrors({}); setEdit('new') }}><PlusIcon /> new flag</button>
        </div>
      </div>

      {!rows && <p className="tmuted"><span className="tspin" aria-hidden="true" /> loading…</p>}
      {rows && rows.length === 0 && <p className="tmuted">No flags yet. Create the first one.</p>}
      {rows && rows.length > 0 && (
        <div className="adm-tablewrap">
          <table className="lb-table adm-table">
            <thead><tr><th>order</th><th>flag</th><th>level</th><th>state</th><th>answer</th><th>question</th><th>solved</th><th className="sr-only">actions</th></tr></thead>
            <tbody>
              {rows.map((f) => (
                <tr key={f.id}>
                  <td>{f.sortOrder}</td>
                  <td>
                    <b>{f.title}</b><br />
                    {ptsEdit === f.id ? (
                      <form className="adm-ptsform" onSubmit={(e) => { e.preventDefault(); savePoints(f) }} noValidate>
                        <label className="sr-only" htmlFor={`pts-${f.id}`}>Points for {f.title}</label>
                        <input id={`pts-${f.id}`} type="number" min={1} max={100000} step={1} value={ptsDraft} onChange={(e) => { setPtsDraft(e.target.value); setPtsErr('') }}
                          onKeyDown={(e) => { if (e.key === 'Escape') setPtsEdit(null) }} aria-invalid={!!ptsErr} autoFocus />
                        <button type="submit" className="adm-btn sm primary" disabled={busy} aria-busy={busy}>{busy ? '…' : 'save'}</button>
                        <button type="button" className="adm-btn sm" onClick={() => setPtsEdit(null)} disabled={busy}>cancel</button>
                      </form>
                    ) : (
                      <button type="button" className="adm-pts" onClick={() => { setPtsDraft(String(f.points)); setPtsErr(''); setPtsEdit(f.id) }} aria-label={`Edit points for ${f.title}, currently ${f.points}`} title="Edit points">
                        {f.points} pts <span aria-hidden="true">✎</span>
                      </button>
                    )}
                    {ptsEdit === f.id && ptsErr && <span className="adm-ptserr" role="alert">{ptsErr}</span>}
                  </td>
                  <td><span className={`adm-lvl t-${f.level}`}>{f.level}</span></td>
                  <td>{f.frozen ? <span className="adm-state frozen">[❄] frozen</span> : <span className="adm-state live">[●] live</span>}</td>
                  <td>
                    <span className="adm-answer">
                      <code>{reveal[f.id] ? f.answer || <i className="tmuted">(not set)</i> : '••••••••••'}</code>
                      <button type="button" className="adm-btn sm" onClick={() => setReveal((m) => ({ ...m, [f.id]: !m[f.id] }))} aria-pressed={!!reveal[f.id]}>{reveal[f.id] ? 'hide' : 'show'}</button>
                    </span>
                  </td>
                  <td>{f.questionUrl ? <a className="adm-link" href={f.questionUrl} target="_blank" rel="noopener noreferrer">{f.questionUrl.replace(/^https?:\/\//, '').slice(0, 36)}{f.questionUrl.length > 44 ? '…' : ''}</a> : <span className="tmuted">—</span>}</td>
                  <td>{f.captures} <span className="tmuted adm-small">/ {f.attempts} tries</span></td>
                  <td className="adm-rowactions">
                    <button type="button" className={`adm-btn sm${f.frozen ? ' warm' : ' cold'}`} onClick={() => toggleFreeze(f)} disabled={busy} aria-pressed={f.frozen}>{f.frozen ? 'unfreeze' : 'freeze'}</button>
                    <button type="button" className="adm-btn sm" onClick={() => { setErrors({}); setEdit(f) }}>edit</button>
                    <button type="button" className="adm-btn sm danger" onClick={() => setDel(f)}>delete</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
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
function Submissions({ notify }: { notify: (t: Toast) => void }) {
  const { api } = useAdmin()
  const [rows, setRows] = useState<Submission[] | null>(null)
  const [flags, setFlags] = useState<Flag[]>([])
  const [q, setQ] = useState('')
  const [flag, setFlag] = useState('')
  const [correct, setCorrect] = useState('')
  const [del, setDel] = useState<Submission | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => { api<{ flags: Flag[] }>('/flags').then((d) => setFlags(d.flags)).catch(() => {}) }, [api])
  const load = useCallback(() => {
    const p = new URLSearchParams()
    if (q) p.set('q', q)
    if (flag) p.set('flag', flag)
    if (correct) p.set('correct', correct)
    api<{ submissions: Submission[] }>(`/submissions?${p}`).then((d) => setRows(d.submissions)).catch((e: Error) => notify({ kind: 'error', text: e.message }))
  }, [api, q, flag, correct, notify])
  useEffect(() => { const t = window.setTimeout(load, q ? 250 : 0); return () => window.clearTimeout(t) }, [load, q])

  const doDelete = async () => {
    if (busy || !del) return
    setBusy(true)
    try { await api(`/submissions/${del.id}`, { method: 'DELETE' }); notify({ kind: 'ok', text: 'Submission removed — the student gets that attempt back.' }); setDel(null); load() }
    catch (err) { notify({ kind: 'error', text: (err as Error).message }) } finally { setBusy(false) }
  }

  return (
    <section className="dcard dcard-wide" aria-labelledby="a-sub">
      <div className="dcard-head">
        <h2 id="a-sub" className="dcard-h"><span className="tp-dollar">$</span> ./submissions --audit {rows && <span className="tmuted">({rows.length}{rows.length === 300 ? '+' : ''})</span>}</h2>
        <div className="adm-tools">
          <label className="adm-search"><SearchIcon /><span className="sr-only">Search by student</span><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="student name or email" /></label>
          <label className="adm-select"><span className="sr-only">Flag</span>
            <select value={flag} onChange={(e) => setFlag(e.target.value)}><option value="">all flags</option>{flags.map((f) => <option key={f.id} value={f.id}>{f.title}</option>)}</select>
          </label>
          <label className="adm-select"><span className="sr-only">Result</span>
            <select value={correct} onChange={(e) => setCorrect(e.target.value)}><option value="">any result</option><option value="1">correct</option><option value="0">wrong</option></select>
          </label>
        </div>
      </div>

      {!rows && <p className="tmuted"><span className="tspin" aria-hidden="true" /> loading…</p>}
      {rows && rows.length === 0 && <p className="tmuted">No submissions match.</p>}
      {rows && rows.length > 0 && (
        <div className="adm-tablewrap">
          <table className="lb-table adm-table">
            <thead><tr><th>when</th><th>student</th><th>flag</th><th>answer</th><th>result</th><th className="sr-only">actions</th></tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className={r.correct ? 'adm-ok' : ''}>
                  <td className="adm-nowrap">{fmtAt(r.created_at)}</td>
                  <td><b>{r.student}</b><br /><span className="tmuted adm-small">{r.email}</span></td>
                  <td>{r.flag} <span className="tmuted adm-small">· {r.points} pts</span></td>
                  <td><code className="adm-ans">{r.answer}</code></td>
                  <td>{r.correct ? <span className="adm-res ok">[✓] correct</span> : <span className="adm-res bad">[✗] wrong</span>}</td>
                  <td className="adm-rowactions"><button type="button" className="adm-btn sm danger" onClick={() => setDel(r)}>remove</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {del && <Confirm text={`Remove this ${del.correct ? 'correct' : 'wrong'} submission by ${del.student}?`} detail={del.correct ? 'The flag shows as unsolved again for them. Points already awarded are NOT removed — adjust the score from the students tab if needed.' : 'They get the attempt back on this flag.'} onYes={doDelete} onNo={() => setDel(null)} busy={busy} />}
    </section>
  )
}
