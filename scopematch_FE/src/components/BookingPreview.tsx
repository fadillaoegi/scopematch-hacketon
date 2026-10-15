import type { Card } from '../domain/models'
import styles from './CompareBoard.module.css'

export function BookingPreview({ card, optionId }: { card: Card; optionId: string }) {
  const option = card.options.find(o => o.id === optionId)
  if (!option?.preview) return null
  return <section className={styles.preview} aria-label={`Customer preview: ${option.label}`}>
    <p className="meta">What the salon’s customer sees</p>
    <div className={styles.sample} aria-hidden="true">
      <span className={styles.salon}>The salon <span>Booking</span></span>
      {optionId === 'a' && <><span className={styles.mockButton}>Book now ↗</span><p className={styles.chat}>Hi, I'd like to book a haircut.</p><span className={styles.sampleNote}>Continue in WhatsApp</span></>}
      {optionId === 'b' && <><span className={styles.sampleNote}>Haircut · Saturday · 14:00</span><span className={styles.mockButton}>Request an appointment</span><p className={styles.receipt}>Request sent <span>Pending staff approval</span></p></>}
      {optionId === 'c' && <><span className={styles.sampleNote}>Haircut · 45 min · with Rina</span><div className={styles.slots}><span>10:00</span><span>11:00</span><span className={styles.chosenSlot}>14:00</span></div><p className={styles.receipt}>Confirmed <span>Saturday at 14:00 · slot reserved</span></p></>}
    </div>
    <ol className={styles.steps}>{option.preview.map(step => <li key={step.title}><strong>{step.title}</strong><p>{step.body}</p></li>)}</ol>
    <p className={styles.sampleNote}>Sample data · static preview</p>
  </section>
}
