import { useState, useRef, useEffect } from 'react'
import Markdown from 'react-markdown'
import { useStore } from '../stores/bountyStore'
import { useApi } from '../hooks/useApi'
import type { ChatModel } from '../types'

const MODEL_GROUPS = [
  {
    label: '9Router (KR)',
    models: [
      { id: 'kr/claude-opus-4.7' as ChatModel, name: 'Claude Opus 4.7' },
      { id: 'kr/claude-opus-4.6' as ChatModel, name: 'Claude Opus 4.6' },
      { id: 'kr/claude-sonnet-4.6' as ChatModel, name: 'Claude Sonnet 4.6' },
      { id: 'kr/claude-sonnet-4.5' as ChatModel, name: 'Claude Sonnet 4.5' },
    ],
  },
  {
    label: 'Fireworks (9Router)',
    models: [
      { id: 'fireworks/accounts/fireworks/models/deepseek-v4-pro' as ChatModel, name: 'DeepSeek V4' },
      { id: 'fireworks/accounts/fireworks/models/kimi-k2p6' as ChatModel, name: 'Kimi 2.6' },
      { id: 'fireworks/accounts/fireworks/models/minimax-m2p7' as ChatModel, name: 'MiniMax 2.7' },
    ],
  },
  {
    label: 'OpenAI (Hermes)',
    models: [
      { id: 'hermes:cx/gpt-5.5' as ChatModel, name: 'ChatGPT 5.5' },
      { id: 'hermes:cx/gpt-5.4' as ChatModel, name: 'GPT 5.4' },
      { id: 'hermes:cx/gpt-5.3-codex-high' as ChatModel, name: 'GPT 5.3 Codex High' },
      { id: 'hermes:cx/gpt-5.3-codex-xhigh' as ChatModel, name: 'GPT 5.3 Codex xHigh' },
    ],
  },
]

