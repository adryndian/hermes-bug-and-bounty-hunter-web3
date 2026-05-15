import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Bounty, Analysis, Draft, DraftWorkspace, DraftStep, DraftStepStatus, KanbanStatus, Tab, SortMode, ChatMessage, ChatModel } from '../types'

interface BountyStore {
  // Data
  bounties: Bounty[]
  analysis: Record<string, Analysis>
  statuses: Record<string, KanbanStatus>
  bookmarks: string[]
  drafts: Record<string, Draft>
  analyzingIds: string[]

  // UI
  currentTab: Tab
  sortMode: SortMode
  chatOpen: boolean
  chatMessages: ChatMessage[]
  chatModel: ChatModel
  chatLoading: boolean
  analyzeModalOpen: boolean
  analyzeModalBountyId: string | null
  analyzeLoading: boolean

  // Actions
  setTab: (tab: Tab) => void
  setSort: (sort: SortMode) => void
  setBounties: (bounties: Bounty[]) => void
  setAnalysis: (analysis: Record<string, Analysis>) => void
  setStatuses: (statuses: Record<string, KanbanStatus>) => void
  setBookmarks: (bookmarks: string[]) => void
  toggleBookmark: (id: string) => void
  setStatus: (id: string, status: KanbanStatus | 'none') => void
  removeStatus: (id: string) => void

  // Context attachment
  attachedBounty: string | null
  attachBounty: (id: string) => void
  detachBounty: () => void

  // Draft
  setDraft: (id: string, draft: Draft) => void
  toggleDraftTask: (id: string, idx: number) => void
  removeDraft: (id: string) => void
  initWorkspace: (id: string) => void
  setWorkspaceStep: (id: string, step: DraftStep) => void
  setWorkspaceStepStatus: (id: string, step: DraftStep, status: DraftStepStatus) => void
  setWorkspaceResearch: (id: string, research: DraftWorkspace['research']) => void
  setWorkspaceDraftText: (id: string, text: string) => void
  setWorkspaceVerification: (id: string, verification: DraftWorkspace['verification']) => void
  setWorkspaceRecommendations: (id: string, recs: string[]) => void

  // Analyze tracking
  startAnalyzing: (id: string) => void
  stopAnalyzing: (id: string) => void

  // Chat
  toggleChat: () => void
  setChatModel: (model: ChatModel) => void
  addChatMessage: (msg: ChatMessage) => void
  setChatLoading: (loading: boolean) => void
  clearChat: () => void

  // Analyze modal
  openAnalyzeModal: (id: string) => void
  closeAnalyzeModal: () => void
  setAnalyzeLoading: (loading: boolean) => void

  // Toast
  toast: { message: string; bountyId?: string; type: 'success' | 'error' | 'info' } | null
  showToast: (message: string, type?: 'success' | 'error' | 'info', bountyId?: string) => void
  hideToast: () => void

  // Filters
  filterCategory: string[]
  filterType: string[]
  filterVerdict: string[]
  filterRewardMin: number | null
  filterRewardMax: number | null
  setFilterCategory: (values: string[]) => void
  setFilterType: (values: string[]) => void
  setFilterVerdict: (values: string[]) => void
  setFilterRewardMin: (value: number | null) => void
  setFilterRewardMax: (value: number | null) => void
  clearFilters: () => void
}

