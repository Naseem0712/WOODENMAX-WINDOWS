import React, { useEffect, useMemo, useRef, useState } from 'react';
import type { DesignLayoutUnit, WindowConfig } from '../types';
import { computeLayoutPlacements, describeLayoutShape, layoutBounds } from '../utils/designLayout';
import {
  buildFrameSketchSegments,
  buildSharedMullions,
  glassInsetRect,
  miterCornerLines,
  resolveLayoutOuterFrameMm,
} from '../utils/layoutFrameSketch';

type Props = {
  primary: WindowConfig;
  primaryTitle: string;
  companions: DesignLayoutUnit[];
  activeUnitId: string;
  onSelectUnit?: (id: string) => void;
};

const FRAME_STROKE = '#cbd5e1';
const FRAME_INNER = '#94a3b8';
const GLASS_FILL = 'rgba(147,197,253,0.18)';
const MULLION_FILL = '#64748b';
const LAYOUT_VIEW_H = 240;

/** Combined elevation — fixed-height strip; L / straight layout auto-fits inside. */
export const DesignLayoutCanvas: React.FC<Props> = ({
  primary,
  primaryTitle,
  companions,
  activeUnitId,
  onSelectUnit,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerW, setContainerW] = useState(640);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const measure = () => setContainerW(Math.max(200, el.clientWidth));
    measure();
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(measure) : null;
    ro?.observe(el);
    window.addEventListener('resize', measure);
    return () => {
      ro?.disconnect();
      window.removeEventListener('resize', measure);
    };
  }, []);

  const units = useMemo(
    () => computeLayoutPlacements(primary, primaryTitle, companions),
    [primary, primaryTitle, companions],
  );
  const bounds = useMemo(() => layoutBounds(units), [units]);
  const shapeLabel = useMemo(() => describeLayoutShape(units), [units]);
  const frameSegments = useMemo(() => buildFrameSketchSegments(units), [units]);
  const mullions = useMemo(() => buildSharedMullions(units), [units]);

  const pad = 28;
  const scale = Math.min(
    (containerW - pad * 2) / Math.max(bounds.widthMm, 1),
    (LAYOUT_VIEW_H - pad * 2) / Math.max(bounds.heightMm, 1),
  );
  const drawW = bounds.widthMm * scale;
  const drawH = bounds.heightMm * scale;
  const padX = (containerW - drawW) / 2 - bounds.minXMm * scale;
  const padY = (LAYOUT_VIEW_H - drawH) / 2 - bounds.minYMm * scale;

  if (companions.length === 0) return null;

  const mmX = (v: number) => v * scale + padX;
  const mmY = (v: number) => v * scale + padY;

  return (
    <div
      ref={containerRef}
      className="relative w-full max-w-4xl shrink-0 overflow-hidden rounded-lg border-2 border-slate-500/50 bg-slate-900/50 shadow-lg"
      style={{ height: LAYOUT_VIEW_H }}
    >
      <p className="pointer-events-none absolute left-0 right-0 top-1 z-10 text-center text-[10px] font-bold uppercase tracking-wide text-slate-400">
        Combined — {shapeLabel} · click unit to select
      </p>
      <svg
        width={containerW}
        height={LAYOUT_VIEW_H}
        className="block"
        role="img"
        aria-label={`Combined window layout: ${shapeLabel}`}
      >
        {units.map((u) => {
          const px = mmX(u.xMm);
          const py = mmY(u.yMm);
          const pw = Math.max(4, u.widthMm * scale);
          const ph = Math.max(4, u.heightMm * scale);
          return (
            <rect
              key={`hit-${u.id}`}
              x={px}
              y={py}
              width={pw}
              height={ph}
              fill="transparent"
              className={onSelectUnit ? 'cursor-pointer' : undefined}
              onClick={() => onSelectUnit?.(u.id)}
            />
          );
        })}

        {units.map((u) => {
          const glass = glassInsetRect(u, units);
          const active = u.id === activeUnitId || (u.id === 'primary' && activeUnitId === 'primary');
          return (
            <rect
              key={`glass-${u.id}`}
              x={mmX(glass.x)}
              y={mmY(glass.y)}
              width={Math.max(1, glass.w * scale)}
              height={Math.max(1, glass.h * scale)}
              fill={GLASS_FILL}
              stroke={active ? '#818cf8' : 'rgba(148,163,184,0.4)'}
              strokeWidth={active ? 2 : 0.8}
              pointerEvents="none"
            />
          );
        })}

        {mullions.map((m, i) => (
          <rect
            key={`mull-${i}`}
            x={mmX(Math.min(m.x1, m.x2))}
            y={mmY(Math.min(m.y1, m.y2))}
            width={Math.max(1, Math.abs(m.x2 - m.x1) * scale)}
            height={Math.max(1, Math.abs(m.y2 - m.y1) * scale)}
            fill={MULLION_FILL}
            opacity={0.85}
            pointerEvents="none"
          />
        ))}

        {frameSegments.map((seg, i) => (
          <g key={`frame-${i}`} pointerEvents="none">
            <line
              x1={mmX(seg.outer.x1)}
              y1={mmY(seg.outer.y1)}
              x2={mmX(seg.outer.x2)}
              y2={mmY(seg.outer.y2)}
              stroke={FRAME_STROKE}
              strokeWidth={2.5}
              strokeLinecap="square"
            />
            <line
              x1={mmX(seg.inner.x1)}
              y1={mmY(seg.inner.y1)}
              x2={mmX(seg.inner.x2)}
              y2={mmY(seg.inner.y2)}
              stroke={FRAME_INNER}
              strokeWidth={1.2}
              strokeLinecap="square"
            />
          </g>
        ))}

        {units.map((u) => {
          const f = resolveLayoutOuterFrameMm(u.config);
          const { xMm: x, yMm: y, widthMm: w, heightMm: h } = u;
          const corners: ('tl' | 'tr' | 'br' | 'bl')[] = [];
          const hasTop = frameSegments.some((s) => s.unitId === u.id && s.side === 'top');
          const hasBottom = frameSegments.some((s) => s.unitId === u.id && s.side === 'bottom');
          const hasLeft = frameSegments.some((s) => s.unitId === u.id && s.side === 'left');
          const hasRight = frameSegments.some((s) => s.unitId === u.id && s.side === 'right');
          if (hasTop && hasLeft) corners.push('tl');
          if (hasTop && hasRight) corners.push('tr');
          if (hasBottom && hasRight) corners.push('br');
          if (hasBottom && hasLeft) corners.push('bl');

          return corners.map((c) => {
            const m = miterCornerLines(x, y, w, h, f, c);
            return (
              <line
                key={`miter-${u.id}-${c}`}
                x1={mmX(m.x1)}
                y1={mmY(m.y1)}
                x2={mmX(m.x2)}
                y2={mmY(m.y2)}
                stroke={FRAME_INNER}
                strokeWidth={1}
                pointerEvents="none"
              />
            );
          });
        })}

        {units.map((u) => {
          const active = u.id === activeUnitId || (u.id === 'primary' && activeUnitId === 'primary');
          if (!active) return null;
          const px = mmX(u.xMm);
          const py = mmY(u.yMm);
          const pw = u.widthMm * scale;
          const ph = u.heightMm * scale;
          return (
            <rect
              key={`active-ring-${u.id}`}
              x={px - 2}
              y={py - 2}
              width={pw + 4}
              height={ph + 4}
              fill="none"
              stroke="#818cf8"
              strokeWidth={2}
              strokeDasharray="6 3"
              pointerEvents="none"
            />
          );
        })}

        {units.map((u) => {
          const cx = mmX(u.xMm + u.widthMm / 2);
          const cy = mmY(u.yMm + u.heightMm / 2);
          const active = u.id === activeUnitId || (u.id === 'primary' && activeUnitId === 'primary');
          return (
            <g key={`label-${u.id}`} pointerEvents="none">
              <text x={cx} y={cy - 4} textAnchor="middle" fontSize={9} fill={active ? '#c7d2fe' : '#e2e8f0'} fontWeight={700}>
                {u.title}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
};
