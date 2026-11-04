import { heroStats } from '../data/content'
import { ArrowRightIcon, CalendarIcon, ClockIcon, ListIcon, PeaksIcon, ShieldIcon } from './Icons'

const chips = [
  { Icon: ShieldIcon, label: 'Beginner → Advanced' },
  { Icon: ClockIcon, label: '2 Days · 16+ hours' },
  { Icon: ListIcon, label: '100+ Kali Linux Tools' },
  { Icon: PeaksIcon, label: 'Live CTF Competition' },
]

function Terminal() {
  return (
    <div className="term" aria-hidden="true">
      <div className="term-bar">
        <i /><i /><i />
        <span>participant@cyberops: ~/bootcamp</span>
      </div>
      <pre>
        <span className="p">$</span> <span className="c">./bootcamp</span> --days 2 --mode hands-on{'\n'}
        <span className="o">[+] Loading Kali Linux toolset ....</span> <span className="ok">100+ ready</span>{'\n'}
        <span className="o">[+] Recon · Web · Network · Exploit </span> <span className="ok">online</span>{'\n'}
        <span className="o">[+] Lab targets ....................</span> <span className="ok">isolated</span>{'\n'}
        <span className="o">[+] Day 2 module ...................</span> <span className="v">SHM AutoVAPT</span>{'\n'}
        <span className="o">[*] CTF scoreboard live — capture the flag.</span>{'\n'}
        <span className="p">$</span> <span className="cursor" />
      </pre>
    </div>
  )
}

export function Hero() {
  return (
    <section className="band hero" id="top" aria-labelledby="hero-title">
      <div className="wrap">
        <div className="hero-grid">
          <div>
            <div className="brandrow">
              <span className="dot" /> SHM Technologies LLP
              <span className="sep">//</span>
              <span className="host">Hands-on Offensive &amp; Defensive Security</span>
            </div>

            <div className="kicker">2-Day Immersive Workshop</div>
            <h1 className="title" id="hero-title">
              CYBER<span className="g">OPS</span>
              <br />
              BOOTCAMP
            </h1>
            <p className="tagline">
              From <b>reconnaissance</b> to <b>exploitation</b> to <b>capture-the-flag</b> — two intensive days of
              real industry tooling, live demos, and a competitive CTF finale. Day 2 unveils <b>SHM's own automated
              security scanner</b>.
            </p>

            <div className="btngroup">
              <a className="btn btn-primary btn-lg" href="#register">
                Register Now <ArrowRightIcon />
              </a>
              <a className="btn btn-ghost btn-lg" href="#schedule">
                <CalendarIcon /> View Schedule
              </a>
            </div>

            <div className="metastrip">
              {chips.map(({ Icon, label }) => (
                <span className="chip" key={label}>
                  <Icon /> {label}
                </span>
              ))}
            </div>
          </div>

          <Terminal />
        </div>

        <div className="stats">
          {heroStats.map((s) => (
            <div className="stat" key={s.label}>
              <div className="num">{s.num}</div>
              <div className="lbl">{s.label}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
