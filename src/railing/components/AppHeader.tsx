import { useEffect, useState, type ReactNode } from 'react'
import { CompanyLogo } from './CompanyLogo'
import { formatCurrency } from '../utils'

export type HeaderDrawer = 'quotation' | 'rates' | 'bom' | 'order' | 'tools' | null

interface Props {
  activeDrawer: HeaderDrawer
  onOpenDrawer: (id: NonNullable<HeaderDrawer>) => void
  onDownloadBom: () => void
  canDownloadBom: boolean
  quoteLineCount: number
  quoteGrandTotal: number
  designLiveTotal: number | null
  designLabel: string
  canUndo: boolean
  canRedo: boolean
  onUndo: () => void
  onRedo: () => void
  quickActions?: ReactNode
}

function useHeaderNavOpenDefault(): boolean {
  const [open, setOpen] = useState(() => {
    if (typeof window === 'undefined') return true
    return window.matchMedia('(min-width: 961px)').matches
  })
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 961px)')
    const sync = () => setOpen(mq.matches)
    mq.addEventListener('change', sync)
    return () => mq.removeEventListener('change', sync)
  }, [])
  return [open, setOpen] as const
}

export function AppHeader({
  activeDrawer,
  onOpenDrawer,
  onDownloadBom,
  canDownloadBom,
  quoteLineCount,
  quoteGrandTotal,
  designLiveTotal,
  designLabel,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  quickActions,
}: Props) {
  const [navOpen, setNavOpen] = useHeaderNavOpenDefault()

  const navBtn = (id: NonNullable<HeaderDrawer>, label: string, badge?: number) => (
    <button
      key={id}
      type="button"
      className={`hdr-nav-btn ${activeDrawer === id ? 'active' : ''}`}
      onClick={() => onOpenDrawer(id)}
    >
      {label}
      {badge != null && badge > 0 ? <span className="hdr-badge">{badge}</span> : null}
    </button>
  )

  return (
    <header
      className={`app-header app-header-slim no-print ${navOpen ? 'hdr-expanded' : 'hdr-collapsed'}`}
    >
      <div className="hdr-bar">
        <button
          type="button"
          className="hdr-collapse-btn"
          onClick={() => setNavOpen((o) => !o)}
          aria-expanded={navOpen}
          aria-controls="hdr-nav-panel"
        >
          <span className="hdr-collapse-icon" aria-hidden="true">
            {navOpen ? '▲' : '☰'}
          </span>
          <span className="hdr-collapse-label">{navOpen ? 'Less' : 'Menu'}</span>
        </button>

        <div className="hdr-brand" title="WoodenMax — Railing quotation">
          <CompanyLogo size={28} />
          <div className="hdr-brand-text">
            <span className="hdr-brand-name">WoodenMax</span>
            <span className="hdr-brand-tag">Railing</span>
          </div>
        </div>

        <div className="hdr-live-totals" aria-live="polite">
          {quoteLineCount > 0 && (
            <span className="hdr-total-chip hdr-total-quote">
              <span className="hdr-chip-k">Quote</span>
              <strong>{formatCurrency(quoteGrandTotal)}</strong>
              <small>({quoteLineCount})</small>
            </span>
          )}
          {designLiveTotal != null && (
            <span className="hdr-total-chip hdr-total-design hdr-total-design--optional">
              <span className="hdr-chip-k">Design</span>
              <strong>{formatCurrency(designLiveTotal)}</strong>
              {designLabel ? <small> · {designLabel}</small> : null}
            </span>
          )}
        </div>

        {quickActions ? (
          <div className="hdr-quick-actions">{quickActions}</div>
        ) : null}
      </div>

      <nav
        id="hdr-nav-panel"
        className={`hdr-nav ${navOpen ? 'is-open' : ''}`}
        aria-label="Panels"
      >
        <button
          type="button"
          className="hdr-nav-btn hdr-undo"
          onClick={onUndo}
          disabled={!canUndo}
          title="Undo (Ctrl+Z)"
        >
          ↶
        </button>
        <button
          type="button"
          className="hdr-nav-btn hdr-redo"
          onClick={onRedo}
          disabled={!canRedo}
          title="Redo (Ctrl+Y)"
        >
          ↷
        </button>
        <span className="hdr-nav-sep" aria-hidden="true" />
        {navBtn('quotation', 'Quote', quoteLineCount)}
        {navBtn('rates', 'Rates')}
        {navBtn('bom', 'BOM')}
        {navBtn('order', 'Order')}
        {navBtn('tools', 'Tools')}
        <button
          type="button"
          className="hdr-nav-btn hdr-nav-dl"
          onClick={onDownloadBom}
          disabled={!canDownloadBom}
          title="Download BOM CSV"
        >
          ↓ BOM
        </button>
      </nav>
    </header>
  )
}
