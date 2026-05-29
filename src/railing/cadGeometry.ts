import { buildSegmentPath } from './segmentLayout'
import type { CalculatedSegment, DesignCalculation, DesignDraft } from './types'

export interface LayoutSeg {
  calc: CalculatedSegment
  x0: number
  y0: number
  x1: number
  y1: number
}

export interface JointDirs {
  /** Unit vector along segment approaching joint */
  uxIn: number
  uyIn: number
  /** Unit vector along segment leaving joint */
  uxOut: number
  uyOut: number
}

export interface BBox {
  minX: number
  minY: number
  maxX: number
  maxY: number
  cx: number
  cy: number
  width: number
  height: number
}

const DEG = Math.PI / 180

export function unitDir(x0: number, y0: number, x1: number, y1: number): { ux: number; uy: number; len: number } {
  const len = Math.hypot(x1 - x0, y1 - y0) || 1
  return { ux: (x1 - x0) / len, uy: (y1 - y0) / len, len }
}

/** Intersection of two offset lines (miter join). */
export function offsetLineIntersect(
  ox: number,
  oy: number,
  ux: number,
  uy: number,
  px: number,
  py: number,
  ux2: number,
  uy2: number,
  halfW: number,
): { x: number; y: number } {
  const nx1 = -uy
  const ny1 = ux
  const nx2 = -uy2
  const ny2 = ux2
  const x1 = ox + nx1 * halfW
  const y1 = oy + ny1 * halfW
  const x2 = px + nx2 * halfW
  const y2 = py + ny2 * halfW
  const denom = ux * uy2 - uy * ux2
  if (Math.abs(denom) < 1e-9) {
    return { x: x1, y: y1 }
  }
  const dx = x2 - x1
  const dy = y2 - y1
  const t = (dx * uy2 - dy * ux2) / denom
  return { x: x1 + ux * t, y: y1 + uy * t }
}

/** Four corners of a glass panel with optional miter at start/end joints. */
export function miteredGlassQuad(
  ax: number,
  ay: number,
  bx: number,
  by: number,
  halfW: number,
  startJoint?: JointDirs,
  endJoint?: JointDirs,
): [number, number][] {
  const { ux, uy } = unitDir(ax, ay, bx, by)

  let oStart: { x: number; y: number }
  let iStart: { x: number; y: number }
  if (startJoint) {
    oStart = offsetLineIntersect(
      ax,
      ay,
      startJoint.uxIn,
      startJoint.uyIn,
      ax,
      ay,
      startJoint.uxOut,
      startJoint.uyOut,
      halfW,
    )
    iStart = offsetLineIntersect(
      ax,
      ay,
      startJoint.uxIn,
      startJoint.uyIn,
      ax,
      ay,
      startJoint.uxOut,
      startJoint.uyOut,
      -halfW,
    )
  } else {
    oStart = { x: ax - uy * halfW, y: ay + ux * halfW }
    iStart = { x: ax + uy * halfW, y: ay - ux * halfW }
  }

  let oEnd: { x: number; y: number }
  let iEnd: { x: number; y: number }
  if (endJoint) {
    oEnd = offsetLineIntersect(
      bx,
      by,
      endJoint.uxIn,
      endJoint.uyIn,
      bx,
      by,
      endJoint.uxOut,
      endJoint.uyOut,
      halfW,
    )
    iEnd = offsetLineIntersect(
      bx,
      by,
      endJoint.uxIn,
      endJoint.uyIn,
      bx,
      by,
      endJoint.uxOut,
      endJoint.uyOut,
      -halfW,
    )
  } else {
    oEnd = { x: bx - uy * halfW, y: by + ux * halfW }
    iEnd = { x: bx + uy * halfW, y: by - ux * halfW }
  }

  return [
    [oStart.x, oStart.y],
    [oEnd.x, oEnd.y],
    [iEnd.x, iEnd.y],
    [iStart.x, iStart.y],
  ]
}

export function jointAtCorner(prev: LayoutSeg, next: LayoutSeg): JointDirs {
  const p = unitDir(prev.x0, prev.y0, prev.x1, prev.y1)
  const n = unitDir(next.x0, next.y0, next.x1, next.y1)
  return { uxIn: p.ux, uyIn: p.uy, uxOut: n.ux, uyOut: n.uy }
}

const EPS = 0.5

/** Next segment starts where this segment ends (continuous path). */
export function segmentsConnectAtEndStart(a: LayoutSeg, b: LayoutSeg): boolean {
  return Math.hypot(a.x1 - b.x0, a.y1 - b.y0) < EPS
}

