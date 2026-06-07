import type { WindowConfig } from '../types';
import { WindowType } from '../types';
import type { HideInnerEdges } from '../constants/profileVisual';
import { PROFILE_VISUAL_OVERLAP_MM } from '../constants/profileVisual';

export type MullionSegmentHidden = {
  horizontal: string[];
  vertical: string[];
};

export type MergedCasementCell = {
  minRow: number;
  maxRow: number;
  minCol: number;
  maxCol: number;
};

export function hSegKey(dividerIndex: number, col: number): string {
  return `${dividerIndex}-${col}`;
}

export function vSegKey(dividerIndex: number, row: number): string {
  return `${dividerIndex}-${row}`;
}

export function resolveHiddenMullionSegments(config: WindowConfig): MullionSegmentHidden {
  const raw = config.hiddenMullionSegments;
  return {
    horizontal: raw?.horizontal ?? [],
    vertical: raw?.vertical ?? [],
  };
}

function cellKey(r: number, c: number): string {
  return `${r},${c}`;
}

/** Union-find merged grid cells when segment mullions are hidden. */
export function resolveCasementMergedCells(
  gridRows: number,
  gridCols: number,
  hidden: MullionSegmentHidden,
): MergedCasementCell[] {
  const parent = new Map<string, string>();
  const find = (k: string): string => {
    const p = parent.get(k);
    if (!p || p === k) {
      parent.set(k, k);
      return k;
    }
    const root = find(p);
    parent.set(k, root);
    return root;
  };
  const union = (a: string, b: string) => {
    const ra = find(a);
    const rb = find(b);
    if (ra !== rb) parent.set(rb, ra);
  };

  for (let r = 0; r < gridRows; r++) {
    for (let c = 0; c < gridCols; c++) {
      find(cellKey(r, c));
    }
  }

  for (const key of hidden.horizontal) {
    const [hi, c] = key.split('-').map(Number);
    if (Number.isFinite(hi) && Number.isFinite(c) && hi + 1 < gridRows) {
      union(cellKey(hi, c), cellKey(hi + 1, c));
    }
  }
  for (const key of hidden.vertical) {
    const [vi, r] = key.split('-').map(Number);
    if (Number.isFinite(vi) && Number.isFinite(r) && vi + 1 < gridCols) {
      union(cellKey(r, vi), cellKey(r, vi + 1));
    }
  }

  const groups = new Map<string, MergedCasementCell>();
  for (let r = 0; r < gridRows; r++) {
    for (let c = 0; c < gridCols; c++) {
      const root = find(cellKey(r, c));
      const g = groups.get(root) ?? { minRow: r, maxRow: r, minCol: c, maxCol: c };
      g.minRow = Math.min(g.minRow, r);
      g.maxRow = Math.max(g.maxRow, r);
      g.minCol = Math.min(g.minCol, c);
      g.maxCol = Math.max(g.maxCol, c);
      groups.set(root, g);
    }
  }
  return [...groups.values()];
}

export function isHSegHidden(hidden: MullionSegmentHidden, dividerIndex: number, col: number): boolean {
  return hidden.horizontal.includes(hSegKey(dividerIndex, col));
}

export function isVSegHidden(hidden: MullionSegmentHidden, dividerIndex: number, row: number): boolean {
  return hidden.vertical.includes(vSegKey(dividerIndex, row));
}

/** Inner outline edges covered by an adjacent visible mullion segment. */
export function casementCellHideInnerEdges(
  r: number,
  c: number,
  gridRows: number,
  gridCols: number,
  hidden: MullionSegmentHidden,
): HideInnerEdges {
  const hide: HideInnerEdges = {};
  // Hide door inner where stile overlaps a visible mullion (outer frame overlap keeps door inner visible).
  if (r > 0 && !isHSegHidden(hidden, r - 1, c)) hide.top = true;
  if (r < gridRows - 1 && !isHSegHidden(hidden, r, c)) hide.bottom = true;
  if (c > 0 && !isVSegHidden(hidden, c - 1, r)) hide.left = true;
  if (c < gridCols - 1 && !isVSegHidden(hidden, c, r)) hide.right = true;
  return hide;
}

export type OpeningInnerLineHideRanges = {
  left: Array<[number, number]>;
  right: Array<[number, number]>;
  top: Array<[number, number]>;
  bottom: Array<[number, number]>;
};

