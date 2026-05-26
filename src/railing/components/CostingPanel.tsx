import { useMemo } from 'react'
import { calculateCosting } from '../costing'
import type { CostingRates, DesignDraft, RateDisplayUnit } from '../types'
import { formatCurrency } from '../utils'
import { UnitRateSections } from './UnitRateSections'

interface Props {
  draft: DesignDraft
  rates: CostingRates
  onRatesChange: (r: CostingRates) => void
  onSaveAll: () => void
  collapsed: boolean
  onToggleCollapsed: () => void
  prefsSaved: boolean
}

function RatesForm({
  draft,
  rates,
  onRatesChange,
  breakdown,
}: {
  draft: DesignDraft
  rates: CostingRates
  onRatesChange: (r: CostingRates) => void
  breakdown: ReturnType<typeof calculateCosting>
}) {
  const set = (patch: Partial<CostingRates>) => onRatesChange({ ...rates, ...patch })
  const needsBottomKg = rates.bottomRailRateMode === 'kg' && rates.bottomRailRate > 0
  const needsHandrailKg = rates.handrailRateMode === 'kg' && rates.handrailRate > 0

  return (
    <>
      <div className="toggle-row">
        <span className="toggle-label">Quotation summary unit:</span>
        {(['sft', 'rft', 'rmt'] as RateDisplayUnit[]).map((u) => (
          <button
            key={u}
            type="button"
            className={rates.quoteDisplayUnit === u ? 'toggle active' : 'toggle'}
            onClick={() => set({ quoteDisplayUnit: u })}
          >
            Per {u.toUpperCase()}
          </button>
        ))}
      </div>

      <UnitRateSections
        rates={rates}
        onRatesChange={onRatesChange}
        glassAreaSft={breakdown.glassAreaSft}
        bottomRailRft={breakdown.bottomRailRft}
        handrailRft={breakdown.handrailRft}
        perimeterRmt={breakdown.perimeterRmt}
      />

      {(needsBottomKg && !rates.bottomRailKgPerRft) ||
      (needsHandrailKg && !rates.handrailKgPerRft) ? (
        <p className="cost-warn">KG mode: enter weight per RFT.</p>
      ) : null}

      <h4 className="cost-breakdown-title">This design — line amounts</h4>
      <table className="cost-table">
        <thead>
          <tr>
            <th>Item</th>
            <th>Qty</th>
            <th>₹</th>
            <th>Amt</th>
          </tr>
        </thead>
        <tbody>
          {breakdown.items
            .filter((r) => r.amount > 0)
            .map((row, i) => (
              <tr key={i}>
                <td>{row.label}</td>
                <td>
                  {row.qty} {row.unit}
                </td>
                <td>{row.rate}</td>
                <td>{formatCurrency(row.amount)}</td>
              </tr>
            ))}
        </tbody>
        <tfoot>
          <tr>
            <td colSpan={3}>
              <strong>× {draft.quantity} set</strong>
            </td>
            <td>
              <strong>{formatCurrency(breakdown.subtotal * draft.quantity)}</strong>
            </td>
          </tr>
        </tfoot>
      </table>
    </>
  )
}

export function CostingPanel({
  draft,
  rates,
  onRatesChange,
  onSaveAll,
  collapsed,
  onToggleCollapsed,
  prefsSaved,
}: Props) {
  const breakdown = useMemo(
    () => calculateCosting(draft, rates),
    [draft, rates],
  )
  const hw = breakdown.design.hardware
  const lineTotal = breakdown.subtotal * draft.quantity

  if (collapsed) {
    return (
      <div className="costing-panel costing-collapsed">
        <button
          type="button"
          className="costing-expand-btn"
          onClick={onToggleCollapsed}
        >
          <span className="costing-expand-label">
            💰 Costing & rates
            {prefsSaved && <span className="saved-badge">Saved</span>}
          </span>
          <strong>{formatCurrency(lineTotal)}</strong>
          <span className="costing-expand-hint">Tap to open</span>
        </button>
      </div>
    )
  }

  return (
    <div className="costing-panel">
      <div className="costing-header">
        <h3>
          Live costing {prefsSaved && <span className="saved-badge">Auto</span>}
        </h3>
        <div className="costing-header-actions">
          <button type="button" className="btn-icon-text" onClick={onToggleCollapsed}>
            Minimize
          </button>
          <button type="button" className="btn-save-rates" onClick={onSaveAll}>
            Save all
          </button>
        </div>
      </div>

      <div className="metrics-row">
        <div className="metric">
          <span>Glass</span>
          <strong>{breakdown.glassAreaSft} SFT</strong>
        </div>
        <div className="metric">
          <span>Rail</span>
          <strong>{breakdown.bottomRailRft} RFT</strong>
        </div>
        <div className="metric">
          <span>90°/180°/Wall</span>
          <strong>
            {hw.connector90}/{hw.connector180}/{hw.wallConnectors}
          </strong>
        </div>
        <div className="metric">
          <span>Total</span>
          <strong>{formatCurrency(lineTotal)}</strong>
        </div>
      </div>

      <RatesForm
        draft={draft}
        rates={rates}
        onRatesChange={onRatesChange}
        breakdown={breakdown}
      />
    </div>
  )
}

export function validateRatesForCosting(rates: CostingRates): string | null {
  if (rates.bottomRailRateMode === 'kg' && rates.bottomRailRate > 0 && !rates.bottomRailKgPerRft) {
    return 'Enter bottom rail KG per RFT.'
  }
  if (rates.handrailRateMode === 'kg' && rates.handrailRate > 0 && !rates.handrailKgPerRft) {
    return 'Enter handrail KG per RFT.'
  }
  return null
}
