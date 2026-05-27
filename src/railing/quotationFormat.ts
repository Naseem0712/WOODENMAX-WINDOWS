import { hardwareProfilesSummary } from './railProfiles'
import { quoteRailRft } from './railLength'
import { formatCurrency, glassDisplayForQuote } from './utils'
import type { QuotationLine, RateDisplayUnit } from './types'

export function quoteUnitForLine(line: QuotationLine): RateDisplayUnit {
  return line.packageQuote?.unit ?? 'rft'
}

export function quoteBasisForLine(line: QuotationLine): { label: string; qty: number; unit: string } {
  const u = quoteUnitForLine(line)
  const c = line.costing
  const pq = line.packageQuote
  switch (u) {
    case 'sft': {
      let qty = pq?.basisQty ?? c.glassAreaSft
      if (pq?.basisQty != null && Math.abs(pq.basisQty - c.glassAreaSft) > 0.05 && c.glassAreaSft > 0) {
        qty = c.glassAreaSft
      }
      return {
        label: 'Glass area',
        qty,
        unit: 'SFT',
      }
    }
    case 'rmt': {
      let qty = pq?.basisQty ?? c.perimeterRmt
      if (pq?.basisQty != null && Math.abs(pq.basisQty - c.perimeterRmt) > 0.05 && c.perimeterRmt > 0) {
        qty = c.perimeterRmt
      }
      return {
        label: 'Running length',
        qty,
        unit: 'RMT',
      }
    }
    case 'rft':
    default: {
      const runRft = quoteRailRft(c.perimeterRmt, c.bottomRailRft, c.handrailRft)
      const doubled =
        Math.round((c.bottomRailRft + c.handrailRft) * 100) / 100
      let qty = pq?.basisQty ?? runRft
      if (
        pq?.basisQty != null &&
        c.bottomRailRft > 0 &&
        c.handrailRft > 0 &&
        Math.abs(pq.basisQty - doubled) < 0.05
      ) {
        qty = runRft
      }
      return {
        label: 'Perimeter run',
        qty,
        unit: 'RFT',
      }
    }
  }
}

export function primaryAreaLabel(
  line: QuotationLine,
  unit?: RateDisplayUnit,
): { label: string; value: string } {
  const b = quoteBasisForLine(line)
  if (unit && quoteUnitForLine(line) !== unit) {
    return primaryAreaLabel(line, quoteUnitForLine(line))
  }
  return { label: b.label, value: `${b.qty} ${b.unit}` }
}

export function formatQuoteDate(iso: string): string {
  try {
    return new Date(iso + 'T12:00:00').toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    })
  } catch {
    return iso
  }
}

/** Package rate for one line (₹ per unit). */
export function quoteRateForLine(line: QuotationLine): number {
  const pq = line.packageQuote
  if (pq && pq.rate > 0) return pq.rate
  const basis = quoteBasisForLine(line)
  if (basis.qty > 0 && line.quantity > 0 && line.amount > 0) {
    return Math.round((line.amount / (basis.qty * line.quantity)) * 100) / 100
  }
  return 0
}

function customChargesPerSet(line: QuotationLine): number {
  return (line.customCharges ?? []).reduce(
    (s, c) => s + (Number(c.amount) || 0),
    0,
  )
}

/** Amount = basis qty × rate × sets + custom charges (always matches summary columns). */
export function quoteLineAmount(line: QuotationLine): number {
  const basis = quoteBasisForLine(line)
  const rate = quoteRateForLine(line)
  const extras = customChargesPerSet(line)
  if (basis.qty <= 0 || rate <= 0) {
    const base = line.amount
    return extras > 0
      ? Math.round((base + extras * line.quantity) * 100) / 100
      : base
  }
  const perSet = Math.round(basis.qty * rate * 100) / 100 + extras
  return Math.round(perSet * line.quantity * 100) / 100
}

