import type { CostBreakdown, RateDisplayUnit } from '../types'
import { formatCurrency } from '../utils'
import { SetRatesDisplay } from './SetRatesDisplay'

interface Props {
  breakdown: CostBreakdown
  quantity?: number
  selectedUnit?: RateDisplayUnit
  onSelectUnit?: (unit: RateDisplayUnit) => void
  /** When false, table only (set rates shown outside collapsible). */
  showSetRates?: boolean
}

export function BudgetBreakdownPanel({
  breakdown,
  quantity = 1,
  selectedUnit,
  onSelectUnit,
  showSetRates = true,
}: Props) {
  const hw = breakdown.design.hardware

  return (
    <div className="budget-breakdown-panel">
      <h4 className="budget-breakdown-title">Railing budget (material costing)</h4>
      <p className="hint">
        Qty auto-calculated from size — enter rates in <strong>Rates</strong> drawer once. Click
        SFT / RFT / RMT below to choose quote unit.
      </p>

      <div className="table-scroll budget-table-wrap">
        <table className="cost-table budget-hardware-table">
          <thead>
            <tr>
              <th>Item</th>
              <th>Qty</th>
              <th>Rate ₹</th>
              <th>Amount</th>
            </tr>
          </thead>
          <tbody>
            {breakdown.items.map((row, i) => (
              <tr key={i} className={row.amount > 0 ? '' : 'muted-row'}>
                <td>{row.label}</td>
                <td>
                  {row.qty} {row.unit}
                </td>
                <td>{row.rate > 0 ? row.rate : '—'}</td>
                <td>{row.amount > 0 ? formatCurrency(row.amount) : '—'}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td colSpan={3}>
                <strong>Subtotal (1 set)</strong>
              </td>
              <td>
                <strong>{formatCurrency(breakdown.subtotal)}</strong>
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      <div className="budget-hw-counts">
        <span>90° × {hw.connector90}</span>
        <span>180° × {hw.connector180}</span>
        <span>Wall × {hw.wallConnectors}</span>
        <span>End cap × {hw.endCaps}</span>
        <span>Pillars × {hw.totalPillars}</span>
        <span>Studs × {hw.totalStuds}</span>
        <span>Bottom {hw.bottomRailRft} RFT</span>
        <span>Handrail {hw.handrailRft} RFT</span>
        <span>{breakdown.glassAreaSft} SFT glass</span>
      </div>

      {showSetRates && (
        <SetRatesDisplay
          breakdown={breakdown}
          quantity={quantity}
          highlightUnit={selectedUnit ?? breakdown.displayUnit}
          onSelectUnit={onSelectUnit}
          clickable
        />
      )}
    </div>
  )
}
