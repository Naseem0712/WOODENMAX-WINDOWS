import { countPathBends } from './segmentLayout'
import { planRailStock } from './railStock'
import { isStaircaseDraft } from './presets'
import {
  staircaseGlassBillLengthMm,
  sumGlassAreasFromSegments,
} from './staircaseGlass'
import { mmToFt, sqmToSft } from './units'
import type {
  DesignCalculation,
  DesignDraft,
  DesignType,
  CalculatedGlass,
  CalculatedSegment,
  BomLine,
  HardwareCounts,
  PillarsPerGlass,
  RailStockPlanSummary,
} from './types'

const DEFAULT_GAP = 12
const DEFAULT_INSET = 150

export function countAnchors(
  pillars: number,
  studs: number,
  bottomRailRft: number,
  bottomFixing: DesignDraft['bottomFixing'],
): number {
  let n = pillars * 2 + studs * 2
  if (bottomFixing === 'continuous-rail' && bottomRailRft > 0) {
    n += Math.ceil(bottomRailRft)
  }
  return n
}

function countEndCaps(
  includeHandrail: boolean,
  type: DesignType,
  activeCount: number,
  wallConnectors: number,
): number {
  if (!includeHandrail) return 0
  if (type === 'o-type' && activeCount >= 4) return 0
  return Math.max(2, wallConnectors)
}

/** Gaps = panels + 1 (both ends + between each glass) */
export function calcGlassWidth(runMm: number, panelCount: number, gapMm: number): number {
  if (panelCount < 1 || runMm <= 0) return 0
  const totalGap = (panelCount + 1) * gapMm
  const usable = runMm - totalGap
  if (usable <= 0) return 0
  return Math.round((usable / panelCount) * 100) / 100
}

export function pillarPositionsOnGlass(
  glassWidthMm: number,
  count: PillarsPerGlass,
  insetMm: number,
): number[] {
  const W = glassWidthMm
  const I = insetMm
  if (W <= 0) return []

  if (count === 2) {
    return [I, W - I]
  }
  if (count === 3) {
    return [I, W / 2, W - I]
  }
  // 4 pillars: both edges at inset + two equal in centre span
  const inner = W - 2 * I
  if (inner <= 0) return [I, W - I]
  return [I, I + inner / 3, I + (2 * inner) / 3, W - I]
}

function activeMmSegments(draft: DesignDraft) {
  return draft.dimensions.filter((d) => d.unit === 'mm' && d.value > 0)
}

function segmentHeight(draft: DesignDraft, key: string): number {
  if (draft.heightMode === 'uniform') return draft.uniformHeight
  return draft.segmentHeights.find((h) => h.key === key)?.value ?? draft.uniformHeight
}

function countCornersAndWalls(
  type: DesignType,
  activeCount: number,
  dimensions: DesignDraft['dimensions'],
): {
  lConnectors: number
  wallConnectors: number
} {
  if (activeCount === 0) return { lConnectors: 0, wallConnectors: 0 }

  switch (type) {
    case 'straight':
      return { lConnectors: 0, wallConnectors: 2 }
    case 'l-type':
      return { lConnectors: 1, wallConnectors: 2 }
    case 'u-type':
      return { lConnectors: 2, wallConnectors: 2 }
    case 'o-type': {
      // Closed rectangle: 4 corners; partial perimeter if a side is 0
      if (activeCount >= 4) return { lConnectors: 4, wallConnectors: 0 }
      if (activeCount === 3) return { lConnectors: 2, wallConnectors: 0 }
      return { lConnectors: Math.max(0, activeCount - 1), wallConnectors: 0 }
    }
    case 'balcony': {
      // Open front: walls on ends of side segments only
      return { lConnectors: Math.max(0, activeCount - 1), wallConnectors: 2 }
    }
    case 'zigzag-type':
    case 'custom': {
      const path = countPathBends(dimensions)
      return { lConnectors: path.connector90, wallConnectors: path.wallConnectors }
    }
    case 'staircase':
      return { lConnectors: 0, wallConnectors: 2 }
    default:
      return { lConnectors: Math.max(0, activeCount - 1), wallConnectors: 2 }
  }
}

