import React, { useMemo } from 'react';
import type { OpenViewSpec, OpenViewVariant } from './types';
import { planKindShortLabel } from './supportsOpenView';
import {
  buildSlidingPlanSegments,
  slidingLaneYOffset,
  slidingOpenFractionHint,
  slidingPlanMode,
} from './slidingPlanLayout';

type Props = {
  spec: OpenViewSpec;
  variant?: OpenViewVariant;
  widthPx?: number;
  swingSide?: import('./doorHingeLayout').DoorSwingSide;
  openAmount?: number;
};

/** Top-down plan schematic — track, bi-fold zigzag, external/internal. */
export const PlanSchematic: React.FC<Props> = ({
  spec,
  variant = 'canvas',
  widthPx = 320,
  swingSide = 'outside',
  openAmount = 1,
}) => {
  const plan = useMemo(() => buildPlanPaths(spec, openAmount), [spec, openAmount]);
  const isSliding = spec.kind === 'sliding' || spec.kind === 'partition_sliding';
  const slidingMode = isSliding ? slidingPlanMode(spec.config.shutterConfig) : null;
  const openHint = isSliding ? slidingOpenFractionHint(spec) : null;
  const innerW = spec.innerWidthMm ?? spec.totalWidthMm;
  const heightPx = Math.max(isSliding ? 100 : 88, widthPx * (isSliding ? 0.38 : 0.32));
  const pad = 12;
  const scale = (widthPx - pad * 2) / Math.max(isSliding ? innerW : spec.totalWidthMm, 1);
  const trackY = heightPx * 0.52;

  const trackStroke = variant === 'print' ? '#1a1a1a' : '#60a5fa';
  const labelFill = variant === 'print' ? '#374151' : '#cbd5e1';
  const isPrint = variant === 'print';
  const pct = Math.round(openAmount * 100);
  const usesSwing =
    spec.kind !== 'sliding' && spec.kind !== 'partition_sliding';
  const swingNote = usesSwing
    ? swingSide === 'inside'
      ? 'Inside swing'
      : 'Outside swing'
    : 'Slide direction';

  const toSvg = (x: number, y: number) => ({
    sx: pad + x * scale,
    sy: trackY + y * scale * 0.55,
  });

  const kindLabel = planKindShortLabel(spec.kind);

  const swingShort =
    swingNote === 'Outside swing' ? 'Outside' : swingNote === 'Inside swing' ? 'Inside' : swingNote;

  return (
    <div className={`wov-plan-wrap ${variant}`}>
      <div className="wov-plan-title">
        {isPrint
          ? `Plan · ${kindLabel} · ${pct}% · ${swingShort}`
          : `Plan view — ${kindLabel} · ${pct}% · ${swingNote}`}
      </div>
      <svg
        width={widthPx}
        height={heightPx}
        viewBox={`0 0 ${widthPx} ${heightPx}`}
        className="wov-plan-svg"
        aria-label="Plan schematic"
      >
        <text x={pad} y={14} fontSize={8} fill={labelFill} fontWeight={600}>
          External
        </text>
        <line
          x1={pad}
          y1={22}
          x2={widthPx - pad}
          y2={22}
          stroke={trackStroke}
          strokeWidth={0.6}
          strokeDasharray="3 2"
          opacity={0.45}
        />
        <text x={pad} y={heightPx - 6} fontSize={8} fill={labelFill} fontWeight={600}>
          Internal
        </text>

        {/* Track / head channel — inner opening width for sliding */}
        <line
          x1={pad}
          y1={trackY}
          x2={pad + (isSliding ? innerW : spec.totalWidthMm) * scale}
          y2={trackY}
          stroke={trackStroke}
          strokeWidth={1.4}
          strokeLinecap="round"
        />

        {/* Bi-fold zigzag from dedicated layout */}
        {plan.bifoldSegments?.map((seg, i) => {
          const a = toSvg(seg.x1, seg.y1);
          const b = toSvg(seg.x2, seg.y2);
          return (
            <g key={`bf-${i}`}>
              <line x1={a.sx} y1={a.sy} x2={b.sx} y2={b.sy} stroke={trackStroke} strokeWidth={3.2} strokeLinecap="round" />
              {seg.pivot ? (
                <rect
                  x={toSvg(seg.pivot.x, seg.pivot.y).sx - 2.5}
                  y={toSvg(seg.pivot.x, seg.pivot.y).sy - 2.5}
                  width={5}
                  height={5}
                  fill={trackStroke}
                  opacity={0.85}
                />
              ) : null}
              <text
                x={(a.sx + b.sx) / 2}
                y={(a.sy + b.sy) / 2 - 6}
                textAnchor="middle"
                fontSize={9}
                fill={trackStroke}
                fontWeight={700}
              >
                {seg.label}
              </text>
            </g>
          );
        })}

        {/* Casement / hinged single-door segments */}
        {plan.swingSegments?.map((seg, i) => {
          const a = toSvg(seg.x1, seg.y1);
          const b = toSvg(seg.x2, seg.y2);
          return (
            <g key={`sw-${i}`}>
              <line x1={a.sx} y1={a.sy} x2={b.sx} y2={b.sy} stroke={trackStroke} strokeWidth={3} strokeLinecap="round" />
              {seg.pivot ? (
                <rect
                  x={toSvg(seg.pivot.x, seg.pivot.y).sx - 2.5}
                  y={toSvg(seg.pivot.x, seg.pivot.y).sy - 2.5}
                  width={5}
                  height={5}
                  fill={trackStroke}
                />
              ) : null}
              <text x={b.sx} y={b.sy - 5} textAnchor="middle" fontSize={8} fill={trackStroke} fontWeight={700}>
                {seg.label}
              </text>
            </g>
          );
        })}

        {/* Sliding track lanes — lane 1 above track (rear), lane 2 below (front); panels overlap in X */}
        {plan.slideSegments?.map((seg, i) => {
          const laneY = trackY + slidingLaneYOffset(seg.lane, slidingMode ?? 'stacked', spec.trackCount ?? 2);
          const x1 = pad + seg.x1 * scale;
          const x2 = pad + seg.x2 * scale;
          const labelY = seg.lane === 1 ? laneY - 7 : laneY + 11;
          const arrowX = seg.arrow === 'left' ? x1 : x2;
          return (
            <g key={`sl-${i}`}>
              <line
                x1={x1}
                y1={laneY}
                x2={x2}
                y2={laneY}
                stroke={trackStroke}
                strokeWidth={seg.thick}
                strokeLinecap="round"
              />
              {seg.label ? (
                <text
                  x={(x1 + x2) / 2}
                  y={labelY}
                  textAnchor="middle"
                  fontSize={8}
                  fill={trackStroke}
                  fontWeight={700}
                >
                  {seg.label}
                </text>
              ) : null}
              {seg.arrow ? (
                <polygon points={arrowPoints(arrowX, laneY, seg.arrow)} fill={trackStroke} />
              ) : null}
            </g>
          );
        })}

        <text
          x={pad + ((isSliding ? innerW : spec.totalWidthMm) * scale) / 2}
          y={heightPx - 2}
          textAnchor="middle"
          fontSize={8}
          fill={variant === 'print' ? '#475569' : '#94a3b8'}
        >
          {Math.round(isSliding ? innerW : spec.totalWidthMm)} mm
        </text>
      </svg>
      <p className="mt-1 text-[10px] text-slate-500">
        {isSliding
          ? slidingMode === 'four_shutter'
            ? 'Each track lane · shutters side-by-side with interlock overlap'
            : `Separate tracks · shutters stack & overlap at centre${openHint ? ` (${openHint})` : ''}`
          : 'Top/bottom on track · opposite stile swings external or internal'}
      </p>
    </div>
  );
};

