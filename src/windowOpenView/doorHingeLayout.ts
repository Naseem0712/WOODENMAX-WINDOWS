import type { HandleConfig } from '../types';

/** Standard hinge inset from door edge (mm). */
export const DOOR_HINGE_INSET_MM = 100;

/** Free stile C–D shortened 20° from top and 20° from bottom at full open (A,B fixed, no vertical shift). */
export const DOOR_FREE_STILE_CUT_DEG = 20;

/** @deprecated alias — use DOOR_FREE_STILE_CUT_DEG */
export const DOOR_FULL_OPEN_ANGLE_DEG = DOOR_FREE_STILE_CUT_DEG;

export type DoorHungType = 'side_left' | 'side_right' | 'top' | 'bottom';
export type DoorSwingSide = 'inside' | 'outside';
export type BifoldStackSide = 'left' | 'right';

export interface HingePointMm {
  x: number;
  y: number;
}

export interface DoorCornerMm {
  label: 'A' | 'B' | 'C' | 'D';
  x: number;
  y: number;
  fixed: boolean;
}

export interface DoorSwingLayout {
  hungType: DoorHungType;
  swingSide: DoorSwingSide;
  hingeInsetMm: number;
  openAngleDeg: number;
  hinges: [HingePointMm, HingePointMm];
  xMm: number;
  yMm: number;
  widthMm: number;
  heightMm: number;
  corners: [DoorCornerMm, DoorCornerMm, DoorCornerMm, DoorCornerMm];
  drawXMm: number;
  drawYMm: number;
  drawWidthMm: number;
  drawHeightMm: number;
  openDirectionLabel: string;
}

function clampInset(insetMm: number, widthMm: number, heightMm: number): number {
  return Math.min(insetMm, widthMm * 0.35, heightMm * 0.35);
}

/** Vertical trim on free stile from 20° cut at full open. */
function freeStileTrim(spanMm: number, openAmount: number): number {
  const t = Math.min(1, Math.max(0, openAmount));
  const cutRad = DOOR_FREE_STILE_CUT_DEG * t * (Math.PI / 180);
  return spanMm * Math.tan(cutRad);
}

/** Horizontal width inset on free edge — same 20° proportion so opening gap is visible. */
function freeStileWidthInset(spanMm: number, openAmount: number): number {
  return freeStileTrim(spanMm, openAmount);
}

/** Hinge hardware Y on full-height A–B stile (corners A,B sit at y=0 and y=height). */
export function hingeStileYMm(heightMm: number, insetMm = DOOR_HINGE_INSET_MM): { top: number; bottom: number } {
  const inset = clampInset(insetMm, heightMm, heightMm);
  return { top: inset, bottom: heightMm - inset };
}

export function inferDoorHungType(
  handle: HandleConfig | null | undefined,
  fallbackSide: 'left' | 'right' = 'left',
): DoorHungType {
  if (!handle) return fallbackSide === 'left' ? 'side_left' : 'side_right';

  const hx = handle.x ?? 50;
  const hy = handle.y ?? 50;
  const horiz = Math.min(hx, 100 - hx);
  const vert = Math.min(hy, 100 - hy);

  if (vert + 8 < horiz) {
    return hy <= 50 ? 'bottom' : 'top';
  }
  return hx >= 50 ? 'side_left' : 'side_right';
}

export function hingePositionsForHung(
  hungType: DoorHungType,
  widthMm: number,
  heightMm: number,
  insetMm = DOOR_HINGE_INSET_MM,
): [HingePointMm, HingePointMm] {
  const inset = clampInset(insetMm, widthMm, heightMm);
  switch (hungType) {
    case 'side_left':
      return [
        { x: 0, y: inset },
        { x: 0, y: heightMm - inset },
      ];
    case 'side_right':
      return [
        { x: widthMm, y: inset },
        { x: widthMm, y: heightMm - inset },
      ];
    case 'top':
      return [
        { x: inset, y: 0 },
        { x: widthMm - inset, y: 0 },
      ];
    case 'bottom':
      return [
        { x: inset, y: heightMm },
        { x: widthMm - inset, y: heightMm },
      ];
  }
}

/**
 * Side hung: A,B fixed. C,D shorten −20° top/bottom AND width (free edge moves toward hinge).
 */
