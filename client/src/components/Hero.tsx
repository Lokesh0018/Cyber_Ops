import type { CSSProperties } from 'react'
import logo from '../assets/shm-logo.webp'
import { heroStats } from '../data/content'
import {
  ArrowRightIcon,
  CalendarIcon,
  ClockIcon,
  ListIcon,
  RadarIcon,
  ShieldIcon,
  TrophyIcon,
} from './Icons'
import { useInView } from '../hooks/useInView'

const meta = [
  { Icon: ShieldIcon, label: 'Beginner → Advanced' },
  { Icon: ClockIcon, label: '16+ hours hands-on' },
  { Icon: ListIcon, label: '100+ Kali tools' },
]

// Each line fades in on a stagger (--i); static when reduced motion is preferred.
const lines = [
  <><span className="p">$</span> <span className="c">./bootcamp</span> --days 2 --mode hands-on</>,
  <><span className="o">[+] Loading Kali Linux toolset ....</span> <span className="ok">100+ ready</span></>,
  <><span className="o">[+] Recon · Web · Network · Exploit </span> <span className="ok">online</span></>,
  <><span className="o">[+] Lab targets ....................</span> <span className="ok">isolated</span></>,
  <><span className="o">[+] Day 2 module ...................</span> <span className="v">SHM AutoVAPT</span></>,
  <><span className="o">[*] CTF scoreboard live — capture the flag.</span></>,
]

// Replays the line-by-line reveal each time the terminal scrolls back into view.
function HeroVisual() {
  const { ref, inView } = useInView<HTMLDivElement>(0.3)
  return (
    <div className={inView ? 'hero-visual run' : 'hero-visual'} ref={ref} aria-hidden="true">
      <div className="hv-orb" />
      <div className="term">
        <span className="hud tl" /><span className="hud tr" /><span className="hud bl" /><span className="hud br" />
        <div className="term-bar">
          <i /><i /><i />
          <span className="term-tabs">
            <span className="tab on">bootcamp.sh</span>
            <span className="tab">recon</span>
            <span className="tab">ctf</span>
          </span>
          <span className="term-live"><span className="dot" /> LIVE</span>
        </div>
        <div className="term-body">
          {lines.map((line, i) => (
            <div className="tl-line" style={{ '--i': i } as CSSProperties} key={i}>{line}</div>
          ))}
          <div className="tl-line tl-progress" style={{ '--i': lines.length } as CSSProperties}>
            <span className="o">lab provisioning</span>
            <span className="bar"><span /></span>
            <span className="ok">100%</span>
          </div>
          <div className="tl-line" style={{ '--i': lines.length + 1 } as CSSProperties}>
            <span className="p">participant@cyberops</span><span className="o">:~$</span> <span className="cursor" />
          </div>
        </div>
      </div>

      <div className="float-card fc-ctf">
        <span className="fc-ico"><TrophyIcon /></span>
        <span>
          <strong>Live CTF</strong>
          <small>2 hrs · 4 categories</small>
        </span>
      </div>
      <div className="float-card fc-tool">
        <span className="fc-ico"><RadarIcon /></span>
        <span>
          <strong>SHM AutoVAPT</strong>
          <small>Day 2 · in-house scanner</small>
        </span>
      </div>
    </div>
  )
}

export function Hero() {
  return (
    <section className="band hero" id="top" aria-labelledby="hero-title">
      <div className="hero-bg" aria-hidden="true">
        <div className="hero-kali" />
        <div className="hero-grid-lines" />
      </div>

      <div className="wrap">
        <div className="hero-grid">
          <div className="hero-copy">
            <a className="status-pill" href="#register">
              <span className="live"><span className="dot" /> Open</span>
              Registrations open — limited lab seats
              <ArrowRightIcon />
            </a>

            <p className="presenter">
              <span>SHM Technologies LLP <span className="sub">presents</span></span>
              <span>2-Day Immersive Workshop</span>
            </p>

            <h1 className="title" id="hero-title">
              CYBER<span className="g">OPS</span>
              <span className="title-2">BOOTCAMP</span>
            </h1>
            <span className="title-rule" aria-hidden="true" />

            <p className="tagline">
              From <b>reconnaissance</b> to <b>exploitation</b> to <b>capture-the-flag</b> — two intensive days of
              real industry tooling, live demos, and a competitive CTF finale. Day 2 unveils <b>SHM's own automated
              security scanner</b>.
            </p>

            <div className="btngroup">
              <a className="btn btn-primary btn-lg btn-shine" href="#register">
                Register Now <ArrowRightIcon />
              </a>
              <a className="btn btn-ghost btn-lg" href="#schedule">
                <CalendarIcon /> View Schedule
              </a>
            </div>

            <ul className="hero-meta">
              {meta.map(({ Icon, label }) => (
                <li key={label}>
                  <Icon /> {label}
                </li>
              ))}
            </ul>

            <div className="hosted">
              <img src={logo} alt="" width={36} height={36} />
              <span>
                Hosted by <b>SHM Technologies LLP</b>
                <small>Cybersecurity &amp; VAPT Training</small>
              </span>
            </div>
          </div>

          <HeroVisual />
        </div>

        <dl className="stats">
          {heroStats.map((s) => {
            const plus = s.num.endsWith('+')
            return (
              <div className="stat" key={s.label}>
                <dt className="lbl">{s.label}</dt>
                <dd className="num">
                  {plus ? s.num.slice(0, -1) : s.num}
                  {plus && <span className="plus">+</span>}
                </dd>
              </div>
            )
          })}
        </dl>
      </div>
    </section>
  )
}
