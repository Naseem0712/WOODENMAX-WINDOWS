import { computeSetRates, displayQtyForUnit } from './costing'
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
  installationPerSft: 0,
  installationPerRft: 0,
  installationPerRmt: 0,
}

export function normalizePackageRates(r?: Partial<PackageRates> | null): PackageRates {
  return {
    perSft: Number(r?.perSft) || 0,
    perRft: Number(r?.perRft) || 0,
    perRmt: Number(r?.perRmt) || 0,
    installationPerSft: Number(r?.installationPerSft) || 0,
    installationPerRft: Number(r?.installationPerRft) || 0,
    installationPerRmt: Number(r?.installationPerRmt) || 0,
  }
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

export function installationRateForUnit(rates: PackageRates, unit: RateDisplayUnit): number {
  switch (unit) {
    case 'sft':
      return rates.installationPerSft
    case 'rmt':
      return rates.installationPerRmt
    case 'rft':
    default:
      return rates.installationPerRft
  }
}

export function packageMaterialKey(
  unit: RateDisplayUnit,
): keyof Pick<PackageRates, 'perSft' | 'perRft' | 'perRmt'> {
  switch (unit) {
    case 'sft':
      return 'perSft'
    case 'rmt':
      return 'perRmt'
    case 'rft':
    default:
      return 'perRft'
  }
}

export function packageInstallationKey(
  unit: RateDisplayUnit,
): keyof Pick<PackageRates, 'installationPerSft' | 'installationPerRft' | 'installationPerRmt'> {
  switch (unit) {
    case 'sft':
      return 'installationPerSft'
    case 'rmt':
      return 'installationPerRmt'
    case 'rft':
    default:
      return 'installationPerRft'
  }
}

export function setRateForQuoteUnit(
  setRates: CostBreakdown['setRates'],
  unit: RateDisplayUnit,
): number | null {
  switch (unit) {
    case 'sft':
      return setRates.perSft
    case 'rmt':
      return setRates.perRmt
    case 'rft':
    default:
      return setRates.perRft
  }
}

/** BOM-derived set rates (per SFT / RFT / RMT) for the current design. */
export function bomSetRatesForBreakdown(breakdown: CostBreakdown) {
  if (breakdown.setRates) return breakdown.setRates
  return computeSetRates(
    breakdown.subtotal,
    breakdown.glassAreaSft,
    breakdown.bottomRailRft,
    breakdown.handrailRft,
    breakdown.perimeterRmt,
  )
}

/** Material ₹/unit from package inputs, or BOM ÷ basis when quote rate not entered yet. */
export function effectiveMaterialRate(
  draft: DesignDraft,
  breakdown: CostBreakdown,
  unit?: RateDisplayUnit,
): number {
  const u = unit ?? draft.packageQuoteUnit ?? 'rft'
  const fromPackage = packageRateForUnit(normalizePackageRates(draft.packageRates), u)
  if (fromPackage > 0) return fromPackage
  return setRateForQuoteUnit(bomSetRatesForBreakdown(breakdown), u) ?? 0
}

export function packageRatesFromSetRates(
  setRates: CostBreakdown['setRates'],
  unit: RateDisplayUnit = 'rft',
): PackageRates {
  const mat = setRateForQuoteUnit(setRates, unit) ?? 0
  return {
    ...DEFAULT_PACKAGE_RATES,
    [packageMaterialKey(unit)]: mat,
  }
}

/** Fill active quote unit material from BOM when still zero. */
export function packageRatesWithBomMaterial(
  draft: DesignDraft,
  breakdown: CostBreakdown,
): PackageRates {
  const unit = draft.packageQuoteUnit ?? 'rft'
  const rates = normalizePackageRates(draft.packageRates)
  const matKey = packageMaterialKey(unit)
  if (rates[matKey] > 0) return rates
  const bomMat = setRateForQuoteUnit(bomSetRatesForBreakdown(breakdown), unit) ?? 0
  if (bomMat <= 0) return rates
  return { ...rates, [matKey]: bomMat }
}

export function resolvePackageQuote(
  draft: DesignDraft,
  breakdown: CostBreakdown,
): PackageQuote {
  const unit = draft.packageQuoteUnit ?? 'rft'
  const basis = displayQtyForUnit(breakdown, unit)
  const rates = packageRatesWithBomMaterial(draft, breakdown)
  const materialRate = effectiveMaterialRate(draft, breakdown, unit)
  const installationRate = installationRateForUnit(rates, unit)
  const rate = materialRate + installationRate
  const amountPerSet = Math.round(basis.qty * rate * 100) / 100
  return {
    unit,
    rate,
    materialRate,
    installationRate,
    basisQty: basis.qty,
    basisLabel: basis.label,
    amountPerSet,
  }
}

export function packageLineTotal(draft: DesignDraft, breakdown: CostBreakdown): number {
  const pq = resolvePackageQuote(draft, breakdown)
  return Math.round(pq.amountPerSet * draft.quantity * 100) / 100
}
