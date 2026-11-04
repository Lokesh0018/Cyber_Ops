import type { ReactNode } from 'react'

interface Props {
  id: string
  eyebrow: string
  title: ReactNode
  lead?: ReactNode
  center?: boolean
}

export function SectionHeader({ id, eyebrow, title, lead, center }: Props) {
  return (
    <div className={center ? 'shead center' : 'shead'}>
      <div className="eyebrow">{eyebrow}</div>
      <h2 id={id}>{title}</h2>
      {lead && <p>{lead}</p>}
    </div>
  )
}
