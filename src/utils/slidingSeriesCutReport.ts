import type { MaterialRateSettings, QuotationItem, ProfileDimensions } from '../types';
import { WindowType } from '../types';
import { packPieces } from './materialCalculator';
import { resolveSeriesNumeric, dimensionKeyLabel } from './profileDimensionKeys';
import { getSlidingCuttingPlanPerWindow } from './slidingCuttingPlan';
import type { SlidingCostLine } from './slidingCuttingPlan';
import { isSlidingSeriesUnifiedOuter } from './slidingCutFormula';
import type { SlidingPiecePool } from './slidingCutFormula';

const MM_PER_FT = 304.8;
/** Same default as materialCalculator: 16 ft stock. */
const DEFAULT_STOCK_LENGTH_MM = 16 * MM_PER_FT;

const POOL_DISPLAY_ORDER: SlidingPiecePool[] = [
  'outerPerimeter2T',
  'outerPerimeter3T',
  'outerTrack2T',
  'outerTrack3T',
  'outerJamb2T',
  'outerJamb3T',
  'shutterFrame',
  'meshShutterFrame',
  'shutterInterlock',
  'meshShutterInterlock',
  'trackClip',
];

const POOL_TO_LENGTH_KEY: Record<SlidingPiecePool, keyof ProfileDimensions | null> = {
  outerPerimeter2T: 'track2T',
  outerPerimeter3T: 'track3T',
  outerTrack2T: 'track2T',
  outerTrack3T: 'track3T',
  outerJamb2T: 'jamb2T',
  outerJamb3T: 'jamb3T',
  shutterFrame: 'shutterTop',
  meshShutterFrame: 'shutterBottom',
  shutterInterlock: 'shutterInterlock',
  meshShutterInterlock: 'shutterMeeting',
  trackClip: null,
};

function stockLengthMmForPool(series: QuotationItem['config']['series'], pool: SlidingPiecePool): number {
  const k = POOL_TO_LENGTH_KEY[pool];
  if (k == null) return DEFAULT_STOCK_LENGTH_MM;
  const v = resolveSeriesNumeric(series.lengths, k);
  return v > 0 ? v : DEFAULT_STOCK_LENGTH_MM;
}

function poolTitle(
  pool: SlidingPiecePool,
  separateMesh: boolean
): string {
  switch (pool) {
    case 'outerPerimeter2T':
      return '2-track outer — perimeter (H+V same section, one stock pool per track type)';
    case 'outerPerimeter3T':
      return '3-track outer — perimeter (H+V same section, one stock pool; not mixed with 2-track outer)';
    case 'outerTrack2T':
      return '2-track — outer track (top + bottom) only';
    case 'outerTrack3T':
      return '3-track — outer track (top + bottom) only';
    case 'outerJamb2T':
      return '2-track — side jamb (L + R) only';
    case 'outerJamb3T':
      return '3-track — side jamb (L + R) only';
    case 'shutterFrame':
      return separateMesh
        ? 'Shutter top / bottom + handle (glass run)'
        : 'Shutter top / bottom + handle (glass + mesh together unless mesh split is on)';
    case 'meshShutterFrame':
      return 'Mesh shutter — top / bottom + handle (separate mesh stock when enabled)';
    case 'shutterInterlock':
      return separateMesh ? 'Interlock (glass run, vertical)' : 'Interlock (glass + mesh shared unless mesh split is on)';
    case 'meshShutterInterlock':
      return 'Mesh interlock (vertical, separate mesh stock when enabled)';
    case 'trackClip':
      return 'Track clip (accessory)';
    default:
      return pool;
  }
}

function profileLabelForPool(pool: SlidingPiecePool): string {
  const k = POOL_TO_LENGTH_KEY[pool];
  if (k == null) return '— (default 16 ft bar for bin-pack)';
  return dimensionKeyLabel(k);
}

export interface CutSizeRow {
  lengthMm: number;
  pieceCount: number;
  partLabels: string[];
}

export interface PoolCutBlock {
  pool: SlidingPiecePool;
  title: string;
  stockKeyLabel: string;
  standardLengthMm: number;
  sizeRows: CutSizeRow[];
  totalPieceCount: number;
  totalLengthMm: number;
  requiredBars: number;
  purchasedLengthMm: number;
  wastageMm: number;
  wastagePercent: number;
  totalWeightKg: number;
}

