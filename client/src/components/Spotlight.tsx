import { Fragment } from 'react'
import { autovaptFeatures } from '../data/content'
import { ArrowRightIcon, FileIcon, GlobeIcon, RadarIcon, ServerIcon } from './Icons'

const featureIcons = [RadarIcon, GlobeIcon, ServerIcon, FileIcon]
const pipeline = ['Recon', 'Enumerate', 'Vuln checks', 'OWASP report']

export function Spotlight() {
  return (
    <section className="band spot-band" id="autovapt" aria-labelledby="autovapt-title">
      <div className="wrap spot">
        <div className="spot-copy">
          <div className="eyebrow">Day 2 Spotlight</div>
          <h2 id="autovapt-title">
            Meet <span className="v">SHM AutoVAPT</span> — our in-house automated scanner
          </h2>
          <p>
            Built by SHM Technologies, AutoVAPT chains reconnaissance, enumeration, and vulnerability checks into a
            single automated workflow — then generates a clean, OWASP-mapped report. You'll see it demonstrated live,
            then drive it yourself against a real lab target.
          </p>
          <div className="pipeline" aria-label="AutoVAPT workflow">
            {pipeline.map((step, i) => (
              <Fragment key={step}>
                {i > 0 && <ArrowRightIcon />}
                <span>{step}</span>
              </Fragment>
            ))}
          </div>
        </div>

        <div className="feat">
          {autovaptFeatures.map((f, i) => {
            const Icon = featureIcons[i]
            return (
              <article className="fcard" key={f.title}>
                <div className="ficon"><Icon /></div>
                <h3>{f.title}</h3>
                <p>{f.desc}</p>
              </article>
            )
          })}
        </div>
      </div>
    </section>
  )
}
