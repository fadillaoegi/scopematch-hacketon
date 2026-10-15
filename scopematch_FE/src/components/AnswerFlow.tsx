import { useRef, useState } from 'react'
import { useProjectGateway } from '../lib/gateway'
import { GatewayError } from '../application/errors'
import type { Answer, Card, Session } from '../domain/models'
import { SealedState } from './SealedState'
import styles from './AnswerFlow.module.css'

export function AnswerFlow({ token, session, library, onUpdate }: {
  token: string; session: Session; library: Map<string, Card>; onUpdate: (s: Session) => void
}) {
  const api = useProjectGateway()
  const [answers, setAnswers] = useState<Answer[]>(session.me.answers ?? [])
  const [page, setPage] = useState(0)
  const [saving, setSaving] = useState(false)
  const [sealing, setSealing] = useState(false)
  const [error, setError] = useState('')
  const queue = useRef<Promise<unknown>>(Promise.resolve())
  const cards = session.cards.map(c => library.get(c.id)!).filter(Boolean)
  const complete = cards.filter(c => answers.some(a => a.cardId === c.id && (a.optionId !== 'other' || a.customText?.trim()))).length

  function save(next: Answer[]) {
    const valid = next.filter(a => a.optionId !== 'other' || a.customText?.trim())
    setSaving(true)
    const work = queue.current.catch(() => {}).then(() => api.saveAnswers(token, valid))
    queue.current = work
    return work.then(s => { onUpdate(s); setError(''); return s }).catch(e => {
      setError(e instanceof GatewayError && e.code === 'sealed' ? 'These answers are already sealed. Reload to see the latest state.' : "Couldn't save your answers. Try again before leaving this page.")
      throw e
    }).finally(() => { if (queue.current === work) setSaving(false) })
  }

  function choose(cardId: string, optionId: string, customText?: string) {
    const next = [...answers.filter(a => a.cardId !== cardId), { cardId, optionId, ...(customText !== undefined ? { customText } : {}) }]
    setAnswers(next)
    if (optionId !== 'other') void save(next).catch(() => {})
  }

  async function submit() {
    setSealing(true)
    setError('')
    try {
      await save(answers)
      onUpdate(await api.submitAnswers(token))
    } catch { setError('Your answers were not sealed. Check every question and try again.') }
    finally { setSealing(false) }
  }

  if (session.me.submitted && !session.other.submitted) return <SealedState session={session} />
  return <section className={styles.flow} style={{ '--party-ink': session.role === 'owner' ? 'var(--ink-freelancer)' : 'var(--ink-client)' } as React.CSSProperties}>
    <header className={styles.intro}>
      <p className="meta">Independent answers · {complete} of {cards.length} answered</p>
      <h2>What do you have in mind?</h2>
      <p>{session.me.submitted ? 'Your sealed answers are recorded below. Both sets of answers are now available in Compare.' : <>Choose what you imagine this project includes. {session.other.name} will answer the same questions separately.</>}</p>
    </header>
    <div className={styles.questions}>
      {cards.map((card, index) => {
        const answer = answers.find(a => a.cardId === card.id)
        return <fieldset key={card.id} disabled={saving || sealing || session.me.submitted} className={`${styles.question} ${index === page ? styles.visible : ''}`}>
          <legend><span className="meta">§ {card.number} · {card.title}</span><span className={styles.questionTitle}>{card.question}</span></legend>
          {[...card.options.map((o, i) => ({ ...o, letter: 'ABCDEF'[i] })), { id: 'other', label: 'Something else', letter: '+' }, { id: 'unsure', label: 'Not sure yet', letter: '?' }].map(option => <label key={option.id} className={`${styles.option} ${answer?.optionId === option.id ? styles.selected : ''}`}>
            <input type="radio" name={card.id} value={option.id} checked={answer?.optionId === option.id} onChange={() => choose(card.id, option.id)} />
            <span className={styles.letter}>{option.letter}</span><span>{option.label}</span>
          </label>)}
          {answer?.optionId === 'other' && <label className={styles.custom}>Describe what you mean
            <textarea maxLength={2000} rows={3} value={answer.customText ?? ''} onChange={e => choose(card.id, 'other', e.target.value)} onBlur={() => void save(answers).catch(() => {})} placeholder="What would the customer or client be able to do?" />
          </label>}
        </fieldset>
      })}
    </div>
    <nav className={styles.paging} aria-label="Answer questions">
      <button className="btn btn-outline" disabled={page === 0 || saving || sealing} onClick={() => setPage(p => p - 1)}>Previous</button>
      <span className="meta">{page + 1} of {cards.length}</span>
      <button className="btn btn-outline" disabled={page === cards.length - 1 || saving || sealing} onClick={() => setPage(p => p + 1)}>Next</button>
    </nav>
    <footer className={styles.footer}>
      <p>{session.me.submitted ? 'Sealed answers cannot be changed.' : 'Submitting seals your choices. You can change them until then.'}</p>
      {error && <p className={styles.error} role="alert">{error}</p>}
      {!session.me.submitted && <><button className="btn" disabled={complete !== cards.length || saving || sealing} onClick={() => void submit()}>{sealing ? 'Sealing…' : 'Seal my answers'}</button><span className="meta" role="status">{saving ? 'Saving…' : 'Choices save automatically'}</span></>}
    </footer>
  </section>
}
