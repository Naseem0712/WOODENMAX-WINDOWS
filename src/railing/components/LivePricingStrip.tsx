import type { CostBreakdown } from '../types'
import { formatCurrency } from '../utils'
import { SetRatesDisplay } from './SetRatesDisplay'

interface Props {
  breakdown: CostBreakdown
  quantity: number
  designLabel: string
}

export function LivePricingStrip({ breakdown, quantity, designLabel }: Props) {
  const hw = breakdown.design.hardware
  const lineTotal = breakdown.subtotal * quantity

  return (
    <div className="live-pricing-strip no-print" aria-live="polite">
      <div className="live-pricing-main">
        <span className="live-pricing-label">
          Live costing {designLabel ? `— ${designLabel}` : ''}
        </span>
        <strong className="live-pricing-total">{formatCurrency(lineTotal)}</strong>
        <span className="live-pricing-qty">× {quantity} set</span>
      </div>
      <div className="live-pricing-metrics">
        <span>
          Glass <strong>{breakdown.glassAreaSft} SFT</strong>
        </span>
        <span>
          Run <strong>{breakdown.setRates.railRftBasis} RFT</strong>
        </span>
        <span>
          90°/180°/Wall{' '}
          <strong>
            {hw.connector90}/{hw.connector180}/{hw.wallConnectors}
          </strong>
        </span>
      </div>
      <SetRatesDisplay breakdown={breakdown} quantity={quantity} compact />
      <p className="live-pricing-hint">
        Set rate = full subtotal (glass + hardware) ÷ SFT / RFT / RMT
      </p>
    </div>
  )
}
