import logo from '../assets/shm-logo.webp'
import { included } from '../data/content'
import { onLinkClick } from '../hooks/useRoute'
import { ArrowRightIcon, CheckIcon } from './Icons'

export function Register() {
  return (
    <section className="band" id="register" aria-labelledby="register-title">
      <div className="wrap">
        <div className="cta-card">
          <img className="cta-mark" src={logo} alt="" aria-hidden="true" loading="lazy" decoding="async" />
          <p className="seats">
            <span className="dot" aria-hidden="true" /> Limited lab seats — register early
          </p>
          <h2 id="register-title">
            Ready to go <span className="g">hands-on</span>?
          </h2>
          <p className="cta-lead">
            Secure your lab seat for two days of real tooling, live demos, and a competitive CTF finale.
          </p>

          <div className="cta-act">
            <a className="btn btn-primary btn-lg" href="/register" onClick={onLinkClick}>
              Register Now <ArrowRightIcon />
            </a>
            <p className="cta-login">
              Already registered? <a href="/login" onClick={onLinkClick}>Log in</a>
            </p>
          </div>

          <ul className="perks" aria-label="What's included">
            {included.map((item) => (
              <li key={item}>
                <CheckIcon /> {item}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  )
}
