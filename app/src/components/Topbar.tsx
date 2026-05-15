import { useState, useRef, useEffect } from 'react'
import { useStore } from '../stores/bountyStore'
import UserProfileModal from './UserProfileModal'

export default function Topbar() {
  const bounties = useStore(s => s.bounties)
  const sortMode = useStore(s => s.sortMode)
  const setSort = useStore(s => s.setSort)
  const setBounties = useStore(s => s.setBounties)
  const showToast = useStore(s => s.showToast)
  const [fetching, setFetching] = useState(false)
  const [showProfile, setShowProfile] = useState(false)
  const profileBtnRef = useRef<HTMLButtonElement>(null)

  // Close dropdown on outside click
  useEffect(() => {
    if (!showProfile) return
    const handler = (e: MouseEvent) => {
      const target = e.target as Node
      const dropdown = document.getElementById('profile-dropdown')
      if (dropdown && !dropdown.contains(target) && !profileBtnRef.current?.contains(target)) {
        setShowProfile(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [showProfile])

  const handleFetch = async () => {
    setFetching(true)
    showToast('Fetching latest bounties...', 'info')
    try {
      const res = await fetch('/api/bounties/refresh', { method: 'POST' })
      if (!res.ok) throw new Error('Fetch failed')
      const data = await res.json()
      const res2 = await fetch('/api/bounties')
      const bountyData = await res2.json()
      setBounties(bountyData)
      showToast(`Fetched ${data.count ?? bountyData.length} bounties`, 'success')
    } catch (e) {
      showToast('Fetch failed — check backend', 'error')
    } finally {
      setFetching(false)
    }
  }

  return (
    <div className="topbar">
      <div className="topbar-inner">
        <a className="logo" href="#">
          <span className="logo-mark">B</span>
          <span className="logo-text">Bounty Hunter</span>
        </a>
        <div className="topbar-right">
          <span className="pill"><strong>{bounties.length}</strong> bounties</span>
          <select
            className="sort-sel"
            value={sortMode}
            onChange={e => setSort(e.target.value as typeof sortMode)}
          >
            <option value="reward-desc">Reward ↓</option>
            <option value="reward-asc">Reward ↑</option>
            <option value="deadline">Deadline</option>
            <option value="source">Source</option>
          </select>
          <div className="profile-wrap">
            <button
              ref={profileBtnRef}
              className={`fetch-btn ${showProfile ? 'active' : ''}`}
              onClick={() => setShowProfile(v => !v)}
              aria-label="Edit user profile"
              title="Edit profile"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/>
                <circle cx="12" cy="7" r="4"/>
              </svg>
              PROFILE
            </button>
            {showProfile && (
              <div id="profile-dropdown" className="profile-dropdown">
                <UserProfileModal onClose={() => setShowProfile(false)} />
              </div>
            )}
          </div>
          <button
            className={`fetch-btn ${fetching ? 'fetching' : ''}`}
            onClick={handleFetch}
            disabled={fetching}
            aria-label="Fetch latest bounties"
            title="Fetch latest bounties"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="23 4 23 10 17 10"/>
              <polyline points="1 20 1 14 7 14"/>
              <path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15"/>
            </svg>
            {fetching ? 'FETCHING...' : 'FETCH'}
          </button>
        </div>
      </div>
    </div>
  )
}