export const useStore = create<BountyStore>()(persist((set) => ({
  // Data
  bounties: [],
  analysis: {},
  statuses: {},
  bookmarks: [],
  drafts: JSON.parse(localStorage.getItem('bounty-drafts') || '{}'),
  analyzingIds: [],

  // UI
  currentTab: 'all',
  sortMode: 'reward-desc',
  chatOpen: false,
  chatMessages: [{ role: 'assistant', content: 'Hai! Tanya soal bounty — analisa, strategi, skill yang dibutuhkan.' }],
  chatModel: 'kr/claude-opus-4.6',
  chatLoading: false,
  analyzeModalOpen: false,
  analyzeModalBountyId: null,
  analyzeLoading: false,

  // Actions
  setTab: (tab) => set({ currentTab: tab }),
  setSort: (sortMode) => set({ sortMode }),
  setBounties: (bounties) => set({ bounties }),
  setAnalysis: (analysis) => set({ analysis }),
  setStatuses: (statuses) => set({ statuses }),
  setBookmarks: (bookmarks) => set({ bookmarks }),

  toggleBookmark: (id) => set((s) => {
    const next = s.bookmarks.includes(id)
      ? s.bookmarks.filter(b => b !== id)
      : [...s.bookmarks, id]
    fetch('/db/bookmark', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ bounty_id: id })
    }).catch(() => {})
    return { bookmarks: next }
  }),

  setStatus: (id, status) => set((s) => {
    if (status === 'none') {
      const { [id]: _, ...rest } = s.statuses
      fetch('/db/status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bounty_id: id, status: 'none' })
      }).catch(() => {})
      return { statuses: rest }
    }
    fetch('/db/status', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ bounty_id: id, status })
    }).catch(() => {})
    // Auto-init workspace when moving to interested (if draft exists but no workspace)
    const drafts = { ...s.drafts }
    if (status === 'draft' && drafts[id] && !drafts[id].workspace) {
      const workspace: DraftWorkspace = {
        currentStep: 'research',
        steps: { research: 'active', generate: 'locked', execute: 'locked', review: 'locked', finalize: 'locked', submit: 'locked' },
        research: null,
        draftText: '',
        verification: null,
        recommendations: [],
        updatedAt: new Date().toISOString(),
      }
      drafts[id] = { ...drafts[id], workspace }
      localStorage.setItem('bounty-drafts', JSON.stringify(drafts))
    }
    return { statuses: { ...s.statuses, [id]: status }, drafts }
  }),

  removeStatus: (id) => set((s) => {
    const { [id]: _, ...rest } = s.statuses
    fetch('/db/status', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ bounty_id: id, status: 'none' })
    }).catch(() => {})
    return { statuses: rest }
  }),

  // Context attachment
  attachedBounty: null,
  attachBounty: (id) => set({ attachedBounty: id, chatOpen: true }),
  detachBounty: () => set({ attachedBounty: null }),

  // Draft
  setDraft: (id, draft) => set((s) => {
    const next = { ...s.drafts, [id]: draft }
    localStorage.setItem('bounty-drafts', JSON.stringify(next))
    // Also sync analysis state so cards show score/verdict immediately
    const analysisUpdate = { ...s.analysis, [id]: {
      match_score: draft.match_score,
      difficulty: draft.difficulty,
      time_estimate: draft.time_estimate,
      summary: draft.summary,
      strategy: draft.strategy,
      skills_needed: draft.skills_needed,
      verdict: draft.verdict,
    }}
    return { drafts: next, analysis: analysisUpdate }
  }),

  toggleDraftTask: (id, idx) => set((s) => {
    const draft = s.drafts[id]
    if (!draft) return s
    const checked = [...draft.checked]
    checked[idx] = !checked[idx]
    const next = { ...s.drafts, [id]: { ...draft, checked } }
    localStorage.setItem('bounty-drafts', JSON.stringify(next))
    return { drafts: next }
  }),

  removeDraft: (id) => set((s) => {
    const { [id]: _, ...rest } = s.drafts
    localStorage.setItem('bounty-drafts', JSON.stringify(rest))
    return { drafts: rest }
  }),

  initWorkspace: (id) => set((s) => {
    const draft = s.drafts[id]
    if (!draft) return s
    const workspace: DraftWorkspace = {
      currentStep: 'research',
      steps: { research: 'active', generate: 'locked', execute: 'locked', review: 'locked', finalize: 'locked', submit: 'locked' },
      research: null,
      draftText: '',
      verification: null,
      recommendations: [],
      updatedAt: new Date().toISOString(),
    }
    const next = { ...s.drafts, [id]: { ...draft, workspace } }
    localStorage.setItem('bounty-drafts', JSON.stringify(next))
    return { drafts: next }
  }),

  setWorkspaceStep: (id, step) => set((s) => {
    const draft = s.drafts[id]
    if (!draft?.workspace) return s
    const ws = { ...draft.workspace, currentStep: step, updatedAt: new Date().toISOString() }
    const next = { ...s.drafts, [id]: { ...draft, workspace: ws } }
    localStorage.setItem('bounty-drafts', JSON.stringify(next))
    return { drafts: next }
  }),

  setWorkspaceStepStatus: (id, step, status) => set((s) => {
    const draft = s.drafts[id]
    if (!draft?.workspace) return s
    const steps = { ...draft.workspace.steps, [step]: status }
    const ws = { ...draft.workspace, steps, updatedAt: new Date().toISOString() }
    const next = { ...s.drafts, [id]: { ...draft, workspace: ws } }
    localStorage.setItem('bounty-drafts', JSON.stringify(next))
    return { drafts: next }
  }),

  setWorkspaceResearch: (id, research) => set((s) => {
    const draft = s.drafts[id]
    if (!draft?.workspace) return s
    const ws = { ...draft.workspace, research, updatedAt: new Date().toISOString() }
    const next = { ...s.drafts, [id]: { ...draft, workspace: ws } }
    localStorage.setItem('bounty-drafts', JSON.stringify(next))
    return { drafts: next }
  }),

  setWorkspaceDraftText: (id, text) => set((s) => {
    const draft = s.drafts[id]
    if (!draft?.workspace) return s
    const ws = { ...draft.workspace, draftText: text, updatedAt: new Date().toISOString() }
    const next = { ...s.drafts, [id]: { ...draft, workspace: ws } }
    localStorage.setItem('bounty-drafts', JSON.stringify(next))
    return { drafts: next }
  }),

  setWorkspaceVerification: (id, verification) => set((s) => {
    const draft = s.drafts[id]
    if (!draft?.workspace) return s
    const ws = { ...draft.workspace, verification, updatedAt: new Date().toISOString() }
    const next = { ...s.drafts, [id]: { ...draft, workspace: ws } }
    localStorage.setItem('bounty-drafts', JSON.stringify(next))
    return { drafts: next }
  }),

  setWorkspaceRecommendations: (id, recommendations) => set((s) => {
    const draft = s.drafts[id]
    if (!draft?.workspace) return s
    const ws = { ...draft.workspace, recommendations, updatedAt: new Date().toISOString() }
    const next = { ...s.drafts, [id]: { ...draft, workspace: ws } }
    localStorage.setItem('bounty-drafts', JSON.stringify(next))
    return { drafts: next }
  }),

  // Analyze tracking
  startAnalyzing: (id) => set((s) => ({
    analyzingIds: [...s.analyzingIds.filter(x => x !== id), id]
  })),
  stopAnalyzing: (id) => set((s) => ({
    analyzingIds: s.analyzingIds.filter(x => x !== id)
  })),

  // Chat
  toggleChat: () => set((s) => ({ chatOpen: !s.chatOpen })),
  setChatModel: (chatModel) => set({ chatModel }),
  addChatMessage: (msg) => set((s) => ({ chatMessages: [...s.chatMessages, msg] })),
  setChatLoading: (chatLoading) => set({ chatLoading }),
  clearChat: () => set({ chatMessages: [{ role: 'assistant', content: 'Hai! Tanya soal bounty — analisa, strategi, skill yang dibutuhkan.' }] }),

  // Analyze modal
  openAnalyzeModal: (id) => set({ analyzeModalOpen: true, analyzeModalBountyId: id, analyzeLoading: true }),
  closeAnalyzeModal: () => set({ analyzeModalOpen: false, analyzeModalBountyId: null, analyzeLoading: false }),
  setAnalyzeLoading: (analyzeLoading) => set({ analyzeLoading }),

  // Toast
  toast: null as { message: string; bountyId?: string; type: 'success' | 'error' | 'info' } | null,
  showToast: (message: string, type: 'success' | 'error' | 'info' = 'info', bountyId?: string) => set({ toast: { message, bountyId, type } }),
  hideToast: () => set({ toast: null }),

  // Filters
  filterCategory: [],
  filterType: [],
  filterVerdict: [],
  filterRewardMin: null,
  filterRewardMax: null,
  setFilterCategory: (values) => set({ filterCategory: values }),
  setFilterType: (values) => set({ filterType: values }),
  setFilterVerdict: (values) => set({ filterVerdict: values }),
  setFilterRewardMin: (value) => set({ filterRewardMin: value }),
  setFilterRewardMax: (value) => set({ filterRewardMax: value }),
  clearFilters: () => set({
    filterCategory: [],
    filterType: [],
    filterVerdict: [],
    filterRewardMin: null,
    filterRewardMax: null,
  }),
}),
  {
    name: 'bounty-chat',
    partialize: (state) => ({
      chatMessages: state.chatMessages,
      chatModel: state.chatModel,
    }),
  }
))
