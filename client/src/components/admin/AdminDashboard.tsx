import { useCallback, useEffect, useState, type FormEvent, type ReactNode } from 'react'
import { ApiError, useAdmin } from '../../hooks/useAdmin'
import { CloseIcon, PlusIcon, SearchIcon } from '../Icons'

/* ───────────────────────── types ───────────────────────── */
interface Student { id: number; fullName: string; email: string; phone: string; institution: string; branch: string; rollNumber: string; score: number; createdAt: string; solved: number; attempts: number }
interface Flag { id: number; title: string; points: number; answer: string; questionUrl: string; sortOrder: number; attempts: number; captures: number }
interface Submission { id: number; answer: string; correct: 0 | 1; created_at: string; student_id: number; student: string; email: string; flag_id: number; flag: string; points: number }
interface Stats {
  students: number; points: number; colleges: number; flags: number; totalPoints: number; submissions: number; captures: number
  perFlag: { id: number; title: string; points: number; attempts: number; captures: number }[]
  recent: { id: number; correct: 0 | 1; created_at: string; answer: string; student: string; flag: string }[]
}
type Tab = 'overview' | 'students' | 'flags' | 'submissions'
type Toast = { kind: 'ok' | 'error'; text: string } | null

const TABS: { key: Tab; cmd: string }[] = [
  { key: 'overview', cmd: 'status' },
  { key: 'students', cmd: 'students' },
  { key: 'flags', cmd: 'flags' },
  { key: 'submissions', cmd: 'submissions' },
]
const fmtAt = (iso: string) => new Date(iso).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', hour12: false })

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
      <div className="dash-head">
        <p className="tprompt"><span className="tp-user">root@cyberops</span><span className="tp-path">:~#</span> <span className="tp-cmd">./console --{TABS.find((t) => t.key === tab)?.cmd}</span></p>
        <h1>Admin console</h1>
        <nav className="adm-tabs" role="tablist" aria-label="Section">
          {TABS.map((t) => (
            <button key={t.key} role="tab" type="button" aria-selected={tab === t.key} onClick={() => setTab(t.key)}>{t.key}</button>
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

/* ───────────────────────── overview ───────────────────────── */
function Overview({ go }: { go: (t: Tab) => void }) {
  const { api } = useAdmin()
  const [s, setS] = useState<Stats | null>(null)
  const [err, setErr] = useState('')
  useEffect(() => { api<Stats>('/stats').then(setS).catch((e: Error) => setErr(e.message)) }, [api])
  if (err) return <p className="terr" role="alert"><b>[✗]</b> {err}</p>
  if (!s) return <p className="tmuted"><span className="tspin" aria-hidden="true" /> loading…</p>
  const rate = s.submissions ? Math.round((s.captures / s.submissions) * 100) : 0
  const tiles: { label: string; value: ReactNode; sub: string; to: Tab }[] = [
    { label: 'students', value: s.students, sub: `${s.colleges} colleges`, to: 'students' },
    { label: 'flags', value: s.flags, sub: `${s.totalPoints} pts available`, to: 'flags' },
    { label: 'submissions', value: s.submissions, sub: `${s.captures} captures · ${rate}% hit rate`, to: 'submissions' },
    { label: 'points awarded', value: s.points, sub: 'across all students', to: 'students' },
  ]
  return (
    <div className="dash-grid">
      <section className="dcard dcard-wide" aria-label="Headline numbers">
        <div className="adm-tiles">
          {tiles.map((t) => (
            <button key={t.label} type="button" className="adm-tile" onClick={() => go(t.to)}>
              <small>{t.label}</small><b>{t.value}</b><span className="tmuted">{t.sub}</span>
            </button>
          ))}
        </div>
      </section>

      <section className="dcard" aria-labelledby="a-pf">
        <h2 id="a-pf" className="dcard-h"><span className="tp-dollar">$</span> ./flags --solve-rate</h2>
        {s.perFlag.length === 0 && <p className="tmuted">No flags yet.</p>}
        <ul className="adm-bars">
          {s.perFlag.map((f) => {
            const pct = s.students ? Math.round((f.captures / s.students) * 100) : 0
            return (
              <li key={f.id}>
                <span className="adm-barlbl"><b>{f.title}</b> <span className="tmuted">· {f.points} pts · {f.captures}/{s.students} solved · {f.attempts} tries</span></span>
                <span className="adm-bar" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct} aria-label={`${f.title} solve rate`}><i style={{ width: `${pct}%` }} /></span>
              </li>
            )
          })}
        </ul>
      </section>

      <section className="dcard" aria-labelledby="a-rec">
        <h2 id="a-rec" className="dcard-h"><span className="tp-dollar">$</span> tail -n 12 submissions.log</h2>
        {s.recent.length === 0 && <p className="tmuted">Nothing submitted yet.</p>}
        <ol className="mlog-list adm-recent">
          {s.recent.map((r) => (
            <li key={r.id} className={`mlog-row k-${r.correct ? 'capture' : 'miss'}`}>
              <span className="mlog-time">{fmtAt(r.created_at)}</span>
              <span className="mlog-tag" aria-hidden="true">{r.correct ? '[✓]' : '[✗]'}</span>
              <span className="mlog-msg"><b>{r.student}</b> → {r.flag} {r.correct ? <span className="mlog-pts">captured</span> : <code className="adm-ans">{r.answer}</code>}</span>
            </li>
          ))}
        </ol>
      </section>
    </div>
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
    <div className="adm-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="adm-modal" role="dialog" aria-modal="true" aria-labelledby="adm-modal-h">
        <div className="adm-modal-head">
          <h2 id="adm-modal-h" className="dcard-h"><span className="tp-dollar">$</span> {title}</h2>
          <button type="button" className="adm-icon" onClick={onClose} aria-label="Close"><CloseIcon /></button>
        </div>
        {children}
      </div>
    </div>
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

  const load = useCallback(() => {
    api<{ students: Student[] }>(`/students?q=${encodeURIComponent(q)}`).then((d) => setRows(d.students)).catch((e: Error) => notify({ kind: 'error', text: e.message }))
  }, [api, q, notify])
  useEffect(() => { const t = window.setTimeout(load, q ? 250 : 0); return () => window.clearTimeout(t) }, [load, q])

  const save = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (busy || !edit) return
    const body = Object.fromEntries(new FormData(e.currentTarget)) as typeof EMPTY_STUDENT
    setBusy(true); setErrors({})
    try {
      if (edit === 'new') { await api('/students', { method: 'POST', body }); notify({ kind: 'ok', text: `${body.fullName} added.` }) }
      else { await api(`/students/${edit.id}`, { method: 'PUT', body }); notify({ kind: 'ok', text: `${body.fullName} updated.` }) }
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
      await api(`/students/${award.id}/score`, { method: 'POST', body: { points: Number(fd.get('points')), note: fd.get('note') } })
      notify({ kind: 'ok', text: `Score updated for ${award.fullName}.` }); setAward(null); load()
    } catch (err) { notify({ kind: 'error', text: (err as Error).message }) } finally { setBusy(false) }
  }
  const doDelete = async () => {
    if (busy || !del) return
    setBusy(true)
    try { await api(`/students/${del.id}`, { method: 'DELETE' }); notify({ kind: 'ok', text: `${del.fullName} removed.` }); setDel(null); load() }
    catch (err) { notify({ kind: 'error', text: (err as Error).message }) } finally { setBusy(false) }
  }

  const cur = edit && edit !== 'new' ? edit : EMPTY_STUDENT
  return (
    <section className="dcard dcard-wide" aria-labelledby="a-st">
      <div className="dcard-head">
        <h2 id="a-st" className="dcard-h"><span className="tp-dollar">$</span> ./students --list {rows && <span className="tmuted">({rows.length})</span>}</h2>
        <div className="adm-tools">
          <label className="adm-search"><SearchIcon /><span className="sr-only">Search students</span><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="name, email, college, roll" /></label>
          <button type="button" className="adm-btn primary" onClick={() => { setErrors({}); setEdit('new') }}><PlusIcon /> add student</button>
        </div>
      </div>

      {!rows && <p className="tmuted"><span className="tspin" aria-hidden="true" /> loading…</p>}
      {rows && rows.length === 0 && <p className="tmuted">No students match.</p>}
      {rows && rows.length > 0 && (
        <div className="adm-tablewrap">
          <table className="lb-table adm-table">
            <thead><tr><th>#</th><th>student</th><th>college</th><th>roll</th><th>flags</th><th>score</th><th className="sr-only">actions</th></tr></thead>
            <tbody>
              {rows.map((s, i) => (
                <tr key={s.id}>
                  <td>{i + 1}</td>
                  <td><b>{s.fullName}</b><br /><span className="tmuted adm-small">{s.email} · {s.phone}</span></td>
                  <td>{s.institution}<br /><span className="tmuted adm-small">{s.branch}</span></td>
                  <td><code>{s.rollNumber}</code></td>
                  <td>{s.solved} <span className="tmuted adm-small">/ {s.attempts} tries</span></td>
                  <td className="adm-num"><b>{s.score}</b></td>
                  <td className="adm-rowactions">
                    <button type="button" className="adm-btn sm" onClick={() => setAward(s)}>± pts</button>
                    <button type="button" className="adm-btn sm" onClick={() => { setErrors({}); setEdit(s) }}>edit</button>
                    <button type="button" className="adm-btn sm danger" onClick={() => setDel(s)}>delete</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
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
const EMPTY_FLAG = { title: '', points: 100, answer: '', questionUrl: '', sortOrder: 0 }

function Flags({ notify }: { notify: (t: Toast) => void }) {
  const { api } = useAdmin()
  const [rows, setRows] = useState<Flag[] | null>(null)
  const [reveal, setReveal] = useState<Record<number, boolean>>({})
  const [edit, setEdit] = useState<Flag | 'new' | null>(null)
  const [del, setDel] = useState<Flag | null>(null)
  const [busy, setBusy] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})

  const load = useCallback(() => {
    api<{ flags: Flag[] }>('/flags').then((d) => setRows(d.flags)).catch((e: Error) => notify({ kind: 'error', text: e.message }))
  }, [api, notify])
  useEffect(load, [load])

  const save = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (busy || !edit) return
    const fd = new FormData(e.currentTarget)
    const body = { title: fd.get('title'), points: Number(fd.get('points')), answer: fd.get('answer'), questionUrl: fd.get('questionUrl'), sortOrder: Number(fd.get('sortOrder')) }
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

  const cur = edit && edit !== 'new' ? edit : { ...EMPTY_FLAG, sortOrder: rows?.length ?? 0 }
  const tier = (p: number) => (p <= 300 ? 'easy' : p <= 700 ? 'medium' : 'hard')
  return (
    <section className="dcard dcard-wide" aria-labelledby="a-fl">
      <div className="dcard-head">
        <h2 id="a-fl" className="dcard-h"><span className="tp-dollar">$</span> ./flags --manage {rows && <span className="tmuted">({rows.length})</span>}</h2>
        <div className="adm-tools">
          <span className="tmuted adm-small">levels by points: ≤300 easy · ≤700 medium · &gt;700 hard</span>
          <button type="button" className="adm-btn primary" onClick={() => { setErrors({}); setEdit('new') }}><PlusIcon /> new flag</button>
        </div>
      </div>

      {!rows && <p className="tmuted"><span className="tspin" aria-hidden="true" /> loading…</p>}
      {rows && rows.length === 0 && <p className="tmuted">No flags yet. Create the first one.</p>}
      {rows && rows.length > 0 && (
        <div className="adm-tablewrap">
          <table className="lb-table adm-table">
            <thead><tr><th>order</th><th>flag</th><th>level</th><th>answer</th><th>question</th><th>solved</th><th className="sr-only">actions</th></tr></thead>
            <tbody>
              {rows.map((f) => (
                <tr key={f.id}>
                  <td>{f.sortOrder}</td>
                  <td><b>{f.title}</b><br /><span className="tmuted adm-small">{f.points} pts</span></td>
                  <td><span className={`adm-lvl t-${tier(f.points)}`}>{tier(f.points)}</span></td>
                  <td>
                    <span className="adm-answer">
                      <code>{reveal[f.id] ? f.answer || <i className="tmuted">(not set)</i> : '••••••••••'}</code>
                      <button type="button" className="adm-btn sm" onClick={() => setReveal((m) => ({ ...m, [f.id]: !m[f.id] }))} aria-pressed={!!reveal[f.id]}>{reveal[f.id] ? 'hide' : 'show'}</button>
                    </span>
                  </td>
                  <td>{f.questionUrl ? <a className="adm-link" href={f.questionUrl} target="_blank" rel="noopener noreferrer">{f.questionUrl.replace(/^https?:\/\//, '').slice(0, 36)}{f.questionUrl.length > 44 ? '…' : ''}</a> : <span className="tmuted">—</span>}</td>
                  <td>{f.captures} <span className="tmuted adm-small">/ {f.attempts} tries</span></td>
                  <td className="adm-rowactions">
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
            <Field id="fl-points" label="Points" error={errors.points} hint="Decides the level: ≤300 easy, ≤700 medium, else hard"><input id="fl-points" name="points" type="number" min={1} step={1} defaultValue={cur.points} required /></Field>
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
