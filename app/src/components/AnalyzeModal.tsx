import { useEffect } from 'react'
import { useStore } from '../stores/bountyStore'
import { useApi } from '../hooks/useApi'

export default function AnalyzeModal() {
  const analyzeModalOpen = useStore(s => s.analyzeModalOpen)
  const analyzeModalBountyId = useStore(s => s.analyzeModalBountyId)
  const analyzeLoading = useStore(s => s.analyzeLoading)
  const closeAnalyzeModal = useStore(s => s.closeAnalyzeModal)
  const setAnalyzeLoading = useStore(s => s.setAnalyzeLoading)
  const bounties = useStore(s => s.bounties)
  const drafts = useStore(s => s.drafts)
  const setDraft = useStore(s => s.setDraft)
  const setStatus = useStore(s => s.setStatus)
  const toggleDraftTask = useStore(s => s.toggleDraftTask)
  const setTab = useStore(s => s.setTab)

  const { deepAnalyze } = useApi()

  const bounty = analyzeModalBountyId ? bounties.find(b => b.id === analyzeModalBountyId) : null
  const draft = analyzeModalBountyId ? drafts[analyzeModalBountyId] : null

  useEffect(() => {
    if (!analyzeModalOpen || !analyzeModalBountyId || !bounty) return
    if (draft) {
      setAnalyzeLoading(false)
      return
    }

    let cancelled = false
    const run = async () => {
      try {
        const result = await deepAnalyze(bounty)
        if (cancelled) return
        const newDraft = { ...result, checked: new Array(result.tasks?.length || 0).fill(false) }
        setDraft(analyzeModalBountyId, newDraft)
      } catch (e) {
        console.error('Modal analysis failed:', e)
      } finally {
        if (!cancelled) setAnalyzeLoading(false)
      }
    }
    run()
    return () => { cancelled = true }
  }, [analyzeModalOpen, analyzeModalBountyId])

  if (!analyzeModalOpen || !bounty) return null

  const handleGoToDraft = () => {
    closeAnalyzeModal()
    setTab('draft')
  }

  const handleToKanban = () => {
    if (analyzeModalBountyId) {
      setStatus(analyzeModalBountyId, 'draft')
    }
    closeAnalyzeModal()
    setTab('kanban')
  }

  return (
    <div className="modal-backdrop open" onClick={closeAnalyzeModal}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title">{bounty.title}</div>
          <button className="modal-close" onClick={closeAnalyzeModal}>×</button>
        </div>

        <div className="modal-body">
          {analyzeLoading ? (
            <div className="modal-loading">
              <div className="spinner" />
              <div>Analyzing bounty...</div>
            </div>
          ) : draft ? (
            <>
              <div className="modal-section">
                <div className="modal-section-label">
                  <span className="num">1</span> About
                </div>
                <div className="modal-section-content">{draft.about}</div>
              </div>
              <div className="modal-section">
                <div className="modal-section-label">
                  <span className="num">2</span> Mission
                </div>
                <div className="modal-section-content">{draft.mission}</div>
              </div>
              <div className="modal-section">
                <div className="modal-section-label">
                  <span className="num">3</span> Scope
                </div>
                <div className="modal-section-content">{draft.scope}</div>
              </div>
              <div className="modal-section">
                <div className="modal-section-label">
                  <span className="num">4</span> Submission Requirements
                </div>
                <div className="modal-section-content">{draft.submission_requirements}</div>
              </div>
              <div className="modal-section">
                <div className="modal-section-label">
                  <span className="num">5</span> Judging Criteria
                </div>
                <div className="modal-section-content">{draft.judging_criteria}</div>
              </div>

              {draft.tasks && draft.tasks.length > 0 && (
                <div className="draft-panel">
                  <div className="draft-title">Task Breakdown</div>
                  <div className="task-list">
                    {draft.tasks.map((task, idx) => (
                      <div key={idx} className="task-item">
                        <div
                          className={`task-check ${draft.checked[idx] ? 'checked' : ''}`}
                          onClick={() => analyzeModalBountyId && toggleDraftTask(analyzeModalBountyId, idx)}
                        >
                          {draft.checked[idx] ? '✓' : ''}
                        </div>
                        <span className={`task-text ${draft.checked[idx] ? 'done' : ''}`}>{task}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="modal-loading">Analysis not available</div>
          )}
        </div>

        {draft && (
          <div className="modal-actions">
            <button className="modal-btn" onClick={closeAnalyzeModal}>Close</button>
            <button className="modal-btn modal-btn-primary" onClick={handleGoToDraft}>Go to Draft</button>
            <button className="modal-btn" onClick={handleToKanban}>→ To Kanban</button>
          </div>
        )}
      </div>
    </div>
  )
}
