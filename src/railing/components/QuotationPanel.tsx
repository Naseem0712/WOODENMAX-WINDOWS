import { quoteLineAmount, quoteTotals, quoteUnitForLine } from '../quotationFormat'
import { formatCurrency } from '../utils'
import type { CostingRates, QuotationLine, QuotationMeta } from '../types'

interface Props {
  meta: QuotationMeta
  onMetaChange: (meta: QuotationMeta) => void
  lines: QuotationLine[]
  ratesNormal: CostingRates
  ratesStaircase: CostingRates
  editingLineId: string | null
  onEdit: (id: string) => void
  onRemove: (id: string) => void
  onClear: () => void
  onPrint: () => void
  onPreview: () => void
}

export function QuotationPanel({
  meta,
  onMetaChange,
  lines,
  ratesNormal,
  ratesStaircase,
  editingLineId,
  onEdit,
  onRemove,
  onClear,
  onPrint,
  onPreview,
}: Props) {
  const { subtotal, gst, grand } = quoteTotals(lines)
  const unitLabel =
    lines.length > 0
      ? [...new Set(lines.map((l) => quoteUnitForLine(l).toUpperCase()))].join(' / ')
      : `Normal ${ratesNormal.quoteDisplayUnit.toUpperCase()} · Staircase ${ratesStaircase.quoteDisplayUnit.toUpperCase()}`

  return (
    <div className="quote-panel quote-panel-drawer">
      <p className="hint quote-drawer-hint">
        Client details &amp; product list — print/PDF uses professional layout. Quote units:{' '}
        <strong>{unitLabel}</strong>
      </p>

      <div className="meta-fields">
        <label className="field">
          <span>Client name</span>
          <input
            value={meta.clientName}
            onChange={(e) => onMetaChange({ ...meta, clientName: e.target.value })}
          />
        </label>
        <label className="field">
          <span>Client phone</span>
          <input
            value={meta.clientPhone}
            onChange={(e) => onMetaChange({ ...meta, clientPhone: e.target.value })}
          />
        </label>
        <label className="field">
          <span>Client address</span>
          <input
            value={meta.clientAddress}
            onChange={(e) => onMetaChange({ ...meta, clientAddress: e.target.value })}
          />
        </label>
        <label className="field">
          <span>Project</span>
          <input
            value={meta.projectName}
            onChange={(e) => onMetaChange({ ...meta, projectName: e.target.value })}
          />
        </label>
        <label className="field">
          <span>Quote #</span>
          <input
            value={meta.quoteNumber}
            onChange={(e) => onMetaChange({ ...meta, quoteNumber: e.target.value })}
          />
        </label>
        <label className="field">
          <span>Date</span>
          <input
            type="date"
            value={meta.date}
            onChange={(e) => onMetaChange({ ...meta, date: e.target.value })}
          />
        </label>
        <label className="field full">
          <span>Quotation description (print intro)</span>
          <textarea
            rows={3}
            value={meta.introText ?? ''}
            placeholder="Opening paragraph on printed quotation…"
            onChange={(e) => onMetaChange({ ...meta, introText: e.target.value })}
          />
        </label>
        <label className="field full">
          <span>Terms &amp; conditions (one line per point)</span>
          <textarea
            rows={6}
            value={meta.termsText ?? ''}
            placeholder="One term per line…"
            onChange={(e) => onMetaChange({ ...meta, termsText: e.target.value })}
          />
        </label>
      </div>

      {lines.length === 0 ? (
        <p className="empty-quote">Add design with costing rates filled.</p>
      ) : (
        <div className="quote-lines">
          {lines.map((line, i) => (
            <article
              key={line.id}
              className={`quote-line ${editingLineId === line.id ? 'quote-line-editing' : ''}`}
            >
              <div className="line-top">
                <span className="line-num">#{i + 1}</span>
                <strong>{line.designName || line.designLabel}</strong>
                <div className="line-actions">
                  <button type="button" className="btn-edit-line" onClick={() => onEdit(line.id)}>
                    Edit
                  </button>
                  <button type="button" className="btn-icon" onClick={() => onRemove(line.id)}>
                    ×
                  </button>
                </div>
              </div>
              <p className="line-dim">{line.dimensionsText}</p>
              <p className="line-glass">
                {line.costing?.glassAreaSft ?? '—'} SFT · {line.glassLabel}
              </p>
              <p className="line-hw">{line.hardwareLabel}</p>
              <ul className="line-bom-mini">
                {(line.costing?.items ?? [])
                  .filter((r) => r.amount > 0)
                  .map((r, j) => (
                    <li key={j}>
                      {r.label}: {r.qty} {r.unit} @ ₹{r.rate}
                    </li>
                  ))}
              </ul>
              {line.packageQuote ? (
                <p className="line-package-rate">
                  Package: {formatCurrency(line.packageQuote.rate)}/
                  {line.packageQuote.unit.toUpperCase()} × {line.packageQuote.basisQty}{' '}
                  {line.packageQuote.unit.toUpperCase()}
                </p>
              ) : (
                <div className="line-set-rates">
                  {line.costing?.setRates?.perSft != null && (
                    <span>{formatCurrency(line.costing.setRates.perSft)}/SFT</span>
                  )}
                  {line.costing?.setRates?.perRft != null && (
                    <span>{formatCurrency(line.costing.setRates.perRft)}/RFT</span>
                  )}
                  {line.costing?.setRates?.perRmt != null && (
                    <span>{formatCurrency(line.costing.setRates.perRmt)}/RMT</span>
                  )}
                </div>
              )}
              {(line.customCharges ?? []).filter((c) => c.amount > 0).length > 0 && (
                <ul className="line-custom-charges">
                  {line.customCharges
                    .filter((c) => c.label?.trim() && c.amount > 0)
                    .map((c, j) => (
                      <li key={j}>
                        {c.label}: {formatCurrency(c.amount)}/set
                      </li>
                    ))}
                </ul>
              )}
              <div className="line-calc">
                <span>× {line.quantity} set</span>
                <strong>{formatCurrency(quoteLineAmount(line))}</strong>
              </div>
            </article>
          ))}
        </div>
      )}

      <div className="quote-totals">
        <div className="total-row">
          <span>Subtotal</span>
          <span>{formatCurrency(subtotal)}</span>
        </div>
        <div className="total-row muted">
          <span>GST 18%</span>
          <span>{formatCurrency(gst)}</span>
        </div>
        <div className="total-row grand">
          <span>Grand total</span>
          <strong>{formatCurrency(grand)}</strong>
        </div>
      </div>

      <div className="quote-actions">
        <button type="button" className="btn-secondary" onClick={onPreview} disabled={!lines.length}>
          Preview
        </button>
        <button type="button" className="btn-secondary" onClick={onPrint} disabled={!lines.length}>
          PDF / Print
        </button>
        <button type="button" className="btn-ghost" onClick={onClear} disabled={!lines.length}>
          Clear
        </button>
      </div>
    </div>
  )
}
