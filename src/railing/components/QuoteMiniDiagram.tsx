import type { ReactNode } from 'react'
import {
  buildLayouts,
  computeGeometryBounds,
  miteredGlassQuad,
  resolveEndJoint,
  resolveStartJoint,
  unitDir,
  type LayoutSeg,
} from '../cadGeometry'
import type { DesignCalculation, DesignDraft } from '../types'

const W = 280
const H = 200
const PAD = 28
const DIM = '#64748b'
const GLASS_DEPTH = 18

function dimAnnotation(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  label: string,
  offset: number,
): ReactNode {
  const mx = (x1 + x2) / 2
  const my = (y1 + y2) / 2
  const horizontal = Math.abs(x2 - x1) >= Math.abs(y2 - y1)
  const ox = horizontal ? 0 : -offset
  const oy = horizontal ? offset : 0
  const tx = mx + ox
  const ty = my + oy + (horizontal ? 11 : 0)

  return (
    <g key={`dim-${x1}-${y1}-${x2}-${y2}-${label}`}>
      <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="#94a3b8" strokeWidth={1.2} />
      <line
        x1={x1 + ox}
        y1={y1 + oy}
        x2={x2 + ox}
        y2={y2 + oy}
        stroke={DIM}
        strokeWidth={0.8}
        strokeDasharray="4 2"
      />
      <text
        x={tx}
        y={ty}
        textAnchor="middle"
        dominantBaseline={horizontal ? 'auto' : 'middle'}
        fontSize={10}
        fontWeight={600}
        fill={DIM}
        fontFamily="'JetBrains Mono', Consolas, monospace"
        transform={!horizontal ? `rotate(-90, ${tx}, ${ty})` : undefined}
      >
        {label}
      </text>
    </g>
  )
}

function drawMiteredRun(
  layout: LayoutSeg,
  scale: number,
  segIndex: number,
  layouts: LayoutSeg[],
): ReactNode[] {
  const { calc: seg, x0, y0, x1, y1 } = layout
  const { ux, uy } = unitDir(x0, y0, x1, y1)
  const halfW = GLASS_DEPTH / 2
  const els: ReactNode[] = []
  const startJoint = resolveStartJoint(layouts, segIndex)
  const endJoint = resolveEndJoint(layouts, segIndex)

  if (!seg.glasses?.length || seg.glassCount < 1) {
    return els
  }

  let t = seg.gapMm * scale
  const gapS = seg.gapMm * scale
  const horizontal = Math.abs(x1 - x0) >= Math.abs(y1 - y0)
  const dimOff = horizontal ? 20 : 18

  for (let i = 0; i < seg.glassCount; i++) {
    const gw = seg.glassWidthMm * scale
    const ax = x0 + ux * t
    const ay = y0 + uy * t
    const bx = x0 + ux * (t + gw)
    const by = y0 + uy * (t + gw)
    const quad = miteredGlassQuad(
      ax,
      ay,
      bx,
      by,
      halfW,
      i === 0 ? startJoint : undefined,
      i === seg.glassCount - 1 ? endJoint : undefined,
    )
    const pts = quad.map((p) => p.join(',')).join(' ')
    els.push(
      <polygon
        key={`glass-${segIndex}-${i}`}
        points={pts}
        fill="#dbeafe"
        stroke="#2563eb"
        strokeWidth={1.2}
      />,
    )
    t += gw + gapS
  }

  els.push(dimAnnotation(x0, y0, x1, y1, `${seg.runLengthMm} mm`, dimOff))
  return els
}

export function QuoteMiniDiagram({
  draft,
  calc,
  printImageUrl,
}: {
  draft: DesignDraft
  calc: DesignCalculation
  /** When set, replaces the CAD schematic on quotation print/PDF. */
  printImageUrl?: string
}) {
  if (printImageUrl?.trim()) {
    return (
      <img
        src={printImageUrl}
        alt={draft.designName?.trim() || 'Railing design'}
        className="quote-mini-svg quote-mini-img"
      />
    )
  }

  const totalLen = calc.perimeterRunMm || 1
  const maxLeg = Math.max(
    ...draft.dimensions.filter((d) => d.unit === 'mm').map((d) => d.value),
    1,
  )
  const scale = Math.min((W - PAD * 2) / totalLen, (H - PAD * 2) / maxLeg, 0.12)
  const layouts = buildLayouts(draft, calc, scale, PAD, H - PAD)
  if (!layouts.length) {
    return (
      <svg viewBox={`0 0 ${W} ${H}`} className="quote-mini-svg">
        <rect width={W} height={H} fill="#fafafa" />
        <text x={W / 2} y={H / 2} textAnchor="middle" fill="#94a3b8" fontSize={12}>
          Enter sizes to preview
        </text>
      </svg>
    )
  }
  const bounds = computeGeometryBounds(layouts, scale, GLASS_DEPTH, 30)
  const margin = 18
  const vbX = bounds.minX - margin
  const vbY = bounds.minY - margin
  const vbW = Math.max(bounds.width + margin * 2, 40)
  const vbH = Math.max(bounds.height + margin * 2, 40)

  const heightLabel =
    draft.heightMode === 'uniform'
      ? `${draft.uniformHeight} mm`
      : draft.segmentHeights.map((h) => `${h.label}: ${h.value} mm`).join(', ')

  return (
    <svg viewBox={`${vbX} ${vbY} ${vbW} ${vbH}`} className="quote-mini-svg">
      <rect x={vbX} y={vbY} width={vbW} height={vbH} fill="#fafafa" />
      {layouts.flatMap((l, i) => drawMiteredRun(l, scale, i, layouts))}
      <text x={vbX + 6} y={vbY + vbH - 6} fontSize={8} fill="#64748b">
        H: {heightLabel}
      </text>
    </svg>
  )
}
