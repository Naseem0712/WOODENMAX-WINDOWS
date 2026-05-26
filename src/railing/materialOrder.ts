import { calculateDesign } from './calculations'
import type { DesignDraft, QuotationLine } from './types'

export interface OrderLine {
  category: 'glass' | 'rail' | 'hardware'
  item: string
  specification: string
  totalQty: number
  unit: string
  sources: string[]
}

function mergeOrder(
  map: Map<string, OrderLine>,
  row: {
    category: OrderLine['category']
    item: string
    specification: string
    qty: number
    unit: string
  },
  source: string,
) {
  const key = `${row.category}|${row.item}|${row.specification}|${row.unit}`
  const prev = map.get(key)
  if (prev) {
    prev.totalQty += row.qty
    if (!prev.sources.includes(source)) prev.sources.push(source)
  } else {
    map.set(key, {
      category: row.category,
      item: row.item,
      specification: row.specification,
      totalQty: row.qty,
      unit: row.unit,
      sources: [source],
    })
  }
}

export function aggregateMaterialOrder(
  lines: QuotationLine[],
  currentDraft: DesignDraft | null,
): OrderLine[] {
  const map = new Map<string, OrderLine>()

  const addDesign = (draft: DesignDraft, label: string, qtyMult: number) => {
    const calc = calculateDesign(draft)
    for (const b of calc.bom) {
      mergeOrder(
        map,
        {
          category: b.category,
          item: b.item,
          specification: b.specification,
          qty: b.qty * qtyMult,
          unit: b.unit,
        },
        label,
      )
    }
  }

  for (const line of lines) {
    const name =
      line.designName.trim() ||
      line.designLabel ||
      line.designType
    addDesign(line.draftSnapshot, `${name} ×${line.quantity}`, line.quantity)
  }

  if (currentDraft) {
    const hasSize = currentDraft.dimensions.some(
      (d) => d.unit === 'mm' && d.value > 0,
    )
    if (hasSize) {
      const name =
        currentDraft.designName.trim() ||
        currentDraft.designType ||
        'Current design'
      addDesign(currentDraft, `${name} (draft)`, currentDraft.quantity)
    }
  }

  return Array.from(map.values()).sort((a, b) => {
    const order = { glass: 0, rail: 1, hardware: 2 }
    return order[a.category] - order[b.category]
  })
}
