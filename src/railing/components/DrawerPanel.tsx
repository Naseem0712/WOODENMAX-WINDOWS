import type { ReactNode } from 'react'
import { createPortal } from 'react-dom'

interface Props {
  open: boolean
  title: string
  onClose: () => void
  children: ReactNode
  wide?: boolean
}

export function DrawerPanel({ open, title, onClose, children, wide }: Props) {
  if (!open || typeof document === 'undefined') return null

  return createPortal(
    <div className="drawer-root no-print" role="dialog" aria-modal="true" aria-label={title}>
      <button type="button" className="drawer-backdrop" onClick={onClose} aria-label="Close panel" />
      <aside className={`drawer-panel ${wide ? 'drawer-wide' : ''}`}>
        <header className="drawer-head">
          <h2>{title}</h2>
          <button type="button" className="drawer-close" onClick={onClose} aria-label="Close">
            ×
          </button>
        </header>
        <div className="drawer-body">{children}</div>
      </aside>
    </div>,
    document.body,
  )
}
