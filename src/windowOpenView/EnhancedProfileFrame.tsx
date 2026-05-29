import React from 'react';
import type { OpenViewVariant } from './types';

type Props = {
  x: number;
  y: number;
  width: number;
  height: number;
  profileMm: number;
  scale: number;
  color: string;
  variant?: OpenViewVariant;
  /** Glass fill inside profile rebate */
  showGlass?: boolean;
};

/** Double-line profile with bevel hint — open-view module only (does not replace canvas frames). */
export const EnhancedProfileFrame: React.FC<Props> = ({
  x,
  y,
  width,
  height,
  profileMm,
  scale,
  color,
  variant = 'canvas',
  showGlass = true,
}) => {
  const p = Math.max(2, profileMm * scale);
  const stroke = variant === 'print' ? '#374151' : color;
  const innerStroke = variant === 'print' ? '#6b7280' : adjustHex(color, 0.15);
  const glassFill = variant === 'print' ? '#e2e8f0' : 'rgba(191,219,254,0.35)';

  if (width <= 0 || height <= 0) return null;

  return (
    <g className="wov-enhanced-frame">
      {/* Outer frame */}
      <rect x={x} y={y} width={width} height={height} fill="none" stroke={stroke} strokeWidth={Math.max(1.2, p * 0.35)} />
      {/* Inner rebate / bevel */}
      <rect
        x={x + p * 0.45}
        y={y + p * 0.45}
        width={Math.max(0, width - p * 0.9)}
        height={Math.max(0, height - p * 0.9)}
        fill="none"
        stroke={innerStroke}
        strokeWidth={Math.max(0.8, p * 0.22)}
        opacity={0.85}
      />
      {/* Glass */}
      {showGlass ? (
        <rect
          x={x + p}
          y={y + p}
          width={Math.max(0, width - 2 * p)}
          height={Math.max(0, height - 2 * p)}
          fill={glassFill}
          stroke={variant === 'print' ? '#94a3b8' : 'rgba(148,163,184,0.5)'}
          strokeWidth={0.5}
        />
      ) : null}
      {/* Top bevel highlight */}
      <line
        x1={x + p * 0.3}
        y1={y + p * 0.25}
        x2={x + width - p * 0.3}
        y2={y + p * 0.25}
        stroke={variant === 'print' ? '#9ca3af' : 'rgba(255,255,255,0.35)'}
        strokeWidth={Math.max(0.5, p * 0.12)}
      />
    </g>
  );
};

function adjustHex(hex: string, delta: number): string {
  if (!hex.startsWith('#')) return hex;
  const raw = hex.slice(1);
  const normalized = raw.length === 3 ? raw.split('').map((c) => c + c).join('') : raw;
  if (normalized.length !== 6) return hex;
  const n = Number.parseInt(normalized, 16);
  const shift = Math.round(255 * Math.min(1, Math.max(-1, delta)));
  const r = Math.min(255, Math.max(0, ((n >> 16) & 0xff) + shift));
  const g = Math.min(255, Math.max(0, ((n >> 8) & 0xff) + shift));
  const b = Math.min(255, Math.max(0, (n & 0xff) + shift));
  return `#${[r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('')}`;
}

/** Small section cross-section inset (Phase 3). */
export const ProfileSectionInset: React.FC<{ x: number; y: number; color: string; variant?: OpenViewVariant }> = ({
  x,
  y,
  color,
  variant = 'canvas',
}) => {
  const stroke = variant === 'print' ? '#374151' : color;
  return (
    <g transform={`translate(${x}, ${y})`} opacity={0.9}>
      <rect x={0} y={0} width={28} height={18} fill={variant === 'print' ? '#f8fafc' : 'rgba(15,23,42,0.6)'} stroke={stroke} strokeWidth={0.8} rx={1} />
      <path
        d="M 3 15 L 3 5 L 8 3 L 20 3 L 25 5 L 25 15 L 20 17 L 8 17 Z"
        fill="none"
        stroke={stroke}
        strokeWidth={0.7}
      />
      <path d="M 8 3 L 8 17 M 20 3 L 20 17" stroke={stroke} strokeWidth={0.4} opacity={0.6} />
      <text x={14} y={11} textAnchor="middle" fontSize={5} fill={variant === 'print' ? '#64748b' : '#94a3b8'}>
        section
      </text>
    </g>
  );
};
