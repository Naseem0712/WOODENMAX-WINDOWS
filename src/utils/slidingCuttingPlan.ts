import type { MaterialRateSettings, QuotationItem, ProfileDimensions, FixedPanel } from '../types';
import { FixedPanelPosition, WindowType } from '../types';
import {
  computeSlidingCutLayout,
  isSlidingSeriesUnifiedOuter,
  type SlidingCutAngle,
  type SlidingCutLayout,
  type SlidingPieceRole,
  type SlidingPiecePool,
  type SlidingShutterType,
} from './slidingCutFormula';

const MM_TO_FT = 0.00328084;

type ProfileKey = keyof ProfileDimensions;

export interface SlidingCostLine {
  label: string;
  pieces: number;
  /** Exact fabrication length of a single piece in mm. */
  pieceLengthMm: number;
  /** Kept for legacy display (ft). */
  pieceLengthFt: number;
  /** Two-end cut angles (e.g. '45-45', '45-90', '90-90'). */
  cutAngles: SlidingCutAngle;
  role: SlidingPieceRole;
  pool: SlidingPiecePool;
  shutterType: SlidingShutterType;
  totalLengthFt: number;
  powderRatePerRft: number;
  powderCost: number;
  aluminiumWeightKg: number;
  aluminiumCost: number;
  totalCost: number;
}

export interface SlidingPerWindowPlan {
  layout: {
    apertureWidthMm: number;
    apertureHeightMm: number;
    shutterCutWidthMm: number;
    shutterCutHeightMm: number;
    trackClipLengthMm: number;
    glassCutWidthMm: number;
    glassCutHeightMm: number;
    numGlassShutters: number;
    numMeshShutters: number;
    numShutters: number;
    trackCount: 2 | 3;
    interlockThicknessMm: number;
    meshSectionsSeparated: boolean;
    unifiedSlidingOuterPerimeter: boolean;
  };
  lines: SlidingCostLine[];
  totals: {
    totalLengthFt: number;
    powderCost: number;
    aluminiumWeightKg: number;
    aluminiumCost: number;
    totalCost: number;
    glassAreaSqFt: number;
    glassRatePerSqFt: number;
    glassCost: number;
  };
}

export interface SlidingCuttingPlanOptions {
  /** Pool mesh top/bottom/handle/interlock into their own separate stock
   *  pools instead of sharing with glass (default false). */
  separateMeshSections?: boolean;
}

const toFt = (mm: number) => mm * MM_TO_FT;

const getWeightPerMeter = (item: QuotationItem, key: ProfileKey): number => {
  const w = Number(item.config.series.weights?.[key]);
  return Number.isFinite(w) && w > 0 ? w : 0;
};

const getGlassRate = (item: QuotationItem, rates: MaterialRateSettings): number => {
  const config = item.config;
  if (config.glassSpecialType === 'laminated') {
    const c = config.laminatedGlassConfig;
    const combo = `${Number(c?.glass1Thickness) || 0}+${Number(c?.glass2Thickness) || 0}`;
    if (combo === '5+5') return rates.glassPerSqFt.laminated['5+5'];
    if (combo === '6+6') return rates.glassPerSqFt.laminated['6+6'];
    return 0;
  }
  if (config.glassSpecialType === 'dgu') {
    const c = config.dguGlassConfig;
    const combo = `${Number(c?.glass1Thickness) || 0}+${Number(c?.airGap) || 0}+${Number(c?.glass2Thickness) || 0}`;
    if (combo === '6+12+6') return rates.glassPerSqFt.dgu['6+12+6'];
    if (combo === '5+12+5') return rates.glassPerSqFt.dgu['5+12+5'];
    return 0;
  }
  const thickness = String(Number(config.glassThickness) || 0) as '5' | '6' | '8' | '10' | '12';
  return rates.glassPerSqFt.clear[thickness] || 0;
};

