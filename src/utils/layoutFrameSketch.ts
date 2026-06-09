import type { WindowConfig } from '../types';
import { WindowType } from '../types';
import type { LayoutUnitPlacement } from './designLayout';

const EPS = 0.5;

export function resolveLayoutOuterFrameMm(config: WindowConfig): number {
  const dims = config.series?.dimensions;
  if (!dims) return 50;
  const of = Number(dims.outerFrame) || Number(dims.outerFrameVertical) || 0;
  if (of > 0) return of;
  if (config.windowType === WindowType.GLASS_PARTITION) {
    return Number(dims.topTrack) || Number(dims.bottomTrack) || 40;
  }
  if (config.windowType === WindowType.LOUVERS) {
    return Number(dims.louverProfile) || 50;
  }
  return 50;
}

type Side = 'top' | 'right' | 'bottom' | 'left';

function overlap1d(a1: number, a2: number, b1: number, b2: number): number {
  return Math.max(0, Math.min(a2, b2) - Math.max(a1, b1));
}

function subtractIntervals(pieces: [number, number][], cut: [number, number]): [number, number][] {
  const out: [number, number][] = [];
  for (const [a, b] of pieces) {
    if (cut[1] <= a + EPS || cut[0] >= b - EPS) {
      out.push([a, b]);
      continue;
    }
    if (a < cut[0] - EPS) out.push([a, cut[0]]);
    if (b > cut[1] + EPS) out.push([cut[1], b]);
  }
  return out;
}

/** Shared interval on `side` of unit `u` with abutting neighbor. */
function sharedCutOnSide(
  u: LayoutUnitPlacement,
  other: LayoutUnitPlacement,
  side: Side,
): [number, number] | null {
  const { xMm: x, yMm: y, widthMm: w, heightMm: h } = u;
  const ox = other.xMm;
  const oy = other.yMm;
  const ow = other.widthMm;
  const oh = other.heightMm;

  if (side === 'right' && Math.abs(ox - (x + w)) <= EPS) {
    const o = overlap1d(y, y + h, oy, oy + oh);
    if (o > EPS) return [Math.max(y, oy), Math.min(y + h, oy + oh)];
  }
  if (side === 'left' && Math.abs(ox + ow - x) <= EPS) {
    const o = overlap1d(y, y + h, oy, oy + oh);
    if (o > EPS) return [Math.max(y, oy), Math.min(y + h, oy + oh)];
  }
  if (side === 'bottom' && Math.abs(oy - (y + h)) <= EPS) {
    const o = overlap1d(x, x + w, ox, ox + ow);
    if (o > EPS) return [Math.max(x, ox), Math.min(x + w, ox + ow)];
  }
  if (side === 'top' && Math.abs(oy + oh - y) <= EPS) {
    const o = overlap1d(x, x + w, ox, ox + ow);
    if (o > EPS) return [Math.max(x, ox), Math.min(x + w, ox + ow)];
  }
  return null;
}

function fullSideInterval(u: LayoutUnitPlacement, side: Side): [number, number] {
  const { xMm: x, yMm: y, widthMm: w, heightMm: h } = u;
  switch (side) {
    case 'top':
    case 'bottom':
      return [x, x + w];
    case 'left':
    case 'right':
      return [y, y + h];
  }
}

/** Exterior spans on one side — remaining segments after subtracting shared neighbor overlap. */
export function exteriorSideSpans(
  u: LayoutUnitPlacement,
  side: Side,
  units: LayoutUnitPlacement[],
): [number, number][] {
  let pieces: [number, number][] = [fullSideInterval(u, side)];

  for (const other of units) {
    if (other.id === u.id) continue;
    const cut = sharedCutOnSide(u, other, side);
    if (cut) pieces = subtractIntervals(pieces, cut);
  }

  return pieces.filter(([a, b]) => b - a > EPS);
}

export type FrameSketchSegment = {
  unitId: string;
  side: Side;
  outer: { x1: number; y1: number; x2: number; y2: number };
  inner: { x1: number; y1: number; x2: number; y2: number };
};

