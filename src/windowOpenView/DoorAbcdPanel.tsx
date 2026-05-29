import React, { useId } from 'react';
import type { DoorSwingLayout } from './doorHingeLayout';
import { cornerAngleAtHinge, doorPolygonOrder, hingeStileYMm } from './doorHingeLayout';
import type { OpenViewVariant } from './types';

type Props = {
  originXMm: number;
  originYMm: number;
  swing: DoorSwingLayout;
  scale: number;
  profileMm: number;
  color: string;
  variant: OpenViewVariant;
  showCornerLabels?: boolean;
};

type CornerKey = 'A' | 'B' | 'C' | 'D';

const HINGE_EDGE = '#0a0a0a';

/** Weld-on barrel hinge — two cylindrical leaves with centre gap (print + canvas). */
function BarrelHingeMark({
  x,
  y,
  scale,
  gradId,
  vertical = true,
}: {
  x: number;
  y: number;
  scale: number;
  gradId: string;
  vertical?: boolean;
}) {
  const w = Math.max(3.5, 4.2 * Math.min(1.4, scale));
  const totalH = Math.max(9, 11 * Math.min(1.4, scale));
  const gap = 1.1;
  const barrelH = (totalH - gap) / 2;
  const body = (
    <g>
      <defs>
        <linearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#111" />
          <stop offset="38%" stopColor="#444" />
          <stop offset="52%" stopColor="#2a2a2a" />
          <stop offset="100%" stopColor="#0a0a0a" />
        </linearGradient>
      </defs>
      <rect
        x={-w / 2}
        y={-totalH / 2}
        width={w}
        height={barrelH}
        rx={w / 2}
        fill={`url(#${gradId})`}
        stroke={HINGE_EDGE}
        strokeWidth={0.35}
      />
      <rect
        x={-w / 2}
        y={gap / 2}
        width={w}
        height={barrelH}
        rx={w / 2}
        fill={`url(#${gradId})`}
        stroke={HINGE_EDGE}
        strokeWidth={0.35}
      />
      <line x1={-w / 2} y1={0} x2={w / 2} y2={0} stroke="#000" strokeWidth={0.45} opacity={0.55} />
      <line
        x1={-w / 5}
        y1={-totalH / 2 + 0.8}
        x2={-w / 5}
        y2={totalH / 2 - 0.8}
        stroke="#666"
        strokeWidth={0.35}
        opacity={0.45}
      />
    </g>
  );
  return (
    <g transform={`translate(${x}, ${y})${vertical ? '' : ' rotate(90)'}`}>
      {body}
    </g>
  );
}

function cornerMap(corners: DoorSwingLayout['corners']) {
  return Object.fromEntries(corners.map((c) => [c.label, c])) as Record<
    CornerKey,
    { label: CornerKey; x: number; y: number; fixed: boolean }
  >;
}

function hingePair(map: ReturnType<typeof cornerMap>): [CornerKey, CornerKey] {
  return map.C.fixed && map.D.fixed ? ['C', 'D'] : ['A', 'B'];
}

function freePair(map: ReturnType<typeof cornerMap>): [CornerKey, CornerKey] {
  return map.C.fixed && map.D.fixed ? ['A', 'B'] : ['C', 'D'];
}

function insetPolygon(pts: { x: number; y: number }[], inset: number): { x: number; y: number }[] {
  if (pts.length < 3 || inset <= 0) return pts;
  const cx = pts.reduce((s, p) => s + p.x, 0) / pts.length;
  const cy = pts.reduce((s, p) => s + p.y, 0) / pts.length;
  return pts.map((p) => {
    const dx = p.x - cx;
    const dy = p.y - cy;
    const len = Math.hypot(dx, dy) || 1;
    const f = Math.max(0, 1 - inset / len);
    return { x: cx + dx * f, y: cy + dy * f };
  });
}

