import type { QuotationItem, WindowQuotationItem } from '../types';
import { isWindowPackageQuotationItem } from './windowPackageQuotation';

export function isWindowQuotationItem(item: QuotationItem): item is WindowQuotationItem {
  return item.kind !== 'railing' && !isWindowPackageQuotationItem(item);
}

export function isNonRailingQuotationItem(
  item: QuotationItem,
): item is Exclude<QuotationItem, { kind: 'railing' }> {
  return item.kind !== 'railing';
}

export function windowItemsOnly(items: QuotationItem[]): WindowQuotationItem[] {
  return items.filter(isWindowQuotationItem);
}
