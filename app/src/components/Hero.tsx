import { useStore } from '../stores/bountyStore'

export default function Hero() {
  const bounties = useStore(s => s.bounties)
  const statuses = useStore(s => s.statuses)

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
      </div>
    </div>
  )
}