export interface QuotationLineCutRow {
  label: string;
  pool: SlidingPiecePool;
  lengthMm: number;
  totalPieces: number;
  cutAngles: string;
}

/** One window only — for shop drawing style V vs H in one panel. */
export interface PerWindowLayoutRow {
  label: string;
  pieces: number;
  lengthMm: number;
  cutAngles: string;
  /** Shutter / mesh flavour when role distinguishes */
  kind?: 'glass' | 'mesh' | 'common';
}

export interface PerWindowLayout {
  trackCount: 2 | 3;
  /** Outer: track rail = horizontal (W), jamb = vertical (H) */
  outer: {
    horizontal: PerWindowLayoutRow[];
    vertical: PerWindowLayoutRow[];
    trackClip: PerWindowLayoutRow[];
  };
  /** Shutters: top/bottom = horizontal bar; handle + interlock = vertical */
  shutter: {
    horizontal: PerWindowLayoutRow[];
    handleVertical: PerWindowLayoutRow[];
    interlockVertical: PerWindowLayoutRow[];
  };
}

function classifyShutterLine(line: SlidingCostLine): 'horizontal' | 'handle' | 'interlock' {
  if (line.role === 'shutterHorizontal') return 'horizontal';
  if (line.role === 'shutterHandle') return 'handle';
  if (line.role === 'shutterSlimInterlock' || line.role === 'shutterReinfInterlock') return 'interlock';
  return 'horizontal';
}

/**
 * One window, one panel: outer frame (V/H) + shutter groups — from raw plan.lines (per-window piece counts).
 */
export function buildPerWindowLayout(
  perWindowLines: SlidingCostLine[],
  trackCount: 2 | 3
): PerWindowLayout {
  const outer = { horizontal: [] as PerWindowLayoutRow[], vertical: [] as PerWindowLayoutRow[], trackClip: [] as PerWindowLayoutRow[] };
  const shutter = {
    horizontal: [] as PerWindowLayoutRow[],
    handleVertical: [] as PerWindowLayoutRow[],
    interlockVertical: [] as PerWindowLayoutRow[],
  };

  const kind = (st: (typeof perWindowLines)[0]['shutterType']): 'glass' | 'mesh' | 'common' | undefined => {
    if (st === 'glass') return 'glass';
    if (st === 'mesh') return 'mesh';
    if (st === 'common') return 'common';
    return undefined;
  };

  for (const line of perWindowLines) {
    if (line.pieces <= 0) continue;
    if (line.pool === 'outerPerimeter2T' || line.pool === 'outerPerimeter3T') {
      const row: PerWindowLayoutRow = {
        label: line.label,
        pieces: line.pieces,
        lengthMm: line.pieceLengthMm,
        cutAngles: line.cutAngles,
      };
      if (line.role === 'outerFrameVertical') outer.vertical.push(row);
      else outer.horizontal.push(row);
      continue;
    }
    if (line.pool === 'outerTrack2T' || line.pool === 'outerTrack3T') {
      outer.horizontal.push({
        label: line.label,
        pieces: line.pieces,
        lengthMm: line.pieceLengthMm,
        cutAngles: line.cutAngles,
      });
      continue;
    }
    if (line.pool === 'outerJamb2T' || line.pool === 'outerJamb3T') {
      outer.vertical.push({
        label: line.label,
        pieces: line.pieces,
        lengthMm: line.pieceLengthMm,
        cutAngles: line.cutAngles,
      });
      continue;
    }
    if (line.pool === 'trackClip') {
      outer.trackClip.push({
        label: line.label,
        pieces: line.pieces,
        lengthMm: line.pieceLengthMm,
        cutAngles: line.cutAngles,
      });
      continue;
    }

    const k = kind(line.shutterType);
    const row: PerWindowLayoutRow = { label: line.label, pieces: line.pieces, lengthMm: line.pieceLengthMm, cutAngles: line.cutAngles, kind: k };
    const cls = classifyShutterLine(line);
    if (cls === 'horizontal') shutter.horizontal.push(row);
    else if (cls === 'handle') shutter.handleVertical.push(row);
    else shutter.interlockVertical.push(row);
  }

  return { trackCount, outer, shutter };
}

