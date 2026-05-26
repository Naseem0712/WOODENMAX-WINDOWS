import type { ReactNode } from 'react'

interface Props {
  id: string
  title: ReactNode
  subtitle?: ReactNode
  open: boolean
  onToggle: () => void
  children: ReactNode
  className?: string
}

export function CollapsiblePanel({
  id,
  title,
  subtitle,
  open,
  onToggle,
  children,
  className = '',
}: Props) {
  return (
    <section className={`collapse-panel ${open ? 'is-open' : ''} ${className}`}>
      <button
        type="button"
        className="collapse-panel-toggle"
        onClick={onToggle}
        aria-expanded={open}
        aria-controls={`${id}-body`}
      >
        <span className="collapse-panel-title">{title}</span>
        {subtitle && <span className="collapse-panel-sub">{subtitle}</span>}
        <span className="collapse-panel-chevron" aria-hidden>
          {open ? '▼' : '▶'}
        </span>
      </button>
      {open && (
        <div id={`${id}-body`} className="collapse-panel-body">
          {children}
        </div>
      )}
    </section>
  )
}
