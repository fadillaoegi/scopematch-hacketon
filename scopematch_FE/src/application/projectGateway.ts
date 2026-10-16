import type { Answer, Card, NewProject, ProposalInput, ScopeView, Session, Summary } from '../domain/models'

// Application-owned port; the UI needs these actions, not a fetch client.
export interface ProjectGateway {
  createProject(input: NewProject): Promise<{ ownerToken: string }>
  library(): Promise<{ cards: Card[] }>
  session(token: string): Promise<Session>
  setCards(token: string, ids: string[]): Promise<Session>
  suggestCards(token: string): Promise<{ suggestions: Card[] }>
  addCustomCard(token: string, card: Card): Promise<Session>
  lock(token: string): Promise<{ clientToken: string }>
  saveAnswers(token: string, answers: Answer[]): Promise<Session>
  submitAnswers(token: string): Promise<Session>
  propose(token: string, card: string, input: ProposalInput): Promise<Session>
  confirmProposal(token: string, id: string): Promise<Session>
  scope(token: string): Promise<ScopeView>
  draft(token: string): Promise<{ summary: Summary }>
  saveVersion(token: string, summary: Summary): Promise<{ version: number }>
  confirmVersion(token: string, version: number, name: string): Promise<{ version: number; agreed: boolean }>
  download(token: string): Promise<{ contents: string; filename: string }>
}
