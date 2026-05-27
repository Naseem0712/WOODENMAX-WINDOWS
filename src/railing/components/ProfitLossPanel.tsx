import { useMemo, useState } from 'react'
import { buildProfitSummary, downloadProfitCsv } from '../profitAnalysis'
import type { CostingRates, QuotationLine, QuotationMeta } from '../types'
import { formatCurrency } from '../utils'
import { CollapsiblePanel } from './CollapsiblePanel'

interface Props {
  meta: QuotationMeta
  lines: QuotationLine[]
  rates: CostingRates
  editingLineId: string | null
  onEdit: (id: string) => void
  embedded?: boolean
}

export function ProfitLossPanel({
  meta,
  lines,
  rates,
  editingLineId,
  onEdit,
  embedded,
}: Props) {
  const [open, setOpen] = useState(true)
  const summary = useMemo(() => buildProfitSummary(lines, rates), [lines, rates])

  const profitClass = (n: number) =>
    n > 0 ? 'profit-pos' : n < 0 ? 'profit-neg' : ''

  const body =
    lines.length === 0 ? (
      <p className="hint">Add designs to quotation to see costing vs quote profit.</p>
    ) : (
      <>
            <div className="profit-actions">
              <button
                type="button"
                className="btn-download-bom"
                onClick={() => downloadProfitCsv(summary, meta)}
              >
                📥 Export profit report
              </button>
            </div>
            <div className="table-scroll">
              <table className="profit-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Design</th>
                    <th>Sets</th>
                    <th>Costing</th>
                    <th>Quotation</th>
                    <th>P/L</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {summary.rows.map((r) => (
                    <tr
                      key={r.lineId}
                      className={editingLineId === r.lineId ? 'profit-row-editing' : ''}
                    >
                      <td>{r.index}</td>
                      <td className="profit-design">{r.designName}</td>
                      <td>{r.quantity}</td>
                      <td>
                        <span className="profit-sub">{formatCurrency(r.costPerSet)}/set</span>
                        <br />
                        <strong>{formatCurrency(r.costTotal)}</strong>
                      </td>
                      <td>
                        <span className="profit-sub">{formatCurrency(r.quotePerSet)}/set</span>
                        <br />
                        <strong>{formatCurrency(r.quoteTotal)}</strong>
                      </td>
                      <td className={profitClass(r.profit)}>
                        <strong>{formatCurrency(r.profit)}</strong>
                        {r.marginPct != null && (
                          <small> ({r.marginPct}%)</small>
                        )}
                      </td>
                      <td>
                        <button
                          type="button"
                          className="btn-edit-line"
                          onClick={() => onEdit(r.lineId)}
                        >
                          Edit
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="profit-total-row">
                    <td colSpan={3}>
                      <strong>Project total</strong>
                    </td>
                    <td>
                      <strong>{formatCurrency(summary.totalCost)}</strong>
                    </td>
                    <td>
                      <strong>{formatCurrency(summary.totalQuote)}</strong>
                    </td>
                    <td className={profitClass(summary.totalProfit)}>
                      <strong>{formatCurrency(summary.totalProfit)}</strong>
                      {summary.marginPct != null && (
                        <small> ({summary.marginPct}%)</small>
                      )}
                    </td>
                    <td></td>
                  </tr>
                </tfoot>
              </table>
            </div>
        <p className="hint profit-foot-hint">
          Costing = material only (rates panel). Quotation = package rate (installation included there).
          Green = profit, red = loss.
        </p>
      </>
    )

  if (embedded) {
    return <div className="profit-loss-panel profit-loss-embedded">{body}</div>
  }

  return (
    <div className="profit-loss-panel">
      <CollapsiblePanel
        id="profit-panel"
        open={open}
        onToggle={() => setOpen((o) => !o)}
        title={
          <>
            Cost vs Quote · Profit / loss
          </>
        }
        subtitle={
          lines.length > 0 ? (
            <span className={profitClass(summary.totalProfit)}>
              {formatCurrency(summary.totalProfit)}
            </span>
          ) : (
            'No lines'
          )
        }
      >
        {body}
      </CollapsiblePanel>
    </div>
  )
}
