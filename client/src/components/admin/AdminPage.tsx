import { useEffect, useRef, useState, type CSSProperties, type FormEvent, type InputHTMLAttributes, type SyntheticEvent } from 'react'
import logo from '../../assets/shm-logo.webp'
import { useAdmin, type AdminSession } from '../../hooks/useAdmin'
import { navigate, onLinkClick } from '../../hooks/useRoute'
import { ArrowRightIcon, EyeIcon, EyeOffIcon, LogoutIcon } from '../Icons'
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
        <span className="dash-session adm-session" title={session.admin.email}>
          <span className="adm-avatar" aria-hidden="true">{session.admin.email.charAt(0).toUpperCase()}</span>
          <span className="adm-email">{session.admin.email}</span>
          <span className="dot" aria-hidden="true" />
          <span className="sr-only">signed in</span>
        </span>
        <nav className="dash-actions" aria-label="Account">
          <button className="dash-logout" type="button" onClick={() => { signOut(); navigate('/admin', true) }}><LogoutIcon /> Logout</button>
        </nav>
      </header>
      <main className="dash-main" id="main"><AdminDashboard /></main>
    </div>
  )
}

/** Input with the same terminal block cursor as the student login (native caret is hidden by .tinput). */
function CaretInput(props: InputHTMLAttributes<HTMLInputElement>) {
  const [caret, setCaret] = useState(0)
  const track = (e: SyntheticEvent<HTMLInputElement>) => setCaret(e.currentTarget.selectionStart ?? e.currentTarget.value.length)
  const chain = <E extends SyntheticEvent<HTMLInputElement>>(own?: (e: E) => void) => (e: E) => { own?.(e); track(e) }
  return (
    <span className="tinput-wrap">
      <input {...props} className="tinput" onInput={chain(props.onInput)} onKeyUp={chain(props.onKeyUp)} onClick={chain(props.onClick)} onSelect={chain(props.onSelect)} onFocus={chain(props.onFocus)} />
      <span className="tcaret" aria-hidden="true" style={{ '--c': caret } as CSSProperties} />
    </span>
  )
}

const RAIN_CHARS = 'アイウエオカキクケコサシスセソタチツテトナニヌネノハヒフヘホマミムメモヤユヨラリルレロワヲン0123456789ABCDEF<>/{}[]$#'

/** Decorative code rain behind the sign-in card. Static single frame under prefers-reduced-motion; paused while the tab is hidden. */
function MatrixRain() {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const canvas = ref.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx) return
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const size = 16
    let cols = 0, drops: number[] = [], raf = 0, last = 0, w = 0, h = 0

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 1.5)
      w = canvas.clientWidth; h = canvas.clientHeight
      canvas.width = w * dpr; canvas.height = h * dpr
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.font = `${size}px "JetBrains Mono", ui-monospace, monospace`
      cols = Math.ceil(w / size)
      drops = Array.from({ length: cols }, () => Math.random() * -(h / size))
      if (reduce) for (let i = 0; i < 40; i++) { drops = drops.map((d) => d + 1); step() } // one settled frame; resizing clears the canvas
    }
    const glyph = () => RAIN_CHARS[Math.floor(Math.random() * RAIN_CHARS.length)]
    const step = () => {
      ctx.globalCompositeOperation = 'destination-out' // fade old trails on a transparent canvas
      ctx.fillStyle = 'rgba(0,0,0,.09)'
      ctx.fillRect(0, 0, w, h)
      ctx.globalCompositeOperation = 'source-over'
      for (let i = 0; i < cols; i++) {
        const y = drops[i] * size
        if (y > 0) {
          ctx.fillStyle = 'rgba(110,160,255,.75)'
          ctx.fillText(glyph(), i * size, y - size)
          ctx.fillStyle = '#dbe7ff' // bright head
          ctx.fillText(glyph(), i * size, y)
        }
        drops[i] = y > h && Math.random() > 0.975 ? Math.random() * -20 : drops[i] + 1
      }
    }
    const loop = (t: number) => {
      raf = requestAnimationFrame(loop)
      if (t - last < 55) return // ~18 fps keeps it cheap and readable
      last = t
      step()
    }
    const start = () => { if (!raf && !reduce) raf = requestAnimationFrame(loop) }
    const stop = () => { cancelAnimationFrame(raf); raf = 0 }
    const onVis = () => (document.hidden ? stop() : start())

    resize()
    start()
    const ro = new ResizeObserver(resize) // follows page size changes (mobile keyboard, error toast), not just window resizes
    ro.observe(canvas)
    document.addEventListener('visibilitychange', onVis)
    return () => { stop(); ro.disconnect(); document.removeEventListener('visibilitychange', onVis) }
  }, [])
  return <canvas ref={ref} className="adm-rain" aria-hidden="true" />
}

