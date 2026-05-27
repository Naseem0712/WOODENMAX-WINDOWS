import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { calculateDesign } from '../calculations'
import {
  buildLayouts,
  computeGeometryBounds,
  miteredGlassQuad,
  offsetLineIntersect,
  pickScale,
  resolveEndJoint,
  resolveStartJoint,
  turnAngleDeg,
  unitDir,
  type JointDirs,
  type LayoutSeg,
} from '../cadGeometry'
import type { DesignDraft } from '../types'

const GLASS_FILL = 'rgba(56, 189, 248, 0.32)'
const GLASS_STROKE = '#38bdf8'
const RAIL = '#f59e0b'
const HANDRAIL = '#a78bfa'
const PILLAR = '#f472b6'
const DIM = '#cbd5e1'
const CORNER = '#34d399'
const GLASS_DEPTH = 52
const DIM_FONT = 13
const GLASS_LABEL_FONT = 11
const MIN_ZOOM = 0.35
const MAX_ZOOM = 6

function dimLine(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  label: string,
  offset = 22,
) {
  const mx = (x1 + x2) / 2
  const my = (y1 + y2) / 2
  const horizontal = Math.abs(x2 - x1) >= Math.abs(y2 - y1)
  const px = horizontal ? 0 : -offset
  const py = horizontal ? offset : 0
  const tx = mx + px
  const ty = my + py + (horizontal ? 14 : 0)

  return (
    <g key={`dim-${x1}-${y1}-${label}`}>
      <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="#64748b" strokeWidth={1.2} />
      <line
        x1={x1 + px}
        y1={y1 + py}
        x2={x2 + px}
        y2={y2 + py}
        stroke={DIM}
        strokeWidth={0.9}
        strokeDasharray="4 3"
      />
      <text
        x={tx}
        y={ty}
        textAnchor="middle"
        dominantBaseline={horizontal ? 'auto' : 'middle'}
        fill={DIM}
        fontSize={DIM_FONT}
        fontWeight={600}
        fontFamily="JetBrains Mono, Consolas, monospace"
        transform={!horizontal ? `rotate(-90, ${tx}, ${ty})` : undefined}
      >
        {label}
      </text>
    </g>
  )
}

function drawRun(
  layout: LayoutSeg,
  scale: number,
  segIndex: number,
  layouts: LayoutSeg[],
) {
  const { calc: seg, x0, y0, x1, y1 } = layout
  const { ux, uy } = unitDir(x0, y0, x1, y1)
  const halfW = GLASS_DEPTH / 2
  const elements: ReactNode[] = []

  const startJoint = resolveStartJoint(layouts, segIndex)
  const endJoint = resolveEndJoint(layouts, segIndex)

  if (!seg.glasses?.length || seg.glassCount < 1) {
    return elements
  }

  let t = seg.gapMm * scale
  const gapS = seg.gapMm * scale

  for (let i = 0; i < seg.glassCount; i++) {
    const gw = seg.glassWidthMm * scale
    const ax = x0 + ux * t
    const ay = y0 + uy * t
    const bx = x0 + ux * (t + gw)
    const by = y0 + uy * (t + gw)
    const isFirst = i === 0
    const isLast = i === seg.glassCount - 1

    const quad = miteredGlassQuad(
      ax,
      ay,
      bx,
      by,
      halfW,
      isFirst ? startJoint : undefined,
      isLast ? endJoint : undefined,
    )
    const pts = quad.map((p) => p.join(',')).join(' ')
    const cx = (ax + bx) / 2
    const cy = (ay + by) / 2
    const g = seg.glasses[i]
    if (!g) continue

    elements.push(
      <g key={`${seg.key}-${i}`}>
        <polygon points={pts} fill={GLASS_FILL} stroke={GLASS_STROKE} strokeWidth={1.8} />
        <text
          x={cx}
          y={cy}
          textAnchor="middle"
          dominantBaseline="middle"
          fill="#f8fafc"
          fontSize={GLASS_LABEL_FONT}
          fontWeight={600}
          fontFamily="JetBrains Mono, Consolas, monospace"
        >
          {g.widthMm}×{g.heightMm}
        </text>
        {g.pillarPositionsMm.map((pos, pi) => {
          const pt = pos * scale
          const px0 = ax + ux * pt
          const py0 = ay + uy * pt
          const px = -uy
          const py = ux
          return (
            <circle
              key={pi}
              cx={px0 + px * (GLASS_DEPTH * 0.55)}
              cy={py0 + py * (GLASS_DEPTH * 0.55)}
              r={5}
              fill={PILLAR}
              stroke="#fff"
              strokeWidth={1}
            />
          )
        })}
      </g>,
    )
    t += gw + gapS
  }

  elements.push(dimLine(x0, y0, x1, y1, `${seg.runLengthMm} mm`, 26))

  if (startJoint && segIndex > 0) {
    const deg = turnAngleDeg(startJoint)
    elements.push(
      <g key={`joint-${seg.key}`}>
        <circle cx={x0} cy={y0} r={7} fill={CORNER} stroke="#fff" strokeWidth={1.2} />
        <text
          x={x0 + 12}
          y={y0 - 10}
          fontSize={10}
          fill={CORNER}
          fontWeight={700}
          fontFamily="JetBrains Mono, monospace"
        >
          {Math.round(deg)}° · {deg >= 89 && deg <= 91 ? '45° cut' : `${Math.round(deg / 2)}° cut`}
        </text>
      </g>,
    )
  }

  return elements
}

