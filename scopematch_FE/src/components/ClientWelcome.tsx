import { motion } from 'motion/react'
import type { Session } from '../domain/models'
import styles from './AnswerFlow.module.css'

// First screen for a client who opens the link cold (often from WhatsApp):
// who is asking, why, and the one rule that makes the answers honest.
export function ClientWelcome({ session, count, onStart }: { session: Session; count: number; onStart: () => void }) {
  const freelancer = session.other.name
  const steps = [
    { title: 'Answer on your own', body: `${freelancer} answers the same questions separately.` },
    { title: 'Seal your answers', body: 'Neither of you sees the other’s answers until both are sealed.' },
    { title: 'Compare and agree', body: 'See where you differ, then confirm one scope together.' },
  ]
  return <section className={styles.welcome} aria-labelledby="welcome-heading">
    <p className="meta">A private request from {freelancer}</p>
    <h2 id="welcome-heading">Before work starts, let’s check you both picture the same thing.</h2>
    <p className={styles.welcomeLede}>
      {freelancer} is preparing <strong>{session.project.name}</strong> and asked you {count} short {count === 1 ? 'question' : 'questions'} about what you imagine it will do.
    </p>
    <ol className={styles.welcomeSteps}>
      {steps.map((s, i) => <motion.li key={s.title} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: .15 + i * .12, duration: .4, ease: [.22, 1, .36, 1] }}>
        <span className={styles.welcomeNum}>{i + 1}</span>
        <span><strong>{s.title}</strong><span>{s.body}</span></span>
      </motion.li>)}
    </ol>
    <div className={styles.welcomeActions}>
      <button className="btn" onClick={onStart}>Start answering <span aria-hidden>→</span></button>
      <span className="meta">About 2 minutes · no account needed</span>
    </div>
  </section>
}
