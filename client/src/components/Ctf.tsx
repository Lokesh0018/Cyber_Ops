import { ctfCategories } from '../data/content'
import { ClockIcon, GlobeIcon, ImageIcon, NetworkIcon, PeaksIcon, SearchIcon, TrophyIcon } from './Icons'
import { SectionHeader } from './SectionHeader'

const catIcons = { WEB: GlobeIcon, NET: NetworkIcon, OSINT: SearchIcon, STEG: ImageIcon } as const

export function Ctf() {
  return (
    <section className="band band-alt ctf-band" id="ctf" aria-labelledby="ctf-title">
      <div className="wrap">
        <SectionHeader
          id="ctf-title"
          eyebrow="The Finale"
          center
          title={<>Capture The <span className="g">Flag</span> Competition</>}
          lead="Two hours, four categories, one live scoreboard. Put every tool from the workshop to work and race for the top spot."
        />

        <div className="ctf-meta">
          <span className="chip"><ClockIcon /> 2 hours</span>
          <span className="chip"><PeaksIcon /> Live individual scoreboard</span>
          <span className="chip"><TrophyIcon /> Awards &amp; certificates</span>
        </div>

        <div className="cats">
          {ctfCategories.map((c) => {
            const Icon = catIcons[c.code as keyof typeof catIcons]
            return (
              <article className="cat" key={c.code}>
                <div className="cicon"><Icon /></div>
                <div className="code">[ {c.code} ]</div>
                <h3>{c.title}</h3>
                <p>{c.desc}</p>
              </article>
            )
          })}
        </div>
      </div>
    </section>
  )
}
