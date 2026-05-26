import { displayQtyForUnit } from './costing'
import type {
  CostBreakdown,
  DesignDraft,
  PackageQuote,
  PackageRates,
  RateDisplayUnit,
} from './types'

export const DEFAULT_PACKAGE_RATES: PackageRates = {
  perSft: 0,
  perRft: 0,
  perRmt: 0,
}

export function packageRateForUnit(rates: PackageRates, unit: RateDisplayUnit): number {
  switch (unit) {
    case 'sft':
      return rates.perSft
    case 'rmt':
      return rates.perRmt
    case 'rft':
    default:
      return rates.perRft
  }
}

export function packageRatesFromSetRates(
  setRates: CostBreakdown['setRates'],
): PackageRates {
  return {
    perSft: setRates.perSft ?? 0,
    perRft: setRates.perRft ?? 0,
    perRmt: setRates.perRmt ?? 0,
  }
}

export function resolvePackageQuote(
  draft: DesignDraft,
  breakdown: CostBreakdown,
): PackageQuote {
  const unit = draft.packageQuoteUnit ?? breakdown.displayUnit
  const basis = displayQtyForUnit(breakdown, unit)
  const rate = packageRateForUnit(draft.packageRates ?? DEFAULT_PACKAGE_RATES, unit)
  const amountPerSet = Math.round(basis.qty * rate * 100) / 100
  return {
    unit,
    rate,
    basisQty: basis.qty,
    basisLabel: basis.label,
    amountPerSet,
  }
}

export function packageLineTotal(draft: DesignDraft, breakdown: CostBreakdown): number {
  const pq = resolvePackageQuote(draft, breakdown)
  return Math.round(pq.amountPerSet * draft.quantity * 100) / 100
}