/** Width/height of the region shutters actually span after fixed panels. */
function getShutterAperture(item: QuotationItem): { widthMm: number; heightMm: number } {
  const w = Math.max(0, Number(item.config.width) || 0);
  const h = Math.max(0, Number(item.config.height) || 0);
  const panels: FixedPanel[] = item.config.fixedPanels || [];
  const topFix = panels.find((p) => p.position === FixedPanelPosition.TOP)?.size || 0;
  const bottomFix = panels.find((p) => p.position === FixedPanelPosition.BOTTOM)?.size || 0;
  const leftFix = panels.find((p) => p.position === FixedPanelPosition.LEFT)?.size || 0;
  const rightFix = panels.find((p) => p.position === FixedPanelPosition.RIGHT)?.size || 0;
  return {
    widthMm: Math.max(0, w - leftFix - rightFix),
    heightMm: Math.max(0, h - topFix - bottomFix),
  };
}

function poolPowderRate(pool: SlidingPiecePool, role: SlidingPieceRole, rates: MaterialRateSettings): number {
  const powder = rates.powderCoatingPerRft;
  if (pool === 'trackClip') {
    const v = Number(powder.trackClip);
    return Number.isFinite(v) && v >= 0 ? v : 90;
  }
  if (
    pool === 'outerPerimeter2T' ||
    pool === 'outerPerimeter3T' ||
    pool === 'outerTrack2T' ||
    pool === 'outerTrack3T' ||
    pool === 'outerJamb2T' ||
    pool === 'outerJamb3T'
  ) {
    return Number(powder.track) || 0;
  }
  if (role === 'shutterSlimInterlock') return Number(powder.slimInterlock) || 0;
  // Reinforcement interlock and all shutter-frame sections share the
  // general "shutter sections" powder rate.
  return Number(powder.shutterSections) || 0;
}

/** Read `weights[key]` only when the corresponding dimension is actually set
 *  on the series — otherwise we might attribute a phantom weight to a profile
 *  the fabricator doesn't actually use. */
function hasDimension(item: QuotationItem, key: ProfileKey): boolean {
  const dim = item.config.series.dimensions?.[key];
  return dim !== undefined && dim !== '' && Number(dim) > 0;
}

function firstDefinedWeight(item: QuotationItem, ...keys: ProfileKey[]): number {
  for (const key of keys) {
    if (!hasDimension(item, key)) continue;
    const w = getWeightPerMeter(item, key);
    if (w > 0) return w;
  }
  // If no dimension is set, fall back to any key that has a weight anyway
  // (very old series data missing dimension fields).
  for (const key of keys) {
    const w = getWeightPerMeter(item, key);
    if (w > 0) return w;
  }
  return 0;
}

function poolWeightPerMeter(item: QuotationItem, pool: SlidingPiecePool, _role: SlidingPieceRole): number {
  switch (pool) {
    case 'trackClip':
      return 0; // billed as separate accessory.
    case 'outerPerimeter2T':
      return firstDefinedWeight(item, 'track2T', 'jamb2T', 'outerFrameVertical', 'outerFrame');
    case 'outerPerimeter3T':
      return firstDefinedWeight(item, 'track3T', 'jamb3T', 'outerFrameVertical', 'outerFrame');
    case 'outerTrack2T':
      return firstDefinedWeight(item, 'track2T', 'outerFrame');
    case 'outerTrack3T':
      return firstDefinedWeight(item, 'track3T', 'outerFrame');
    case 'outerJamb2T':
      return firstDefinedWeight(item, 'jamb2T', 'outerFrameVertical', 'outerFrame');
    case 'outerJamb3T':
      return firstDefinedWeight(item, 'jamb3T', 'outerFrameVertical', 'outerFrame');
    case 'shutterFrame':
      return firstDefinedWeight(item, 'shutterTop', 'shutterBottom', 'shutterHandle');
    case 'shutterInterlock':
      return firstDefinedWeight(item, 'shutterInterlock');
    case 'meshShutterFrame':
      return firstDefinedWeight(item, 'shutterBottom', 'shutterTop', 'shutterHandle');
    case 'meshShutterInterlock':
      return firstDefinedWeight(item, 'shutterMeeting', 'shutterInterlock');
    default:
      return 0;
  }
}

