import type { SegmentDim } from './types'

export const ZIGZAG_DEFAULT_DEPTH_MM = 1200
export const ZIGZAG_DEFAULT_STRAIGHT_MM = 4000
export const ZIGZAG_DEFAULT_PAIRS = 3

export function isZigzagDepthKey(key: string): boolean {
  return /^depth-\d+$/.test(key)
}

export function isZigzagStraightKey(key: string): boolean {
  return /^straight-\d+$/.test(key)
}

export function zigzagPairCount(dimensions: SegmentDim[]): number {
  return dimensions.filter((d) => isZigzagDepthKey(d.key)).length
}

export function buildZigzagDimensions(pairs: number): SegmentDim[] {
  const dims: SegmentDim[] = []
  for (let i = 1; i <= pairs; i++) {
    dims.push({
      key: `depth-${i}`,
      label: `Depth ${i}`,
      labelHi: `गहराई ${i}`,
      unit: 'mm',
      value: ZIGZAG_DEFAULT_DEPTH_MM,
    })
    dims.push({
      key: `straight-${i}`,
      label: `Straight ${i}`,
      labelHi: `सीधा ${i}`,
      unit: 'mm',
      value: ZIGZAG_DEFAULT_STRAIGHT_MM,
    })
  }
  return dims
}

export function appendZigzagPair(dimensions: SegmentDim[]): SegmentDim[] {
  const n = zigzagPairCount(dimensions) + 1
  return [
    ...dimensions,
    {
      key: `depth-${n}`,
      label: `Depth ${n}`,
      labelHi: `गहराई ${n}`,
      unit: 'mm',
      value: ZIGZAG_DEFAULT_DEPTH_MM,
    },
    {
      key: `straight-${n}`,
      label: `Straight ${n}`,
      labelHi: `सीधा ${n}`,
      unit: 'mm',
      value: ZIGZAG_DEFAULT_STRAIGHT_MM,
    },
  ]
}
