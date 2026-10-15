import { LayoutGroup, motion } from 'motion/react'
import type { Card, CardRef, Match } from '../api/client'
import styles from './CardPicker.module.css'

interface Props {
  library: Map<string, Card>
  selected: CardRef[]
  /** Matches for every card, selected or not, so unselected cards still show provenance. */
  matches: Map<string, Match>
  activeCardId: string | null
  onActivate: (cardId: string | null) => void
  onToggle: (cardId: string, include: boolean) => void
  disabled?: boolean
}

const LETTERS = 'ABCDEFGH'

export function CardPicker({ library, selected, matches, activeCardId, onActivate, onToggle, disabled }: Props) {
  const selectedIds = new Set(selected.map((c) => c.id))
  const chosen = selected.map((c) => library.get(c.id)).filter((c): c is Card => !!c)
  const rest = [...library.values()].filter((c) => !selectedIds.has(c.id))

  const renderCard = (card: Card, included: boolean) => {
    const match = matches.get(card.id)
    return (
      <motion.li
        layout
        key={card.id}
        transition={{ type: 'spring', stiffness: 380, damping: 34 }}
        className={`${styles.card} ${included ? '' : styles.excluded} ${activeCardId === card.id ? styles.active : ''}`}
        onMouseEnter={() => onActivate(card.id)}
        onMouseLeave={() => onActivate(null)}
        onFocus={() => onActivate(card.id)}
        onBlur={() => onActivate(null)}
      >
        <div className={styles.head}>
          <span className="meta">
            § {card.number} · {card.title}
          </span>
          <button
            type="button"
            className={`${styles.toggle} ${included ? styles.on : ''}`}
            aria-pressed={included}
            disabled={disabled || (included && selected.length === 1)}
            onClick={() => onToggle(card.id, !included)}
            title={included && selected.length === 1 ? 'Keep at least one question' : undefined}
          >
            <span className={styles.box} aria-hidden>
              {included ? '✓' : ''}
            </span>
            {included ? 'Asking' : 'Ask this'}
          </button>
        </div>

        <h3 className={styles.question}>{card.question}</h3>

        <p className={styles.source}>
          {match ? (
            <>
              <span className="meta">From the brief</span> <Excerpt match={match} />
            </>
          ) : card.alwaysSuggest ? (
            <span className="meta">Always worth asking</span>
          ) : (
            <span className="meta">Not mentioned in the brief</span>
          )}
        </p>

        <ol className={styles.options}>
          {card.options.map((o, i) => (
            <li key={o.id}>
              <span className={styles.letter}>{LETTERS[i]}</span>
              {o.label}
            </li>
          ))}
          <li className={styles.extra}>
            <span className={styles.letter}>{LETTERS[card.options.length]}</span>
            Something else · Not sure yet
          </li>
        </ol>
      </motion.li>
    )
  }

  return (
    <section className={styles.picker} aria-labelledby="cards-heading">
      <div className={styles.intro}>
        <p className="meta">Step 02 — questions</p>
        <h2 id="cards-heading">Questions you'll both answer</h2>
        <p className={styles.lede}>
          Matched from words in the brief. Keep the ones that decide real work — each of you will answer them
          separately.
        </p>
      </div>
      <LayoutGroup>
        <ul className={styles.list}>{chosen.map((c) => renderCard(c, true))}</ul>
        {rest.length > 0 && (
          <>
            <motion.p layout className={`meta ${styles.divider}`}>
              Not asking · from the library
            </motion.p>
            <ul className={styles.list}>{rest.map((c) => renderCard(c, false))}</ul>
          </>
        )}
      </LayoutGroup>
    </section>
  )
}

// A short excerpt of the matched sentence, with the phrase emphasized.
function Excerpt({ match }: { match: Match }) {
  const s = match.sentence
  const i = s.toLowerCase().indexOf(match.phrase.toLowerCase())
  if (i < 0) return <q>{match.phrase}</q>
  const before = s.slice(Math.max(0, i - 36), i)
  const after = s.slice(i + match.phrase.length, i + match.phrase.length + 36)
  return (
    <q className={styles.excerpt}>
      {i > 36 && '…'}
      {before}
      <strong>{s.slice(i, i + match.phrase.length)}</strong>
      {after}
      {i + match.phrase.length + 36 < s.length && '…'}
    </q>
  )
}
