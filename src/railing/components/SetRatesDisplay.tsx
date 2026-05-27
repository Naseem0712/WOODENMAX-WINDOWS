import { computeSetRates } from '../costing'
import type { CostBreakdown, RateDisplayUnit } from '../types'
import { formatCurrency } from '../utils'

interface Props {
  breakdown: CostBreakdown
  quantity?: number
  highlightUnit?: RateDisplayUnit
  compact?: boolean
  clickable?: boolean
  onSelectUnit?: (unit: RateDisplayUnit) => void
}

function RateChip({
  label,
  unit,
  rate,
  basis,
  active,
  clickable,
  onClick,
}: {
  label: string
  unit: RateDisplayUnit
  rate: number | null
  basis: string
  active?: boolean
  clickable?: boolean
  onClick?: () => void
}) {
  if (rate == null) return null
  const Tag = clickable ? 'button' : 'div'
  return (
    <Tag
      type={clickable ? 'button' : undefined}
      className={`set-rate-chip ${active ? 'set-rate-chip-active' : ''} ${clickable ? 'set-rate-chip-clickable' : ''}`}
      onClick={clickable ? onClick : undefined}
    >
      <span className="set-rate-chip-label">{label}</span>
      <strong className="set-rate-chip-value">{formatCurrency(rate)}</strong>
      <span className="set-rate-chip-unit">/ {unit.toUpperCase()}</span>
      <small className="set-rate-chip-basis">{basis}</small>
    </Tag>
  )
}

export function SetRatesDisplay({
  breakdown,
  quantity = 1,
  highlightUnit,
  compact = false,
  clickable = false,
  onSelectUnit,
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
        {clickable
          ? 'Click a unit to apply package rate'
          : 'BOM average (full subtotal ÷ area or run — not your glass ₹/SFT alone)'}
      </p>
      <div className="set-rates-grid">
        <RateChip
          label="BOM ÷ SFT"
          unit="sft"
          rate={r.perSft}
          basis={`${breakdown.glassAreaSft} SFT (all items)`}
          active={unit === 'sft'}
          clickable={clickable}
          onClick={() => onSelectUnit?.('sft')}
        />
        <RateChip
          label="BOM ÷ RFT"
          unit="rft"
          rate={r.perRft}
          basis={`${r.railRftBasis} RFT (all items)`}
          active={unit === 'rft'}
          clickable={clickable}
          onClick={() => onSelectUnit?.('rft')}
        />
        <RateChip
          label="BOM ÷ RMT"
          unit="rmt"
          rate={r.perRmt}
          basis={`${breakdown.perimeterRmt} RMT (all items)`}
          active={unit === 'rmt'}
          clickable={clickable}
          onClick={() => onSelectUnit?.('rmt')}
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
