import { outcomes } from '../data/content'
import { SectionHeader } from './SectionHeader'

export function Outcomes() {
  return (
    <section className="band" id="outcomes" aria-labelledby="outcomes-title">
      <div className="wrap">
        <SectionHeader
          id="outcomes-title"
          eyebrow="What You Walk Away With"
          title={<>Real skills, <span className="g">real outcomes</span></>}
        />
        <div className="outs">
          {outcomes.map((o, i) => (
            <article className="out" key={o.title}>
              <span className="k">{String(i + 1).padStart(2, '0')}</span>
              <h3>{o.title}</h3>
              <p>{o.desc}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  )
}
