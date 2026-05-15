import { useEffect } from 'react'
import { useStore } from './stores/bountyStore'
import { useApi } from './hooks/useApi'
import Topbar from './components/Topbar'
import Hero from './components/Hero'
import SecondaryNav from './components/SecondaryNav'
import BountyGrid from './components/BountyGrid'
import KanbanBoard from './components/KanbanBoard'
import DraftPanel from './components/DraftPanel'
import XSearchPanel from './components/XSearchPanel'
import FilterSidebar from './components/FilterSidebar'
import ChatBox from './components/ChatBox'
import Toast from './components/Toast'

export default function App() {
  const currentTab = useStore(s => s.currentTab)
  const { loadAll } = useApi()

  useEffect(() => {
    loadAll()
  }, [])

  const showSidebar = !['kanban', 'draft', 'search'].includes(currentTab) // draft = workspace tab

  const renderContent = () => {
    switch (currentTab) {
      case 'kanban':
        return (
          <>
            <Hero />
            <SecondaryNav />
            <KanbanBoard />
          </>
        )
      case 'draft':
        return (
          <>
            <Hero />
            <SecondaryNav />
            <DraftPanel />
          </>
        )
      case 'search':
        return (
          <>
            <Hero />
            <SecondaryNav />
            <XSearchPanel />
          </>
        )
      default:
        return (
          <>
            <Hero />
            <SecondaryNav />
            <div className="main-layout">
              <FilterSidebar />
              <div className="main-content">
                <BountyGrid />
              </div>
            </div>
          </>
        )
    }
  }

  return (
    <>
      <Topbar />
      {renderContent()}
      <Toast />
      <ChatBox />
    </>
  )
}
