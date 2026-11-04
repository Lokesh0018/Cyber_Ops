import { useRef, useState, type KeyboardEvent } from 'react'
import { schedule, type Day, type Session } from '../data/content'
import { CoffeeIcon, TrophyIcon, UtensilsIcon } from './Icons'
import { SectionHeader } from './SectionHeader'

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

function DayPanel({ day }: { day: Day }) {
  return (
    <div className="daycard">
      <div className={day.violet ? 'dayhead v' : 'dayhead'}>
        <h3>Day {day.num} · {day.title}</h3>
        <p>{day.meta}</p>
      </div>
      <div className="daybody">
        {day.phases.map((phase) => (
          <div className="phase-col" key={phase.label}>
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
  const [selected, setSelected] = useState(0)
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([])

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const step = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 0
    if (!step) return
    e.preventDefault()
    const next = (selected + step + schedule.length) % schedule.length
    setSelected(next)
    tabRefs.current[next]?.focus()
  }

  return (
    <section className="band" id="schedule" aria-labelledby="schedule-title">
      <div className="wrap">
        <SectionHeader
          id="schedule-title"
          eyebrow="The Schedule"
          title={<>Two days, built for <span className="g">momentum</span></>}
          lead="Theory in the morning, hands-on in the afternoon — then prove it on the flags."
        />

        <div className="daytabs" role="tablist" aria-label="Workshop days" onKeyDown={onKeyDown}>
          {schedule.map((day, i) => (
            <button
              key={day.num}
              ref={(el) => {
                tabRefs.current[i] = el
              }}
              className={day.violet ? 'daytab v' : 'daytab'}
              role="tab"
              type="button"
              id={`day-tab-${day.num}`}
              aria-selected={selected === i}
              aria-controls={`day-panel-${day.num}`}
              tabIndex={selected === i ? 0 : -1}
              onClick={() => setSelected(i)}
            >
              <span className={day.violet ? 'daynum v' : 'daynum'}>{day.num}</span>
              <span>
                <strong>{day.title}</strong>
                <small>{day.meta.split(' · ')[0]}</small>
              </span>
            </button>
          ))}
        </div>

        {schedule.map((day, i) => (
          <div
            key={day.num}
            role="tabpanel"
            id={`day-panel-${day.num}`}
            aria-labelledby={`day-tab-${day.num}`}
            hidden={selected !== i}
          >
            <DayPanel day={day} />
          </div>
        ))}
      </div>
    </section>
  )
}