/** L / U corner — both segments share the same start vertex. */
export function segmentsShareCorner(a: LayoutSeg, b: LayoutSeg): boolean {
  return Math.hypot(a.x0 - b.x0, a.y0 - b.y0) < EPS && !segmentsConnectAtEndStart(a, b)
}

export function startJointFor(layouts: LayoutSeg[], segIndex: number): JointDirs | undefined {
  if (segIndex <= 0) return undefined
  const prev = layouts[segIndex - 1]
  const cur = layouts[segIndex]
  if (segmentsConnectAtEndStart(prev, cur) || segmentsShareCorner(prev, cur)) {
    return jointAtCorner(prev, cur)
  }
  return undefined
}

export function endJointFor(layouts: LayoutSeg[], segIndex: number): JointDirs | undefined {
  if (segIndex >= layouts.length - 1) return undefined
  const cur = layouts[segIndex]
  const next = layouts[segIndex + 1]
  if (segmentsConnectAtEndStart(cur, next)) return jointAtCorner(cur, next)
  return undefined
}

/** L-type: miter on first leg where the next leg shares the same corner vertex. */
export function cornerJointAtStart(
  layouts: LayoutSeg[],
  segIndex: number,
): JointDirs | undefined {
  if (segIndex >= layouts.length - 1) return undefined
  const cur = layouts[segIndex]
  const next = layouts[segIndex + 1]
  if (segmentsShareCorner(cur, next)) return jointAtCorner(cur, next)
  return undefined
}

export function resolveStartJoint(
  layouts: LayoutSeg[],
  segIndex: number,
): JointDirs | undefined {
  return startJointFor(layouts, segIndex)
}

export function resolveEndJoint(
  layouts: LayoutSeg[],
  segIndex: number,
): JointDirs | undefined {
  return (
    endJointFor(layouts, segIndex) ??
    cornerJointAtEnd(layouts, segIndex)
  )
}

/** Miter on last panel of first leg when next leg shares the same corner (legacy shared-start paths). */
export function cornerJointAtEnd(
  layouts: LayoutSeg[],
  segIndex: number,
): JointDirs | undefined {
  if (segIndex >= layouts.length - 1) return undefined
  const cur = layouts[segIndex]
  const next = layouts[segIndex + 1]
  if (segmentsShareCorner(cur, next)) return jointAtCorner(cur, next)
  return undefined
}

export function buildLayouts(
  draft: DesignDraft,
  calc: DesignCalculation,
  scale: number,
  originX: number,
  originY: number,
): LayoutSeg[] {
  const get = (key: string) => draft.dimensions.find((d) => d.key === key)?.value ?? 0
  const seg = (key: string) => calc.segments.find((s) => s.key === key)

  const layouts: LayoutSeg[] = []
  const add = (key: string, x0: number, y0: number, x1: number, y1: number) => {
    if (get(key) <= 0) return
    const s = seg(key)
    if (!s) return
    layouts.push({ calc: s, x0, y0, x1, y1 })
  }
  let ox = originX
  let oy = originY

  switch (draft.designType) {
    case 'straight': {
      const L = get('length') * scale
      add('length', ox, oy, ox + L, oy)
      break
    }
    case 'l-type': {
      const a = get('leg1') * scale
      const b = get('leg2') * scale
      // Corner at end of leg1 → leg2 (miter at bend, square ends on open sides)
      add('leg1', ox, oy, ox + a, oy)
      if (b > 0) {
        const cornerX = a > 0 ? ox + a : ox
        const cornerY = oy
        add('leg2', cornerX, cornerY, cornerX, cornerY - b)
      }
      break
    }
    case 'u-type': {
      const left = get('left') * scale
      const mid = get('straight') * scale
      const right = get('right') * scale
      add('left', ox, oy, ox, oy - left)
      add('straight', ox, oy - left, ox + mid, oy - left)
      add('right', ox + mid, oy - left, ox + mid, oy - left + right)
      break
    }
    case 'o-type': {
      const leftS = get('left') * scale
      const frontS = get('front') * scale
      const rightS = get('right') * scale
      const backS = get('back') * scale
      const x0 = ox
      const y0 = oy
      add('left', x0, y0, x0, y0 - leftS)
      const yTop = y0 - leftS
      add('front', x0, yTop, x0 + frontS, yTop)
      add('right', x0 + frontS, yTop, x0 + frontS, yTop + rightS)
      const yBot = yTop + rightS
      add('back', x0 + frontS, yBot, x0 + frontS - backS, yBot)
      break
    }
    case 'balcony': {
      const leftS = get('left') * scale
      const frontS = get('front') * scale
      const rightS = get('right') * scale
      const xStart = ox
      add('left', xStart, oy, xStart, oy - leftS)
      const yTop = oy - leftS
      add('front', xStart, yTop, xStart + frontS, yTop)
      add('right', xStart + frontS, oy - rightS, xStart + frontS, oy)
      break
    }
    case 'custom':
    case 'zigzag-type':
    case 'staircase': {
      for (const p of buildSegmentPath(
        draft.dimensions,
        scale,
        ox,
        oy,
        draft.pathStartHeading ?? 'east',
      )) {
        const s = seg(p.key)
        if (s && get(p.key) > 0) {
          layouts.push({ calc: s, x0: p.x0, y0: p.y0, x1: p.x1, y1: p.y1 })
        }
      }
      break
    }
    default: {
      let x = ox
      for (const s of calc.segments) {
        const L = s.runLengthMm * scale
        if (L <= 0) continue
        layouts.push({ calc: s, x0: x, y0: oy, x1: x + L, y1: oy })
        x += L + 24
      }
    }
  }
  return layouts
}

