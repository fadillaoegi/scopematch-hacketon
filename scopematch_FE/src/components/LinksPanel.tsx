import { useState } from 'react'
import { ownerLink } from '../lib/projects'
import styles from './LinksPanel.module.css'

export function LinksPanel({ token, clientToken }: { token: string; clientToken: string }) {
  const [copied, setCopied] = useState('')
  const [error, setError] = useState('')
  async function copy(label: string, url: string) {
    try {
      await navigator.clipboard.writeText(url)
      setCopied(label)
      setError('')
    } catch { setError('Select the link above and copy it manually.') }
  }
  return <section className={styles.panel} aria-label="Project links">
    <p className="meta">Questions locked · two private links</p>
    <h2>One link for each side.</h2>
    <p>Save your freelancer link — it’s the only way back in. Send only the client link to your client.</p>
    {[
      { label: 'Freelancer — keep private', url: ownerLink(token) },
      { label: 'Client — share this', url: `${window.location.origin}/c/${clientToken}` },
    ].map(({ label, url }) => <div className={styles.row} key={label}>
      <label className="meta">{label}<input readOnly value={url} onFocus={e => e.target.select()} /></label>
      <button className="btn btn-outline" onClick={() => void copy(label, url)}>{copied === label ? 'Copied' : 'Copy link'}</button>
    </div>)}
    {error && <p role="status">{error}</p>}
    <span aria-live="polite" className="visually-hidden">{copied && `${copied} link copied`}</span>
  </section>
}
