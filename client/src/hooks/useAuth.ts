import { useCallback, useEffect, useState } from 'react'

export interface Student {
  id: string
  fullName: string
  email: string
  phone: string
  institution: string
  branch: string
  rollNumber: string
  score: number
  createdAt: string
}

export interface AuthSession {
  token: string
  student: Student
}

const KEY = 'cyberops.auth'
const EVENT = 'cyberops:auth'

function readSession(): AuthSession | null {
  try {
    const raw = localStorage.getItem(KEY)
    return raw ? (JSON.parse(raw) as AuthSession) : null
  } catch {
    return null
  }
}

/** Current signed-in student (persisted in localStorage) and setters; every subscriber updates together. */
export function useAuth() {
  const [session, setSession] = useState<AuthSession | null>(readSession)

  useEffect(() => {
    const sync = () => setSession(readSession())
    window.addEventListener(EVENT, sync)
    window.addEventListener('storage', sync)
    return () => {
      window.removeEventListener(EVENT, sync)
      window.removeEventListener('storage', sync)
    }
  }, [])

  const signIn = useCallback((s: AuthSession) => {
    localStorage.setItem(KEY, JSON.stringify(s))
    window.dispatchEvent(new Event(EVENT))
  }, [])

  const signOut = useCallback(() => {
    localStorage.removeItem(KEY)
    window.dispatchEvent(new Event(EVENT))
  }, [])

  return { session, student: session?.student ?? null, signIn, signOut }
}
