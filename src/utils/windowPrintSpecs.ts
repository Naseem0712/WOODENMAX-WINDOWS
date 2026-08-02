import type { WindowConfig } from '../types';
import { getElevationDimensionsMm, type ElevationSegment } from './elevationDimensions';

function isShutterElevationColumn(col: ElevationSegment): boolean {
  return col.label === 'S' || col.label === 'M';
}

export function displaySpecOrDash(value: string | number | '' | undefined | null): string {
  if (value === '' || value === undefined || value === null) return '—';
  const s = String(value).trim();
  return s.length > 0 ? s : '—';
}

export function getFrameSectionLabel(config: WindowConfig): string {
  const mm = Number(config.series?.dimensions?.outerFrame);
  if (Number.isFinite(mm) && mm > 0) return `${Math.round(mm * 10) / 10} mm`;
  return '—';
}

export function getOverallSizeLabel(config: WindowConfig): string {
  const w = Number(config.width) || 0;
  const h = Number(config.height) || 0;
  if (w <= 0 && h <= 0) return '—';
  return `${Math.round(w)} × ${Math.round(h)} mm`;
}

export function getDoorShutterSizesLabel(config: WindowConfig): string {
  const { columns } = getElevationDimensionsMm(config);
  const shutterWidths = columns
    .filter(isShutterElevationColumn)
    .map((c) => Math.round(c.sizeMm || 0))
    .filter((n) => n > 0);
  if (shutterWidths.length === 0) return '—';
  return `${shutterWidths.join(', ')} mm`;
}

export function getWallThicknessLabel(config: WindowConfig): string {
  const mm = Number(config.wallThicknessMm);
  if (Number.isFinite(mm) && mm > 0) return `${Math.round(mm * 10) / 10} mm`;
  return '—';
}
