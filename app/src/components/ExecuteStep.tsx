import { useState, useRef, useEffect } from 'react'
import type { DraftWorkspace } from '../types'

interface Props {
  bountyId: string
  workspace: DraftWorkspace
  onComplete: () => void
}

interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

interface ChecklistItem {
  text: string
  done: boolean
}

export default function ExecuteStep({ bountyId, onComplete }: Props) {
  const [checklist, setChecklist] = useState<ChecklistItem[]>([])
  const [loadingChecklist, setLoadingChecklist] = useState(false)
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([])
  const [chatInput, setChatInput] = useState('')
  const [chatLoading, setChatLoading] = useState(false)
  const chatEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [chatMessages])

  const generateChecklist = async () => {
    setLoadingChecklist(true)
    try {
      const res = await fetch('/api/copilot/generate-checklist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bounty_id: bountyId })
      })
      const data = await res.json()
      if (data.ok && data.checklist) {
        setChecklist(data.checklist)
      }
    } catch (e) {
      console.error('Checklist generation failed:', e)
    }
    setLoadingChecklist(false)
  }

  const toggleCheckItem = async (idx: number) => {
    const updated = checklist.map((item, i) =>
      i === idx ? { ...item, done: !item.done } : item
    )
    setChecklist(updated)
    // Persist to backend
    fetch('/api/copilot/checklist', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ bounty_id: bountyId, checklist: updated })
    })
  }

  const sendChat = async () => {
    if (!chatInput.trim() || chatLoading) return
    const msg = chatInput.trim()
    setChatInput('')
    setChatMessages(prev => [...prev, { role: 'user', content: msg }])
    setChatLoading(true)
    try {
      const res = await fetch('/api/copilot/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bounty_id: bountyId, message: msg })
      })
      const data = await res.json()
      if (data.ok && data.reply) {
        setChatMessages(prev => [...prev, { role: 'assistant', content: data.reply }])
      } else {
        setChatMessages(prev => [...prev, { role: 'assistant', content: `Error: ${data.error || 'Unknown error'}` }])
      }
    } catch (e) {
      setChatMessages(prev => [...prev, { role: 'assistant', content: 'Failed to reach copilot.' }])
    }
    setChatLoading(false)
  }

  const allDone = checklist.length > 0 && checklist.every(item => item.done)

  return (
    <div className="dw-step-content execute-step">
      <div className="execute-layout">
        {/* Left: Checklist */}
        <div className="execute-checklist">
          <div className="execute-section-header">
            <h4>📋 Checklist</h4>
            {checklist.length === 0 && (
              <button
                className={`dw-action-btn primary small ${loadingChecklist ? 'loading' : ''}`}
                onClick={generateChecklist}
                disabled={loadingChecklist}
              >
                {loadingChecklist ? '⏳ Generating...' : '✨ Generate'}
              </button>
            )}
          </div>
          {checklist.length > 0 && (
            <div className="execute-checklist-items">
              {checklist.map((item, i) => (
                <label key={i} className={`execute-check-item ${item.done ? 'done' : ''}`}>
                  <input
                    type="checkbox"
                    checked={item.done}
                    onChange={() => toggleCheckItem(i)}
                  />
                  <span>{item.text}</span>
                </label>
              ))}
              <div className="execute-checklist-progress">
                {checklist.filter(i => i.done).length}/{checklist.length} completed
              </div>
            </div>
          )}
          {allDone && (
            <button className="dw-action-btn primary" onClick={onComplete}>
              ✓ All Done — Move to Review →
            </button>
          )}
          {checklist.length > 0 && !allDone && (
            <button className="dw-action-btn secondary small" onClick={onComplete}>
              Skip to Review →
            </button>
          )}
        </div>

        {/* Right: Copilot Chat */}
        <div className="execute-copilot">
          <div className="execute-section-header">
            <h4>🤖 Co-pilot</h4>
          </div>
          <div className="execute-chat-messages">
            {chatMessages.length === 0 && (
              <div className="execute-chat-empty">
                Ask anything about this bounty — strategy, code help, review, etc.
              </div>
            )}
            {chatMessages.map((msg, i) => (
              <div key={i} className={`execute-chat-msg ${msg.role}`}>
                <div className="execute-chat-bubble">
                  {msg.content}
                </div>
              </div>
            ))}
            {chatLoading && (
              <div className="execute-chat-msg assistant">
                <div className="execute-chat-bubble loading">⏳ Thinking...</div>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>
          <div className="execute-chat-input">
            <input
              type="text"
              placeholder="Ask co-pilot..."
              value={chatInput}
              onChange={e => setChatInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && sendChat()}
              disabled={chatLoading}
            />
            <button onClick={sendChat} disabled={chatLoading || !chatInput.trim()}>
              Send
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
