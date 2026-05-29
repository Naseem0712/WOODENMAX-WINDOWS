import React, { useMemo } from 'react';
import type { DesignLayoutUnit, WindowConfig } from '../types';
import { computeLayoutPlacements, layoutBounds } from '../utils/designLayout';

type Props = {
  primary: WindowConfig;
  primaryTitle: string;
  companions: DesignLayoutUnit[];
  activeUnitId: string;
  maxWidthPx?: number;
};

/** Composite elevation sketch — all units with gap / level dimensions. */
export const DesignLayoutCanvas: React.FC<Props> = ({
  primary,
  primaryTitle,
  companions,
  activeUnitId,
  maxWidthPx = 420,
}) => {
  const units = useMemo(
    () => computeLayoutPlacements(primary, primaryTitle, companions),
    [primary, primaryTitle, companions],
  );
  const bounds = useMemo(() => layoutBounds(units), [units]);
  const scale = maxWidthPx / Math.max(bounds.widthMm, 1);
  const heightPx = bounds.heightMm * scale + 48;

  if (companions.length === 0) return null;

  return (
    <div className="rounded-lg border border-slate-600/60 bg-slate-900/40 p-2">
      <p className="mb-2 text-center text-[10px] font-bold uppercase tracking-wide text-slate-400">
        Façade layout — {units.length} units
      </p>
      <svg width={maxWidthPx} height={heightPx} viewBox={`0 0 ${maxWidthPx} ${heightPx}`} className="mx-auto block">
        {units.map((u) => {
          const px = u.xMm * scale;
          const py = u.yMm * scale + 8;
          const pw = Math.max(2, u.widthMm * scale);
          const ph = Math.max(2, u.heightMm * scale);
          const active = u.id === activeUnitId || (u.id === 'primary' && activeUnitId === 'primary');
          const stroke = active ? '#818cf8' : '#64748b';
          return (
            <g key={u.id}>
              <rect
                x={px}
                y={py}
                width={pw}
                height={ph}
                fill="rgba(191,219,254,0.12)"
                stroke={stroke}
                strokeWidth={active ? 2 : 1}
                rx={1}
              />
              <text x={px + pw / 2} y={py + ph / 2} textAnchor="middle" fontSize={8} fill="#e2e8f0" fontWeight={700}>
                {u.title}
              </text>
              <text x={px + pw / 2} y={py + ph / 2 + 10} textAnchor="middle" fontSize={7} fill="#94a3b8">
                {Math.round(u.widthMm)} × {Math.round(u.heightMm)}
              </text>
            </g>
          );
        })}
        {units.slice(1).map((u, i) => {
          const prev = units[i];
          const gap = u.xMm - (prev.xMm + prev.widthMm);
          const midX = ((prev.xMm + prev.widthMm) + u.xMm) / 2;
          return (
            <g key={`dim-${u.id}`}>
              <text
                x={midX * scale}
                y={Math.max(prev.yMm, u.yMm) * scale + 4}
                textAnchor="middle"
                fontSize={7}
                fill="#60a5fa"
              >
                gap {Math.round(gap)} mm
              </text>
              {u.yMm !== 0 ? (
                <text x={u.xMm * scale - 4} y={u.yMm * scale + 8} fontSize={7} fill="#fbbf24" textAnchor="end">
                  ↕ {Math.round(u.yMm)} mm
                </text>
              ) : null}
            </g>
          );
        })}
        <text x={maxWidthPx / 2} y={heightPx - 4} textAnchor="middle" fontSize={8} fill="#64748b">
          Total width {Math.round(bounds.widthMm)} mm
        </text>
      </svg>
    </div>
  );
};
