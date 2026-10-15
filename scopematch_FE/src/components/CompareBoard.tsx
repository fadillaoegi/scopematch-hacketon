import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import type { Card, CompareStatus, Session } from '../domain/models'
import { AnswerCard } from './AnswerCard'
import { NumberFlip } from './NumberFlip'
import { ProposalBox } from './ProposalBox'
import { StatusTag } from './StatusTag'
import styles from './CompareBoard.module.css'

const seenInMemory = new Set<string>()
function alreadySeen(key: string) {
  try { return seenInMemory.has(key) || localStorage.getItem(key) === '1' }
  catch { return seenInMemory.has(key) }
}

export function CompareBoard({ token, session, library, onUpdate, onScope }: { token: string; session: Session; library: Map<string, Card>; onUpdate: (s: Session) => void; onScope: () => void }) {
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
    <header className={styles.bento}>
      <div className={`${styles.tile} ${styles.hero}`}><p className="meta">Both answers are in · now revealed</p><h2>One brief.<br /><em>Two interpretations.</em></h2><p>Here is what each of you imagined. Use the differences to agree on what the project will include.</p></div>
      {counts && <>
        <div className={`${styles.tile} ${styles.counter}`} aria-label={`${counts.decided} of ${counts.total} decided`}>
          <span className="meta">Decided</span>
          <strong><NumberFlip value={counts.decided} /><span> / {counts.total}</span></strong>
          <span className={styles.progress} aria-hidden><motion.span initial={false} animate={{ scaleX: counts.total ? counts.decided / counts.total : 0 }} transition={{ duration: .7, ease: [.65, 0, .35, 1] }} /></span>
        </div>
        <div className={`${styles.tile} ${styles.mix}`}>
          <span className="meta">Still open</span>
          <span className={styles.bar} aria-hidden>
            {(['needs_discussion', 'needs_clarification', 'same_answer'] as const).map(k => {
              const n = k === 'needs_discussion' ? counts.discussion : k === 'needs_clarification' ? counts.clarification : counts.same
              return <motion.span key={k} className={styles[`seg_${k}`]} initial={false} animate={{ flexGrow: n }} transition={{ duration: .6, ease: [.22, 1, .36, 1] }} />
            })}
          </span>
          <p className={styles.tally} aria-live="polite"><span><i className={styles.key_needs_discussion} />{counts.discussion} need discussion</span><span><i className={styles.key_needs_clarification} />{counts.clarification} need clarification</span><span><i className={styles.key_same_answer} />{counts.same} same answer</span></p>
        </div>
        <nav className={`${styles.tile} ${styles.map}`} aria-label="Jump to a question">
          <span className="meta">Every question</span>
          <ol>{session.compare?.map(c => { const card = library.get(c.cardId); return card && <motion.li layout key={c.cardId}><a href={`#clause-${c.cardId}`} className={`${styles.chip} ${styles[c.status]}`}><span aria-hidden>{SYMBOL[c.status]}</span>§{card.number} {card.title}</a></motion.li> })}</ol>
        </nav>
      </>}
    </header>
    {session.stage === 'review' && <div className={styles.review}><p>Every question has a decision confirmed by both of you.</p><button className="btn" onClick={onScope}>{session.role === 'owner' ? 'Review scope →' : 'View scope →'}</button></div>}
    <div className={styles.clauses}>
      {session.compare?.map((comparison, index) => {
        const card = library.get(comparison.cardId)
        const a = owner.answers?.find(a => a.cardId === comparison.cardId)
        const b = client.answers?.find(a => a.cardId === comparison.cardId)
        if (!card || !a || !b) return null
        return <article className={styles.clause} key={card.id} id={`clause-${card.id}`}>
          <header className={styles.clauseHead}><div><p className="meta">§ {card.number} · {card.title}</p><h3>{card.question}</h3></div><StatusTag status={comparison.status} /></header>
          <div className={styles.pair}>
            <AnswerCard card={card} answer={a} name={owner.name} role="owner" reveal={reveal} reduced={reduced} delay={index * .12} />
            <DiffLink status={comparison.status} delay={reveal ? index * .12 + .6 : 0} />
            <AnswerCard card={card} answer={b} name={client.name} role="client" reveal={reveal} reduced={reduced} delay={index * .12} />
          </div>
          <ProposalBox token={token} session={session} card={card} comparison={comparison} onUpdate={onUpdate} />
          {comparison.status === 'same_answer' && <p className={styles.sameNote}>You pictured the same thing. Both still need to confirm it as the decision.</p>}
        </article>
      })}
    </div>
  </section>
}

const SYMBOL: Record<CompareStatus, string> = { needs_discussion: '≠', needs_clarification: '?', same_answer: '=', decided: '✓' }
const MEANING: Record<CompareStatus, string> = {
  needs_discussion: 'Different answers', needs_clarification: 'Not settled yet', same_answer: 'Same answer', decided: 'Agreed by both',
}

// The link between the two answers explains their relationship at a glance:
// ≠ different, ? unclear, = same, ✓ settled. It redraws when the status changes.
function DiffLink({ status, delay }: { status: CompareStatus; delay: number }) {
  // Wait for the card flip on first view; later status changes animate at once.
  const first = useRef(true)
  useEffect(() => { first.current = false }, [])
  const wait = first.current ? delay + .2 : 0
  return <div className={`${styles.link} ${styles[`link_${status}`]}`} role="img" aria-label={MEANING[status]}>
    <motion.span className={styles.wire} initial={{ scaleX: 0 }} animate={{ scaleX: 1 }} transition={{ delay, duration: .5, ease: [.65, 0, .35, 1] }} />
    <AnimatePresence mode="wait">
      <motion.span key={status} className={styles.symbol} initial={{ scale: .4, opacity: 0, rotate: -20 }} animate={{ scale: 1, opacity: 1, rotate: 0 }} exit={{ scale: .4, opacity: 0 }} transition={{ type: 'spring', stiffness: 420, damping: 22, delay: wait }}>{SYMBOL[status]}</motion.span>
    </AnimatePresence>
    <span className={styles.linkLabel}>{MEANING[status]}</span>
  </div>
}