export const DoorAbcdPanel: React.FC<Props> = ({
  originXMm,
  originYMm,
  swing,
  scale,
  profileMm,
  color,
  variant,
  showCornerLabels = true,
}) => {
  const gradBase = useId().replace(/:/g, '');
  const ox = originXMm * scale;
  const oy = originYMm * scale;
  const map = cornerMap(swing.corners);
  const order = doorPolygonOrder(swing.hungType);
  const outer = order.map((k) => ({ x: ox + map[k].x * scale, y: oy + map[k].y * scale }));
  const inset = Math.max(2, profileMm * scale * 0.85);
  const inner = insetPolygon(outer, inset);

  const isPrint = variant === 'print';
  const stroke = isPrint ? '#374151' : color;
  const glassFill = isPrint ? '#e2e8f0' : 'rgba(191,219,254,0.35)';
  const hingeStileStroke = isPrint ? '#64748b' : '#93c5fd';
  const showLabels = showCornerLabels && !isPrint;
  const showAngleArc = !isPrint && swing.openAngleDeg > 0.5;

  const outerPath = outer.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ') + ' Z';
  const innerPath = inner.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ') + ' Z';

  const [h1, h2] = hingePair(map);
  const [f1, f2] = freePair(map);
  const isSideHung = swing.hungType === 'side_left' || swing.hungType === 'side_right';
  const stileX = map[h1].x;
  const hingeY = hingeStileYMm(swing.heightMm, swing.hingeInsetMm);
  const stileTopPx = oy;
  const stileBotPx = oy + swing.heightMm * scale;
  const hx1 = ox + (isSideHung ? stileX : map[h1].x) * scale;
  const hy1 = oy + (isSideHung ? hingeY.top : map[h1].y) * scale;
  const hx2 = ox + (isSideHung ? stileX : map[h2].x) * scale;
  const hy2 = oy + (isSideHung ? hingeY.bottom : map[h2].y) * scale;
  const fx1 = ox + map[f1].x * scale;
  const fy1 = oy + map[f1].y * scale;
  const fx2 = ox + map[f2].x * scale;
  const fy2 = oy + map[f2].y * scale;

  const angleA = cornerAngleAtHinge(swing.corners);

  return (
    <g className="wov-abcd-door">
      <path d={outerPath} fill="none" stroke={stroke} strokeWidth={Math.max(1.5, inset * 0.45)} strokeLinejoin="miter" />
      <path d={innerPath} fill={glassFill} stroke={variant === 'print' ? '#94a3b8' : 'rgba(148,163,184,0.45)'} strokeWidth={0.5} />

      {/* Hinge stile — full height on side-hung A–B / joint stile */}
      {isSideHung ? (
        <line
          x1={hx1}
          y1={stileTopPx}
          x2={hx2}
          y2={stileBotPx}
          stroke={hingeStileStroke}
          strokeWidth={0.8}
          opacity={isPrint ? 0.5 : 0.85}
        />
      ) : (
        <line
          x1={hx1}
          y1={hy1}
          x2={hx2}
          y2={hy2}
          stroke={hingeStileStroke}
          strokeWidth={0.8}
          opacity={isPrint ? 0.5 : 0.85}
        />
      )}

      {/* Free stile — shortens when open */}
      <line
        x1={fx1}
        y1={fy1}
        x2={fx2}
        y2={fy2}
        stroke={isPrint ? '#94a3b8' : '#cbd5e1'}
        strokeWidth={0.8}
        strokeDasharray={isPrint ? '3 2' : '4 2'}
        opacity={isPrint ? 0.65 : 1}
      />

      {isSideHung
        ? [hy1, hy2].map((hy, i) => (
            <BarrelHingeMark
              key={`hinge-${i}`}
              x={hx1}
              y={hy}
              scale={scale}
              gradId={`${gradBase}-v-${i}`}
              vertical
            />
          ))
        : [h1, h2].map((k, i) => {
            const hx = ox + map[k].x * scale;
            const hy = oy + map[k].y * scale;
            return (
              <BarrelHingeMark
                key={`hinge-${k}`}
                x={hx}
                y={hy}
                scale={scale}
                gradId={`${gradBase}-c-${i}`}
                vertical={swing.hungType === 'side_left' || swing.hungType === 'side_right'}
              />
            );
          })}

      {showLabels
        ? (['A', 'B', 'C', 'D'] as const).map((k) => (
            <text
              key={`lbl-${k}`}
              x={ox + map[k].x * scale + (k === 'C' || k === 'D' ? 5 : -9)}
              y={oy + map[k].y * scale + (k === 'A' || k === 'C' ? -5 : 5)}
              fontSize={7}
              fontWeight={700}
              fill={map[k].fixed ? '#93c5fd' : '#e2e8f0'}
            >
              {k}
            </text>
          ))
        : null}

      {showAngleArc ? (
        <>
          <path
            d={`M ${hx1 + 14} ${hy1} A 14 14 0 0 ${swing.swingSide === 'outside' ? 1 : 0} ${fx1} ${fy1}`}
            fill="none"
            stroke="#93c5fd"
            strokeWidth={0.6}
            opacity={0.6}
          />
          <text x={hx1 + 18} y={hy1 + 12} fontSize={6} fill="#93c5fd">
            {angleA.toFixed(0)}°
          </text>
        </>
      ) : null}
    </g>
  );
};

export function isAbcdSwing(swing: DoorSwingLayout | undefined, openAmount: number): boolean {
  if (!swing) return false;
  return openAmount > 0.01 && swing.openAngleDeg > 0.1;
}
