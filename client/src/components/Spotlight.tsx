import type { CSSProperties } from 'react'
import logo from '../assets/shm-logo.webp'
import { autovaptFeatures, schedule } from '../data/content'
import { useInView } from '../hooks/useInView'
import { ArrowRightIcon, CalendarIcon, CheckIcon, FileIcon, GlobeIcon, RadarIcon, ServerIcon } from './Icons'

const featureIcons = [RadarIcon, GlobeIcon, ServerIcon, FileIcon]

// The Day 2 sessions where participants work with AutoVAPT, straight from the schedule.
const day2 = schedule.find((d) => d.num === '02')
const toolSessions = (day2?.phases.flatMap((p) => p.sessions) ?? []).filter((s) => /AutoVAPT|Tool/.test(s.title))

const stages = [
  { name: 'Recon', detail: 'DNS · WHOIS · subdomains · TLS' },
  { name: 'Enumerate', detail: 'Ports · services · tech stack' },
  { name: 'Vuln checks', detail: 'OWASP Top 10 surface tests' },
  { name: 'Report', detail: 'Severity · evidence · OWASP map' },
]

// Illustrative only — the preview is labelled "Sample" and hidden from assistive tech.
const severity = [
  { label: 'Critical', n: 1, c: 'var(--magenta)' },
  { label: 'High', n: 3, c: 'var(--amber)' },
  { label: 'Medium', n: 6, c: 'var(--accent)' },
  { label: 'Low', n: 9, c: 'var(--muted)' },
]
const total = severity.reduce((n, s) => n + s.n, 0)

// Each time it scrolls into view the preview "runs": stages tick off in order, then the status
// flips to Completed and the severity bar fills (all CSS, keyed off .run; static under reduced motion).
function ReportPreview() {
  const { ref, inView } = useInView<HTMLDivElement>()
  return (
    <div className={inView ? 'rp run' : 'rp'} ref={ref} aria-hidden="true">
      <div className="rp-bar">
        <i /><i /><i />
        <span className="rp-title">AutoVAPT · scan report</span>
        <span className="rp-sample">Sample</span>
      </div>
      <div className="rp-body">
        <div className="rp-target">
          <span className="rp-ico"><RadarIcon /></span>
          <div>
            <small>Target</small>
            <strong>lab-target.local</strong>
          </div>
          <span className="rp-status">
            <span className="st scanning"><span className="dot" /> Scanning…</span>
            <span className="st done"><span className="dot" /> Completed</span>
          </span>
        </div>

        <ol className="rp-stages">
          {stages.map((s, i) => (
            <li key={s.name} style={{ '--i': i } as CSSProperties}>
              <CheckIcon />
              <span className="rp-stage-name">{s.name}</span>
              <span className="rp-stage-detail">{s.detail}</span>
            </li>
          ))}
        </ol>

        <div className="rp-sev">
          <div className="rp-sev-head">
            <span>Findings by severity</span>
            <b>{total}</b>
          </div>
          <div className="rp-sev-bar">
            {severity.map((s, i) => (
              <span key={s.label} style={{ flexGrow: s.n, background: s.c, '--i': i } as CSSProperties} />
            ))}
          </div>
          <ul className="rp-sev-legend">
            {severity.map((s) => (
              <li key={s.label}>
                <span className="sw" style={{ background: s.c }} />
                {s.label} <b>{s.n}</b>
              </li>
            ))}
          </ul>
        </div>

        <div className="rp-foot">
          <span className="rp-file">
            <FileIcon /> autovapt-report.html
          </span>
          <span className="rp-owasp">
            <CheckIcon /> OWASP Top 10 mapped
          </span>
        </div>
      </div>
    </div>
  )
}

export function Spotlight() {
  return (
    <section className="band spot-band" id="autovapt" aria-labelledby="autovapt-title">
      <div className="wrap">
        <div className="spot">
          <div className="spot-copy">
            <div className="eyebrow">Day 2 Spotlight</div>
            <h2 id="autovapt-title">
              Meet <span className="v">SHM AutoVAPT</span>
            </h2>
            <p className="spot-sub">Our in-house automated security scanner</p>
            <span className="maker">
              <img src={logo} alt="" width={22} height={22} />
              Built in-house by <b>SHM Technologies</b>
            </span>
            <p>
              Built by SHM Technologies, AutoVAPT chains reconnaissance, enumeration, and vulnerability checks into a
              single automated workflow — then generates a clean, OWASP-mapped report. You'll see it demonstrated
              live, then drive it yourself against a real lab target.
            </p>

            <div className="spot-day">
              <h3>
                <CalendarIcon /> Your Day 2 with AutoVAPT
              </h3>
              <ol>
                {toolSessions.map((s) => (
                  <li key={s.time}>
                    <span className="t">{s.time}</span>
                    <span className="n">{s.title}</span>
                  </li>
                ))}
              </ol>
            </div>

            <div className="btngroup">
              <a className="btn btn-primary" href="#register">
                Reserve a seat <ArrowRightIcon />
              </a>
              <a className="btn btn-ghost" href="#schedule">
                Full Day 2 schedule
              </a>
            </div>
          </div>

          <ReportPreview />
        </div>

        <ul className="spot-feats">
          {autovaptFeatures.map((f, i) => {
            const Icon = featureIcons[i]
            return (
              <li key={f.title}>
                <span className="sf-ico"><Icon /></span>
                <h3>{f.title}</h3>
                <p>{f.desc}</p>
              </li>
            )
          })}
        </ul>
      </div>
    </section>
  )
}
