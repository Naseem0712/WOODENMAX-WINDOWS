import { quoteLineAmount, quoteTotals, quoteUnitForLine } from '../quotationFormat'
import { defaultBankDetails } from '../metaDefaults'
import { formatCurrency } from '../utils'
import type { CostingRates, QuotationBankDetails, QuotationLine, QuotationMeta } from '../types'

function patchBank(meta: QuotationMeta, patch: Partial<QuotationBankDetails>): QuotationMeta {
  return {
    ...meta,
    bankDetails: { ...defaultBankDetails(), ...meta.bankDetails, ...patch },
  }
}

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
  onPreview,
}: Props) {
  const { subtotal, gst, grand } = quoteTotals(lines)
  const unitLabel =
    lines.length > 0
      ? [...new Set(lines.map((l) => quoteUnitForLine(l).toUpperCase()))].join(' / ')
      : `Normal ${ratesNormal.quoteDisplayUnit.toUpperCase()} · Staircase ${ratesStaircase.quoteDisplayUnit.toUpperCase()}`

  return (
    <div className="quote-panel quote-panel-drawer quote-panel-with-footer">
      <div className="quote-panel-scroll">
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
          <span>Client GSTIN (optional)</span>
          <input
            value={meta.clientGstin ?? ''}
            placeholder="e.g. 36AAAAA0000A1Z5"
            onChange={(e) => onMetaChange({ ...meta, clientGstin: e.target.value })}
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

      <details className="quote-bank-details">
        <summary>Bank details (print / PDF)</summary>
        <div className="meta-fields">
          <label className="field">
            <span>Account name</span>
            <input
              value={meta.bankDetails?.accountName ?? defaultBankDetails().accountName}
              onChange={(e) => onMetaChange(patchBank(meta, { accountName: e.target.value }))}
            />
          </label>
          <label className="field">
            <span>Bank name</span>
            <input
              value={meta.bankDetails?.bankName ?? defaultBankDetails().bankName}
              onChange={(e) => onMetaChange(patchBank(meta, { bankName: e.target.value }))}
            />
          </label>
          <label className="field">
            <span>Account no.</span>
            <input
              value={meta.bankDetails?.accountNo ?? defaultBankDetails().accountNo}
              onChange={(e) => onMetaChange(patchBank(meta, { accountNo: e.target.value }))}
            />
          </label>
          <label className="field">
            <span>IFSC</span>
            <input
              value={meta.bankDetails?.ifsc ?? defaultBankDetails().ifsc}
              onChange={(e) => onMetaChange(patchBank(meta, { ifsc: e.target.value }))}
            />
          </label>
          <label className="field">
            <span>Branch</span>
            <input
              value={meta.bankDetails?.branch ?? defaultBankDetails().branch}
              onChange={(e) => onMetaChange(patchBank(meta, { branch: e.target.value }))}
            />
          </label>
        </div>
      </details>

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
                  {line.packageQuote.installationRate > 0 ? (
                    <>
                      {' '}
                      (material {formatCurrency(line.packageQuote.materialRate)} + installation{' '}
                      {formatCurrency(line.packageQuote.installationRate)})
                    </>
                  ) : null}
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

      </div>

      <footer className="quote-panel-footer quote-panel-footer--slim no-print">
        <p className="quote-panel-footer-hint">Import · Export · Print · PDF — header bar</p>
        <div className="quote-panel-footer-actions">
          <button
            type="button"
            className="btn-ghost btn-sm"
            onClick={onPreview}
            disabled={lines.length === 0}
          >
            Preview
          </button>
          <button
            type="button"
            className="btn-ghost btn-sm"
            onClick={onClear}
            disabled={lines.length === 0}
          >
            Clear list
          </button>
        </div>
      </footer>
    </div>
  )
}
