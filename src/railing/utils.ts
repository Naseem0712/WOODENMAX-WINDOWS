import { calculateDesign } from './calculations'
import { hardwareProfilesSummary } from './railProfiles'
import { calculateCosting } from './costing'
import { packageLineTotal, resolvePackageQuote } from './packagePricing'
import type { CostLineItem, PackageQuote } from './types'
import { DESIGN_TYPES, GLASS_OPTIONS } from './constants'
import type { CostingRates, DesignDraft, DesignType, QuotationLine } from './types'

export function designLabel(type: DesignType): string {
  return DESIGN_TYPES.find((d) => d.id === type)?.label ?? type
}

export function displayDesignTitle(draft: DesignDraft): string {
  const custom = draft.designName?.trim()
  if (custom) return custom
  return designLabel(draft.designType)
}

export function formatCurrency(n: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 2,
  }).format(n)
}

export function formatMm(n: number): string {
  return `${n.toLocaleString('en-IN', { maximumFractionDigits: 1 })} mm`
}

export function formatDimensions(draft: DesignDraft): string {
  return draft.dimensions
    .filter((d) => d.unit === 'mm' && d.value > 0)
    .map((d) => `${d.label}: ${d.value} mm`)
    .join(' · ')
}

export function formatHeights(draft: DesignDraft): string {
  if (draft.heightMode === 'uniform') {
    return `All sides: ${draft.uniformHeight} mm`
  }
  return draft.segmentHeights.map((h) => `${h.label}: ${h.value} mm`).join(' · ')
}

export function glassLabel(draft: DesignDraft): string {
  const g = GLASS_OPTIONS.find((x) => x.id === draft.glassId)
  if (!g) return '—'
  if (draft.glassId === 'custom' && draft.customGlassComposition.trim()) {
    return draft.customGlassComposition.trim()
  }
  return `${g.name} (${g.composition})`
}

export function hardwareSummary(calc: ReturnType<typeof calculateDesign>): string {
  const h = calc.hardware
  const parts: string[] = []
  if (h.bottomRailRft > 0) parts.push(`Bottom rail ${h.bottomRailRft} RFT`)
  if (h.handrailRft > 0) parts.push(`Handrail ${h.handrailRft} RFT`)
  if (h.totalPillars > 0) parts.push(`Pillars × ${h.totalPillars}`)
  if (h.connector90 > 0) parts.push(`90° × ${h.connector90}`)
  if (h.connector180 > 0) parts.push(`180° × ${h.connector180}`)
  if (h.wallConnectors > 0) parts.push(`Wall × ${h.wallConnectors}`)
  if (h.totalAnchors > 0) parts.push(`Anchors × ${h.totalAnchors}`)
  return parts.join(' · ') || '—'
}

/** Handrail / bottom-rail types actually used on this design. */
export function hardwareProfilesLabel(draft: DesignDraft): string {
  const p = hardwareProfilesSummary(draft)
  const parts: string[] = []
  if (p.bottomRail) parts.push(`Bottom: ${p.bottomRail}`)
  if (p.handrail) parts.push(`Handrail: ${p.handrail}`)
  return parts.join(' · ') || '—'
}

export function bomToText(calc: ReturnType<typeof calculateDesign>): string {
  return calc.bom
    .map((b) => `${b.item}: ${b.specification} — ${b.qty} ${b.unit}`)
    .join('\n')
}

export function costingToText(
  costing: ReturnType<typeof calculateCosting>,
  qty: number,
): string {
  return costing.items
    .filter((i) => i.amount > 0)
    .map(
      (i) =>
        `${i.label}: ${i.qty} ${i.unit} @ ₹${i.rate} = ₹${i.amount}${qty > 1 ? ` × ${qty} sets` : ''}`,
    )
    .join('\n')
}

export function buildSummary(draft: DesignDraft): string {
  const calc = calculateDesign(draft)
  return [
    displayDesignTitle(draft),
    formatDimensions(draft),
    `${calc.totalGlassAreaSft} SFT glass`,
    formatHeights(draft),
  ].join(' | ')
}

function packageCostingItems(pq: PackageQuote): CostLineItem[] {
  return [
    {
      label: `Railing package (per ${pq.unit.toUpperCase()})`,
      qty: pq.basisQty,
      unit: pq.unit.toUpperCase(),
      rate: pq.rate,
      amount: pq.amountPerSet,
    },
  ]
}

export function draftToLine(
  draft: DesignDraft,
  rates: CostingRates,
  existing?: Pick<QuotationLine, 'id' | 'createdAt'>,
): QuotationLine {
  const calculation = calculateDesign(draft)
  const detailedCosting = calculateCosting(draft, rates)
  const packageQuote = resolvePackageQuote(draft, detailedCosting)
  const amountPerSet = packageQuote.amountPerSet
  const amount = packageLineTotal(draft, detailedCosting)
  const snapshot = structuredClone(draft)
  const title = displayDesignTitle(draft)

  const costing = {
    ...detailedCosting,
    subtotal: amountPerSet,
    items: packageCostingItems(packageQuote),
    displayUnit: packageQuote.unit,
  }

  return {
    id: existing?.id ?? crypto.randomUUID(),
    designName: draft.designName.trim(),
    designType: draft.designType,
    designLabel: title,
    summary: buildSummary(draft),
    glassLabel: glassLabel(draft),
    hardwareLabel: hardwareProfilesLabel(snapshot),
    dimensionsText: formatDimensions(draft),
    heightText: formatHeights(draft),
    draftSnapshot: snapshot,
    finish: { ...snapshot.finish },
    calculation,
    costing,
    bomText: bomToText(calculation),
    quantity: draft.quantity,
    amount,
    notes: draft.notes,
    customCharges: [...(draft.customCharges ?? [])],
    createdAt: existing?.createdAt ?? new Date().toISOString(),
    packageQuote,
    internalCosting: detailedCosting,
  }
}
