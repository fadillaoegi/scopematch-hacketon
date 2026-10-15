import { useEffect, useState } from 'react'
import { useProjectGateway } from '../lib/gateway'
import { GatewayError } from '../application/errors'
import type { ScopeView, Session, Summary } from '../domain/models'
import { AgreedStamp } from './AgreedStamp'
import styles from './ScopeDocument.module.css'

const SECTIONS: { key: keyof Summary; label: string }[] = [
  { key: 'included', label: 'Included' }, { key: 'excluded', label: 'Excluded' },
  { key: 'clientResponsibilities', label: 'Client responsibilities' },
  { key: 'acceptanceCriteria', label: 'Acceptance criteria' }, { key: 'openQuestions', label: 'Open questions' },
]

export function ScopeDocument({ token, session, onUpdate }: { token: string; session: Session; onUpdate: (s: Session) => void }) {
  const api = useProjectGateway()
  const [view, setView] = useState<ScopeView | null>(null)
  const [summary, setSummary] = useState<Summary | null>(null)
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(session.me.name)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const owner = session.role === 'owner'
  const agreed = session.stage === 'agreed'
  const latestVersion = session.scope?.latestVersion
  const current = session.scope?.current
  const ownerAt = session.scope?.ownerConfirmedAt
  const clientAt = session.scope?.clientConfirmedAt
  const canDraft = session.stage === 'review'

  useEffect(() => {
    let live = true
    async function load() {
      try {
        const v = await api.scope(token)
        if (!live) return
        setView(v); setError('')
        if (owner && !v.versions.length && canDraft) {
          const draft = await api.draft(token)
          if (live) setSummary(old => old ?? draft.summary)
        }
      } catch { if (live) setError("Couldn't load the scope. Reload to try again.") }
    }
    void load()
    return () => { live = false }
  }, [token, owner, latestVersion, current, ownerAt, clientAt, canDraft, api])

  async function refresh() {
    const [v, s] = await Promise.all([api.scope(token), api.session(token)])
    setView(v); onUpdate(s)
  }
  async function edit() {
    setBusy(true); setError('')
    try {
      const draft = view?.current && view.versions[0] ? view.versions[0].summary : (await api.draft(token)).summary
      setSummary(draft); setEditing(true)
    } catch { setError('Every question needs a confirmed decision before you can prepare the scope.') }
    finally { setBusy(false) }
  }
  async function save() {
    if (!summary) return
    setBusy(true); setError('')
    try { await api.saveVersion(token, summary); await refresh(); setEditing(false) }
    catch { setError('The scope was not sent. Check your connection and confirm every decision, then try again.') }
    finally { setBusy(false) }
  }
  async function confirm() {
    if (!view?.versions[0]) return
    setBusy(true); setError('')
    try { await api.confirmVersion(token, view.versions[0].version, name); await refresh() }
    catch (e) { setError(e instanceof GatewayError && ['not_latest', 'decisions_changed'].includes(e.code) ? 'The scope changed. Review the latest version before confirming.' : 'Your confirmation was not recorded. Review the latest version and try again.'); void refresh().catch(() => {}) }
    finally { setBusy(false) }
  }
  async function download() {
    setBusy(true); setError('')
    try {
      const { contents, filename } = await api.download(token)
      const blob = new Blob([contents], { type: 'text/markdown;charset=utf-8' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a'); a.href = url; a.download = filename
      document.body.append(a); a.click(); a.remove()
      window.setTimeout(() => URL.revokeObjectURL(url), 1000)
    } catch { setError("Couldn't download the agreed scope. Try again.") }
    finally { setBusy(false) }
  }

  const latest = view?.versions[0]
  const composing = owner && !agreed && (editing || (!latest && canDraft))
  const shown = composing ? summary : latest?.summary
  const mine = owner ? latest?.ownerConfirmation : latest?.clientConfirmation
  return <section className={styles.page} aria-label="Scope document">
    <header className={styles.heading}><div><p className="meta">{agreed ? 'One scope · confirmed by both' : 'Review the same version together'}</p><h2>{agreed ? 'The agreed scope.' : 'From decisions to scope.'}</h2></div>{agreed && <AgreedStamp />}</header>
    {error && <p className={styles.error} role="alert">{error}</p>}
    {!view && !error && <p role="status">Opening the scope…</p>}
    {view && !latest && !owner && <p className={styles.notice}>All decisions are confirmed. Waiting for {session.other.name} to send the scope for your review.</p>}
    {view && !latest && !canDraft && owner && <p className={styles.notice}>Confirm every decision in Compare before preparing the scope.</p>}
    {latest && !view?.current && !agreed && <p className={styles.notice}>Decisions have changed since v{latest.version}. This version cannot be confirmed. The freelancer needs to send an updated scope.</p>}
    {shown && <article className={styles.document}>
      <header className={styles.documentHeader}><span className="meta">{composing ? 'Draft · unsaved' : `v${latest?.version} · ${latest ? new Date(latest.createdAt).toLocaleString() : ''}`}</span><h3>{session.project.name}</h3><p>Between <span className="ink-freelancer">{session.project.freelancerName}</span> and <span className="ink-client">{session.project.clientName}</span></p></header>
      {!composing && latest && <section className={styles.section}><h4>Decisions</h4><ul>{latest.decisions.map(d => <li key={d.cardId}><span className="meta">§ {d.number} {d.title}</span><p>{d.label}</p></li>)}</ul></section>}
      {composing && <p className={styles.notice}>One item per line. Sending saves a new version and both people must confirm that version. Unsaved edits are lost on reload.</p>}
      {SECTIONS.map(({ key, label }) => <section className={styles.section} key={key}>
        {composing ? <label><span className={styles.sectionTitle}>{label}</span><textarea aria-label={label} rows={Math.max(3, shown[key].length + 1)} disabled={busy} value={shown[key].join('\n')} onChange={e => setSummary({ ...shown, [key]: e.target.value.split('\n') })} /></label> : <><h4>{label}</h4>{shown[key].length ? <ul>{shown[key].map((line, i) => <li key={i}>{line}</li>)}</ul> : <p className={styles.empty}>None recorded.</p>}</>}
      </section>)}
      {composing && <div className={styles.actions}><button className="btn" disabled={busy || !canDraft} onClick={() => void save()}>{busy ? 'Sending…' : 'Send for confirmation'}</button>{latest && <button className="btn-link" disabled={busy} onClick={() => setEditing(false)}>Cancel edits</button>}</div>}
      {!composing && latest && <section className={styles.section}>
        <h4>Confirmation records</h4><p className={styles.empty}>Recorded, not identity-verified.</p>
        {[{ role: 'Freelancer', record: latest.ownerConfirmation }, { role: 'Client', record: latest.clientConfirmation }].map(({ role, record }) => <p className={styles.record} key={role}><span className="meta">{role}</span>{record ? <><strong>{record.name}</strong><time dateTime={record.at}>{new Date(record.at).toLocaleString()}</time></> : <span>Waiting for confirmation</span>}</p>)}
        {!agreed && view?.current && !mine && <form className={styles.confirm} onSubmit={e => { e.preventDefault(); void confirm() }}><label>Your name<input required maxLength={120} autoComplete="name" value={name} onChange={e => setName(e.target.value)} disabled={busy} /></label><p>You are confirming the exact scope saved as v{latest.version}.</p><button className="btn" disabled={busy || !name.trim()}>{busy ? 'Recording…' : `Confirm scope v${latest.version}`}</button></form>}
        {!agreed && mine && view?.current && <p className={styles.notice}>Your confirmation of v{latest.version} is recorded. Waiting for {session.other.name}.</p>}
      </section>}
    </article>}
    {owner && latest && !agreed && !composing && <button className="btn btn-outline" disabled={busy || !canDraft} onClick={() => void edit()}>{view?.current ? 'Edit as a new version' : 'Prepare updated version'}</button>}
    {agreed && <div className={styles.actions}><button className="btn" disabled={busy} onClick={() => void download()}>{busy ? 'Downloading…' : 'Download Markdown'}</button><p className="meta">v{view?.agreedVersion} · locked after both confirmations</p></div>}
  </section>
}
