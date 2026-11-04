import logo from '../assets/shm-logo.webp'
import { autovaptFeatures, contactEmail, ctfCategories, outcomes } from '../data/content'
import { AuthButtons } from './Hero'

export function Spotlight() {
  return (
    <section>
      <div className="spot">
        <div className="eyebrow">Day 2 Spotlight</div>
        <h3>
          Meet <span className="v">SHM AutoVAPT</span> — our in-house automated scanner
        </h3>
        <p>
          Built by SHM Technologies, AutoVAPT chains reconnaissance, enumeration, and vulnerability checks into a
          single automated workflow — then generates a clean, OWASP-mapped report. You'll see it demonstrated live,
          then drive it yourself against a real lab target.
        </p>
        <div className="feat">
          {autovaptFeatures.map((f) => (
            <div key={f.title}>
              <h5>{f.title}</h5>
              <p>{f.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

export function Ctf() {
  return (
    <section>
      <div className="ctf">
        <div className="top">
          <div className="eyebrow">The Finale</div>
          <h3>Capture The Flag Competition</h3>
          <p>
            Two hours, four categories, one live scoreboard. Put every tool from the workshop to work and race for
            the top spot.
          </p>
        </div>
        <div className="cats">
          {ctfCategories.map((c) => (
            <div key={c.code}>
              <div className="ico">[ {c.code} ]</div>
              <h4>{c.title}</h4>
              <p>{c.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

export function Outcomes() {
  return (
    <section aria-labelledby="outcomes-title">
      <div className="eyebrow">What You Walk Away With</div>
      <h2 className="sec" id="outcomes-title">Outcomes</h2>
      <div className="outs">
        {outcomes.map((o, i) => (
          <div className="out" key={o.title}>
            <span className="k">{String(i + 1).padStart(2, '0')}</span>
            <p>
              <b>{o.title}</b>
              {o.desc}
            </p>
          </div>
        ))}
      </div>
    </section>
  )
}

export function Footer() {
  return (
    <footer className="foot" id="register">
      <img className="logo" src={logo} alt="SHM Technologies logo" width={70} height={70} />
      <div className="cta">
        Ready to go <span className="g">hands-on</span>?
      </div>
      <AuthButtons centered />
      <div className="seats">
        <span
          className="dot"
          style={{ background: 'var(--green)', display: 'inline-block', width: 8, height: 8, borderRadius: '50%' }}
        />{' '}
        Limited lab seats — register early
      </div>
      <div className="org">SHM Technologies LLP · Cybersecurity &amp; VAPT Training</div>
      <div className="motto">Innovating the Future</div>
      <div className="reg">
        <span>
          Contact: <b>{contactEmail}</b>
        </span>
      </div>
    </footer>
  )
}
