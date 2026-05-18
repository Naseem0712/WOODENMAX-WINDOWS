import React from 'react';

type Variant = 'sliding' | 'casement' | 'mesh_touch';

/** Renders ~28% larger on screen without changing mm semantics (length still drives proportions). */
const HANDLE_SCREEN_SCALE = 1.3;

/** Showroom-style matte charcoal plate — independent of frame colour so hardware stays legible. */
function mattePlateStops(print: boolean) {
  if (print) {
    return (
      <>
        <stop offset="0%" stopColor="#4b5563" />
        <stop offset="100%" stopColor="#111827" />
      </>
    );
  }
  return (
    <>
      <stop offset="0%" stopColor="#525865" />
      <stop offset="22%" stopColor="#383d47" />
      <stop offset="55%" stopColor="#252830" />
      <stop offset="100%" stopColor="#12151a" />
    </>
  );
}

function leverMetalStops(print: boolean) {
  if (print) {
    return (
      <>
        <stop offset="0%" stopColor="#6b7280" />
        <stop offset="100%" stopColor="#1f2937" />
      </>
    );
  }
  return (
    <>
      <stop offset="0%" stopColor="#787f8c" />
      <stop offset="35%" stopColor="#454b56" />
      <stop offset="72%" stopColor="#2a2f38" />
      <stop offset="100%" stopColor="#15171c" />
    </>
  );
}

