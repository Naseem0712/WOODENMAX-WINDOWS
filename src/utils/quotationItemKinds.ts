import type { QuotationItem, WindowQuotationItem } from '../types';

export function isWindowQuotationItem(item: QuotationItem): item is WindowQuotationItem {
  return item.kind !== 'railing';
}

export function windowItemsOnly(items: QuotationItem[]): WindowQuotationItem[] {
  return items.filter(isWindowQuotationItem);
}
