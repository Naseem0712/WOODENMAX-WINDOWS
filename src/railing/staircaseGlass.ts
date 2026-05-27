import { sqmToSft } from './units'
import type { CalculatedSegment } from './types'

/**
 * Staircase toughened glass billing length (mm): panel width along run + height once
 * (angle cut allowance). Example: 1500 + 1000 = 2500 mm → area 2500×1000 mm.
 */
export function staircaseGlassBillLengthMm(panelWidthAlongRunMm: number, heightMm: number): number {
  return panelWidthAlongRunMm + heightMm
}

/** Costing area for one panel (sq m): bill length × height. */
export function staircaseGlassPanelAreaSqm(
  panelWidthAlongRunMm: number,
  heightMm: number,
): number {
  const billMm = staircaseGlassBillLengthMm(panelWidthAlongRunMm, heightMm)
  return (billMm * heightMm) / 1_000_000
}

export function sumGlassAreasFromSegments(segments: CalculatedSegment[]): {
  actualSqm: number
  staircaseCostingSqm: number
  panelCount: number
} {
  let actualSqm = 0
  let staircaseCostingSqm = 0
  let panelCount = 0
  for (const seg of segments) {
    for (const g of seg.glasses) {
      panelCount += 1
      actualSqm += (g.widthMm * g.heightMm) / 1_000_000
      staircaseCostingSqm += staircaseGlassPanelAreaSqm(g.widthMm, g.heightMm)
    }
  }
  return {
    actualSqm: Math.round(actualSqm * 10000) / 10000,
    staircaseCostingSqm: Math.round(staircaseCostingSqm * 10000) / 10000,
    panelCount,
  }
}

export function staircaseGlassAreaSft(segments: CalculatedSegment[]): number {
  const { staircaseCostingSqm } = sumGlassAreasFromSegments(segments)
  return Math.round(sqmToSft(staircaseCostingSqm) * 100) / 100
}

export function actualGlassAreaSft(segments: CalculatedSegment[]): number {
  const { actualSqm } = sumGlassAreasFromSegments(segments)
  return Math.round(sqmToSft(actualSqm) * 100) / 100
}
