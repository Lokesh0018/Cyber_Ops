import {
  cloneElement, isValidElement, useEffect, useRef, useState,
  type CSSProperties, type FocusEvent, type FormEvent, type ReactElement, type ReactNode, type SyntheticEvent,
} from 'react'
import { useAuth, type AuthSession } from '../hooks/useAuth'
import { onLinkClick } from '../hooks/useRoute'
import { ArrowRightIcon } from './Icons'

type Errors = Record<string, string>

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const PHONE_RE = /^[0-9]{10}$/ // 10-digit mobile number, no country code
const ROLL_RE = /^[A-Za-z0-9\-\/]{3,30}$/ // college roll number: letters, digits, - and /

/* ---------- live status (banner) ---------- */

/** One line of the terminal's live status banner. */
export interface StatusItem { kind: 'ok' | 'warn' | 'pending'; name: string; value: string }
/** Toast line printed under the progress bar. Cleared on the next input. */
export interface Notice { kind: 'error' | 'info' | 'ok'; text: string }
export type OnStatus = (items: StatusItem[], notice?: Notice) => void

const g = (f: FormData, k: string) => String(f.get(k) ?? '').trim()
const line = (name: string, ok: boolean, filled: boolean, okText = 'OK', badText = 'INVALID'): StatusItem =>
  ok ? { kind: 'ok', name, value: okText } : filled ? { kind: 'warn', name, value: badText } : { kind: 'pending', name, value: 'WAITING' }

/** Login banner: one line per field. Only states leave the form — never values. */
export function loginStatus(f: FormData): StatusItem[] {
  return [
    line('Email', EMAIL_RE.test(g(f, 'email')), !!g(f, 'email'), 'VALID'),
    line('Roll number', ROLL_RE.test(g(f, 'rollNumber')), !!g(f, 'rollNumber'), 'OK'),
  ]
}

/** Registration banner: one line per field, same rules the submit uses. */
export function signupStatus(f: FormData): StatusItem[] {
  return [
    line('Full name', g(f, 'fullName').length >= 2, !!g(f, 'fullName'), 'OK', 'TOO SHORT'),
    line('Email', EMAIL_RE.test(g(f, 'email')), !!g(f, 'email'), 'VALID'),
    line('Phone', PHONE_RE.test(g(f, 'phone')), !!g(f, 'phone'), 'VALID', '10 DIGITS'),
    line('Institution', g(f, 'institution').length >= 2, !!g(f, 'institution'), 'OK', 'TOO SHORT'),
    line('Branch', g(f, 'branch').length >= 2, !!g(f, 'branch'), 'OK', 'TOO SHORT'),
    line('Roll number', ROLL_RE.test(g(f, 'rollNumber')), !!g(f, 'rollNumber'), 'OK'),
    f.get('agree') ? { kind: 'ok', name: 'Lab agreement', value: 'ACCEPTED' } : { kind: 'pending', name: 'Lab agreement', value: 'REQUIRED' },
  ]
}

/* ---------- validation (shared by live inline errors and submit) ---------- */

function validateLogin(f: FormData): Errors {
  const e: Errors = {}
  if (!EMAIL_RE.test(g(f, 'email'))) e.email = 'Enter a valid email address.'
  if (!ROLL_RE.test(g(f, 'rollNumber'))) e.rollNumber = 'Enter your roll number.'
  return e
}

function validateSignup(f: FormData): Errors {
  const e: Errors = {}
  if (g(f, 'fullName').length < 2) e.fullName = 'Enter your full name.'
  if (!EMAIL_RE.test(g(f, 'email'))) e.email = 'Enter a valid email address.'
  if (!PHONE_RE.test(g(f, 'phone'))) e.phone = 'Enter a 10-digit mobile number.'
  if (g(f, 'institution').length < 2) e.institution = 'Enter your college or organisation.'
  if (g(f, 'branch').length < 2) e.branch = 'Enter your branch / department.'
  if (!ROLL_RE.test(g(f, 'rollNumber'))) e.rollNumber = 'Enter your roll number (3–30 letters/digits).'
  if (!f.get('agree')) e.agree = 'Please accept the lab conduct rules.'
  return e
}

/* ---------- networking ---------- */

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

/**
 * Live form state: reports banner status on every input/keyup/blur (and once on mount so autofill counts),
 * and keeps inline errors for fields the student has already left (`touched`), so mistakes show before submit.
 */
