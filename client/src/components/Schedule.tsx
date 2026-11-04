import { useRef, useState, type CSSProperties, type KeyboardEvent } from 'react'
import { schedule, type Day, type Session } from '../data/content'
import { CheckIcon, ClockIcon, CoffeeIcon, TrophyIcon, UtensilsIcon } from './Icons'
import { SectionHeader } from './SectionHeader'

// "09:30–10:15" -> minutes between the two times.
const toMin = (t: string) => {
  const [h, m] = t.split(':').map(Number)
  return h * 60 + m
}
const minutes = (range: string) => {
  const [a, b] = range.split('–')
  return toMin(b) - toMin(a)
}
const fmtDur = (min: number) => {
  const h = Math.floor(min / 60)
  const m = min % 60
  if (!h) return `${m} min`
  return m ? `${h} h ${m} min` : `${h} h`
}

const span = (sessions: Session[]) => ({
  start: sessions[0].time.split('–')[0],
  end: sessions[sessions.length - 1].time.split('–')[1],
})

type Kind = 'talk' | 'lab' | 'flag' | 'brk'
const kindOf = (s: Session): Kind => (s.breakKind ? 'brk' : s.badge?.kind === 'flag' ? 'flag' : s.tools ? 'lab' : 'talk')
const kindLabel: Record<Kind, string> = { talk: 'Talk', lab: 'Hands-on lab', flag: 'CTF', brk: 'Break' }

function dayStats(day: Day) {
  const sessions = day.phases.flatMap((p) => p.sessions)
  const talks = sessions.filter((s) => !s.breakKind)
  return {
    sessions: talks.length,
    labs: talks.filter((s) => s.tools).length,
    hours: (toMin(span(sessions).end) - toMin(span(sessions).start)) / 60,
  }
}

// Day-at-a-glance: one segment per session, sized by its duration. Decorative —
// the timeline below carries the same information for assistive tech.
function DayStrip({ day }: { day: Day }) {
  const sessions = day.phases.flatMap((p) => p.sessions)
  const { start, end } = span(sessions)
  const t0 = toMin(start)
  const total = toMin(end) - t0
  const hours: number[] = []
  for (let h = Math.ceil(t0 / 60); h * 60 <= t0 + total; h++) hours.push(h)
  const kinds = (['talk', 'lab', 'flag', 'brk'] as Kind[]).filter((k) => sessions.some((s) => kindOf(s) === k))

  return (
    <div className="daystrip">
      <div className="strip-bar" aria-hidden="true">
        {sessions.map((s) => (
          <span
            key={s.time}
            className={`seg k-${kindOf(s)}`}
            style={{ flexGrow: minutes(s.time) }}
            title={`${s.time} · ${s.title}`}
          />
        ))}
      </div>
      <div className="strip-ticks" aria-hidden="true">
        {hours.map((h) => (
          <span key={h} style={{ left: `${((h * 60 - t0) / total) * 100}%` }}>
            {String(h).padStart(2, '0')}
          </span>
        ))}
      </div>
      <ul className="strip-legend" aria-label="Session types">
        {kinds.map((k) => (
          <li key={k}>
            <span className={`lg k-${k}`} aria-hidden="true" />
            {kindLabel[k]}
          </li>
        ))}
      </ul>
    </div>
  )
}

