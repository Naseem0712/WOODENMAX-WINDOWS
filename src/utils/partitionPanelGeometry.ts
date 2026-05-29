import type { PartitionPanelConfig, PartitionPanelType } from '../types';

export const PARTITION_PANEL_GAP_MM = 5;

export function isOperablePartitionType(t: PartitionPanelType): boolean {
  return t === 'sliding' || t === 'hinged' || t === 'fold';
}

/** Gaps between adjacent operable panels (sliding / hinged / fold). */
export function countPartitionGaps(types: PartitionPanelConfig[]): number {
  return types.slice(0, -1).reduce((acc, current, index) => {
    const next = types[index + 1];
    if (!next) return acc;
    if (
      isOperablePartitionType(current.type) &&
      isOperablePartitionType(next.type)
    ) {
      return acc + 1;
    }
    return acc;
  }, 0);
}

function defaultFractions(count: number, widthFractions?: number[]): number[] {
  if (widthFractions && widthFractions.length === count) {
    return widthFractions.map((x) => Math.max(0.0001, x));
  }
  return Array.from({ length: count }, () => 1 / count);
}

/**
 * Width of each panel in mm. Supports optional per-panel `widthMm`; remaining width is split
 * among panels without explicit width using `widthFractions`.
 */
export function getPartitionPanelWidthsMm(
  innerAreaWidth: number,
  count: number,
  types: PartitionPanelConfig[],
  widthFractions?: number[]
): number[] {
  const numGaps = countPartitionGaps(types);
  const available = Math.max(0, innerAreaWidth - numGaps * PARTITION_PANEL_GAP_MM);

  const hasExplicit: boolean[] = [];
  const explicitVal: number[] = [];
  for (let i = 0; i < count; i++) {
    const raw = types[i]?.widthMm;
    if (raw === '' || raw === undefined || raw === null) {
      hasExplicit.push(false);
      explicitVal.push(0);
    } else {
      const n = Number(raw);
      if (Number.isFinite(n) && n > 0) {
        hasExplicit.push(true);
        explicitVal.push(n);
      } else {
        hasExplicit.push(false);
        explicitVal.push(0);
      }
    }
  }

  let sumExplicit = 0;
  for (let i = 0; i < count; i++) {
    if (hasExplicit[i]) sumExplicit += explicitVal[i];
  }

  const implicitIdx: number[] = [];
  for (let i = 0; i < count; i++) {
    if (!hasExplicit[i]) implicitIdx.push(i);
  }

  const fr = defaultFractions(count, widthFractions);

  if (implicitIdx.length === 0) {
    if (sumExplicit <= 0) {
      const w = available / Math.max(1, count);
      return Array.from({ length: count }, () => w);
    }
    if (sumExplicit > available) {
      const scale = available / sumExplicit;
      return explicitVal.map((w, i) => (hasExplicit[i] ? w * scale : 0));
    }
    const extra = available - sumExplicit;
    const out = explicitVal.map((w, i) => (hasExplicit[i] ? w : 0));
    out[count - 1] += extra;
    return out;
  }

  let remaining = available - sumExplicit;
  if (remaining < 0) {
    const scale = available / Math.max(sumExplicit, 0.0001);
    sumExplicit = 0;
    for (let i = 0; i < count; i++) {
      if (hasExplicit[i]) {
        explicitVal[i] *= scale;
        sumExplicit += explicitVal[i];
      }
    }
    remaining = available - sumExplicit;
  }

  const sumFrImpl = implicitIdx.reduce((a, i) => a + Math.max(0.0001, fr[i] ?? 1), 0);
  const out: number[] = [];
  for (let i = 0; i < count; i++) {
    if (hasExplicit[i]) {
      out.push(explicitVal[i]);
    } else {
      out.push((Math.max(0.0001, fr[i] ?? 1) / sumFrImpl) * remaining);
    }
  }
  return out;
}

/** Equal leaf width for n+1 fold+slide and n+n centre-opening layouts. */
export function getEqualDoorPartitionWidthsMm(
  innerAreaWidth: number,
  count: number,
  types: PartitionPanelConfig[],
): number[] | null {
  const hasFold = types.some((t) => t?.type === 'fold');
  const hasSlide = types.some((t) => t?.type === 'sliding');
  const foldIndices = types.map((t, i) => (t?.type === 'fold' ? i : -1)).filter((i) => i >= 0);
  const isCenterOpening = foldIndices.length === 2 && !hasSlide;
  const isFoldSlideCombo = hasFold && hasSlide && count === 2;

  if (!isCenterOpening && !isFoldSlideCombo) return null;

  const numGaps = countPartitionGaps(types);
  const available = Math.max(0, innerAreaWidth - numGaps * PARTITION_PANEL_GAP_MM);
  const widths = Array.from({ length: count }, () => 0);

  if (isFoldSlideCombo) {
    const foldIdx = foldIndices[0];
    const slideIdx = types.findIndex((t) => t?.type === 'sliding');
    if (foldIdx < 0 || slideIdx < 0) return null;
    const foldLeaves = clampFoldLeafCount(types[foldIdx]?.foldLeafCount);
    const doorW = available / (foldLeaves + 1);
    widths[foldIdx] = doorW * foldLeaves;
    widths[slideIdx] = doorW;
    return widths;
  }

  const leavesA = clampFoldLeafCount(types[foldIndices[0]]?.foldLeafCount);
  const leavesB = clampFoldLeafCount(types[foldIndices[1]]?.foldLeafCount);
  const doorW = available / (leavesA + leavesB);
  widths[foldIndices[0]] = doorW * leavesA;
  widths[foldIndices[1]] = doorW * leavesB;
  return widths;
}

/** Partition bay widths — equal per-door split for fold combos, else fraction-based. */
export function resolvePartitionPanelWidthsMm(
  innerAreaWidth: number,
  count: number,
  types: PartitionPanelConfig[],
  widthFractions?: number[],
): number[] {
  const equal = getEqualDoorPartitionWidthsMm(innerAreaWidth, count, types);
  if (equal) return equal;
  return getPartitionPanelWidthsMm(innerAreaWidth, count, types, widthFractions);
}

/** Clamp fold leaf count to 1–12. */
export function clampFoldLeafCount(n: number | undefined): number {
  if (n === undefined || !Number.isFinite(n)) return 2;
  return Math.min(12, Math.max(1, Math.floor(n)));
}

/** Vertical position (mm from inner top) of a partition panel, given optional reduced height. */
export function getPartitionPanelTopMm(
  panelAreaY: number,
  panelAreaHeight: number,
  ph: number,
  heightAlign: 'top' | 'bottom' | undefined
): number {
  if (ph >= panelAreaHeight) return panelAreaY;
  const align = heightAlign ?? 'bottom';
  if (align === 'top') return panelAreaY;
  return panelAreaY + (panelAreaHeight - ph);
}
