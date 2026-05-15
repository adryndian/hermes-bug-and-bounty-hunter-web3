export interface Bounty {
  id: string
  source: string
  title: string
  reward: string
  reward_usd: number
  deadline: string
  url: string
  sponsor: string
  type: string
  category: string
}

export interface Analysis {
  match_score: number
  difficulty: string
  time_estimate: string
  summary: string
  strategy: string
  skills_needed: string[]
  verdict: 'recommended' | 'possible' | 'skip'
}

export interface DeepAnalysis extends Analysis {
  about: string
  mission: string
  scope: string
  submission_requirements: string
  judging_criteria: string
  tasks: string[]
}

export interface DraftResearch {
  scope: string
  requirements: string[]
  deliverables: string[]
  judging_criteria: string[]
  relevant_links: string[]
  skill_match: string
  difficulty: string
  estimated_hours: number
  key_challenges: string[]
  recommended_approach: string
}

export interface DraftVerification {
  score: number
  checklist: { item: string; met: boolean; note: string }[]
  suggestions: string[]
  missing: string[]
  ready_to_submit: boolean
}

export type DraftStep = 'research' | 'generate' | 'execute' | 'review' | 'finalize' | 'submit'
export type DraftStepStatus = 'locked' | 'active' | 'loading' | 'done' | 'error'

export interface DraftWorkspace {
  // Step states
  currentStep: DraftStep
  steps: Record<DraftStep, DraftStepStatus>
  // Data per step
  research: DraftResearch | null
  draftText: string
  verification: DraftVerification | null
  // Manual recommendations
  recommendations: string[]
  // Metadata
  updatedAt: string
}

export interface Draft extends DeepAnalysis {
  checked: boolean[]
  workspace?: DraftWorkspace
}

export type KanbanStatus = 'draft' | 'in_progress' | 'todo' | 'ready' | 'submitted' | 'won' | 'lost' | 'archived'

export type Tab = 'all' | 'search' | 'superteam' | 'code4rena' | 'immunefi' | 'sherlock' | 'bookmarks' | 'draft' | 'kanban'

export type SortMode = 'reward-desc' | 'reward-asc' | 'deadline' | 'source'

export interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

export interface UserProfile {
  skills: string[]
  experience_level: 'beginner' | 'intermediate' | 'advanced'
  languages: string[]
  focus_areas: string[]
  notes: string
}

export type ChatModel =
  | 'kr/claude-opus-4.7'
  | 'kr/claude-opus-4.6'
  | 'kr/claude-sonnet-4.6'
  | 'kr/claude-sonnet-4.5'
  | 'fireworks/accounts/fireworks/models/deepseek-v4-pro'
  | 'fireworks/accounts/fireworks/models/kimi-k2p6'
  | 'fireworks/accounts/fireworks/models/minimax-m2p7'
  | 'hermes:cx/gpt-5.5'
  | 'hermes:cx/gpt-5.4'
  | 'hermes:cx/gpt-5.3-codex-high'
  | 'hermes:cx/gpt-5.3-codex-xhigh'
