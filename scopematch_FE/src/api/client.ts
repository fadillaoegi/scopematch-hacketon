// HTTP adapter: this is the only layer that knows fetch, bearer headers,
// HTTP status codes, and endpoint paths. main.tsx injects it into presentation.
import type { Answer, Card, NewProject, ProposalInput, ScopeView, Session, Summary } from '../domain/models'
import type { ProjectGateway } from '../application/projectGateway'
import { GatewayError } from '../application/errors'

async function request<T>(method: string, path: string, token?: string, body?: unknown): Promise<T> {
  const headers: Record<string, string> = {}
  if (token) headers.Authorization = `Bearer ${token}`
  if (body !== undefined) headers['Content-Type'] = 'application/json'
  let res: Response
  try {
    res = await fetch(path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) })
  } catch {
    throw new GatewayError('network')
  }
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new GatewayError(data.error ?? 'unknown', data.fields)
  return data as T
}

export const api: ProjectGateway = {
  createProject: (p: NewProject) => request<{ ownerToken: string }>('POST', '/api/projects', undefined, p),
  library: () => request<{ cards: Card[] }>('GET', '/api/library'),
  session: (token: string) => request<Session>('GET', '/api/session', token),
  setCards: (token: string, cardIds: string[]) => request<Session>('PUT', '/api/project/cards', token, { cardIds }),
  suggestCards: (token: string) => request<{ suggestions: Card[] }>('POST', '/api/project/suggestions', token),
  addCustomCard: (token: string, card: Card) => request<Session>('POST', '/api/project/custom-cards', token, { card }),
  lock: (token: string) => request<{ clientToken: string }>('POST', '/api/project/lock', token),
  saveAnswers: (token: string, answers: Answer[]) => request<Session>('PUT', '/api/answers', token, { answers }),
  scope: (token: string) => request<ScopeView>('GET', '/api/scope', token),
  draft: (token: string) => request<{ summary: Summary }>('GET', '/api/scope/draft', token),
  saveVersion: (token: string, summary: Summary) => request<{ version: number }>('POST', '/api/scope/versions', token, { summary }),
  confirmVersion: (token: string, version: number, name: string) => request<{ version: number; agreed: boolean }>('POST', `/api/scope/versions/${version}/confirm`, token, { name }),
  download: async (token: string) => {
    const res = await fetch('/api/scope/export.md', { headers: { Authorization: `Bearer ${token}` } })
    if (!res.ok) throw new GatewayError((await res.json()).error)
    return { contents: await res.text(), filename: res.headers.get('Content-Disposition')?.match(/filename="?([^";]+)/)?.[1] ?? 'scopematch.md' }
  },
  propose: (token: string, cardId: string, input: ProposalInput) => request<Session>('POST', `/api/cards/${encodeURIComponent(cardId)}/proposals`, token, input),
  confirmProposal: (token: string, id: string) => request<Session>('POST', `/api/proposals/${encodeURIComponent(id)}/confirm`, token),
  submitAnswers: (token: string) => request<Session>('POST', '/api/answers/submit', token),
}
