import { useEffect, useState } from 'react'
import { useProjectGateway } from './gateway'
import type { ProjectGateway } from '../application/projectGateway'
import type { Card } from '../domain/models'

// The card library never changes while the app runs; fetch it once.
const cache = new WeakMap<ProjectGateway, Promise<Card[]>>()

export function loadLibrary(api: ProjectGateway): Promise<Card[]> {
  let cached = cache.get(api)
  if (!cached) {
    cached = api.library().then(r => r.cards).catch(e => { cache.delete(api); throw e })
    cache.set(api, cached)
  }
  return cached
}

export function useLibrary() {
  const api = useProjectGateway()
  const [library, setLibrary] = useState<Map<string, Card> | null>(null)
  const [error, setError] = useState('')
  useEffect(() => {
    let live = true
    let timer: number | undefined
    async function load() {
      try {
        const cards = await loadLibrary(api)
        if (live) { setLibrary(new Map(cards.map(c => [c.id, c]))); setError('') }
      } catch {
        if (live) { setError("Couldn't load the questions. Retrying…"); timer = window.setTimeout(() => void load(), 4000) }
      }
    }
    void load()
    return () => { live = false; window.clearTimeout(timer) }
  }, [api])
  return { library, error }
}