export function getSlidingCuttingPlanPerWindow(
  item: QuotationItem,
  rates: MaterialRateSettings,
  options?: SlidingCuttingPlanOptions
): SlidingPerWindowPlan | null {
  if (item.config.windowType !== WindowType.SLIDING) return null;
  const config = item.config;
  if (!config || !config.series) return null;

  const { widthMm: apertureWidthMm, heightMm: apertureHeightMm } = getShutterAperture(item);
  if (apertureWidthMm <= 0 || apertureHeightMm <= 0) return null;

  const interlockThicknessMm = Number(config.series.dimensions?.shutterInterlock) || 0;

  const layout: SlidingCutLayout = computeSlidingCutLayout({
    apertureWidthMm,
    apertureHeightMm,
    shutterConfig: config.shutterConfig,
    trackType: config.trackType,
    interlockThicknessMm,
    separateMeshSections: !!options?.separateMeshSections,
    unifiedOuterPerimeter: isSlidingSeriesUnifiedOuter(config.series),
  });

  const lines: SlidingCostLine[] = layout.pieces.map((piece) => {
    const pieceLengthFt = toFt(piece.lengthMm);
    const totalLengthFt = pieceLengthFt * piece.pieces;
    const powderRatePerRft = poolPowderRate(piece.pool, piece.role, rates);
    const powderCost = totalLengthFt * powderRatePerRft;
    const weightPerMeter = poolWeightPerMeter(item, piece.pool, piece.role);
    const totalLengthMeters = (piece.lengthMm * piece.pieces) / 1000;
    const aluminiumWeightKg = totalLengthMeters * weightPerMeter;
    const aluminiumCost = aluminiumWeightKg * rates.aluminiumProfilePerKg;
    return {
      label: piece.label,
      pieces: piece.pieces,
      pieceLengthMm: piece.lengthMm,
      pieceLengthFt,
      cutAngles: piece.cutAngles,
      role: piece.role,
      pool: piece.pool,
      shutterType: piece.shutterType,
      totalLengthFt,
      powderRatePerRft,
      powderCost,
      aluminiumWeightKg,
      aluminiumCost,
      totalCost: powderCost + aluminiumCost,
    };
  });

  const glassPanelAreaMm2 = layout.glassWidthMm * layout.glassHeightMm;
  const glassAreaMm2 = glassPanelAreaMm2 * layout.counts.glass;
  const glassAreaSqFt = glassAreaMm2 * MM_TO_FT * MM_TO_FT;
  const glassRatePerSqFt = getGlassRate(item, rates);
  const glassCost = glassAreaSqFt * glassRatePerSqFt;

  const totalLengthFt = lines.reduce((sum, l) => sum + l.totalLengthFt, 0);
  const powderCost = lines.reduce((sum, l) => sum + l.powderCost, 0);
  const aluminiumWeightKg = lines.reduce((sum, l) => sum + l.aluminiumWeightKg, 0);
  const aluminiumCost = lines.reduce((sum, l) => sum + l.aluminiumCost, 0);

  return {
    layout: {
      apertureWidthMm: layout.apertureWidthMm,
      apertureHeightMm: layout.apertureHeightMm,
      shutterCutWidthMm: layout.horizontalCutMm,
      shutterCutHeightMm: layout.verticalCutMm,
      trackClipLengthMm: layout.trackClipLengthMm,
      glassCutWidthMm: layout.glassWidthMm,
      glassCutHeightMm: layout.glassHeightMm,
      numGlassShutters: layout.counts.glass,
      numMeshShutters: layout.counts.mesh,
      numShutters: layout.counts.total,
      trackCount: layout.trackCount,
      interlockThicknessMm: interlockThicknessMm || 0,
      meshSectionsSeparated: layout.meshSectionsSeparated,
      unifiedSlidingOuterPerimeter: layout.unifiedSlidingOuterPerimeter,
    },
    lines,
    totals: {
      totalLengthFt,
      powderCost,
      aluminiumWeightKg,
      aluminiumCost,
      totalCost: powderCost + aluminiumCost + glassCost,
      glassAreaSqFt,
      glassRatePerSqFt,
      glassCost,
    },
  };
}
