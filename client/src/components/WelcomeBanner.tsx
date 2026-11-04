import { useEffect, useState } from 'react'
import { useAuth } from '../hooks/useAuth'
import { CheckIcon, CloseIcon } from './Icons'

/** One-time banner after /login or /register hands off with ?welcome=new|back. */
export function WelcomeBanner() {
  const { student } = useAuth()
  const [kind, setKind] = useState<'new' | 'back' | null>(() => {
    const w = new URLSearchParams(window.location.search).get('welcome')
    return w === 'new' || w === 'back' ? w : null
  })

  // Drop the query param so a refresh doesn't show the banner again.
  useEffect(() => {
    if (kind) history.replaceState(null, '', window.location.pathname + window.location.hash)
  }, [kind])

  if (!kind || !student) return null
  const first = student.fullName.split(' ')[0]
  return (
    <div className="welcome" role="status">
      <CheckIcon />
      <p>
        {kind === 'new'
          ? <>Seat request logged, <b>{first}</b> — joining details will go to <b>{student.email}</b>.</>
          : <>Welcome back, <b>{first}</b>.</>}
      </p>
      <button type="button" onClick={() => setKind(null)} aria-label="Dismiss"><CloseIcon /></button>
    </div>
  )
}
