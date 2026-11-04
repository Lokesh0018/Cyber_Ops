import { included } from '../data/content'
import { ArrowRightIcon, CheckIcon } from './Icons'

export function Register() {
  return (
    <section className="band" id="register" aria-labelledby="register-title">
      <div className="wrap">
        <div className="cta-card">
          <h2 id="register-title">
            Ready to go <span className="g">hands-on</span>?
          </h2>
          <p>Secure your lab seat for two days of real tooling, live demos, and a competitive CTF finale.</p>
          <ul className="includes">
            {included.map((item) => (
              <li key={item}>
                <CheckIcon /> {item}
              </li>
            ))}
          </ul>
          <div className="btngroup">
            <a className="btn btn-primary btn-lg" href="#">
              Register Now <ArrowRightIcon />
            </a>
            <a className="btn btn-ghost btn-lg" href="#">Login</a>
          </div>
          <div className="seats">
            <span className="dot" /> Limited lab seats — register early
          </div>
        </div>
      </div>
    </section>
  )
}
