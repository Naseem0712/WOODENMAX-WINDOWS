import { rmtToRft } from './units'

/** Material to order: bottom + handrail are separate stock lengths. */
export function totalRailMaterialRft(bottomRailRft: number, handrailRft: number): number {
  return Math.round((bottomRailRft + handrailRft) * 100) / 100
}

/**
 * Single run along the railing path (perimeter) in RFT — for package rate × qty.
 * Bottom rail and handrail run parallel on the same path; do NOT add them for quoting.
 */
export function quoteRailRft(
  perimeterRmt: number,
  bottomRailRft: number,
  handrailRft: number,
): number {
  if (perimeterRmt > 0) {
    return Math.round(rmtToRft(perimeterRmt) * 100) / 100
  }
  return Math.round(Math.max(bottomRailRft, handrailRft) * 100) / 100
}
