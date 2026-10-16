import { useState } from 'react'
import type { Session } from '../domain/models'
import { ownerLink } from '../lib/projects'
import styles from './LinksPanel.module.css'

export function LinksPanel({ token, clientToken, session }: { token: string; clientToken: string; session: Session }) {
  const [copied, setCopied] = useState('')
  const [error, setError] = useState('')
  async function copy(label: string, url: string) {
    try {
      await navigator.clipboard.writeText(url)
      setCopied(label)
      setError('')
    } catch { setError('Select the link above and copy it manually.') }
  }
  const clientURL = `${window.location.origin}/c/${clientToken}`
  const { clientName, freelancerName, name } = session.project
  const n = session.cards.length
  const intro = `Hi ${clientName}! Before I start on "${name}", could you answer ${n} quick ${n === 1 ? 'question' : 'questions'} about what you have in mind? It takes about 2 minutes and needs no account. Your answers stay private until we've both answered — then we compare and agree on the scope together.`
  const message = `${intro}\n\n${clientURL}\n\n— ${freelancerName}`
  return <section className={styles.panel} aria-label="Project links">
    <p className="meta">Questions locked · two private links</p>
    <h2>One link for each side.</h2>
    <p>Save your freelancer link — it’s the only way back in. Send only the client link to your client.</p>
    {[
      { label: 'Freelancer — keep private', url: ownerLink(token) },
      { label: 'Client — share this', url: clientURL },
    ].map(({ label, url }) => <div className={styles.row} key={label}>
      <label className="meta">{label}<input readOnly value={url} onFocus={e => e.target.select()} /></label>
      <button className="btn btn-outline" onClick={() => void copy(label, url)}>{copied === label ? 'Copied' : 'Copy link'}</button>
    </div>)}
    <div className={styles.invite}>
      <p className="meta">Ready-to-send message for {clientName}</p>
      <blockquote className={styles.message}>{intro}<span className={styles.link} data-secret>{clientURL}</span><span>— {freelancerName}</span></blockquote>
      <div className={styles.inviteActions}>
        <a className="btn" href={`https://wa.me/?text=${encodeURIComponent(message)}`} target="_blank" rel="noopener noreferrer">Send on WhatsApp <span aria-hidden>↗</span></a>
        <button className="btn btn-outline" onClick={() => void copy('Message', message)}>{copied === 'Message' ? 'Copied' : 'Copy message'}</button>
      </div>
      <p className={styles.note}>WhatsApp opens with this message filled in; you choose the chat and press send. ScopeMatch never sends anything for you.</p>
    </div>
    {error && <p role="status">{error}</p>}
    <span aria-live="polite" className="visually-hidden">{copied && `${copied} link copied`}</span>
  </section>
}