export function calculateDesign(draft: DesignDraft): DesignCalculation {
  const active = activeMmSegments(draft)
  const segments: CalculatedSegment[] = []

  for (const dim of active) {
    const cfg =
      draft.segmentConfigs.find((c) => c.key === dim.key) ??
      defaultConfigFor(dim.key, dim.label, draft.finish)

    const runLengthMm = dim.value
    const glassCount = Math.max(1, cfg.glassCount)
    const gapMm = cfg.gapMm || DEFAULT_GAP
    const totalGapMm = (glassCount + 1) * gapMm
    const glassWidthMm = calcGlassWidth(runLengthMm, glassCount, gapMm)
    const heightMm = segmentHeight(draft, dim.key)
    const pillarsPerGlass =
      draft.bottomFixing === 'pillars' ? cfg.pillarsPerGlass : 0
    const studsPerGlass =
      draft.bottomFixing === 'studs' ? (cfg.studsPerGlass ?? cfg.pillarsPerGlass ?? 2) : 0
    const supportPerGlass = pillarsPerGlass || studsPerGlass

    const glasses: CalculatedGlass[] = []
    let pillarsInSegment = 0

    for (let i = 0; i < glassCount; i++) {
      const positions =
        supportPerGlass > 0
          ? pillarPositionsOnGlass(
              glassWidthMm,
              supportPerGlass as PillarsPerGlass,
              cfg.pillarInsetMm || DEFAULT_INSET,
            )
          : []
      pillarsInSegment += positions.length
      const isStaircaseSeg = isStaircaseDraft(draft)
      glasses.push({
        segmentKey: dim.key,
        segmentLabel: dim.label,
        panelIndex: i + 1,
        widthMm: glassWidthMm,
        heightMm,
        pillarPositionsMm: positions.map((p) => Math.round(p * 10) / 10),
        staircaseBillLengthMm: isStaircaseSeg
          ? staircaseGlassBillLengthMm(glassWidthMm, heightMm)
          : undefined,
      })
    }

    segments.push({
      key: dim.key,
      label: dim.label,
      runLengthMm,
      glassCount,
      gapMm,
      totalGapMm,
      glassWidthMm,
      heightMm,
      glasses,
      pillarsInSegment,
    })
  }

  const perimeterRunMm = segments.reduce((s, seg) => s + seg.runLengthMm, 0)
  const { lConnectors, wallConnectors } = countCornersAndWalls(
    draft.designType,
    segments.length,
    draft.dimensions,
  )

  const bottomRailMm =
    draft.bottomFixing === 'continuous-rail' ? perimeterRunMm : 0
  const handrailMm = draft.includeHandrail ? perimeterRunMm : 0
  const totalPillars =
    draft.bottomFixing === 'pillars'
      ? segments.reduce((s, seg) => s + seg.pillarsInSegment, 0)
      : 0
  const totalStuds =
    draft.bottomFixing === 'studs'
      ? segments.reduce((s, seg) => s + seg.pillarsInSegment, 0)
      : 0

  const bottomRailRft = mmToFt(bottomRailMm)
  const handrailRft = mmToFt(handrailMm)
  const bottomStock = planRailStock(bottomRailRft)
  const handrailStock = planRailStock(handrailRft)

  const isStaircase = isStaircaseDraft(draft)
  const connector180 =
    !isStaircase && draft.includeHandrail ? handrailStock.joints180 : 0
  const endCaps = countEndCaps(
    draft.includeHandrail,
    draft.designType,
    segments.length,
    wallConnectors,
  )

  const stockSummary = (p: ReturnType<typeof planRailStock>): RailStockPlanSummary => ({
    totalBars: p.totalBars,
    requiredFt: p.requiredFt,
    wasteFt: p.wasteFt,
    joints180: p.joints180,
    barSizes: p.bars.map((b) => `${b.lengthFt}ft`).join(' + ') || '—',
  })

  const hardware: HardwareCounts = {
    connector90: lConnectors,
    connector180,
    wallConnectors,
    endCaps,
    bottomRailMm,
    handrailMm,
    bottomRailRft: Math.round(bottomRailRft * 100) / 100,
    handrailRft: Math.round(handrailRft * 100) / 100,
    bottomRailStock: stockSummary(bottomStock),
    handrailStock: stockSummary(handrailStock),
    totalPillars,
    totalStuds,
    totalAnchors: countAnchors(
      totalPillars,
      totalStuds,
      Math.round(bottomRailRft * 100) / 100,
      draft.bottomFixing,
    ),
  }

  const bom = buildBom(draft, segments, hardware, isStaircase)
  const totalGlassPanels = segments.reduce((s, seg) => s + seg.glassCount, 0)
  const glassAreas = sumGlassAreasFromSegments(segments)
  const totalGlassAreaSqmActual = Math.round(glassAreas.actualSqm * 100) / 100
  const totalGlassAreaSftActual =
    Math.round(sqmToSft(glassAreas.actualSqm) * 100) / 100
  const costingSqm = isStaircase ? glassAreas.staircaseCostingSqm : glassAreas.actualSqm
  const totalGlassAreaSqmRounded = Math.round(costingSqm * 100) / 100
  const totalGlassAreaSft =
    Math.round(sqmToSft(totalGlassAreaSqmRounded) * 100) / 100

  return {
    segments,
    hardware,
    bom,
    totalGlassPanels,
    totalGlassAreaSqm: totalGlassAreaSqmRounded,
    totalGlassAreaSft,
    totalGlassAreaSqmActual,
    totalGlassAreaSftActual,
    perimeterRunMm,
  }
}

