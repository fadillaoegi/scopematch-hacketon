import { useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { GatewayError } from '../application/errors'
import type { Card, Session } from '../domain/models'
import { useProjectGateway } from '../lib/gateway'
import styles from './AiSuggest.module.css'

const LETTERS = 'ABC'

const MESSAGES: Record<string, string> = {
  ai_failed: "The AI service didn't answer. Try again in a minute, or carry on with the curated questions.",
  ai_unavailable: 'AI suggestions are not set up on this server.',
  suggestion_limit: "That's the limit of AI suggestions for this project.",
  custom_card_limit: 'This project already has the maximum number of added questions.',
  locked: 'Questions are locked, so nothing can be added now.',
}

// Optional AI help for briefs the curated library doesn't cover. The model only
// drafts questions; the freelancer adds or discards each one, and the server
// validates it again. Nothing is sent until the button is pressed.
export function AiSuggest({ token, onAdded }: { token: string; onAdded: (s: Session) => void }) {
  const api = useProjectGateway()
  const reduced = useReducedMotion()
  const [drafts, setDrafts] = useState<Card[] | null>(null)
  const [loading, setLoading] = useState(false)
  const [adding, setAdding] = useState('')
  const [message, setMessage] = useState('')

  const explain = (e: unknown) => setMessage(MESSAGES[e instanceof GatewayError ? e.code : ''] ?? "Something went wrong. Your questions are unchanged.")

  async function suggest() {
    setLoading(true); setMessage('')
    try {
      const { suggestions } = await api.suggestCards(token)
      setDrafts(suggestions)
      if (!suggestions.length) setMessage("AI found nothing the current questions don't already cover.")
    } catch (e) { explain(e) }
    finally { setLoading(false) }
  }
  async function add(card: Card) {
    setAdding(card.id); setMessage('')
    try {
      onAdded(await api.addCustomCard(token, card))
      setDrafts(d => d?.filter(x => x.id !== card.id) ?? null)
    } catch (e) { explain(e) }
    finally { setAdding('') }
  }

  return <section className={styles.panel} aria-labelledby="ai-heading">
    <div className={styles.head}>
      <span className={styles.badge}>AI · optional</span>
      <h3 id="ai-heading">Not covered by these questions?</h3>
      <p>AI can draft up to three more questions from the brief. You review each one before it joins the project — AI never answers or decides anything.</p>
    </div>

    {!loading && <div className={styles.actions}>
      <button className="btn btn-outline" onClick={() => void suggest()}>{drafts ? 'Suggest again' : 'Suggest questions with AI'}</button>
    </div>}
    {loading && <p className={styles.loading} role="status">
      <span className={styles.dots} aria-hidden>{[0, 1, 2].map(i => <motion.i key={i} animate={reduced ? undefined : { y: [0, -5, 0], opacity: [0.35, 1, 0.35] }} transition={{ duration: 0.9, repeat: Infinity, delay: i * 0.15 }} />)}</span>
      Reading the brief…
    </p>}
    <p className={styles.privacy}>Pressing the button sends the brief text to Google Gemini. On Gemini’s free tier, Google may use it to improve its products.</p>
    {message && <p className={styles.message} role="status">{message}</p>}

    <AnimatePresence initial={false}>
      {drafts?.map(card => <motion.article key={card.id} className={styles.draft} layout initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, x: 24 }} transition={{ duration: reduced ? 0 : 0.35, ease: [0.22, 1, 0.36, 1] }}>
        <p className="meta">Suggested by AI · review before adding</p>
        <span className={styles.title}>{card.title}</span>
        <h4>{card.question}</h4>
        <ol>{card.options.map((o, i) => <li key={o.id}><span>{LETTERS[i]}</span><div>
          <p>{o.label}</p>
          <details className={styles.optionDetails}>
            <summary>Review scope details for option {LETTERS[i]}</summary>
            {[
              { label: 'Included', items: o.included },
              { label: 'Excluded', items: o.excluded },
              { label: 'Client responsibilities', items: o.clientResponsibilities },
              { label: 'Acceptance criteria', items: o.acceptanceCriteria },
            ].map(({ label, items }) => <div key={label}><strong>{label}</strong>{items.length ? <ul>{items.map((line, n) => <li key={n}>{line}</li>)}</ul> : <p>None suggested.</p>}</div>)}
          </details>
        </div></li>)}</ol>
        <div className={styles.draftActions}>
          <button className="btn" disabled={!!adding} onClick={() => void add(card)}>{adding === card.id ? 'Adding…' : 'Add to questions'}</button>
          <button className="btn-link" disabled={!!adding} onClick={() => setDrafts(d => d?.filter(x => x.id !== card.id) ?? null)}>Discard</button>
        </div>
      </motion.article>)}
    </AnimatePresence>
  </section>
}
