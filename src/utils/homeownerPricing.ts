import type { HardwareItem, MaterialRateSettings, WindowConfig, WindowQuotationItem } from '../types';
import { AreaType } from '../types';
import { calculateMaterialCostSummary } from './materialCosting';
import { listOperablePanelIds } from './homeownerOperablePanels';

/** Homeowner aluminium rate (₹/kg) until configurable in UI. */
export const HOMEOWNER_ALUMINIUM_PER_KG = 520;

export function mm2ToSqFt(mm2: number): number {
  const n = Number(mm2) || 0;
  if (n <= 0) return 0;
  return n / 92903.04;
}

export type HomeownerLockType = 'multipoint' | 'touch' | 'mortice';

export function calcHomeownerLockCost(
  config: WindowConfig,
  rates: MaterialRateSettings,
  lockType: HomeownerLockType,
): number {
  const panelCount = listOperablePanelIds(config).length;
  const lockRate = Number(rates.lockRates?.[lockType] ?? 0) || 0;
  return Math.round(panelCount * lockRate);
}

export interface HomeownerLiveBreakdown {
  areaSqFt: number;
  aluminiumCost: number;
  aluminiumKg: number;
  powderCoatingCost: number;
  glassCost: number;
  meshCost: number;
  makingCost: number;
  wastageCartageCost: number;
  profitCost: number;
  lockCost: number;
  total: number;
  baseRatePerSqFt: number;
  aluminiumPerSqFt: number;
  powderPerSqFt: number;
  glassPerSqFt: number;
  meshPerSqFt: number;
  makingPerSqFt: number;
  lockPerSqFt: number;
}

/** Full live estimate: aluminium @ configured kg rate, powder coating, glass, mesh, making, locks, profit. */
export function calcHomeownerFullPricing(input: {
  config: WindowConfig;
  rates: MaterialRateSettings;
  hardwareItems: HardwareItem[];
  lockType: HomeownerLockType;
}): HomeownerLiveBreakdown | null {
  if (!input.config.series?.dimensions) return null;

  const lockCost = calcHomeownerLockCost(input.config, input.rates, input.lockType);
  const item: WindowQuotationItem = {
    id: 'homeowner-live',
    title: 'Live estimate',
    config: input.config,
    quantity: 1,
    areaType: AreaType.SQFT,
    rate: 0,
    hardwareCost: 0,
    hardwareItems: input.hardwareItems ?? [],
  };

  const rates: MaterialRateSettings = {
    ...input.rates,
    aluminiumProfilePerKg: HOMEOWNER_ALUMINIUM_PER_KG,
  };
  const makingCharge = Number(rates.makingChargePerSqFt) || 120;
  const summary = calculateMaterialCostSummary([item], rates, makingCharge);
  const row = summary.byItemId['homeowner-live'];
  if (!row || row.areaSqFt <= 0) return null;

  const subtotalBeforeProfit =
    row.aluminiumCost +
    row.powderCoatingCost +
    row.glassCost +
    row.meshCost +
    row.makingCost +
    row.wastageCartageCost +
    lockCost;

  const profitCost =
    rates.profit.mode === 'per_sqft'
      ? row.areaSqFt * (Number(rates.profit.value) || 0)
      : subtotalBeforeProfit * ((Number(rates.profit.value) || 0) / 100);

  const total = Math.round(subtotalBeforeProfit + profitCost);
  const areaSqFt = row.areaSqFt;
  const per = (n: number) => (areaSqFt > 0 ? Math.round(n / areaSqFt) : 0);

  return {
    areaSqFt,
    aluminiumCost: Math.round(row.aluminiumCost),
    aluminiumKg: row.aluminiumWeightKg,
    powderCoatingCost: Math.round(row.powderCoatingCost),
    glassCost: Math.round(row.glassCost),
    meshCost: Math.round(row.meshCost),
    makingCost: Math.round(row.makingCost),
    wastageCartageCost: Math.round(row.wastageCartageCost),
    profitCost: Math.round(profitCost),
    lockCost,
    total,
    baseRatePerSqFt: per(total),
    aluminiumPerSqFt: per(row.aluminiumCost),
    powderPerSqFt: per(row.powderCoatingCost),
    glassPerSqFt: per(row.glassCost),
    meshPerSqFt: per(row.meshCost),
    makingPerSqFt: per(row.makingCost),
    lockPerSqFt: per(lockCost),
  };
}

/** @deprecated Use calcHomeownerFullPricing — kept for narrow glass+lock subtotals if needed. */
export function calcHomeownerLivePricing(input: {
  openingMm2: number;
  glassRatePerSqFt: number;
  lockCost: number;
}) {
  const areaSqFt = mm2ToSqFt(input.openingMm2);
  const glassAmount = Math.round(areaSqFt * (Number(input.glassRatePerSqFt) || 0));
  const lockCost = Math.round(Number(input.lockCost) || 0);
  const total = glassAmount + lockCost;
  return { areaSqFt, glassAmount, lockCost, total };
}
