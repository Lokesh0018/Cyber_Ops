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
import { useState } from 'react'
import { SCENE_TABS, TypingTerminal } from './TypingTerminal'

const meta = [
  { Icon: ShieldIcon, label: 'Beginner → Advanced' },
  { Icon: ClockIcon, label: '16+ hours hands-on' },
  { Icon: ListIcon, label: '100+ Kali tools' },
]

// The terminal types continuously while it is on screen (see TypingTerminal).
function HeroVisual() {
  const { ref, inView } = useInView<HTMLDivElement>(0.3)
  const [tab, setTab] = useState(0) // the title-bar tab follows the scene being typed
  return (
    <div className={inView ? 'hero-visual run' : 'hero-visual'} ref={ref} aria-hidden="true">
      <div className="hv-orb" />
      <div className="term">
        <span className="hud tl" /><span className="hud tr" /><span className="hud bl" /><span className="hud br" />
        <div className="term-bar">
          <i /><i /><i />
          <span className="term-tabs">
            {SCENE_TABS.map((t, i) => <span key={t} className={i === tab ? 'tab on' : 'tab'}>{t}</span>)}
          </span>
          <span className="term-live"><span className="dot" /> LIVE</span>
        </div>
        <TypingTerminal active={inView} onScene={setTab} />
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
  // Continuous hero effects (cursor, status dots, floating cards) run only while the section is on screen.
  const { ref, inView } = useInView<HTMLElement>(0.15)
  return (
    <section className={inView ? 'band hero on' : 'band hero'} id="top" aria-labelledby="hero-title" ref={ref}>
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
