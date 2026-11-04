import { useState, type CSSProperties } from 'react'
import logo from '../assets/shm-logo.webp'
import { included } from '../data/content'
import { type AuthSession } from '../hooks/useAuth'
import { navigate, onLinkClick } from '../hooks/useRoute'
import { LoginForm, SignupForm, loginStatus, signupStatus, type Notice, type StatusItem } from './AuthForms'
import { CheckIcon, ShieldIcon } from './Icons'

export type AuthMode = 'login' | 'register'

/* Terminal banner per mode: title, subtitle, the command being "run", and its status lines. */
const copy = {
  login: {
    title: 'CYBEROPS AUTHENTICATION SYSTEM',
    sub: 'Secure student access terminal',
    cmd: './cyberops login',
    hint: 'Enter your credentials to continue.',
  },
  register: {
    title: 'CYBEROPS STUDENT ENROLLMENT',
    sub: 'Bootcamp registration terminal',
    cmd: './cyberops register',
    hint: 'Initialize your student profile.',
  },
} as const

/** Full-page login / register, routed at /login and /register. */
export function AuthPage({ mode }: { mode: AuthMode }) {
  const c = copy[mode]
  // Live banner: the form reports its state on every keystroke. It resets with the route, since the form re-mounts empty.
  const emptyStatus = (m: AuthMode) => (m === 'register' ? signupStatus : loginStatus)(new FormData())
  const [status, setStatusRaw] = useState<{ mode: AuthMode; items: StatusItem[]; notice?: Notice }>(() => ({ mode, items: emptyStatus(mode) }))
  const items = status.mode === mode ? status.items : emptyStatus(mode)
  const notice = status.mode === mode ? status.notice : undefined
  const setStatus = (next: StatusItem[], n?: Notice) => setStatusRaw({ mode, items: next, notice: n })
  const pct = Math.round((items.filter((s) => s.kind === 'ok').length / items.length) * 100)

  const onSuccess = (s: AuthSession) => {
    // Session is already stored by the form; hand off to the landing page with a welcome banner.
    navigate(`/?welcome=${mode === 'register' ? 'new' : 'back'}#top`, true)
    void s
  }

  return (
    <div className="authpage">
      <div className="authshell">
      {/* Left: brand + what you get */}
      <aside className="authside" aria-label="About the bootcamp">
        <div className="authside-bg" aria-hidden="true">
          <div className="authside-grid" />
          <div className="authside-glow" />
          <div className="authside-kali" />
        </div>
        <a className="authside-brand" href="/" onClick={onLinkClick}>
          <img src={logo} alt="" width={44} height={44} />
          <span>Cyber<b>Ops</b><small>by SHM Technologies</small></span>
        </a>

        <div className="authside-body">
          <p className="authside-kicker"><ShieldIcon /> 2-day immersive workshop</p>
          <h2>Learn offense. <br /><em>Build defense.</em></h2>
          <p className="authside-lead">
            Hands-on labs on real industry tooling, SHM’s own AutoVAPT scanner, and a capture-the-flag finale.
          </p>
          <ul className="authside-perks" aria-label="What's included">
            {included.map((item, i) => (
              <li key={item} style={{ '--i': i } as CSSProperties}><CheckIcon /> {item}</li>
            ))}
          </ul>
        </div>

        <div className="authside-term" aria-hidden="true">
          <div className="authside-term-bar"><i /><i /><i /><span>enroll.sh</span></div>
          <div className="authside-term-body">
            <div><span className="p">$</span> <span className="c">./enroll</span> --seat student</div>
            <div><span className="o">[+] Lab environment .......</span> <span className="ok">ready</span></div>
            <div><span className="o">[+] Seats remaining .......</span> <span className="v">limited</span></div>
            <div><span className="p">participant@cyberops</span><span className="o">:~$</span> <span className="cursor" /></div>
          </div>
        </div>
      </aside>

      {/* Right: the terminal */}
      <main className="authmain" id="main">
        {/* Compact header for phones; the brand panel above is hidden there */}
        <div className="authmobile-brand">
          <a href="/" onClick={onLinkClick}>
            <img src={logo} alt="" width={34} height={34} />
            <span>Cyber<b>Ops</b><small>by SHM Technologies</small></span>
          </a>
          <span className="authmobile-kicker">2-day workshop</span>
        </div>
        {/* Constant-width wrapper: header row + terminal. Nothing here depends on which form renders below. */}
        <div className="authform-wrap" data-mode={mode}>
          <div className="auth-top">
            <nav className="auth-switcher" data-mode={mode} aria-label="Login or register">
              <a href="/login" aria-current={mode === 'login' ? 'page' : undefined} onClick={onLinkClick}>Login</a>
              <a href="/register" aria-current={mode === 'register' ? 'page' : undefined} onClick={onLinkClick}>Register</a>
            </nav>
            <a className="auth-back" href="/" onClick={onLinkClick}>&larr; Back to site</a>
          </div>

          <section className="term-window" aria-labelledby="auth-title">
            <div className="term-head">
              <span className="term-dots" aria-hidden="true"><i /><i /><i /></span>
              <span className="term-title">cyberops-auth@shm</span>
              <span className="term-session"><span className="dot" aria-hidden="true" /> Session active</span>
            </div>
            {/* Keyed by mode: the banner and form re-print (opacity only) while the window itself stays put */}
            <div className="term-body auth-stage" key={mode}>
              <h1 id="auth-title" className="term-h">{c.title}</h1>
              <p className="tmuted">{c.sub}</p>
              <p className="tprompt term-cmd"><span className="tp-dollar">$</span> <span className="tp-cmd">{c.cmd}</span></p>
              <ul className={items.length > 4 ? 'tstatus cols' : 'tstatus'} aria-label="Form progress" aria-live="polite">
                {items.map(({ kind, name, value }, i) => (
                  <li key={name} className={kind} style={{ '--i': i } as CSSProperties}>
                    <b>{kind === 'ok' ? '[✓]' : kind === 'warn' ? '[!]' : '[ ]'}</b> <span>{name}</span><span className="tdots" aria-hidden="true" /><em>{value}</em>
                  </li>
                ))}
              </ul>
              <p className="term-progress" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label="Completion">
                <span className="tmuted">progress</span>
                <span className="tbar" aria-hidden="true">[<i style={{ '--p': `${pct}%` } as CSSProperties} />]</span>
                <em>{pct}%</em>
                <span className="term-hint-text">{pct === 100 ? 'All set — submit when ready.' : c.hint}</span>
              </p>
              {/* Toast line: validation / API outcome, printed where a terminal would echo it */}
              <div className="term-toast-slot" aria-live="assertive">
                {notice && (
                  <p className={`term-toast ${notice.kind}`} key={notice.text}>
                    <b>{notice.kind === 'error' ? '[✗]' : notice.kind === 'ok' ? '[✓]' : '[*]'}</b> {notice.text}
                  </p>
                )}
              </div>

              {mode === 'register'
                ? <SignupForm onSuccess={onSuccess} onStatus={setStatus} />
                : <LoginForm onSuccess={onSuccess} onStatus={setStatus} />}
            </div>
          </section>
        </div>
      </main>
      </div>
    </div>
  )
}
