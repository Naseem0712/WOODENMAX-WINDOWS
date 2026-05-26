import { computeSetRates } from '../costing'
import type { CostBreakdown, RateDisplayUnit } from '../types'
import { formatCurrency } from '../utils'

interface Props {
  breakdown: CostBreakdown
  quantity?: number
  highlightUnit?: RateDisplayUnit
  compact?: boolean
}

function RateChip({
  label,
  rate,
  basis,
  active,
}: {
  label: string
  rate: number | null
  basis: string
  active?: boolean
}) {
  if (rate == null) return null
  return (
    <div className={`set-rate-chip ${active ? 'set-rate-chip-active' : ''}`}>
      <span className="set-rate-chip-label">{label}</span>
      <strong className="set-rate-chip-value">{formatCurrency(rate)}</strong>
      <span className="set-rate-chip-unit">/ {label.split(' ').pop()}</span>
      <small className="set-rate-chip-basis">{basis}</small>
    </div>
  )
}

export function SetRatesDisplay({
  breakdown,
  quantity = 1,
  highlightUnit,
  compact = false,
}: Props) {
  const r =
    breakdown.setRates ??
    computeSetRates(
      breakdown.subtotal,
      breakdown.glassAreaSft,
      breakdown.bottomRailRft,
      breakdown.handrailRft,
      breakdown.perimeterRmt,
    )
  const sub = breakdown.subtotal
  const total = sub * quantity
  const unit = highlightUnit ?? breakdown.displayUnit

  return (
    <div className={`set-rates-display ${compact ? 'set-rates-compact' : ''}`}>
      <p className="set-rates-heading">
        Set rate <span className="hi">(subtotal ÷ area / length)</span>
      </p>
      <div className="set-rates-grid">
        <RateChip
          label="Per SFT"
          rate={r.perSft}
          basis={`${breakdown.glassAreaSft} SFT glass`}
          active={unit === 'sft'}
        />
        <RateChip
          label="Per RFT"
          rate={r.perRft}
          basis={`${r.railRftBasis} RFT run`}
          active={unit === 'rft'}
        />
        <RateChip
          label="Per RMT"
          rate={r.perRmt}
          basis={`${breakdown.perimeterRmt} RMT run`}
          active={unit === 'rmt'}
        />
      </div>
      <div className="set-rates-totals">
        <span>
          1 set subtotal: <strong>{formatCurrency(sub)}</strong>
        </span>
        {quantity > 1 && (
          <span>
            × {quantity} sets: <strong>{formatCurrency(total)}</strong>
          </span>
        )}
      </div>
    </div>
  )
}
