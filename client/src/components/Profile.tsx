import avatar from '../assets/hacker-avatar.webp'
import { useAuth } from '../hooks/useAuth'
import { onLinkClick } from '../hooks/useRoute'
import { ConsoleLayout } from './ConsoleLayout'
import { ArrowRightIcon, BuildingIcon, CheckIcon, MailIcon, PhoneIcon, UserIcon } from './Icons'

/** Reads the expiry out of the signed token's payload (base64url JSON) — display only, nothing is trusted from it. */
function tokenExpiry(token: string): Date | null {
  try {
    const payload = JSON.parse(atob(token.split('.')[0].replace(/-/g, '+').replace(/_/g, '/'))) as { exp?: number }
    return payload.exp ? new Date(payload.exp * 1000) : null
  } catch {
    return null
  }
}

const fmt = (d: Date) => d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })

/** /profile — the student's own record, read-only. */
export function Profile() {
  const { session } = useAuth()
  return (
    <ConsoleLayout page="profile">
      {(student) => {
        const initials = student.fullName.split(' ').filter(Boolean).slice(0, 2).map((w) => w[0]!.toUpperCase()).join('')
        const registered = fmt(new Date(student.createdAt))
        const expiry = session ? tokenExpiry(session.token) : null
        const rows = [
          { icon: <UserIcon />, label: 'Full name', value: student.fullName },
          { icon: <MailIcon />, label: 'Email', value: student.email, href: `mailto:${student.email}` },
          { icon: <PhoneIcon />, label: 'Mobile', value: student.phone, href: `tel:${student.phone}` },
          { icon: <BuildingIcon />, label: 'College / organisation', value: student.institution },
          { label: 'Branch / department', value: student.branch || '—' },
          { label: 'Roll number', value: student.rollNumber || '—', mono: true },
        ]
        return (
          <>
            <div className="dash-head">
              <p className="tprompt"><span className="tp-user">{student.email.split('@')[0]}@cyberops</span><span className="tp-path">:~$</span> <span className="tp-cmd">cat ~/.profile</span></p>
              <h1>Your profile</h1>
              <p className="dash-lead"><span>These are the details you registered with. They go on your certificate, so check them.</span></p>
            </div>

            <div className="dash-grid">
              {/* Identity card */}
              <section className="dcard prof-card" aria-labelledby="p-id">
                <div className="prof-id">
                  <span className="prof-avatar" aria-hidden="true"><img src={avatar} alt="" width={64} height={64} /><b>{initials}</b></span>
                  <div>
                    <h2 id="p-id" className="prof-name">{student.fullName}</h2>
                    <p className="tmuted">{student.institution}{student.branch ? ` · ${student.branch}` : ''}</p>
                    <p className="dash-pill prof-pill"><CheckIcon /> Seat reserved</p>
                  </div>
                </div>
                <dl className="prof-meta">
                  <div><dt>Student ID</dt><dd>#{String(student.id).padStart(4, '0')}</dd></div>
                  <div><dt>Registered</dt><dd>{registered}</dd></div>
                  <div><dt>Session valid until</dt><dd>{expiry ? fmt(expiry) : '—'}</dd></div>
                </dl>
              </section>

              {/* Details */}
              <section className="dcard" aria-labelledby="p-details">
                <h2 id="p-details" className="dcard-h"><span className="tp-dollar">$</span> cat ~/.profile</h2>
                <ul className="prof-rows">
                  {rows.map((r) => (
                    <li key={r.label}>
                      <span className="prof-ico" aria-hidden="true">{r.icon ?? <span className="prof-ico-dot" />}</span>
                      <span className="prof-label">{r.label}</span>
                      <span className={r.mono ? 'prof-value mono' : 'prof-value'}>
                        {r.href ? <a href={r.href}>{r.value}</a> : r.value}
                      </span>
                    </li>
                  ))}
                </ul>
              </section>

              {/* Corrections + navigation */}
              <section className="dcard dcard-wide prof-foot" aria-labelledby="p-fix">
                <div>
                  <h2 id="p-fix" className="dcard-h"><span className="tp-dollar">$</span> ./request-correction</h2>
                  <p className="tmuted">
                    Spotted a mistake? Email <a href="mailto:shmtechnologies77@gmail.com">shmtechnologies77@gmail.com</a> from{' '}
                    <b>{student.email}</b> with the field and the correct value — we update it before certificates are printed.
                  </p>
                </div>
                <a className="tbtn prof-btn" href="/dashboard" onClick={onLinkClick}>
                  <span className="tbtn-br">[</span> DASHBOARD <ArrowRightIcon /> <span className="tbtn-br">]</span>
                </a>
              </section>
            </div>
          </>
        )
      }}
    </ConsoleLayout>
  )
}