export interface QuotationLineCutBlock {
  itemId: string;
  title: string;
  quantity: number;
  widthMm: number;
  heightMm: number;
  trackCount: 2 | 3;
  meshSeparated: boolean;
  /** Per 1 window — V/H style panel. */
  perWindowLayout: PerWindowLayout;
  cutRows: QuotationLineCutRow[];
  perPool: PoolCutBlock[];
}

/** Shop-style one line = one stock + bin-pack (slim/reinf split alag). */
export interface MaterialPurchaseRow {
  id: string;
  title: string;
  note?: string;
  block: PoolCutBlock;
}

const FEET_PER_MM = 0.00328084;
export function stockBarLengthLabelFt(block: PoolCutBlock): string {
  return `${(block.standardLengthMm * FEET_PER_MM).toFixed(1)} ft`;
}

/**
 * Order: unified outer perimeter 2T/3T, else track+jamb, slim×, reinf×, shutter, mesh, track clip.
 * Slim & reinforcement: separate bar counts (same profile pool me role-wise split se).
 */
function buildMaterialPurchase(
  merged: SlidingCostLine[],
  series: QuotationItem['config']['series'],
  separateMesh: boolean
): MaterialPurchaseRow[] {
  const rows: MaterialPurchaseRow[] = [];

  const onePoolBlock = (pool: SlidingPiecePool): PoolCutBlock | null => {
    const sub = merged.filter((l) => l.pool === pool);
    if (sub.length === 0) return null;
    return buildPoolBlocksFromLines(series, sub, separateMesh).find((b) => b.pool === pool) ?? null;
  };

  const unifiedOuter = isSlidingSeriesUnifiedOuter(series);
  if (unifiedOuter) {
    const p2 = onePoolBlock('outerPerimeter2T');
    if (p2) {
      rows.push({
        id: 't2-outer-perimeter',
        title: '2-track stock — full outer (top + bottom + L + R, same section)',
        block: p2,
      });
    }
    const p3 = onePoolBlock('outerPerimeter3T');
    if (p3) {
      rows.push({
        id: 't3-outer-perimeter',
        title: '3-track stock — full outer (top + bottom + L + R, same section)',
        block: p3,
      });
    }
  } else {
    const t2 = onePoolBlock('outerTrack2T');
    if (t2) {
      rows.push({
        id: 't2-outer-h',
        title: '2-track — outer track (top + bottom only)',
        block: t2,
      });
    }
    const t3 = onePoolBlock('outerTrack3T');
    if (t3) {
      rows.push({
        id: 't3-outer-h',
        title: '3-track — outer track (top + bottom only)',
        block: t3,
      });
    }
    const jamb2 = onePoolBlock('outerJamb2T');
    if (jamb2) {
      rows.push({
        id: 'outer-v-jamb-2t',
        title: '2-track — side jamb (L + R only)',
        block: jamb2,
      });
    }
    const jamb3 = onePoolBlock('outerJamb3T');
    if (jamb3) {
      rows.push({
        id: 'outer-v-jamb-3t',
        title: '3-track — side jamb (L + R only)',
        block: jamb3,
      });
    }
  }

  const slimLines = merged.filter((l) => l.role === 'shutterSlimInterlock');
  for (const b of buildPoolBlocksFromLines(series, slimLines, separateMesh)) {
    const isMesh = b.pool === 'meshShutterInterlock';
    rows.push({
      id: isMesh ? 'interlock-slim-mesh' : 'interlock-slim-glass',
      title: isMesh ? 'Interlock — slim (vertical, mesh)' : 'Interlock — slim (vertical, glass)',
      block: b,
    });
  }

  const reinfLines = merged.filter((l) => l.role === 'shutterReinfInterlock');
  for (const b of buildPoolBlocksFromLines(series, reinfLines, separateMesh)) {
    const isMesh = b.pool === 'meshShutterInterlock';
    rows.push({
      id: isMesh ? 'interlock-reinf-mesh' : 'interlock-reinf-glass',
      title: isMesh ? 'Interlock — reinforcement (vertical, mesh)' : 'Interlock — reinforcement (vertical, glass)',
      block: b,
    });
  }

  const st = onePoolBlock('shutterFrame');
  if (st) {
    rows.push({
      id: 'shutter-tbh',
      title: separateMesh
        ? 'Shutter — top, bottom, handle (glass run)'
        : 'Shutter — top, bottom, handle (all shutters)',
      block: st,
    });
  }

  const ms = onePoolBlock('meshShutterFrame');
  if (ms) {
    rows.push({
      id: 'mesh-tbh',
      title: 'Mesh shutter — top, bottom, handle (separate stock)',
      block: ms,
    });
  }

  const tc = onePoolBlock('trackClip');
  if (tc) {
    rows.push({
      id: 'track-clip',
      title: 'Track clips (accessory)',
      block: tc,
    });
  }

  return rows;
}

