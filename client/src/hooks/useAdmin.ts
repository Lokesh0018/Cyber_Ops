import { useCallback, useEffect, useState } from 'react'

export interface AdminSession { token: string; admin: { email: string } }

const KEY = 'cyberops.admin'
const EVENT = 'cyberops:admin'

function read(): AdminSession | null {
  try {
    const raw = localStorage.getItem(KEY)
    return raw ? (JSON.parse(raw) as AdminSession) : null
  } catch {
    return null
  }
}

/** Organiser session (separate from the student session) plus a fetch helper that sends the bearer token. */
export function useAdmin() {
  const [session, setSession] = useState<AdminSession | null>(read)

  useEffect(() => {
    const sync = () => setSession(read())
    window.addEventListener(EVENT, sync)
    window.addEventListener('storage', sync)
    return () => {
      window.removeEventListener(EVENT, sync)
      window.removeEventListener('storage', sync)
    }
  }, [])

  const signIn = useCallback((s: AdminSession) => {
    localStorage.setItem(KEY, JSON.stringify(s))
    window.dispatchEvent(new Event(EVENT))
  }, [])
  const signOut = useCallback(() => {
    localStorage.removeItem(KEY)
    window.dispatchEvent(new Event(EVENT))
  }, [])

  /** JSON request against /api/admin; throws an Error (with .errors for 422/409) on failure, signs out on 401. */
  const api = useCallback(
    async <T,>(path: string, init: { method?: string; body?: unknown } = {}): Promise<T> => {
      const r = await fetch(`/api/admin${path}`, {
        method: init.method ?? 'GET',
        headers: { 'Content-Type': 'application/json', ...(session ? { Authorization: `Bearer ${session.token}` } : {}) },
        body: init.body === undefined ? undefined : JSON.stringify(init.body),
      })
      const data = (await r.json().catch(() => ({}))) as { message?: string; errors?: Record<string, string> } & T
      if (r.status === 401) {
        signOut()
        throw new ApiError('Admin session expired. Sign in again.')
      }
      if (!r.ok) throw new ApiError(data.message ?? 'Request failed.', data.errors)
      return data
    },
    [session, signOut],
  )

  return { session, signIn, signOut, api }
}

export class ApiError extends Error {
  errors: Record<string, string>
  constructor(message: string, errors: Record<string, string> = {}) {
    super(message)
    this.errors = errors
  }
}
