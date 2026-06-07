import type { WindowConfig } from '../types';

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
