import type { CostingRates } from './types'

const STORAGE_KEY = 'railingq-costing-rates-v1'

export const DEFAULT_RATES: CostingRates = {
  glassPerSft: 0,
  pillarPerPcs: 0,
  connector90PerPcs: 0,
  connector180PerPcs: 0,
  wallConnectorPerPcs: 0,
  bottomRailRate: 0,
  bottomRailRateMode: 'rft',
  bottomRailKgPerRft: 0,
  handrailRate: 0,
  handrailRateMode: 'rft',
  handrailKgPerRft: 0,
  anchorPerPcs: 0,
  quoteDisplayUnit: 'rft',
  referenceGlassPerSft: 450,
  referenceBottomRailPerRft: 100,
  referenceHandrailPerRft: 120,
  referencePillarPerPcs: 2500,
  referenceConnector90: 800,
  referenceConnector180: 600,
  referenceWallConnector: 700,
  referenceAnchor: 25,
}

export function loadRates(): CostingRates {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return { ...DEFAULT_RATES }
    return { ...DEFAULT_RATES, ...JSON.parse(raw) }
  } catch {
    return { ...DEFAULT_RATES }
  }
}

export function saveRates(rates: CostingRates): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(rates))
}
