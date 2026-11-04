import { useEffect, useState } from 'react'
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

export function Navbar() {
  const [open, setOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)
  const active = useActiveSection(ids)

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

        <ul className="nav-links">{links}</ul>

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
