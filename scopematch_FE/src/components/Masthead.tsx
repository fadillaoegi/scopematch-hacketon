import { Link } from 'react-router'
import styles from './Masthead.module.css'

// Document masthead: wordmark left, a mono metadata line right.
export function Masthead({ meta, home = true }: { meta?: React.ReactNode; home?: boolean }) {
  const mark = (
    <span className={styles.wordmark}>
      <span className={styles.section}>§</span>
      Scope<em>Match</em>
    </span>
  )
  return (
    <header className={styles.masthead}>
      {home ? (
        <Link to="/" className={styles.home} aria-label="ScopeMatch — your projects">
          {mark}
        </Link>
      ) : (
        mark
      )}
      {meta && <div className={`meta ${styles.metaLine}`}>{meta}</div>}
    </header>
  )
}