export function turnAngleDeg(j: JointDirs): number {
  const aIn = Math.atan2(j.uyIn, j.uxIn)
  const aOut = Math.atan2(j.uyOut, j.uxOut)
  let turn = aOut - aIn
  while (turn > Math.PI) turn -= 2 * Math.PI
  while (turn < -Math.PI) turn += 2 * Math.PI
  return Math.abs((turn * 180) / Math.PI)
}

/** Collect geometry bounds for auto-fit view. */
export function computeGeometryBounds(
  layouts: LayoutSeg[],
  scale: number,
  glassDepth: number,
  dimOffset = 28,
): BBox {
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity

  const add = (x: number, y: number) => {
    minX = Math.min(minX, x)
    minY = Math.min(minY, y)
    maxX = Math.max(maxX, x)
    maxY = Math.max(maxY, y)
  }

  for (let i = 0; i < layouts.length; i++) {
    const layout = layouts[i]
    const { calc: seg, x0, y0, x1, y1 } = layout
    const { ux, uy } = unitDir(x0, y0, x1, y1)
    const halfW = glassDepth / 2
    const startJoint = resolveStartJoint(layouts, i)
    const endJoint = resolveEndJoint(layouts, i)

    let t = seg.gapMm * scale
    const gapS = seg.gapMm * scale
    for (let gi = 0; gi < seg.glassCount; gi++) {
      const gw = seg.glassWidthMm * scale
      const ax = x0 + ux * t
      const ay = y0 + uy * t
      const bx = x0 + ux * (t + gw)
      const by = y0 + uy * (t + gw)
      const isFirst = gi === 0
      const isLast = gi === seg.glassCount - 1
      const quad = miteredGlassQuad(
        ax,
        ay,
        bx,
        by,
        halfW,
        isFirst ? startJoint : undefined,
        isLast ? endJoint : undefined,
      )
      quad.forEach(([x, y]) => add(x, y))
      t += gw + gapS
    }

    const px = -uy
    const py = ux
    add(x0 - px * dimOffset, y0 - py * dimOffset)
    add(x1 - px * dimOffset, y1 - py * dimOffset)
    add(x0 + px * dimOffset, y0 + py * dimOffset)
    add(x1 + px * dimOffset, y1 + py * dimOffset)
  }

  if (!Number.isFinite(minX)) {
    return { minX: 0, minY: 0, maxX: 100, maxY: 100, cx: 50, cy: 50, width: 100, height: 100 }
  }

  const width = maxX - minX
  const height = maxY - minY
  return {
    minX,
    minY,
    maxX,
    maxY,
    cx: (minX + maxX) / 2,
    cy: (minY + maxY) / 2,
    width: Math.max(width, 40),
    height: Math.max(height, 40),
  }
}

export function pickScale(draft: DesignDraft, calc: DesignCalculation): number {
  const totalLen = calc.perimeterRunMm || 1
  const maxLeg = Math.max(
    ...draft.dimensions.filter((d) => d.unit === 'mm').map((d) => d.value),
    1,
  )
  return Math.min(0.16, 800 / totalLen, 500 / maxLeg)
}

export function formatTurnLabel(deg: number): string {
  if (Math.abs(deg - 90) < 1) return '45° miter'
  return `${Math.round(deg / 2)}° miter`
}

export { DEG }
