import { motion } from 'motion/react'
import type { Session, Stage } from '../domain/models'
import styles from './StageRail.module.css'

const STAGES: { id: Stage; label: string }[] = [
  { id: 'setup', label: 'Questions' },
  { id: 'answering', label: 'Answer apart' },
  { id: 'compare', label: 'Compare' },
  { id: 'review', label: 'Review' },
  { id: 'agreed', label: 'Agreed' },
]

// Informative status panel: where the project is, and whether each person's
// answers are sealed. Everything shown comes from the server's session.
export function StageRail({ session }: { session: Session }) {
  const at = STAGES.findIndex(s => s.id === session.stage)
  const owner = session.role === 'owner' ? session.me : session.other
  const client = session.role === 'client' ? session.me : session.other
  const party = (name: string, submitted: boolean, kind: 'freelancer' | 'client') => {
    const state = !session.project.locked ? 'Not invited yet' : submitted ? 'Answers sealed' : 'Answering…'
    return (
      <li className={`${styles.party} ${styles[kind]} ${submitted ? styles.sealed : ''}`}>
        <span className={styles.seal} aria-hidden>
          <motion.span
            className={styles.sealFill}
            initial={false}
            animate={{ scale: submitted ? 1 : 0 }}
            transition={{ type: 'spring', stiffness: 420, damping: 22 }}
          />
        </span>
        <span className={styles.partyName}>{name}</span>
        <span className="meta">{state}</span>
      </li>
    )
  }
  return (
    <aside className={styles.rail} aria-label="Project progress">
      <p className="meta">Progress · stage {at + 1} of {STAGES.length}</p>
      <ol className={styles.stages}>
        <motion.span
          className={styles.fill}
          aria-hidden
          initial={false}
          animate={{ scaleX: at / (STAGES.length - 1) }}
          transition={{ duration: 0.8, ease: [0.65, 0, 0.35, 1] }}
        />
        {STAGES.map((s, i) => (
          <li key={s.id} className={`${styles.stage} ${i < at ? styles.done : ''} ${i === at ? styles.current : ''}`} aria-current={i === at ? 'step' : undefined}>
            <span className={styles.node} aria-hidden />
            <span className={styles.label}>{s.label}</span>
          </li>
        ))}
      </ol>
      <ul className={styles.parties} aria-label="Who has sealed their answers">
        {party(owner.name, owner.submitted, 'freelancer')}
        {party(client.name, client.submitted, 'client')}
      </ul>
      <p className={styles.rule}>
        {session.project.locked && !(owner.submitted && client.submitted)
          ? 'Answers stay hidden from each other until both are sealed.'
          : session.stage === 'agreed'
            ? 'Both confirmed the same saved version.'
            : session.compare
              ? 'Both sealed — answers are now visible to both of you.'
              : 'Pick the questions, then lock them to invite your client.'}
      </p>
    </aside>
  )
}
