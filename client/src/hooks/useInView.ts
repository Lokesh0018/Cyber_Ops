import { useEffect, useRef, useState } from 'react'

/**
 * Tracks whether an element is on screen. Turns on once at least `threshold` of it is visible
 * and only turns off after it has fully left the viewport — so toggling a CSS class off this
 * replays an animation on every scroll-in without restarting on small scroll jitters.
 */
export function useInView<T extends HTMLElement>(threshold = 0.35) {
  const ref = useRef<T>(null)
  const [inView, setInView] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const io = new IntersectionObserver(
      ([e]) => {
        if (e.intersectionRatio >= threshold) setInView(true)
        else if (!e.isIntersecting) setInView(false)
      },
      { threshold: [0, threshold] },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [threshold])

  return { ref, inView }
}