/** Brushed nickel / chrome euro cylinder */
function euroCylinderStops(print: boolean) {
  if (print) {
    return (
      <>
        <stop offset="0%" stopColor="#d1d5db" />
        <stop offset="100%" stopColor="#6b7280" />
      </>
    );
  }
  return (
    <>
      <stop offset="0%" stopColor="#f3f4f6" />
      <stop offset="25%" stopColor="#c5cad3" />
      <stop offset="55%" stopColor="#8b929e" />
      <stop offset="82%" stopColor="#5c6370" />
      <stop offset="100%" stopColor="#3d424c" />
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
 * Glass / casement: slim matte vertical plate + horizontal lever + euro cylinder (mortice style).
 * Sliding (pull bar): elongated recessed flush pull + integrated latch hint.
 * Mesh: compact recessed touch-lock plate with thumb pad.
 */
export const WindowHandleVisual: React.FC<WindowHandleVisualProps> = ({ variant, lenMm, color, gid, scale, print = false, mirrored = false }) => {
  const id = (s: string) => `${gid}-${s}`;
  const px = (mm: number) => mm * scale * HANDLE_SCREEN_SCALE;

  // color kept for API compat; hardware uses fixed matte finishes like catalogue samples.
  void color;

  if (variant === 'mesh_touch') {
    const w = 40;
    const h = Math.max(lenMm, 52);
    const inset = 5;
    return (
      <div
        className="pointer-events-none"
        style={{
          width: px(w),
          height: px(h),
          position: 'relative',
          filter: print ? undefined : 'drop-shadow(1px 3px 6px rgba(0,0,0,0.5))',
          transform: mirrored ? 'scaleX(-1)' : undefined,
          transformOrigin: 'center center',
        }}
      >
        <svg width="100%" height="100%" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" aria-hidden>
          <defs>
            <linearGradient id={id('mtp')} x1="0" y1="0" x2="0" y2="1">
              {mattePlateStops(print)}
            </linearGradient>
            <linearGradient id={id('mtd')} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={print ? '#374151' : '#2d323b'} />
              <stop offset="100%" stopColor={print ? '#111827' : '#0c0e12'} />
            </linearGradient>
            <linearGradient id={id('touch')} x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor={print ? '#9ca3af' : '#aeb4bf'} />
              <stop offset="100%" stopColor={print ? '#4b5563' : '#5c6372'} />
            </linearGradient>
          </defs>
          <rect x="3" y="3" width={w - 6} height={h - 6} rx="6" fill={`url(#${id('mtp')})`} stroke="#07080a" strokeWidth="0.55" />
          <rect
            x={3 + inset}
            y={3 + inset}
            width={w - 6 - 2 * inset}
            height={h - 6 - 2 * inset}
            rx="4"
            fill={`url(#${id('mtd')})`}
            stroke="rgba(255,255,255,0.06)"
            strokeWidth="0.35"
          />
          {/* Finger pocket lip */}
          <path
            d={`M ${8} ${10} Q ${w / 2} ${14} ${w - 8} ${10}`}
            fill="none"
            stroke="rgba(0,0,0,0.35)"
            strokeWidth="0.6"
          />
          {/* Touch thumb pad */}
          <ellipse cx={w / 2} cy={h * 0.42} rx="11" ry="7" fill={`url(#${id('touch')})`} stroke="#1a1d22" strokeWidth="0.45" />
          <ellipse cx={w / 2 - 3} cy={h * 0.40} rx="4" ry="3" fill="rgba(255,255,255,0.14)" />
          {/* Slider latch hint */}
          <rect x={w / 2 - 5} y={h * 0.58} width="10" height="3.5" rx="1.6" fill="#2a2f38" stroke="#0f1114" strokeWidth="0.35" />
          <circle cx={w / 2 + 2} cy={h * 0.58 + 1.75} r="1.8" fill="#4b5563" />
          {/* Key cylinder */}
          <circle cx={w - 13} cy={h - 14} r="3.2" fill="#1a1d22" stroke="#374151" strokeWidth="0.4" />
          <circle cx={w - 13} cy={h - 14} r="1.5" fill="#0c0e12" />
        </svg>
      </div>
    );
  }

  if (variant === 'sliding') {
    const barW = Math.max(lenMm, 52);
    const barH = 36;
    return (
      <div
        className="pointer-events-none"
        style={{
          width: px(barW),
          height: px(barH),
          position: 'relative',
          filter: print ? undefined : 'drop-shadow(1px 3px 6px rgba(0,0,0,0.48))',
          transform: mirrored ? 'scaleX(-1)' : undefined,
          transformOrigin: 'center center',
        }}
      >
        <svg width="100%" height="100%" viewBox={`0 0 ${barW} ${barH}`} preserveAspectRatio="none" aria-hidden>
          <defs>
            <linearGradient id={id('splate')} x1="0" y1="0" x2="0" y2="1">
              {mattePlateStops(print)}
            </linearGradient>
            <linearGradient id={id('sink')} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={print ? '#374151' : '#1f2430'} />
              <stop offset="100%" stopColor={print ? '#030712' : '#090b0f'} />
            </linearGradient>
          </defs>
          <rect x="2" y="4" width={barW - 4} height={barH - 8} rx="8" fill={`url(#${id('splate')})`} stroke="#050607" strokeWidth="0.55" />
          <rect x="8" y="10" width={barW - 16} height={barH - 20} rx="5" fill={`url(#${id('sink')})`} stroke="rgba(255,255,255,0.05)" strokeWidth="0.35" />
          {/* Thumb groove */}
          <rect x="12" y="13" width={barW - 24} height={barH - 26} rx="4" fill="none" stroke="rgba(0,0,0,0.35)" strokeWidth="0.45" />
          {/* Integrated thumb switch */}
          <ellipse cx={barW * 0.52} cy={barH / 2} rx="7" ry="5.5" fill="#353b46" stroke="#14161a" strokeWidth="0.4" />
          <ellipse cx={barW * 0.52 - 2} cy={barH / 2 - 1} rx="2.8" ry="2.2" fill="rgba(255,255,255,0.12)" />
          {/* End key */}
          <circle cx={barW - 11} cy={barH / 2 + 5} r="2.8" fill="#121418" stroke="#374151" strokeWidth="0.35" />
        </svg>
      </div>
    );
  }

  /* --- Casement / sliding glass: lever + mortice euro --- */
  const vbW = 32;
  const vbH = Math.max(lenMm, 120);
  const cx = vbW / 2;

  const plateTop = 5;
  const plateBot = vbH - 6;
  const plateH = plateBot - plateTop;

  const leverY = plateTop + Math.min(26, vbH * 0.14);
  const cylTop = plateTop + plateH * 0.52;
  const cylH = Math.min(22, plateH * 0.34);
  const stemTop = leverY + 7;
  const stemBot = Math.min(cylTop - 2, stemTop + Math.max(18, vbH * 0.22));

  const leverReach = Math.min(17, vbW - cx - 4);

  return (
    <div
      className="pointer-events-none"
      style={{
        width: px(vbW),
        height: px(vbH),
        position: 'relative',
        filter: print ? undefined : 'drop-shadow(2px 4px 8px rgba(0,0,0,0.48))',
        transform: mirrored ? 'scaleX(-1)' : undefined,
        transformOrigin: 'center center',
      }}
    >
      <svg width="100%" height="100%" viewBox={`0 0 ${vbW} ${vbH}`} preserveAspectRatio="none" aria-hidden>
        <defs>
          <linearGradient id={id('plate')} x1="0" y1="0" x2="1" y2="1">
            {mattePlateStops(print)}
          </linearGradient>
          <linearGradient id={id('lev')} x1="0" y1="0" x2="0" y2="1">
            {leverMetalStops(print)}
          </linearGradient>
          <linearGradient id={id('euro')} x1="0" y1="0" x2="1" y2="1">
            {euroCylinderStops(print)}
          </linearGradient>
        </defs>

        {/* Slim vertical backplate */}
        <rect x="7" y={plateTop} width="18" height={plateH} rx="4.5" fill={`url(#${id('plate')})`} stroke="#07080a" strokeWidth="0.55" />
        <rect x="9" y={plateTop + 2} width="14" height={plateH - 4} rx="3" fill="none" stroke="rgba(255,255,255,0.055)" strokeWidth="0.4" />

        {/* Horizontal cylindrical lever */}
        <rect x={cx - 1.5} y={leverY} width={leverReach + 1.5} height="7.5" rx="3.6" fill={`url(#${id('lev')})`} stroke="#0c0e12" strokeWidth="0.48" />
        <rect x={cx - 0.5} y={leverY + 1.2} width={leverReach - 1} height="2.6" rx="1.2" fill="rgba(255,255,255,0.16)" />

        {/* Stem */}
        <rect x={cx - 2} y={stemTop} width="4" height={Math.max(stemBot - stemTop, 4)} rx="1.8" fill={`url(#${id('lev')})`} stroke="#0c0e12" strokeWidth="0.38" />

        {/* Euro profile cylinder */}
        <rect x={cx - 6} y={cylTop} width="12" height={cylH} rx="2.4" fill={`url(#${id('euro')})`} stroke="#2f3540" strokeWidth="0.48" />
        <rect x={cx - 5} y={cylTop + 1} width="10" height={cylH * 0.35} rx="1.2" fill="rgba(255,255,255,0.2)" />
        <circle cx={cx} cy={cylTop + 6} r="2.8" fill="#0c0e12" opacity={print ? 1 : 0.92} />
        <rect x={cx - 2.4} y={cylTop + 7.5} width="4.8" height="9" rx="0.55" fill="#0c0e12" opacity={print ? 1 : 0.92} />
      </svg>
    </div>
  );
};