function sideHungCorners(
  widthMm: number,
  heightMm: number,
  hungType: 'side_left' | 'side_right',
  openAmount: number,
  _insetMm: number,
): [DoorCornerMm, DoorCornerMm, DoorCornerMm, DoorCornerMm] {
  const yA = 0;
  const yB = heightMm;
  const vTrim = freeStileTrim(widthMm, openAmount);
  const hInset = freeStileWidthInset(widthMm, openAmount);

  const A: DoorCornerMm = { label: 'A', x: hungType === 'side_left' ? 0 : widthMm, y: yA, fixed: true };
  const B: DoorCornerMm = { label: 'B', x: hungType === 'side_left' ? 0 : widthMm, y: yB, fixed: true };
  const freeX = hungType === 'side_left' ? widthMm - hInset : hInset;
  return [
    A,
    B,
    { label: 'C', x: freeX, y: yA + vTrim, fixed: false },
    { label: 'D', x: freeX, y: yB - vTrim, fixed: false },
  ];
}

/** Top/bottom hung: A,B fixed; free rail C,D shortens 20° from each end. */
function topBottomHungCorners(
  widthMm: number,
  heightMm: number,
  hungType: 'top' | 'bottom',
  openAmount: number,
  insetMm: number,
): [DoorCornerMm, DoorCornerMm, DoorCornerMm, DoorCornerMm] {
  const inset = clampInset(insetMm, widthMm, heightMm);
  const trim = freeStileTrim(heightMm, openAmount);

  if (hungType === 'top') {
    const A: DoorCornerMm = { label: 'A', x: inset, y: 0, fixed: true };
    const B: DoorCornerMm = { label: 'B', x: widthMm - inset, y: 0, fixed: true };
    return [
      A,
      B,
      { label: 'C', x: widthMm - inset - trim, y: heightMm, fixed: false },
      { label: 'D', x: inset + trim, y: heightMm, fixed: false },
    ];
  }

  const A: DoorCornerMm = { label: 'A', x: inset, y: heightMm, fixed: true };
  const B: DoorCornerMm = { label: 'B', x: widthMm - inset, y: heightMm, fixed: true };
  return [
    A,
    B,
    { label: 'C', x: widthMm - inset - trim, y: 0, fixed: false },
    { label: 'D', x: inset + trim, y: 0, fixed: false },
  ];
}

function boundsFromCorners(corners: DoorCornerMm[]) {
  const xs = corners.map((c) => c.x);
  const ys = corners.map((c) => c.y);
  const minX = Math.min(...xs);
  const minY = Math.min(...ys);
  const maxX = Math.max(...xs);
  const maxY = Math.max(...ys);
  return {
    drawXMm: minX,
    drawYMm: minY,
    drawWidthMm: Math.max(1, maxX - minX),
    drawHeightMm: Math.max(1, maxY - minY),
  };
}

export function computeDoorSwingLayout(
  xMm: number,
  yMm: number,
  widthMm: number,
  heightMm: number,
  openAmount: number,
  handle: HandleConfig | null | undefined,
  fallbackHingeSide: 'left' | 'right' = 'left',
  hungOverride?: DoorHungType,
  swingSide: DoorSwingSide = 'outside',
): DoorSwingLayout {
  const hungType = hungOverride ?? inferDoorHungType(handle, fallbackHingeSide);
  const hinges = hingePositionsForHung(hungType, widthMm, heightMm);
  const t = Math.min(1, Math.max(0, openAmount));
  const openAngleDeg = DOOR_FREE_STILE_CUT_DEG * t;

  const corners =
    hungType === 'side_left' || hungType === 'side_right'
      ? sideHungCorners(widthMm, heightMm, hungType, t, DOOR_HINGE_INSET_MM)
      : topBottomHungCorners(widthMm, heightMm, hungType, t, DOOR_HINGE_INSET_MM);

  const bounds = boundsFromCorners(corners);

  return {
    hungType,
    swingSide,
    hingeInsetMm: DOOR_HINGE_INSET_MM,
    openAngleDeg,
    hinges,
    xMm,
    yMm,
    widthMm,
    heightMm,
    corners,
    drawXMm: xMm + bounds.drawXMm,
    drawYMm: yMm + bounds.drawYMm,
    drawWidthMm: bounds.drawWidthMm,
    drawHeightMm: bounds.drawHeightMm,
    openDirectionLabel: `A,B fixed · C,D −20° H&V (${(openAngleDeg * 2).toFixed(0)}° gap)`,
  };
}