export function buildFrameSketchSegments(units: LayoutUnitPlacement[]): FrameSketchSegment[] {
  const segments: FrameSketchSegment[] = [];
  const sides: Side[] = ['top', 'right', 'bottom', 'left'];

  for (const u of units) {
    const f = resolveLayoutOuterFrameMm(u.config);
    const { xMm: x, yMm: y, widthMm: w, heightMm: h } = u;

    for (const side of sides) {
      const spans = exteriorSideSpans(u, side, units);
      for (const [a1, a2] of spans) {
        let outer: FrameSketchSegment['outer'];
        let inner: FrameSketchSegment['inner'];

        switch (side) {
          case 'top':
            outer = { x1: a1, y1: y, x2: a2, y2: y };
            inner = { x1: a1 + f, y1: y + f, x2: a2 - f, y2: y + f };
            break;
          case 'bottom':
            outer = { x1: a1, y1: y + h, x2: a2, y2: y + h };
            inner = { x1: a1 + f, y1: y + h - f, x2: a2 - f, y2: y + h - f };
            break;
          case 'left':
            outer = { x1: x, y1: a1, x2: x, y2: a2 };
            inner = { x1: x + f, y1: a1 + f, x2: x + f, y2: a2 - f };
            break;
          case 'right':
            outer = { x1: x + w, y1: a1, x2: x + w, y2: a2 };
            inner = { x1: x + w - f, y1: a1 + f, x2: x + w - f, y2: a2 - f };
            break;
        }

        segments.push({ unitId: u.id, side, outer, inner });
      }
    }
  }

  return segments;
}

export type SharedMullion = {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  vertical: boolean;
};

export function buildSharedMullions(units: LayoutUnitPlacement[]): SharedMullion[] {
  const mullions: SharedMullion[] = [];
  const seen = new Set<string>();

  for (let i = 0; i < units.length; i++) {
    for (let j = i + 1; j < units.length; j++) {
      const a = units[i];
      const b = units[j];
      const fA = resolveLayoutOuterFrameMm(a.config);
      const fB = resolveLayoutOuterFrameMm(b.config);
      const mull = Math.max((fA + fB) / 2, 20);

      const push = (m: SharedMullion) => {
        const key = `${m.x1.toFixed(1)},${m.y1.toFixed(1)},${m.x2.toFixed(1)},${m.y2.toFixed(1)}`;
        if (seen.has(key)) return;
        seen.add(key);
        mullions.push(m);
      };

      if (Math.abs(b.xMm - (a.xMm + a.widthMm)) <= EPS) {
        const y1 = Math.max(a.yMm, b.yMm);
        const y2 = Math.min(a.yMm + a.heightMm, b.yMm + b.heightMm);
        if (y2 - y1 > EPS) {
          const x = a.xMm + a.widthMm;
          push({ x1: x - mull / 2, y1, x2: x + mull / 2, y2, vertical: true });
        }
      }
      if (Math.abs(b.yMm - (a.yMm + a.heightMm)) <= EPS) {
        const x1 = Math.max(a.xMm, b.xMm);
        const x2 = Math.min(a.xMm + a.widthMm, b.xMm + b.widthMm);
        if (x2 - x1 > EPS) {
          const y = a.yMm + a.heightMm;
          push({ x1, y1: y - mull / 2, x2, y2: y + mull / 2, vertical: false });
        }
      }
    }
  }

  return mullions;
}

export function hasExteriorSide(u: LayoutUnitPlacement, side: Side, units: LayoutUnitPlacement[]): boolean {
  return exteriorSideSpans(u, side, units).length > 0;
}

export function glassInsetRect(
  u: LayoutUnitPlacement,
  units: LayoutUnitPlacement[],
): { x: number; y: number; w: number; h: number } {
  const f = resolveLayoutOuterFrameMm(u.config);
  const top = hasExteriorSide(u, 'top', units) ? f : 0;
  const bottom = hasExteriorSide(u, 'bottom', units) ? f : 0;
  const left = hasExteriorSide(u, 'left', units) ? f : 0;
  const right = hasExteriorSide(u, 'right', units) ? f : 0;

  return {
    x: u.xMm + left,
    y: u.yMm + top,
    w: Math.max(0, u.widthMm - left - right),
    h: Math.max(0, u.heightMm - top - bottom),
  };
}

/** Miter tick at frame corner (mm coords). */
export function miterCornerLines(
  x: number,
  y: number,
  w: number,
  h: number,
  f: number,
  corner: 'tl' | 'tr' | 'br' | 'bl',
): { x1: number; y1: number; x2: number; y2: number } {
  switch (corner) {
    case 'tl':
      return { x1: x, y1: y + f, x2: x + f, y2: y };
    case 'tr':
      return { x1: x + w - f, y1: y, x2: x + w, y2: y + f };
    case 'br':
      return { x1: x + w, y1: y + h - f, x2: x + w - f, y2: y + h };
    case 'bl':
      return { x1: x + f, y1: y + h, x2: x, y2: y + h - f };
  }
}
