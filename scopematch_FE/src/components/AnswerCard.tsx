import { motion } from 'motion/react'
import type { Answer, Card, Role } from '../api/client'
import { BookingPreview } from './BookingPreview'
import styles from './CompareBoard.module.css'

export function AnswerCard({ card, answer, name, role, reveal, reduced, delay }: {
  card: Card; answer: Answer; name: string; role: Role; reveal: boolean; reduced: boolean; delay: number
}) {
  const option = card.options.find(o => o.id === answer.optionId)
  const label = option?.label ?? (answer.optionId === 'other' ? 'Something else' : 'Not sure yet')
  const letter = option ? String.fromCharCode(65 + card.options.indexOf(option)) : answer.optionId === 'other' ? '+' : '?'
  return <div className={`${styles.answerWrap} ${role === 'owner' ? styles.freelancer : styles.client}`}>
    <motion.div className={styles.flipper} data-reveal={reveal ? reduced ? 'fade' : 'flip' : 'seen'}
      initial={reveal ? reduced ? { opacity: 0 } : { rotateY: 0 } : false}
      animate={reduced ? { opacity: 1, rotateY: 0 } : { rotateY: 180 }}
      transition={{ duration: reduced ? .25 : .65, delay: reveal ? delay : 0, ease: [.22, 1, .36, 1] }}>
      {!reduced && <div className={styles.sealedFace} aria-hidden="true"><span>SEALED</span><p>{name}</p></div>}
      <div className={`${styles.answerFace} ${reduced ? styles.fadeFace : ''}`}>
        <p className={styles.party}><span className="meta">{role === 'owner' ? 'Freelancer' : 'Client'}</span><span>{name}</span></p>
        <div className={styles.choice}><span className={styles.choiceLetter}>{letter}</span><h4>{label}</h4></div>
        {answer.customText && <p className={styles.customAnswer}>{answer.customText}</p>}
        {answer.optionId === 'unsure' && <p className={styles.customAnswer}>This needs a clearer decision before the scope can be agreed.</p>}
        {card.id === 'booking' && <BookingPreview card={card} optionId={answer.optionId} />}
      </div>
    </motion.div>
  </div>
}
