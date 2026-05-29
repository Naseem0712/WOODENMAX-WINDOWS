import type { HandleConfig } from '../types';
import type { BifoldStackSide, DoorSwingSide, BifoldPrevLeaf } from './doorHingeLayout';
import {
  computeChainedBifoldDoorSwing,
  computeDoorSwingLayout,
  type DoorHungType,
} from './doorHingeLayout';

/** Fold opens toward building exterior or interior (plan view). */
export type FoldOpenSide = 'external' | 'internal';

export interface BifoldLeafSpec {
  id: string;
  label: string;
  xMm: number;
  yMm: number;
  widthMm: number;
  heightMm: number;
  zIndex: number;
  handle?: HandleConfig | null;
  doorSwing: ReturnType<typeof computeChainedBifoldDoorSwing>;
}

export interface BifoldPlanPoint {
  x: number;
  y: number;
}

export interface BifoldPlanSegment {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  label: string;
  pivot?: { x: number; y: number };
}

const MAX_FOLD_DEG = 82;

export function computeBifoldPlan(
  openingLeftMm: number,
  openingWidthMm: number,
  leafCount: number,
  openAmount: number,
  side: FoldOpenSide = 'external',
  stackSide: BifoldStackSide = 'left',
  labelStart = 0,
): { segments: BifoldPlanSegment[]; path: BifoldPlanPoint[]; pivots: BifoldPlanPoint[] } {
  const n = Math.max(2, leafCount);
  const W = openingWidthMm / n;
  const alpha = MAX_FOLD_DEG * openAmount * (Math.PI / 180);
  const ySign = side === 'external' ? -1 : 1;

  const path: BifoldPlanPoint[] = [];
  const pivots: BifoldPlanPoint[] = [];
  const segments: BifoldPlanSegment[] = [];

  if (stackSide === 'right') {
    let hx = openingLeftMm + openingWidthMm;
    let hy = 0;
    path.push({ x: hx, y: hy });
    pivots.push({ x: hx, y: hy });
    for (let k = 0; k < n; k++) {
      const leafAngle = (k % 2 === 0 ? -1 : 1) * alpha;
      const endX = hx - W * Math.cos(leafAngle);
      /** Mirror Y so centre-right stack swings same inside/outside as left stack. */
      const endY = hy - ySign * W * Math.sin(leafAngle);
      segments.push({
        x1: hx,
        y1: hy,
        x2: endX,
        y2: endY,
        label: panelCircled(k, labelStart),
        pivot: { x: hx, y: hy },
      });
      path.push({ x: endX, y: endY });
      if (k < n - 1) pivots.push({ x: endX, y: endY });
      hx = endX;
      hy = endY;
    }
    return { segments, path, pivots };
  }

  let hx = openingLeftMm;
  let hy = 0;
  path.push({ x: hx, y: hy });
  pivots.push({ x: hx, y: hy });

  for (let k = 0; k < n; k++) {
    const leafAngle = (k % 2 === 0 ? 1 : -1) * alpha;
    const endX = hx + W * Math.cos(leafAngle);
    const endY = hy + ySign * W * Math.sin(leafAngle);

    segments.push({
      x1: hx,
      y1: hy,
      x2: endX,
      y2: endY,
      label: panelCircled(k, labelStart),
      pivot: { x: hx, y: hy },
    });

    path.push({ x: endX, y: endY });
    if (k < n - 1) pivots.push({ x: endX, y: endY });
    hx = endX;
    hy = endY;
  }

  return { segments, path, pivots };
}

export function computeBifoldElevationLeaves(
  openingLeftMm: number,
  openingTopMm: number,
  openingWidthMm: number,
  heightMm: number,
  leafCount: number,
  openAmount: number,
  baseZIndex: number,
  idPrefix: string,
  handle?: HandleConfig | null,
  defaultSwing: DoorSwingSide = 'outside',
  stackSide: BifoldStackSide = 'left',
  labelStart = 0,
): BifoldLeafSpec[] {
  const n = Math.max(2, leafCount);
  const W = openingWidthMm / n;
  const leaves: BifoldLeafSpec[] = [];
  let prevLeaf: BifoldPrevLeaf | null = null;

  for (let k = 0; k < n; k++) {
    const swing = computeChainedBifoldDoorSwing(
      openingLeftMm,
      openingTopMm,
      W,
      heightMm,
      k,
      openAmount,
      defaultSwing,
      prevLeaf,
      stackSide,
      n,
    );
    const map = Object.fromEntries(swing.corners.map((p) => [p.label, p])) as Record<
      'A' | 'B' | 'C' | 'D',
      { x: number; y: number }
    >;
    prevLeaf = {
      a: { x: map.A.x, y: map.A.y },
      b: { x: map.B.x, y: map.B.y },
      c: { x: map.C.x, y: map.C.y },
      d: { x: map.D.x, y: map.D.y },
    };

    leaves.push({
      id: `${idPrefix}-leaf-${k}`,
      label: panelCircled(k, labelStart),
      xMm: openingLeftMm,
      yMm: openingTopMm,
      widthMm: W,
      heightMm,
      zIndex: baseZIndex + k,
      handle: k === 0 ? handle ?? null : null,
      doorSwing: swing,
    });
  }

  return leaves;
}

