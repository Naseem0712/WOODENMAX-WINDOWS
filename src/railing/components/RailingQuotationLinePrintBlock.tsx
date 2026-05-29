import { formatQuoteMoney } from '../utils'
import {
  buildItemSpecRows,
  quoteBasisForLine,
  quoteLineAmount,
  quoteRateForLine,
  quoteUnitForLine,
} from '../quotationFormat'
import type { QuotationLine } from '../types'
import { QuoteMiniDiagram } from './QuoteMiniDiagram'

function SpecRow({ label, value }: { label: string; value: string | number }) {
  if (value === 0 || value === '0' || value === '—' || value === '') return null
  return (
    <tr>
      <td className="spec-label">{label}</td>
      <td className="spec-value">{value}</td>
    </tr>
  )
}

export interface RailingQuotationLinePrintBlockProps {
  line: QuotationLine
  index: number
  /** Combined quotation row title (WoodenMax); falls back to design name/label. */
  listRowTitle?: string
  /** Match window print: hide rate/amount when architectural mode is on. */
  hidePricesForArchitect?: boolean
}

/**
 * Single railing line — same layout as standalone RailingQ quotation print (QuotationDocument).
 */
export function RailingQuotationLinePrintBlock({
  line,
  index,
  listRowTitle,
  hidePricesForArchitect,
}: RailingQuotationLinePrintBlockProps) {
  const specRows = buildItemSpecRows(line)
  const draft = line.draftSnapshot
  const basis = quoteBasisForLine(line)
  const rate = quoteRateForLine(line)
  const amount = quoteLineAmount(line)
  const unit = quoteUnitForLine(line)
  const heading = (listRowTitle?.trim() || line.designName || line.designLabel).trim()
  const priceWrapClass = hidePricesForArchitect ? 'hide-for-arch' : undefined

  return (
    <article className="quote-item-block quote-item-detail">
      <div className="quote-item-pack">
        <header className="quote-item-head">
          <h3>
            Item {index + 1} — {heading}
          </h3>
          <span className="item-qty-badge">Qty: {line.quantity} set(s)</span>
        </header>

        <div className={priceWrapClass}>
          <div className="qdoc-price-grid" role="table" aria-label="Line pricing">
            <div className="qdoc-col-basis qdoc-price-h" role="columnheader">
              Basis
            </div>
            <div className="qdoc-col-rate qdoc-price-h" role="columnheader">
              Rate (₹)
            </div>
            <div className="qdoc-col-sets qdoc-price-h" role="columnheader">
              Sets
            </div>
            <div className="qdoc-col-amount qdoc-price-h" role="columnheader">
              Amount (₹)
            </div>
            <div className="qdoc-col-basis qdoc-price-v" role="cell">
              {basis.qty} {basis.unit}
              <br />
              <small className="qdoc-line-type">
                {line.designType.replace('-', ' ')} · per {unit.toUpperCase()}
              </small>
            </div>
            <div className="qdoc-col-rate qdoc-price-v" role="cell">
              {formatQuoteMoney(rate)}
            </div>
            <div className="qdoc-col-sets qdoc-price-v" role="cell">
              {line.quantity}
            </div>
            <div className="qdoc-col-amount qdoc-price-v" role="cell">
              <strong>{formatQuoteMoney(amount)}</strong>
            </div>
          </div>

          {(line.customCharges ?? []).filter((c) => c.amount > 0 && c.label?.trim()).length >
            0 && (
            <ul className="qdoc-item-extras">
              {(line.customCharges ?? [])
                .filter((c) => c.amount > 0 && c.label?.trim())
                .map((c, j) => (
                  <li key={j}>
                    {c.label}: {formatQuoteMoney(c.amount)}/set
                  </li>
                ))}
            </ul>
          )}
        </div>

        <div className="quote-item-body">
          <div className="quote-item-left">
            <QuoteMiniDiagram
              draft={draft}
              calc={line.calculation}
              printImageUrl={draft.printImageUrl}
            />
            <div className="dim-box dim-box-compact">
              <p className="dim-title">Measurements</p>
              <p className="dim-lines">{line.dimensionsText}</p>
              {line.heightText?.trim() ? <p className="dim-height">{line.heightText}</p> : null}
            </div>
          </div>

          <div className="quote-item-right">
            <table className="spec-table">
              <tbody>
                {specRows.map((r) => (
                  <SpecRow key={r.label} label={r.label} value={r.value} />
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {line.notes && <p className="item-notes">Note: {line.notes}</p>}
      </div>
    </article>
  )
}