export interface SlidingSeriesCutReport {
  seriesName: string;
  separateMesh: boolean;
  /** 25–29mm style: H+V same section, one stock pool per 2T/3T. False = split track/jamb (e.g. 35mm). */
  unifiedSlidingOuter: boolean;
  seriesPools: PoolCutBlock[];
  /** Shop “req. materials” list — slim / reinf alag, mesh alag jab user ne separate kiya. */
  materialPurchase: MaterialPurchaseRow[];
  lineBreakdown: QuotationLineCutBlock[];
}

function mergeSizeRows(
  lineContributions: { lengthMm: number; count: number; label: string }[]
): CutSizeRow[] {
  const byLen = new Map<
    number,
    { count: number; labels: Set<string> }
  >();
  for (const c of lineContributions) {
    const k = Math.round(c.lengthMm);
    const e = byLen.get(k) ?? { count: 0, labels: new Set<string>() };
    e.count += c.count;
    e.labels.add(c.label);
    byLen.set(k, e);
  }
  return [...byLen.entries()]
    .sort((a, b) => b[0] - a[0])
    .map(([lengthMm, { count, labels }]) => ({
      lengthMm,
      pieceCount: count,
      partLabels: [...labels].sort(),
    }));
}

function buildPoolBlocksFromLines(
  series: QuotationItem['config']['series'],
  lines: SlidingCostLine[],
  separateMesh: boolean
): PoolCutBlock[] {
  const byPool = new Map<
    SlidingPiecePool,
    {
      lengthPieces: { lengthMm: number; count: number; label: string }[];
      weightKg: number;
    }
  >();

  for (const line of lines) {
    if (!byPool.has(line.pool)) {
      byPool.set(line.pool, { lengthPieces: [], weightKg: 0 });
    }
    const p = byPool.get(line.pool)!;
    p.lengthPieces.push({
      lengthMm: line.pieceLengthMm,
      count: line.pieces,
      label: line.label,
    });
    p.weightKg += line.aluminiumWeightKg;
  }

  const out: PoolCutBlock[] = [];
  for (const pool of POOL_DISPLAY_ORDER) {
    const b = byPool.get(pool);
    if (!b || b.lengthPieces.length === 0) continue;

    const sizeRows = mergeSizeRows(b.lengthPieces);
    const allLengths: number[] = [];
    for (const c of b.lengthPieces) {
      for (let i = 0; i < c.count; i++) {
        allLengths.push(c.lengthMm);
      }
    }
    const std = stockLengthMmForPool(series, pool);
    const requiredBars = packPieces(allLengths, std);
    const totalLengthMm = allLengths.reduce((s, l) => s + l, 0);
    const purchasedLengthMm = requiredBars * std;
    const wastageMm = Math.max(0, purchasedLengthMm - totalLengthMm);
    const wastagePercent = purchasedLengthMm > 0 ? (wastageMm / purchasedLengthMm) * 100 : 0;
    out.push({
      pool,
      title: poolTitle(pool, separateMesh),
      stockKeyLabel: profileLabelForPool(pool),
      standardLengthMm: std,
      sizeRows,
      totalPieceCount: allLengths.length,
      totalLengthMm,
      requiredBars,
      purchasedLengthMm,
      wastageMm,
      wastagePercent,
      totalWeightKg: b.weightKg,
    });
  }
  return out;
}

