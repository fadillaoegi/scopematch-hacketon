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

export function useLibrary(): Map<string, Card> | null {
  const [lib, setLib] = useState<Map<string, Card> | null>(null)
  useEffect(() => {
    let live = true
    loadLibrary().then((cards) => live && setLib(new Map(cards.map((c) => [c.id, c]))))
    return () => {
      live = false
    }
  }, [])
  return lib
}
