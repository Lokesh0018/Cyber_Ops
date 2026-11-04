import type { CSSProperties } from 'react'
import logo from '../assets/shm-logo.webp'
import { included } from '../data/content'
import { type AuthSession } from '../hooks/useAuth'
import { navigate, onLinkClick } from '../hooks/useRoute'
import { LoginForm, SignupForm } from './AuthForms'
import { ArrowRightIcon, CheckIcon, ShieldIcon } from './Icons'

export type AuthMode = 'login' | 'register'

const copy = {
  login: {
    kicker: 'Student login',
    title: 'Welcome back',
    lead: 'Sign in to continue to your CyberOps lab.',
    switchText: 'New here?',
    switchLabel: 'Create an account',
    switchHref: '/register',
  },
  register: {
    kicker: 'Student registration',
    title: 'Reserve your lab seat',
    lead: 'Create your account and get ready for hands-on cybersecurity training.',
    switchText: 'Already registered?',
    switchLabel: 'Log in',
    switchHref: '/login',
  },
}

/** Full-page login / register, routed at /login and /register. */
export function AuthPage({ mode }: { mode: AuthMode }) {
  const c = copy[mode]

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

      {/* Right: the form */}
      <main className="authmain" id="main">
        {/* Compact header for phones; the brand panel above is hidden there */}
        <div className="authmobile-brand">
          <a href="/" onClick={onLinkClick}>
            <img src={logo} alt="" width={34} height={34} />
            <span>Cyber<b>Ops</b><small>by SHM Technologies</small></span>
          </a>
          <span className="authmobile-kicker">2-day workshop</span>
        </div>
        <div className="authform-wrap" data-mode={mode}>
          {/* Top row is fixed-height and never moves, whichever form is below it */}
          <div className="auth-top">
            <nav className="auth-switcher" data-mode={mode} aria-label="Login or register">
              <a href="/login" aria-current={mode === 'login' ? 'page' : undefined} onClick={onLinkClick}>Login</a>
              <a href="/register" aria-current={mode === 'register' ? 'page' : undefined} onClick={onLinkClick}>Register</a>
            </nav>
            <a className="auth-back" href="/" onClick={onLinkClick}>&larr; Back to site</a>
          </div>

          {/* Keyed by mode so the whole block re-mounts and plays its enter transition on every switch */}
          <div className="auth-stage auth-card" key={mode}>
            <p className="auth-kicker">{c.kicker}</p>
            <h1>{c.title}</h1>
            <p className="auth-lead">{c.lead}</p>

            {mode === 'register' ? <SignupForm onSuccess={onSuccess} /> : <LoginForm onSuccess={onSuccess} />}

            <p className="auth-switch">
              {c.switchText} <a href={c.switchHref} onClick={onLinkClick}>{c.switchLabel} <ArrowRightIcon /></a>
            </p>
          </div>
        </div>
      </main>
      </div>
    </div>
  )
}
