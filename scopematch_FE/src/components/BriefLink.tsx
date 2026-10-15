import { useEffect, useState, type RefObject } from 'react'
import { motion } from 'motion/react'
import styles from './BriefLink.module.css'

interface Line {
  d: string
  start: { x: number; y: number }
  end: { x: number; y: number }
}

// Draws an ink line from the active brief phrase to the question it produced,
// so the freelancer can see where each question came from. Desktop layout only.
export function BriefLink({ container, activeCardId }: { container: RefObject<HTMLElement | null>; activeCardId: string | null }) {
  const [line, setLine] = useState<Line | null>(null)

  useEffect(() => {
    const root = container.current
    if (!root || !activeCardId) {
      setLine(null)
      return
    }
    let frame = 0
    const measure = () => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => {
        const mark = root.querySelector<HTMLElement>(`[data-card-mark="${activeCardId}"]`)
        const card = root.querySelector<HTMLElement>(`[data-card="${activeCardId}"]`)
        if (!mark || !card) return setLine(null)
        const box = root.getBoundingClientRect()
        const m = mark.getBoundingClientRect()
        const c = card.getBoundingClientRect()
        // Side-by-side only: when stacked, the card sits below the brief.
        if (c.left < m.right) return setLine(null)
        // Leave from the brief panel's edge at the phrase's height, so the line
        // never crosses the brief's words; the phrase itself is highlighted.
        const panel = mark.closest('section')?.getBoundingClientRect() ?? m
        const start = { x: panel.right - box.left, y: m.top - box.top + m.height * 0.55 }
        const end = { x: c.left - box.left - 6, y: c.top - box.top + 34 }
        const bend = Math.max(40, (end.x - start.x) * 0.55)
        setLine({ start, end, d: `M ${start.x} ${start.y} C ${start.x + bend} ${start.y}, ${end.x - bend} ${end.y}, ${end.x} ${end.y}` })
      })
    }
    measure()
    window.addEventListener('scroll', measure, { passive: true })
    window.addEventListener('resize', measure)
    return () => {
      cancelAnimationFrame(frame)
      window.removeEventListener('scroll', measure)
      window.removeEventListener('resize', measure)
    }
  }, [container, activeCardId])

  if (!line) return null
  return (
    <svg className={styles.overlay} aria-hidden>
      <motion.path
        key={activeCardId}
        d={line.d}
        className={styles.path}
        initial={{ pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 0.55, ease: [0.65, 0, 0.35, 1] }}
      />
      <motion.circle
        key={`${activeCardId}-end`}
        cx={line.end.x}
        cy={line.end.y}
        r={4}
        className={styles.dot}
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ delay: 0.45, type: 'spring', stiffness: 500, damping: 20 }}
      />
      <circle cx={line.start.x} cy={line.start.y} r={3} className={styles.dot} />
    </svg>
  )
}