export default function ChatBox() {
  const chatOpen = useStore(s => s.chatOpen)
  const chatMessages = useStore(s => s.chatMessages)
  const chatModel = useStore(s => s.chatModel)
  const chatLoading = useStore(s => s.chatLoading)
  const toggleChat = useStore(s => s.toggleChat)
  const setChatModel = useStore(s => s.setChatModel)
  const addChatMessage = useStore(s => s.addChatMessage)
  const setChatLoading = useStore(s => s.setChatLoading)
  const clearChat = useStore(s => s.clearChat)
  const attachedBounty = useStore(s => s.attachedBounty)
  const detachBounty = useStore(s => s.detachBounty)
  const bounties = useStore(s => s.bounties)
  const analysis = useStore(s => s.analysis)

  const attached = attachedBounty ? bounties.find(b => b.id === attachedBounty) : null
  const attachedAnalysis = attachedBounty ? analysis[attachedBounty] : null

  const { sendChat } = useApi()
  const [input, setInput] = useState('')
  const [attachments, setAttachments] = useState<{ name: string; type: string; dataUrl: string }[]>([])
  const messagesRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const imageInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (messagesRef.current) {
      messagesRef.current.scrollTop = messagesRef.current.scrollHeight
    }
  }, [chatMessages])

  const handleSend = async () => {
    const text = input.trim()
    if ((!text && attachments.length === 0) || chatLoading) return

    if (!chatOpen) toggleChat() // auto-open panel saat send
    setInput('')
    const attachInfo = attachments.length > 0
      ? `\n[Attached: ${attachments.map(a => a.name).join(', ')}]`
      : ''
    addChatMessage({ role: 'user', content: text + attachInfo })
    setAttachments([])
    setChatLoading(true)

    try {
      const contextPrefix = attached
        ? `[Context: User is asking about bounty "${attached.title}" — Source: ${attached.source}, Reward: ${attached.reward}, Category: ${attached.category || 'N/A'}, Type: ${attached.type || 'N/A'}, URL: ${attached.url}${attachedAnalysis ? `, AI Score: ${attachedAnalysis.match_score}/10, Verdict: ${attachedAnalysis.verdict}, Summary: ${attachedAnalysis.summary}` : ''}]\n\n`
        : ''
      const messages = [...chatMessages, { role: 'user' as const, content: contextPrefix + text + attachInfo }]
      const response = await sendChat(messages, chatModel)
      addChatMessage({ role: 'assistant', content: response })
    } catch (e) {
      addChatMessage({ role: 'assistant', content: `Error: ${e instanceof Error ? e.message : 'Failed'}` })
    } finally {
      setChatLoading(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const handleCopy = (content: string) => {
    navigator.clipboard.writeText(content)
  }

  const handleDelete = (idx: number) => {
    const updated = chatMessages.filter((_, i) => i !== idx)
    // Replace all messages via clearChat + re-add
    clearChat()
    updated.forEach(msg => addChatMessage(msg))
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>, type: 'image' | 'file') => {
    const files = e.target.files
    if (!files) return
    Array.from(files).forEach(file => {
      const reader = new FileReader()
      reader.onload = () => {
        setAttachments(prev => [...prev, {
          name: file.name,
          type: type,
          dataUrl: reader.result as string
        }])
      }
      reader.readAsDataURL(file)
    })
    e.target.value = ''
  }

  const removeAttachment = (idx: number) => {
    setAttachments(prev => prev.filter((_, i) => i !== idx))
  }

  return (
    <div className="chat-backdrop">
      <div className="chat-container">
        <div className="chat-glow" />
        <div className="chat-glow-blur" />
        <div className="chat-inner">
        <div
          ref={messagesRef}
          className={`chat-messages-panel ${chatOpen ? 'open' : ''}`}
        >
          {chatOpen && chatMessages.length > 0 && (
            <div className="chat-panel-header">
              <span className="chat-panel-title">Chat</span>
              <button className="chat-panel-delete" onClick={clearChat}>Delete Chat</button>
            </div>
          )}
          {chatMessages.map((msg, idx) => (
            <div key={idx} className="chat-msg-wrapper">
              <div className={`chat-msg ${msg.role === 'user' ? 'chat-user' : 'chat-assistant'}`}>
                <div className="chat-msg-content chat-markdown">
                  <Markdown>{msg.content}</Markdown>
                </div>
              </div>
              <div className={`chat-msg-actions ${msg.role === 'user' ? 'actions-right' : 'actions-left'}`}>
                <button className="chat-msg-btn" onClick={() => handleCopy(msg.content)} title="Copy">copy</button>
                <button className="chat-msg-btn chat-msg-btn-del" onClick={() => handleDelete(idx)} title="Delete">del</button>
              </div>
            </div>
          ))}
          {chatLoading && (
            <div className="chat-msg chat-assistant">
              <span className="typing">Thinking...</span>
            </div>
          )}
        </div>

        {/* Attachments preview */}
        {attachments.length > 0 && (
          <div className="chat-attachments">
            {attachments.map((att, idx) => (
              <div key={idx} className="chat-attachment">
                <span className="chat-attachment-icon">{att.type === 'image' ? 'IMG' : 'FILE'}</span>
                <span className="chat-attachment-name">{att.name}</span>
                <button className="chat-attachment-remove" onClick={() => removeAttachment(idx)}>✕</button>
              </div>
            ))}
          </div>
        )}

        {attached && (
          <div className="chat-attached-strip">
            <div className="chat-attached-info">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>
              <span className="chat-attached-title">{attached.title}</span>
              <span className="chat-attached-meta">{attached.source} · {attached.reward}</span>
            </div>
            <button className="chat-attached-remove" onClick={detachBounty}>✕</button>
          </div>
        )}
        <div className="chat-input-bar">
          <button className="chat-toggle-btn" onClick={toggleChat} title={chatOpen ? "Collapse" : "Expand"}>
            {chatOpen ? '▼' : '▲'}
          </button>
          <div className="chat-input-field">
            <button className="chat-upload-btn" data-tooltip-pos="top" onClick={() => imageInputRef.current?.click()} title="Upload image">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/></svg>
            </button>
            <button className="chat-upload-btn" data-tooltip-pos="top" onClick={() => fileInputRef.current?.click()} title="Upload file">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48"/></svg>
            </button>
            <textarea
              placeholder="Ask about bounties..."
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              rows={1}
            />
          </div>
          <button
            className="chat-send-btn" data-tooltip-pos="top"
            onClick={handleSend}
            disabled={chatLoading || (!input.trim() && attachments.length === 0)}
          >
            ↑
          </button>
        </div>

        <div className="chat-bottom-row">
          <span className="chat-hint">ENTER send · SHIFT+ENTER newline</span>
          <button className="chat-clear-btn" onClick={clearChat} title="Clear chat">CLR</button>
          <select
            className="chat-model-select"
            value={chatModel}
            onChange={e => setChatModel(e.target.value as ChatModel)}
          >
            {MODEL_GROUPS.map(group => (
              <optgroup key={group.label} label={group.label}>
                {group.models.map(model => (
                  <option key={model.id} value={model.id}>
                    {model.name}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        </div>

        {/* Hidden file inputs */}
        <input
          ref={imageInputRef}
          type="file"
          accept="image/*"
          multiple
          style={{ display: 'none' }}
          onChange={e => handleFileSelect(e, 'image')}
        />
        <input
          ref={fileInputRef}
          type="file"
          multiple
          style={{ display: 'none' }}
          onChange={e => handleFileSelect(e, 'file')}
        />
        </div>
      </div>
    </div>
  )
}