function SessionRow({ s }: { s: Session }) {
  const dur = fmtDur(minutes(s.time))

  if (s.breakKind) {
    const BreakIcon = s.breakKind === 'lunch' ? UtensilsIcon : CoffeeIcon
    return (
      <li className="row brk">
        <span className="node" aria-hidden="true" />
        <div className="brk-pill">
          <BreakIcon className="ico" />
          <span className="brk-title">{s.title}</span>
          <span className="brk-time">{s.time.replace('–', ' – ')} · {dur}</span>
        </div>
      </li>
    )
  }

  const [from, to] = s.time.split('–')
  const cls = ['row', `k-${kindOf(s)}`, s.violet && 'v'].filter(Boolean).join(' ')

  return (
    <li className={cls}>
      <span className="node" aria-hidden="true" />
      <div className="when">
        <span className="time">{from}</span>
        <span className="sr-only"> to {to}, </span>
        <span className="dur">{dur}</span>
      </div>
      <div className="sess">
        <h4>
          {s.title}
          {s.badge && (
            <span className={`badge b-${s.badge.kind}`}>
              {'trophy' in s.badge ? <TrophyIcon className="ico-inline" aria-label="Awards" /> : s.badge.label}
            </span>
          )}
        </h4>
        {s.desc && <p>{s.desc}</p>}
        {s.tools && (
          <ul className="inline-tags" aria-label="Tools used in this lab">
            {s.tools.map((t) => (
              <li key={t}>{t}</li>
            ))}
          </ul>
        )}
      </div>
    </li>
  )
}

// The final phase closes on a "Day NN wraps" cap so every column ends on a pill (morning ends on lunch).
const hasCap = (day: Day, i: number) =>
  i === day.phases.length - 1 && !day.phases[i].sessions[day.phases[i].sessions.length - 1].breakKind

function DayPanel({ day }: { day: Day }) {
  // Shared row count so morning and afternoon line up row-for-row (see .daybody subgrid).
  const rows = Math.max(...day.phases.map((p, i) => p.sessions.length + (hasCap(day, i) ? 1 : 0)))
  return (
    <div className={day.violet ? 'daycard v' : 'daycard'}>
      <div className="dayhead">
        <h3 className="sr-only">Day {day.num} · {day.title}</h3>
        <p className="dayhead-k">
          <ClockIcon className="ico" /> Day {day.num} · {day.meta.split(' · ')[0]}
        </p>
        <DayStrip day={day} />
      </div>
      <div className="daybody" style={{ '--rows': rows } as CSSProperties}>
        {day.phases.map((phase, i) => {
          const [when, what] = phase.label.split(' · ')
          const range = span(phase.sessions.filter((s) => !s.breakKind))
          return (
            <div className="phase-col" key={phase.label}>
              <div className="phase">
                <span className="phase-when">{when}</span>
                <span className="phase-what">{what}</span>
                <span className="phase-range">
                  {range.start} – {range.end}
                </span>
              </div>
              <ol className="timeline">
                {phase.sessions.map((s) => (
                  <SessionRow key={s.time} s={s} />
                ))}
                {hasCap(day, i) && (
                  <li className="row brk cap">
                    <span className="node" aria-hidden="true" />
                    <div className="brk-pill">
                      <CheckIcon className="ico" />
                      <span className="brk-title">Day {day.num} wraps</span>
                      <span className="brk-time">{range.end}</span>
                    </div>
                  </li>
                )}
              </ol>
            </div>
          )
        })}
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
    <section className="band sched-band" id="schedule" aria-labelledby="schedule-title">
      <div className="wrap">
        <SectionHeader
          id="schedule-title"
          eyebrow="The Schedule"
          title={<>Two days, built for <span className="g">momentum</span></>}
          lead="Theory in the morning, hands-on in the afternoon — then prove it on the flags."
        />

        <div className="daytabs" role="tablist" aria-label="Workshop days" onKeyDown={onKeyDown}>
          {schedule.map((day, i) => {
            const st = dayStats(day)
            return (
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
                <span className="daynum">
                  <small>Day</small>
                  {day.num}
                </span>
                <span className="daytab-txt">
                  <strong>{day.title}</strong>
                  <small>
                    {st.hours} hrs · {st.sessions} sessions{st.labs > 0 && ` · ${st.labs} labs`}
                  </small>
                </span>
              </button>
            )
          })}
        </div>

        {schedule.map((day, i) => (
          <div
            key={day.num}
            className="daypanel"
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