function arrowPoints(x: number, y: number, dir: 'left' | 'right'): string {
  const s = 4;
  if (dir === 'right') return `${x},${y} ${x - s},${y - s} ${x - s},${y + s}`;
  return `${x},${y} ${x + s},${y - s} ${x + s},${y + s}`;
}

type SlideSeg = {
  x1: number;
  x2: number;
  lane: number;
  thick: number;
  label?: string;
  arrow?: 'left' | 'right';
};

type SwingSeg = {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  label: string;
  pivot?: { x: number; y: number };
};

function buildPlanPaths(spec: OpenViewSpec, openAmount: number): {
  bifoldSegments?: SwingSeg[];
  swingSegments?: SwingSeg[];
  slideSegments?: SlideSeg[];
} {
  if (spec.kind === 'sliding' || spec.kind === 'partition_sliding') {
    return { slideSegments: buildSlidingPlanSegments(spec, openAmount) };
  }

  const bifoldPanels = spec.panels.filter((p) => p.bifoldPlan);
  const comboSwingPanels = spec.panels.filter((p) => p.planSegment && !p.bifoldPlan);
  if (bifoldPanels.length > 0) {
    const result: {
      bifoldSegments: SwingSeg[];
      swingSegments?: SwingSeg[];
    } = {
      bifoldSegments: bifoldPanels.flatMap((p) =>
        p.bifoldPlan!.segments.map((s) => ({
          x1: s.x1,
          y1: s.y1,
          x2: s.x2,
          y2: s.y2,
          label: s.label,
          pivot: s.pivot,
        })),
      ),
    };
    if (comboSwingPanels.length > 0) {
      result.swingSegments = comboSwingPanels.map((p) => ({
        x1: p.planSegment!.x1,
        y1: p.planSegment!.y1,
        x2: p.planSegment!.x2,
        y2: p.planSegment!.y2,
        label: p.label,
        pivot: p.planSegment!.pivot,
      }));
    }
    return result;
  }

  const swingFromPanels = spec.panels.filter((p) => p.planSegment);
  if (swingFromPanels.length > 0) {
    return {
      swingSegments: swingFromPanels.map((p) => ({
        x1: p.planSegment!.x1,
        y1: p.planSegment!.y1,
        x2: p.planSegment!.x2,
        y2: p.planSegment!.y2,
        label: p.label,
        pivot: p.planSegment!.pivot,
      })),
    };
  }

  if (spec.kind === 'partition_fold' || spec.kind === 'casement' || spec.kind === 'ventilator') {
    return {
      swingSegments: spec.panels.map((p, i) => {
        const rot = (p.openRotateDeg ?? 0) * (Math.PI / 180);
        const hingeX = p.xMm + (p.hingeXMm ?? 0);
        const endX = hingeX + (p.widthMm * 0.9 * Math.cos(rot + Math.PI / 2)) * (p.hingeXMm === 0 ? 1 : -1);
        const endY = -Math.abs(p.widthMm * 0.85 * Math.sin(rot));
        return {
          x1: hingeX,
          y1: 0,
          x2: endX,
          y2: endY,
          label: p.label,
          pivot: { x: hingeX, y: 0 },
        };
      }),
    };
  }

  return {};
}
