import logo from '../assets/shm-logo.webp'
import { outcomes } from '../data/content'
import { ArrowRightIcon, RadarIcon, ShieldIcon, TerminalIcon, TrophyIcon } from './Icons'
import { SectionHeader } from './SectionHeader'

// Each outcome points at the part of the page that delivers it, so every claim has its proof one click away.
// `when` says where in the two days the outcome is earned.
const proof = [
  { Icon: ShieldIcon, href: '#schedule', label: 'Day 1 sessions', when: 'Day 1' },
  { Icon: TerminalIcon, href: '#arsenal', label: 'The arsenal', when: 'Day 1 – 2' },
  { Icon: RadarIcon, href: '#autovapt', label: 'Day 2 spotlight', when: 'Day 2' },
  { Icon: TrophyIcon, href: '#ctf', label: 'The finale', when: 'Day 2 finale' },
]

/** Template preview of the completion certificate — a placeholder name, decorative only. */
function CertificatePreview() {
  return (
    <figure className="cert">
      <div className="cert-card" aria-hidden="true">
        <span className="cert-corner tl" /><span className="cert-corner br" />
        <img src={logo} alt="" width={44} height={44} />
        <span className="cert-kicker">Certificate of Completion</span>
        <span className="cert-sub">This certifies that</span>
        <strong className="cert-name">Your Name</strong>
        <span className="cert-sub">has completed the</span>
        <span className="cert-course">CyberOps Bootcamp</span>
        <span className="cert-meta">2-day hands-on offensive &amp; defensive security workshop</span>
        <span className="cert-foot">SHM Technologies LLP</span>
      </div>
      <figcaption>Every participant earns a certificate of completion.</figcaption>
    </figure>
  )
}

export function Outcomes() {
  return (
    <section className="band outcomes-band" id="outcomes" aria-labelledby="outcomes-title">
      {/* fixed Kali dragon, clipped to this section (same technique as the hero) */}
      <div className="kali-zone-bg" aria-hidden="true">
        <div className="kali-watermark" />
      </div>
      <div className="wrap outcomes">
        <div className="outcomes-intro">
          <SectionHeader
            id="outcomes-title"
            eyebrow="What You Walk Away With"
            title={<>Real skills, <span className="g">real outcomes</span></>}
            lead="Everything you practise across the two days adds up to four concrete takeaways — each one backed by a part of the programme."
          />
          <CertificatePreview />
        </div>

        <ol className="outs">
          {outcomes.map((o, i) => {
            const { Icon, href, label, when } = proof[i]
            // The whole card is the link (big touch target); the footer names where it goes.
            return (
              <li key={o.title}>
                <a className="out" href={href}>
                  <span className="out-top">
                    <span className="out-ico"><Icon /></span>
                    <span className="out-when">{when}</span>
                  </span>
                  <span className="k">{String(i + 1).padStart(2, '0')}</span>
                  <h3>{o.title}</h3>
                  <p>{o.desc}</p>
                  <span className="out-link">
                    {label} <ArrowRightIcon />
                  </span>
                </a>
              </li>
            )
          })}
        </ol>
      </div>
    </section>
  )
}
