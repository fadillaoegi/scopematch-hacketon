import { useEffect, useState } from 'react'
import type { Card } from '../domain/models'
import { useMedia } from '../lib/useMedia'
import styles from './CompareBoard.module.css'

export function BookingPreview({ card, optionId }: { card: Card; optionId: string }) {
  const option = card.options.find(o => o.id === optionId)
  // On phones the preview is long, so it starts folded; desktop shows it open.
  const phone = useMedia('(max-width: 700px)')
  const [open, setOpen] = useState(!phone)
  useEffect(() => setOpen(!phone), [phone])
  if (!option?.preview) return null
  return <details className={styles.preview} open={open} onToggle={e => setOpen(e.currentTarget.open)} aria-label={`Customer preview: ${option.label}`}>
    <summary className={styles.previewSummary}><span className="meta">What the customer sees</span><span className={styles.previewHint} aria-hidden>{open ? 'Hide' : 'Show'}</span></summary>
    <div className={styles.sample} aria-hidden="true">
      <span className={styles.salon}>The business <span>Booking</span></span>
      {optionId === 'a' && <><span className={styles.mockButton}>Book now ↗</span><p className={styles.chat}>Hi, I'd like to book a haircut.</p><span className={styles.sampleNote}>Continue in WhatsApp</span></>}
      {optionId === 'b' && <><span className={styles.sampleNote}>Haircut · Saturday · 14:00</span><span className={styles.mockButton}>Request an appointment</span><p className={styles.receipt}>Request sent <span>Pending staff approval</span></p></>}
      {optionId === 'c' && <><span className={styles.sampleNote}>Haircut · 45 min · with Rina</span><div className={styles.slots}><span>10:00</span><span>11:00</span><span className={styles.chosenSlot}>14:00</span></div><p className={styles.receipt}>Confirmed <span>Saturday at 14:00 · slot reserved</span></p></>}
    </div>
    <ol className={styles.steps}>{option.preview.map(step => <li key={step.title}><strong>{step.title}</strong><p>{step.body}</p></li>)}</ol>
    <p className={styles.sampleNote}>Sample data · static preview</p>
  </details>
}
