import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'react-router'
import { api, type Role } from '../api/client'
import { AnswerFlow } from '../components/AnswerFlow'
import { BriefPanel } from '../components/BriefPanel'
import { CardPicker } from '../components/CardPicker'
import { CompareBoard } from '../components/CompareBoard'
import { LinksPanel } from '../components/LinksPanel'
import { Masthead } from '../components/Masthead'
import { useLibrary } from '../lib/library'
import { useSession } from '../lib/useSession'
import { InvalidLinkPage } from './InvalidLinkPage'
import styles from './OwnerWorkspace.module.css'

const TABS = [
  { id: 'setup', label: 'Setup' },
  { id: 'answer', label: 'Answer' },
  { id: 'compare', label: 'Compare' },
  { id: 'scope', label: 'Scope' },
] as const

export function OwnerWorkspace({ role = 'owner' }: { role?: Role }) {
  const { token = '' } = useParams()
  return <Workspace key={role + token} token={token} role={role} />
}

function Workspace({ token, role }: { token: string; role: Role }) {
  const library = useLibrary()
  const { session, setSession, invalid, error: connectionError } = useSession(token, role)
  const [error, setError] = useState('')
  const [active, setActive] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [tab, setTab] = useState<string | null>(null)
  const [clientToken, setClientToken] = useState('')
  const locked = session?.project.locked
  const stage = session?.stage
  const compareReady = !!session?.compare

  useEffect(() => { if (stage === 'compare') setTab(null) }, [stage])

  useEffect(() => {
    if (role !== 'owner' || !locked) return
    let live = true
    api.lock(token).then(r => { if (live) setClientToken(r.clientToken) }).catch(() => {
      if (live) setError("Couldn't restore your client link. Reload to try again.")
    })
    return () => { live = false }
  }, [token, role, locked])

  const matches = useMemo(() => new Map((session?.matches ?? []).map(m => [m.cardId, m])), [session])
  if (invalid) return <InvalidLinkPage />
  if (!session || !library) return <><Masthead home={role === 'owner'} /><main className={styles.centered}>{connectionError || 'Opening the project…'}</main></>
  const { project } = session
  const currentTab = tab ?? (compareReady ? 'compare' : project.locked ? 'answer' : 'setup')

  async function toggle(cardId: string, include: boolean) {
    if (!session) return
    const ids = session.cards.map(c => c.id)
    const next = include ? [...ids, cardId] : ids.filter(id => id !== cardId)
    setSaving(true)
    setError('')
    try { setSession(await api.setCards(token, next)) }
    catch { setError("Couldn't save the question list. Try again.") }
    finally { setSaving(false) }
  }

  async function lock() {
    setSaving(true)
    setError('')
    try {
      const result = await api.lock(token)
      setClientToken(result.clientToken)
      setSession(await api.session(token))
      setTab('setup')
    } catch { setError("Couldn't lock the questions. Try again.") }
    finally { setSaving(false) }
  }

  const marks = session.cards.filter(c => c.match).map(c => ({ match: c.match!, number: library.get(c.id)?.number ?? 0 }))
  return <>
    <Masthead home={role === 'owner'} meta={<><span>{role === 'owner' ? 'Freelancer view' : 'Client view'}</span><span aria-live="polite">{saving ? 'Saving…' : project.locked ? 'Questions locked' : 'Saved'}</span></>} />
    <main className={styles.page}>
      <header className={styles.header}>
        <h1>{project.name}</h1>
        <p className={styles.parties}>Between <span className="ink-freelancer">{project.freelancerName}</span>{' '}<span className="meta">(freelancer{role === 'owner' ? ', you' : ''})</span> and <span className="ink-client">{project.clientName}</span>{' '}<span className="meta">(client{role === 'client' ? ', you' : ''})</span></p>
      </header>
      <nav className={styles.tabs} aria-label="Project stages">
        {TABS.filter(t => role === 'owner' || t.id !== 'setup').map((t, i) => <button key={t.id} className={`${styles.tab} ${currentTab === t.id ? styles.current : ''}`} aria-current={currentTab === t.id ? 'step' : undefined} disabled={t.id === 'scope' || (t.id === 'compare' && !compareReady) || (t.id === 'answer' && !project.locked)} onClick={() => setTab(t.id)}><span className={styles.num}>0{i + 1}</span> {t.label}</button>)}
      </nav>
      {(error || connectionError) && <p role="alert" className={styles.error}>{error || connectionError}</p>}
      {currentTab === 'setup' && <>
        {clientToken && <LinksPanel token={token} clientToken={clientToken} />}
        <div className={styles.setup}>
          <div className={styles.briefCol}><BriefPanel brief={project.brief} marks={marks} activeCardId={active} onActivate={setActive} /></div>
          <div>
            <CardPicker library={library} selected={session.cards} matches={matches} activeCardId={active} onActivate={setActive} onToggle={toggle} disabled={project.locked || saving} />
            <div className={styles.actions}>
              {project.locked ? <button className="btn" onClick={() => setTab('answer')}>Answer the questions →</button> : <><p>Locking fixes these questions for both of you.</p><button className="btn" disabled={saving || !session.cards.length} onClick={() => void lock()}>{saving ? 'Locking…' : 'Lock questions & get links'}</button></>}
            </div>
          </div>
        </div>
      </>}
      {currentTab === 'answer' && <>
        {role === 'owner' && clientToken && <details className={styles.links}><summary>Project links · keep yours, share the client's</summary><LinksPanel token={token} clientToken={clientToken} /></details>}
        <AnswerFlow token={token} session={session} library={library} onUpdate={setSession} />
      </>}
      {currentTab === 'compare' && compareReady && <CompareBoard token={token} session={session} library={library} onUpdate={setSession} />}
    </main>
  </>
}
