import { useEffect, useState } from 'react'
import { schedule } from '../data/content'
import { ConsoleLayout } from './ConsoleLayout'
import { Leaderboard } from './Leaderboard'
import { CheckIcon } from './Icons'

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
          {/* Scoreboard: top 10 performers */}
          <Leaderboard />

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
            {/* Both days are laid out in the same grid cell so the card keeps the taller day's height; only the
                visible one changes when the tab switches. */}
            <div className="dash-days">
              {schedule.map((d, i) => (
                <div key={d.num} className="dash-day" hidden={i !== day ? true : undefined} aria-hidden={i !== day}>
                  <p className="dash-daytitle"><b>{d.title}</b> <span className="tmuted">· {d.meta}</span></p>
                  <div className="dash-phases">
                    {d.phases.map((ph) => (
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
                </div>
              ))}
            </div>
          </section>

        </div>
          </>
        )
      }}
    </ConsoleLayout>
  )
}
