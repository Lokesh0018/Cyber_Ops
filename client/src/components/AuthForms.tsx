import { cloneElement, isValidElement, useState, type FormEvent, type ReactElement, type ReactNode } from 'react'
import { useAuth, type AuthSession } from '../hooks/useAuth'
import { AlertIcon, ArrowRightIcon, BuildingIcon, EyeIcon, EyeOffIcon, LockIcon, MailIcon, PhoneIcon, UserIcon } from './Icons'

type Errors = Record<string, string>

const LEVELS = ['Student', 'Fresher', 'Working professional', 'Educator']

async function postJson(url: string, body: unknown) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const data = (await res.json().catch(() => ({}))) as { message?: string; errors?: Errors } & Partial<AuthSession>
  if (!res.ok) throw Object.assign(new Error(data.message ?? 'Request failed'), { errors: data.errors ?? {} })
  return data as AuthSession
}

/** Stores the session, then hands the result to the page. */
function useSubmit(onSuccess: (s: AuthSession) => void) {
  const { signIn } = useAuth()
  return (s: AuthSession) => {
    signIn(s)
    onSuccess(s)
  }
}

export function LoginForm({ onSuccess }: { onSuccess: (s: AuthSession) => void }) {
  const done = useSubmit(onSuccess)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [show, setShow] = useState(false)

  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (busy) return
    const f = new FormData(e.currentTarget)
    setBusy(true)
    setError('')
    try {
      done(await postJson('/api/auth/login', { email: f.get('email'), password: f.get('password') }))
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <form className="auth-form" onSubmit={submit} noValidate>
      {error && <p className="auth-error" role="alert"><AlertIcon /><span>{error}</span></p>}
      <Field id="li-email" label="Email" icon={<MailIcon />}>
        <input id="li-email" name="email" type="email" autoComplete="email" inputMode="email" required placeholder="you@college.edu" />
      </Field>
      <Field id="li-pass" label="Password" icon={<LockIcon />} trailing={<EyeToggle show={show} onToggle={() => setShow((s) => !s)} />}>
        <input id="li-pass" name="password" type={show ? 'text' : 'password'} autoComplete="current-password" required placeholder="Your password" />
      </Field>
      <AuthButton busy={busy} busyLabel="Signing in…">Log in</AuthButton>
    </form>
  )
}

export function SignupForm({ onSuccess }: { onSuccess: (s: AuthSession) => void }) {
  const done = useSubmit(onSuccess)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [errors, setErrors] = useState<Errors>({})
  const [show, setShow] = useState(false)
  const [pw, setPw] = useState('')

  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const f = new FormData(e.currentTarget)
    const body = Object.fromEntries(f) as Record<string, string>

    // Client-side checks mirror the server's so most mistakes are caught before a round-trip.
    const local: Errors = {}
    if (body.fullName.trim().length < 2) local.fullName = 'Enter your full name.'
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email)) local.email = 'Enter a valid email address.'
    if (!/^\+?[0-9][0-9\s-]{7,18}$/.test(body.phone)) local.phone = 'Enter a valid phone number.'
    if (body.institution.trim().length < 2) local.institution = 'Enter your college or organisation.'
    if (!body.level) local.level = 'Choose an option.'
    if (body.password.length < 8) local.password = 'Use at least 8 characters.'
    if (body.password !== body.confirm) local.confirm = 'Passwords don’t match.'
    if (!f.get('agree')) local.agree = 'Please accept the lab conduct rules.'
    if (Object.keys(local).length) {
      setErrors(local)
      return
    }
    if (busy) return

    setBusy(true)
    setError('')
    setErrors({})
    try {
      done(await postJson('/api/auth/register', body))
    } catch (err) {
      const e2 = err as Error & { errors?: Errors }
      setError(e2.message)
      setErrors(e2.errors ?? {})
    } finally {
      setBusy(false)
    }
  }

  return (
    <form className="auth-form" onSubmit={submit} noValidate>
      {error && <p className="auth-error" role="alert"><AlertIcon /><span>{error}</span></p>}
      <div className="auth-grid">
        <Field id="su-name" label="Full name" icon={<UserIcon />} error={errors.fullName}>
          <input id="su-name" name="fullName" autoComplete="name" required placeholder="Priya Sharma" />
        </Field>
        <Field id="su-email" label="Email" icon={<MailIcon />} error={errors.email}>
          <input id="su-email" name="email" type="email" autoComplete="email" inputMode="email" required placeholder="you@college.edu" />
        </Field>
        <Field id="su-phone" label="Phone" icon={<PhoneIcon />} error={errors.phone}>
          <input id="su-phone" name="phone" type="tel" autoComplete="tel" inputMode="tel" required placeholder="+91 98765 43210" />
        </Field>
        <Field id="su-inst" label="College / organisation" icon={<BuildingIcon />} error={errors.institution}>
          <input id="su-inst" name="institution" autoComplete="organization" required placeholder="Your institution" />
        </Field>
        <Field id="su-level" label="You are a" error={errors.level} className="span-2">
          <select id="su-level" name="level" required defaultValue="">
            <option value="" disabled>Select one</option>
            {LEVELS.map((l) => <option key={l}>{l}</option>)}
          </select>
        </Field>
        <div className="field-stack">
        <Field id="su-pass" label="Password" icon={<LockIcon />} error={errors.password}
          trailing={<EyeToggle show={show} onToggle={() => setShow((s) => !s)} />}>
          <input id="su-pass" name="password" type={show ? 'text' : 'password'} autoComplete="new-password" minLength={8} required placeholder="8+ characters"
            onChange={(e) => setPw(e.target.value)} />
        </Field>
        <PasswordMeter value={pw} />
        </div>
        <Field id="su-confirm" label="Confirm password" icon={<LockIcon />} error={errors.confirm}>
          <input id="su-confirm" name="confirm" type={show ? 'text' : 'password'} autoComplete="new-password" required placeholder="Repeat it" />
        </Field>
      </div>

      <label className={errors.agree ? 'auth-check err' : 'auth-check'}>
        <input type="checkbox" name="agree" />
        <span>I’ll use the lab tools only on the isolated targets provided during the bootcamp.</span>
      </label>
      {errors.agree && <p className="field-err" role="alert"><AlertIcon /> {errors.agree}</p>}

      <AuthButton busy={busy} busyLabel="Creating account…">Register for the bootcamp</AuthButton>
    </form>
  )
}


