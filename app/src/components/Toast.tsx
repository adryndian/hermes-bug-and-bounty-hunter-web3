import { useEffect } from 'react'
import { useStore } from '../stores/bountyStore'

export default function Toast() {
  const toast = useStore(s => s.toast)
  const hideToast = useStore(s => s.hideToast)
  const setTab = useStore(s => s.setTab)

  useEffect(() => {
    if (!toast) return
    const timer = setTimeout(hideToast, 5000)
    return () => clearTimeout(timer)
  }, [toast])

  if (!toast) return null

  return (
    <div className={`toast toast--${toast.type}`}>
      <span className="toast-message">{toast.message}</span>
      {toast.bountyId && (
        <button
          className="toast-action"
          onClick={() => { setTab('draft'); hideToast() }}
        >
          → Draft
        </button>
      )}
      <button className="toast-close" onClick={hideToast}>×</button>
    </div>
  )
}
