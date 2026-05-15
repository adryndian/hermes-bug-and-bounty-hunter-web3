import { useState } from 'react'
import { useStore } from '../stores/bountyStore'
import Tooltip from './Tooltip'
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

  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [editingDraft, setEditingDraft] = useState<string>('')
  const [copied, setCopied] = useState(false)

  const draftEntries = Object.entries(drafts)

  // Auto-expand the most recently added draft (last entry)
  const latestDraftId = draftEntries.length > 0 ? draftEntries[draftEntries.length - 1][0] : null
  if (latestDraftId && expandedId === null && draftEntries.length > 0) {
    // Will trigger on first render after analyze
    setTimeout(() => setExpandedId(latestDraftId), 0)
  }

  if (draftEntries.length === 0) {
    return (
      <div className="draft-empty">
        <div className="draft-empty-icon">⚡</div>
        <div className="draft-empty-title">No analyzed bounties yet</div>
        <div className="draft-empty-sub">Click ANALYZE on any bounty card to get an AI breakdown</div>
      </div>
    )
  }

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
        setWorkspaceStep(bountyId, 'generate')
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
        // Auto-move to Todo in kanban
        if (statuses[bountyId] === 'draft') {
          setStatus(bountyId, 'todo')
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

  const handleStartWorkspace = (bountyId: string) => {
    if (!drafts[bountyId].workspace) {
      initWorkspace(bountyId)
    }
    setExpandedId(expandedId === bountyId ? null : bountyId)
  }

  const handleMarkSubmitted = (bountyId: string) => {
    setStatus(bountyId, 'submitted')
  }

  return (
    <div className="draft-panel-wrap">
      <div className="draft-panel-header">
        <span className="draft-panel-title">WORKSPACE</span>
        <span className="draft-panel-count">{draftEntries.length}</span>
      </div>

      <div className="draft-list">
        {draftEntries.map(([bountyId, draft]) => {
          const bounty = bounties.find(b => b.id === bountyId)
          const ws = draft.workspace
          const isExpanded = expandedId === bountyId
          const score = draft.match_score || 0
          const scoreColor = score >= 7 ? 'var(--green)' : score >= 4 ? 'var(--yellow)' : 'var(--red)'
          const kanbanStatus = statuses[bountyId]

          // Calculate workspace progress
          const wsProgress = ws ? Object.values(ws.steps).filter(s => s === 'done').length : 0

          return (
            <div key={bountyId} className={`draft-workspace-card ${isExpanded ? 'expanded' : ''}`}>
              {/* Card header — always visible */}
              <div className="dw-header" onClick={() => handleStartWorkspace(bountyId)}>
                <div className="dw-header-left">
                  <span className="dw-score" style={{ color: scoreColor }}>{score}</span>
                  <div className="dw-header-info">
                    <span className="dw-title">{bounty?.title || bountyId}</span>
                    <span className="dw-meta">
                      {bounty?.source} · {bounty?.reward}
                      {kanbanStatus && <span className={`dw-status dw-status-${kanbanStatus}`}>{kanbanStatus}</span>}
                    </span>
                  </div>
                </div>
                <div className="dw-header-right">
                  {ws && (
                    <div className="dw-mini-progress">
                      {STEPS.map(step => (
                        <div
                          key={step.id}
                          className={`dw-mini-dot dw-dot-${ws.steps[step.id]}`}
                          title={`${step.label}: ${ws.steps[step.id]}`}
                        />
                      ))}
                    </div>
                  )}
                  <span className="dw-expand-icon">{isExpanded ? '▼' : '▶'}</span>
                </div>
              </div>

              {/* Analysis summary — always visible below header */}
              {!isExpanded && (
                <div className="dw-analysis-summary">
                  <div className="dw-analysis-row">
                    <span className={`dw-verdict-badge ${draft.verdict}`}>{draft.verdict?.toUpperCase()}</span>
                    <span className="dw-difficulty">{draft.difficulty}</span>
                    <span className="dw-time">{draft.time_estimate}</span>
                  </div>
                  {draft.summary && <p className="dw-summary-text">{draft.summary}</p>}
                  {draft.tasks && draft.tasks.length > 0 && (
                    <div className="dw-tasks-preview">
                      {draft.tasks.slice(0, 3).map((task, i) => (
                        <span key={i} className="dw-task-chip">{task}</span>
                      ))}
                      {draft.tasks.length > 3 && <span className="dw-task-more">+{draft.tasks.length - 3} more</span>}
                    </div>
                  )}
                </div>
              )}

              {/* Expanded workspace */}
              {isExpanded && (
                <div className="dw-body">
                  {/* Step indicators */}
                  <div className="dw-steps">
                    {STEPS.map((step, idx) => {
                      const status = ws?.steps[step.id] || 'locked'
                      const isCurrent = ws?.currentStep === step.id
                      return (
                        <div
                          key={step.id}
                          className={`dw-step ${status} ${isCurrent ? 'current' : ''}`}
                          onClick={() => status !== 'locked' && setWorkspaceStep(bountyId, step.id)}
                        >
                          <span className="dw-step-num">{idx + 1}</span>
                          <span className="dw-step-label">{step.label}</span>
                          <span className="dw-step-type">{step.type}</span>
                        </div>
                      )
                    })}
                  </div>

                  {/* Step content */}
                  <div className="dw-content">
                    {/* RESEARCH step */}
                    {ws?.currentStep === 'research' && (
                      <div className="dw-step-content">
                        {ws.steps.research === 'done' && ws.research ? (
                          <div className="dw-research-result">
                            <h4>Research Complete</h4>
                            <div className="dw-research-grid">
                              <div className="dw-research-item">
                                <label>Scope</label>
                                <p>{ws.research.scope}</p>
                              </div>
                              <div className="dw-research-item">
                                <label>Difficulty</label>
                                <p>{ws.research.difficulty} · ~{ws.research.estimated_hours}h</p>
                              </div>
                              <div className="dw-research-item">
                                <label>Skill Match</label>
                                <p>{ws.research.skill_match}</p>
                              </div>
                              <div className="dw-research-item">
                                <label>Approach</label>
                                <p>{ws.research.recommended_approach}</p>
                              </div>
                            </div>
                            {ws.research.requirements.length > 0 && (
                              <div className="dw-research-list">
                                <label>Requirements</label>
                                <ul>{ws.research.requirements.map((r, i) => <li key={i}>{r}</li>)}</ul>
                              </div>
                            )}
                            {ws.research.key_challenges.length > 0 && (
                              <div className="dw-research-list">
                                <label>Challenges</label>
                                <ul>{ws.research.key_challenges.map((c, i) => <li key={i}>{c}</li>)}</ul>
                              </div>
                            )}
                            <button className="dw-action-btn" onClick={() => setWorkspaceStep(bountyId, 'generate')}>
                              Next: Generate Draft →
                            </button>
                          </div>
                        ) : (
                          <div className="dw-step-action">
                            <p>AI will scrape the bounty page, analyze requirements, and compile structured research notes.</p>
                            <button
                              className={`dw-action-btn primary ${ws.steps.research === 'loading' ? 'loading' : ''}`}
                              onClick={() => runResearch(bountyId)}
                              disabled={ws.steps.research === 'loading'}
                            >
                              {ws.steps.research === 'loading' ? '⏳ Researching...' : '🔍 Start Research'}
                            </button>
                            {ws.steps.research === 'error' && (
                              <p className="dw-error">Research failed. Try again.</p>
                            )}
                          </div>
                        )}
                      </div>
                    )}

                    {/* GENERATE step */}
                    {ws?.currentStep === 'generate' && (
                      <div className="dw-step-content">
                        {ws.steps.generate === 'done' && ws.draftText ? (
                          <div className="dw-draft-preview">
                            <h4>Draft Generated</h4>
                            <pre className="dw-draft-text">{ws.draftText}</pre>
                            <button className="dw-action-btn" onClick={() => setWorkspaceStep(bountyId, 'review')}>
                              Next: Review & Edit →
                            </button>
                          </div>
                        ) : (
                          <div className="dw-step-action">
                            <p>AI will generate a complete submission draft based on the research and your profile.</p>
                            <button
                              className={`dw-action-btn primary ${ws.steps.generate === 'loading' ? 'loading' : ''}`}
                              onClick={() => runGenerate(bountyId)}
                              disabled={ws.steps.generate === 'loading'}
                            >
                              {ws.steps.generate === 'loading' ? '⏳ Generating...' : '✍️ Generate Draft'}
                            </button>
                            {ws.steps.generate === 'error' && (
                              <p className="dw-error">Generation failed. Try again.</p>
                            )}
                          </div>
                        )}
                      </div>
                    )}


                    {/* EXECUTE step — checklist + copilot chat */}
                    {ws?.currentStep === 'execute' && (
                      <ExecuteStep
                        bountyId={bountyId}
                        workspace={ws}
                        onComplete={() => {
                          setWorkspaceStepStatus(bountyId, 'execute', 'done')
                          setWorkspaceStepStatus(bountyId, 'review', 'active')
                          setWorkspaceStep(bountyId, 'review')
                          if (statuses[bountyId] === 'todo' || statuses[bountyId] === 'draft') {
                            setStatus(bountyId, 'in_progress')
                          }
                        }}
                      />
                    )}

                    {/* REVIEW step */}
                    {ws?.currentStep === 'review' && (
                      <div className="dw-step-content">
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
                            if (editingDraft) {
                              setWorkspaceDraftText(bountyId, editingDraft)
                            }
                            setWorkspaceStepStatus(bountyId, 'review', 'done')
                            setWorkspaceStepStatus(bountyId, 'finalize', 'active')
                            setWorkspaceStep(bountyId, 'finalize')
                            setEditingDraft('')
                          }}>
                            Save & Verify →
                          </button>
                          <Tooltip text="Ask AI for suggestions">
                            <button className="dw-action-btn secondary" onClick={() => attachBounty(bountyId)}>
                              💬 Ask AI
                            </button>
                          </Tooltip>
                        </div>
                      </div>
                    )}

                    {/* FINALIZE step */}
                    {ws?.currentStep === 'finalize' && (
                      <div className="dw-step-content">
                        {ws.steps.finalize === 'done' && ws.verification ? (
                          <div className="dw-verify-result">
                            <h4>Verification: {ws.verification.score}/10</h4>
                            <div className="dw-checklist">
                              {ws.verification.checklist.map((item, i) => (
                                <div key={i} className={`dw-check-item ${item.met ? 'met' : 'unmet'}`}>
                                  <span>{item.met ? '✅' : '❌'}</span>
                                  <span>{item.item}</span>
                                  {item.note && <span className="dw-check-note">{item.note}</span>}
                                </div>
                              ))}
                            </div>
                            {ws.verification.suggestions.length > 0 && (
                              <div className="dw-suggestions">
                                <label>Suggestions</label>
                                <ul>{ws.verification.suggestions.map((s, i) => <li key={i}>{s}</li>)}</ul>
                              </div>
                            )}
                            {!ws.verification.ready_to_submit && (
                              <button className="dw-action-btn secondary" onClick={() => {
                                setWorkspaceStepStatus(bountyId, 'review', 'active')
                                setWorkspaceStep(bountyId, 'review')
                              }}>
                                ← Back to Edit
                              </button>
                            )}
                            <button className="dw-action-btn primary" onClick={() => setWorkspaceStep(bountyId, 'submit')}>
                              Ready to Submit →
                            </button>
                          </div>
                        ) : (
                          <div className="dw-step-action">
                            <p>AI will check your draft against bounty requirements and judging criteria.</p>
                            <button
                              className={`dw-action-btn primary ${ws.steps.finalize === 'loading' ? 'loading' : ''}`}
                              onClick={() => runVerify(bountyId)}
                              disabled={ws.steps.finalize === 'loading'}
                            >
                              {ws.steps.finalize === 'loading' ? '⏳ Verifying...' : '✓ Verify Draft'}
                            </button>
                            {ws.steps.finalize === 'error' && (
                              <p className="dw-error">Verification failed. Try again.</p>
                            )}
                          </div>
                        )}
                      </div>
                    )}

                    {/* SUBMIT step */}
                    {ws?.currentStep === 'submit' && (
                      <div className="dw-step-content">
                        <h4>Ready to Submit</h4>
                        <div className="dw-submit-draft">
                          <pre className="dw-draft-text">{ws.draftText}</pre>
                          <div className="dw-submit-actions">
                            <button className="dw-action-btn primary" onClick={() => handleCopy(ws.draftText)}>
                              {copied ? '✓ Copied!' : '📋 Copy to Clipboard'}
                            </button>
                            <a href={bounty?.url} target="_blank" rel="noopener noreferrer" className="dw-action-btn secondary">
                              🔗 Open {bounty?.source}
                            </a>
                            <button className="dw-action-btn" onClick={() => handleMarkSubmitted(bountyId)}>
                              ✓ Mark as Submitted
                            </button>
                          </div>
                        </div>
                        {ws.recommendations.length > 0 && (
                          <div className="dw-recommendations">
                            <h4>📋 Manual Steps</h4>
                            <ol>
                              {ws.recommendations.map((rec, i) => (
                                <li key={i}>{rec}</li>
                              ))}
                            </ol>
                          </div>
                        )}
                      </div>
                    )}

                    {/* No workspace yet — show init */}
                    {!ws && (
                      <div className="dw-step-action">
                        <p>Start the submission workflow for this bounty.</p>
                        <button className="dw-action-btn primary" onClick={() => initWorkspace(bountyId)}>
                          🚀 Start Workspace
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Quick actions */}
                  <div className="dw-footer">
                    <Tooltip text="Ask AI">
                      <button className="dw-footer-btn" onClick={() => attachBounty(bountyId)}>💬</button>
                    </Tooltip>
                    <Tooltip text="Remove">
                      <button className="dw-footer-btn danger" onClick={() => removeDraft(bountyId)}>🗑</button>
                    </Tooltip>
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