function useLiveForm(onStatus: OnStatus | undefined, compute: (f: FormData) => StatusItem[], validate: (f: FormData) => Errors) {
  const ref = useRef<HTMLFormElement>(null)
  const [touched, setTouched] = useState<Set<string>>(() => new Set())
  const [live, setLive] = useState<Errors>({})

  const report = (notice?: Notice, touchedNow = touched) => {
    if (!ref.current) return
    const f = new FormData(ref.current)
    onStatus?.(compute(f), notice)
    const all = validate(f)
    setLive(Object.fromEntries(Object.entries(all).filter(([k]) => touchedNow.has(k))))
  }
  const onBlur = (e: FocusEvent<HTMLFormElement>) => {
    const name = (e.target as unknown as HTMLInputElement).name
    if (!name) return
    const next = new Set(touched).add(name)
    setTouched(next)
    report(undefined, next)
  }
  useEffect(() => { report() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const formProps = {
    ref,
    onInput: () => report(),
    onChange: () => report(),
    onKeyUp: () => report(),
    onBlur,
    noValidate: true,
  }
  return { ref, report, live, formProps }
}

/** Digits only, capped at 10 — used by the mobile field. */
const digitsOnly = (e: SyntheticEvent<HTMLInputElement>) => {
  e.currentTarget.value = e.currentTarget.value.replace(/\D/g, '').slice(0, 10)
}
/** Roll numbers are stored upper-case; mirror that while typing. */
const rollFormat = (e: SyntheticEvent<HTMLInputElement>) => {
  e.currentTarget.value = e.currentTarget.value.toUpperCase().replace(/[^A-Z0-9\-\/]/g, '').slice(0, 30)
}

/* ---------- forms ---------- */

export function LoginForm({ onSuccess, onStatus }: { onSuccess: (s: AuthSession) => void; onStatus?: OnStatus }) {
  const done = useSubmit(onSuccess)
  const { report, live, formProps } = useLiveForm(onStatus, loginStatus, validateLogin)
  const [busy, setBusy] = useState(false)

  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (busy) return
    const f = new FormData(e.currentTarget)
    setBusy(true)
    report({ kind: 'info', text: 'Authenticating…' })
    try {
      done(await postJson('/api/auth/login', { email: f.get('email'), rollNumber: f.get('rollNumber') }))
      report({ kind: 'ok', text: 'Access granted. Redirecting…' })
    } catch (err) {
      report({ kind: 'error', text: (err as Error).message })
    } finally {
      setBusy(false)
    }
  }

  return (
    <form className="tform" onSubmit={submit} {...formProps}>
      <Field id="li-email" cmd="email" label="Email" error={live.email}>
        <input id="li-email" name="email" type="email" autoComplete="email" inputMode="email" required placeholder="you@college.edu" />
      </Field>
      <Field id="li-roll" cmd="rollno" label="Roll number" error={live.rollNumber}>
        <input id="li-roll" name="rollNumber" autoComplete="off" autoCapitalize="characters" required placeholder="your roll number" maxLength={30} onInput={rollFormat} />
      </Field>

      <SubmitBlock
        cmd="./authenticate --student"
        busy={busy}
        label="LOGIN"
        steps={['Validating credentials', 'Connecting to authentication service', 'Verifying student record']}
      />

      <p className="tfoot">
        <span className="tmuted">New user?</span>
        <a href="/register" onClick={onLinkClick}><span className="tp-dollar">$</span> ./register --create-account</a>
      </p>
    </form>
  )
}

export function SignupForm({ onSuccess, onStatus }: { onSuccess: (s: AuthSession) => void; onStatus?: OnStatus }) {
  const done = useSubmit(onSuccess)
  const { report, live, formProps } = useLiveForm(onStatus, signupStatus, validateSignup)
  const [busy, setBusy] = useState(false)
  const [errors, setErrors] = useState<Errors>({})
  const shown = { ...live, ...errors } // live (touched) errors, overridden by submit/server errors

  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const f = new FormData(e.currentTarget)
    const body = Object.fromEntries(f) as Record<string, string>

    // Client-side checks mirror the server's so most mistakes are caught before a round-trip.
    const local = validateSignup(f)
    if (Object.keys(local).length) {
      setErrors(local)
      const n = Object.keys(local).length
      report({ kind: 'error', text: `${n} field${n > 1 ? 's' : ''} need${n > 1 ? '' : 's'} attention — see [!] above.` })
      return
    }
    if (busy) return

    setBusy(true)
    setErrors({})
    report({ kind: 'info', text: 'Submitting enrollment…' })
    try {
      done(await postJson('/api/auth/register', body))
      report({ kind: 'ok', text: 'Seat request logged. Redirecting…' })
    } catch (err) {
      const e2 = err as Error & { errors?: Errors }
      setErrors(e2.errors ?? {})
      report({ kind: 'error', text: e2.message })
    } finally {
      setBusy(false)
    }
  }

  return (
    <form className="tform" onSubmit={submit} {...formProps}>
      <div className="tgrid">
        <Field id="su-name" cmd="fullname" label="Full name" error={shown.fullName}>
          <input id="su-name" name="fullName" autoComplete="name" required placeholder="Enter your full name" />
        </Field>
        <Field id="su-email" cmd="email" label="Email" error={shown.email}>
          <input id="su-email" name="email" type="email" autoComplete="email" inputMode="email" required placeholder="you@college.edu" />
        </Field>
        <Field id="su-phone" cmd="mobile" label="Mobile number" error={shown.phone}>
          <input id="su-phone" name="phone" type="tel" autoComplete="tel-national" inputMode="numeric" required placeholder="10-digit mobile number"
            maxLength={10} pattern="[0-9]{10}" onInput={digitsOnly} />
        </Field>
        <Field id="su-inst" cmd="institution" label="College / organisation" error={shown.institution}>
          <input id="su-inst" name="institution" autoComplete="organization" required placeholder="Your institution" />
        </Field>
        <Field id="su-branch" cmd="branch" label="Branch / department" error={shown.branch}>
          <input id="su-branch" name="branch" autoComplete="off" required placeholder="e.g. CSE, ECE, IT" maxLength={80} />
        </Field>
        <Field id="su-roll" cmd="rollno" label="Roll number" error={shown.rollNumber}>
          <input id="su-roll" name="rollNumber" autoComplete="off" autoCapitalize="characters" required placeholder="college roll number" maxLength={30} onInput={rollFormat} />
        </Field>
      </div>

      <label className={shown.agree ? 'tcheck err' : 'tcheck'}>
        <input type="checkbox" name="agree" />
        <span className="tcheck-box" aria-hidden="true">[<span className="tcheck-tick">✓</span>]</span>
        <span className="tcheck-text">
          <span className="tp-cmd">--agree</span> I’ll use lab tools only on the isolated targets provided during the bootcamp.
        </span>
      </label>
      {shown.agree && <p className="sr-only" role="alert">{shown.agree}</p>}

      <SubmitBlock
        cmd="./enroll --create-student"
        busy={busy}
        label="REGISTER"
        steps={['Validating student profile', 'Checking required fields', 'Submitting enrollment request']}
      />

      <p className="tfoot">
        <span className="tmuted">Already enrolled?</span>
        <a href="/login" onClick={onLinkClick}><span className="tp-dollar">$</span> ./login</a>
      </p>
    </form>
  )
}

