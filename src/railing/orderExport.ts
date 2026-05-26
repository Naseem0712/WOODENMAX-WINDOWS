import { COMPANY } from './constants'
import {
  collectGlassPanelOrders,
  collectHardwareOrder,
  glassOrderTotals,
} from './materialOrderDetails'
import type { DesignDraft, QuotationLine, QuotationMeta } from './types'

function csvEscape(val: string | number): string {
  const s = String(val ?? '')
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return `"${s.replace(/"/g, '""')}"`
  }
  return s
}

function downloadCsv(filename: string, rows: string[][]) {
  const bom = '\uFEFF'
  const body = rows.map((r) => r.map(csvEscape).join(',')).join('\n')
  const blob = new Blob([bom + body], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

function clientHeaderRows(meta: QuotationMeta): string[][] {
  const date = meta.date || new Date().toISOString().slice(0, 10)
  return [
    ['WOODENMAX — MATERIAL ORDER'],
    ['Company', COMPANY.name],
    ['Quote #', meta.quoteNumber],
    ['Date', date],
    ['Client', meta.clientName],
    ['Client phone', meta.clientPhone],
    ['Client address', meta.clientAddress],
    ['Project', meta.projectName],
    [],
  ]
}

export function downloadHardwareOrderCsv(
  meta: QuotationMeta,
  lines: QuotationLine[],
  currentDraft: DesignDraft | null,
) {
  const rows = [...clientHeaderRows(meta)]
  rows.push(['=== HARDWARE & RAILS (combined purchase) ==='])
  rows.push(['Category', 'Item', 'Specification', 'Total qty', 'Unit', 'Used in designs'])

  for (const o of collectHardwareOrder(lines, currentDraft)) {
    rows.push([
      o.category,
      o.item,
      o.specification,
      String(o.totalQty),
      o.unit,
      o.sources.join('; '),
    ])
  }

  const date = meta.date || new Date().toISOString().slice(0, 10)
  const fname = `WoodenMax-Hardware-Order-${meta.quoteNumber || 'export'}-${date}.csv`
  downloadCsv(fname, rows)
}

export function downloadGlassOrderCsv(
  meta: QuotationMeta,
  lines: QuotationLine[],
  currentDraft: DesignDraft | null,
) {
  const glassRows = collectGlassPanelOrders(lines, currentDraft)
  const totals = glassOrderTotals(glassRows)
  const rows = [...clientHeaderRows(meta)]

  rows.push(['=== GLASS ORDER (each panel) ==='])
  rows.push([
    'Design',
    'Side / segment',
    'Panel #',
    'Width mm',
    'Height mm',
    'Glass type',
    'Glass colour',
    'Sets qty',
    'Total panels to order',
    'Area SFT (per panel)',
    'Total area SFT',
  ])

  for (const g of glassRows) {
    rows.push([
      g.designName,
      g.segmentLabel,
      String(g.panelIndex),
      String(g.widthMm),
      String(g.heightMm),
      g.glassType,
      g.glassColor,
      String(g.setsQty),
      String(g.totalPanels),
      String(g.areaSftPerPanel),
      String(g.totalAreaSft),
    ])
  }

  rows.push([])
  rows.push(['TOTAL PANELS', String(totals.totalPanels)])
  rows.push(['TOTAL GLASS AREA SFT', String(totals.totalAreaSft)])

  const date = meta.date || new Date().toISOString().slice(0, 10)
  const fname = `WoodenMax-Glass-Order-${meta.quoteNumber || 'export'}-${date}.csv`
  downloadCsv(fname, rows)
}
