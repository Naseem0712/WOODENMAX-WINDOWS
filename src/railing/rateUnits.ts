import { quoteRailRft, totalRailMaterialRft } from './railLength'
import { FT_PER_M } from './units'
import type { CostBreakdown, CostingRates, CostLineItem, CostRateField } from './types'

export type RateUnit = 'sft' | 'rft' | 'rmt' | 'pcs'

export function rftRateToRmt(ratePerRft: number): number {
  return Math.round(ratePerRft * FT_PER_M * 100) / 100
}

export function rmtRateToRft(ratePerRmt: number): number {
  return Math.round((ratePerRmt / FT_PER_M) * 100) / 100
}

export function itemRateUnits(rateField?: CostRateField): RateUnit[] {
  switch (rateField) {
    case 'glassPerSft':
      return ['sft']
    case 'bottomRailRate':
    case 'handrailRate':
      return ['rft', 'rmt']
    case 'pillarPerPcs':
    case 'connector90PerPcs':
    case 'connector180PerPcs':
    case 'wallConnectorPerPcs':
    case 'anchorPerPcs':
      return ['pcs']
    default:
      return []
  }
}

export function getStoredRate(rates: CostingRates, field: CostRateField): number {
  return rates[field] as number
}

export function setStoredRate(
  rates: CostingRates,
  field: CostRateField,
  unit: RateUnit,
  value: number,
): CostingRates {
  if (unit === 'rmt' && (field === 'bottomRailRate' || field === 'handrailRate')) {
    return { ...rates, [field]: rmtRateToRft(value) }
  }
  return { ...rates, [field]: value }
}

export function displayRateForUnit(
  rates: CostingRates,
  field: CostRateField,
  unit: RateUnit,
): number {
  const base = getStoredRate(rates, field)
  if (unit === 'rmt' && (field === 'bottomRailRate' || field === 'handrailRate')) {
    return rftRateToRmt(base)
  }
  return base
}

export interface DesignQuantities {
  glassAreaSft: number
  bottomRailRft: number
  handrailRft: number
  perimeterRmt: number
  /** Perimeter run for package quote (single path, not bottom+handrail). */
  quoteRailRft: number
  /** Total rail stock to buy (bottom + handrail material). */
  totalRailMaterialRft: number
}

export function designQuantities(breakdown: CostBreakdown): DesignQuantities {
  return {
    glassAreaSft: breakdown.glassAreaSft,
    bottomRailRft: breakdown.bottomRailRft,
    handrailRft: breakdown.handrailRft,
    perimeterRmt: breakdown.perimeterRmt,
    quoteRailRft: quoteRailRft(
      breakdown.perimeterRmt,
      breakdown.bottomRailRft,
      breakdown.handrailRft,
    ),
    totalRailMaterialRft: totalRailMaterialRft(
      breakdown.bottomRailRft,
      breakdown.handrailRft,
    ),
  }
}

export function qtyForDisplayUnit(
  row: CostLineItem,
  unit: RateUnit,
  breakdown: CostBreakdown,
): number | null {
  const q = designQuantities(breakdown)
  if (!row.rateField) return null

  switch (row.rateField) {
    case 'glassPerSft':
      return unit === 'sft' ? q.glassAreaSft : null
    case 'bottomRailRate':
      if (unit === 'rft') return breakdown.bottomRailRft
      if (unit === 'rmt') return Math.round(breakdown.bottomRailRft / FT_PER_M * 1000) / 1000
      return null
    case 'handrailRate':
      if (unit === 'rft') return breakdown.handrailRft
      if (unit === 'rmt') return Math.round(breakdown.handrailRft / FT_PER_M * 1000) / 1000
      return null
    default:
      return unit === 'pcs' ? row.qty : null
  }
}
