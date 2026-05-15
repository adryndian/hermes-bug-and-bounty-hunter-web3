import { useState, useEffect } from 'react'
import { useStore } from '../stores/bountyStore'
import Markdown from 'react-markdown'
import type { Bounty, KanbanStatus, DraftStep } from '../types'

interface Props {
  bountyId: string
  onClose: () => void
}

const STATUS_OPTIONS: { id: KanbanStatus; label: string }[] = [
  { id: 'draft', label: 'Draft' },
  { id: 'todo', label: 'Todo' },
  { id: 'in_progress', label: 'In Progress' },
  { id: 'ready', label: 'Ready' },
  { id: 'submitted', label: 'Submitted' },
  { id: 'won', label: 'Won' },
  { id: 'lost', label: 'Lost' },
  { id: 'archived', label: 'Archived' },
]

const STEP_LABELS: Record<DraftStep, string> = {
  research: 'Research',
  generate: 'Draft',
  execute: 'Execute',
  review: 'Review',
  finalize: 'Finalize',
  submit: 'Submit',
}

export default function BountyDetailPanel({ bountyId, onClose }: Props) {
  const bounties = useStore(s => s.bounties)
  const statuses = useStore(s => s.statuses)
  const drafts = useStore(s => s.drafts)
  const analysis = useStore(s => s.analysis)
  const setStatus = useStore(s => s.setStatus)
  const setTab = useStore(s => s.setTab)
  const initWorkspace = useStore(s => s.initWorkspace)

  const [notes, setNotes] = useState('')
  const [chatInput, setChatInput] = useState('')
  const [chatReply, setChatReply] = useState('')
  const [chatLoading, setChatLoading] = useState(false)

  const bounty = bounties.find(b => b.id === bountyId)
  const status = statuses[bountyId] || 'draft'
  const draft = drafts[bountyId]
  const ws = draft?.workspace
  const anal = analysis[bountyId] as any

  // Load notes from workspace session
  useEffect(() => {
    fetch(`/api/copilot/workspace?bounty_id=${bountyId}`)
      .then(r => r.json())
      .then(data => {
        if (data.ok && data.notes) setNotes(data.notes)
      })
      .catch(() => {})
  }, [bountyId])

  if (!bounty) return null

  const handleStatusChange = (newStatus: KanbanStatus) => {
    setStatus(bountyId, newStatus)
  }

  const handleOpenWorkspace = () => {
    const store = useStore.getState()
    if (!store.drafts[bountyId]) {
      store.setDraft(bountyId, {
        match_score: anal?.match_score || 0,
        difficulty: anal?.difficulty || 'unknown',
        time_estimate: anal?.time_estimate || '',
        summary: anal?.summary || '',
        strategy: anal?.strategy || '',
        skills_needed: anal?.skills_needed || [],
        verdict: anal?.verdict || 'possible',
        tasks: anal?.tasks || [],
      })
    }
    if (!store.drafts[bountyId]?.workspace) {
      initWorkspace(bountyId)
    }
    setTab('draft')
    onClose()
  }

  const handleQuickAsk = async () => {
    if (!chatInput.trim() || chatLoading) return
    setChatLoading(true)
    setChatReply('')
    try {
      const res = await fetch('/api/copilot/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bounty_id: bountyId, message: chatInput })
      })
      const data = await res.json()
      if (data.ok) setChatReply(data.reply)
      else setChatReply(`Error: ${data.error}`)
    } catch {
      setChatReply('Failed to reach copilot.')
    }
    setChatLoading(false)
    setChatInput('')
  }

  const saveNotes = () => {
    fetch('/api/copilot/notes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ bounty_id: bountyId, notes })
    })
  }

  const daysLeft = bounty.deadline
    ? Math.ceil((new Date(bounty.deadline).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
    : null

  return (
    <div className="bounty-detail-overlay" onClick={onClose}>
      <div className="bounty-detail-panel" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="bdp-header">
          <div className="bdp-header-top">
            <h3 className="bdp-title">{bounty.title}</h3>
            <button className="bdp-close" onClick={onClose}>✕</button>
          </div>
          <div className="bdp-meta">
            <span className="bdp-source">{bounty.source}</span>
            <span className="bdp-reward">{bounty.reward}</span>
            {daysLeft !== null && (
              <span className={`bdp-deadline ${daysLeft <= 3 ? 'urgent' : ''}`}>
                {daysLeft > 0 ? `${daysLeft}d left` : 'Expired'}
              </span>
            )}
            {!bounty.deadline && <span className="bdp-deadline">Ongoing</span>}
          </div>
        </div>

        {/* Status selector */}
        <div className="bdp-section">
          <label className="bdp-label">Status</label>
          <div className="bdp-status-row">
            {STATUS_OPTIONS.map(opt => (
              <button
                key={opt.id}
                className={`bdp-status-btn ${status === opt.id ? 'active' : ''}`}
                onClick={() => handleStatusChange(opt.id)}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Analysis summary */}
        {anal && (
          <div className="bdp-section">
            <label className="bdp-label">AI Analysis</label>
            <div className="bdp-analysis">
              <div className="bdp-analysis-row">
                <span className={`bdp-verdict ${anal.verdict}`}>{anal.verdict}</span>
                <span className="bdp-score">{anal.match_score}/10</span>
                <span className="bdp-difficulty">{anal.difficulty}</span>
                <span className="bdp-time">{anal.time_estimate}</span>
              </div>
              {anal.summary && <p className="bdp-summary">{anal.summary}</p>}
              {anal.strategy && <p className="bdp-strategy"><strong>Strategy:</strong> {anal.strategy}</p>}
            </div>
          </div>
        )}

        {/* Workspace progress */}
        {ws && (
          <div className="bdp-section">
            <label className="bdp-label">Workspace Progress</label>
            <div className="bdp-ws-steps">
              {(Object.entries(STEP_LABELS) as [DraftStep, string][]).map(([step, label]) => (
                <div key={step} className={`bdp-ws-step bdp-ws-${ws.steps[step]}`}>
                  <span className="bdp-ws-dot" />
                  <span>{label}</span>
                </div>
              ))}
            </div>
            <button className="bdp-action-btn" onClick={handleOpenWorkspace}>
              Open Workspace →
            </button>
          </div>
        )}
        {!ws && draft && (
          <div className="bdp-section">
            <button className="bdp-action-btn primary" onClick={handleOpenWorkspace}>
              🚀 Start Workspace
            </button>
          </div>
        )}

        {/* Tasks */}
        {anal?.tasks && anal.tasks.length > 0 && (
          <div className="bdp-section">
            <label className="bdp-label">Tasks</label>
            <ul className="bdp-tasks">
              {anal.tasks.map((task: string, i: number) => (
                <li key={i}>{task}</li>
              ))}
            </ul>
          </div>
        )}

        {/* Notes */}
        <div className="bdp-section">
          <label className="bdp-label">Notes</label>
          <textarea
            className="bdp-notes"
            value={notes}
            onChange={e => setNotes(e.target.value)}
            onBlur={saveNotes}
            placeholder="Add personal notes about this bounty..."
            rows={3}
          />
        </div>

        {/* Quick Ask */}
        <div className="bdp-section">
          <label className="bdp-label">Quick Ask</label>
          <div className="bdp-quick-ask">
            <input
              type="text"
              placeholder="Ask copilot about this bounty..."
              value={chatInput}
              onChange={e => setChatInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleQuickAsk()}
              disabled={chatLoading}
            />
            <button onClick={handleQuickAsk} disabled={chatLoading || !chatInput.trim()}>
              {chatLoading ? '⏳' : 'Ask'}
            </button>
          </div>
          {chatReply && (
            <div className="bdp-chat-reply">
              <Markdown>{chatReply}</Markdown>
            </div>
          )}
        </div>

        {/* Links */}
        <div className="bdp-section">
          <a href={bounty.url} target="_blank" rel="noopener noreferrer" className="bdp-link">
            🔗 Open on {bounty.source}
          </a>
        </div>
      </div>
    </div>
  )
}
