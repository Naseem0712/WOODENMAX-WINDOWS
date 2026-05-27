import { calculateDesign, countAnchors } from './calculations'
import { isStaircaseDraft } from './presets'
import { quoteRailRft } from './railLength'
import { mmToFt, mmToRmt, sqmToSft } from './units'
import type {
  CostBreakdown,
  CostingRates,
  CostLineItem,
  CostRateField,
  DesignDraft,
  SetRatesPerUnit,
} from './types'

function line(
  label: string,
  qty: number,
  unit: string,
  rate: number,
  rateField?: CostRateField,
  refRate?: number,
): CostLineItem {
  const amount = Math.round(qty * rate * 100) / 100
  const refAmount =
    refRate !== undefined ? Math.round(qty * refRate * 100) / 100 : undefined
  return { label, qty, unit, rate, amount, rateField, referenceAmount: refAmount }
}

function railCost(
  label: string,
  rft: number,
  rates: CostingRates,
  mode: 'bottom' | 'handrail',
): CostLineItem {
  const isBottom = mode === 'bottom'
  const rateMode = isBottom ? rates.bottomRailRateMode : rates.handrailRateMode
  const rate = isBottom ? rates.bottomRailRate : rates.handrailRate
  const kgPerRft = isBottom ? rates.bottomRailKgPerRft : rates.handrailKgPerRft
  const ref = isBottom ? rates.referenceBottomRailPerRft : rates.referenceHandrailPerRft
  const rateField: CostRateField = isBottom ? 'bottomRailRate' : 'handrailRate'

  if (rateMode === 'kg') {
    const kg = rft * kgPerRft
    return line(`${label} (kg)`, kg, 'kg', rate, rateField, ref ? ref * kgPerRft : undefined)
  }
  return line(label, rft, 'RFT', rate, rateField, ref)
}

/** Glass BOM line from costing (user-entered ₹/SFT), if any. */
export function glassCostLine(breakdown: CostBreakdown): CostLineItem | undefined {
  return breakdown.items.find((i) => i.rateField === 'glassPerSft')
}

export function supportHoleCount(hw: {
  totalPillars: number
  totalStuds: number
}): number {
  return hw.totalPillars + hw.totalStuds
}

export function holeCostLine(breakdown: CostBreakdown): CostLineItem | undefined {
  return breakdown.items.find((i) => i.rateField === 'holePerPcs')
}

/** Entered glass material rate (not BOM ÷ SFT). */
export function glassEnteredRatePerSft(breakdown: CostBreakdown): number | null {
  const row = glassCostLine(breakdown)
  if (!row || row.rate <= 0) return null
  return row.rate
}

/** Total subtotal divided by glass SFT, rail RFT, and run RMT (per 1 set) — blended BOM averages, not item rates. */
export function computeSetRates(
  subtotal: number,
  glassAreaSft: number,
  bottomRailRft: number,
  handrailRft: number,
  perimeterRmt: number,
): SetRatesPerUnit {
  const railRftBasis = quoteRailRft(perimeterRmt, bottomRailRft, handrailRft)
  const div = (qty: number) =>
    qty > 0 ? Math.round((subtotal / qty) * 100) / 100 : null

  return {
    perSft: div(glassAreaSft),
    perRft: div(railRftBasis),
    perRmt: div(perimeterRmt),
    railRftBasis,
  }
}

