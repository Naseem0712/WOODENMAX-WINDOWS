import React from 'react';

type Variant = 'sliding' | 'casement';

/** Renders ~28% larger on screen without changing mm semantics (length still drives proportions). */
const HANDLE_SCREEN_SCALE = 1.3;

function blendHex(hex: string, fallback: string): string {
  if (!hex?.startsWith('#') || hex.length < 7) return fallback;
  return hex;
}

function hexLuminance(hex: string): number {
  if (!hex.startsWith('#') || hex.length < 7) return 0.5;
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
}

/** Warm gold / brass profile colours — richer highlights than generic grey metal. */
function isGoldish(hex: string): boolean {
  if (!hex.startsWith('#') || hex.length < 7) return false;
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return r > 130 && g > 95 && b < 150 && r >= g * 0.85 && g > b;
}

function isDarkMetal(hex: string): boolean {
  return hexLuminance(hex) < 0.2;
}

/** Default brushed-aluminium style tube gradient. */
function metalStops(baseHex: string, print: boolean) {
  const b = blendHex(baseHex, '#8892a0');
  if (print) {
    return (
      <>
        <stop offset="0%" stopColor="#d4d7dc" />
        <stop offset="50%" stopColor="#8a9099" />
        <stop offset="100%" stopColor="#4a4f58" />
      </>
    );
  }
  return (
    <>
      <stop offset="0%" stopColor="#f0f2f5" />
      <stop offset="22%" stopColor="#d8dce3" />
      <stop offset="48%" stopColor={b} />
      <stop offset="72%" stopColor="#5c636e" />
      <stop offset="100%" stopColor="#2e3238" />
    </>
  );
}

/** Charcoal / gunmetal — light grey highlights so form stays readable (not a flat black hole). */
function metalStopsCharcoal(print: boolean) {
  if (print) {
    return (
      <>
        <stop offset="0%" stopColor="#9ca3af" />
        <stop offset="100%" stopColor="#374151" />
      </>
    );
  }
  return (
    <>
      <stop offset="0%" stopColor="#9ca3af" />
      <stop offset="18%" stopColor="#6b7280" />
      <stop offset="45%" stopColor="#3f4550" />
      <stop offset="72%" stopColor="#2a2d34" />
      <stop offset="100%" stopColor="#15171c" />
    </>
  );
}

/** Champion-style gold: warm yellow–amber with bright specular and deep shadow. */
function metalStopsGold(print: boolean) {
  if (print) {
    return (
      <>
        <stop offset="0%" stopColor="#e8d89a" />
        <stop offset="100%" stopColor="#8a7020" />
      </>
    );
  }
  return (
    <>
      <stop offset="0%" stopColor="#fff9e6" />
      <stop offset="12%" stopColor="#f5e6a8" />
      <stop offset="35%" stopColor="#e4bc4a" />
      <stop offset="58%" stopColor="#c9a02e" />
      <stop offset="82%" stopColor="#8b6914" />
      <stop offset="100%" stopColor="#4a3a0c" />
    </>
  );
}

function metalStopsAdaptive(baseHex: string, print: boolean) {
  if (print) return metalStops(baseHex, true);
  if (isGoldish(baseHex)) return metalStopsGold(false);
  if (isDarkMetal(baseHex)) return metalStopsCharcoal(false);
  return metalStops(baseHex, false);
}

function plateStopsAdaptive(baseHex: string, print: boolean) {
  if (print) {
    return (
      <>
        <stop offset="0%" stopColor="#c5c9d0" />
        <stop offset="100%" stopColor="#6d737e" />
      </>
    );
  }
  if (isGoldish(baseHex)) {
    return (
      <>
        <stop offset="0%" stopColor="#fff4d4" />
        <stop offset="30%" stopColor="#e8c86a" />
        <stop offset="70%" stopColor="#a67c1a" />
        <stop offset="100%" stopColor="#4a3508" />
      </>
    );
  }
  if (isDarkMetal(baseHex)) {
    return (
      <>
        <stop offset="0%" stopColor="#8b929e" />
        <stop offset="35%" stopColor="#4a515c" />
        <stop offset="100%" stopColor="#121418" />
      </>
    );
  }
  return metalStops(baseHex, false);
}

