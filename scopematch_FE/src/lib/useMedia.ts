import { useEffect, useState } from 'react'

// Tracks a CSS media query, for layout choices CSS alone can't make
// (such as whether a disclosure starts open).
export function useMedia(query: string) {
  const [matches, setMatches] = useState(() => typeof window !== 'undefined' && window.matchMedia(query).matches)
  useEffect(() => {
    const list = window.matchMedia(query)
    const update = () => setMatches(list.matches)
    update()
    list.addEventListener('change', update)
    return () => list.removeEventListener('change', update)
  }, [query])
  return matches
}
