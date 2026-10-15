import { motion } from 'motion/react'
import type { Session } from '../domain/models'
import styles from './AnswerFlow.module.css'

// Two seals side by side: yours is closed, theirs waits. Explains why nothing
// is visible yet without another paragraph of text.
export function SealedState({ session }: { session: Session }) {
  const mine = session.role === 'owner' ? styles.sealFreelancer : styles.sealClient
  const theirs = session.role === 'owner' ? styles.sealClient : styles.sealFreelancer
  return <section className={styles.sealed} aria-live="polite">
    <div className={styles.seals} aria-hidden>
      <motion.span className={`${styles.sealDisc} ${mine}`} initial={{ scale: 1.5, rotate: -25, opacity: 0 }} animate={{ scale: 1, rotate: -6, opacity: 1 }} transition={{ type: 'spring', stiffness: 300, damping: 18 }}>
        <span>SEALED</span><small>{session.me.name}</small>
      </motion.span>
      <span className={styles.sealGap} />
      <motion.span className={`${styles.sealDisc} ${styles.waiting} ${theirs}`} animate={{ opacity: [0.45, 1, 0.45] }} transition={{ duration: 2.2, repeat: Infinity, ease: 'easeInOut' }}>
        <span>…</span><small>{session.other.name}</small>
      </motion.span>
    </div>
    <p className="meta">Your answers are safely recorded</p>
    <h2>Sealed. Waiting for {session.other.name}.</h2>
    <p>Your choices stay private until you have both submitted. This page checks automatically; you can also return using your link.</p>
  </section>
}