export function calculateCosting(
  draft: DesignDraft,
  rates: CostingRates,
): CostBreakdown {
  const design = calculateDesign(draft)
  const hw = design.hardware
  const staircase = isStaircaseDraft(draft)
  const glassAreaSftActual =
    Math.round(sqmToSft(design.totalGlassAreaSqmActual ?? design.totalGlassAreaSqm) * 100) /
    100
  const glassAreaSft = Math.round(sqmToSft(design.totalGlassAreaSqm) * 100) / 100
  const staircaseRunRft = Math.round(mmToFt(design.perimeterRunMm) * 100) / 100
  const bottomRailRft = Math.round(mmToFt(hw.bottomRailMm) * 100) / 100
  const handrailRft = Math.round(mmToFt(hw.handrailMm) * 100) / 100
  const perimeterRmt = Math.round(mmToRmt(design.perimeterRunMm) * 100) / 100

  const items: CostLineItem[] = []
  let staircaseGlassCostPerRft: number | null = null

  if (glassAreaSft > 0) {
    const glassLabel = staircase
      ? `Glass (staircase: (W+H) × H per panel)`
      : 'Glass'
    const glassRow = line(
      glassLabel,
      glassAreaSft,
      'SFT',
      rates.glassPerSft,
      'glassPerSft',
      rates.referenceGlassPerSft,
    )
    items.push(glassRow)
    if (staircase && staircaseRunRft > 0 && glassRow.amount > 0) {
      staircaseGlassCostPerRft =
        Math.round((glassRow.amount / staircaseRunRft) * 100) / 100
    }
  }

  if (hw.totalPillars > 0) {
    items.push(
      line(
        'Bottom pillars',
        hw.totalPillars,
        'pcs',
        rates.pillarPerPcs,
        'pillarPerPcs',
        rates.referencePillarPerPcs,
      ),
    )
  }

  if (hw.totalStuds > 0) {
    items.push(
      line(
        'Glass studs',
        hw.totalStuds,
        'pcs',
        rates.studPerPcs,
        'studPerPcs',
        rates.referenceStudPerPcs,
      ),
    )
  }

  if (hw.connector90 > 0) {
    items.push(
      line(
        '90° connector (L-corner)',
        hw.connector90,
        'pcs',
        rates.connector90PerPcs,
        'connector90PerPcs',
        rates.referenceConnector90,
      ),
    )
  }

  if (hw.connector180 > 0) {
    items.push(
      line(
        '180° joint connector (rail splice)',
        hw.connector180,
        'pcs',
        rates.connector180PerPcs,
        'connector180PerPcs',
        rates.referenceConnector180,
      ),
    )
  }

  if (hw.wallConnectors > 0) {
    items.push(
      line(
        'Wall connector',
        hw.wallConnectors,
        'pcs',
        rates.wallConnectorPerPcs,
        'wallConnectorPerPcs',
        rates.referenceWallConnector,
      ),
    )
  }

  if (hw.endCaps > 0) {
    items.push(
      line(
        'Handrail end cap',
        hw.endCaps,
        'pcs',
        rates.endCapPerPcs,
        'endCapPerPcs',
        rates.referenceEndCap,
      ),
    )
  }

  if (bottomRailRft > 0) {
    items.push(railCost('Bottom rail', bottomRailRft, rates, 'bottom'))
    if (hw.bottomRailStock.totalBars > 0) {
      items.push({
        label: `Bottom rail stock (${hw.bottomRailStock.totalBars} bars)`,
        qty: hw.bottomRailStock.totalBars,
        unit: 'bars',
        rate: 0,
        amount: 0,
        note: `${hw.bottomRailStock.barSizes} · waste ${hw.bottomRailStock.wasteFt}ft reused`,
      })
    }
  }

  if (handrailRft > 0) {
    items.push(railCost('Handrail (SS)', handrailRft, rates, 'handrail'))
  }

  const anchors = countAnchors(
    hw.totalPillars,
    hw.totalStuds,
    bottomRailRft,
    draft.bottomFixing,
  )
  if (anchors > 0) {
    items.push(
      line(
        'Anchors',
        anchors,
        'pcs',
        rates.anchorPerPcs,
        'anchorPerPcs',
        rates.referenceAnchor,
      ),
    )
  }

  const holeCount = supportHoleCount(hw)
  if (draft.applyHoleCharges && holeCount > 0) {
    items.push(
      line(
        'Glass hole / drilling (pillar & stud)',
        holeCount,
        'holes',
        rates.holePerPcs,
        'holePerPcs',
        rates.referenceHolePerPcs,
      ),
    )
  }

  const subtotal = Math.round(items.reduce((s, i) => s + i.amount, 0) * 100) / 100
  const referenceSubtotal =
    Math.round(items.reduce((s, i) => s + (i.referenceAmount ?? 0), 0) * 100) / 100
  const setRates = computeSetRates(
    subtotal,
    glassAreaSft,
    bottomRailRft,
    handrailRft,
    perimeterRmt,
  )

  return {
    items,
    subtotal,
    referenceSubtotal,
    glassAreaSft,
    glassAreaSftActual,
    staircaseGlassFormula: staircase,
    staircaseGlassCostPerRft,
    staircaseRunRft: staircase ? staircaseRunRft : undefined,
    holeChargeQty: draft.applyHoleCharges ? holeCount : 0,
    bottomRailRft,
    handrailRft,
    perimeterRmt,
    totalAnchors: anchors,
    displayUnit: rates.quoteDisplayUnit,
    setRates,
    design,
  }
}

export function displayQtyForUnit(
  breakdown: CostBreakdown,
  unit: 'rmt' | 'rft' | 'sft',
): { label: string; qty: number } {
  switch (unit) {
    case 'sft':
      return { label: 'Glass area', qty: breakdown.glassAreaSft }
    case 'rmt':
      return { label: 'Running length', qty: breakdown.perimeterRmt }
    case 'rft':
    default:
      return {
        label: 'Perimeter run',
        qty: quoteRailRft(
          breakdown.perimeterRmt,
          breakdown.bottomRailRft,
          breakdown.handrailRft,
        ),
      }
  }
}
