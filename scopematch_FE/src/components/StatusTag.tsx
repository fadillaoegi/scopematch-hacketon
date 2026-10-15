import type { CompareStatus } from '../api/client'
import styles from './CompareBoard.module.css'

const LABELS: Record<CompareStatus, string> = {
  same_answer: 'Same answer', needs_discussion: 'Needs discussion', needs_clarification: 'Needs clarification', decided: 'Decided',
}

export function StatusTag({ status }: { status: CompareStatus }) {
  return <span className={`${styles.status} ${styles[status]}`}><span aria-hidden>{status === 'same_answer' || status === 'decided' ? '✓' : status === 'needs_discussion' ? '≠' : '?'}</span>{LABELS[status]}</span>
}
