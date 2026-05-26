import type { QuotationItem, QuotationSettings } from '../types';
import { WindowType } from '../types';

export interface ProfitSafetyInfo {
  label: 'safe' | 'risky' | 'danger' | 'loss';
  colorClass: string;
  textClass: string;
}

export const getRawDiscountAmount = (subTotal: number, settings: QuotationSettings): number => {
  const f = settings.financials;
  if (!f) return 0;
  const raw =
    f.discountType === 'percentage'
      ? subTotal * (Number(f.discount) / 100)
      : Number(f.discount);
  return Number.isFinite(raw) ? Math.max(0, raw) : 0;
};

export const getMinimumMakingChargeForItems = (items: QuotationItem[]): number => {
  let minimum = 0;
  for (const item of items) {
    if (item.kind === 'railing') continue;
    switch (item.config.windowType) {
      case WindowType.SLIDING:
      case WindowType.CASEMENT:
        minimum = Math.max(minimum, 120);
        break;
      case WindowType.VENTILATOR:
      case WindowType.GLASS_PARTITION:
        minimum = Math.max(minimum, 70);
        break;
      default:
        break;
    }
  }
  return minimum;
};

export const getProfitSafetyInfo = (effectiveProfitPct: number, profitAfterDiscount: number): ProfitSafetyInfo => {
  if (profitAfterDiscount < 0) {
    return { label: 'loss', colorClass: 'bg-red-900/40 border-red-500', textClass: 'text-red-300' };
  }
  if (effectiveProfitPct >= 15) {
    return { label: 'safe', colorClass: 'bg-emerald-900/30 border-emerald-500', textClass: 'text-emerald-300' };
  }
  if (effectiveProfitPct >= 12) {
    return { label: 'risky', colorClass: 'bg-amber-900/30 border-amber-500', textClass: 'text-amber-300' };
  }
  if (effectiveProfitPct >= 10) {
    return { label: 'danger', colorClass: 'bg-orange-900/30 border-orange-500', textClass: 'text-orange-300' };
  }
  return { label: 'loss', colorClass: 'bg-red-900/40 border-red-500', textClass: 'text-red-300' };
};

