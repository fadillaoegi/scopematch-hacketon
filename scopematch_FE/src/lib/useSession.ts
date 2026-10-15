import { useEffect, useState } from 'react'
import { api, ApiError, type Role, type Session } from '../api/client'

export function useSession(token: string, role: Role) {
  const [session, setSession] = useState<Session | null>(null)
  const [invalid, setInvalid] = useState(false)
  const [error, setError] = useState('')
  useEffect(() => {
    let live = true
    let loading = false
    setSession(null)
    setInvalid(false)
    setError('')
    async function load() {
      if (loading || document.hidden) return
      loading = true
      try {
        const next = await api.session(token)
        if (!live) return
        if (next.role !== role) { setInvalid(true); return }
        setSession(next)
        setError('')
      } catch (e) {
        if (!live) return
        if (e instanceof ApiError && e.status === 401) setInvalid(true)
        else setError("Couldn't reach the server. Retrying…")
      } finally { loading = false }
    }
    void load()
    const timer = window.setInterval(() => void load(), 4000)
    const visible = () => { if (!document.hidden) void load() }
    document.addEventListener('visibilitychange', visible)
    return () => {
      live = false
      window.clearInterval(timer)
      document.removeEventListener('visibilitychange', visible)
    }
  }, [token, role])
  return { session, setSession, invalid, error }
}
