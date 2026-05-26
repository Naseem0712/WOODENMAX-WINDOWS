import type { SegmentDim, SegmentBendMode } from './types'
import { buildZigzagDimensions } from './zigzag'

export function createCustomSegment(
  index: number,
  opts?: Partial<Pick<SegmentDim, 'value' | 'bendMode' | 'bendBeforeDeg' | 'label'>>,
): SegmentDim {
  const n = index
  return {
    key: `seg-${n}`,
    label: opts?.label ?? `Leg ${n}`,
    labelHi: `पैर ${n}`,
    unit: 'mm',
    value: opts?.value ?? 2000,
    bendMode: opts?.bendMode ?? (n === 1 ? 'none' : 'right-90'),
    bendBeforeDeg: opts?.bendBeforeDeg ?? 90,
  }
}

export function defaultCustomDimensions(): SegmentDim[] {
  return [createCustomSegment(1), createCustomSegment(2)]
}

/** Zigzag as custom legs with depth / straight bend modes */
export function zigzagTemplateAsCustom(): SegmentDim[] {
  const pairs = buildZigzagDimensions(3)
  return pairs.map((d, i) => {
    const isDepth = d.key.startsWith('depth-')
    const n = Math.floor(i / 2) + 1
    return {
      ...d,
      key: `seg-${i + 1}`,
      label: isDepth ? `Depth ${n}` : `Straight ${n}`,
      labelHi: isDepth ? `गहराई ${n}` : `सीधा ${n}`,
      bendMode: (i === 0 ? 'none' : isDepth ? 'depth-in' : 'right-90') as SegmentBendMode,
      bendBeforeDeg: 90,
    }
  })
}

export function appendCustomSegment(dimensions: SegmentDim[]): SegmentDim[] {
  const mmCount = dimensions.filter((d) => d.unit === 'mm').length
  return [...dimensions, createCustomSegment(mmCount + 1)]
}

export function migrateZigzagTypeToCustom(draft: {
  designType: string
  dimensions: SegmentDim[]
}): { designType: 'custom'; dimensions: SegmentDim[] } {
  if (draft.designType !== 'zigzag-type') {
    return draft as { designType: 'custom'; dimensions: SegmentDim[] }
  }
  const pairs = draft.dimensions.filter((d) => d.unit === 'mm')
  const dims: SegmentDim[] = pairs.map((d, i) => {
    const isDepth = d.key.startsWith('depth-')
    return {
      ...d,
      key: `seg-${i + 1}`,
      bendMode: (i === 0 ? 'none' : isDepth ? 'depth-in' : 'right-90') as SegmentBendMode,
      bendBeforeDeg: 90,
    }
  })
  return { designType: 'custom', dimensions: dims }
}
