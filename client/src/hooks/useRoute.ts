import { useEffect, useState, type MouseEvent } from 'react'

/**
 * Minimal History-API router: `usePathname()` re-renders on navigation, `navigate()` pushes a new path,
 * and `Link` is an <a> that navigates without a full reload. Hash links and external URLs are left alone.
 */
const EVENT = 'cyberops:navigate'

export function navigate(to: string, replace = false) {
  if (replace) history.replaceState(null, '', to)
  else history.pushState(null, '', to)
  window.dispatchEvent(new Event(EVENT))
  window.scrollTo(0, 0)
}

export function usePathname() {
  const [path, setPath] = useState(() => window.location.pathname)
  useEffect(() => {
    const sync = () => setPath(window.location.pathname)
    window.addEventListener(EVENT, sync)
    window.addEventListener('popstate', sync)
    return () => {
      window.removeEventListener(EVENT, sync)
      window.removeEventListener('popstate', sync)
    }
  }, [])
  return path
}

export function onLinkClick(e: MouseEvent<HTMLAnchorElement>) {
  const href = e.currentTarget.getAttribute('href') ?? ''
  // Only intercept plain same-origin paths; let hash jumps, new tabs and modifier clicks behave normally.
  if (!href.startsWith('/') || href.startsWith('//') || e.defaultPrevented || e.button !== 0) return
  if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.currentTarget.target === '_blank') return
  e.preventDefault()
  navigate(href)
}
