import { useState } from 'react'
import {
  DndContext,
  DragOverlay,
  closestCorners,
  PointerSensor,
  useSensor,
  useSensors,
  type DragStartEvent,
  type DragEndEvent,
  type DragOverEvent,
} from '@dnd-kit/core'
import { useDroppable } from '@dnd-kit/core'
import { useDraggable } from '@dnd-kit/core'
import { useStore } from '../stores/bountyStore'
import Tooltip from './Tooltip'
import type { Bounty, KanbanStatus } from '../types'

const COLUMNS: { id: KanbanStatus; label: string }[] = [
  { id: 'draft', label: 'Draft' },
  { id: 'todo', label: 'Todo' },
  { id: 'in_progress', label: 'In Progress' },
  { id: 'ready', label: 'Ready' },
  { id: 'submitted', label: 'Submitted' },
  { id: 'won', label: 'Won' },
]

const BOTTOM_COLUMNS: { id: KanbanStatus; label: string }[] = [
  { id: 'lost', label: 'Lost' },
  { id: 'archived', label: 'Archived' },
]

function KanbanCardDraggable({ bounty, status, onClick, onOpenWorkspace, onArchive, onDelete, onAsk }: {
  bounty: Bounty
  status: KanbanStatus
  onClick: () => void
  onOpenWorkspace: () => void
  onArchive: () => void
  onDelete: () => void
  onAsk: () => void
}) {
  const drafts = useStore(s => s.drafts)
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: bounty.id,
  })

  const style = transform
    ? { transform: `translate(${transform.x}px, ${transform.y}px)` }
    : undefined

  const daysLeft = (() => {
    if (!bounty.deadline) return null
    const diff = Math.ceil((new Date(bounty.deadline).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
    return diff
  })()

  const draft = drafts[bounty.id]
  const ws = draft?.workspace
  const wsProgress = ws ? Object.values(ws.steps).filter(s => s === 'done').length : 0

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`kanban-card ${isDragging ? 'dragging' : ''}`}
      {...listeners}
      {...attributes}
    >
      <div className="kanban-card-title" onClick={onClick}>{bounty.title}</div>
      <div className="kanban-card-meta">
        <span className="kanban-card-reward">{bounty.reward}</span>
        {daysLeft !== null && <span className="kanban-card-source">{daysLeft}d</span>}
      </div>
      {ws && (
        <div className="kanban-card-draft-progress">
          <div className="kanban-draft-dots">
            {(['research', 'generate', 'execute', 'review', 'finalize', 'submit'] as const).map(step => (
              <span key={step} className={`kanban-draft-dot kd-${ws.steps[step]}`} />
            ))}
          </div>
          <span className="kanban-draft-label">{wsProgress}/6</span>
        </div>
      )}
      <div className="kanban-card-actions">
        <Tooltip text="Open Workspace">
          <button className="kanban-move-btn kanban-ws-btn" onClick={onOpenWorkspace}>
            WS
          </button>
        </Tooltip>
        <Tooltip text="Ask AI">
          <button className="kanban-move-btn kanban-ask-btn" onClick={onAsk}>
            ASK
          </button>
        </Tooltip>
        {status !== 'archived' && (
          <Tooltip text="Archive">
            <button className="kanban-move-btn kanban-archive-btn" onClick={onArchive}>
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="21 8 21 21 3 21 3 8"/><rect x="1" y="3" width="22" height="5"/><line x1="10" y1="12" x2="14" y2="12"/></svg>
            </button>
          </Tooltip>
        )}
        <Tooltip text="Remove from board">
          <button className="kanban-move-btn kanban-delete-btn" onClick={onDelete}>
            ✕
          </button>
        </Tooltip>
      </div>
    </div>
  )
}

function KanbanColumn({ column, bounties, onCardClick, onOpenWorkspace, onMove, onArchive, onDelete, onAsk }: {
  column: { id: KanbanStatus; label: string }
  bounties: Bounty[]
  onCardClick: (id: string) => void
  onOpenWorkspace: (id: string) => void
  onMove: (id: string, direction: 'left' | 'right') => void
  onArchive: (id: string) => void
  onDelete: (id: string) => void
  onAsk: (id: string) => void
}) {
  const { setNodeRef, isOver } = useDroppable({ id: column.id })

  return (
    <div className={`kanban-col ${isOver ? 'drag-over' : ''}`}>
      <div className={`kanban-col-header kanban-h-${column.id}`}>
        <span className="kanban-dot" />
        <span>{column.label}</span>
        <span className="kanban-count">{bounties.length}</span>
      </div>
      <div
        ref={setNodeRef}
        className="kanban-cards"
      >
        {bounties.map(bounty => (
          <div key={bounty.id} style={{ display: 'flex', flexDirection: 'column' }}>
            <KanbanCardDraggable
              bounty={bounty}
              status={column.id}
              onClick={() => onCardClick(bounty.id)}
              onOpenWorkspace={() => onOpenWorkspace(bounty.id)}
              onArchive={() => onArchive(bounty.id)}
              onDelete={() => onDelete(bounty.id)}
              onAsk={() => onAsk(bounty.id)}
            />
          </div>
        ))}
        {bounties.length === 0 && (
          <div className="kanban-empty">Drop here</div>
        )}
      </div>
    </div>
  )
}

