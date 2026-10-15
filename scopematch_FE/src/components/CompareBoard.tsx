import { useEffect, useState } from 'react'
import { useReducedMotion } from 'motion/react'
import type { Card, Session } from '../api/client'
import { AnswerCard } from './AnswerCard'
import { StatusTag } from './StatusTag'
import styles from './CompareBoard.module.css'

const seenInMemory = new Set<string>()
function alreadySeen(key: string) {
  try { return seenInMemory.has(key) || localStorage.getItem(key) === '1' }
  catch { return seenInMemory.has(key) }
}

export function CompareBoard({ token, session, library }: { token: string; session: Session; library: Map<string, Card> }) {
  const key = `scopematch.reveal.${token}`
  const [reveal] = useState(() => !alreadySeen(key))
  const reduced = !!useReducedMotion()
  useEffect(() => {
    const timer = window.setTimeout(() => {
      seenInMemory.add(key)
      try { localStorage.setItem(key, '1') } catch { /* session memory still prevents a repeated reveal */ }
    }, reduced ? 400 : 1600)
    return () => window.clearTimeout(timer)
  }, [key, reduced])
  const owner = session.role === 'owner' ? session.me : session.other
  const client = session.role === 'client' ? session.me : session.other
  const counts = session.counts
  return <section className={styles.board} aria-label="Compare answers">
    <header className={styles.intro}>
      <div><p className="meta">Both answers are in · now revealed</p><h2>One brief.<br /><em>Two interpretations.</em></h2><p>Here is what each of you imagined. Use the differences to agree on what the project will include.</p></div>
      {counts && <div className={styles.counter} aria-label={`${counts.decided} of ${counts.total} decided`}><strong>{counts.decided}<span> / {counts.total}</span></strong><span className="meta">Decided</span></div>}
    </header>
    {counts && <p className={styles.tally} aria-live="polite"><span>{counts.discussion} need discussion</span><span>{counts.clarification} need clarification</span><span>{counts.same} same answer</span></p>}
    <div className={styles.clauses}>
      {session.compare?.map((comparison, index) => {
        const card = library.get(comparison.cardId)
        const a = owner.answers?.find(a => a.cardId === comparison.cardId)
        const b = client.answers?.find(a => a.cardId === comparison.cardId)
        if (!card || !a || !b) return null
        return <article className={styles.clause} key={card.id}>
          <header className={styles.clauseHead}><div><p className="meta">§ {card.number} · {card.title}</p><h3>{card.question}</h3></div><StatusTag status={comparison.status} /></header>
          <div className={styles.pair}>
            <AnswerCard card={card} answer={a} name={owner.name} role="owner" reveal={reveal} reduced={reduced} delay={index * .12} />
            <AnswerCard card={card} answer={b} name={client.name} role="client" reveal={reveal} reduced={reduced} delay={index * .12} />
          </div>
          {comparison.status === 'same_answer' && <p className={styles.sameNote}>You pictured the same thing. Both still need to confirm it as the decision.</p>}
        </article>
      })}
    </div>
  </section>
}
