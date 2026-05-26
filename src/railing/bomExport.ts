import { COMPANY } from './constants'
import { calculateDesign } from './calculations'
import { aggregateMaterialOrder } from './materialOrder'
import type { DesignDraft, QuotationLine, QuotationMeta } from './types'
import { displayDesignTitle, glassLabel } from './utils'

function csvEscape(val: string | number): string {
  const s = String(val ?? '')
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return `"${s.replace(/"/g, '""')}"`
  }
  return s
}

function downloadCsv(filename: string, rows: string[][]) {
  const bom = '\uFEFF' // UTF-8 BOM for Excel
  const body = rows.map((r) => r.map(csvEscape).join(',')).join('\n')
  const blob = new Blob([bom + body], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export function downloadOrderBom(
  meta: QuotationMeta,
  lines: QuotationLine[],
  currentDraft: DesignDraft | null,
) {
  const rows: string[][] = []
  const date = meta.date || new Date().toISOString().slice(0, 10)

  rows.push(['WOODENMAX — MATERIAL ORDER / BOM'])
  rows.push(['Company', COMPANY.name])
  rows.push(['GSTIN', COMPANY.gst])
  rows.push(['Quote #', meta.quoteNumber])
  rows.push(['Date', date])
  rows.push(['Client', meta.clientName])
  rows.push(['Client phone', meta.clientPhone])
  rows.push(['Client address', meta.clientAddress])
  rows.push(['Project', meta.projectName])
  rows.push([])

  // Per design detail
  rows.push(['=== DESIGNS (detail for order) ==='])
  rows.push([
    'Design name',
    'Type',
    'Sets qty',
    'Glass type',
    'Glass colour',
    'Hardware colour',
    'Anchor size',
    'Bottom rail profile',
    'Handrail profile',
    'Dimensions',
    'Height',
    'Bottom fixing',
    'Handrail',
    'Glass panels (size W×H mm)',
    'Glass area SFT',
    'Bottom rail RFT',
    'Handrail RFT',
    'Pillars pcs',
    '90° pcs',
    '180° pcs',
    'Wall conn pcs',
    'Anchors pcs',
    'Notes',
  ])

  const addDesignRows = (draft: DesignDraft, sets: number, notes: string) => {
    const calc = calculateDesign(draft)
    const hw = calc.hardware
    const glassPanels = calc.segments
      .flatMap((s) =>
        s.glasses.map(
          (gl) =>
            `${s.label}: ${gl.widthMm}×${gl.heightMm} mm (${s.glassCount} pcs × ${s.glassWidthMm})`,
        ),
      )
      .join(' | ')

    rows.push([
      displayDesignTitle(draft),
      draft.designType,
      String(sets),
      glassLabel(draft),
      draft.finish.glassColor,
      draft.finish.hardwareColor,
      draft.finish.anchorSize,
      draft.finish.bottomRailProfile,
      draft.finish.handrailProfile,
      draft.dimensions
        .filter((d) => d.unit === 'mm' && d.value > 0)
        .map((d) => `${d.label}:${d.value}mm`)
        .join(' · '),
      draft.heightMode === 'uniform'
        ? `${draft.uniformHeight} mm all sides`
        : draft.segmentHeights.map((h) => `${h.label}:${h.value}`).join(' · '),
      draft.bottomFixing === 'pillars' ? 'Pillars' : 'Continuous bottom rail',
      draft.includeHandrail ? 'Yes' : 'No',
      glassPanels,
      String(calc.totalGlassAreaSft),
      String(hw.bottomRailRft),
      String(hw.handrailRft),
      String(hw.totalPillars),
      String(hw.connector90),
      String(hw.connector180),
      String(hw.wallConnectors),
      String(hw.totalAnchors),
      notes,
    ])
  }

  for (const line of lines) {
    addDesignRows(line.draftSnapshot, line.quantity, line.notes)
  }

  if (currentDraft) {
    const hasSize = currentDraft.dimensions.some((d) => d.unit === 'mm' && d.value > 0)
    if (hasSize) {
      addDesignRows(currentDraft, currentDraft.quantity, `${currentDraft.notes} (draft)`)
    }
  }

  rows.push([])
  rows.push(['=== COMBINED ORDER TOTALS (purchase) ==='])
  rows.push(['Category', 'Item', 'Specification', 'Total qty', 'Unit', 'Used in designs'])

  const combined = aggregateMaterialOrder(lines, currentDraft)
  for (const o of combined) {
    rows.push([
      o.category,
      o.item,
      o.specification,
      String(o.totalQty),
      o.unit,
      o.sources.join('; '),
    ])
  }

  rows.push([])
  rows.push(['=== GLASS PANELS LIST (each piece) ==='])
  rows.push([
    'Design',
    'Side',
    'Panel #',
    'Width mm',
    'Height mm',
    'Glass type',
    'Glass colour',
    'Sets (multiply)',
  ])

  const addGlassPanels = (draft: DesignDraft, sets: number) => {
    const calc = calculateDesign(draft)
    const title = displayDesignTitle(draft)
    for (const seg of calc.segments) {
      seg.glasses.forEach((gl) => {
        rows.push([
          title,
          seg.label,
          String(gl.panelIndex),
          String(gl.widthMm),
          String(gl.heightMm),
          glassLabel(draft),
          draft.finish.glassColor,
          String(sets),
        ])
      })
    }
  }

  for (const line of lines) {
    addGlassPanels(line.draftSnapshot, line.quantity)
  }
  if (currentDraft?.dimensions.some((d) => d.unit === 'mm' && d.value > 0)) {
    addGlassPanels(currentDraft, currentDraft.quantity)
  }

  const fname = `WoodenMax-Order-BOM-${meta.quoteNumber || 'export'}-${date}.csv`
  downloadCsv(fname, rows)
}
