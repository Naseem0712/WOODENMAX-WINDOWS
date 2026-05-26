import { RAIL_STOCK_FT, type RailStockFt } from './units'

export interface RailBarUsed {
  lengthFt: RailStockFt
  wasteFt: number
}

export interface RailStockPlan {
  bars: RailBarUsed[]
  totalBars: number
  totalStockFt: number
  requiredFt: number
  wasteFt: number
  joints180: number
}

/**
 * Plan 12 / 13 / 16 ft bars; reuse offcut (waste) before opening a new bar.
 */
export function planRailStock(requiredFt: number): RailStockPlan {
  if (requiredFt <= 0) {
    return {
      bars: [],
      totalBars: 0,
      totalStockFt: 0,
      requiredFt: 0,
      wasteFt: 0,
      joints180: 0,
    }
  }

  const sizes = [...RAIL_STOCK_FT].sort((a, b) => b - a) as RailStockFt[]
  const bars: RailBarUsed[] = []
  let offcutBank = 0
  let need = requiredFt

  while (need > 0.02) {
    if (offcutBank >= need - 0.02) {
      offcutBank = Math.round((offcutBank - need) * 1000) / 1000
      need = 0
      break
    }

    if (offcutBank > 0) {
      need -= offcutBank
      offcutBank = 0
    }

    const exact = sizes.find((s) => s >= need - 0.02)
    if (exact) {
      const waste = Math.round((exact - need) * 1000) / 1000
      bars.push({ lengthFt: exact, wasteFt: waste })
      offcutBank = waste
      need = 0
    } else {
      const largest = sizes[0]
      bars.push({ lengthFt: largest, wasteFt: 0 })
      need -= largest
    }
  }

  const totalStockFt = bars.reduce((s, b) => s + b.lengthFt, 0)
  const wasteFt =
    Math.round((totalStockFt - requiredFt) * 1000) / 1000

  return {
    bars,
    totalBars: bars.length,
    totalStockFt,
    requiredFt: Math.round(requiredFt * 1000) / 1000,
    wasteFt: Math.max(0, wasteFt),
    joints180: Math.max(0, bars.length - 1),
  }
}
