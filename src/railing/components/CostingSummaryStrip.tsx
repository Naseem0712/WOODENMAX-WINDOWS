import { glassCostLine, glassEnteredRatePerSft, holeCostLine } from '../costing'
import { DEFAULT_HOLE_CHARGE_PER_PCS } from '../constants'
import type { CostBreakdown, DesignDraft } from '../types'
import {
  bomSetRatesForBreakdown,
  packageLineTotal,
  resolvePackageQuote,
  setRateForQuoteUnit,
} from '../packagePricing'
import { formatCurrency } from '../utils'

interface Props {
  draft: DesignDraft
  breakdown: CostBreakdown
}

export function CostingSummaryStrip({ draft, breakdown }: Props) {
  const bomSetRates = bomSetRatesForBreakdown(breakdown)
  const unit = draft.packageQuoteUnit ?? 'rft'
  const pq = resolvePackageQuote(draft, breakdown)
  const quoteTotal = packageLineTotal(draft, breakdown)
  const glassRate = glassEnteredRatePerSft(breakdown)
  const glassLine = glassCostLine(breakdown)
  const holeLine = holeCostLine(breakdown)
  const glassActual = breakdown.glassAreaSftActual ?? breakdown.glassAreaSft
  const glassCosting = breakdown.glassAreaSft
  const glassUpliftPct =
    breakdown.staircaseGlassFormula && glassActual > 0 && glassCosting > glassActual
      ? Math.round(((glassCosting - glassActual) / glassActual) * 100)
      : null
  const quoteMatFromBom = setRateForQuoteUnit(bomSetRates, unit)
  const bomBasisQty =
    unit === 'sft'
      ? breakdown.glassAreaSft
      : unit === 'rmt'
        ? breakdown.perimeterRmt
        : bomSetRates.railRftBasis

  return (
    <div className="costing-summary-strip">
      <div className="costing-summary-row costing-glass-row">
        <span className="costing-summary-label">Glass (costing)</span>
        <strong>
          {breakdown.staircaseGlassFormula ? (
            <>
              <strong>{glassCosting} SFT</strong> staircase billed
              <span className="costing-summary-sub">
                {' '}
                · normal W×H {glassActual} SFT
                {glassUpliftPct != null && glassUpliftPct > 0 && (
                  <> (+{glassUpliftPct}% more area)</>
                )}
              </span>
            </>
          ) : (
            <>{glassCosting} SFT</>
          )}
          {glassRate != null ? ` · ${formatCurrency(glassRate)}/SFT` : ''}
          {glassLine && glassLine.amount > 0 ? ` = ${formatCurrency(glassLine.amount)}` : ''}
        </strong>
      </div>
      {breakdown.staircaseGlassFormula &&
        breakdown.staircaseGlassCostPerRft != null &&
        breakdown.staircaseRunRft != null &&
        breakdown.staircaseRunRft > 0 && (
          <div className="costing-summary-row costing-glass-rft-row">
            <span className="costing-summary-label">Glass per run (RFT)</span>
            <strong>
              {formatCurrency(breakdown.staircaseGlassCostPerRft)}/RFT
              <span className="costing-summary-sub">
                {' '}
                (glass ÷ {breakdown.staircaseRunRft} RFT actual run)
              </span>
            </strong>
          </div>
        )}
      {holeLine && holeLine.qty > 0 && (
        <div className="costing-summary-row">
          <span className="costing-summary-label">Hole drilling</span>
          <strong>
            {holeLine.qty} holes × {formatCurrency(holeLine.rate || DEFAULT_HOLE_CHARGE_PER_PCS)} ={' '}
            {formatCurrency(holeLine.amount)}
          </strong>
        </div>
      )}
      <div className="costing-summary-row">
        <span className="costing-summary-label">BOM material (1 set)</span>
        <strong>{formatCurrency(breakdown.subtotal)}</strong>
      </div>
      <div className="costing-summary-row">
        <span className="costing-summary-label">
          BOM ÷ {unit.toUpperCase()} (all items)
        </span>
        <strong>
          {quoteMatFromBom != null ? (
            <>
              {formatCurrency(quoteMatFromBom)}/{unit.toUpperCase()}
              {bomBasisQty > 0 && (
                <span className="costing-summary-sub">
                  {' '}
                  ({formatCurrency(breakdown.subtotal)} ÷ {bomBasisQty} {unit.toUpperCase()})
                </span>
              )}
            </>
          ) : (
            '—'
          )}
        </strong>
      </div>
      <div className="costing-summary-row costing-quote-row">
        <span className="costing-summary-label">Quotation ({unit.toUpperCase()})</span>
        <strong>
          {pq.installationRate > 0 ? (
            <>
              {formatCurrency(pq.rate)}/{unit.toUpperCase()} quote rate × {pq.basisQty} ={' '}
              <span className="costing-total-amount">{formatCurrency(quoteTotal)}</span>
            </>
          ) : (
            <>
              {formatCurrency(pq.materialRate)}/{unit.toUpperCase()} material →{' '}
              <span className="costing-total-amount">{formatCurrency(quoteTotal)}</span>
            </>
          )}
        </strong>
      </div>
    </div>
  )
}
