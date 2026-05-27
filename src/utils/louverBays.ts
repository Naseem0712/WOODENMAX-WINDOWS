import type { LouverBayCrossAlign, ProfileDimensions, WindowConfig } from '../types';
import { WindowType } from '../types';

export const LOUVER_BAY_MAX = 5;

export type LouverBayRect = { x: number; y: number; width: number; height: number };

export type ResolvedLouverBay = {
  id: string;
  width: number;
  height: number;
  crossAlign?: LouverBayCrossAlign;
  offsetMm?: number;
};

/** Joint bays abut with no intermediate mullion/separator profile. */
export function getLouverBaySeparatorMm(_dims: ProfileDimensions): number {
  return 0;
}

function resolveOffsetMm(raw: number | '' | undefined): number | undefined {
  if (raw === '' || raw === undefined) return undefined;
  const n = Number(raw);
  return Number.isFinite(n) ? n : undefined;
}

/** Cross-axis start (mm) for a bay inside the outer inner rectangle. */
export function louverBayCrossAxisStart(
  crossInnerMm: number,
  bayCrossMm: number,
  crossAlign: LouverBayCrossAlign | undefined,
  offsetMm: number | undefined,
): number {
  const maxStart = Math.max(0, crossInnerMm - bayCrossMm);
  const off = resolveOffsetMm(offsetMm);
  if (off !== undefined) return Math.max(0, Math.min(off, maxStart));
  const align = crossAlign ?? 'center';
  if (align === 'top') return 0;
  if (align === 'bottom') return maxStart;
  return maxStart / 2;
}

/** Bays with positive width and height (mm). */
export function getValidLouverBays(config: WindowConfig): ResolvedLouverBay[] {
  const raw = config.louverBays ?? [];
  const out: ResolvedLouverBay[] = [];
  for (const b of raw) {
    const w = Number(b.width) || 0;
    const h = Number(b.height) || 0;
    if (w > 0 && h > 0) {
      out.push({
        id: b.id,
        width: w,
        height: h,
        crossAlign: b.crossAlign,
        offsetMm: resolveOffsetMm(b.offsetMm),
      });
    }
  }
  return out;
}

/**
 * When no explicit bay rows, treat the whole module as one opening (legacy).
 */
export function getEffectiveLouverBays(config: WindowConfig): ResolvedLouverBay[] {
  const fromRows = getValidLouverBays(config);
  if (fromRows.length > 0) return fromRows;
  const w = Number(config.width) || 0;
  const h = Number(config.height) || 0;
  if (w <= 0 || h <= 0) return [];
  return [{ id: '__legacy__', width: w, height: h }];
}

export function isCompoundLouverConfig(config: WindowConfig): boolean {
  return config.windowType === WindowType.LOUVERS && getValidLouverBays(config).length > 1;
}

/** Total opening area (mm²) for rate × area: louvers = sum of bays; other types = width × height. */
export function getWindowQuotationAreaMm2(config: WindowConfig): number {
  if (config.windowType !== WindowType.LOUVERS) {
    const w = Number(config.width) || 0;
    const h = Number(config.height) || 0;
    return w * h;
  }
  return getEffectiveLouverBays(config).reduce((s, b) => s + b.width * b.height, 0);
}

/** Blade/pin-style hardware count = sum of repeating pattern count over every bay (matches material logic). */
export function countLouverBladeProfiles(config: WindowConfig): number {
  if (config.windowType !== WindowType.LOUVERS) return 0;
  const pattern = config.louverPattern ?? [];
  const unitSize = pattern.reduce((sum, p) => sum + (Number(p.size) || 0), 0);
  if (unitSize <= 0) return 0;
  const orientation = config.orientation ?? 'vertical';
  let bladeCount = 0;
  for (const b of getEffectiveLouverBays(config)) {
    const totalDim = orientation === 'vertical' ? b.height : b.width;
    const numCompletePatterns = Math.floor(totalDim / unitSize);
    for (const p of pattern) {
      if (p.type === 'profile') bladeCount += numCompletePatterns;
    }
    const remaining = totalDim - numCompletePatterns * unitSize;
    let used = 0;
    for (const p of pattern) {
      if (used >= remaining) break;
      if (p.type === 'profile' && used + (Number(p.size) || 0) <= remaining + 0.0001) {
        bladeCount += 1;
      }
      used += Number(p.size) || 0;
    }
  }
  return bladeCount;
}

/**
 * Outer module size (mm) enclosing all bays + optional intermediate gaps.
 */
export function getLouverCompoundOuterMm(
  bays: { width: number; height: number }[],
  layout: 'vertical' | 'horizontal',
  separatorMm: number,
): { width: number; height: number } {
  if (bays.length === 0) return { width: 0, height: 0 };
  if (bays.length === 1) return { width: bays[0].width, height: bays[0].height };
  const sep = Math.max(0, separatorMm);
  const n = bays.length;
  const gapCount = n - 1;
  if (layout === 'vertical') {
    const W = Math.max(...bays.map((b) => b.width));
    const H = bays.reduce((s, b) => s + b.height, 0) + gapCount * sep;
    return { width: W, height: H };
  }
  const W = bays.reduce((s, b) => s + b.width, 0) + gapCount * sep;
  const H = Math.max(...bays.map((b) => b.height));
  return { width: W, height: H };
}

/**
 * Place each bay inside the inner rectangle. Bays abut on the primary axis; cross-axis position uses align/offset.
 */
export function layoutLouverBayRects(
  innerW: number,
  innerH: number,
  bays: ResolvedLouverBay[],
  layout: 'vertical' | 'horizontal',
  separatorMm: number,
): LouverBayRect[] {
  if (bays.length === 0 || innerW <= 0 || innerH <= 0) return [];
  const sep = Math.max(0, separatorMm);
  const rects: LouverBayRect[] = [];

  if (layout === 'vertical') {
    let y = 0;
    for (let i = 0; i < bays.length; i++) {
      const b = bays[i];
      const x = louverBayCrossAxisStart(innerW, b.width, b.crossAlign, b.offsetMm);
      rects.push({ x, y, width: b.width, height: b.height });
      y += b.height;
      if (i < bays.length - 1) y += sep;
    }
    return rects;
  }

  let x = 0;
  for (let i = 0; i < bays.length; i++) {
    const b = bays[i];
    const y = louverBayCrossAxisStart(innerH, b.height, b.crossAlign, b.offsetMm);
    rects.push({ x, y, width: b.width, height: b.height });
    x += b.width;
    if (i < bays.length - 1) x += sep;
  }
  return rects;
}