export interface BifoldPrevLeaf {
  a: { x: number; y: number };
  b: { x: number; y: number };
  c: { x: number; y: number };
  d: { x: number; y: number };
}

/** @deprecated use BifoldPrevLeaf */
export type BifoldFreeEdge = BifoldPrevLeaf;

/**
 * Bi-fold chain — A,B NEVER shorten (frame / hinge / wheel / slide only).
 * C,D get −20° top/bottom cut; free edge also narrows in width (same tan 20°).
 * Even leaves: A,B slide; each leaf narrows equally (W − hInset) like the driver leaf.
 *
 * Door 1: A,B hinge · C,D handle
 * Door 2: C,D joint+shorten · A,B slide
 * Door 3: A,B slide · C,D shorten …
 */
export function computeChainedBifoldDoorSwing(
  openingLeftMm: number,
  openingTopMm: number,
  leafWidthMm: number,
  heightMm: number,
  leafIndex: number,
  openAmount: number,
  swingSide: DoorSwingSide = 'outside',
  prevLeaf: BifoldPrevLeaf | null = null,
  stackSide: BifoldStackSide = 'left',
  totalLeaves = 2,
): DoorSwingLayout {
  const yA = 0;
  const yB = heightMm;
  const t = Math.min(1, Math.max(0, openAmount));
  const vTrim = freeStileTrim(leafWidthMm, t);
  const hInset = freeStileWidthInset(leafWidthMm, t);
  const openAngleDeg = DOOR_FREE_STILE_CUT_DEG * t;
  const k = leafIndex;
  const isDriver = k % 2 === 0;
  const openingWidth = leafWidthMm * totalLeaves;
  const nameFlipped = !isDriver;

  let corners: [DoorCornerMm, DoorCornerMm, DoorCornerMm, DoorCornerMm];

  if (stackSide === 'left') {
    if (isDriver) {
      const ax = k === 0 ? 0 : prevLeaf!.a.x;
      const bx = k === 0 ? 0 : prevLeaf!.b.x;
      const freeX = ax + leafWidthMm - hInset;
      corners = [
        { label: 'A', x: ax, y: yA, fixed: true },
        { label: 'B', x: bx, y: yB, fixed: true },
        { label: 'C', x: freeX, y: yA + vTrim, fixed: false },
        { label: 'D', x: freeX, y: yB - vTrim, fixed: false },
      ];
    } else {
      if (!prevLeaf) throw new Error(`Bi-fold leaf ${k + 1} requires previous leaf`);
      const slideX = prevLeaf.c.x + leafWidthMm - hInset;
      corners = [
        { label: 'A', x: slideX, y: yA, fixed: false },
        { label: 'B', x: slideX, y: yB, fixed: false },
        { label: 'C', x: prevLeaf.c.x, y: prevLeaf.c.y, fixed: true },
        { label: 'D', x: prevLeaf.d.x, y: prevLeaf.d.y, fixed: true },
      ];
    }
  } else if (isDriver) {
    const ax = k === 0 ? openingWidth : prevLeaf!.a.x;
    const bx = k === 0 ? openingWidth : prevLeaf!.b.x;
    const freeX = ax - leafWidthMm + hInset;
    corners = [
      { label: 'A', x: ax, y: yA, fixed: true },
      { label: 'B', x: bx, y: yB, fixed: true },
      { label: 'C', x: freeX, y: yA + vTrim, fixed: false },
      { label: 'D', x: freeX, y: yB - vTrim, fixed: false },
    ];
  } else {
    if (!prevLeaf) throw new Error(`Bi-fold leaf ${k + 1} requires previous leaf`);
    const slideX = prevLeaf.c.x - leafWidthMm + hInset;
    corners = [
      { label: 'A', x: slideX, y: yA, fixed: false },
      { label: 'B', x: slideX, y: yB, fixed: false },
      { label: 'C', x: prevLeaf.c.x, y: prevLeaf.c.y, fixed: true },
      { label: 'D', x: prevLeaf.d.x, y: prevLeaf.d.y, fixed: true },
    ];
  }

  const bounds = boundsFromCorners(corners);
  const hingeA = nameFlipped ? corners[2] : corners[0];
  const hingeB = nameFlipped ? corners[3] : corners[1];
  const hinges: [HingePointMm, HingePointMm] = [
    { x: hingeA.x, y: hingeA.y },
    { x: hingeB.x, y: hingeB.y },
  ];

  const doorNum = k + 1;
  const openDirectionLabel = isDriver
    ? k === 0
      ? `Door ${doorNum} · A,B hinge · C,D −20°`
      : `Door ${doorNum} · A,B slide · C,D −20°`
    : `Door ${doorNum} · C,D −20° · A,B slide`;

  return {
    hungType: stackSide === 'left' ? 'side_left' : 'side_right',
    swingSide,
    hingeInsetMm: DOOR_HINGE_INSET_MM,
    openAngleDeg,
    hinges,
    xMm: openingLeftMm,
    yMm: openingTopMm,
    widthMm: leafWidthMm,
    heightMm,
    corners,
    drawXMm: openingLeftMm + bounds.drawXMm,
    drawYMm: openingTopMm + bounds.drawYMm,
    drawWidthMm: bounds.drawWidthMm,
    drawHeightMm: bounds.drawHeightMm,
    openDirectionLabel,
  };
}

