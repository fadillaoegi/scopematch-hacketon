import type { Match } from '../domain/models'
import styles from './BriefPanel.module.css'

interface Props {
  brief: string
  /** Matched phrases with the clause number of the card they belong to. */
  marks: { match: Match; number: number }[]
  activeCardId: string | null
  onActivate: (cardId: string | null) => void
}

// The brief as received, with each matched phrase marked and footnoted to its
// card. The active card's phrase gets a highlighter stroke.
export function BriefPanel({ brief, marks, activeCardId, onActivate }: Props) {
  const sorted = [...marks].sort((a, b) => a.match.start - b.match.start)
  const parts: React.ReactNode[] = []
  let at = 0
  for (const { match, number } of sorted) {
    if (match.start < at) continue // never overlap; server guarantees this anyway
    parts.push(brief.slice(at, match.start))
    const active = activeCardId === match.cardId
    parts.push(
      <mark
        key={match.cardId}
        className={`${styles.mark} ${active ? styles.active : ''}`}
        onMouseEnter={() => onActivate(match.cardId)}
        onMouseLeave={() => onActivate(null)}
      >
        {brief.slice(match.start, match.end)}
        <sup className={styles.ref}>§{number}</sup>
      </mark>,
    )
    at = match.end
  }
  parts.push(brief.slice(at))

  return (
    <section className={styles.panel} aria-labelledby="brief-heading">
      <p className="meta" id="brief-heading">
        The brief — as received
      </p>
      <blockquote className={styles.brief}>
        <span className={styles.quote} aria-hidden>
          “
        </span>
        {parts}
      </blockquote>
      {marks.length > 0 && (
        <p className={styles.legend}>
          <span className={styles.legendMark}>Marked words</span> are where each question came from.
        </p>
      )}
    </section>
  )
}
