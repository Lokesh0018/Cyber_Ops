import { useEffect, useState, type FormEvent } from 'react'
import logo from '../../assets/shm-logo.webp'
import { useAdmin, type AdminSession } from '../../hooks/useAdmin'
import { navigate, onLinkClick } from '../../hooks/useRoute'
import { ArrowRightIcon, EyeIcon, EyeOffIcon, LogoutIcon, ShieldIcon } from '../Icons'
import { AdminDashboard } from './AdminDashboard'

/** /admin — organiser sign-in, then the admin console. The session is separate from the student one. */
export function AdminPage() {
  const { session, signOut } = useAdmin()
  useEffect(() => { document.title = session ? 'CyberOps · Admin console' : 'CyberOps · Admin sign-in' }, [session])
  if (!session) return <AdminLogin />
  return (
    <div className="dash adm">
      <header className="dash-top">
        <a className="dash-brand" href="/admin" onClick={onLinkClick}>
          <img src={logo} alt="" width={36} height={36} />
          <span>Cyber<b>Ops</b><small>admin console</small></span>
        </a>
        <span className="dash-session adm-session"><ShieldIcon /> {session.admin.email}</span>
        <nav className="dash-actions" aria-label="Account">
          <button className="dash-logout" type="button" onClick={() => { signOut(); navigate('/admin', true) }}><LogoutIcon /> Logout</button>
        </nav>
      </header>
      <main className="dash-main" id="main"><AdminDashboard /></main>
    </div>
  )
}

function AdminLogin() {
  const { signIn } = useAdmin()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [show, setShow] = useState(false)

  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (busy) return
    const fd = new FormData(e.currentTarget)
    setBusy(true)
    setError('')
    try {
      const r = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: fd.get('email'), password: fd.get('password') }),
      })
      const data = (await r.json().catch(() => ({}))) as Partial<AdminSession> & { message?: string }
      if (!r.ok || !data.token || !data.admin) throw new Error(data.message ?? 'Sign-in failed.')
      signIn({ token: data.token, admin: data.admin })
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="authpage adm-login" id="main">
      <div className="term-window adm-win">
        <div className="term-head">
          <span className="term-dots" aria-hidden="true"><i /><i /><i /></span>
          <span className="term-title">root@cyberops: ~/admin</span>
        </div>
        <form className="adm-form" onSubmit={submit} noValidate>
          <p className="tprompt"><span className="tp-user">root@cyberops</span><span className="tp-path">:~#</span> <span className="tp-cmd">sudo ./console --admin</span></p>
          <h1 className="adm-h1"><ShieldIcon /> Organiser sign-in</h1>
          <p className="adm-sub tmuted">Restricted. Every action here is live for all students.</p>

          <div className={`tfield${error ? ' err' : ''}`}>
            <label htmlFor="adm-email" className="tprompt"><span className="tp-cmd">email</span></label>
            <div className="tline">
              <span className="tp-gt" aria-hidden="true">&gt;</span>
              <input id="adm-email" name="email" className="tinput" type="email" autoComplete="username" required autoFocus placeholder="admin@domain" />
            </div>
          </div>
          <div className={`tfield${error ? ' err' : ''}`}>
            <label htmlFor="adm-pass" className="tprompt"><span className="tp-cmd">password</span></label>
            <div className="tline">
              <span className="tp-gt" aria-hidden="true">&gt;</span>
              <input id="adm-pass" name="password" className="tinput" type={show ? 'text' : 'password'} autoComplete="current-password" required placeholder="••••••••" />
              <button type="button" className="adm-eye" onClick={() => setShow((v) => !v)} aria-label={show ? 'Hide password' : 'Show password'} aria-pressed={show}>
                {show ? <EyeOffIcon /> : <EyeIcon />}
              </button>
            </div>
          </div>

          <div className="term-toast-slot" aria-live="assertive">
            {error && <p className="term-toast error" role="alert"><b>[✗]</b> {error}</p>}
          </div>

          <button className="tbtn" type="submit" disabled={busy} aria-busy={busy}>
            <span className="tbtn-br">[</span> {busy ? 'AUTHENTICATING' : 'ENTER CONSOLE'} <ArrowRightIcon /> <span className="tbtn-br">]</span>
          </button>
          <p className="adm-back"><a href="/" onClick={onLinkClick}>← back to site</a></p>
        </form>
      </div>
    </div>
  )
}