function roseStopsAdaptive(baseHex: string, print: boolean) {
  if (print) {
    return (
      <>
        <stop offset="0%" stopColor="#b8bcc4" />
        <stop offset="55%" stopColor="#8a9099" />
        <stop offset="100%" stopColor="#3a3f48" />
      </>
    );
  }
  if (isGoldish(baseHex)) {
    return (
      <>
        <stop offset="0%" stopColor="#fff8e8" />
        <stop offset="45%" stopColor="#deb84a" />
        <stop offset="100%" stopColor="#5c420a" />
      </>
    );
  }
  if (isDarkMetal(baseHex)) {
    return (
      <>
        <stop offset="0%" stopColor="#aeb4bf" />
        <stop offset="50%" stopColor="#4a5058" />
        <stop offset="100%" stopColor="#0e1014" />
      </>
    );
  }
  const b = blendHex(baseHex, '#8e96a3');
  return (
    <>
      <stop offset="0%" stopColor="#f5f6f8" />
      <stop offset="55%" stopColor={b} />
      <stop offset="100%" stopColor="#2a2e35" />
    </>
  );
}

export interface WindowHandleVisualProps {
  variant: Variant;
  lenMm: number;
  color: string;
  gid: string;
  scale: number;
  print?: boolean;
  /** Mirror horizontally (left vs right stile / opening direction). */
  mirrored?: boolean;
}

/**
 * Sliding: wide pull bar. Casement: modern lever — horizontal grip, vertical neck, oval rose + escutcheon (reference style).
 */
