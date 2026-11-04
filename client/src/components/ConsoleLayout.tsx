import { useEffect, useState, type ReactNode } from 'react'
import avatar from '../assets/hacker-avatar.webp'
import logo from '../assets/shm-logo.webp'
import { useAuth, type Student } from '../hooks/useAuth'
import { navigate, onLinkClick } from '../hooks/useRoute'
import { LogoutIcon } from './Icons'

export type ConsolePage = 'dashboard' | 'profile'

/**
 * Shared frame for the signed-in pages (/dashboard, /profile): top bar with page switcher and logout,
 * plus the session guard — no session → /login; with one, the token is re-checked against the API and
 * the stored profile refreshed. Children render only once a student is available.
 */
export function ConsoleLayout({ page, children }: { page: ConsolePage; children: (student: Student) => ReactNode }) {
  const { session, student, signIn, signOut } = useAuth()
  const [checking, setChecking] = useState(true)

  useEffect(() => {
    if (!session) {
      navigate('/login', true)
      return
    }
    let cancelled = false
    fetch('/api/auth/me', { headers: { Authorization: `Bearer ${session.token}` } })
      .then(async (r) => {
        if (r.status === 401) throw new Error('expired')
        if (!r.ok) return // transient server issue: keep showing the cached profile
        const data = (await r.json()) as { student: Student }
        if (!cancelled) signIn({ token: session.token, student: data.student })
      })
      .catch((e: Error) => {
        if (e.message === 'expired') {
          signOut()
          navigate('/login', true)
        }
      })
      .finally(() => !cancelled && setChecking(false))
    return () => { cancelled = true }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  if (!student) return null
  const logout = () => {
    signOut()
    navigate('/', true)
  }

  return (
    <div className="dash">
      <header className="dash-top">
        <a className="dash-brand" href="/dashboard" onClick={onLinkClick}>
          <img src={logo} alt="" width={36} height={36} />
          <span>Cyber<b>Ops</b><small>student console</small></span>
        </a>
        <span className="dash-session"><span className="dot" aria-hidden="true" /> {checking ? 'verifying session' : 'session verified'}</span>
        <nav className="dash-actions" aria-label="Account">
          <a
            className={page === 'profile' ? 'dash-avatar on' : 'dash-avatar'}
            href="/profile"
            onClick={onLinkClick}
            aria-label={`Profile — ${student.fullName}`}
            aria-current={page === 'profile' ? 'page' : undefined}
            title="Your profile"
          >
            <img src={avatar} alt="" width={40} height={40} />
          </a>
          <button className="dash-logout" type="button" onClick={logout}><LogoutIcon /> Logout</button>
        </nav>
      </header>
      <main className="dash-main" id="main">{children(student)}</main>
    </div>
  )
}
