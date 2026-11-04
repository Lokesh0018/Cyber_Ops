import { schedule, type Day, type Session } from '../data/content'
import { CoffeeIcon, TrophyIcon, UtensilsIcon } from './Icons'

function SessionRow({ s }: { s: Session }) {
  const cls = ['row', s.violet && 'v', s.breakKind && 'brk'].filter(Boolean).join(' ')
  const BreakIcon = s.breakKind === 'lunch' ? UtensilsIcon : CoffeeIcon

  return (
    <div className={cls}>
      <div className="time">{s.time}</div>
      <div className="sess">
        <h4>
          {s.breakKind && <BreakIcon className="ico-inline" />}
          {s.title}
          {s.badge && (
            <span className={`badge b-${s.badge.kind}`}>
              {'trophy' in s.badge ? <TrophyIcon className="ico-inline" aria-label="Awards" /> : s.badge.label}
            </span>
          )}
        </h4>
        {s.desc && <p>{s.desc}</p>}
        {s.tools && (
          <div className="inline-tags">
            {s.tools.map((t) => (
              <span key={t}>{t}</span>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function DayCard({ day }: { day: Day }) {
  return (
    <div className="daycard">
      <div className={day.violet ? 'dayhead v' : 'dayhead'}>
        <div className={day.violet ? 'daynum v' : 'daynum'}>{day.num}</div>
        <div>
          <h3>{day.title}</h3>
          <p>{day.meta}</p>
        </div>
      </div>
      <div className="daybody">
        {day.phases.map((phase) => (
          <div key={phase.label}>
            <div className="phase">{phase.label}</div>
            {phase.sessions.map((s) => (
              <SessionRow key={s.time} s={s} />
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}

export function Schedule() {
  return (
    <section aria-labelledby="schedule-title">
      <div className="eyebrow">The Schedule</div>
      <h2 className="sec" id="schedule-title">Two days, built for momentum</h2>
      <p className="sec-lead">Theory in the morning, hands-on in the afternoon — then prove it on the flags.</p>
      {schedule.map((day) => (
        <DayCard key={day.num} day={day} />
      ))}
    </section>
  )
}
