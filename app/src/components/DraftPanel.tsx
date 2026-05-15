import { useState, useEffect } from 'react'
import { useStore } from '../stores/bountyStore'
import ExecuteStep from './ExecuteStep'
import type { DraftStep } from '../types'

const STEPS: { id: DraftStep; label: string; type: 'auto' | 'manual' }[] = [
  { id: 'research', label: 'Research', type: 'auto' },
  { id: 'generate', label: 'Draft', type: 'auto' },
  { id: 'execute', label: 'Execute', type: 'manual' },
  { id: 'review', label: 'Review', type: 'manual' },
  { id: 'finalize', label: 'Finalize', type: 'manual' },
  { id: 'submit', label: 'Submit', type: 'manual' },
]

export default function DraftPanel() {
  const bounties = useStore(s => s.bounties)
  const drafts = useStore(s => s.drafts)
  const statuses = useStore(s => s.statuses)
  const initWorkspace = useStore(s => s.initWorkspace)
  const setWorkspaceStep = useStore(s => s.setWorkspaceStep)
  const setWorkspaceStepStatus = useStore(s => s.setWorkspaceStepStatus)
  const setWorkspaceResearch = useStore(s => s.setWorkspaceResearch)
  const setWorkspaceDraftText = useStore(s => s.setWorkspaceDraftText)
  const setWorkspaceVerification = useStore(s => s.setWorkspaceVerification)
  const setWorkspaceRecommendations = useStore(s => s.setWorkspaceRecommendations)
  const removeDraft = useStore(s => s.removeDraft)
  const setStatus = useStore(s => s.setStatus)
  const attachBounty = useStore(s => s.attachBounty)

  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [editingDraft, setEditingDraft] = useState<string>('')
  const [copied, setCopied] = useState(false)

  const draftEntries = Object.entries(drafts)

  // Use analysis as source of truth for sidebar list (always populated from DB)
  const analysisEntries = Object.entries(useStore(s => s.analysis))

  // Sort: newest first (reverse of DB insertion order)
  const sortedAnalysisEntries = [...analysisEntries].reverse()

  // Auto-select first entry if none selected
  useEffect(() => {
    if (!selectedId && sortedAnalysisEntries.length > 0) {
      setSelectedId(sortedAnalysisEntries[0][0])
    }
  }, [sortedAnalysisEntries.length])

  if (sortedAnalysisEntries.length === 0) {
    return (
      <div className="draft-empty">
        <div className="draft-empty-icon">⚡</div>
        <div className="draft-empty-title">No analyzed bounties yet</div>
        <div className="draft-empty-sub">Click ANALYZE on any bounty card to get an AI breakdown</div>
      </div>
    )
  }

  const selectedDraft = selectedId ? drafts[selectedId] : null
  const selectedAnalysis = selectedId ? (useStore.getState().analysis[selectedId] as any) : null
  const selectedBounty = selectedId ? bounties.find(b => b.id === selectedId) : null
  const ws = selectedDraft?.workspace

  const runResearch = async (bountyId: string) => {
    const bounty = bounties.find(b => b.id === bountyId)
    if (!bounty) return
    setWorkspaceStepStatus(bountyId, 'research', 'loading')
    try {
      const res = await fetch('/api/draft-research', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bounty })
      })
      const data = await res.json()
      if (data.ok && data.research?.structured) {
        setWorkspaceResearch(bountyId, data.research.structured)
        setWorkspaceStepStatus(bountyId, 'research', 'done')
        setWorkspaceStepStatus(bountyId, 'generate', 'active')
        setWorkspaceStepStatus(bountyId, 'execute', 'active')
        setWorkspaceStepStatus(bountyId, 'review', 'active')
        setWorkspaceStepStatus(bountyId, 'finalize', 'active')
        setWorkspaceStep(bountyId, 'generate')
        // Auto-move kanban: research done → todo
        if (statuses[bountyId] === 'draft' || statuses[bountyId] === 'none') {
          setStatus(bountyId, 'todo')
        }
      } else {
        setWorkspaceStepStatus(bountyId, 'research', 'error')
      }
    } catch {
      setWorkspaceStepStatus(bountyId, 'research', 'error')
    }
  }

  const runGenerate = async (bountyId: string) => {
    const bounty = bounties.find(b => b.id === bountyId)
    const draft = drafts[bountyId]
    if (!bounty || !draft?.workspace?.research) return
    setWorkspaceStepStatus(bountyId, 'generate', 'loading')
    try {
      const res = await fetch('/api/draft-generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bounty, research: { structured: draft.workspace.research } })
      })
      const data = await res.json()
      if (data.ok && data.draft) {
        setWorkspaceDraftText(bountyId, data.draft)
        setWorkspaceStepStatus(bountyId, 'generate', 'done')
        setWorkspaceStepStatus(bountyId, 'execute', 'active')
        setWorkspaceStep(bountyId, 'execute')
        // Auto-move kanban: generate done → in_progress
        if (statuses[bountyId] === 'todo' || statuses[bountyId] === 'draft' || statuses[bountyId] === 'none') {
          setStatus(bountyId, 'in_progress')
        }
      } else {
        setWorkspaceStepStatus(bountyId, 'generate', 'error')
      }
    } catch {
      setWorkspaceStepStatus(bountyId, 'generate', 'error')
    }
  }

  const runVerify = async (bountyId: string) => {
    const draft = drafts[bountyId]
    if (!draft?.workspace?.draftText || !draft.workspace.research) return
    setWorkspaceStepStatus(bountyId, 'finalize', 'loading')
    try {
      const res = await fetch('/api/draft-verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          draft: draft.workspace.draftText,
          research: { structured: draft.workspace.research }
        })
      })
      const data = await res.json()
      if (data.ok && data.verification) {
        setWorkspaceVerification(bountyId, data.verification)
        setWorkspaceStepStatus(bountyId, 'finalize', 'done')
        setWorkspaceStepStatus(bountyId, 'submit', 'active')
        setWorkspaceStep(bountyId, 'submit')
        // Auto-move kanban: finalize done → ready
        if (statuses[bountyId] === 'in_progress' || statuses[bountyId] === 'todo' || statuses[bountyId] === 'none') {
          setStatus(bountyId, 'ready')
        }
        // Generate recommendations
        const bounty = bounties.find(b => b.id === bountyId)
        const recs = [
          `Open ${bounty?.source} and navigate to: ${bounty?.url}`,
          'Paste your submission draft into the submission form',
          'Double-check all links and references are valid',
          'Review the deadline and submit before it expires',
        ]
        if (bounty?.source === 'Superteam') {
          recs.push('Make sure your Superteam Earn profile is complete')
        }
        if (bounty?.source === 'Immunefi' || bounty?.source === 'Sherlock') {
          recs.push('Include PoC code or detailed reproduction steps')
          recs.push('Classify severity level accurately')
        }
        setWorkspaceRecommendations(bountyId, recs)
      } else {
        setWorkspaceStepStatus(bountyId, 'finalize', 'error')
      }
    } catch {
      setWorkspaceStepStatus(bountyId, 'finalize', 'error')
    }
  }

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleSelect = (bountyId: string) => {
    // Create draft entry if needed (from analysis)
    if (!drafts[bountyId]) {
      const a = useStore.getState().analysis[bountyId] as any
      if (a) {
        useStore.getState().setDraft(bountyId, {
          match_score: a.match_score,
          difficulty: a.difficulty,
          time_estimate: a.time_estimate,
          summary: a.summary,
          strategy: a.strategy,
          skills_needed: a.skills_needed,
          verdict: a.verdict,
          tasks: a.tasks || [],
        })
      }
    }
    if (drafts[bountyId] && !drafts[bountyId]?.workspace) {
      initWorkspace(bountyId)
    }
    // Ensure bounty has valid kanban status so auto-move triggers work
    const validKanbanStatuses = ['draft', 'todo', 'in_progress', 'ready', 'submitted', 'won', 'lost', 'archived']
    if (!statuses[bountyId] || !validKanbanStatuses.includes(statuses[bountyId])) {
      setStatus(bountyId, 'draft')
    }
    setSelectedId(bountyId)
  }

  const handleMarkSubmitted = (bountyId: string) => {
    setStatus(bountyId, 'submitted')
  }

  return (
    <div className="workspace-layout">
      {/* Left sidebar: bounty list */}
      <div className="workspace-sidebar">
        <div className="ws-sidebar-header">
          <span className="ws-sidebar-title">BOUNTIES</span>
          <span className="ws-sidebar-count">{sortedAnalysisEntries.length}</span>
        </div>
        <div className="ws-sidebar-list">
          {sortedAnalysisEntries.map(([bountyId, anal]) => {
            const bounty = bounties.find(b => b.id === bountyId)
            const a = anal as any
            const score = a.match_score || 0
            const scoreColor = score >= 7 ? 'var(--green)' : score >= 4 ? 'var(--yellow)' : 'var(--red)'
            const kanbanStatus = statuses[bountyId]
            const draft = drafts[bountyId]
            const wsObj = draft?.workspace
            const wsProgress = wsObj ? Object.values(wsObj.steps).filter(s => s === 'done').length : 0
            const isSelected = selectedId === bountyId

            return (
              <div
                key={bountyId}
                className={`ws-sidebar-item ${isSelected ? 'selected' : ''}`}
                onClick={() => handleSelect(bountyId)}
              >
                <div className="ws-sidebar-item-top">
                  <span className="ws-sidebar-score" style={{ color: scoreColor }}>{score}</span>
                  <span className="ws-sidebar-item-title">{bounty?.title || bountyId}</span>
                </div>
                <div className="ws-sidebar-item-meta">
                  <span>{bounty?.source}</span>
                  <span>{bounty?.reward}</span>
                  {kanbanStatus && <span className={`ws-sidebar-status ws-st-${kanbanStatus}`}>{kanbanStatus}</span>}
                </div>
                {wsObj && (
                  <div className="ws-sidebar-progress">
                    {STEPS.map(step => (
                      <span key={step.id} className={`ws-prog-dot ws-pd-${wsObj.steps[step.id]}`} />
                    ))}
                    <span className="ws-prog-label">{wsProgress}/6</span>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Right main: workspace content */}
      <div className="workspace-main">
        {!selectedId || (!selectedDraft && !selectedAnalysis) ? (
          <div className="workspace-main-empty">
            <p>Select a bounty from the sidebar to start working</p>
          </div>
        ) : (
          <div className="workspace-main-content">
            {/* Header */}
            <div className="ws-main-header">
              <div className="ws-main-header-info">
                <h3 className="ws-main-title">{selectedBounty?.title}</h3>
                <div className="ws-main-meta">
                  <span className="ws-main-source">{selectedBounty?.source}</span>
                  <span className="ws-main-reward">{selectedBounty?.reward}</span>
                  <span className={`ws-main-verdict ${selectedAnalysis?.verdict || selectedDraft?.verdict}`}>{selectedAnalysis?.verdict || selectedDraft?.verdict}</span>
                  {(selectedAnalysis?.difficulty || selectedDraft?.difficulty) && <span className="ws-main-diff">{selectedAnalysis?.difficulty || selectedDraft?.difficulty}</span>}
                </div>
              </div>
              <div className="ws-main-header-actions">
                <button className="ws-btn-sm" onClick={() => attachBounty(selectedId)}>💬 Ask AI</button>
                <button className="ws-btn-sm danger" onClick={() => { removeDraft(selectedId); setSelectedId(null) }}>🗑</button>
              </div>
            </div>

            {/* Step indicators */}
            {ws && (
              <div className="ws-steps-bar">
                {STEPS.map((step, idx) => {
                  const status = ws.steps[step.id] || 'locked'
                  const isCurrent = ws.currentStep === step.id
                  return (
                    <div
                      key={step.id}
                      className={`ws-step-item ${status} ${isCurrent ? 'current' : ''}`}
                      onClick={() => status !== 'locked' && setWorkspaceStep(selectedId, step.id)}
                    >
                      <span className="ws-step-num">{idx + 1}</span>
                      <span className="ws-step-label">{step.label}</span>
                    </div>
                  )
                })}
              </div>
            )}

            {/* Step content */}
            <div className="ws-step-content-area">
              {/* No workspace yet */}
              {!ws && (
                <div className="ws-init-prompt">
                  <p>Start the submission workflow for this bounty.</p>
                  <button className="dw-action-btn primary" onClick={() => initWorkspace(selectedId)}>
                    🚀 Start Workspace
                  </button>
                </div>
              )}

              {/* RESEARCH step */}
              {ws?.currentStep === 'research' && (
                <div className="ws-step-panel">
                  {ws.steps.research === 'done' && ws.research ? (
                    <div className="dw-research-result">
                      <h4>Research Complete</h4>
                      <div className="dw-research-grid">
                        <div className="dw-research-item"><label>Scope</label><p>{ws.research.scope}</p></div>
                        <div className="dw-research-item"><label>Difficulty</label><p>{ws.research.difficulty} · ~{ws.research.estimated_hours}h</p></div>
                        <div className="dw-research-item"><label>Skill Match</label><p>{ws.research.skill_match}</p></div>
                        <div className="dw-research-item"><label>Approach</label><p>{ws.research.recommended_approach}</p></div>
                      </div>
                      {ws.research.requirements?.length > 0 && (
                        <div className="dw-research-list"><label>Requirements</label><ul>{ws.research.requirements.map((r: string, i: number) => <li key={i}>{r}</li>)}</ul></div>
                      )}
                      {ws.research.key_challenges?.length > 0 && (
                        <div className="dw-research-list"><label>Challenges</label><ul>{ws.research.key_challenges.map((c: string, i: number) => <li key={i}>{c}</li>)}</ul></div>
                      )}
                      <button className="dw-action-btn" onClick={() => setWorkspaceStep(selectedId, 'generate')}>Next: Generate Draft →</button>
                    </div>
                  ) : (
                    <div className="ws-step-action-center">
                      <p>AI will scrape the bounty page, analyze requirements, and compile structured research notes.</p>
                      <button
                        className={`dw-action-btn primary ${ws.steps.research === 'loading' ? 'loading' : ''}`}
                        onClick={() => runResearch(selectedId)}
                        disabled={ws.steps.research === 'loading'}
                      >
                        {ws.steps.research === 'loading' ? '⏳ Researching...' : '🔍 Start Research'}
                      </button>
                      {ws.steps.research === 'error' && <p className="dw-error">Research failed. Try again.</p>}
                    </div>
                  )}
                </div>
              )}

              {/* GENERATE step */}
              {ws?.currentStep === 'generate' && (
                <div className="ws-step-panel">
                  {ws.steps.generate === 'done' && ws.draftText ? (
                    <div className="dw-draft-preview">
                      <h4>Draft Generated</h4>
                      <pre className="dw-draft-text">{ws.draftText}</pre>
                      <button className="dw-action-btn" onClick={() => setWorkspaceStep(selectedId, 'execute')}>Next: Execute →</button>
                    </div>
                  ) : (
                    <div className="ws-step-action-center">
                      <p>AI will generate a complete submission draft based on the research and your profile.</p>
                      <button
                        className={`dw-action-btn primary ${ws.steps.generate === 'loading' ? 'loading' : ''}`}
                        onClick={() => runGenerate(selectedId)}
                        disabled={ws.steps.generate === 'loading'}
                      >
                        {ws.steps.generate === 'loading' ? '⏳ Generating...' : '✍️ Generate Draft'}
                      </button>
                      {ws.steps.generate === 'error' && <p className="dw-error">Generation failed. Try again.</p>}
                    </div>
                  )}
                </div>
              )}

              {/* EXECUTE step */}
              {ws?.currentStep === 'execute' && (
                <ExecuteStep
                  bountyId={selectedId}
                  workspace={ws}
                  onComplete={() => {
                    setWorkspaceStepStatus(selectedId, 'execute', 'done')
                    setWorkspaceStepStatus(selectedId, 'review', 'active')
                    setWorkspaceStep(selectedId, 'review')
                    if (statuses[selectedId] === 'todo' || statuses[selectedId] === 'draft' || statuses[selectedId] === 'none') {
                      setStatus(selectedId, 'in_progress')
                    }
                  }}
                />
              )}

              {/* REVIEW step */}
              {ws?.currentStep === 'review' && (
                <div className="ws-step-panel">
                  <h4>Edit Your Submission</h4>
                  <textarea
                    className="dw-editor"
                    value={editingDraft || ws.draftText}
                    onChange={(e) => setEditingDraft(e.target.value)}
                    onFocus={() => !editingDraft && setEditingDraft(ws.draftText)}
                    rows={16}
                  />
                  <div className="dw-review-actions">
                    <button className="dw-action-btn" onClick={() => {
                      if (editingDraft) setWorkspaceDraftText(selectedId, editingDraft)
                      setWorkspaceStepStatus(selectedId, 'review', 'done')
                      setWorkspaceStepStatus(selectedId, 'finalize', 'active')
                      setWorkspaceStep(selectedId, 'finalize')
                      setEditingDraft('')
                    }}>Save & Verify →</button>
                    <button className="dw-action-btn secondary" onClick={() => attachBounty(selectedId)}>💬 Ask AI</button>
                  </div>
                </div>
              )}

              {/* FINALIZE step */}
              {ws?.currentStep === 'finalize' && (
                <div className="ws-step-panel">
                  {ws.steps.finalize === 'done' && ws.verification ? (
                    <div className="dw-verify-result">
                      <h4>Verification: {ws.verification.score}/10</h4>
                      <div className="dw-checklist">
                        {ws.verification.checklist.map((item: any, i: number) => (
                          <div key={i} className={`dw-check-item ${item.met ? 'met' : 'unmet'}`}>
                            <span>{item.met ? '✅' : '❌'}</span>
                            <span>{item.item}</span>
                            {item.note && <span className="dw-check-note">{item.note}</span>}
                          </div>
                        ))}
                      </div>
                      {ws.verification.suggestions?.length > 0 && (
                        <div className="dw-suggestions"><label>Suggestions</label><ul>{ws.verification.suggestions.map((s: string, i: number) => <li key={i}>{s}</li>)}</ul></div>
                      )}
                      {!ws.verification.ready_to_submit && (
                        <button className="dw-action-btn secondary" onClick={() => { setWorkspaceStepStatus(selectedId, 'review', 'active'); setWorkspaceStep(selectedId, 'review') }}>← Back to Edit</button>
                      )}
                      <button className="dw-action-btn primary" onClick={() => setWorkspaceStep(selectedId, 'submit')}>Ready to Submit →</button>
                    </div>
                  ) : (
                    <div className="ws-step-action-center">
                      <p>AI will check your draft against bounty requirements and judging criteria.</p>
                      <button
                        className={`dw-action-btn primary ${ws.steps.finalize === 'loading' ? 'loading' : ''}`}
                        onClick={() => runVerify(selectedId)}
                        disabled={ws.steps.finalize === 'loading'}
                      >
                        {ws.steps.finalize === 'loading' ? '⏳ Verifying...' : '✓ Verify Draft'}
                      </button>
                      {ws.steps.finalize === 'error' && <p className="dw-error">Verification failed. Try again.</p>}
                    </div>
                  )}
                </div>
              )}

              {/* SUBMIT step */}
              {ws?.currentStep === 'submit' && (
                <div className="ws-step-panel">
                  <h4>Ready to Submit</h4>
                  <div className="dw-submit-draft">
                    <pre className="dw-draft-text">{ws.draftText}</pre>
                    <div className="dw-submit-actions">
                      <button className="dw-action-btn primary" onClick={() => handleCopy(ws.draftText)}>
                        {copied ? '✓ Copied!' : '📋 Copy to Clipboard'}
                      </button>
                      <a href={selectedBounty?.url} target="_blank" rel="noopener noreferrer" className="dw-action-btn secondary">
                        🔗 Open {selectedBounty?.source}
                      </a>
                      <button className="dw-action-btn" onClick={() => handleMarkSubmitted(selectedId)}>
                        ✓ Mark as Submitted
                      </button>
                    </div>
                  </div>
                  {ws.recommendations?.length > 0 && (
                    <div className="dw-recommendations">
                      <h4>📋 Manual Steps</h4>
                      <ol>{ws.recommendations.map((rec: string, i: number) => <li key={i}>{rec}</li>)}</ol>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
