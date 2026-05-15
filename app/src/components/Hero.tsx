import { useState } from 'react'
import { useStore } from '../stores/bountyStore'

export default function Hero() {
  const bounties = useStore(s => s.bounties)
  const statuses = useStore(s => s.statuses)
  const setStatus = useStore(s => s.setStatus)
  const showToast = useStore(s => s.showToast)
  const setTab = useStore(s => s.setTab)

  const [url, setUrl] = useState('')
  const [analyzing, setAnalyzing] = useState(false)

  const totalReward = bounties.reduce((sum, b) => sum + (b.reward_usd || 0), 0)
  const appliedCount = Object.values(statuses).filter(s => s === 'todo' || s === 'ready' || s === 'submitted').length
  const now = new Date()
  const urgentCount = bounties.filter(b => {
    if (!b.deadline) return false
    const dl = new Date(b.deadline)
    const diff = (dl.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
    return diff > 0 && diff < 7
  }).length

  const formatReward = (usd: number) => {
    if (usd >= 1000000) return `$${(usd / 1000000).toFixed(1)}M`
    if (usd >= 1000) return `$${(usd / 1000).toFixed(0)}K`
    return `$${usd.toFixed(0)}`
  }

  const handleAnalyzeUrl = async () => {
    if (!url.trim()) return
    setAnalyzing(true)
    try {
      const res = await fetch('/api/analyze-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: url.trim() })
      })
      const data = await res.json()
      if (data.ok && data.bounty && data.analysis) {
        // Add bounty to store
        const store = useStore.getState()
        const newBounty = data.bounty
        store.setBounties([...store.bounties, newBounty])
        // Add analysis
        store.setAnalysis({ ...store.analysis, [newBounty.id]: data.analysis })
        // Create draft + workspace
        store.setDraft(newBounty.id, {
          match_score: data.analysis.match_score,
          difficulty: data.analysis.difficulty,
          time_estimate: data.analysis.time_estimate,
          summary: data.analysis.summary,
          strategy: data.analysis.strategy,
          skills_needed: data.analysis.skills_needed,
          verdict: data.analysis.verdict,
          tasks: data.analysis.tasks || [],
        })
        store.initWorkspace(newBounty.id)
        // Set kanban status to draft
        setStatus(newBounty.id, 'draft')
        showToast(`"${newBounty.title}" analyzed → Workspace`, 'success')
        setUrl('')
        // Switch to workspace
        setTab('draft')
      } else {
        showToast(data.error || 'Failed to analyze URL', 'error')
      }
    } catch (e) {
      showToast('Failed to analyze URL', 'error')
    } finally {
      setAnalyzing(false)
    }
  }

  return (
    <div className="hero">
      <div className="hero-inner">
        <div className="hero-left">
          <div className="hero-badges">
            <span className="hero-badge hero-badge-fill">LIVE DATA</span>
            <span className="hero-badge hero-badge-outline">LOCAL DASHBOARD</span>
          </div>
          <h1>Web3 Bounty Intelligence</h1>
          <p>Aggregated bounties from Superteam, Code4rena, Immunefi, Sherlock — analyzed with AI</p>
        </div>
        <div className="hero-lottie">
          <div className="radar-animation">
            <span className="radar-pulse"></span>
            <span className="radar-pulse delay"></span>
            <span className="radar-dot"></span>
          </div>
        </div>
        <div className="hero-right-col">
          <div className="hero-stats">
            <div className="hero-stat">
              <span className="hero-stat-value">{formatReward(totalReward)}</span>
              <span className="hero-stat-label">Reward Pool</span>
            </div>
            <div className="hero-stat">
              <span className="hero-stat-value">{appliedCount}</span>
              <span className="hero-stat-label">Applied</span>
            </div>
            <div className="hero-stat">
              <span className="hero-stat-value">{urgentCount}</span>
              <span className="hero-stat-label">Urgent &lt;7d</span>
            </div>
            <div className="hero-stat">
              <span className="hero-stat-value">{new Date().toLocaleDateString()}</span>
              <span className="hero-stat-label">Last Fetch</span>
            </div>
          </div>
          <div className="hero-url-input">
            <input
              type="url"
              placeholder="Paste bounty URL (X, Gitcoin, Discord, any link)..."
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAnalyzeUrl()}
              disabled={analyzing}
            />
            <button
              className={`hero-url-btn ${analyzing ? 'loading' : ''}`}
              onClick={handleAnalyzeUrl}
              disabled={!url.trim() || analyzing}
            >
              {analyzing ? '⏳' : '🔍'} {analyzing ? 'Analyzing...' : 'Analyze'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
