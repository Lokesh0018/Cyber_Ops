import { useEffect, useState, type CSSProperties } from 'react'
import { ctfCategories, included, schedule } from '../data/content'
import { ConsoleLayout } from './ConsoleLayout'
import { ArrowRightIcon, CheckIcon, TrophyIcon } from './Icons'

const quickLinks = [
  { href: '/#arsenal', label: 'Tool arsenal', desc: '100+ Kali tools you will use' },
  { href: '/#schedule', label: 'Full schedule', desc: 'Both days, session by session' },
  { href: '/#autovapt', label: 'SHM AutoVAPT', desc: 'Day-2 automated scanner demo' },
  { href: '/#ctf', label: 'CTF finale', desc: 'Format, categories and scoring' },
]

/** Student dashboard at /dashboard (session guard + top bar come from ConsoleLayout). */
export function Dashboard() {
  const [day, setDay] = useState(0)
  // Captured once: the query string is stripped right after mount, and later re-renders must keep the toast.
  const [welcome] = useState(() => new URLSearchParams(window.location.search).get('welcome'))
  useEffect(() => {
    if (welcome) history.replaceState(null, '', '/dashboard')
  }, [welcome])

  return (
    <ConsoleLayout page="dashboard">
      {(student) => {
        const first = student.fullName.split(' ')[0]
        const registered = new Date(student.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
        return (
          <>
        <div className="dash-head">
          <p className="tprompt"><span className="tp-user">{student.email.split('@')[0]}@cyberops</span><span className="tp-path">:~$</span> <span className="tp-cmd">./status --student</span></p>
          <h1>Welcome{welcome === 'back' ? ' back' : ''}, {first}.</h1>
          <p className="dash-lead">
            <span className="dash-pill"><CheckIcon /> Seat reserved</span>
            <span>Registered on {registered}. Your joining pack goes to <b>{student.email}</b>.</span>
          </p>
          {welcome && (
            <p className="term-toast ok dash-toast" role="status">
              <b>[✓]</b> {welcome === 'new' ? 'Enrollment logged. You are on the list.' : 'Signed in.'}
            </p>
          )}
        </div>

        <div className="dash-grid">
          {/* Profile */}
          <section className="dcard" aria-labelledby="d-profile">
            <h2 id="d-profile" className="dcard-h"><span className="tp-dollar">$</span> whoami</h2>
            <dl className="dash-dl">
              <div><dt>Name</dt><dd>{student.fullName}</dd></div>
              <div><dt>Email</dt><dd>{student.email}</dd></div>
              <div><dt>Mobile</dt><dd>{student.phone}</dd></div>
              <div><dt>Institution</dt><dd>{student.institution}</dd></div>
              <div><dt>Branch</dt><dd>{student.branch || '—'}</dd></div>
              <div><dt>Roll number</dt><dd>{student.rollNumber || '—'}</dd></div>
            </dl>
            <p className="dash-note tmuted">Need a correction? Email <a href="mailto:shmtechnologies77@gmail.com">shmtechnologies77@gmail.com</a> from this address.</p>
          </section>

          {/* Enrollment checklist */}
          <section className="dcard" aria-labelledby="d-included">
            <h2 id="d-included" className="dcard-h"><span className="tp-dollar">$</span> cat enrollment.txt</h2>
            <ul className="dash-check">
              {included.map((item, i) => (
                <li key={item} style={{ '--i': i } as CSSProperties}><b>[✓]</b> {item}</li>
              ))}
            </ul>
            <p className="dash-note tmuted">Bring a laptop that can run a VM (8 GB RAM recommended). Kali lab images are provided on the day.</p>
          </section>

          {/* Agenda */}
          <section className="dcard dcard-wide" aria-labelledby="d-agenda">
            <div className="dcard-head">
              <h2 id="d-agenda" className="dcard-h"><span className="tp-dollar">$</span> cat agenda.md</h2>
              <div className="dash-tabs" role="tablist" aria-label="Day">
                {schedule.map((d, i) => (
                  <button key={d.num} role="tab" type="button" aria-selected={day === i} className={d.violet ? 'violet' : ''} onClick={() => setDay(i)}>
                    Day {d.num}
                  </button>
                ))}
              </div>
            </div>
            <p className="dash-daytitle"><b>{schedule[day].title}</b> <span className="tmuted">· {schedule[day].meta}</span></p>
            <div className="dash-phases">
              {schedule[day].phases.map((ph) => (
                <div className="dash-phase" key={ph.label}>
                  <h3>{ph.label}</h3>
                  <ul>
                    {ph.sessions.map((s) => (
                      <li key={s.time + s.title} className={s.breakKind ? 'brk' : s.violet ? 'violet' : ''}>
                        <span className="dash-time">{s.time}</span>
                        <span className="dash-sess">
                          {s.title}
                          {s.tools && <span className="dash-tools">{s.tools.join(' · ')}</span>}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </section>

          {/* CTF */}
          <section className="dcard" aria-labelledby="d-ctf">
            <h2 id="d-ctf" className="dcard-h"><span className="tp-dollar">$</span> ls ctf/</h2>
            <ul className="dash-ctf">
              {ctfCategories.map((c) => (
                <li key={c.code}><code>{c.code}</code><span><b>{c.title}</b><small>{c.desc}</small></span></li>
              ))}
            </ul>
            <p className="dash-note"><TrophyIcon /><span>Scoreboard goes live on day 2 — flags are earned, not given.</span></p>
          </section>

          {/* Quick links */}
          <section className="dcard" aria-labelledby="d-links">
            <h2 id="d-links" className="dcard-h"><span className="tp-dollar">$</span> ls docs/</h2>
            <ul className="dash-links">
              {quickLinks.map((l) => (
                <li key={l.href}>
                  <a href={l.href}><span><b>{l.label}</b><small>{l.desc}</small></span><ArrowRightIcon /></a>
                </li>
              ))}
            </ul>
          </section>
        </div>
          </>
        )
      }}
    </ConsoleLayout>
  )
}