function mergeMmRanges(ranges: Array<[number, number]>): Array<[number, number]> {
  if (ranges.length === 0) return [];
  const sorted = [...ranges].sort((a, b) => a[0] - b[0]);
  const out: Array<[number, number]> = [sorted[0]];
  for (let i = 1; i < sorted.length; i++) {
    const last = out[out.length - 1];
    if (sorted[i][0] <= last[1]) {
      last[1] = Math.max(last[1], sorted[i][1]);
    } else {
      out.push(sorted[i]);
    }
  }
  return out;
}

/** Visible segments after subtracting hidden ranges from a full span. */
export function subtractMmRanges(
  fullStart: number,
  fullEnd: number,
  hidden: Array<[number, number]>,
): Array<[number, number]> {
  const merged = mergeMmRanges(hidden);
  const visible: Array<[number, number]> = [];
  let cursor = fullStart;
  for (const [h0, h1] of merged) {
    if (h0 > cursor) visible.push([cursor, Math.min(h0, fullEnd)]);
    cursor = Math.max(cursor, h1);
  }
  if (cursor < fullEnd) visible.push([cursor, fullEnd]);
  return visible.filter(([a, b]) => b - a > 0.05);
}

function casementCellBoundsMm(
  r: number,
  c: number,
  innerW: number,
  innerH: number,
  vDivs: number[],
  hDivs: number[],
): { cellX: number; cellY: number; cellW: number; cellH: number } {
  const xStart = c === 0 ? 0 : vDivs[c - 1];
  const xEnd = c === vDivs.length ? 1 : vDivs[c];
  const yStart = r === 0 ? 0 : hDivs[r - 1];
  const yEnd = r === hDivs.length ? 1 : hDivs[r];
  return {
    cellX: xStart * innerW,
    cellY: yStart * innerH,
    cellW: (xEnd - xStart) * innerW,
    cellH: (yEnd - yStart) * innerH,
  };
}

function isCasementDoorCell(
  config: WindowConfig,
  windowType: WindowType,
  r: number,
  c: number,
): boolean {
  if (windowType === WindowType.CASEMENT) {
    return config.doorPositions.some((p) => p.row === r && p.col === c);
  }
  if (windowType === WindowType.VENTILATOR) {
    return config.ventilatorGrid[r]?.[c]?.type === 'door';
  }
  return false;
}

/** Y/X spans along the opening perimeter where outer-frame inner lines are hidden under doors. */
export function casementOpeningInnerLineHideRanges(
  config: WindowConfig,
  windowType: WindowType,
  gridRows: number,
  gridCols: number,
  hidden: MullionSegmentHidden,
  innerW: number,
  innerH: number,
  vDivs: number[],
  hDivs: number[],
  mullionMm = 0,
  overlapMm = PROFILE_VISUAL_OVERLAP_MM,
): OpeningInnerLineHideRanges {
  const left: Array<[number, number]> = [];
  const right: Array<[number, number]> = [];
  const top: Array<[number, number]> = [];
  const bottom: Array<[number, number]> = [];

  for (let r = 0; r < gridRows; r++) {
    for (let c = 0; c < gridCols; c++) {
      if (!isCasementDoorCell(config, windowType, r, c)) continue;
      const { cellX, cellY, cellW, cellH } = casementCellBoundsMm(r, c, innerW, innerH, vDivs, hDivs);
      const visual = casementDoorVisualBounds(
        cellX,
        cellY,
        cellW,
        cellH,
        r,
        c,
        gridRows,
        gridCols,
        hidden,
        overlapMm,
        mullionMm,
      );
      if (c === 0) {
        left.push([visual.cellY, visual.cellY + visual.cellH]);
      }
      if (c === gridCols - 1) {
        right.push([visual.cellY, visual.cellY + visual.cellH]);
      }
      if (r === 0) {
        top.push([visual.cellX, visual.cellX + visual.cellW]);
      }
      if (r > 0 && !isHSegHidden(hidden, r - 1, c)) {
        top.push([visual.cellX, visual.cellX + visual.cellW]);
      }
      if (r === gridRows - 1) {
        bottom.push([visual.cellX, visual.cellX + visual.cellW]);
      }
    }
  }

  return {
    left: mergeMmRanges(left),
    right: mergeMmRanges(right),
    top: mergeMmRanges(top),
    bottom: mergeMmRanges(bottom),
  };
}

