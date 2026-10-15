import { AnimatePresence, motion } from 'motion/react'

// A number that rolls up when it changes, so a new decision is noticed.
export function NumberFlip({ value, className }: { value: number; className?: string }) {
  return (
    <span className={className} style={{ display: 'inline-grid', overflow: 'hidden', verticalAlign: 'bottom' }}>
      <AnimatePresence initial={false} mode="popLayout">
        <motion.span
          key={value}
          style={{ gridArea: '1 / 1' }}
          initial={{ y: '100%', opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: '-100%', opacity: 0 }}
          transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
        >
          {value}
        </motion.span>
      </AnimatePresence>
    </span>
  )
}
