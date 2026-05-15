import { useState } from 'react'
import { useStore } from '../stores/bountyStore'
import { useApi } from '../hooks/useApi'
import BountyCard from './BountyCard'
import Tooltip from './Tooltip'
import type { Bounty } from '../types'

export default function BountyGrid() {
  const bounties = useStore(s => s.bounties)
  const currentTab = useStore(s => s.currentTab)
  const sortMode = useStore(s => s.sortMode)
  const bookmarks = useStore(s => s.bookmarks)
  const analysis = useStore(s => s.analysis)
  const drafts = useStore(s => s.drafts)
  const setDraft = useStore(s => s.setDraft)
  const showToast = useStore(s => s.showToast)
  const filterCategory = useStore(s => s.filterCategory)
  const filterType = useStore(s => s.filterType)
  const filterVerdict = useStore(s => s.filterVerdict)
  const filterRewardMin = useStore(s => s.filterRewardMin)
  const filterRewardMax = useStore(s => s.filterRewardMax)

  const { deepAnalyze } = useApi()

  const [batchRunning, setBatchRunning] = useState(false)
  const [batchDone, setBatchDone] = useState(0)
  const [batchTotal, setBatchTotal] = useState(0)

  const filterBounties = (list: Bounty[]): Bounty[] => {
    let filtered = list
    switch (currentTab) {
      case 'superteam': filtered = filtered.filter(b => b.source.toLowerCase().includes('superteam')); break
      case 'code4rena': filtered = filtered.filter(b => b.source.toLowerCase().includes('code4rena')); break
      case 'immunefi':  filtered = filtered.filter(b => b.source.toLowerCase().includes('immunefi')); break
      case 'sherlock':  filtered = filtered.filter(b => b.source.toLowerCase().includes('sherlock')); break
      case 'bookmarks': filtered = filtered.filter(b => bookmarks.includes(b.id)); break
    }
    if (filterCategory.length > 0)
      filtered = filtered.filter(b => filterCategory.includes(b.category))
    if (filterType.length > 0)
      filtered = filtered.filter(b => filterType.includes(b.type))
    if (filterVerdict.length > 0)
      filtered = filtered.filter(b => {
        const a = analysis[b.id]
        return a && filterVerdict.includes(a.verdict)
      })
    if (filterRewardMin && filterRewardMin > 0)
      filtered = filtered.filter(b => (b.reward_usd || 0) >= filterRewardMin)
    if (filterRewardMax && filterRewardMax > 0)
      filtered = filtered.filter(b => (b.reward_usd || 0) <= filterRewardMax)
    return filtered
  }

  const sortBounties = (list: Bounty[]): Bounty[] => {
    const sorted = [...list]
    switch (sortMode) {
      case 'reward-desc': return sorted.sort((a, b) => (b.reward_usd || 0) - (a.reward_usd || 0))
      case 'reward-asc':  return sorted.sort((a, b) => (a.reward_usd || 0) - (b.reward_usd || 0))
      case 'deadline':    return sorted.sort((a, b) => {
        if (!a.deadline) return 1
        if (!b.deadline) return -1
        return new Date(a.deadline).getTime() - new Date(b.deadline).getTime()
      })
      case 'source': return sorted.sort((a, b) => a.source.localeCompare(b.source))
      default: return sorted
    }
  }

  const filtered = sortBounties(filterBounties(bounties))

  // Bounties not yet analyzed
  const unanalyzed = filtered.filter(b => !drafts[b.id])

  const handleBatchAnalyze = async () => {
    if (batchRunning || unanalyzed.length === 0) return
    setBatchRunning(true)
    setBatchDone(0)
    setBatchTotal(unanalyzed.length)
    showToast(`Starting batch analysis of ${unanalyzed.length} bounties...`, 'info')

    // Process 3 concurrent
    const CONCURRENCY = 3
    let idx = 0
    let done = 0

    const runNext = async (): Promise<void> => {
      if (idx >= unanalyzed.length) return
      const bounty = unanalyzed[idx++]
      try {
        const result = await deepAnalyze(bounty)
        setDraft(bounty.id, { ...result, checked: new Array(result.tasks?.length || 0).fill(false) })
      } catch (e) {
        console.error(`Batch analyze failed for ${bounty.title}:`, e)
      }
      done++
      setBatchDone(done)
      await runNext()
    }

    // Spawn CONCURRENCY workers
    await Promise.all(Array.from({ length: CONCURRENCY }, runNext))

    setBatchRunning(false)
    showToast(`Batch analysis complete — ${done} bounties analyzed`, 'success')
  }

  if (filtered.length === 0) {
    return <div className="empty">No bounties found for this filter.</div>
  }

  const batchPct = batchTotal > 0 ? Math.round((batchDone / batchTotal) * 100) : 0

  return (
    <div className="container">
      {/* Batch analyze bar */}
      <div className="batch-bar">
        <div className="batch-bar-left">
          <span className="batch-bar-count">
            <strong>{filtered.length}</strong> bounties
            {unanalyzed.length > 0 && (
              <span className="batch-bar-unanalyzed"> · {unanalyzed.length} not analyzed</span>
            )}
          </span>
        </div>
        <div className="batch-bar-right">
          {batchRunning && (
            <div className="batch-progress">
              <div className="batch-progress-bar">
                <div className="batch-progress-fill" style={{ width: `${batchPct}%` }} />
              </div>
              <span className="batch-progress-label">{batchDone}/{batchTotal}</span>
            </div>
          )}
          {unanalyzed.length > 0 && (
            <Tooltip text={batchRunning ? `Analyzing ${batchDone}/${batchTotal}...` : `Analyze all ${unanalyzed.length} unanalyzed bounties`}>
              <button
                className={`batch-analyze-btn ${batchRunning ? 'running' : ''}`}
                onClick={handleBatchAnalyze}
                disabled={batchRunning}
              >
                {batchRunning ? (
                  <>
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ animation: 'spin 0.8s linear infinite' }}><path d="M23 4v6h-6"/><path d="M1 20v-6h6"/><path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15"/></svg>
                    ANALYZING {batchDone}/{batchTotal}
                  </>
                ) : (
                  <>
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="3"/><path d="M12 1v4M12 19v4M4.22 4.22l2.83 2.83M16.95 16.95l2.83 2.83M1 12h4M19 12h4M4.22 19.78l2.83-2.83M16.95 7.05l2.83-2.83"/></svg>
                    ANALYZE ALL ({unanalyzed.length})
                  </>
                )}
              </button>
            </Tooltip>
          )}
          {unanalyzed.length === 0 && filtered.length > 0 && (
            <span className="batch-all-done">✓ All analyzed</span>
          )}
        </div>
      </div>

      <div className="grid">
        {filtered.map(bounty => (
          <BountyCard key={bounty.id} bounty={bounty} />
        ))}
      </div>
    </div>
  )
}
