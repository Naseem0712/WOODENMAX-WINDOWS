import { useMemo } from 'react'
import { calculateCosting } from '../costing'
import type { CostingRates, CostRateField, DesignDraft } from '../types'
import {
  displayRateForUnit,
  itemRateUnits,
  qtyForDisplayUnit,
  setStoredRate,
  type RateUnit,
} from '../rateUnits'
import { displayDesignTitle, formatCurrency } from '../utils'

interface Props {
  draft: DesignDraft
  rates: CostingRates
  onRatesChange: (rates: CostingRates) => void
  quantity: number
  /** quantities = BOM only; priced = BOM + rate columns (legacy) */
  variant?: 'quantities' | 'priced'
}

const UNIT_LABELS: Record<RateUnit, string> = {
  sft: '₹/SFT',
  rft: '₹/RFT',
  rmt: '₹/RMT',
  pcs: '₹/pcs',
}

export function BomTable({
  draft,
  rates,
  onRatesChange,
  quantity,
  variant = 'quantities',
}: Props) {
  const calc = useMemo(() => calculateCosting(draft, rates), [draft, rates])
  const design = calc.design
  const title = displayDesignTitle(draft)

  const setRate = (field: CostRateField, unit: RateUnit, value: number) => {
    onRatesChange(setStoredRate(rates, field, unit, value))
  }

  if (!design.bom.length && calc.subtotal === 0) {
    return <p className="hint">Enter sizes to see material list.</p>
  }

  if (variant === 'quantities') {
    return (
      <div className="bom-wrap bom-qty-only">
        {title && <p className="hint bom-design-name">{title}</p>}
        <div className="table-scroll">
          <table className="bom-table">
            <thead>
              <tr>
                <th>Item</th>
                <th>Specification</th>
                <th>Qty</th>
              </tr>
            </thead>
            <tbody>
              {design.bom.map((row, i) => (
                <tr key={i}>
                  <td>
                    <strong>{row.item}</strong>
                  </td>
                  <td>{row.specification}</td>
                  <td className="qty-cell">
                    <span>{row.qty}</span> <small>{row.unit}</small>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="bom-detail">
          {design.segments.map((seg) => (
            <div key={seg.key} className="bom-seg">
              <strong>{seg.label}</strong> — {seg.glassCount} glass × {seg.glassWidthMm} mm
              {seg.pillarsInSegment > 0 && ` · Pillars: ${seg.pillarsInSegment}`}
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="bom-wrap">
      <p className="hint bom-unit-hint">
        Rate kisi bhi column mein daalo (SFT / RFT / RMT / pcs) — amount same rahega
      </p>

      <div className="table-scroll">
        <table className="bom-table bom-multi-unit">
          <thead>
            <tr>
              <th>Item</th>
              <th>Qty</th>
              <th>₹/SFT</th>
              <th>₹/RFT</th>
              <th>₹/RMT</th>
              <th>₹/pcs</th>
              <th>Amount</th>
            </tr>
          </thead>
          <tbody>
            {calc.items.map((row, i) => {
              const units = itemRateUnits(row.rateField)
              return (
                <tr
                  key={`c-${i}`}
                  className={
                    row.amount === 0 ? 'info-row' : 'cost-row'
                  }
                >
                  <td>
                    <strong>{row.label}</strong>
                    {row.note && <small className="bom-note"> {row.note}</small>}
                  </td>
                  <td className="qty-cell">
                    <span>{row.qty}</span>
                    <small>{row.unit}</small>
                  </td>
                  {(['sft', 'rft', 'rmt', 'pcs'] as RateUnit[]).map((unit) => {
                    const active = units.includes(unit) && row.rateField
                    const qtyU = active
                      ? qtyForDisplayUnit(row, unit, calc)
                      : null
                    return (
                      <td key={unit} className={active ? 'rate-cell active' : 'rate-cell na'}>
                        {active && row.rateField ? (
                          <div className="rate-cell-inner">
                            <input
                              type="number"
                              className="bom-rate-input"
                              min={0}
                              step={0.01}
                              value={displayRateForUnit(rates, row.rateField, unit) || ''}
                              onChange={(e) =>
                                setRate(row.rateField!, unit, Number(e.target.value))
                              }
                              title={UNIT_LABELS[unit]}
                            />
                            {qtyU != null && qtyU > 0 && (
                              <small>{qtyU} {unit.toUpperCase()}</small>
                            )}
                          </div>
                        ) : (
                          '—'
                        )}
                      </td>
                    )
                  })}
                  <td className="amt-cell">
                    {row.amount > 0 ? formatCurrency(row.amount) : '—'}
                  </td>
                </tr>
              )
            })}
          </tbody>
          <tfoot>
            <tr>
              <td colSpan={6}>
                <strong>Design subtotal × {quantity} set</strong>
              </td>
              <td>
                <strong>{formatCurrency(calc.subtotal * quantity)}</strong>
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      <div className="bom-detail">
        {design.segments.map((seg) => (
          <div key={seg.key} className="bom-seg">
            <strong>{seg.label}</strong> — {seg.glassCount} glass × {seg.glassWidthMm} mm
            {seg.pillarsInSegment > 0 && ` · Pillars: ${seg.pillarsInSegment}`}
          </div>
        ))}
      </div>
    </div>
  )
}
