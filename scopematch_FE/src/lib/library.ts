import { useEffect, useState } from 'react'
import { api, type Card } from '../api/client'

// The card library never changes while the app runs; fetch it once.
let cached: Promise<Card[]> | null = null

export function loadLibrary(): Promise<Card[]> {
  cached ??= api.library().then((r) => r.cards).catch((e) => {
    cached = null
    throw e
  })
  return cached
}

export function useLibrary() {
  const [library, setLibrary] = useState<Map<string, Card> | null>(null)
  const [error, setError] = useState('')
  useEffect(() => {
    let live = true
    let timer: number | undefined
    async function load() {
      try {
        const cards = await loadLibrary()
        if (live) { setLibrary(new Map(cards.map(c => [c.id, c]))); setError('') }
      } catch {
        if (live) { setError("Couldn't load the questions. Retrying…"); timer = window.setTimeout(() => void load(), 4000) }
      }
    }
    void load()
    return () => { live = false; window.clearTimeout(timer) }
  }, [])
  return { library, error }
}
