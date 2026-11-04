import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from 'react'
import logo from '../assets/shm-logo.webp'
import { navLinks } from '../data/content'
import { CloseIcon, MenuIcon } from './Icons'

/**
 * Returns the nav section under a reference line 40% down the viewport, or null when that line
 * is over anything else (the hero, the register CTA). Recomputed on every scroll, so the
 * highlight also clears when scrolling back up into the hero.
 */
function useActiveSection(ids: string[]) {
  const [active, setActive] = useState<string | null>(null)

  useEffect(() => {
    let frame = 0
    const update = () => {
      frame = 0
      const line = window.innerHeight * 0.4
      const hit = ids.find((id) => {
        const r = document.getElementById(id)?.getBoundingClientRect()
        return !!r && r.top <= line && r.bottom > line
      })
      setActive(hit ?? null)
    }
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update)
    }
    update()
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onScroll)
    return () => {
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onScroll)
      cancelAnimationFrame(frame)
    }
  }, [ids])

  return active
}

const ids = navLinks.map((l) => l.id)

interface Indicator {
  x: number
  w: number
  show: boolean
  /** Skip the slide when appearing from nothing, so it fades in place rather than sweeping in from 0. */
  instant: boolean
}

/** Positions a single highlight under the active desktop link; it slides between links on change. */
function useIndicator(active: string | null) {
  const wrapRef = useRef<HTMLDivElement>(null)
  const [ind, setInd] = useState<Indicator>({ x: 0, w: 0, show: false, instant: true })

  useLayoutEffect(() => {
    const measure = (fromResize = false) => {
      const wrap = wrapRef.current
      const link = active ? wrap?.querySelector<HTMLElement>(`a[href="#${active}"]`) : null
      if (!wrap || !link) {
        setInd((prev) => ({ ...prev, show: false }))
        return
      }
      const w = wrap.getBoundingClientRect()
      const r = link.getBoundingClientRect()
      setInd((prev) => ({ x: r.left - w.left, w: r.width, show: true, instant: fromResize || !prev.show }))
    }
    measure()
    const onResize = () => measure(true)
    window.addEventListener('resize', onResize)
    document.fonts?.ready.then(() => measure(true))
    return () => window.removeEventListener('resize', onResize)
  }, [active])

  const style = { '--x': `${ind.x}px`, '--w': `${ind.w}px` } as CSSProperties
  const className = ['nav-indicator', ind.show && 'show', ind.instant && 'instant'].filter(Boolean).join(' ')
  return { wrapRef, style, className }
}

export function Navbar() {
  const [open, setOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)
  const active = useActiveSection(ids)
  const indicator = useIndicator(active)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  const close = () => setOpen(false)
  const links = navLinks.map((l) => (
    <li key={l.id}>
      <a href={`#${l.id}`} aria-current={active === l.id ? 'true' : undefined} onClick={close}>
        {l.label}
      </a>
    </li>
  ))

  return (
    <header className={scrolled ? 'nav scrolled' : 'nav'}>
      <nav className="nav-inner" aria-label="Primary">
        <a className="nav-brand" href="#top" onClick={close}>
          <img src={logo} alt="" width={42} height={42} />
          <span>
            Cyber<b>Ops</b>
            <small>by SHM Technologies</small>
          </span>
        </a>

        <div className="nav-links-wrap" ref={indicator.wrapRef}>
          <span className={indicator.className} style={indicator.style} aria-hidden="true" />
          <ul className="nav-links">{links}</ul>
        </div>

        <div className="nav-cta">
          <a className="btn btn-ghost" href="#">Login</a>
          <a className="btn btn-primary" href="#register">Register</a>
        </div>

        <button
          className="nav-toggle"
          type="button"
          aria-expanded={open}
          aria-controls="mobile-menu"
          aria-label={open ? 'Close menu' : 'Open menu'}
          onClick={() => setOpen((o) => !o)}
        >
          {open ? <CloseIcon /> : <MenuIcon />}
        </button>

        <div id="mobile-menu" className={open ? 'nav-menu open' : 'nav-menu'}>
          <ul>{links}</ul>
          <div className="btngroup">
            <a className="btn btn-ghost" href="#" onClick={close}>Login</a>
            <a className="btn btn-primary" href="#register" onClick={close}>Register Now</a>
          </div>
        </div>
      </nav>
    </header>
  )
}
