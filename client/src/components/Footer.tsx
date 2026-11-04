import type { CSSProperties } from 'react'
import logo from '../assets/shm-logo.webp'
import { contactEmail, navLinks } from '../data/content'
import { useInView } from '../hooks/useInView'
import { ArrowRightIcon, ChevronsUpIcon, MailIcon, ShieldIcon } from './Icons'

export function Footer() {
  // Replays the footer "boot" sequence (staggered columns, links, status line) on each scroll-in.
  const { ref, inView } = useInView<HTMLElement>(0.15)

  return (
    <footer className={inView ? 'foot run' : 'foot'} ref={ref}>
      <div className="foot-divider" aria-hidden="true">
        <span className="tdiv-rule" />
        <span className="tdiv-tag"><b>[</b> root@cyberops <b>]</b></span>
        <span className="tdiv-rule" />
      </div>
      <div className="foot-bg" aria-hidden="true" />
      <div className="foot-aurora" aria-hidden="true">
        <span className="aur a1" />
        <span className="aur a2" />
      </div>
      <div className="foot-kali" aria-hidden="true" />
      <div className="wrap">
        <div className="foot-grid">
          <div className="foot-brand foot-col" style={{ '--i': 0 } as CSSProperties}>
            <div className="foot-logo">
              <span className="foot-ring" aria-hidden="true" />
              <img src={logo} alt="SHM Technologies logo" width={72} height={72} loading="lazy" />
            </div>
            <div>
              <strong>SHM Technologies LLP</strong>
              <div className="motto">Innovating the Future</div>
              <p>Cybersecurity &amp; VAPT training — hands-on offensive and defensive security workshops.</p>
              <div className="foot-tag">
                <ShieldIcon /> Offense informs defense
              </div>
            </div>
          </div>

          <nav className="foot-col" aria-labelledby="foot-nav-title" style={{ '--i': 1 } as CSSProperties}>
            <h3 id="foot-nav-title"><span aria-hidden="true">~/</span>workshop</h3>
            <ul className="foot-links">
              {navLinks.map((l, i) => (
                <li key={l.id} style={{ '--j': i } as CSSProperties}>
                  <a href={`#${l.id}`}>
                    <span className="foot-idx" aria-hidden="true">{String(i + 1).padStart(2, '0')}</span>
                    {l.label}
                  </a>
                </li>
              ))}
            </ul>
          </nav>

          <div className="foot-col" style={{ '--i': 2 } as CSSProperties}>
            <h3><span aria-hidden="true">~/</span>contact</h3>
            <div className="foot-term">
              <span className="hud tl" aria-hidden="true" />
              <span className="hud br" aria-hidden="true" />
              <span className="foot-scan" aria-hidden="true" />
              <div className="foot-term-head">
                <span className="dot" aria-hidden="true" /> Registrations open
              </div>
              <a className="foot-mail" href={`mailto:${contactEmail}`}>
                <MailIcon /> {contactEmail}
              </a>
              <a className="btn btn-primary foot-cta" href="#register">
                Register for the bootcamp <ArrowRightIcon />
              </a>
            </div>
          </div>
        </div>

        <div className="foot-bottom">
          <span>© {new Date().getFullYear()} SHM Technologies LLP. All rights reserved.</span>
          <span className="foot-status">
            <span className="foot-prompt" aria-hidden="true">root@cyberops:~$</span>{' '}
            <span className="foot-type">CyberOps Bootcamp · Cybersecurity &amp; VAPT Training</span>
            <span className="foot-cursor" aria-hidden="true" />
          </span>
          <a className="foot-top" href="#top">
            <ChevronsUpIcon /> Back to top
          </a>
        </div>
      </div>
    </footer>
  )
}
