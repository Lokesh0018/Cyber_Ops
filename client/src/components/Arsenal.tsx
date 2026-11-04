import type { CSSProperties } from 'react'
import { arsenal, kaliStats } from '../data/content'
import { TerminalIcon } from './Icons'

export function Arsenal() {
  return (
    <section aria-labelledby="arsenal-title">
      <div className="eyebrow">The Arsenal</div>
      <h2 className="sec" id="arsenal-title">A full red-team &amp; blue-team toolkit</h2>
      <p className="sec-lead">
        Every session is hands-on. You'll operate the same offensive and defensive tools used by professional
        penetration testers, red teams, and SOC analysts — all running on Kali Linux, in a safe, controlled lab.
      </p>

      <div className="kali">
        <div className="kl">
          <TerminalIcon className="dragon" /> Powered by <b>Kali Linux</b> — the industry pentesting OS
        </div>
        <div className="kstats">
          {kaliStats.map((s) => (
            <div className="kstat" key={s.label}>
              <div className={s.violet ? 'num v' : 'num'}>{s.num}</div>
              <div className="lbl">{s.label}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="arsenal">
        {arsenal.map((cat) => (
          <div className="acard" key={cat.title} style={{ '--cat': `var(--${cat.accent})` } as CSSProperties}>
            <h3>
              {cat.title} <span className="n">{cat.count}</span>
            </h3>
            <div className="tags">
              {cat.tools.map((tool) => (
                <span
                  className="tag"
                  key={tool}
                  style={cat.inHouse ? { borderColor: 'rgba(154,123,255,.45)' } : undefined}
                >
                  <b>{tool}</b>
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>
      <p className="morenote">
        + <b>dozens more</b> from the Kali repository — fuzzers, proxies, payload crafters, DNS &amp; SSL tooling,
        and custom scripts introduced live.
      </p>
    </section>
  )
}
