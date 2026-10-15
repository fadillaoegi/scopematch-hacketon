import { motion, useReducedMotion } from 'motion/react'
import styles from './ScopeDocument.module.css'

export function AgreedStamp() {
  const reduced = useReducedMotion()
  return <motion.div className={styles.stamp} role="status" initial={reduced ? { opacity: 0 } : { opacity: 0, scale: 1.6, rotate: -8 }} animate={{ opacity: 1, scale: 1, rotate: -8 }} transition={{ duration: reduced ? .2 : .5, ease: [.22, 1, .36, 1] }}>AGREED</motion.div>
}
