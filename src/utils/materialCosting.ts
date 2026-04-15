import type { MaterialRateSettings, ProfileDimensions, QuotationItem } from '../types';
import { ShutterConfigType, WindowType } from '../types';
import { calculateUsageForConfig, packPieces } from './materialCalculator';

const SQFT_TO_SQMM = 92903.04;
const MM_TO_FT = 0.00328084;

type ProfileKey = keyof ProfileDimensions;

type PoolProfileType = ProfileKey | 'shutterInterlock_slim' | 'shutterInterlock_reinf';

interface PoolContribution {
  itemId: string;
  usedLengthMm: number;
}

interface AluminiumPool {
  key: string;
  profileType: PoolProfileType;
  standardLengthMm: number;
  weightPerMeter: number;
  powderRatePerRft: number;
  pieces: number[];
  usedLengthMm: number;
  contributions: PoolContribution[];
}

export interface MaterialCostPerItem {
  itemId: string;
  title: string;
  areaSqFt: number;
  aluminiumCost: number;
  powderCoatingCost: number;
  glassCost: number;
  meshCost: number;
  makingCost: number;
  hardwareCost: number;
  wastageCartageCost: number;
  profitCost: number;
  totalCost: number;
  basicRatePerSqFt: number;
}

export interface MaterialCostSummary {
  byItemId: Record<string, MaterialCostPerItem>;
  totals: {
    areaSqFt: number;
    aluminiumCost: number;
    powderCoatingCost: number;
    glassCost: number;
    meshCost: number;
    makingCost: number;
    hardwareCost: number;
    wastageCartageCost: number;
    profitCost: number;
    usedLengthFt: number;
    purchasedLengthFt: number;
    wastageLengthFt: number;
    usedWeightKg: number;
    purchasedWeightKg: number;
    wastageWeightKg: number;
    wastageAluminiumCost: number;
    wastagePowderCost: number;
    totalCost: number;
    basicRatePerSqFt: number;
  };
}

const getSeriesFamilyKey = (seriesId: string): string => {
  return seriesId.replace(/-slim-/g, '-interlock-').replace(/-reinf-/g, '-interlock-');
};

const isReinforcementSeries = (item: QuotationItem): boolean => {
  return /reinf|reinforcement/i.test(`${item.config.series.name} ${item.config.series.id}`);
};

