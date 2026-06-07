import React from 'react';
import { subtractMmRanges } from '../../utils/casementGridMullions';

export type ProfileJointVariant = 'canvas' | 'print';

export const jointStroke = (variant: ProfileJointVariant) =>
  variant === 'print' ? 'rgba(15,23,42,0.62)' : 'rgba(15,23,42,0.58)';

/** Screen / print stroke width for profile CAD outlines (px, non-scaling). */
export const jointWidth = (variant: ProfileJointVariant) => (variant === 'print' ? 1.15 : 1.65);

export const jointInnerWidth = (variant: ProfileJointVariant) => jointWidth(variant) * 0.92;

/** Stroke width in mm for SVG viewBoxes that use millimetre coordinates. */
export const mmOutlineStrokeWidth = (variant: ProfileJointVariant, scale: number) =>
  Math.max(0.85, jointWidth(variant) / Math.max(scale, 0.01));

export const mmOutlineInnerStrokeWidth = (variant: ProfileJointVariant, scale: number) =>
  Math.max(0.75, jointInnerWidth(variant) / Math.max(scale, 0.01));

/** Crisp CAD strokes — geometricPrecision keeps 45° miters visible (crispEdges drops angled lines). */
export const outlineSvgProps = {
  shapeRendering: 'geometricPrecision' as const,
  overflow: 'visible' as const,
};

type MiterProps = {
  widthPx: number;
  heightPx: number;
  topPx: number;
  bottomPx: number;
  leftPx: number;
  rightPx: number;
  variant?: ProfileJointVariant;
};

/** When true, CSS border / profile fill already draws the outer perimeter — skip duplicate SVG outer rect. */
export type OutlineProps = MiterProps & {
  showOuter?: boolean;
  /** 45° corner seams — off when CSS border already draws the outer miter (avoids double lines). */
  showMiterCorners?: boolean;
  showInner?: boolean;
  /** Hide inner outline on edges covered by overlapping mullion / neighbour frame. */
  hideInnerEdges?: { top?: boolean; bottom?: boolean; left?: boolean; right?: boolean };
  /** 90° butt cut on interlock / meeting stile — skip 45° miter diagonals on those corners. */
  buttEdges?: { top?: boolean; bottom?: boolean; left?: boolean; right?: boolean };
  outlineZIndex?: number;
};