function walkCenterline(layouts: LayoutSeg[]): { x: number; y: number }[] {
  if (!layouts.length) return []
  const out: { x: number; y: number }[] = []
  for (let i = 0; i < layouts.length; i++) {
    const l = layouts[i]
    if (i === 0) {
      out.push({ x: l.x0, y: l.y0 }, { x: l.x1, y: l.y1 })
      continue
    }
    const prev = layouts[i - 1]
    const sharesStart = Math.hypot(l.x0 - prev.x0, l.y0 - prev.y0) < 0.5
    const continues = Math.hypot(l.x0 - prev.x1, l.y0 - prev.y1) < 0.5
    if (sharesStart) {
      out.push({ x: l.x0, y: l.y0 })
      out.push({ x: l.x1, y: l.y1 })
    } else if (continues) {
      out.push({ x: l.x1, y: l.y1 })
    } else {
      out.push({ x: l.x0, y: l.y0 }, { x: l.x1, y: l.y1 })
    }
  }
  return out
}

function centerlinePolyline(layouts: LayoutSeg[], offset: number): string | null {
  const vert = walkCenterline(layouts)
  if (vert.length < 2) return null
  const pts: string[] = []
  for (let i = 0; i < vert.length; i++) {
    let x: number
    let y: number
    if (i === 0) {
      const l = layouts[0]
      const { ux, uy } = unitDir(l.x0, l.y0, l.x1, l.y1)
      x = vert[i].x - uy * offset
      y = vert[i].y + ux * offset
    } else if (i === vert.length - 1) {
      const l = layouts[layouts.length - 1]
      const { ux, uy } = unitDir(l.x0, l.y0, l.x1, l.y1)
      x = vert[i].x - uy * offset
      y = vert[i].y + ux * offset
    } else {
      const prevDir = unitDir(vert[i - 1].x, vert[i - 1].y, vert[i].x, vert[i].y)
      const nextDir = unitDir(vert[i].x, vert[i].y, vert[i + 1].x, vert[i + 1].y)
      const joint: JointDirs = {
        uxIn: prevDir.ux,
        uyIn: prevDir.uy,
        uxOut: nextDir.ux,
        uyOut: nextDir.uy,
      }
      const p = offsetLineIntersect(
        vert[i].x,
        vert[i].y,
        joint.uxIn,
        joint.uyIn,
        vert[i].x,
        vert[i].y,
        joint.uxOut,
        joint.uyOut,
        offset,
      )
      x = p.x
      y = p.y
    }
    pts.push(`${x},${y}`)
  }
  return pts.join(' ')
}

interface CadPreviewProps {
  draft: DesignDraft
  canUndo?: boolean
  canRedo?: boolean
  onUndo?: () => void
  onRedo?: () => void
}

