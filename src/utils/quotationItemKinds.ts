import type { QuotationItem, WindowQuotationItem } from '../types';
import { isWindowPackageQuotationItem } from './windowPackageQuotation';

export function isWindowQuotationItem(item: QuotationItem): item is WindowQuotationItem {
  return item.kind !== 'railing' && !isWindowPackageQuotationItem(item);
}

export function windowItemsOnly(items: QuotationItem[]): WindowQuotationItem[] {
  return items.filter(isWindowQuotationItem);
}
