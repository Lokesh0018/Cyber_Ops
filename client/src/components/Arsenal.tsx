import { useEffect, useId, useRef, useState, type CSSProperties } from 'react'
import { arsenal, autovaptFeatures, kaliStats, schedule, type ToolGroup } from '../data/content'
import {
  ArrowRightIcon,
  BugIcon,
  CheckIcon,
  ChevronsUpIcon,
  CloseIcon,
  FingerprintIcon,
  GlobeIcon,
  KeyIcon,
  NetworkIcon,
  PlusIcon,
  RadarIcon,
  SearchIcon,
  WifiIcon,
} from './Icons'
import { SectionHeader } from './SectionHeader'

const categoryIcons: Record<string, typeof SearchIcon> = {
  'OSINT & Recon': SearchIcon,
  'Web Exploitation': GlobeIcon,
  'Network & Scanning': NetworkIcon,
  'Exploitation & C2': BugIcon,
  'Password Cracking': KeyIcon,
  'Wireless Attacks': WifiIcon,
  'Privilege Escalation': ChevronsUpIcon,
  'Forensics & Stego': FingerprintIcon,
}

type Filter = Exclude<ToolGroup, 'inhouse'> | 'all'

const filters: { id: Filter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'recon', label: 'Recon & Network' },
  { id: 'offensive', label: 'Offensive' },
  { id: 'forensics', label: 'Forensics' },
]

// The in-house tool gets its own featured card; the grid holds the eight Kali categories.
const categories = arsenal.filter((c) => !c.inHouse)
const inHouse = arsenal.find((c) => c.inHouse)
const totalTools = categories.reduce((n, c) => n + c.tools.length, 0)

// Tools named in a schedule session are the ones used hands-on in the live labs.
// Matched by prefix so "Burp Suite" in the schedule marks "Burp Suite Pro" here.
const labTools = schedule.flatMap((d) => d.phases.flatMap((p) => p.sessions.flatMap((s) => s.tools ?? [])))
const usedInLab = (tool: string) => labTools.some((t) => tool === t || tool.startsWith(`${t} `))

// Every card shows the same number of tools by default so the grid reads evenly; lab tools lead.
const PREVIEW = 6
const ordered = (tools: string[]) => [...tools.filter(usedInLab), ...tools.filter((t) => !usedInLab(t))]

/** Adds `.in` once the grid scrolls into view, triggering the one-time staggered reveal. */
function useReveal() {
  const ref = useRef<HTMLDivElement>(null)
  const [shown, setShown] = useState(false)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const io = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) {
          setShown(true)
          io.disconnect()
        }
      },
      { threshold: 0.15 },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [])
  return { ref, shown }
}

