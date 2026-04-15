import type { MaterialRateSettings, QuotationItem, ProfileDimensions } from '../types';
import { ShutterConfigType, TrackType, WindowType } from '../types';

const MM_TO_FT = 0.00328084;

type ProfileKey = keyof ProfileDimensions;

export interface SlidingCostLine {
  label: string;
  pieces: number;
  pieceLengthFt: number;
  totalLengthFt: number;
  powderRatePerRft: number;
  powderCost: number;
  aluminiumWeightKg: number;
  aluminiumCost: number;
  totalCost: number;
}

export interface SlidingPerWindowPlan {
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

const toFt = (mm: number) => mm * MM_TO_FT;

const getWeightPerMeter = (item: QuotationItem, key: ProfileKey): number => {
  return Number(item.config.series.weights?.[key]) || 0;
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

export function getSlidingCuttingPlanPerWindow(
  item: QuotationItem,
  rates: MaterialRateSettings
): SlidingPerWindowPlan | null {
  if (item.config.windowType !== WindowType.SLIDING) return null;

  const config = item.config;
  const widthFt = toFt(Number(config.width) || 0);
  const heightFt = toFt(Number(config.height) || 0);
  if (widthFt <= 0 || heightFt <= 0) return null;

  const isReinforcementSeries = /reinf|reinforcement/i.test(`${config.series.name} ${config.series.id}`);
  const trackCount = Number(config.trackType) === TrackType.THREE_TRACK ? 3 : 2;
  const hasMesh = config.shutterConfig === ShutterConfigType.TWO_GLASS_ONE_MESH;
  const baseShutterWidthFt = widthFt / 2;

  const addLine = (
    acc: SlidingCostLine[],
    label: string,
    pieces: number,
    pieceLengthFt: number,
    powderRatePerRft: number,
    weightKg: number
  ) => {
    const totalLengthFt = pieces * pieceLengthFt;
    const powderCost = totalLengthFt * powderRatePerRft;
    const aluminiumCost = weightKg * rates.aluminiumProfilePerKg;
    acc.push({
      label,
      pieces,
      pieceLengthFt,
      totalLengthFt,
      powderRatePerRft,
      powderCost,
      aluminiumWeightKg: weightKg,
      aluminiumCost,
      totalCost: powderCost + aluminiumCost,
    });
  };

  const lines: SlidingCostLine[] = [];

  // 1) Outer frame/track all side: width*2 + height*2 (as user-cutting-plan style)
  const outerFrameWeightPerMeter = getWeightPerMeter(item, 'outerFrame');
  const outerFrameVerticalWeightPerMeter = getWeightPerMeter(item, 'outerFrameVertical') || outerFrameWeightPerMeter;
  const outerFrameWeightKg =
    ((2 * (Number(config.width) || 0)) / 1000) * outerFrameWeightPerMeter +
    ((2 * (Number(config.height) || 0)) / 1000) * outerFrameVerticalWeightPerMeter;
  addLine(lines, 'All Side Track', 4, (widthFt + heightFt) / 2, rates.powderCoatingPerRft.track, outerFrameWeightKg);

  // 2) Track clips: width in each track lane
  addLine(lines, `Track Clip (${trackCount} Track)`, trackCount, widthFt, rates.powderCoatingPerRft.track, 0);

  // 3) Glass shutter sections
  const topWeightPerMeter = getWeightPerMeter(item, 'shutterTop');
  const bottomWeightPerMeter = getWeightPerMeter(item, 'shutterBottom');
  const handleWeightPerMeter = getWeightPerMeter(item, 'shutterHandle');
  const interlockWeightPerMeter = getWeightPerMeter(item, 'shutterInterlock');

  const glassShutterTopBottomWeightKg =
    (((4 * baseShutterWidthFt) / MM_TO_FT) / 1000) * ((topWeightPerMeter + bottomWeightPerMeter) / 2);
  addLine(
    lines,
    'Glass Shutter Top+Bottom',
    4,
    baseShutterWidthFt,
    rates.powderCoatingPerRft.shutterSections,
    glassShutterTopBottomWeightKg
  );

  const glassHandleWeightKg = (((2 * heightFt) / MM_TO_FT) / 1000) * handleWeightPerMeter;
  addLine(
    lines,
    'Glass Shutter Vertical Handle Side',
    2,
    heightFt,
    rates.powderCoatingPerRft.shutterSections,
    glassHandleWeightKg
  );

  const glassMidSlimCount = isReinforcementSeries ? 1 : 2;
  const glassMidReinfCount = isReinforcementSeries ? 1 : 0;
  const glassSlimWeightKg = (((glassMidSlimCount * heightFt) / MM_TO_FT) / 1000) * interlockWeightPerMeter;
  addLine(lines, 'Glass Mid Slim Interlock', glassMidSlimCount, heightFt, rates.powderCoatingPerRft.slimInterlock, glassSlimWeightKg);
  if (glassMidReinfCount > 0) {
    const reinfWeightKg = (((heightFt) / MM_TO_FT) / 1000) * interlockWeightPerMeter;
    addLine(lines, 'Glass Mid Reinforcement Interlock', 1, heightFt, rates.powderCoatingPerRft.shutterSections, reinfWeightKg);
  }

  // 4) Mesh sections only when shutter config has mesh
  if (hasMesh) {
    const meshTopBottomWeightKg =
      (((2 * baseShutterWidthFt) / MM_TO_FT) / 1000) * ((topWeightPerMeter + bottomWeightPerMeter) / 2);
    addLine(
      lines,
      'Mesh Shutter Top+Bottom',
      2,
      baseShutterWidthFt,
      rates.powderCoatingPerRft.shutterSections,
      meshTopBottomWeightKg
    );

    const meshHandleWeightKg = (((heightFt) / MM_TO_FT) / 1000) * handleWeightPerMeter;
    addLine(
      lines,
      'Mesh Shutter Vertical Handle Side',
      1,
      heightFt,
      rates.powderCoatingPerRft.shutterSections,
      meshHandleWeightKg
    );

    const meshInterlockWeightKg = (((heightFt) / MM_TO_FT) / 1000) * interlockWeightPerMeter;
    addLine(lines, 'Mesh Slim Interlock', 1, heightFt, rates.powderCoatingPerRft.slimInterlock, meshInterlockWeightKg);
  }

  const glassAreaSqFt = widthFt * heightFt;
  const glassRatePerSqFt = getGlassRate(item, rates);
  const glassCost = glassAreaSqFt * glassRatePerSqFt;

  const totalLengthFt = lines.reduce((sum, l) => sum + l.totalLengthFt, 0);
  const powderCost = lines.reduce((sum, l) => sum + l.powderCost, 0);
  const aluminiumWeightKg = lines.reduce((sum, l) => sum + l.aluminiumWeightKg, 0);
  const aluminiumCost = lines.reduce((sum, l) => sum + l.aluminiumCost, 0);

  return {
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
