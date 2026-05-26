import type { SegmentBendMode, SegmentDim } from './types'

export interface PathSegment {
  key: string
  x0: number
  y0: number
  x1: number
  y1: number
}

const DEG = Math.PI / 180

export function bendModeLabel(mode: SegmentBendMode | undefined): string {
  switch (mode) {
    case 'none':
      return 'Start (no bend)'
    case 'left-90':
      return '90° left'
    case 'right-90':
      return '90° right'
    case 'depth-in':
      return 'Depth in (zigzag)'
    case 'depth-out':
      return 'Depth out'
    case 'front-90':
      return '90° front'
    case 'back-90':
      return '90° back'
    case 'left-side-90':
      return '90° left side'
    case 'right-side-90':
      return '90° right side'
    case 'custom':
      return 'Custom angle'
    default:
      return '90° corner'
  }
}

function bendRadians(seg: SegmentDim, depthFlip: number): number {
  const mode = seg.bendMode ?? 'right-90'
  switch (mode) {
    case 'none':
      return 0
    case 'left-90':
      return -90 * DEG
    case 'right-90':
      return 90 * DEG
    case 'depth-in':
      return depthFlip * 90 * DEG
    case 'depth-out':
      return -depthFlip * 90 * DEG
    case 'front-90':
      return -90 * DEG
    case 'back-90':
      return 90 * DEG
    case 'left-side-90':
      return 180 * DEG
    case 'right-side-90':
      return 0
    case 'custom':
      return (seg.bendBeforeDeg ?? 90) * DEG
    default:
      return 90 * DEG
  }
}

export function isRightAngleBend(seg: SegmentDim): boolean {
  const mode = seg.bendMode ?? 'right-90'
  if (mode === 'none') return false
  if (mode === 'custom') {
    const a = Math.abs(seg.bendBeforeDeg ?? 90) % 360
    return Math.abs(a - 90) < 1 || Math.abs(a - 270) < 1
  }
  return true
}

/** Plan path for custom / path-based designs. y grows downward in SVG. */
export function buildSegmentPath(
  dimensions: SegmentDim[],
  scale: number,
  originX: number,
  originY: number,
): PathSegment[] {
  const segs = dimensions.filter((d) => d.unit === 'mm' && d.value > 0)
  const paths: PathSegment[] = []
  let x = originX
  let y = originY
  let theta = 0
  let depthFlip = 1

  for (let i = 0; i < segs.length; i++) {
    const seg = segs[i]
    if (i > 0) {
      theta += bendRadians(seg, depthFlip)
      if (seg.bendMode === 'depth-in' || seg.bendMode === 'depth-out') {
        depthFlip *= -1
      }
    }
    const len = seg.value * scale
    const x1 = x + Math.cos(theta) * len
    const y1 = y + Math.sin(theta) * len
    paths.push({ key: seg.key, x0: x, y0: y, x1, y1 })
    x = x1
    y = y1
  }

  return paths
}

export function countPathBends(dimensions: SegmentDim[]): {
  connector90: number
  wallConnectors: number
} {
  const segs = dimensions.filter((d) => d.unit === 'mm' && d.value > 0)
  if (segs.length === 0) return { connector90: 0, wallConnectors: 0 }
  let connector90 = 0
  for (let i = 1; i < segs.length; i++) {
    if (isRightAngleBend(segs[i])) connector90++
  }
  return { connector90, wallConnectors: 2 }
}