/** Inner + outer profile edges with 45° miter corner seams (frames, doors, shutters). */
export const MiteredProfileOutlines: React.FC<OutlineProps> = ({
  widthPx,
  heightPx,
  topPx,
  bottomPx,
  leftPx,
  rightPx,
  variant = 'canvas',
  showOuter = true,
  showMiterCorners = showOuter,
  showInner = true,
  hideInnerEdges,
  buttEdges,
  outlineZIndex = 20,
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
  const innerSw = jointInnerWidth(variant);
  const outerD = `M 0 0 L ${w} 0 L ${w} ${h} L 0 ${h} Z`;
  const hide = hideInnerEdges ?? {};
  const butt = buttEdges ?? {};

  return (
    <svg
      className="pointer-events-none absolute left-0 top-0"
      width={w}
      height={h}
      viewBox={`${-sw} ${-sw} ${w + sw * 2} ${h + sw * 2}`}
      aria-hidden
      style={{ zIndex: outlineZIndex, overflow: 'visible' }}
      {...outlineSvgProps}
    >
      {showOuter ? (
        <path d={outerD} fill="none" stroke={stroke} strokeWidth={sw} strokeLinecap="butt" strokeLinejoin="miter" vectorEffect="non-scaling-stroke" />
      ) : null}
      {showInner && !hide.top && t > 0 ? (
        <line x1={l} y1={t} x2={w - r} y2={t} stroke={stroke} strokeWidth={innerSw} strokeLinecap="butt" vectorEffect="non-scaling-stroke" />
      ) : null}
      {showInner && !hide.right && r > 0 ? (
        <line x1={w - r} y1={t} x2={w - r} y2={h - b} stroke={stroke} strokeWidth={innerSw} strokeLinecap="butt" vectorEffect="non-scaling-stroke" />
      ) : null}
      {showInner && !hide.bottom && b > 0 ? (
        <line x1={w - r} y1={h - b} x2={l} y2={h - b} stroke={stroke} strokeWidth={innerSw} strokeLinecap="butt" vectorEffect="non-scaling-stroke" />
      ) : null}
      {showInner && !hide.left && l > 0 ? (
        <line x1={l} y1={h - b} x2={l} y2={t} stroke={stroke} strokeWidth={innerSw} strokeLinecap="butt" vectorEffect="non-scaling-stroke" />
      ) : null}
      {showMiterCorners && t > 0 && l > 0 && !butt.left ? (
        <line x1={0} y1={0} x2={l} y2={t} stroke={stroke} strokeWidth={sw} strokeLinecap="butt" vectorEffect="non-scaling-stroke" />
      ) : null}
      {showMiterCorners && t > 0 && r > 0 && !butt.right ? (
        <line x1={w} y1={0} x2={w - r} y2={t} stroke={stroke} strokeWidth={sw} strokeLinecap="butt" vectorEffect="non-scaling-stroke" />
      ) : null}
      {showMiterCorners && b > 0 && l > 0 && !butt.left ? (
        <line x1={0} y1={h} x2={l} y2={h - b} stroke={stroke} strokeWidth={sw} strokeLinecap="butt" vectorEffect="non-scaling-stroke" />
      ) : null}
      {showMiterCorners && b > 0 && r > 0 && !butt.right ? (
        <line x1={w} y1={h} x2={w - r} y2={h - b} stroke={stroke} strokeWidth={sw} strokeLinecap="butt" vectorEffect="non-scaling-stroke" />
      ) : null}
    </svg>
  );
};

/** Segmented opening inner outline — skips spans covered by overlapping doors (casement / ventilator). */
export const OpeningInnerOutlineSegments: React.FC<{
  innerW: number;
  innerH: number;
  hideRanges: {
    left: Array<[number, number]>;
    right: Array<[number, number]>;
    top: Array<[number, number]>;
    bottom: Array<[number, number]>;
  };
  scale: number;
  variant?: ProfileJointVariant;
}> = ({ innerW, innerH, hideRanges, scale, variant = 'canvas' }) => {
  const wPx = Math.max(0, innerW * scale);
  const hPx = Math.max(0, innerH * scale);
  if (wPx <= 0 || hPx <= 0) return null;

  const stroke = jointStroke(variant);
  const sw = jointInnerWidth(variant);

  const leftSegs = subtractMmRanges(0, innerH, hideRanges.left);
  const rightSegs = subtractMmRanges(0, innerH, hideRanges.right);
  const topSegs = subtractMmRanges(0, innerW, hideRanges.top);
  const bottomSegs = subtractMmRanges(0, innerW, hideRanges.bottom);

  const lines: React.ReactNode[] = [];
  for (const [y0, y1] of leftSegs) {
    lines.push(
      <line
        key={`l-${y0}-${y1}`}
        x1={0}
        y1={y0 * scale}
        x2={0}
        y2={y1 * scale}
        stroke={stroke}
        strokeWidth={sw}
        strokeLinecap="butt"
        vectorEffect="non-scaling-stroke"
      />,
    );
  }
  for (const [y0, y1] of rightSegs) {
    lines.push(
      <line
        key={`r-${y0}-${y1}`}
        x1={wPx}
        y1={y0 * scale}
        x2={wPx}
        y2={y1 * scale}
        stroke={stroke}
        strokeWidth={sw}
        strokeLinecap="butt"
        vectorEffect="non-scaling-stroke"
      />,
    );
  }
  for (const [x0, x1] of topSegs) {
    lines.push(
      <line
        key={`t-${x0}-${x1}`}
        x1={x0 * scale}
        y1={0}
        x2={x1 * scale}
        y2={0}
        stroke={stroke}
        strokeWidth={sw}
        strokeLinecap="butt"
        vectorEffect="non-scaling-stroke"
      />,
    );
  }
  for (const [x0, x1] of bottomSegs) {
    lines.push(
      <line
        key={`b-${x0}-${x1}`}
        x1={x0 * scale}
        y1={hPx}
        x2={x1 * scale}
        y2={hPx}
        stroke={stroke}
        strokeWidth={sw}
        strokeLinecap="butt"
        vectorEffect="non-scaling-stroke"
      />,
    );
  }

  if (lines.length === 0) return null;

  return (
    <svg
      className="pointer-events-none absolute left-0 top-0"
      width={wPx}
      height={hPx}
      viewBox={`0 0 ${wPx} ${hPx}`}
      aria-hidden
      style={{ zIndex: 6 }}
      {...outlineSvgProps}
    >
      {lines}
    </svg>
  );
};

/** Sliding track band — outer edge only (no inner line toward shutters). */
export const SlidingTrackOuterOutline: React.FC<{
  widthPx: number;
  heightPx: number;
  edge: 'top' | 'bottom';
  variant?: ProfileJointVariant;
}> = ({ widthPx, heightPx, edge, variant = 'canvas' }) => {
  const w = Math.max(0, widthPx);
  const h = Math.max(0, heightPx);
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
      style={{ zIndex: 4 }}
    >
      <line x1={0} y1={0} x2={0} y2={h} stroke={stroke} strokeWidth={sw} vectorEffect="non-scaling-stroke" />
      <line x1={w} y1={0} x2={w} y2={h} stroke={stroke} strokeWidth={sw} vectorEffect="non-scaling-stroke" />
      {edge === 'top' ? (
        <line x1={0} y1={0} x2={w} y2={0} stroke={stroke} strokeWidth={sw} vectorEffect="non-scaling-stroke" />
      ) : (
        <line x1={0} y1={h} x2={w} y2={h} stroke={stroke} strokeWidth={sw} vectorEffect="non-scaling-stroke" />
      )}
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
      {/* Straight 90° vertical seams only — no horizontal caps (avoids misaligned T-joints between adjacent shutters). */}
      <line x1={xMeet} y1={y1} x2={xMeet} y2={y2} stroke={stroke} strokeWidth={sw} vectorEffect="non-scaling-stroke" />
      <line x1={xInner} y1={y1} x2={xInner} y2={y2} stroke={stroke} strokeWidth={jointInnerWidth(variant)} vectorEffect="non-scaling-stroke" />
    </svg>
  );
};

