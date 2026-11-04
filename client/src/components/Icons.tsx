import type { ReactNode, SVGProps } from 'react'

type IconProps = SVGProps<SVGSVGElement>

// Lucide-style 24×24 stroke icons; `.ico` sets stroke + size in CSS.
const icon = (paths: ReactNode) => (p: IconProps) => (
  <svg viewBox="0 0 24 24" aria-hidden="true" className="ico" {...p}>{paths}</svg>
)

export const ShieldIcon = icon(<path d="M12 2l8 4v6c0 5-3.5 8-8 10-4.5-2-8-5-8-10V6z" />)
export const ClockIcon = icon(<><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>)
export const ListIcon = icon(<path d="M4 7h16M4 12h16M4 17h10" />)
export const PeaksIcon = icon(<path d="M5 20l4-9 3 4 3-7 4 12" />)
export const TerminalIcon = icon(<><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M7 9l3 3-3 3M13 15h4" /></>)
export const CoffeeIcon = icon(<path d="M17 8h1a4 4 0 010 8h-1M3 8h14v9a4 4 0 01-4 4H7a4 4 0 01-4-4zM6 2v3M10 2v3M14 2v3" />)
export const UtensilsIcon = icon(<path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 002-2V2M7 2v20M21 15V2a5 5 0 00-5 5v6c0 1.1.9 2 2 2h3zm0 0v7" />)
export const TrophyIcon = icon(<path d="M6 9H4.5a2.5 2.5 0 010-5H6M18 9h1.5a2.5 2.5 0 000-5H18M4 22h16M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22M18 2H6v7a6 6 0 0012 0V2z" />)
export const MenuIcon = icon(<path d="M4 6h16M4 12h16M4 18h16" />)
export const CloseIcon = icon(<path d="M18 6L6 18M6 6l12 12" />)
export const ArrowRightIcon = icon(<path d="M5 12h14M13 6l6 6-6 6" />)
export const CalendarIcon = icon(<><rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" /></>)
export const CheckIcon = icon(<><circle cx="12" cy="12" r="9" /><path d="M8.5 12l2.5 2.5 4.5-5" /></>)
export const MailIcon = icon(<><rect x="2" y="4" width="20" height="16" rx="2" /><path d="M22 7l-10 6L2 7" /></>)
export const GlobeIcon = icon(<><circle cx="12" cy="12" r="10" /><path d="M2 12h20M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z" /></>)
export const NetworkIcon = icon(<><rect x="9" y="2" width="6" height="6" rx="1" /><rect x="2" y="16" width="6" height="6" rx="1" /><rect x="16" y="16" width="6" height="6" rx="1" /><path d="M5 16v-3h14v3M12 8v5" /></>)
export const SearchIcon = icon(<><circle cx="11" cy="11" r="7" /><path d="M21 21l-4.3-4.3" /></>)
export const ImageIcon = icon(<><rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="9" cy="9" r="2" /><path d="M21 15l-3.1-3.1a2 2 0 00-2.8 0L6 21" /></>)
export const RadarIcon = icon(<><path d="M19.07 4.93A10 10 0 1022 12" /><path d="M16.24 7.76A6 6 0 1018 12" /><circle cx="12" cy="12" r="2" /><path d="M12 12l7-7" /></>)
export const BugIcon = icon(<><rect x="8" y="6" width="8" height="14" rx="4" /><path d="M19 7l-3 2M5 7l3 2M19 19l-3-2M5 19l3-2M20 13h-4M4 13h4M10 4l1 2M14 4l-1 2" /></>)
export const ServerIcon = icon(<><rect x="2" y="3" width="20" height="8" rx="2" /><rect x="2" y="13" width="20" height="8" rx="2" /><path d="M6 7h.01M6 17h.01" /></>)
export const FileIcon = icon(<><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" /><path d="M14 2v6h6M8 13h8M8 17h5" /></>)
