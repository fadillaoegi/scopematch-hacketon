import type { Session } from '../domain/models'
import styles from './AnswerFlow.module.css'

export function SealedState({ session }: { session: Session }) {
  return <section className={styles.sealed} aria-live="polite">
    <span className={styles.stamp}>SEALED</span>
    <p className="meta">Your answers are safely recorded</p>
    <h2>Sealed. Waiting for {session.other.name}.</h2>
    <p>Your choices stay private until you have both submitted. This page checks automatically; you can also return using your link.</p>
  </section>
}
