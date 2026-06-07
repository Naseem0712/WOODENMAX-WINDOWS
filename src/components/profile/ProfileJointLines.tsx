import React from 'react';

export type ProfileJointVariant = 'canvas' | 'print';

const jointStroke = (variant: ProfileJointVariant) =>
  variant === 'print' ? 'rgba(15,23,42,0.42)' : 'rgba(15,23,42,0.38)';

const jointWidth = (variant: ProfileJointVariant) => (variant === 'print' ? 0.65 : 0.85);

type MiterProps = {
  widthPx: number;
  heightPx: number;
  topPx: number;
  bottomPx: number;
  leftPx: number;
  rightPx: number;
  variant?: ProfileJointVariant;
};

/** 45° miter seam lines at frame / shutter corners. */
export const MiterJointLines: React.FC<MiterProps> = ({
  widthPx,
  heightPx,
  topPx,
  bottomPx,
  leftPx,
  rightPx,
  variant = 'canvas',
}) => {
  const w = Math.max(0, widthPx);
  const h = Math.max(0, heightPx);
  const t = Math.max(0, topPx);
  const b = Math.max(0, bottomPx);
  const l = Math.max(0, leftPx);
  const r = Math.max(0, rightPx);
  if (w <= 0 || h <= 0) return null;

  const stroke = jointStroke(variant);
  const sw = jointWidth(variant);

  return (
    <svg
      className="pointer-events-none absolute left-0 top-0"
      width={w}
      height={h}
      viewBox={`0 0 ${w} ${h}`}
      aria-hidden
      style={{ zIndex: 20 }}
    >
      {/* Top-left 45° */}
      <line x1={0} y1={t} x2={l} y2={0} stroke={stroke} strokeWidth={sw} vectorEffect="non-scaling-stroke" />
      {/* Top-right 45° */}
      <line x1={w - r} y1={0} x2={w} y2={t} stroke={stroke} strokeWidth={sw} vectorEffect="non-scaling-stroke" />
      {/* Bottom-left 45° */}
      <line x1={0} y1={h - b} x2={l} y2={h} stroke={stroke} strokeWidth={sw} vectorEffect="non-scaling-stroke" />
      {/* Bottom-right 45° */}
      <line x1={w - r} y1={h} x2={w} y2={h - b} stroke={stroke} strokeWidth={sw} vectorEffect="non-scaling-stroke" />
    </svg>
  );
};

type ButtProps = {
  widthPx: number;
  heightPx: number;
  topPx: number;
  bottomPx: number;
  sidePx: number;
  side: 'left' | 'right';
  variant?: ProfileJointVariant;
};

/** 90° butt-joint outline on interlock / meeting stile. */
export const InterlockButtJointLines: React.FC<ButtProps> = ({
  widthPx,
  heightPx,
  topPx,
  bottomPx,
  sidePx,
  side,
  variant = 'canvas',
}) => {
  const w = Math.max(0, widthPx);
  const h = Math.max(0, heightPx);
  const t = Math.max(0, topPx);
  const b = Math.max(0, bottomPx);
  const s = Math.max(0, sidePx);
  if (w <= 0 || h <= 0 || s <= 0) return null;

  const y1 = t;
  const y2 = h - b;
  const stroke = jointStroke(variant);
  const sw = jointWidth(variant);

  const xOuter = side === 'left' ? 0 : w;
  const xInner = side === 'left' ? s : w - s;

  return (
    <svg
      className="pointer-events-none absolute left-0 top-0"
      width={w}
      height={h}
      viewBox={`0 0 ${w} ${h}`}
      aria-hidden
      style={{ zIndex: 21 }}
    >
      <line x1={xOuter} y1={y1} x2={xOuter} y2={y2} stroke={stroke} strokeWidth={sw} vectorEffect="non-scaling-stroke" />
      <line x1={xInner} y1={y1} x2={xInner} y2={y2} stroke={stroke} strokeWidth={sw} vectorEffect="non-scaling-stroke" />
      <line x1={xOuter} y1={y1} x2={xInner} y2={y1} stroke={stroke} strokeWidth={sw} vectorEffect="non-scaling-stroke" />
      <line x1={xOuter} y1={y2} x2={xInner} y2={y2} stroke={stroke} strokeWidth={sw} vectorEffect="non-scaling-stroke" />
    </svg>
  );
};

export const mullionEdgeStyle = (variant: ProfileJointVariant = 'canvas'): React.CSSProperties => ({
  boxShadow:
    variant === 'print'
      ? 'inset 0 0 0 1px rgba(0,0,0,0.22), 0 0 0 1px rgba(15,23,42,0.58)'
      : 'inset 0 0 0 1px rgba(0,0,0,0.18), 0 0 0 1px rgba(15,23,42,0.52)',
});
