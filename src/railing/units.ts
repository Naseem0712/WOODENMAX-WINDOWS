export const MM_PER_FT = 304.8
export const MM_PER_M = 1000
export const SFT_PER_SQM = 10.7639
export const FT_PER_M = 3.280839895

export const RAIL_STOCK_FT = [16, 13, 12] as const
export type RailStockFt = (typeof RAIL_STOCK_FT)[number]

export function mmToFt(mm: number): number {
  return mm / MM_PER_FT
}

export function mmToRmt(mm: number): number {
  return mm / MM_PER_M
}

export function sqmToSft(sqm: number): number {
  return sqm * SFT_PER_SQM
}

export function rftToRmt(rft: number): number {
  return rft / FT_PER_M
}

export function rmtToRft(rmt: number): number {
  return rmt * FT_PER_M
}

export function sftToSqm(sft: number): number {
  return sft / SFT_PER_SQM
}