/** Fix stored packageQuote.basisQty & amount (e.g. old double RFT). */
export function recalculateQuoteLine(line: QuotationLine): QuotationLine {
  const basis = quoteBasisForLine(line)
  const unit = quoteUnitForLine(line)
  const rate = quoteRateForLine(line)
  const extras = customChargesPerSet(line)
  const amountPerSet = Math.round(basis.qty * rate * 100) / 100 + extras
  const amount = Math.round(amountPerSet * line.quantity * 100) / 100

  return {
    ...line,
    amount,
    packageQuote: line.packageQuote
      ? {
          ...line.packageQuote,
          unit,
          rate,
          materialRate: line.packageQuote.materialRate ?? rate,
          installationRate: line.packageQuote.installationRate ?? 0,
          basisQty: basis.qty,
          basisLabel: basis.label,
          amountPerSet,
        }
      : line.packageQuote,
    costing: line.costing
      ? {
          ...line.costing,
          subtotal: amountPerSet,
        }
      : line.costing,
  }
}

export function quoteTotals(lines: QuotationLine[]) {
  const subtotal = lines.reduce((s, l) => s + quoteLineAmount(l), 0)
  const gst = Math.round(subtotal * 0.18 * 100) / 100
  const grand = Math.round((subtotal + gst) * 100) / 100
  return { subtotal, gst, grand }
}

/** Consolidated item spec — no duplicate hardware / profile lines. */
export function buildItemSpecRows(line: QuotationLine): { label: string; value: string }[] {
  const hw = line.calculation.hardware
  const f = line.finish
  const draft = line.draftSnapshot
  const profiles = hardwareProfilesSummary(draft)
  const rows: { label: string; value: string }[] = []

  if (draft.bottomFixing === 'pillars') {
    rows.push({ label: 'Bottom fixing', value: `Pillars — ${hw.totalPillars} pcs` })
  } else {
    rows.push({ label: 'Bottom fixing', value: 'Continuous bottom profile' })
    if (hw.bottomRailRft > 0 && profiles.bottomRail) {
      rows.push({
        label: 'Bottom rail',
        value: `${hw.bottomRailRft} RFT · ${profiles.bottomRail}`,
      })
    }
  }

  if (draft.includeHandrail && hw.handrailRft > 0 && profiles.handrail) {
    const color = f.hardwareColor?.trim()
    rows.push({
      label: 'Handrail',
      value: `${hw.handrailRft} RFT · ${profiles.handrail}${color ? ` · ${color}` : ''}`,
    })
  }

  rows.push({ label: 'Glass', value: glassDisplayForQuote(line) })

  rows.push(...hardwareSpecRows(line))

  const basis = quoteBasisForLine(line)
  rows.push({ label: basis.label, value: `${basis.qty} ${basis.unit}` })

  for (const c of line.customCharges ?? []) {
    if (c.label?.trim() && c.amount > 0) {
      rows.push({ label: c.label.trim(), value: formatCurrency(c.amount) })
    }
  }

  return rows
}

export function hardwareSpecRows(line: QuotationLine): { label: string; value: string }[] {
  const hw = line.calculation.hardware
  const f = line.finish
  const rows: { label: string; value: string }[] = []

  if (hw.connector90 > 0) {
    rows.push({ label: '90° L-corner connector', value: `${hw.connector90} pcs` })
  }
  if (hw.connector180 > 0) {
    rows.push({ label: '180° rail splice connector', value: `${hw.connector180} pcs` })
  }
  if (hw.wallConnectors > 0) {
    rows.push({ label: 'Wall connector', value: `${hw.wallConnectors} pcs` })
  }
  if (hw.totalPillars > 0) {
    rows.push({ label: 'Floor pillars', value: `${hw.totalPillars} pcs` })
  }
  if (hw.totalAnchors > 0) {
    rows.push({
      label: 'Anchors',
      value: `${hw.totalAnchors} pcs · ${f.anchorSize || '12×100 mm'}`,
    })
  }

  return rows
}
