import logo from '../assets/shm-logo.webp'
import { contactEmail, navLinks } from '../data/content'
import { MailIcon } from './Icons'

export function Footer() {
  return (
    <footer className="foot">
      <div className="wrap">
        <div className="foot-grid">
          <div className="foot-brand">
            <img src={logo} alt="SHM Technologies logo" width={72} height={72} loading="lazy" />
            <div>
              <strong>SHM Technologies LLP</strong>
              <div className="motto">Innovating the Future</div>
              <p>Cybersecurity &amp; VAPT training — hands-on offensive and defensive security workshops.</p>
            </div>
          </div>

          <div>
            <h3>Workshop</h3>
            <ul>
              {navLinks.map((l) => (
                <li key={l.id}>
                  <a href={`#${l.id}`}>{l.label}</a>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h3>Contact</h3>
            <ul>
              <li>
                <a href={`mailto:${contactEmail}`}>
                  <MailIcon /> {contactEmail}
                </a>
              </li>
              <li>
                <a href="#register">Register for the bootcamp</a>
              </li>
            </ul>
          </div>
        </div>

        <div className="foot-bottom">
          <span>© {new Date().getFullYear()} SHM Technologies LLP. All rights reserved.</span>
          <span>CyberOps Bootcamp · Cybersecurity &amp; VAPT Training</span>
        </div>
      </div>
    </footer>
  )
}