function buildBom(
  draft: DesignDraft,
  segments: CalculatedSegment[],
  hw: HardwareCounts,
  staircaseBilling = false,
): BomLine[] {
  const lines: BomLine[] = []

  const glassMap = new Map<string, { w: number; h: number; qty: number; bill?: number }>()
  for (const seg of segments) {
    for (const g of seg.glasses) {
      const bill = g.staircaseBillLengthMm
      const k = staircaseBilling && bill != null ? `${bill}×${g.heightMm}` : `${g.widthMm}×${g.heightMm}`
      const prev = glassMap.get(k)
      if (prev) prev.qty += 1
      else
        glassMap.set(k, {
          w: staircaseBilling && bill != null ? bill : g.widthMm,
          h: g.heightMm,
          qty: 1,
          bill,
        })
    }
  }

  for (const [, v] of glassMap) {
    const spec =
      staircaseBilling && v.bill != null
        ? `${v.bill} × ${v.h} mm (bill L×H; panel ${v.bill - v.h} + ${v.h})`
        : `${v.w} × ${v.h} mm (W × H)`
    lines.push({
      category: 'glass',
      item: 'Toughened / Laminated glass panel',
      specification: spec,
      qty: v.qty,
      unit: 'pcs',
    })
  }

  if (hw.bottomRailRft > 0) {
    lines.push({
      category: 'rail',
      item: 'Bottom continuous profile',
      specification: `${hw.bottomRailRft} RFT · Stock: ${hw.bottomRailStock.barSizes} (${hw.bottomRailStock.totalBars} bars, waste ${hw.bottomRailStock.wasteFt}ft)`,
      qty: hw.bottomRailRft,
      unit: 'RFT',
    })
  }

  if (hw.handrailRft > 0) {
    lines.push({
      category: 'rail',
      item: 'SS Handrail (top)',
      specification: `${hw.handrailRft} RFT · Stock: ${hw.handrailStock.barSizes}`,
      qty: hw.handrailRft,
      unit: 'RFT',
    })
  }

  if (hw.totalAnchors > 0) {
    lines.push({
      category: 'hardware',
      item: 'Anchors',
      specification: '2/pillar + 1/RFT bottom rail',
      qty: hw.totalAnchors,
      unit: 'pcs',
    })
  }

  if (hw.totalPillars > 0) {
    lines.push({
      category: 'hardware',
      item: 'Floor pillars / posts',
      specification: `As per layout (${draft.segmentConfigs.map((c) => `${c.pillarsPerGlass}/glass`).join(', ')})`,
      qty: hw.totalPillars,
      unit: 'pcs',
    })
  }

  if (hw.totalStuds > 0) {
    lines.push({
      category: 'hardware',
      item: 'Glass studs',
      specification: `As per layout (${draft.segmentConfigs.map((c) => `${c.studsPerGlass ?? c.pillarsPerGlass}/glass`).join(', ')})`,
      qty: hw.totalStuds,
      unit: 'pcs',
    })
  }

  if (hw.endCaps > 0) {
    lines.push({
      category: 'hardware',
      item: 'Handrail end cap',
      specification: 'Open handrail ends',
      qty: hw.endCaps,
      unit: 'pcs',
    })
  }

  if (hw.connector90 > 0) {
    lines.push({
      category: 'hardware',
      item: '90° connector (L-corner)',
      specification: 'Corner joint',
      qty: hw.connector90,
      unit: 'pcs',
    })
  }

  if (hw.connector180 > 0) {
    lines.push({
      category: 'hardware',
      item: '180° joint connector',
      specification: `Handrail splice (${hw.handrailStock.barSizes})`,
      qty: hw.connector180,
      unit: 'pcs',
    })
  }

  if (hw.wallConnectors > 0) {
    lines.push({
      category: 'hardware',
      item: 'Wall connector',
      specification: 'End fixing to wall',
      qty: hw.wallConnectors,
      unit: 'pcs',
    })
  }

  return lines
}

export function defaultConfigFor(
  key: string,
  label: string,
  finish?: { handrailProfile: string; bottomRailProfile: string },
) {
  const f = finish ?? {
    handrailProfile: 'SS round tube 50mm',
    bottomRailProfile: 'Aluminium U channel',
  }
  return {
    key,
    label,
    glassCount: 2,
    gapMm: DEFAULT_GAP,
    pillarsPerGlass: 2 as PillarsPerGlass,
    pillarInsetMm: DEFAULT_INSET,
    studsPerGlass: 2 as PillarsPerGlass,
    handrailProfile: f.handrailProfile,
    bottomRailProfile: f.bottomRailProfile,
  }
}

export function syncSegmentConfigs(
  draft: DesignDraft,
): DesignDraft['segmentConfigs'] {
  const active = draft.dimensions.filter((d) => d.unit === 'mm' && d.value > 0)
  return active.map((d) => {
    const existing = draft.segmentConfigs.find((c) => c.key === d.key)
    return existing
      ? { ...existing, label: d.label }
      : defaultConfigFor(d.key, d.label, draft.finish)
  })
}