export default function KanbanBoard() {
  const bounties = useStore(s => s.bounties)
  const statuses = useStore(s => s.statuses)
  const setStatus = useStore(s => s.setStatus)
  const removeStatus = useStore(s => s.removeStatus)
  const openAnalyzeModal = useStore(s => s.openAnalyzeModal)
  const showToast = useStore(s => s.showToast)
  const attachBounty = useStore(s => s.attachBounty)
  const setTab = useStore(s => s.setTab)
  const initWorkspace = useStore(s => s.initWorkspace)
  const drafts = useStore(s => s.drafts)
  const [activeId, setActiveId] = useState<string | null>(null)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  )

  const getColumnBounties = (status: KanbanStatus): Bounty[] => {
    const ids = Object.entries(statuses)
      .filter(([_, s]) => s === status)
      .map(([id]) => id)
    return bounties.filter(b => ids.includes(b.id))
  }

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string)
  }

  const handleDragOver = (_event: DragOverEvent) => {
    // Visual feedback handled by isOver
  }

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    setActiveId(null)

    if (!over) return

    const bountyId = active.id as string
    const targetColumn = over.id as KanbanStatus

    if ([...COLUMNS, ...BOTTOM_COLUMNS].some(c => c.id === targetColumn)) {
      setStatus(bountyId, targetColumn)
    }
  }

  const handleMove = (bountyId: string, direction: 'left' | 'right') => {
    const currentStatus = statuses[bountyId]
    if (!currentStatus) return

    const allCols = [...COLUMNS, ...BOTTOM_COLUMNS]
    const currentIdx = allCols.findIndex(c => c.id === currentStatus)
    const nextIdx = direction === 'right' ? currentIdx + 1 : currentIdx - 1

    if (nextIdx >= 0 && nextIdx < allCols.length) {
      setStatus(bountyId, allCols[nextIdx].id)
    }
  }

  const handleArchive = (bountyId: string) => {
    setStatus(bountyId, 'archived')
    const bounty = bounties.find(b => b.id === bountyId)
    showToast(`"${bounty?.title}" archived`, 'info')
  }

  const handleDelete = (bountyId: string) => {
    const bounty = bounties.find(b => b.id === bountyId)
    removeStatus(bountyId)
    showToast(`"${bounty?.title}" removed from board`, 'info')
  }

  const handleOpenWorkspace = (bountyId: string) => {
    if (drafts[bountyId] && !drafts[bountyId].workspace) {
      initWorkspace(bountyId)
    }
    setTab('draft') // 'draft' is the internal tab id for Workspace
  }

  const activeBounty = activeId ? bounties.find(b => b.id === activeId) : null

  const ALL_COLUMNS = [...COLUMNS, ...BOTTOM_COLUMNS]

  return (
    <div className="container kanban-container">
      <div className="section-label">BOUNTY PIPELINE</div>
      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
      >
        <div className="kanban">
          {COLUMNS.map(column => (
            <KanbanColumn
              key={column.id}
              column={column}
              bounties={getColumnBounties(column.id)}
              onCardClick={openAnalyzeModal}
              onOpenWorkspace={handleOpenWorkspace}
              onMove={handleMove}
              onArchive={handleArchive}
              onDelete={handleDelete}
              onAsk={attachBounty}
            />
          ))}
        </div>

        <div className="kanban-bottom-section">
          {BOTTOM_COLUMNS.map(column => (
            <KanbanColumn
              key={column.id}
              column={column}
              bounties={getColumnBounties(column.id)}
              onCardClick={openAnalyzeModal}
              onOpenWorkspace={handleOpenWorkspace}
              onMove={handleMove}
              onArchive={handleArchive}
              onDelete={handleDelete}
              onAsk={attachBounty}
            />
          ))}
        </div>

        <DragOverlay>
          {activeBounty ? (
            <div className="kanban-card">
              <div className="kanban-card-title">{activeBounty.title}</div>
              <div className="kanban-card-meta">
                <span className="kanban-card-reward">{activeBounty.reward}</span>
              </div>
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>
    </div>
  )
}