export const WindowHandleVisual: React.FC<WindowHandleVisualProps> = ({ variant, lenMm, color, gid, scale, print = false, mirrored = false }) => {
  const id = (s: string) => `${gid}-${s}`;
  const px = (mm: number) => mm * scale * HANDLE_SCREEN_SCALE;

  if (variant === 'sliding') {
    const h = 34;
    const w = Math.max(lenMm, 48);
    const tubeY = 11;
    const tubeH = 11;
    const capR = 6;
    return (
      <div
        className="pointer-events-none"
        style={{
          width: px(w),
          height: px(h),
          position: 'relative',
          filter: print ? undefined : 'drop-shadow(1px 3px 5px rgba(0,0,0,0.45))',
          transform: mirrored ? 'scaleX(-1)' : undefined,
          transformOrigin: 'center center',
        }}
      >
        <svg width="100%" height="100%" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" aria-hidden>
          <defs>
            <linearGradient id={id('tub')} x1="0" y1="0" x2="0" y2="1">
              {metalStopsAdaptive(color, print)}
            </linearGradient>
            <linearGradient id={id('cap')} x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor={print ? '#9a9ea6' : isGoldish(color) ? '#fff4cc' : isDarkMetal(color) ? '#8b929e' : '#e8eaee'} />
              <stop offset="50%" stopColor={blendHex(color, '#7a8290')} />
              <stop offset="100%" stopColor={print ? '#4a4e56' : '#3a3f48'} />
            </linearGradient>
          </defs>
          <circle cx={capR + 1} cy={tubeY + tubeH / 2} r={capR} fill={`url(#${id('cap')})`} stroke="#1a1d22" strokeWidth="0.45" />
          <circle cx={w - capR - 1} cy={tubeY + tubeH / 2} r={capR} fill={`url(#${id('cap')})`} stroke="#1a1d22" strokeWidth="0.45" />
          <rect x={capR + 1} y={tubeY} width={w - 2 * capR - 2} height={tubeH} fill={`url(#${id('tub')})`} stroke="#1a1d22" strokeWidth="0.5" />
          <rect x={capR + 2} y={tubeY + 1} width={w - 2 * capR - 4} height={tubeH * 0.32} rx="1.5" fill="rgba(255,255,255,0.22)" />
          {Array.from({ length: Math.floor((w - 32) / 12) }).map((_, i) => (
            <line
              key={i}
              x1={18 + i * 12}
              y1={tubeY + 1.5}
              x2={18 + i * 12}
              y2={tubeY + tubeH - 1.5}
              stroke="rgba(0,0,0,0.16)"
              strokeWidth="0.9"
            />
          ))}
        </svg>
      </div>
    );
  }

  const vbW = 58;
  const vbH = lenMm;
  const cx = 29;

  const leverCy = Math.max(vbH * 0.14, 14);
  const roseCy = vbH * 0.42;
  const roseRy = Math.min(22, vbH * 0.14);
  const roseRx = 12;
  const escCy = Math.min(vbH * 0.72, vbH - 18);
  const escRx = 8;
  const escRy = 11;

  const leverHalfH = 4;
  const leverY0 = leverCy - leverHalfH;
  const leverY1 = leverCy + leverHalfH;
  const roseTop = roseCy - roseRy;
  const neckX0 = cx - 3;
  const neckX1 = cx + 3;

  const leverLen = Math.min(26, vbW - cx - 4);
  const leverX1 = cx + leverLen;

  return (
    <div
      className="pointer-events-none"
      style={{
        width: px(vbW),
        height: px(vbH),
        position: 'relative',
        filter: print ? undefined : 'drop-shadow(2px 4px 7px rgba(0,0,0,0.42))',
        transform: mirrored ? 'scaleX(-1)' : undefined,
        transformOrigin: 'center center',
      }}
    >
      <svg width="100%" height="100%" viewBox={`0 0 ${vbW} ${vbH}`} preserveAspectRatio="none" aria-hidden>
        <defs>
          <linearGradient id={id('rose')} x1="0" y1="0" x2="1" y2="1">
            {roseStopsAdaptive(color, print)}
          </linearGradient>
          <linearGradient id={id('leverCyl')} x1="0" y1="0" x2="0" y2="1">
            {metalStopsAdaptive(color, print)}
          </linearGradient>
          <linearGradient id={id('neckCyl')} x1="0" y1="0" x2="1" y2="0">
            {metalStopsAdaptive(color, print)}
          </linearGradient>
          <linearGradient id={id('esc')} x1="0" y1="0" x2="0" y2="1">
            {plateStopsAdaptive(color, print)}
          </linearGradient>
        </defs>

        {/* Bottom: escutcheon + keyhole */}
        <ellipse cx={cx} cy={escCy} rx={escRx} ry={escRy} fill={`url(#${id('esc')})`} stroke="#14161a" strokeWidth="0.65" />
        <ellipse cx={cx} cy={escCy} rx={escRx - 1.2} ry={escRy - 1.2} fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth="0.5" />
        <circle cx={cx} cy={escCy - 3} r={2.3} fill="#0c0e12" opacity={print ? 1 : 0.92} />
        <rect x={cx - 2.2} y={escCy - 1} width={4.4} height={8} rx={0.6} fill="#0c0e12" opacity={print ? 1 : 0.92} />

        {/* Main rose (tall vertical oval plate) */}
        <ellipse cx={cx} cy={roseCy} rx={roseRx} ry={roseRy} fill={`url(#${id('rose')})`} stroke="#0e1014" strokeWidth="0.55" />
        <ellipse cx={cx - 3} cy={roseCy - 4} rx={4} ry={6} fill="rgba(255,255,255,0.2)" opacity="0.55" />

        {/* Vertical neck between rose and lever */}
        <rect
          x={neckX0}
          y={leverY1}
          width={neckX1 - neckX0}
          height={Math.max(roseTop - leverY1, 2)}
          rx={2.2}
          fill={`url(#${id('neckCyl')})`}
          stroke="#14161a"
          strokeWidth="0.45"
        />

        {/* Top: horizontal lever (straight cylinder, flat end) */}
        <rect
          x={cx}
          y={leverY0}
          width={leverX1 - cx}
          height={leverY1 - leverY0}
          rx={3}
          fill={`url(#${id('leverCyl')})`}
          stroke="#14161a"
          strokeWidth="0.55"
        />
        <rect x={cx + 1.2} y={leverY0 + 1} width={leverX1 - cx - 2.4} height={(leverY1 - leverY0) * 0.35} rx={1.2} fill="rgba(255,255,255,0.22)" />
        <line x1={leverX1 - 0.5} y1={leverY0 + 0.8} x2={leverX1 - 0.5} y2={leverY1 - 0.8} stroke="rgba(0,0,0,0.22)" strokeWidth="0.6" />
      </svg>
    </div>
  );
};
