import { calculateCosting } from './costing'
import type { CostingRates, QuotationLine } from './types'

export interface ProfitRow {
  index: number
  lineId: string
  designName: string
  quantity: number
  costPerSet: number
  costTotal: number
  quotePerSet: number
  quoteTotal: number
  profit: number
  marginPct: number | null
}

export interface ProfitSummary {
  rows: ProfitRow[]
  totalCost: number
  totalQuote: number
  totalProfit: number
  marginPct: number | null
}

function internalCost(line: QuotationLine, rates: CostingRates) {
  if (line.internalCosting) return line.internalCosting
  return calculateCosting(line.draftSnapshot, rates)
}

export function buildProfitSummary(
  lines: QuotationLine[],
  rates: CostingRates,
): ProfitSummary {
  const rows: ProfitRow[] = lines.map((line, i) => {
    const internal = internalCost(line, rates)
    const costPerSet = internal.subtotal
    const costTotal = Math.round(costPerSet * line.quantity * 100) / 100
    const quotePerSet =
      line.packageQuote?.amountPerSet ??
      Math.round((line.amount / line.quantity) * 100) / 100
    const quoteTotal = line.amount
    const profit = Math.round((quoteTotal - costTotal) * 100) / 100
    const marginPct =
      quoteTotal > 0 ? Math.round((profit / quoteTotal) * 10000) / 100 : null

    return {
      index: i + 1,
      lineId: line.id,
      designName: line.designName || line.designLabel,
      quantity: line.quantity,
      costPerSet,
      costTotal,
      quotePerSet,
      quoteTotal,
      profit,
      marginPct,
    }
  })

  const totalCost = Math.round(rows.reduce((s, r) => s + r.costTotal, 0) * 100) / 100
  const totalQuote = Math.round(rows.reduce((s, r) => s + r.quoteTotal, 0) * 100) / 100
  const totalProfit = Math.round((totalQuote - totalCost) * 100) / 100
  const marginPct =
    totalQuote > 0 ? Math.round((totalProfit / totalQuote) * 10000) / 100 : null

  return { rows, totalCost, totalQuote, totalProfit, marginPct }
}

export function downloadProfitCsv(
  summary: ProfitSummary,
  meta: { quoteNumber: string; clientName: string; projectName: string },
) {
  const rows: string[][] = [
    ['WoodenMax — Cost vs Quotation / Profit analysis'],
    ['Quote #', meta.quoteNumber],
    ['Client', meta.clientName],
    ['Project', meta.projectName],
    [],
    [
      '#',
      'Design',
      'Sets',
      'Cost/set (₹)',
      'Cost total (₹)',
      'Quote/set (₹)',
      'Quote total (₹)',
      'Profit/Loss (₹)',
      'Margin %',
    ],
  ]

  for (const r of summary.rows) {
    rows.push([
      String(r.index),
      r.designName,
      String(r.quantity),
      String(r.costPerSet),
      String(r.costTotal),
      String(r.quotePerSet),
      String(r.quoteTotal),
      String(r.profit),
      r.marginPct != null ? `${r.marginPct}%` : '—',
    ])
  }

  rows.push([])
  rows.push([
    '',
    'TOTAL',
    '',
    '',
    String(summary.totalCost),
    '',
    String(summary.totalQuote),
    String(summary.totalProfit),
    summary.marginPct != null ? `${summary.marginPct}%` : '—',
  ])

  const bom = '\uFEFF'
  const body = rows.map((r) => r.map(csvEscape).join(',')).join('\n')
  const blob = new Blob([bom + body], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `WoodenMax-Profit-${meta.quoteNumber || 'quote'}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

function csvEscape(val: string): string {
  if (val.includes(',') || val.includes('"')) {
    return `"${val.replace(/"/g, '""')}"`
  }
  return val
}
