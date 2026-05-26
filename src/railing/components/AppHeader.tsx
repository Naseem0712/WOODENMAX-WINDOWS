import { CompanyLogo } from './CompanyLogo'
import { COMPANY } from '../constants'
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
}: Props) {
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
    <header className="app-header app-header-slim no-print">
      <div className="hdr-row">
        <div className="brand brand-slim">
          <CompanyLogo size={36} />
          <div>
            <h1>{COMPANY.name}</h1>
            <p className="hdr-sub">Railing quotation</p>
          </div>
        </div>

        <div className="hdr-live-totals" aria-live="polite">
          {quoteLineCount > 0 && (
            <span className="hdr-total-chip">
              Quote <strong>{formatCurrency(quoteGrandTotal)}</strong>
              <small> ({quoteLineCount})</small>
            </span>
          )}
          {designLiveTotal != null && (
            <span className="hdr-total-chip hdr-total-design">
              Design <strong>{formatCurrency(designLiveTotal)}</strong>
              {designLabel ? <small> · {designLabel}</small> : null}
            </span>
          )}
        </div>
      </div>

      <nav className="hdr-nav" aria-label="Panels">
        <button
          type="button"
          className="hdr-nav-btn hdr-undo"
          onClick={onUndo}
          disabled={!canUndo}
          title="Undo design change (Ctrl+Z)"
        >
          ↶ Undo
        </button>
        <button
          type="button"
          className="hdr-nav-btn hdr-redo"
          onClick={onRedo}
          disabled={!canRedo}
          title="Redo (Ctrl+Y)"
        >
          ↷ Redo
        </button>
        <span className="hdr-nav-sep" aria-hidden="true" />
        {navBtn('quotation', 'Quotation', quoteLineCount)}
        {navBtn('rates', 'Rates')}
        {navBtn('bom', 'BOM')}
        {navBtn('order', 'Order')}
        {navBtn('tools', 'Tools')}
        <button
          type="button"
          className="hdr-nav-btn hdr-nav-dl"
          onClick={onDownloadBom}
          disabled={!canDownloadBom}
          title="Download order BOM (CSV)"
        >
          ↓ BOM
        </button>
      </nav>
    </header>
  )
}
