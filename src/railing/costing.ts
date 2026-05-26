import { calculateDesign, countAnchors } from './calculations'
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

/** Total subtotal divided by glass SFT, rail RFT, and run RMT (per 1 set). */
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
  const glassAreaSft = Math.round(sqmToSft(design.totalGlassAreaSqm) * 100) / 100
  const bottomRailRft = Math.round(mmToFt(hw.bottomRailMm) * 100) / 100
  const handrailRft = Math.round(mmToFt(hw.handrailMm) * 100) / 100
  const perimeterRmt = Math.round(mmToRmt(design.perimeterRunMm) * 100) / 100

  const items: CostLineItem[] = []

  if (glassAreaSft > 0) {
    items.push(
      line(
        'Glass',
        glassAreaSft,
        'SFT',
        rates.glassPerSft,
        'glassPerSft',
        rates.referenceGlassPerSft,
      ),
    )
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

  const anchors = countAnchors(hw.totalPillars, bottomRailRft, draft.bottomFixing)
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