function AdminLogin() {
  const { signIn } = useAdmin()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [show, setShow] = useState(false)
  const [caps, setCaps] = useState(false)

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
      <span className="adm-dragon-bg" aria-hidden="true" />
      <MatrixRain />
      <div className="term-window adm-win">
        <div className="term-head">
          <span className="term-dots" aria-hidden="true"><i /><i /><i /></span>
          <span className="term-title">root@kali: ~/admin</span>
          <span className="term-session adm-lock" aria-hidden="true"><span className="dot" /> locked</span>
        </div>
        <form className={`adm-form${error ? ' shake' : ''}`} onSubmit={submit} noValidate>
          <div className="adm-hero">
            <span className="adm-badge" aria-hidden="true"><img src={logo} alt="" width={44} height={44} /></span>
            <h1 className="adm-h1">Organiser sign-in</h1>
            <p className="adm-sub">Restricted area. Every change here goes live for all students.</p>
            <span className="adm-chip">CyberOps <span className="adm-sep">×</span> Kali Linux</span>
          </div>

          <div className={`tfield${error ? ' err' : ''}`}>
            <label htmlFor="adm-email" className="tprompt"><span className="tp-cmd">email</span></label>
            <div className="tline">
              <span className="tp-gt" aria-hidden="true">&gt;</span>
              <CaretInput id="adm-email" name="email" type="email" autoComplete="username" required autoFocus placeholder="admin@domain" aria-invalid={!!error} />
            </div>
          </div>
          <div className={`tfield${error ? ' err' : ''}`}>
            <label htmlFor="adm-pass" className="tprompt"><span className="tp-cmd">password</span></label>
            <div className="tline">
              <span className="tp-gt" aria-hidden="true">&gt;</span>
              <CaretInput id="adm-pass" name="password" type={show ? 'text' : 'password'} autoComplete="current-password" required placeholder="••••••••" aria-invalid={!!error}
                onKeyUp={(e) => setCaps(e.getModifierState('CapsLock'))} onBlur={() => setCaps(false)} />
              <button type="button" className="adm-eye" onClick={() => setShow((v) => !v)} aria-label={show ? 'Hide password' : 'Show password'} aria-pressed={show}>
                {show ? <EyeOffIcon /> : <EyeIcon />}
              </button>
            </div>
            {caps && <p className="adm-caps" role="status">Caps Lock is on</p>}
          </div>

          <div className="term-toast-slot" aria-live="assertive">
            {error && <p className="term-toast error" role="alert"><b>[✗]</b> {error}</p>}
          </div>

          <button className="tbtn" type="submit" disabled={busy} aria-busy={busy}>
            <span className="tbtn-br">[</span> {busy ? 'AUTHENTICATING' : 'ENTER CONSOLE'} <ArrowRightIcon /> <span className="tbtn-br">]</span>
          </button>
          <p className="adm-back"><a href="/" onClick={onLinkClick}>← back to site</a></p>
          <p className="adm-foot" aria-hidden="true"><span className="adm-pulse" /> secure session <span className="adm-sep">·</span> actions are logged</p>
        </form>
      </div>
    </div>
  )
}
