import logo from '../assets/shm-logo.webp'
import { ClockIcon, ListIcon, PeaksIcon, ShieldIcon } from './Icons'

export function AuthButtons({ centered = false }: { centered?: boolean }) {
  return (
    <div className="btngroup" style={centered ? { justifyContent: 'center', margin: '16px 0 6px' } : undefined}>
      {centered ? (
        <>
          <a className="btn btn-primary" href="#">Register Now</a>
          <a className="btn btn-ghost" href="#">Login</a>
        </>
      ) : (
        <>
          <a className="btn btn-ghost" href="#">Login</a>
          <a className="btn btn-primary" href="#register">Register Now</a>
        </>
      )}
    </div>
  )
}

const chips = [
  { Icon: ShieldIcon, label: 'Beginner → Advanced' },
  { Icon: ClockIcon, label: '2 Days · 16+ hours' },
  { Icon: ListIcon, label: '100+ Kali Linux Tools' },
  { Icon: PeaksIcon, label: 'Live CTF Competition' },
]

export function Hero() {
  return (
    <header className="hero">
      <div className="logobar">
        <img className="logo" src={logo} alt="SHM Technologies logo" width={84} height={84} />
        <AuthButtons />
      </div>
      <div className="brandrow">
        <span className="dot" /> SHM Technologies LLP
        <span className="sep">//</span>
        <span className="host">Hands-on Offensive &amp; Defensive Security</span>
      </div>

      <div className="kicker">2-Day Immersive Workshop</div>
      <h1 className="title">
        CYBER<span className="g">OPS</span>
        <br />
        BOOTCAMP
      </h1>
      <p className="tagline">
        From <b>reconnaissance</b> to <b>exploitation</b> to <b>capture-the-flag</b> — two intensive days of real
        industry tooling, live demos, and a competitive CTF finale. Day 2 unveils <b>SHM's own automated security
        scanner</b>.
      </p>

      <div className="metastrip">
        {chips.map(({ Icon, label }) => (
          <span className="chip" key={label}>
            <Icon /> {label}
          </span>
        ))}
      </div>
    </header>
  )
}