const getGlassRatePerSqFt = (item: QuotationItem, rates: MaterialRateSettings): number => {
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

const resolveSlidingPowderRate = (item: QuotationItem, profileType: PoolProfileType, rates: MaterialRateSettings): number => {
  if (profileType === 'outerFrame' || profileType === 'outerFrameVertical') {
    return rates.powderCoatingPerRft.track;
  }
  if (profileType === 'shutterInterlock_reinf') {
    return rates.powderCoatingPerRft.shutterSections;
  }
  if (profileType === 'shutterInterlock_slim') {
    return rates.powderCoatingPerRft.slimInterlock;
  }
  if (profileType === 'shutterHandle' || profileType === 'shutterTop' || profileType === 'shutterBottom' || profileType === 'shutterMeeting') {
    return rates.powderCoatingPerRft.shutterSections;
  }
  return 0;
};

const ensureItem = (
  result: Record<string, MaterialCostPerItem>,
  item: QuotationItem
): MaterialCostPerItem => {
  if (!result[item.id]) {
    const qty = Number(item.quantity) || 0;
    const areaSqFtPerWindow = ((Number(item.config.width) || 0) * (Number(item.config.height) || 0)) / SQFT_TO_SQMM;
    result[item.id] = {
      itemId: item.id,
      title: item.title,
      areaSqFt: areaSqFtPerWindow * qty,
      aluminiumCost: 0,
      powderCoatingCost: 0,
      glassCost: 0,
      meshCost: 0,
      makingCost: 0,
      hardwareCost: 0,
      wastageCartageCost: 0,
      profitCost: 0,
      totalCost: 0,
      basicRatePerSqFt: 0,
    };
  }
  return result[item.id];
};

const getSlidingShutterDetails = (
  item: QuotationItem
): {
  shutterCount: number;
  meshShutterCount: number;
  operableGlassCount: number;
  operableMeshCount: number;
  operableTotalCount: number;
} => {
  if (item.config.windowType !== WindowType.SLIDING) {
    return { shutterCount: 0, meshShutterCount: 0, operableGlassCount: 0, operableMeshCount: 0, operableTotalCount: 0 };
  }

  let glassIndices: number[] = [];
  let meshIndices: number[] = [];
  switch (item.config.shutterConfig) {
    case ShutterConfigType.TWO_GLASS:
      glassIndices = [0, 1];
      break;
    case ShutterConfigType.THREE_GLASS:
      glassIndices = [0, 1, 2];
      break;
    case ShutterConfigType.TWO_GLASS_ONE_MESH:
      glassIndices = [0, 1];
      meshIndices = [2];
      break;
    case ShutterConfigType.FOUR_GLASS:
      glassIndices = [0, 1, 2, 3];
      break;
    case ShutterConfigType.FOUR_GLASS_TWO_MESH:
      glassIndices = [0, 1, 4, 5];
      meshIndices = [2, 3];
      break;
    default:
      glassIndices = [];
      meshIndices = [];
      break;
  }

  const fixedFlags = item.config.fixedShutters || [];
  const operableGlassCount = glassIndices.filter((idx) => !fixedFlags[idx]).length;
  const operableMeshCount = meshIndices.filter((idx) => !fixedFlags[idx]).length;
  return {
    shutterCount: glassIndices.length + meshIndices.length,
    meshShutterCount: meshIndices.length,
    operableGlassCount,
    operableMeshCount,
    operableTotalCount: operableGlassCount + operableMeshCount,
  };
};

export function calculateMaterialCostSummary(
  items: QuotationItem[],
  rates: MaterialRateSettings,
  makingChargePerSqFt = rates.makingChargePerSqFt || 120
): MaterialCostSummary {
  const byItemId: Record<string, MaterialCostPerItem> = {};
  const pools = new Map<string, AluminiumPool>();

  for (const item of items) {
    const target = ensureItem(byItemId, item);
    const qty = Number(item.quantity) || 0;
    if (qty <= 0) continue;

    const usageSingle = calculateUsageForConfig(item.config);
    const familyKey = item.config.windowType === WindowType.SLIDING ? getSeriesFamilyKey(item.config.series.id) : item.config.series.id;

    // Glass cost + making cost per item (area based)
    const totalGlassAreaSqFt = Array.from(usageSingle.glass.values()).reduce((sum, areaMm2) => sum + areaMm2 / SQFT_TO_SQMM, 0) * qty;
    target.glassCost += totalGlassAreaSqFt * getGlassRatePerSqFt(item, rates);
    target.makingCost += target.areaSqFt * makingChargePerSqFt;
    target.wastageCartageCost += target.areaSqFt * (Number(rates.wastageCartagePerSqFt) || 0);

    // Sliding hardware cost from existing hardware item list
    if (item.config.windowType === WindowType.SLIDING) {
      const { shutterCount, meshShutterCount, operableGlassCount, operableMeshCount, operableTotalCount } = getSlidingShutterDetails(item);
      const meshAreaSqFtPerShutter = (((Number(item.config.width) || 0) / 2) * (Number(item.config.height) || 0)) / SQFT_TO_SQMM;
      target.meshCost += meshShutterCount * meshAreaSqFtPerShutter * (Number(rates.meshPerSqFt) || 0) * qty;
      const hasMeshHandleItem = item.hardwareItems.some((hw) => {
        const n = (hw.name || '').toLowerCase();
        return n.includes('mesh') && n.includes('handle');
      });
      const perWindowCost = item.hardwareItems.reduce((sum, hw) => {
        const itemQty = Number(hw.qtyPerShutter) || 0;
        const itemRate = Number(hw.rate) || 0;
        const name = (hw.name || '').toLowerCase();
        let units = 0;
        if (hw.unit === 'per_window') {
          units = 1;
        } else if (name.includes('mesh lock')) {
          units = operableMeshCount;
        } else if (name.includes('mesh') && name.includes('handle')) {
          units = operableMeshCount;
        } else if (name.includes('handle')) {
          units = hasMeshHandleItem ? operableGlassCount : operableTotalCount;
        } else if (name.includes('bearing')) {
          units = operableTotalCount;
        } else {
          units = shutterCount;
        }
        return sum + (itemQty * itemRate * units);
      }, 0);
      target.hardwareCost += perWindowCost * qty;

      if (rates.meshShutterOptions.separateSections && meshShutterCount > 0) {
        const clipPieces = meshShutterCount * (Number(rates.meshShutterOptions.meshClipPerMeshShutter) || 0) * qty;
        const clipWeightKg = clipPieces * (Number(rates.meshShutterOptions.meshClipWeightKgPerPc) || 0);
        const clipLengthFt = clipPieces * (Number(rates.meshShutterOptions.meshClipLengthFt) || 0);
        target.aluminiumCost += clipWeightKg * rates.aluminiumProfilePerKg;
        target.powderCoatingCost += clipLengthFt * (Number(rates.meshShutterOptions.meshClipPowderRatePerRft) || 0);
      }
    }

    // Powder coating track clips as pure length item (outside pooled bars)
    if (item.config.windowType === WindowType.SLIDING) {
      const widthFt = (Number(item.config.width) || 0) * MM_TO_FT;
      const trackCount = Number(item.config.trackType) || 2;
      target.powderCoatingCost += widthFt * trackCount * qty * rates.powderCoatingPerRft.track;
    }

    for (const [profileKey, pieces] of usageSingle.profiles.entries()) {
      const standardLengthMm = Number(item.config.series.lengths?.[profileKey]) || (16 * 304.8);
      const weightPerMeter = Number(item.config.series.weights?.[profileKey]) || 0;
      const repeatedPieces = Array.from({ length: qty }).flatMap(() => pieces);
      const usedLengthMm = repeatedPieces.reduce((sum, len) => sum + len, 0);

      let profileType: PoolProfileType = profileKey;
      if (profileKey === 'shutterInterlock') {
        profileType = isReinforcementSeries(item) ? 'shutterInterlock_reinf' : 'shutterInterlock_slim';
      }

      const poolKey = `${familyKey}|${profileType}|${standardLengthMm}|${weightPerMeter}`;
      const powderRatePerRft =
        item.config.windowType === WindowType.SLIDING
          ? resolveSlidingPowderRate(item, profileType, rates)
          : 0;
      if (!pools.has(poolKey)) {
        pools.set(poolKey, {
          key: poolKey,
          profileType,
          standardLengthMm,
          weightPerMeter,
          powderRatePerRft,
          pieces: [],
          usedLengthMm: 0,
          contributions: [],
        });
      }
      const pool = pools.get(poolKey)!;
      pool.pieces.push(...repeatedPieces);
      pool.usedLengthMm += usedLengthMm;
      pool.contributions.push({ itemId: item.id, usedLengthMm });

    }
  }

  // Aluminium + profile powder cost with wastage reuse through pooled bin-packing
  for (const pool of pools.values()) {
    const requiredBars = packPieces(pool.pieces, pool.standardLengthMm);
    const usedLengthMm = pool.usedLengthMm;
    const purchasedLengthMm = requiredBars * pool.standardLengthMm;
    const usedLengthFt = usedLengthMm * MM_TO_FT;
    const purchasedLengthFt = purchasedLengthMm * MM_TO_FT;
    const purchasedWeightKg = (purchasedLengthMm / 1000) * pool.weightPerMeter;
    const purchasedCost = purchasedWeightKg * rates.aluminiumProfilePerKg;
    const purchasedPowderCost = purchasedLengthFt * pool.powderRatePerRft;

    for (const contribution of pool.contributions) {
      const ratio = pool.usedLengthMm > 0 ? contribution.usedLengthMm / pool.usedLengthMm : 0;
      byItemId[contribution.itemId].aluminiumCost += purchasedCost * ratio;
      byItemId[contribution.itemId].powderCoatingCost += purchasedPowderCost * ratio;
    }
  }

  const totals = {
    areaSqFt: 0,
    aluminiumCost: 0,
    powderCoatingCost: 0,
    glassCost: 0,
    meshCost: 0,
    makingCost: 0,
    hardwareCost: 0,
    wastageCartageCost: 0,
    profitCost: 0,
    usedLengthFt: 0,
    purchasedLengthFt: 0,
    wastageLengthFt: 0,
    usedWeightKg: 0,
    purchasedWeightKg: 0,
    wastageWeightKg: 0,
    wastageAluminiumCost: 0,
    wastagePowderCost: 0,
    totalCost: 0,
    basicRatePerSqFt: 0,
  };

  for (const itemId of Object.keys(byItemId)) {
    const row = byItemId[itemId];
    const subtotalBeforeProfit =
      row.aluminiumCost +
      row.powderCoatingCost +
      row.glassCost +
      row.meshCost +
      row.makingCost +
      row.hardwareCost +
      row.wastageCartageCost;
    row.profitCost =
      rates.profit.mode === 'per_sqft'
        ? row.areaSqFt * (Number(rates.profit.value) || 0)
        : subtotalBeforeProfit * ((Number(rates.profit.value) || 0) / 100);
    row.totalCost = subtotalBeforeProfit + row.profitCost;
    row.basicRatePerSqFt = row.areaSqFt > 0 ? row.totalCost / row.areaSqFt : 0;

    totals.areaSqFt += row.areaSqFt;
    totals.aluminiumCost += row.aluminiumCost;
    totals.powderCoatingCost += row.powderCoatingCost;
    totals.glassCost += row.glassCost;
    totals.meshCost += row.meshCost;
    totals.makingCost += row.makingCost;
    totals.hardwareCost += row.hardwareCost;
    totals.wastageCartageCost += row.wastageCartageCost;
    totals.profitCost += row.profitCost;
    totals.totalCost += row.totalCost;
  }

  for (const pool of pools.values()) {
    const requiredBars = packPieces(pool.pieces, pool.standardLengthMm);
    const purchasedLengthMm = requiredBars * pool.standardLengthMm;
    const usedLengthMm = pool.usedLengthMm;
    const usedWeightKg = (usedLengthMm / 1000) * pool.weightPerMeter;
    const purchasedWeightKg = (purchasedLengthMm / 1000) * pool.weightPerMeter;
    const wastageLengthFt = Math.max(0, (purchasedLengthMm - usedLengthMm) * MM_TO_FT);
    totals.usedLengthFt += usedLengthMm * MM_TO_FT;
    totals.purchasedLengthFt += purchasedLengthMm * MM_TO_FT;
    totals.usedWeightKg += usedWeightKg;
    totals.purchasedWeightKg += purchasedWeightKg;
    totals.wastageAluminiumCost += Math.max(0, purchasedWeightKg - usedWeightKg) * rates.aluminiumProfilePerKg;
    totals.wastagePowderCost += wastageLengthFt * pool.powderRatePerRft;
  }
  totals.wastageLengthFt = Math.max(0, totals.purchasedLengthFt - totals.usedLengthFt);
  totals.wastageWeightKg = Math.max(0, totals.purchasedWeightKg - totals.usedWeightKg);

  totals.basicRatePerSqFt = totals.areaSqFt > 0 ? totals.totalCost / totals.areaSqFt : 0;

  return { byItemId, totals };
}
