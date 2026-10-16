import { useState } from 'react'
import { useNavigate } from 'react-router'
import { useProjectGateway } from '../lib/gateway'
import { GatewayError } from '../application/errors'
import type { NewProject } from '../domain/models'
import { Masthead } from '../components/Masthead'
import { rememberProject } from '../lib/projects'
import styles from './NewProjectPage.module.css'

const EMPTY: NewProject = { name: '', freelancerName: '', clientName: '', brief: '' }

export function NewProjectPage() {
  const api = useProjectGateway()
  const navigate = useNavigate()
  const [form, setForm] = useState<NewProject>(EMPTY)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [failure, setFailure] = useState('')
  const [busy, setBusy] = useState(false)

  const set = (key: keyof NewProject) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setForm((f) => ({ ...f, [key]: e.target.value }))
    setErrors((er) => ({ ...er, [key]: '' }))
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setFailure('')
    try {
      const { ownerToken } = await api.createProject(form)
      rememberProject({ ownerToken, name: form.name.trim(), createdAt: new Date().toISOString() })
      navigate(`/o/${ownerToken}`)
    } catch (err) {
      if (err instanceof GatewayError && err.code === 'validation') setErrors(err.fields)
      else setFailure("Couldn't reach ScopeMatch. Check that the server is running, then try again.")
    } finally {
      setBusy(false)
    }
  }

  const field = (key: keyof NewProject, label: React.ReactNode, input: React.ReactNode) => (
    <div className={styles.field}>
      <label htmlFor={key} className="meta">
        {label}
      </label>
      {input}
      {errors[key] && (
        <p className={styles.error} id={`${key}-error`} role="alert">
          {errors[key]}
        </p>
      )}
    </div>
  )

  const aria = (key: keyof NewProject) => ({
    id: key,
    value: form[key],
    onChange: set(key),
    'aria-invalid': !!errors[key] || undefined,
    'aria-describedby': errors[key] ? `${key}-error` : undefined,
  })

  return (
    <>
      <Masthead meta={<span>New scope</span>} />
      <main className={styles.page}>
        <section className={styles.intro}>
          <p className="meta">Step 01 — the brief</p>
          <h1>
            Two people read the same brief.
            <br />
            <em>They rarely picture the same thing.</em>
          </h1>
          <p className={styles.lede}>
            Paste what your client sent you. You and your client each answer the same questions on your own — nobody
            sees the other's answers until both are in. Then you settle the differences before work starts.
          </p>
        </section>

        <form className={styles.form} onSubmit={submit} noValidate>
          {field('name', 'Project name', <input {...aria('name')} autoComplete="off" placeholder="Salon website" />)}
          <div className={styles.pair}>
            {field(
              'freelancerName',
              <>
                <span className={`${styles.dot} ${styles.dotFreelancer}`} aria-hidden /> Your name
              </>,
              <input {...aria('freelancerName')} autoComplete="name" placeholder="Dimas" />,
            )}
            {field(
              'clientName',
              <>
                <span className={`${styles.dot} ${styles.dotClient}`} aria-hidden /> Client's name
              </>,
              <input {...aria('clientName')} autoComplete="off" placeholder="Maya" />,
            )}
          </div>
          {field(
            'brief',
            "The client's brief, as they wrote it",
            <textarea
              {...aria('brief')}
              rows={6}
              className={styles.brief}
              placeholder="We need a salon website with booking, two languages, and editable content."
            />,
          )}

          {failure && (
            <p className={styles.error} role="alert">
              {failure}
            </p>
          )}

          <div className={styles.actions}>
            <button className="btn" type="submit" disabled={busy}>
              {busy ? 'Reading…' : 'Read the brief'} <span aria-hidden>→</span>
            </button>
          </div>
        </form>
      </main>
    </>
  )
}
