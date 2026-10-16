import { useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { useProjectGateway } from '../lib/gateway'
import type { Card, Comparison, Proposal, Session } from '../domain/models'
import styles from './ProposalBox.module.css'

export function ProposalBox({ token, session, card, comparison, onUpdate }: {
  token: string; session: Session; card: Card; comparison: Comparison; onUpdate: (s: Session) => void
}) {
  const api = useProjectGateway()
  const p = comparison.proposal
  const [editing, setEditing] = useState(false)
  const [optionId, setOptionId] = useState('b')
  const [customText, setCustomText] = useState('')
  const [why, setWhy] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const reduced = useReducedMotion()
  const mine = session.role === 'owner' ? p?.ownerConfirmedAt : p?.clientConfirmedAt
  const label = p?.optionId === 'other' ? p.customText : card.options.find(o => o.id === p?.optionId)?.label
  const agreed = session.stage === 'agreed'
  const history = comparison.history ?? []
  const who = (by: Proposal['proposedBy']) => by === 'owner' ? session.project.freelancerName : by === 'client' ? session.project.clientName : 'Shared answer'
  const labelOf = (x: Proposal) => x.optionId === 'other' ? x.customText : card.options.find(o => o.id === x.optionId)?.label
  async function act(propose: boolean) {
    setBusy(true); setError('')
    try {
      onUpdate(propose ? await api.propose(token, card.id, { optionId, customText, why }) : await api.confirmProposal(token, p!.id))
      setEditing(false)
    } catch { setError('The decision may have changed. Review the latest proposal and try again.') }
    finally { setBusy(false) }
  }
  return <section className={styles.box} aria-label={`Decision for ${card.title}`}>
    {history.length > 0 && <ol className={styles.history} aria-label="Earlier proposals, oldest first">
      <AnimatePresence initial={false}>
        {history.map(h => <motion.li key={h.id} className={styles[`by_${h.proposedBy}`]} initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} transition={{ duration: reduced ? 0 : .35, ease: [.22, 1, .36, 1] }}>
          <span className={styles.dot} aria-hidden />
          <span className={styles.step}>
            <span className="meta">{h.proposedBy === 'system' ? 'Shared answer' : `${who(h.proposedBy)} proposed`} · replaced</span>
            <s>{labelOf(h)}</s>
            {h.why && <q>{h.why}</q>}
          </span>
        </motion.li>)}
      </AnimatePresence>
    </ol>}
    <AnimatePresence mode="wait" initial={false}>
      <motion.div key={p?.id ?? 'none'} initial={{ opacity: 0, x: reduced ? 0 : 12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: reduced ? 0 : -12, textDecoration: 'line-through' }} transition={{ duration: .18 }}>
        {p ? <>
          <p className="meta">{comparison.status === 'decided' ? 'Decision confirmed by both' : p.proposedBy === 'system' ? 'Shared answer · confirm as your decision' : `Proposed by ${p.proposedBy === 'owner' ? session.project.freelancerName : session.project.clientName}`}</p>
          <h4>{label}</h4>
          {p.why && <p className={styles.why}>{p.why}</p>}
          <div className={styles.signatures}><span className="ink-freelancer">{p.ownerConfirmedAt ? '✓' : '○'} {session.project.freelancerName}</span><span className="ink-client">{p.clientConfirmedAt ? '✓' : '○'} {session.project.clientName}</span></div>
        </> : <><p className="meta">Turn the difference into a decision</p><p>Propose what this project will include. The other person can confirm or suggest a different answer.</p></>}
      </motion.div>
    </AnimatePresence>
    {!agreed && !editing && <div className={styles.actions}>
      {p && !mine && <button className="btn" disabled={busy} onClick={() => void act(false)}>{busy ? 'Confirming…' : 'Confirm decision'}</button>}
      {p && mine && comparison.status !== 'decided' && <span className="meta">Waiting for {session.other.name} to confirm</span>}
      <button className={p ? 'btn-link' : 'btn'} disabled={busy} onClick={() => { setOptionId(p?.optionId ?? 'b'); setCustomText(p?.customText ?? ''); setWhy(''); setEditing(true) }}>{p ? comparison.status === 'decided' ? 'Reopen decision' : 'Counter-propose' : 'Propose a decision'}</button>
    </div>}
    {!agreed && editing && <form className={styles.form} onSubmit={e => { e.preventDefault(); void act(true) }}>
      <fieldset disabled={busy}><legend className="meta">Choose the decision</legend>
        {[...card.options, { id: 'other', label: 'Write a custom decision' }].map(o => <label key={o.id} className={styles.option}><input type="radio" name={`proposal-${card.id}`} value={o.id} checked={optionId === o.id} onChange={() => setOptionId(o.id)} />{o.label}</label>)}
        {optionId === 'other' && <label>Custom decision<textarea required maxLength={2000} rows={3} value={customText} onChange={e => setCustomText(e.target.value)} /></label>}
        <label>Why this works for the project <span className="meta">optional</span><textarea maxLength={1000} rows={2} value={why} onChange={e => setWhy(e.target.value)} /></label>
        {p && <p className={styles.why}>Sending a new proposal replaces the current decision. Both of you will need to confirm it again.</p>}
        <div className={styles.actions}><button className="btn" disabled={optionId === 'other' && !customText.trim()}>{busy ? 'Sending…' : 'Send proposal'}</button><button type="button" className="btn-link" onClick={() => setEditing(false)}>Cancel</button></div>
      </fieldset>
    </form>}
    {error && <p role="alert" className={styles.error}>{error}</p>}
  </section>
}
