import { useStore } from '../stores/bountyStore'
import type { Tab } from '../types'

const filterTabs: { id: Tab; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'search', label: 'X Search' },
  { id: 'superteam', label: 'Superteam' },
  { id: 'code4rena', label: 'Code4rena' },
  { id: 'immunefi', label: 'Immunefi' },
  { id: 'sherlock', label: 'Sherlock' },
]

const actionTabs: { id: Tab; label: string }[] = [
  { id: 'bookmarks', label: 'Saved' },
  { id: 'draft', label: 'Workspace' },
  { id: 'kanban', label: 'Kanban' },
]

export default function SecondaryNav() {
  const currentTab = useStore(s => s.currentTab)
  const setTab = useStore(s => s.setTab)

  return (
    <div className="secondary-nav">
      <div className="secondary-nav-inner">
        {/* Left: filter tabs */}
        <div className="sec-nav-filters">
          {filterTabs.map(tab => (
            <button
              key={tab.id}
              className={`sec-btn ${currentTab === tab.id ? 'active' : ''}`}
              onClick={() => setTab(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Right: action tabs */}
        <div className="sec-nav-actions">
          {actionTabs.map(tab => (
            <button
              key={tab.id}
              className={`sec-btn ${currentTab === tab.id ? 'active' : ''}`}
              onClick={() => setTab(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