export function casementSwingSpec(
  cellX: number,
  cellY: number,
  cellW: number,
  cellH: number,
  hingeLeft: boolean,
  openAmount: number,
  id: string,
  label: string,
  zIndex: number,
  handle?: HandleConfig | null,
  swingSide: DoorSwingSide = 'outside',
): BifoldLeafSpec {
  const doorSwing = computeDoorSwingLayout(
    cellX,
    cellY,
    cellW,
    cellH,
    openAmount,
    handle,
    hingeLeft ? 'left' : 'right',
    hingeLeft ? 'side_left' : 'side_right',
    swingSide,
  );
  return {
    id,
    label,
    xMm: cellX,
    yMm: cellY,
    widthMm: cellW,
    heightMm: cellH,
    zIndex,
    handle: handle ?? null,
    doorSwing,
  };
}

export function computeCasementPlanSegment(
  doorLeftMm: number,
  doorWidthMm: number,
  openAmount: number,
  hungType: DoorHungType,
  side: FoldOpenSide = 'external',
  label = '①',
): BifoldPlanSegment {
  const ySign = side === 'external' ? -1 : 1;

  if (hungType === 'top' || hungType === 'bottom') {
    const alpha = 55 * openAmount * (Math.PI / 180);
    const pivotY = hungType === 'top' ? 0 : 0;
    const midX = doorLeftMm + doorWidthMm / 2;
    const endY = ySign * doorWidthMm * 0.45 * Math.sin(alpha) * (hungType === 'top' ? 1 : -1);
    const endX = midX + doorWidthMm * 0.35 * (1 - Math.cos(alpha));
    return {
      x1: midX,
      y1: pivotY,
      x2: endX,
      y2: endY,
      label,
      pivot: { x: midX, y: pivotY },
    };
  }

  const alpha = 75 * openAmount * (Math.PI / 180);
  const hingeLeft = hungType === 'side_left';
  const pivotX = hingeLeft ? doorLeftMm : doorLeftMm + doorWidthMm;
  const dir = hingeLeft ? 1 : -1;
  const endX = pivotX + dir * doorWidthMm * Math.cos(alpha);
  const endY = ySign * doorWidthMm * Math.sin(alpha);
  return {
    x1: pivotX,
    y1: 0,
    x2: endX,
    y2: endY,
    label,
    pivot: { x: pivotX, y: 0 },
  };
}

function panelCircled(k: number, start = 0): string {
  const circled = ['①', '②', '③', '④', '⑤', '⑥', '⑦', '⑧'];
  return circled[k + start] ?? String(k + start + 1);
}

/** Label fold+slide / center-opening layout e.g. 2+1, 3+3. */
export function describeFoldPartitionLayout(
  types: Array<{ type?: string; foldLeafCount?: number } | null | undefined>,
): string | null {
  const entries = types
    .map((t, i) => ({ i, type: t?.type, leaves: t?.foldLeafCount }))
    .filter((e) => e.type === 'fold' || e.type === 'sliding');

  const folds = entries.filter((e) => e.type === 'fold');
  const slides = entries.filter((e) => e.type === 'sliding');

  if (folds.length === 2 && slides.length === 0) {
    const a = Math.max(2, folds[0].leaves ?? 2);
    const b = Math.max(2, folds[1].leaves ?? 2);
    if (a === b) return `${a}+${b} (center opening)`;
    return `${a}+${b} fold`;
  }

  if (folds.length === 1 && slides.length === 1) {
    const n = Math.max(2, folds[0].leaves ?? 2);
    const foldFirst = folds[0].i < slides[0].i;
    return foldFirst ? `${n}+1` : `1+${n}`;
  }

  if (folds.length === 1 && slides.length === 0) {
    const n = Math.max(2, folds[0].leaves ?? 2);
    return `${n}-fold set`;
  }

  return null;
}
