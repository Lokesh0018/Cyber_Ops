import { ctfCategories, schedule } from '../data/content'
import {
  ArrowRightIcon,
  CheckIcon,
  ClockIcon,
  GlobeIcon,
  ImageIcon,
  NetworkIcon,
  PeaksIcon,
  SearchIcon,
  TrophyIcon,
} from './Icons'
import { SectionHeader } from './SectionHeader'

const catIcons = { WEB: GlobeIcon, NET: NetworkIcon, OSINT: SearchIcon, STEG: ImageIcon } as const

const sessions = schedule.flatMap((d) =>
  d.phases.flatMap((p) => p.sessions.map((s) => ({ ...s, day: d.num }))),
)
const find = (re: RegExp) => sessions.find((s) => re.test(s.title))

// Each CTF category maps to the lab session that trains it, so "Practice with" lists real workshop tools.
const practice: Record<string, string[]> = {
  WEB: find(/Web Application Security Practical/)?.tools ?? [],
  NET: find(/Network Security Practical/)?.tools ?? [],
  OSINT: [...(find(/OSINT/)?.tools ?? []), ...(find(/Web Recon/)?.tools ?? []).slice(0, 2)],
  STEG: find(/Steganography/)?.tools ?? [],
}

// The road to the finale, straight from the schedule.
const road = [
  { s: find(/Beginner CTF/), Icon: PeaksIcon, note: 'Warm-up flags to lock in Day 1' },
  { s: find(/^CTF Competition/), Icon: ClockIcon, note: 'Two hours, live individual ranking' },
  { s: find(/^Evaluation/), Icon: CheckIcon, note: 'Scoring & performance review' },
  { s: find(/Closing Ceremony/), Icon: TrophyIcon, note: 'Winners, awards & certificates' },
].filter((r) => r.s)

export function Ctf() {
  return (
    <section className="band band-alt ctf-band" id="ctf" aria-labelledby="ctf-title">
      <div className="wrap">
        <SectionHeader
          id="ctf-title"
          eyebrow="The Finale"
          center
          title={<>Capture The <span className="g">Flag</span> Competition</>}
          lead="Two hours, four categories, one live scoreboard. Put every tool from the workshop to work and race for the top spot."
        />

        <ol className="ctf-road" aria-label="Road to the finale">
          {road.map(({ s, Icon, note }, i) => (
            <li key={s!.title} className={i === 1 ? 'main' : undefined}>
              <span className="road-node"><Icon /></span>
              <span className="road-when">
                Day {s!.day} · {s!.time.split('–')[0]}
              </span>
              <strong>{s!.title}</strong>
              <small>{note}</small>
            </li>
          ))}
        </ol>

        <div className="cats">
          {ctfCategories.map((c) => {
            const Icon = catIcons[c.code as keyof typeof catIcons]
            return (
              <article className="cat" key={c.code}>
                <div className="cat-head">
                  <span className="cicon"><Icon /></span>
                  <span className="code">{c.code}</span>
                </div>
                <h3>{c.title}</h3>
                <p>{c.desc}</p>
                {practice[c.code]?.length > 0 && (
                  <div className="cat-practice">
                    <span className="lbl">Practice with</span>
                    <ul>
                      {practice[c.code].map((t) => (
                        <li key={t}>{t}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </article>
            )
          })}
        </div>

        <div className="ctf-cta">
          <p>
            <TrophyIcon /> Ready to compete? Lab seats are limited.
          </p>
          <a className="btn btn-primary" href="#register">
            Register Now <ArrowRightIcon />
          </a>
        </div>
      </div>
    </section>
  )
}