export function CadPreview({
  draft,
  canUndo = false,
  canRedo = false,
  onUndo,
  onRedo,
}: CadPreviewProps) {
  const calc = calculateDesign(draft)
  const scale = pickScale(draft, calc)
  const originX = 0
  const originY = 0

  const layouts = useMemo(
    () => buildLayouts(draft, calc, scale, originX, originY),
    [draft, calc, scale],
  )

  const bounds = useMemo(
    () => computeGeometryBounds(layouts, scale, GLASS_DEPTH, 32),
    [layouts, scale],
  )

  const svgRef = useRef<SVGSVGElement>(null)
  const [viewport, setViewport] = useState({ w: 800, h: 420 })
  const [userZoom, setUserZoom] = useState(1)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const dragRef = useRef<{ x: number; y: number; px: number; py: number } | null>(null)
  const pinchRef = useRef<{ distance: number; zoom: number } | null>(null)

  const clampZoom = (z: number) => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, z))

  const zoomBy = useCallback((factor: number) => {
    setUserZoom((z) => clampZoom(z * factor))
  }, [])

  useEffect(() => {
    setUserZoom(1)
    setPan({ x: 0, y: 0 })
  }, [draft.designType, draft.dimensions, draft.segmentConfigs])

  useEffect(() => {
    const el = svgRef.current?.parentElement
    if (!el) return
    const ro = new ResizeObserver(() => {
      setViewport({ w: el.clientWidth || 800, h: el.clientHeight || 420 })
    })
    ro.observe(el)
    setViewport({ w: el.clientWidth || 800, h: el.clientHeight || 420 })
    return () => ro.disconnect()
  }, [])

  const padding = 48
  const fitScale = Math.min(
    (viewport.w - padding * 2) / bounds.width,
    (viewport.h - padding * 2) / bounds.height,
    4,
  )
  const totalScale = fitScale * userZoom

  const viewW = viewport.w
  const viewH = viewport.h
  const centerX = viewW / 2 + pan.x
  const centerY = viewH / 2 + pan.y

  const worldTransform = `translate(${centerX}, ${centerY}) scale(${totalScale}) translate(${-bounds.cx}, ${-bounds.cy})`

  /** Wheel zoom only with Ctrl/Cmd so the page / parent scroller still receives normal wheel (long form below CAD). */
  const onWheel = useCallback((e: React.WheelEvent) => {
    if (!(e.ctrlKey || e.metaKey)) return
    e.preventDefault()
    const delta = e.deltaY > 0 ? 0.9 : 1.1
    setUserZoom((z) => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, z * delta)))
  }, [])

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    if (e.button !== 0) return
    ;(e.target as Element).setPointerCapture?.(e.pointerId)
    dragRef.current = { x: e.clientX, y: e.clientY, px: pan.x, py: pan.y }
  }, [pan])

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    if (!dragRef.current) return
    setPan({
      x: dragRef.current.px + (e.clientX - dragRef.current.x),
      y: dragRef.current.py + (e.clientY - dragRef.current.y),
    })
  }, [])

  const onPointerUp = useCallback(() => {
    dragRef.current = null
  }, [])

  const resetView = () => {
    setUserZoom(1)
    setPan({ x: 0, y: 0 })
  }

  const onTouchStart = useCallback((e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      const dx = e.touches[0].clientX - e.touches[1].clientX
      const dy = e.touches[0].clientY - e.touches[1].clientY
      pinchRef.current = { distance: Math.hypot(dx, dy), zoom: userZoom }
    }
  }, [userZoom])

  const onTouchMove = useCallback((e: React.TouchEvent) => {
    if (e.touches.length !== 2 || !pinchRef.current) return
    e.preventDefault()
    const dx = e.touches[0].clientX - e.touches[1].clientX
    const dy = e.touches[0].clientY - e.touches[1].clientY
    const dist = Math.hypot(dx, dy)
    if (pinchRef.current.distance <= 0) return
    const ratio = dist / pinchRef.current.distance
    setUserZoom(clampZoom(pinchRef.current.zoom * ratio))
  }, [])

  const onTouchEnd = useCallback(() => {
    pinchRef.current = null
  }, [])

  const bottomRailPath = centerlinePolyline(layouts, GLASS_DEPTH * 0.65)
  const handrailPath = centerlinePolyline(layouts, -GLASS_DEPTH * 0.15)

  return (
    <div className="preview-wrap cad no-print">
      <div className="preview-header preview-header-cad">
        <span className="cad-title">
          <span className="cad-title-long">CAD plan — miter joints</span>
          <span className="cad-title-short">CAD</span>
        </span>
        <div className="cad-toolbar">
          {onUndo && (
            <button
              type="button"
              className="cad-tool-btn cad-tool-undo"
              onClick={onUndo}
              disabled={!canUndo}
              title="Undo (Ctrl+Z)"
            >
              ↶
            </button>
          )}
          {onRedo && (
            <button
              type="button"
              className="cad-tool-btn cad-tool-redo"
              onClick={onRedo}
              disabled={!canRedo}
              title="Redo (Ctrl+Y)"
            >
              ↷
            </button>
          )}
          <span className="cad-hint">Pinch · drag to pan</span>
          <button type="button" className="cad-tool-btn" onClick={() => zoomBy(1.15)} title="Zoom in" aria-label="Zoom in">
            +
          </button>
          <button type="button" className="cad-tool-btn" onClick={() => zoomBy(1 / 1.15)} title="Zoom out" aria-label="Zoom out">
            −
          </button>
          <button type="button" className="cad-tool-btn cad-tool-fit" onClick={resetView}>
            Fit
          </button>
          <span className="cad-zoom-label">{Math.round(userZoom * 100)}%</span>
        </div>
      </div>
      <div
        className="cad-viewport"
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        onTouchCancel={onTouchEnd}
      >
        <svg
          ref={svgRef}
          className="preview-svg cad-interactive"
          viewBox={`0 0 ${viewW} ${viewH}`}
          role="img"
          onWheel={onWheel}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerLeave={onPointerUp}
        >
          <defs>
            <pattern
              id="cadGrid"
              width={24}
              height={24}
              patternUnits="userSpaceOnUse"
              patternTransform={`translate(${centerX % 24}, ${centerY % 24}) scale(${totalScale})`}
            >
              <path
                d="M 24 0 L 0 0 0 24"
                fill="none"
                stroke="rgba(148,163,184,0.12)"
                strokeWidth={0.6}
              />
            </pattern>
          </defs>
          <rect width={viewW} height={viewH} fill="#0f172a" />
          <rect width={viewW} height={viewH} fill="url(#cadGrid)" />

          <g transform={worldTransform}>
            {bottomRailPath && calc.hardware.bottomRailMm > 0 && (
              <polyline
                points={bottomRailPath}
                fill="none"
                stroke={RAIL}
                strokeWidth={4 / totalScale}
                strokeLinejoin="miter"
                strokeMiterlimit={12}
                strokeLinecap="square"
              />
            )}
            {handrailPath && calc.hardware.handrailMm > 0 && (
              <polyline
                points={handrailPath}
                fill="none"
                stroke={HANDRAIL}
                strokeWidth={2.5 / totalScale}
                strokeDasharray={`${6 / totalScale} ${3 / totalScale}`}
                strokeLinejoin="miter"
                strokeMiterlimit={12}
              />
            )}
            {layouts.flatMap((l, i) => drawRun(l, scale, i, layouts))}
          </g>

          <g className="cad-legend cad-legend-svg" transform={`translate(12, 12)`}>
            <rect x={0} y={0} width={14} height={10} fill={GLASS_FILL} stroke={GLASS_STROKE} />
            <text x={20} y={10} fill={DIM} fontSize={10}>
              Glass
            </text>
            <line x1={68} y1={5} x2={88} y2={5} stroke={RAIL} strokeWidth={3} />
            <text x={94} y={10} fill={DIM} fontSize={10}>
              Rail
            </text>
          </g>
        </svg>
      </div>
      <div className="cad-stats">
        <span className="cad-stat">
          <em>Run</em> <strong>{calc.perimeterRunMm} mm</strong>
        </span>
        <span className="cad-stat">
          <em>Glass</em> <strong>{calc.totalGlassPanels}</strong>
          <span className="cad-stat-sub">({calc.totalGlassAreaSqm} m²)</span>
        </span>
        {calc.hardware.bottomRailMm > 0 && (
          <span className="cad-stat">
            <em>Rail</em> <strong>{calc.hardware.bottomRailMm} mm</strong>
          </span>
        )}
      </div>
    </div>
  )
}