export function Arsenal() {
  const [filter, setFilter] = useState<Filter>('all')
  const [query, setQuery] = useState('')
  const [labOnly, setLabOnly] = useState(false)
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const toggle = (title: string) =>
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(title)) next.delete(title)
      else next.add(title)
      return next
    })
  const reveal = useReveal()
  const searchId = useId()

  const q = query.trim().toLowerCase()
  const toolHit = (tool: string) => (!q || tool.toLowerCase().includes(q)) && (!labOnly || usedInLab(tool))
  const results = categories.map((cat) => {
    const inGroup = filter === 'all' || cat.group === filter
    const titleHit = !!q && cat.title.toLowerCase().includes(q)
    const hits = cat.tools.filter((t) => toolHit(t) || (titleHit && (!labOnly || usedInLab(t))))
    return { cat, match: inGroup && hits.length > 0, hits: new Set(hits) }
  })
  const matched = results.filter((r) => r.match)
  const matchedTools = matched.reduce((n, r) => n + r.hits.size, 0)
  const narrowed = filter !== 'all' || !!q || labOnly
  const reset = () => {
    setFilter('all')
    setQuery('')
    setLabOnly(false)
  }

  return (
    <section className="band band-alt" id="arsenal" aria-labelledby="arsenal-title">
      <div className="wrap">
        <SectionHeader
          id="arsenal-title"
          eyebrow="The Arsenal"
          title={<>A full red-team &amp; <span className="g">blue-team</span> toolkit</>}
          lead="Every session is hands-on. You'll operate the same offensive and defensive tools used by professional penetration testers, red teams, and SOC analysts — all running on Kali Linux, in a safe, controlled lab."
        />

        <div className="kali">
          <div className="kl">
            <span className="kali-mark" aria-hidden="true" />
            <span>
              <strong>Powered by <b>Kali Linux</b></strong>
              <small>The industry-standard penetration testing OS</small>
            </span>
          </div>
          <dl className="kstats">
            {kaliStats.map((s) => (
              <div className="kstat" key={s.label}>
                <dt className="lbl">{s.label}</dt>
                <dd className={s.violet ? 'num v' : 'num'}>{s.num}</dd>
              </div>
            ))}
          </dl>
        </div>

        <div className="ars-toolbar">
          <div className="ars-search">
            <label htmlFor={searchId} className="sr-only">Search tools</label>
            <SearchIcon />
            <input
              id={searchId}
              type="search"
              placeholder={`Search ${totalTools} tools — e.g. nmap, burp`}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Escape' && setQuery('')}
              autoComplete="off"
              spellCheck={false}
            />
            {query && (
              <button type="button" className="ars-clear" onClick={() => setQuery('')} aria-label="Clear search">
                <CloseIcon />
              </button>
            )}
          </div>

          <div className="ars-filters" role="group" aria-label="Filter by category type">
            {filters.map((f) => (
              <button
                key={f.id}
                type="button"
                className="ars-filter"
                aria-pressed={filter === f.id}
                onClick={() => setFilter(f.id)}
              >
                {f.label}
              </button>
            ))}
          </div>

          <button type="button" className="ars-lab" aria-pressed={labOnly} onClick={() => setLabOnly((v) => !v)}>
            <span className="switch" aria-hidden="true" />
            <span className="lab-dot" aria-hidden="true" /> Lab tools only
          </button>
        </div>

        <p className="ars-status" aria-live="polite">
          {narrowed ? (
            <>
              Showing <b>{matchedTools}</b> of {totalTools} tools in <b>{matched.length}</b>{' '}
              {matched.length === 1 ? 'category' : 'categories'}
              {matched.length > 0 && (
                <button type="button" className="ars-reset" onClick={reset}>Reset</button>
              )}
            </>
          ) : (
            <>
              <span className="lab-dot" aria-hidden="true" /> marks tools used hands-on in the live lab sessions
            </>
          )}
        </p>

        {matched.length === 0 ? (
          <div className="ars-empty">
            <SearchIcon />
            <p>No tools match <b>“{query || 'these filters'}”</b>. It may still come up live — dozens more are introduced in sessions.</p>
            <button type="button" className="btn btn-ghost" onClick={reset}>Clear filters</button>
          </div>
        ) : (
          <div className={reveal.shown ? 'arsenal in' : 'arsenal'} ref={reveal.ref}>
            {results.map(({ cat, match, hits }, i) => {
              const Icon = categoryIcons[cat.title] ?? SearchIcon
              // While searching/filtering, show every tool so no match is hidden behind "+N more".
              const open = narrowed || expanded.has(cat.title)
              const tools = ordered(cat.tools)
              const shown = open ? tools : tools.slice(0, PREVIEW)
              const extra = tools.length - PREVIEW
              const listId = `tools-${i}`
              return (
                <article
                  className={match ? 'acard' : 'acard dim'}
                  key={cat.title}
                  style={{ '--cat': `var(--${cat.accent})`, '--i': i } as CSSProperties}
                  aria-hidden={!match || undefined}
                >
                  <header className="acard-head">
                    <span className="acard-ico"><Icon /></span>
                    <span className="n">{cat.tools.length} tools</span>
                    <h3>{cat.title}</h3>
                  </header>
                  <ul className="tags" id={listId}>
                    {shown.map((tool) => {
                      const lab = usedInLab(tool)
                      const cls = ['tag', lab && 'lab', narrowed && match && (hits.has(tool) ? 'hit' : 'miss')]
                      return (
                        <li className={cls.filter(Boolean).join(' ')} key={tool}>
                          {lab && <span className="lab-dot" aria-hidden="true" />}
                          {tool}
                          {lab && <span className="sr-only"> (used in live labs)</span>}
                        </li>
                      )
                    })}
                  </ul>
                  {!narrowed && extra > 0 && (
                    <button
                      type="button"
                      className="acard-more"
                      aria-expanded={open}
                      aria-controls={listId}
                      onClick={() => toggle(cat.title)}
                    >
                      {open ? 'Show less' : `+${extra} more`}
                    </button>
                  )}
                </article>
              )
            })}
          </div>
        )}

        {inHouse && (
          <article className="featured">
            <div className="featured-main">
              <span className="featured-ico"><RadarIcon /></span>
              <div>
                <div className="featured-top">
                  <h3>{inHouse.title}</h3>
                  <span className="badge-inhouse">In-house</span>
                </div>
                <p>
                  SHM's own automated engine — recon, enumeration and vulnerability checks chained into one workflow,
                  ending in an OWASP-mapped report. Demoed live, then yours to drive on Day 2.
                </p>
                <a className="acard-link" href="#autovapt">
                  See it on Day 2 <ArrowRightIcon />
                </a>
              </div>
            </div>
            <ul className="featured-list">
              {autovaptFeatures.map((f) => (
                <li key={f.title}>
                  <CheckIcon /> {f.title}
                </li>
              ))}
            </ul>
          </article>
        )}

        <p className="morenote">
          <PlusIcon />
          <span>
            <b>Dozens more</b> from the Kali repository — fuzzers, proxies, payload crafters, DNS &amp; SSL tooling,
            and custom scripts introduced live.
          </span>
        </p>
      </div>
    </section>
  )
}
