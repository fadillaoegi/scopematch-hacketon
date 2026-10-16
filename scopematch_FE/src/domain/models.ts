// Framework-independent ScopeMatch models. Runtime transport is implemented by adapters.

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
  /** 'ai' for a project-specific card suggested by AI and accepted by the freelancer. */
  source?: 'ai'
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
  customCards: Card[]
  aiSuggestions?: boolean
  me: Party
  other: Party
  scope?: ScopeState
  compare?: Comparison[]
  counts?: { total: number; decided: number; same: number; discussion: number; clarification: number }
}

export type CompareStatus = 'same_answer' | 'needs_discussion' | 'needs_clarification' | 'decided'
export interface Proposal {
  id: string; cardId: string; proposedBy: Role | 'system'; optionId: string; customText?: string; why?: string
  ownerConfirmedAt?: string; clientConfirmedAt?: string; createdAt: string
}
export interface Comparison { cardId: string; status: CompareStatus; proposal?: Proposal; history?: Proposal[] }
export interface ProposalInput { optionId: string; customText?: string; why?: string }

export interface Summary {
  included: string[]; excluded: string[]; clientResponsibilities: string[]; acceptanceCriteria: string[]; openQuestions: string[]
}
export interface Decision { cardId: string; number: number; title: string; label: string; proposalId: string }
export interface Confirmation { name: string; at: string }
export interface ScopeVersion {
  version: number; summary: Summary; decisions: Decision[]; createdAt: string
  ownerConfirmation?: Confirmation; clientConfirmation?: Confirmation
}
export interface ScopeState { latestVersion: number; agreedVersion: number; current: boolean; ownerConfirmedAt?: string; clientConfirmedAt?: string }
export interface ScopeView extends ScopeState { versions: ScopeVersion[] }

export interface NewProject {
  name: string
  freelancerName: string
  clientName: string
  brief: string
}
