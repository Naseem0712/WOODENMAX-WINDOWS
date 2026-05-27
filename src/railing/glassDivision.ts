import { calcGlassWidth } from './calculations'

/** Recommended toughened panel width band (mm). */
export const GLASS_PANEL_MIN_MM = 1500
export const GLASS_PANEL_MAX_MM = 2440

export interface GlassPanelSuggestion {
  count: number
  panelWidthMm: number
  reason: string
  inRange: boolean
}

/** Suggest panel count so each glass width stays within 1500–2440 mm when possible. */
export function suggestGlassPanelCount(runMm: number, gapMm: number): GlassPanelSuggestion {
  if (runMm <= 0) {
    return { count: 1, panelWidthMm: 0, reason: 'Enter run length', inRange: false }
  }

  const gap = Math.max(6, gapMm || 12)
  let minCount = 1
  while (minCount < 20) {
    const w = calcGlassWidth(runMm, minCount, gap)
    if (w <= GLASS_PANEL_MAX_MM) break
    minCount++
  }

  for (let c = minCount; c <= 20; c++) {
    const w = calcGlassWidth(runMm, c, gap)
    if (w >= GLASS_PANEL_MIN_MM && w <= GLASS_PANEL_MAX_MM) {
      return {
        count: c,
        panelWidthMm: w,
        inRange: true,
        reason: `${c} panels → ${Math.round(w)} mm each (1500–2440 mm)`,
      }
    }
    if (w > 0 && w < GLASS_PANEL_MIN_MM && c > minCount) break
  }

  const count = minCount
  const panelWidthMm = calcGlassWidth(runMm, count, gap)
  return {
    count,
    panelWidthMm,
    inRange: panelWidthMm >= GLASS_PANEL_MIN_MM && panelWidthMm <= GLASS_PANEL_MAX_MM,
    reason: `${count} panels → ${Math.round(panelWidthMm)} mm each`,
  }
}

/** List practical divide counts with resulting panel width (for quick-pick chips). */
export function listGlassDivideOptions(
  runMm: number,
  gapMm: number,
  maxChoices = 6,
): GlassPanelSuggestion[] {
  if (runMm <= 0) return []
  const gap = Math.max(6, gapMm || 12)
  const suggested = suggestGlassPanelCount(runMm, gap)
  const start = Math.max(1, suggested.count - 1)
  const end = Math.min(20, start + maxChoices - 1)
  const out: GlassPanelSuggestion[] = []
  for (let c = start; c <= end; c++) {
    const panelWidthMm = calcGlassWidth(runMm, c, gap)
    if (panelWidthMm <= 0) continue
    out.push({
      count: c,
      panelWidthMm,
      inRange: panelWidthMm >= GLASS_PANEL_MIN_MM && panelWidthMm <= GLASS_PANEL_MAX_MM,
      reason: `${c} → ${Math.round(panelWidthMm)} mm`,
    })
  }
  return out
}
