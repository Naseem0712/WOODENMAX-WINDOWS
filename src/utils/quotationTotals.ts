import { quoteLineAmount } from '../railing/quotationFormat';
import type { QuotationItem } from '../types';
import { AreaType } from '../types';
import { isWindowQuotationItem } from './quotationItemKinds';
import { getWindowQuotationAreaMm2 } from './louverBays';

/** Line contribution before discount / GST (windows: area × rate + hardware qty; railing: package line total). */
export function quotationItemSubtotalContribution(item: QuotationItem): number {
  if (isWindowQuotationItem(item)) {
    const conversionFactor = item.areaType === AreaType.SQFT ? 304.8 : 1000;
    const singleArea =
      getWindowQuotationAreaMm2(item.config) /
      (conversionFactor * conversionFactor);
    const totalArea = singleArea * item.quantity;
    const baseCost = totalArea * item.rate;
    const totalHardwareCost = item.hardwareCost * item.quantity;
    return baseCost + totalHardwareCost;
  }
  return quoteLineAmount(item.railingLine);
}