/* ---------- field primitives ---------- */

function Field({ id, label, icon, trailing, hint, error, className, children }: {
  id: string
  label: string
  icon?: ReactNode
  trailing?: ReactNode
  hint?: string
  error?: string
  className?: string
  children: ReactNode
}) {
  const describedBy = error ? `${id}-err` : hint ? `${id}-hint` : undefined
  return (
    <div className={['field', error ? 'err' : '', className ?? ''].filter(Boolean).join(' ')}>
      <label htmlFor={id}>{label}</label>
      <div className="field-box">
        {icon && <span className="field-ico" aria-hidden="true">{icon}</span>}
        {isValidElement(children)
          ? cloneElement(children as ReactElement<Record<string, unknown>>, {
              'aria-describedby': describedBy,
              'aria-invalid': error ? true : undefined,
            })
          : children}
        {trailing}
      </div>
      {error ? (
        <p className="field-err" id={`${id}-err`} role="alert"><AlertIcon /> {error}</p>
      ) : hint ? (
        <p className="field-hint" id={`${id}-hint`}>{hint}</p>
      ) : null}
    </div>
  )
}

function EyeToggle({ show, onToggle }: { show: boolean; onToggle: () => void }) {
  return (
    <button className="field-eye" type="button" onClick={onToggle} aria-label={show ? 'Hide password' : 'Show password'} aria-pressed={show}>
      {show ? <EyeOffIcon /> : <EyeIcon />}
    </button>
  )
}

/* ---------- button + strength meter ---------- */

function AuthButton({ busy, busyLabel, children }: { busy: boolean; busyLabel: string; children: ReactNode }) {
  return (
    <button className="auth-btn" type="submit" disabled={busy} aria-busy={busy} aria-live="polite">
      {busy ? <><span className="spin" aria-hidden="true" /> {busyLabel}</> : <>{children} <ArrowRightIcon /></>}
    </button>
  )
}

/** Rough client-side strength hint: length, mixed case, digits, symbols. Never sent anywhere. */
function scorePassword(v: string) {
  if (!v) return 0
  let n = 0
  if (v.length >= 8) n++
  if (v.length >= 12) n++
  if (/[a-z]/.test(v) && /[A-Z]/.test(v)) n++
  if (/\d/.test(v) && /[^A-Za-z0-9]/.test(v)) n++
  return Math.max(1, Math.min(4, n))
}

function PasswordMeter({ value, className }: { value: string; className?: string }) {
  const score = scorePassword(value)
  const label = ['', 'Weak', 'Fair', 'Good', 'Strong'][score]
  return (
    <div className={['pw-meter', className ?? ''].join(' ')} data-score={score} aria-live="polite">
      <div className="pw-meter-bars" aria-hidden="true"><i /><i /><i /><i /></div>
      <span>{value ? label : '\u00a0'}</span>
    </div>
  )
}
