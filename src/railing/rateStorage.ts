import type { CostingRates } from './types'

const STORAGE_KEY = 'railingq-costing-rates-v1'

export const DEFAULT_RATES: CostingRates = {
  glassPerSft: 0,
  pillarPerPcs: 0,
  studPerPcs: 0,
  connector90PerPcs: 0,
  connector180PerPcs: 0,
  wallConnectorPerPcs: 0,
  endCapPerPcs: 0,
  bottomRailRate: 0,
  bottomRailRateMode: 'rft',
  bottomRailKgPerRft: 0,
  handrailRate: 0,
  handrailRateMode: 'rft',
  handrailKgPerRft: 0,
  anchorPerPcs: 0,
  holePerPcs: 100,
  quoteDisplayUnit: 'rft',
  referenceGlassPerSft: 450,
  referenceBottomRailPerRft: 100,
  referenceHandrailPerRft: 120,
  referencePillarPerPcs: 2500,
  referenceStudPerPcs: 1800,
  referenceConnector90: 800,
  referenceConnector180: 600,
  referenceWallConnector: 700,
  referenceEndCap: 350,
  referenceAnchor: 25,
  referenceHolePerPcs: 100,
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
