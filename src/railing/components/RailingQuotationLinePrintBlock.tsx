import { formatCurrency } from '../utils'
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
          <table className="qdoc-item-price-table">
            <thead>
              <tr>
                <th>Basis</th>
                <th>Rate (₹)</th>
                <th>Sets</th>
                <th className="text-right">Amount (₹)</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>
                  {basis.qty} {basis.unit}
                  <br />
                  <small className="qdoc-line-type">
                    {line.designType.replace('-', ' ')} · per {unit.toUpperCase()}
                  </small>
                </td>
                <td>{rate.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</td>
                <td>{line.quantity}</td>
                <td className="text-right">
                  <strong>{formatCurrency(amount)}</strong>
                </td>
              </tr>
            </tbody>
          </table>

          {(line.customCharges ?? []).filter((c) => c.amount > 0 && c.label?.trim()).length >
            0 && (
            <ul className="qdoc-item-extras">
              {(line.customCharges ?? [])
                .filter((c) => c.amount > 0 && c.label?.trim())
                .map((c, j) => (
                  <li key={j}>
                    {c.label}: {formatCurrency(c.amount)}/set
                  </li>
                ))}
            </ul>
          )}
        </div>

        <div className="quote-item-body">
          <div className="quote-item-left">
            <QuoteMiniDiagram draft={draft} calc={line.calculation} />
            <div className="dim-box">
              <p className="dim-title">Measurements</p>
              <p>{line.dimensionsText}</p>
              <p>{line.heightText}</p>
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
