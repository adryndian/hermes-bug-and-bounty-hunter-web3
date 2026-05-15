import { useState, useRef, useCallback } from 'react'
import { createPortal } from 'react-dom'

interface Props {
  text: string
  children: React.ReactElement
  pos?: 'top' | 'bottom'
}

export default function Tooltip({ text, children, pos = 'top' }: Props) {
  const [visible, setVisible] = useState(false)
  const [coords, setCoords] = useState({ x: 0, y: 0 })
  const ref = useRef<HTMLElement | null>(null)

  const show = useCallback((e: React.MouseEvent) => {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
    setCoords({
      x: rect.left + rect.width / 2,
      y: pos === 'top' ? rect.top - 8 : rect.bottom + 8,
    })
    setVisible(true)
  }, [pos])

  const hide = useCallback(() => setVisible(false), [])

  const child = children as React.ReactElement<any>
  const cloned = {
    ...child,
    props: {
      ...child.props,
      onMouseEnter: (e: React.MouseEvent) => {
        show(e)
        child.props.onMouseEnter?.(e)
      },
      onMouseLeave: (e: React.MouseEvent) => {
        hide()
        child.props.onMouseLeave?.(e)
      },
      ref,
    },
  }

  return (
    <>
      {cloned}
      {visible && createPortal(
        <div
          style={{
            position: 'fixed',
            left: coords.x,
            top: pos === 'top' ? coords.y : undefined,
            bottom: pos === 'bottom' ? `calc(100vh - ${coords.y}px)` : undefined,
            transform: 'translateX(-50%)',
            background: 'var(--ink)',
            color: '#fff',
            fontSize: '11px',
            fontFamily: 'var(--font)',
            fontWeight: 500,
            whiteSpace: 'nowrap',
            padding: '4px 8px',
            pointerEvents: 'none',
            zIndex: 99999,
            letterSpacing: '0.2px',
          }}
        >
          {text}
        </div>,
        document.body
      )}
    </>
  )
}
