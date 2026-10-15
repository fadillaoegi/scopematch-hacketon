// Typed API client. Every call that needs access carries the link token from
// the page URL as a bearer token; project IDs never appear in requests.

export type Role = 'owner' | 'client'
export type Stage = 'setup' | 'answering' | 'compare' | 'review' | 'agreed'

export interface PreviewStep {
  title: string
  body: string
}

export interface Option {
  id: string
  label: string
  included: string[]
  excluded: string[]
  clientResponsibilities: string[]
  acceptanceCriteria: string[]
  preview?: PreviewStep[]
}

export interface Card {
  id: string
  number: number
  title: string
  question: string
  keywords: string[]
  alwaysSuggest?: boolean
  options: Option[]
}

export interface Match {
  cardId: string
  phrase: string
  start: number
  end: number
  sentence: string
}

export interface CardRef {
  id: string
  match: Match | null
}

export interface Party {
  name: string
  submitted: boolean
  answers?: Answer[]
}

export interface Answer {
  cardId: string
  optionId: string
  customText?: string
}

export interface Session {
  role: Role
  stage: Stage
  project: {
    name: string
    brief: string
    freelancerName: string
    clientName: string
    locked: boolean
  }
  cards: CardRef[]
  matches: Match[]
  me: Party
  other: Party
}

export interface NewProject {
  name: string
  freelancerName: string
  clientName: string
  brief: string
}

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    public fields: Record<string, string> = {},
  ) {
    super(code)
  }
}

async function request<T>(method: string, path: string, token?: string, body?: unknown): Promise<T> {
  const headers: Record<string, string> = {}
  if (token) headers.Authorization = `Bearer ${token}`
  if (body !== undefined) headers['Content-Type'] = 'application/json'
  let res: Response
  try {
    res = await fetch(path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) })
  } catch {
    throw new ApiError(0, 'network')
  }
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new ApiError(res.status, data.error ?? 'unknown', data.fields)
  return data as T
}

export const api = {
  createProject: (p: NewProject) => request<{ ownerToken: string }>('POST', '/api/projects', undefined, p),
  library: () => request<{ cards: Card[] }>('GET', '/api/library'),
  session: (token: string) => request<Session>('GET', '/api/session', token),
  setCards: (token: string, cardIds: string[]) => request<Session>('PUT', '/api/project/cards', token, { cardIds }),
  lock: (token: string) => request<{ clientToken: string }>('POST', '/api/project/lock', token),
  saveAnswers: (token: string, answers: Answer[]) => request<Session>('PUT', '/api/answers', token, { answers }),
  submitAnswers: (token: string) => request<Session>('POST', '/api/answers/submit', token),
}
