import { useStore } from '../stores/bountyStore'
import { useApi } from '../hooks/useApi'
import Tooltip from './Tooltip'
import type { Bounty, KanbanStatus } from '../types'

interface Props {
  bounty: Bounty
}

export default function BountyCard({ bounty }: Props) {
  const bookmarks = useStore(s => s.bookmarks)
  const toggleBookmark = useStore(s => s.toggleBookmark)
  const analysis = useStore(s => s.analysis)
  const statuses = useStore(s => s.statuses)
  const setStatus = useStore(s => s.setStatus)
  const setDraft = useStore(s => s.setDraft)
  const showToast = useStore(s => s.showToast)
  const attachBounty = useStore(s => s.attachBounty)
  const analyzingIds = useStore(s => s.analyzingIds)
  const startAnalyzing = useStore(s => s.startAnalyzing)
  const stopAnalyzing = useStore(s => s.stopAnalyzing)
  const analyzing = analyzingIds.includes(bounty.id)

  const { deepAnalyze } = useApi()

  const isBookmarked = bookmarks.includes(bounty.id)
  const bountyAnalysis = analysis[bounty.id]
  const currentStatus = statuses[bounty.id] || 'none'

  const setTab = useStore(s => s.setTab)
  const initWorkspace = useStore(s => s.initWorkspace)

  const handleAnalyze = async () => {
    startAnalyzing(bounty.id)
    showToast(`Analyzing "${bounty.title}"...`, 'info')
    try {
      const result = await deepAnalyze(bounty)
      const draft = { ...result, checked: new Array(result.tasks?.length || 0).fill(false) }
      setDraft(bounty.id, draft)
      // Auto-init workspace and switch to Draft tab
      initWorkspace(bounty.id)
      setTab('draft')
      showToast(`"${bounty.title}" analyzed — ${result.verdict} (${result.match_score}/10)`, 'success', bounty.id)
    } catch (e) {
      console.error('Analysis failed:', e)
      showToast(`Analysis failed for "${bounty.title}"`, 'error')
    } finally {
      stopAnalyzing(bounty.id)
    }
  }

  const handleStatusChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value as KanbanStatus | 'none'
    setStatus(bounty.id, val)
  }

  const score = bountyAnalysis?.match_score || 0
  const verdict = bountyAnalysis?.verdict || ''
  const summary = bountyAnalysis?.summary || ''

  const getScoreColor = () => {
    if (score >= 7) return 'var(--green)'
    if (score >= 4) return 'var(--yellow)'
    return 'var(--red)'
  }

  const getVerdictClass = () => {
    const v = verdict.toLowerCase()
    if (v === 'recommended' || v === 'strong') return 'card2-verdict-rec'
    if (v === 'possible' || v === 'maybe') return 'card2-verdict-pos'
    return 'card2-verdict-skip'
  }

  return (
    <div className="card2">
      {/* Header */}
      <div className="card2-header">
        <div className="card2-logo">
          {bounty.source === 'Immunefi' && <svg viewBox="0 0 24 24" fill="white"><path d="M12 2L3 7v10l9 5 9-5V7l-9-5z"/></svg>}
          {bounty.source === 'Superteam' && <svg viewBox="0 0 24 24" fill="white"><circle cx="12" cy="12" r="8"/></svg>}
          {bounty.source === 'Code4rena' && <svg viewBox="0 0 24 24" fill="white"><rect x="4" y="4" width="16" height="16" rx="3"/></svg>}
          {bounty.source === 'Sherlock' && <svg viewBox="0 0 24 24" fill="white"><path d="M12 2a10 10 0 100 20 10 10 0 000-20z"/></svg>}
        </div>
        <div className="card2-title-block">
          <a href={bounty.url} target="_blank" rel="noopener noreferrer" className="card2-title">{bounty.title}</a>
          <div className="card2-reward">
            <span className="card2-reward-amount">{bounty.reward}</span>
          </div>
        </div>
        <Tooltip text="Save bounty">
          <button
            className={`card2-bookmark ${isBookmarked ? 'saved' : ''}`}
            onClick={() => toggleBookmark(bounty.id)}
            aria-label="Save bounty"
          >
            {isBookmarked ? (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M5 3h14a2 2 0 012 2v16l-9-4-9 4V5a2 2 0 012-2z"/></svg>
            ) : (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M5 3h14a2 2 0 012 2v16l-9-4-9 4V5a2 2 0 012-2z"/></svg>
            )}
          </button>
        </Tooltip>
      </div>

      {/* Meta row: sponsor + deadline */}
      <div className="card2-meta-row">
        {bounty.sponsor && <span className="card2-sponsor">{bounty.sponsor}</span>}
        {bounty.deadline ? (() => {
          const days = Math.ceil((new Date(bounty.deadline).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
          return (
            <span className={`card2-deadline ${days <= 7 ? 'urgent' : ''}`}>
              {days > 0 ? `${days}d left` : 'Expired'}
            </span>
          )
        })() : <span className="card2-deadline ongoing">Ongoing</span>}
      </div>

      {/* Tags + Status + Analyze (inline) */}
      <div className="card2-tags-row">
        <div className="card2-tags">
          {bounty.category && <span className="card2-tag card2-tag-orange">{bounty.category}</span>}
          {bounty.type && <span className="card2-tag card2-tag-orange">{bounty.type}</span>}
          <span className="card2-tag card2-tag-gray">{bounty.source}</span>
        </div>
        <div className="card2-actions">
          <Tooltip text="Set status">
            <select
              className="card2-status"
              value={currentStatus}
              onChange={handleStatusChange}
              onClick={(e) => e.stopPropagation()}
            >
              <option value="none">— status —</option>
              <option value="draft">Draft</option>
              <option value="in_progress">In Progress</option>
              <option value="todo">Todo</option>
              <option value="ready">Ready</option>
              <option value="submitted">Submitted</option>
              <option value="won">Won</option>
              <option value="lost">Lost</option>
            </select>
          </Tooltip>
          <Tooltip text="AI deep analysis">
            <button
              className={`card2-analyze ${analyzing ? 'analyzing' : ''}`}
              onClick={handleAnalyze}
              disabled={analyzing}
              aria-label="AI deep analysis"
            >
              {analyzing ? 'ANALYZING...' : 'ANALYZE'}
            </button>
          </Tooltip>
          <Tooltip text="Ask AI about this bounty">
            <button
              className="card2-attach"
              onClick={() => attachBounty(bounty.id)}
              aria-label="Ask AI about this bounty"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>
              ASK
            </button>
          </Tooltip>
        </div>
      </div>

      {/* Analysis row (flat, like before) */}
      {bountyAnalysis && (
        <div className="card2-analysis-row">
          <span className="card2-score" style={{ color: getScoreColor() }}>{score}/10</span>
          <span className={`card2-verdict ${getVerdictClass()}`}>{verdict.toUpperCase()}</span>
          <span className="card2-summary">{summary}</span>
        </div>
      )}
    </div>
  )
}