/** Door visual bounds: inset from mullion centre so gap shows (mullion − 16 between two doors), 8 mm bleed into outer frame. */
export function casementDoorVisualBounds(
  cellX: number,
  cellY: number,
  cellW: number,
  cellH: number,
  r: number,
  c: number,
  gridRows: number,
  gridCols: number,
  hidden: MullionSegmentHidden,
  overlapMm = PROFILE_VISUAL_OVERLAP_MM,
  mullionMm = 0,
): { cellX: number; cellY: number; cellW: number; cellH: number } {
  const o = Math.max(0, overlapMm);
  const halfM = Math.max(0, mullionMm) / 2;
  /** Pull meeting edge back from cell divider so only `overlapMm` of mullion sits under the door stile. */
  const mullionInset = Math.max(0, halfM - o);
  let x = cellX;
  let y = cellY;
  let w = cellW;
  let h = cellH;

  if (c > 0 && !isVSegHidden(hidden, c - 1, r)) {
    x += mullionInset;
    w -= mullionInset;
    x -= o;
    w += o;
  }
  if (c < gridCols - 1 && !isVSegHidden(hidden, c, r)) {
    w -= mullionInset;
    w += o;
  }
  if (r > 0 && !isHSegHidden(hidden, r - 1, c)) {
    y -= o;
    h += o;
  }
  if (r < gridRows - 1 && !isHSegHidden(hidden, r, c)) {
    h += o;
  }

  // Outer frame inner line — 8 mm outward overlap (door cells only).
  if (c === 0) {
    x -= o;
    w += o;
  }
  if (c === gridCols - 1) {
    w += o;
  }
  if (r === 0) {
    y -= o;
    h += o;
  }
  if (r === gridRows - 1) {
    h += o;
  }
  return { cellX: x, cellY: y, cellW: w, cellH: h };
}

export function gridMullionJointLineProps(
  orientation: 'horizontal' | 'vertical',
  c: number,
  r: number,
  gridCols: number,
  gridRows: number,
  scale: number,
  overlapMm = PROFILE_VISUAL_OVERLAP_MM,
  opts?: { segmentTopAtSpring?: boolean },
): {
  leftEndInsetPx?: number;
  rightEndInsetPx?: number;
  bottomInsetPx?: number;
  topInsetPx?: number;
} {
  const insetPx = Math.max(0, overlapMm) * scale;
  if (orientation === 'horizontal') {
    return {
      leftEndInsetPx: c === 0 ? insetPx : 0,
      rightEndInsetPx: c === gridCols - 1 ? insetPx : 0,
    };
  }
  return {
    bottomInsetPx: r === gridRows - 1 ? insetPx : 0,
    topInsetPx: r === 0 || opts?.segmentTopAtSpring ? insetPx : 0,
  };
}

export function allHSegmentsHidden(hidden: MullionSegmentHidden, dividerIndex: number, gridCols: number): boolean {
  for (let c = 0; c < gridCols; c++) {
    if (!isHSegHidden(hidden, dividerIndex, c)) return false;
  }
  return gridCols > 0;
}

export function allVSegmentsHidden(hidden: MullionSegmentHidden, dividerIndex: number, gridRows: number): boolean {
  for (let r = 0; r < gridRows; r++) {
    if (!isVSegHidden(hidden, dividerIndex, r)) return false;
  }
  return gridRows > 0;
}

export function withHiddenHSegment(
  config: WindowConfig,
  dividerIndex: number,
  col: number,
): WindowConfig['hiddenMullionSegments'] {
  const hidden = resolveHiddenMullionSegments(config);
  const key = hSegKey(dividerIndex, col);
  if (hidden.horizontal.includes(key)) return hidden;
  return { ...hidden, horizontal: [...hidden.horizontal, key] };
}

export function withHiddenVSegment(
  config: WindowConfig,
  dividerIndex: number,
  row: number,
): WindowConfig['hiddenMullionSegments'] {
  const hidden = resolveHiddenMullionSegments(config);
  const key = vSegKey(dividerIndex, row);
  if (hidden.vertical.includes(key)) return hidden;
  return { ...hidden, vertical: [...hidden.vertical, key] };
}

export function pruneHiddenForRemovedHDivider(
  hidden: MullionSegmentHidden,
  removedIndex: number,
): MullionSegmentHidden {
  const horizontal = hidden.horizontal
    .map((k) => {
      const [i, c] = k.split('-').map(Number);
      if (i === removedIndex) return null;
      if (i > removedIndex) return hSegKey(i - 1, c);
      return k;
    })
    .filter((k): k is string => k != null);
  return { ...hidden, horizontal };
}

export function pruneHiddenForRemovedVDivider(
  hidden: MullionSegmentHidden,
  removedIndex: number,
): MullionSegmentHidden {
  const vertical = hidden.vertical
    .map((k) => {
      const [i, r] = k.split('-').map(Number);
      if (i === removedIndex) return null;
      if (i > removedIndex) return vSegKey(i - 1, r);
      return k;
    })
    .filter((k): k is string => k != null);
  return { ...hidden, vertical };
}
