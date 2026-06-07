import React from 'react';

export type ProfileJointVariant = 'canvas' | 'print';

const jointStroke = (variant: ProfileJointVariant) =>
  variant === 'print' ? 'rgba(15,23,42,0.55)' : 'rgba(15,23,42,0.48)';

const jointWidth = (variant: ProfileJointVariant) => (variant === 'print' ? 0.7 : 1);

type MiterProps = {
  widthPx: number;
  heightPx: number;
  topPx: number;
  bottomPx: number;
  leftPx: number;
  rightPx: number;
  variant?: ProfileJointVariant;
};

/**
 * 45° miter cut seam at each corner — diagonal through the profile thickness square
 * (outer corner → inner miter point), matching real frame fabrication.
 */
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
  if (w <= 0 || h <= 0 || (t <= 0 && b <= 0 && l <= 0 && r <= 0)) return null;

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
      {t > 0 && l > 0 ? (
        <line x1={0} y1={0} x2={l} y2={t} stroke={stroke} strokeWidth={sw} vectorEffect="non-scaling-stroke" />
      ) : null}
      {t > 0 && r > 0 ? (
        <line x1={w} y1={0} x2={w - r} y2={t} stroke={stroke} strokeWidth={sw} vectorEffect="non-scaling-stroke" />
      ) : null}
      {b > 0 && l > 0 ? (
        <line x1={0} y1={h} x2={l} y2={h - b} stroke={stroke} strokeWidth={sw} vectorEffect="non-scaling-stroke" />
      ) : null}
      {b > 0 && r > 0 ? (
        <line x1={w} y1={h} x2={w - r} y2={h - b} stroke={stroke} strokeWidth={sw} vectorEffect="non-scaling-stroke" />
      ) : null}
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

/**
 * 90° butt joints on interlock / meeting stile — vertical meeting seam plus
 * horizontal T-joints where stile meets head and sill (not 45°).
 */
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
  if (y2 <= y1) return null;

  const stroke = jointStroke(variant);
  const sw = jointWidth(variant);

  const xMeet = side === 'left' ? 0 : w;
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
      {/* Vertical meeting seam (90° butt) */}
      <line x1={xMeet} y1={y1} x2={xMeet} y2={y2} stroke={stroke} strokeWidth={sw} vectorEffect="non-scaling-stroke" />
      <line x1={xInner} y1={y1} x2={xInner} y2={y2} stroke={stroke} strokeWidth={sw * 0.85} vectorEffect="non-scaling-stroke" opacity={0.75} />
      {/* 90° T-joints at head / sill */}
      <line x1={xMeet} y1={y1} x2={xInner} y2={y1} stroke={stroke} strokeWidth={sw * 0.9} vectorEffect="non-scaling-stroke" />
      <line x1={xMeet} y1={y2} x2={xInner} y2={y2} stroke={stroke} strokeWidth={sw * 0.9} vectorEffect="non-scaling-stroke" />
    </svg>
  );
};

type MullionProps = {
  widthPx: number;
  heightPx: number;
  orientation: 'horizontal' | 'vertical';
  variant?: ProfileJointVariant;
};

/** 90° outline on grid mullion (visible between casement doors). */
export const MullionJointLines: React.FC<MullionProps> = ({
  widthPx,
  heightPx,
  orientation,
  variant = 'canvas',
}) => {
  const w = Math.max(0, widthPx);
  const h = Math.max(0, heightPx);
  if (w <= 0 || h <= 0) return null;

  const stroke = jointStroke(variant);
  const sw = jointWidth(variant);

  if (orientation === 'vertical') {
    return (
      <svg
        className="pointer-events-none absolute left-0 top-0"
        width={w}
        height={h}
        viewBox={`0 0 ${w} ${h}`}
        aria-hidden
        style={{ zIndex: 22 }}
      >
        <line x1={0} y1={0} x2={0} y2={h} stroke={stroke} strokeWidth={sw} vectorEffect="non-scaling-stroke" />
        <line x1={w} y1={0} x2={w} y2={h} stroke={stroke} strokeWidth={sw} vectorEffect="non-scaling-stroke" />
        <line x1={0} y1={0} x2={w} y2={0} stroke={stroke} strokeWidth={sw * 0.85} vectorEffect="non-scaling-stroke" opacity={0.7} />
        <line x1={0} y1={h} x2={w} y2={h} stroke={stroke} strokeWidth={sw * 0.85} vectorEffect="non-scaling-stroke" opacity={0.7} />
      </svg>
    );
  }

  return (
    <svg
      className="pointer-events-none absolute left-0 top-0"
      width={w}
      height={h}
      viewBox={`0 0 ${w} ${h}`}
      aria-hidden
      style={{ zIndex: 22 }}
    >
      <line x1={0} y1={0} x2={w} y2={0} stroke={stroke} strokeWidth={sw} vectorEffect="non-scaling-stroke" />
      <line x1={0} y1={h} x2={w} y2={h} stroke={stroke} strokeWidth={sw} vectorEffect="non-scaling-stroke" />
    </svg>
  );
};

export const mullionEdgeStyle = (variant: ProfileJointVariant = 'canvas'): React.CSSProperties => ({
  boxShadow:
    variant === 'print'
      ? 'inset 0 0 0 1px rgba(0,0,0,0.22), 0 0 0 1px rgba(15,23,42,0.58)'
      : 'inset 0 0 0 1px rgba(0,0,0,0.18), 0 0 0 1px rgba(15,23,42,0.52)',
});