/**
 * Full sliding-only BOM-style cut + wastage report for one series (aggregated + per quotation line).
 */
export function buildSlidingSeriesCutReport(
  seriesId: string,
  items: QuotationItem[],
  rates: MaterialRateSettings,
  options: { separateMeshSections: boolean }
): SlidingSeriesCutReport | null {
  const separateMesh = options.separateMeshSections;
  const slidingItems = items.filter(
    (i) =>
      i.config.series.id === seriesId &&
      i.config.windowType === WindowType.SLIDING &&
      (Number(i.quantity) || 0) > 0
  );
  if (slidingItems.length === 0) return null;

  const baseSeries = slidingItems[0]!.config.series;
  const seriesName = baseSeries.name;

  const lineQuantities: { line: SlidingCostLine; mult: number }[] = [];
  for (const item of slidingItems) {
    const plan = getSlidingCuttingPlanPerWindow(item, rates, { separateMeshSections: separateMesh });
    if (!plan) continue;
    const q = Math.max(0, Number(item.quantity) || 0);
    for (const line of plan.lines) {
      lineQuantities.push({ line, mult: q });
    }
  }

  if (lineQuantities.length === 0) return null;

  const mergedForSeries: SlidingCostLine[] = [];
  for (const { line, mult } of lineQuantities) {
    mergedForSeries.push({
      ...line,
      pieces: line.pieces * mult,
      totalLengthFt: line.totalLengthFt * mult,
      powderCost: line.powderCost * mult,
      aluminiumWeightKg: line.aluminiumWeightKg * mult,
      aluminiumCost: line.aluminiumCost * mult,
      totalCost: line.totalCost * mult,
    });
  }

  const seriesPools = buildPoolBlocksFromLines(baseSeries, mergedForSeries, separateMesh);

  const lineBreakdown: QuotationLineCutBlock[] = [];
  for (const item of slidingItems) {
    const plan = getSlidingCuttingPlanPerWindow(item, rates, { separateMeshSections: separateMesh });
    if (!plan) continue;
    const q = Math.max(0, Number(item.quantity) || 0);
    if (q <= 0) continue;

    const perWindowMerged: SlidingCostLine[] = plan.lines.map((line) => ({
      ...line,
      pieces: line.pieces * q,
      totalLengthFt: line.totalLengthFt * q,
      powderCost: line.powderCost * q,
      aluminiumWeightKg: line.aluminiumWeightKg * q,
      aluminiumCost: line.aluminiumCost * q,
      totalCost: line.totalCost * q,
    }));

    const cutRows: QuotationLineCutRow[] = perWindowMerged.map((line) => ({
      label: line.label,
      pool: line.pool,
      lengthMm: line.pieceLengthMm,
      totalPieces: line.pieces,
      cutAngles: line.cutAngles,
    }));
    const perPool = buildPoolBlocksFromLines(item.config.series, perWindowMerged, separateMesh);
    const perWindowLayout = buildPerWindowLayout(plan.lines, plan.layout.trackCount);
    lineBreakdown.push({
      itemId: item.id,
      title: item.title,
      quantity: q,
      widthMm: plan.layout.apertureWidthMm,
      heightMm: plan.layout.apertureHeightMm,
      trackCount: plan.layout.trackCount,
      meshSeparated: plan.layout.meshSectionsSeparated,
      perWindowLayout,
      cutRows,
      perPool,
    });
  }

  const materialPurchase = buildMaterialPurchase(mergedForSeries, baseSeries, separateMesh);
  const unifiedSlidingOuter = isSlidingSeriesUnifiedOuter(baseSeries);
  return { seriesName, separateMesh, unifiedSlidingOuter, seriesPools, materialPurchase, lineBreakdown };
}

export function fmtMmRuler(mm: number): string {
  return `${Math.round(mm * 10) / 10} mm`;
}

export function poolBlocksToRftWastageFt(block: PoolCutBlock): { usedFt: number; wasteFt: number; stockFt: number } {
  const usedFt = (block.totalLengthMm / 1000) * 3.28084;
  const wasteFt = (block.wastageMm / 1000) * 3.28084;
  const stockFt = (block.purchasedLengthMm / 1000) * 3.28084;
  return { usedFt, wasteFt, stockFt };
}