/* ---------- terminal primitives ---------- */

/**
 * A form field drawn as a prompt line (`student@cyberops:~$ cmd`) followed by a `>` input line.
 * The native caret is hidden and a terminal block cursor tracks the real caret (monospace → 1ch per character).
 */
function Field({ id, cmd, label, trailing, below, error, className, children }: {
  id: string
  cmd: string
  label: string
  trailing?: ReactNode
  below?: ReactNode
  error?: string
  className?: string
  children: ReactNode
}) {
  const errId = `${id}-err`
  const [caret, setCaret] = useState(0)
  const track = (e: SyntheticEvent<HTMLInputElement>) => {
    const el = e.currentTarget
    // selectionStart is null for input types that don't support it (email); fall back to the end of the value
    setCaret(el.selectionStart ?? el.value.length)
  }
  const isInput = isValidElement(children) && children.type === 'input'
  // Keep any handler the field already has (e.g. the mobile digit filter), then track the caret.
  const own = isValidElement(children) ? (children.props as Record<string, ((e: SyntheticEvent<HTMLInputElement>) => void) | undefined>) : {}
  const chain = (name: string) => (e: SyntheticEvent<HTMLInputElement>) => { own[name]?.(e); track(e) }
  return (
    <div className={['tfield', error ? 'err' : '', className ?? ''].filter(Boolean).join(' ')}>
      <label htmlFor={id} className="tprompt">
        <span className="tp-user">student@cyberops</span><span className="tp-path">:~$</span> <span className="tp-cmd">{cmd}</span>
        <span className="sr-only"> — {label}</span>
      </label>
      <div className="tline">
        <span className="tp-gt" aria-hidden="true">&gt;</span>
        <span className="tinput-wrap">
          {isValidElement(children)
            ? cloneElement(children as ReactElement<Record<string, unknown>>, {
                className: 'tinput',
                'aria-describedby': error ? errId : undefined,
                'aria-invalid': error ? true : undefined,
                ...(isInput ? { onInput: chain('onInput'), onKeyUp: chain('onKeyUp'), onClick: chain('onClick'), onSelect: chain('onSelect'), onFocus: chain('onFocus') } : {}),
              })
            : children}
          {isInput && <span className="tcaret" aria-hidden="true" style={{ '--c': caret } as CSSProperties} />}
        </span>
        {trailing}
      </div>
      {below}
      {error && <p className="sr-only" id={errId} role="alert">{error}</p>}
    </div>
  )
}

/** Command echo + primary button; while busy, the status steps print one by one with a spinner on the last. */
function SubmitBlock({ cmd, busy, label, steps }: { cmd: string; busy: boolean; label: string; steps: string[] }) {
  return (
    <div className="tsubmit">
      <p className="tprompt"><span className="tp-user">student@cyberops</span><span className="tp-path">:~$</span> <span className="tp-cmd">{cmd}</span></p>
      {busy ? (
        <ul className="tsteps" aria-live="polite" aria-label="Progress">
          {steps.map((s, i) => (
            <li key={s} style={{ '--i': i } as CSSProperties}>
              <span className="tstar">[*]</span> {s}…{i === steps.length - 1 && <span className="tspin" aria-hidden="true" />}
            </li>
          ))}
        </ul>
      ) : null}
      <button className="tbtn" type="submit" disabled={busy} aria-busy={busy}>
        <span className="tbtn-br">[</span> {busy ? 'RUNNING' : label} <ArrowRightIcon /> <span className="tbtn-br">]</span>
      </button>
    </div>
  )
}