export function hungTypeShortLabel(h: DoorHungType): string {
  switch (h) {
    case 'side_left':
      return 'Side hung (L)';
    case 'side_right':
      return 'Side hung (R)';
    case 'top':
      return 'Top hung';
    case 'bottom':
      return 'Bottom hung';
  }
}

/** Short elevation tag — frame A,B swing vs middle A,B slide. */
export function swingRoleLabel(swing: DoorSwingLayout): string {
  if (swing.openDirectionLabel.includes('A,B slide')) return 'AB slide';
  if (swing.openDirectionLabel.includes('A,B hinge')) return 'Frame · swing';
  return hungTypeShortLabel(swing.hungType);
}

export function doorPolygonOrder(hungType: DoorHungType): ('A' | 'B' | 'C' | 'D')[] {
  if (hungType === 'side_right') return ['A', 'C', 'D', 'B'];
  if (hungType === 'top') return ['A', 'B', 'C', 'D'];
  if (hungType === 'bottom') return ['A', 'B', 'D', 'C'];
  return ['A', 'C', 'D', 'B'];
}

export function freeStileMidpoint(corners: DoorSwingLayout['corners']): { x: number; y: number } {
  const c = corners.find((p) => p.label === 'C')!;
  const d = corners.find((p) => p.label === 'D')!;
  const a = corners.find((p) => p.label === 'A')!;
  const b = corners.find((p) => p.label === 'B')!;
  /** Handle on C,D unless naming flipped (then outer slide edge is A,B). */
  if (c.fixed && d.fixed) {
    return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
  }
  return { x: (c.x + d.x) / 2, y: (c.y + d.y) / 2 };
}

/** Angle at hinge corner — A when normal, C when naming flipped. */
export function cornerAngleAtHinge(corners: DoorSwingLayout['corners']): number {
  const c = corners.find((p) => p.label === 'C')!;
  if (c.fixed && corners.find((p) => p.label === 'D')!.fixed) {
    const a = c;
    const b = corners.find((p) => p.label === 'D')!;
    const outer = corners.find((p) => p.label === 'A')!;
    const vAB = { x: b.x - a.x, y: b.y - a.y };
    const vAC = { x: outer.x - a.x, y: outer.y - a.y };
    const dot = vAB.x * vAC.x + vAB.y * vAC.y;
    const m1 = Math.hypot(vAB.x, vAB.y) || 1;
    const m2 = Math.hypot(vAC.x, vAC.y) || 1;
    return (Math.acos(Math.min(1, Math.max(-1, dot / (m1 * m2)))) * 180) / Math.PI;
  }
  return cornerAngleAtA(corners);
}

export function cornerAngleAtA(corners: DoorSwingLayout['corners']): number {
  const a = corners.find((p) => p.label === 'A')!;
  const b = corners.find((p) => p.label === 'B')!;
  const c = corners.find((p) => p.label === 'C')!;
  const vAB = { x: b.x - a.x, y: b.y - a.y };
  const vAC = { x: c.x - a.x, y: c.y - a.y };
  const dot = vAB.x * vAC.x + vAB.y * vAC.y;
  const m1 = Math.hypot(vAB.x, vAB.y) || 1;
  const m2 = Math.hypot(vAC.x, vAC.y) || 1;
  return (Math.acos(Math.min(1, Math.max(-1, dot / (m1 * m2)))) * 180) / Math.PI;
}
