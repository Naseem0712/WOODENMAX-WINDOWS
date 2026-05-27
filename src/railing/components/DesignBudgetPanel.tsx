import { computeSetRates, displayQtyForUnit, glassEnteredRatePerSft } from '../costing'
import type { CostBreakdown, DesignDraft } from '../types'
import {
  effectiveMaterialRate,
  installationRateForUnit,
  normalizePackageRates,
  setRateForQuoteUnit,
} from '../packagePricing'
import { formatCurrency } from '../utils'

interface Props {
  draft: DesignDraft
  breakdown: CostBreakdown
}

export function DesignBudgetPanel({ draft, breakdown }: Props) {
  const hw = breakdown.design.hardware
  const unit = draft.packageQuoteUnit ?? 'rft'
  const pkg = normalizePackageRates(draft.packageRates)
  const basis = displayQtyForUnit(breakdown, unit)
  const installRate = installationRateForUnit(pkg, unit)
  const materialQuoteRate = effectiveMaterialRate(draft, breakdown, unit)
  const installAmount = Math.round(basis.qty * installRate * 100) / 100
  const materialQuoteAmount = Math.round(basis.qty * materialQuoteRate * 100) / 100
  const combinedPerSet = materialQuoteAmount + installAmount

  const setRates =
    breakdown.setRates ??
    computeSetRates(
      breakdown.subtotal,
      breakdown.glassAreaSft,
      breakdown.bottomRailRft,
      breakdown.handrailRft,
      breakdown.perimeterRmt,
    )
  const bomMatPerUnit = setRateForQuoteUnit(setRates, unit)
  const glassRateEntered = glassEnteredRatePerSft(breakdown)
  const combinedRatePerUnit =
    materialQuoteRate + installRate > 0
      ? materialQuoteRate + installRate
      : (bomMatPerUnit ?? 0) + installRate

  return (
    <div className="budget-breakdown-panel">
      <p className="hint">
        Item rates from <strong>Rates</strong> drawer (BOM). Glass always in SFT. Installation is
        added below from the <strong>Quotation rates</strong> panel for an accurate{' '}
        {unit.toUpperCase()} quote.
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
                <strong>BOM material subtotal</strong>
              </td>
              <td>
                <strong>{formatCurrency(breakdown.subtotal)}</strong>
              </td>
            </tr>
            <tr className="budget-install-row">
              <td colSpan={3}>
                Installation ({basis.qty} {unit.toUpperCase()} × {formatCurrency(installRate)})
              </td>
              <td>
                <strong>{installAmount > 0 ? formatCurrency(installAmount) : '—'}</strong>
              </td>
            </tr>
            <tr className="budget-combined-row">
              <td colSpan={3}>
                <strong>Quote total per set (material + installation)</strong>
              </td>
              <td>
                <strong>{formatCurrency(combinedPerSet)}</strong>
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      <div className="budget-effective-rates">
        <p>
          Glass: <strong>{breakdown.glassAreaSft} SFT</strong>
          {glassRateEntered != null && (
            <>
              {' '}
              · rate <strong>{formatCurrency(glassRateEntered)}/SFT</strong>
            </>
          )}
        </p>
        <p>
          Quote basis <strong>{unit.toUpperCase()}</strong>: material{' '}
          <strong>{formatCurrency(materialQuoteRate || bomMatPerUnit || 0)}</strong>
          {' + '}
          installation <strong>{formatCurrency(installRate)}</strong>
          {' = '}
          <strong>{formatCurrency(combinedRatePerUnit)}/{unit.toUpperCase()}</strong>
        </p>
      </div>

      <div className="budget-hw-counts">
        <span>90° × {hw.connector90}</span>
        <span>180° × {hw.connector180}</span>
        <span>Wall × {hw.wallConnectors}</span>
        <span>End cap × {hw.endCaps}</span>
        <span>Pillars × {hw.totalPillars}</span>
        <span>Studs × {hw.totalStuds}</span>
      </div>
    </div>
  )
}
