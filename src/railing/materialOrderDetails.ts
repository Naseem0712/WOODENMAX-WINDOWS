import { calculateDesign } from './calculations'
import { aggregateMaterialOrder } from './materialOrder'
import { sqmToSft } from './units'
import type { DesignDraft, QuotationLine } from './types'
import { displayDesignTitle, glassLabel } from './utils'

export interface GlassPanelOrderRow {
  designName: string
  segmentLabel: string
  panelIndex: number
  widthMm: number
  heightMm: number
  glassType: string
  glassColor: string
  setsQty: number
  totalPanels: number
  areaSftPerPanel: number
  totalAreaSft: number
}

function panelAreaSft(widthMm: number, heightMm: number): number {
  const sqm = (widthMm * heightMm) / 1_000_000
  return Math.round(sqmToSft(sqm) * 100) / 100
}

function addDesignGlassRows(
  rows: GlassPanelOrderRow[],
  draft: DesignDraft,
  setsQty: number,
  designName: string,
) {
  const calc = calculateDesign(draft)
  const glassType = glassLabel(draft)
  const glassColor = draft.finish.glassColor

  for (const seg of calc.segments) {
    for (const gl of seg.glasses) {
      const areaSftPerPanel = panelAreaSft(gl.widthMm, gl.heightMm)
      rows.push({
        designName,
        segmentLabel: seg.label,
        panelIndex: gl.panelIndex,
        widthMm: gl.widthMm,
        heightMm: gl.heightMm,
        glassType,
        glassColor,
        setsQty,
        totalPanels: setsQty,
        areaSftPerPanel,
        totalAreaSft: Math.round(areaSftPerPanel * setsQty * 100) / 100,
      })
    }
  }
}

export function collectGlassPanelOrders(
  lines: QuotationLine[],
  currentDraft: DesignDraft | null,
): GlassPanelOrderRow[] {
  const rows: GlassPanelOrderRow[] = []

  for (const line of lines) {
    const name = line.designName.trim() || line.designLabel || line.designType
    addDesignGlassRows(rows, line.draftSnapshot, line.quantity, name)
  }

  if (currentDraft?.dimensions.some((d) => d.unit === 'mm' && d.value > 0)) {
    addDesignGlassRows(
      rows,
      currentDraft,
      currentDraft.quantity,
      `${displayDesignTitle(currentDraft)} (draft)`,
    )
  }

  return rows
}

export function glassOrderTotals(rows: GlassPanelOrderRow[]) {
  const totalPanels = rows.reduce((s, r) => s + r.totalPanels, 0)
  const totalAreaSft = Math.round(rows.reduce((s, r) => s + r.totalAreaSft, 0) * 100) / 100
  return { totalPanels, totalAreaSft }
}

export function collectHardwareOrder(
  lines: QuotationLine[],
  currentDraft: DesignDraft | null,
) {
  return aggregateMaterialOrder(lines, currentDraft).filter(
    (o) => o.category === 'hardware' || o.category === 'rail',
  )
}
