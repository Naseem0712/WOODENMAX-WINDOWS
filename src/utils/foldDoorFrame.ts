import type { PartitionPanelConfig } from '../types';

function readMm(v: number | '' | undefined | null, fallback: number): number {
  if (v === '' || v === undefined || v === null) return fallback;
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

/** Per-edge frame depths (mm) for framed Bi-fold; blanks use series `baseMm` or shared side width. */
export function resolveFoldFrameEdges(
  panelConfig: PartitionPanelConfig,
  baseMm: number
): { top: number; bottom: number; left: number; right: number } {
  const top = readMm(panelConfig.foldFrameTopMm, baseMm);
  const bottom = readMm(panelConfig.foldFrameBottomMm, baseMm);

  const sideRaw = panelConfig.foldFrameSideMm;
  const sideNum =
    sideRaw === '' || sideRaw === undefined || sideRaw === null ? undefined : Number(sideRaw);
  const sideFallback =
    sideNum !== undefined && Number.isFinite(sideNum) && sideNum > 0 ? sideNum : baseMm;

  const left = readMm(panelConfig.foldFrameLeftMm, sideFallback);
  const right = readMm(panelConfig.foldFrameRightMm, sideFallback);
  return { top, bottom, left, right };
}
