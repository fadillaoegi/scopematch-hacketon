import { Link } from 'react-router'
import { Masthead } from '../components/Masthead'
import styles from './InvalidLinkPage.module.css'

// Shown for any unknown or broken link. Reveals nothing about any project.
export function InvalidLinkPage() {
  return (
    <>
      <Masthead />
      <main className={styles.page}>
        <p className="meta">Link not recognised</p>
        <h1>This link isn't valid.</h1>
        <p className={styles.body}>
          Check that you copied the whole link. If someone sent it to you, ask them to send it again.
        </p>
        <Link to="/" className="btn btn-outline">
          Go to ScopeMatch
        </Link>
      </main>
    </>
  )
}
