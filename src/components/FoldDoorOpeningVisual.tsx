import React from 'react';
import { clampFoldLeafCount } from '../utils/partitionPanelGeometry';

type Variant = 'canvas' | 'print';

function borderColorFromProfile(profileColor: string | undefined): string {
  if (profileColor && profileColor.startsWith('#')) return profileColor;
  return '#8b939e';
}

/**
 * Per-leaf shutter profiles (mullions + rails) so bi-fold reads as separate leaves, plus a light V-hint overlay.
 */
export const FoldDoorOpeningGraphic: React.FC<{
  leaves: number;
  variant?: Variant;
  /** Series profile colour — used for leaf frame strokes (matches outer frame). */
  profileColor?: string;
}> = ({ leaves, variant = 'canvas', profileColor }) => {
  const n = clampFoldLeafCount(leaves);
  if (n <= 1) return null;

  const bc = borderColorFromProfile(profileColor);
  const stroke = variant === 'print' ? 'rgba(0,0,0,0.5)' : 'rgba(255,255,255,0.65)';
  const labelFill = variant === 'print' ? 'rgba(0,0,0,0.78)' : 'rgba(255,255,255,0.9)';

  return (
    <div className="absolute inset-0 z-[5] flex flex-col pointer-events-none overflow-hidden">
      {/* Per-leaf outer frame (plan-style): distinct vertical stiles between shutters */}
      <div className="relative flex min-h-0 flex-1 w-full">
        {Array.from({ length: n }, (_, k) => (
          <div
            key={`leaf-${k}`}
            className="min-w-0 flex-1 box-border"
            style={{
              borderTop: `2px solid ${bc}`,
              borderBottom: `2px solid ${bc}`,
              borderLeft: k === 0 ? `4px solid ${bc}` : 'none',
              borderRight: `4px solid ${bc}`,
              boxShadow: variant === 'canvas' ? 'inset 0 0 0 1px rgba(0,0,0,0.12)' : 'inset 0 0 0 1px rgba(0,0,0,0.08)',
              background:
                variant === 'canvas'
                  ? 'linear-gradient(180deg, rgba(255,255,255,0.07) 0%, rgba(255,255,255,0.02) 50%, rgba(0,0,0,0.04) 100%)'
                  : 'linear-gradient(180deg, rgba(0,0,0,0.04) 0%, transparent 45%, rgba(0,0,0,0.03) 100%)',
            }}
          />
        ))}
      </div>

      {/* Subtle open-fold hint (bent seams) — no filled bands, avoids “X” artefacts */}
      <svg
        className="pointer-events-none absolute inset-0 h-full w-full"
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        aria-hidden
      >
        {Array.from({ length: n - 1 }, (_, k) => {
          const x0 = ((k + 1) / n) * 100;
          const xm = x0 - (x0 - 50) * 0.2;
          return (
            <path
              key={`seam-${k}`}
              d={`M ${x0} 2 L ${xm} 50 L ${x0} 98`}
              stroke={stroke}
              strokeWidth={variant === 'print' ? 0.55 : 0.5}
              vectorEffect="nonScalingStroke"
              fill="none"
              opacity={0.55}
            />
          );
        })}
      </svg>

      <div
        className="pointer-events-none absolute bottom-1 left-0 right-0 z-[6] text-center text-[9px] font-bold leading-none drop-shadow-sm"
        style={{ color: labelFill }}
      >
        {n} shutters
      </div>
    </div>
  );
};
