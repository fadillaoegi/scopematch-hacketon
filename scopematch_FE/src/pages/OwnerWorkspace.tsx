import { useCallback, useEffect, useMemo, useState } from 'react'
import { useParams } from 'react-router'
import { api, ApiError, type Session } from '../api/client'
import { BriefPanel } from '../components/BriefPanel'
import { CardPicker } from '../components/CardPicker'
import { Masthead } from '../components/Masthead'
import { useLibrary } from '../lib/library'
import { InvalidLinkPage } from './InvalidLinkPage'
import styles from './OwnerWorkspace.module.css'

const TABS = [
  { id: 'setup', label: 'Setup' },
  { id: 'answer', label: 'Answer' },
  { id: 'compare', label: 'Compare' },
  { id: 'scope', label: 'Scope' },
] as const

export function OwnerWorkspace() {
  const { token = '' } = useParams()
  const library = useLibrary()
  const [session, setSession] = useState<Session | null>(null)
  const [invalid, setInvalid] = useState(false)
  const [error, setError] = useState('')
  const [active, setActive] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    try {
      setSession(await api.session(token))
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) setInvalid(true)
      else setError("Couldn't load this project. Is the server running?")
    }
  }, [token])

  useEffect(() => {
    load()
  }, [load])

  const matches = useMemo(() => new Map((session?.matches ?? []).map((m) => [m.cardId, m])), [session])

  if (invalid) return <InvalidLinkPage />
  if (error) return <Centered>{error}</Centered>
  if (!session || !library) return <Centered>Opening the project…</Centered>

  const { project } = session

  async function toggle(cardId: string, include: boolean) {
    if (!session) return
    const ids = session.cards.map((c) => c.id)
    const next = include ? [...ids, cardId] : ids.filter((id) => id !== cardId)
    // Optimistic: reorder immediately, then take the server's answer.
    setSession({ ...session, cards: next.map((id) => ({ id, match: matches.get(id) ?? null })) })
    setSaving(true)
    try {
      setSession(await api.setCards(token, next))
    } catch {
      setError("Couldn't save the question list. Reload and try again.")
    } finally {
      setSaving(false)
    }
  }

  const marks = session.cards
    .filter((c) => c.match)
    .map((c) => ({ match: c.match!, number: library.get(c.id)?.number ?? 0 }))

  return (
    <>
      <Masthead
        meta={
          <>
            <span>Freelancer view</span>
            <span aria-live="polite">{saving ? 'Saving…' : 'Saved'}</span>
          </>
        }
      />
      <main className={styles.page}>
        <header className={styles.header}>
          <h1>{project.name}</h1>
          <p className={styles.parties}>
            Between <span className="ink-freelancer">{project.freelancerName}</span>{' '}
            <span className="meta">(you)</span> and <span className="ink-client">{project.clientName}</span>{' '}
            <span className="meta">(client)</span>
          </p>
        </header>

        <nav className={styles.tabs} aria-label="Project stages">
          {TABS.map((t, i) => (
            <span
              key={t.id}
              className={`${styles.tab} ${t.id === 'setup' ? styles.current : ''}`}
              aria-current={t.id === 'setup' ? 'step' : undefined}
              aria-disabled={t.id !== 'setup'}
            >
              <span className={styles.num}>0{i + 1}</span> {t.label}
            </span>
          ))}
        </nav>

        <div className={styles.setup}>
          <div className={styles.briefCol}>
            <BriefPanel brief={project.brief} marks={marks} activeCardId={active} onActivate={setActive} />
          </div>
          <CardPicker
            library={library}
            selected={session.cards}
            matches={matches}
            activeCardId={active}
            onActivate={setActive}
            onToggle={toggle}
            disabled={project.locked}
          />
        </div>
      </main>
    </>
  )
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Masthead />
      <main className={styles.centered}>
        <p>{children}</p>
      </main>
    </>
  )
}
