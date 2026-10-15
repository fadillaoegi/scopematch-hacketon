import { Link } from 'react-router'
import { Masthead } from '../components/Masthead'
import { rememberedProjects } from '../lib/projects'
import styles from './ProjectsPage.module.css'

// Projects created on this device. Stage and counts arrive in a later slice.
export function ProjectsPage() {
  const projects = rememberedProjects()
  return (
    <>
      <Masthead home={false} meta={<span>Your projects</span>} />
      <main className={styles.page}>
        <div className={styles.top}>
          <h1>Your scopes</h1>
          <Link to="/new" className="btn">
            New project <span aria-hidden>→</span>
          </Link>
        </div>
        {projects.length === 0 ? (
          <p className={styles.empty}>
            Nothing here yet. Start with a client's brief — you'll both answer the same questions, separately.
          </p>
        ) : (
          <ul className={styles.list}>
            {projects.map((p) => (
              <li key={p.ownerToken}>
                <Link to={`/o/${p.ownerToken}`}>{p.name}</Link>
              </li>
            ))}
          </ul>
        )}
      </main>
    </>
  )
}
