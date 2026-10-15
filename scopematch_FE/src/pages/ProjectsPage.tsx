import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { api, ApiError, type Session, type Stage } from '../api/client'
import { Masthead } from '../components/Masthead'
import { rememberedProjects } from '../lib/projects'
import styles from './ProjectsPage.module.css'

const STAGES: Record<Stage, string> = { setup: 'Setup', answering: 'Answering separately', compare: 'Compare & resolve', review: 'Review scope', agreed: 'Agreed' }
export function ProjectsPage() {
  const [projects] = useState(rememberedProjects)
  const [sessions, setSessions] = useState<Record<string, Session>>({})
  const [errors, setErrors] = useState<Record<string, string>>({})
  useEffect(() => {
    let live = true
    void Promise.allSettled(projects.map(async p => {
      try {
        const s = await api.session(p.ownerToken)
        if (live) setSessions(prev => ({ ...prev, [p.ownerToken]: s }))
      } catch (e) {
        if (live) setErrors(prev => ({ ...prev, [p.ownerToken]: e instanceof ApiError && e.status === 401 ? 'This saved link is no longer valid' : 'Server unavailable · open to retry' }))
      }
    }))
    return () => { live = false }
  }, [projects])
  return <>
    <Masthead home={false} meta={<span>Your projects</span>} />
    <main className={styles.page}>
      <div className={styles.top}><h1>Your scopes</h1><Link to="/new" className="btn">New project <span aria-hidden>→</span></Link></div>
      <p className={styles.note}>Projects remembered on this device. Your private freelancer link also opens the project on another device.</p>
      {projects.length === 0 ? <div className={styles.empty}><p>Start with one brief.<br />Find out what each of you imagines.</p><p className={styles.note}>You and your client answer separately, compare expectations, then confirm one scope together.</p><Link to="/new" className="btn btn-outline">Create your first scope →</Link></div> : <ul className={styles.list}>
        {projects.map(p => {
          const s = sessions[p.ownerToken]
          return <li key={p.ownerToken}><Link to={`/o/${p.ownerToken}`}>
            <div className={styles.projectTitle}><span>{s?.project.name ?? p.name}</span><span className={`meta ${s?.stage === 'agreed' ? styles.agreed : ''}`}>{s ? STAGES[s.stage] : errors[p.ownerToken] ? 'Link status' : 'Opening…'}</span></div>
            <p className={styles.detail}>{s ? <><span>Client: {s.project.clientName}</span><span>{s.counts ? `${s.counts.decided} of ${s.counts.total} decided · ${s.counts.discussion} need discussion · ${s.counts.clarification} need clarification` : `${s.cards.length} questions · ${s.project.locked ? `${Number(s.me.submitted) + Number(s.other.submitted)} of 2 answers sealed` : 'Questions still editable'}`}</span></> : errors[p.ownerToken] ?? 'Checking the latest stage…'}</p>
          </Link></li>
        })}
      </ul>}
    </main>
  </>
}