type MullionProps = {
  widthPx: number;
  heightPx: number;
  orientation: 'horizontal' | 'vertical';
  variant?: ProfileJointVariant;
  hideLeftEdge?: boolean;
  hideRightEdge?: boolean;
  hideTopEdge?: boolean;
  hideBottomEdge?: boolean;
  /** Shorten horizontal top/bottom caps from the left (px). */
  leftEndInsetPx?: number;
  /** Shorten horizontal top/bottom caps from the right (px). */
  rightEndInsetPx?: number;
  /** Shorten vertical edges from bottom (px) — avoids T-joint clash with outer frame sill line. */
  bottomInsetPx?: number;
  /** Shorten vertical edges from top (px). */
  topInsetPx?: number;
};

/** 90° outline on grid mullion (visible between casement doors). */
export const MullionJointLines: React.FC<MullionProps> = ({
  widthPx,
  heightPx,
  orientation,
  variant = 'canvas',
  hideLeftEdge = false,
  hideRightEdge = false,
  hideTopEdge = false,
  hideBottomEdge = false,
  leftEndInsetPx = 0,
  rightEndInsetPx = 0,
  bottomInsetPx = 0,
  topInsetPx = 0,
}) => {
  const w = Math.max(0, widthPx);
  const h = Math.max(0, heightPx);
  if (w <= 0 || h <= 0) return null;

  const stroke = jointStroke(variant);
  const sw = jointWidth(variant);
  const y1 = Math.min(h, Math.max(0, topInsetPx));
  const y2 = Math.max(y1, h - Math.max(0, bottomInsetPx));
  const xL = Math.min(w, Math.max(0, leftEndInsetPx));
  const xR = Math.max(xL, w - Math.max(0, rightEndInsetPx));

  if (orientation === 'vertical') {
    return (
      <svg
        className="pointer-events-none absolute left-0 top-0"
        width={w}
        height={h}
        viewBox={`0 0 ${w} ${h}`}
        aria-hidden
        style={{ zIndex: 22 }}
        {...outlineSvgProps}
      >
        {!hideLeftEdge ? (
          <line x1={0} y1={y1} x2={0} y2={y2} stroke={stroke} strokeWidth={sw} strokeLinecap="butt" vectorEffect="non-scaling-stroke" />
        ) : null}
        {!hideRightEdge ? (
          <line x1={w} y1={y1} x2={w} y2={y2} stroke={stroke} strokeWidth={sw} strokeLinecap="butt" vectorEffect="non-scaling-stroke" />
        ) : null}
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
      {...outlineSvgProps}
    >
      {!hideTopEdge ? (
        <line x1={xL} y1={0} x2={xR} y2={0} stroke={stroke} strokeWidth={sw} strokeLinecap="butt" vectorEffect="non-scaling-stroke" />
      ) : null}
      {!hideBottomEdge ? (
        <line x1={xL} y1={h} x2={xR} y2={h} stroke={stroke} strokeWidth={sw} strokeLinecap="butt" vectorEffect="non-scaling-stroke" />
      ) : null}
    </svg>
  );
};

/** Mullion fill only — CAD edges come from MullionJointLines (single source, no double box-shadow). */
export const mullionEdgeStyle = (_variant: ProfileJointVariant = 'canvas'): React.CSSProperties => ({});
