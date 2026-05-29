import type { WindowConfig } from '../types';
import { FixedPanelPosition, ShutterConfigType, WindowType } from '../types';
import { resolvePartitionPanelWidthsMm } from './partitionPanelGeometry';
import { getEffectiveLouverBays } from './louverBays';

export interface ElevationSegment {
  /** Width / height in mm */
  sizeMm: number;
  /** Short label e.g. 'F' for fixed lite, 'S' for sliding, 'H' for hinged */
  label?: string;
}

export interface ElevationDimensions {
  columns: ElevationSegment[]; // left → right, mm
  rows: ElevationSegment[]; // top → bottom, mm
}

/**
 * Returns the per-shutter / per-fix vertical column widths (left → right) and
 * row heights (top → bottom) for an elevation, in millimetres. Used by the
 * PDF preview to print individual dimensions under / beside the window.
 */
export function getElevationDimensionsMm(config: WindowConfig | undefined): ElevationDimensions {
  if (!config) return { columns: [], rows: [] };

  const numWidth = Number(config.width) || 0;
  const numHeight = Number(config.height) || 0;
  if (numWidth <= 0 || numHeight <= 0) return { columns: [], rows: [] };

  const fixedPanels = config.fixedPanels ?? [];
  const topFix = fixedPanels.find((p) => p.position === FixedPanelPosition.TOP);
  const bottomFix = fixedPanels.find((p) => p.position === FixedPanelPosition.BOTTOM);
  const leftFix = fixedPanels.find((p) => p.position === FixedPanelPosition.LEFT);
  const rightFix = fixedPanels.find((p) => p.position === FixedPanelPosition.RIGHT);

  const topFixSize = topFix ? Number(topFix.size) || 0 : 0;
  const bottomFixSize = bottomFix ? Number(bottomFix.size) || 0 : 0;
  const leftFixSize = leftFix ? Number(leftFix.size) || 0 : 0;
  const rightFixSize = rightFix ? Number(rightFix.size) || 0 : 0;

  const innerWidth = Math.max(0, numWidth - leftFixSize - rightFixSize);
  const innerHeight = Math.max(0, numHeight - topFixSize - bottomFixSize);

  const columns: ElevationSegment[] = [];
  const rows: ElevationSegment[] = [];

  switch (config.windowType) {
    case WindowType.SLIDING: {
      let numCols = 0;
      let meshFlags: boolean[] = [];
      switch (config.shutterConfig) {
        case ShutterConfigType.TWO_GLASS:
          numCols = 2;
          meshFlags = [false, false];
          break;
        case ShutterConfigType.THREE_GLASS:
          numCols = 3;
          meshFlags = [false, false, false];
          break;
        case ShutterConfigType.TWO_GLASS_ONE_MESH:
          numCols = 3;
          meshFlags = [false, false, true];
          break;
        case ShutterConfigType.FOUR_GLASS:
          numCols = 4;
          meshFlags = [false, false, false, false];
          break;
        case ShutterConfigType.FOUR_GLASS_TWO_MESH:
          numCols = 6;
          // 4G2M layout: G G G G M M (first 4 glass, then 2 mesh on back track behind ends)
          // Visually 4 glass columns with mesh covering ends. For labeling
          // purposes we report 4 visible columns.
          numCols = 4;
          meshFlags = [false, false, false, false];
          break;
      }
      if (leftFixSize > 0) columns.push({ sizeMm: leftFixSize, label: 'F' });
      if (numCols > 0 && innerWidth > 0) {
        const w = innerWidth / numCols;
        for (let i = 0; i < numCols; i++) {
          columns.push({ sizeMm: w, label: meshFlags[i] ? 'M' : 'S' });
        }
      }
      if (rightFixSize > 0) columns.push({ sizeMm: rightFixSize, label: 'F' });

      if (topFixSize > 0) rows.push({ sizeMm: topFixSize, label: 'F' });
      if (innerHeight > 0) rows.push({ sizeMm: innerHeight, label: 'S' });
      if (bottomFixSize > 0) rows.push({ sizeMm: bottomFixSize, label: 'F' });
      break;
    }
    case WindowType.CASEMENT:
    case WindowType.VENTILATOR: {
      const vDiv = (config.verticalDividers ?? [])
        .map((d) => Number(d))
        .filter((d) => Number.isFinite(d) && d > 0 && d < 1)
        .sort((a, b) => a - b);
      const hDiv = (config.horizontalDividers ?? [])
        .map((d) => Number(d))
        .filter((d) => Number.isFinite(d) && d > 0 && d < 1)
        .sort((a, b) => a - b);

      if (leftFixSize > 0) columns.push({ sizeMm: leftFixSize, label: 'F' });
      if (innerWidth > 0) {
        if (vDiv.length === 0) {
          columns.push({ sizeMm: innerWidth });
        } else {
          let prev = 0;
          for (const d of vDiv) {
            columns.push({ sizeMm: (d - prev) * innerWidth });
            prev = d;
          }
          columns.push({ sizeMm: (1 - prev) * innerWidth });
        }
      }
      if (rightFixSize > 0) columns.push({ sizeMm: rightFixSize, label: 'F' });

      if (topFixSize > 0) rows.push({ sizeMm: topFixSize, label: 'F' });
      if (innerHeight > 0) {
        if (hDiv.length === 0) {
          rows.push({ sizeMm: innerHeight });
        } else {
          let prev = 0;
          for (const d of hDiv) {
            rows.push({ sizeMm: (d - prev) * innerHeight });
            prev = d;
          }
          rows.push({ sizeMm: (1 - prev) * innerHeight });
        }
      }
      if (bottomFixSize > 0) rows.push({ sizeMm: bottomFixSize, label: 'F' });
      break;
    }
    case WindowType.GLASS_PARTITION: {
      const pp = config.partitionPanels;
      if (pp && pp.count > 0) {
        const widths = resolvePartitionPanelWidthsMm(
          numWidth,
          pp.count,
          pp.types,
          pp.widthFractions,
        );
        widths.forEach((w, i) => {
          const t = pp.types?.[i]?.type;
          const label =
            t === 'fixed' ? 'F' : t === 'sliding' ? 'S' : t === 'hinged' ? 'H' : t === 'fold' ? 'B' : undefined;
          columns.push({ sizeMm: Number(w) || 0, label });
        });
      }
      rows.push({ sizeMm: numHeight });
      break;
    }
    case WindowType.LOUVERS: {
      const bays = getEffectiveLouverBays(config);
      const layout = config.louverBayLayout || 'vertical';
      if (bays.length <= 1) {
        if (numWidth > 0) columns.push({ sizeMm: numWidth });
        if (numHeight > 0) rows.push({ sizeMm: numHeight });
        break;
      }
      if (layout === 'vertical') {
        if (numWidth > 0) columns.push({ sizeMm: numWidth });
        bays.forEach((b, i) => rows.push({ sizeMm: b.height, label: `L${i + 1}` }));
      } else {
        bays.forEach((b, i) => columns.push({ sizeMm: b.width, label: `L${i + 1}` }));
        if (numHeight > 0) rows.push({ sizeMm: numHeight });
      }
      break;
    }
    default: {
      // Mirror / Corner — single overall column and row, no per-segment.
      if (numWidth > 0) columns.push({ sizeMm: numWidth });
      if (numHeight > 0) rows.push({ sizeMm: numHeight });
      break;
    }
  }

  return { columns, rows };
}
