import type { SVGProps } from 'react'

type IconProps = SVGProps<SVGSVGElement>

const base = { viewBox: '0 0 24 24', 'aria-hidden': true } as const

export const ShieldIcon = (p: IconProps) => (
  <svg {...base} {...p}><path d="M12 2l8 4v6c0 5-3.5 8-8 10-4.5-2-8-5-8-10V6z" /></svg>
)

export const ClockIcon = (p: IconProps) => (
  <svg {...base} {...p}><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>
)

export const ListIcon = (p: IconProps) => (
  <svg {...base} {...p}><path d="M4 7h16M4 12h16M4 17h10" /></svg>
)

export const PeaksIcon = (p: IconProps) => (
  <svg {...base} {...p}><path d="M5 20l4-9 3 4 3-7 4 12" /></svg>
)

/** Terminal prompt — stands in for the Kali dragon emoji. */
export const TerminalIcon = (p: IconProps) => (
  <svg {...base} {...p}><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M7 9l3 3-3 3M13 15h4" /></svg>
)

export const CoffeeIcon = (p: IconProps) => (
  <svg {...base} {...p}><path d="M17 8h1a4 4 0 010 8h-1M3 8h14v9a4 4 0 01-4 4H7a4 4 0 01-4-4zM6 2v3M10 2v3M14 2v3" /></svg>
)

export const UtensilsIcon = (p: IconProps) => (
  <svg {...base} {...p}><path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 002-2V2M7 2v20M21 15V2a5 5 0 00-5 5v6c0 1.1.9 2 2 2h3zm0 0v7" /></svg>
)

export const TrophyIcon = (p: IconProps) => (
  <svg {...base} {...p}><path d="M6 9H4.5a2.5 2.5 0 010-5H6M18 9h1.5a2.5 2.5 0 000-5H18M4 22h16M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22M18 2H6v7a6 6 0 0012 0V2z" /></svg>
)
