import type { QuotationItem, WindowQuotationItem } from '../types';
import { hydrateQuotationLine } from '../railing/quotationFormat';
import type { QuotationLine } from '../railing/types';
import { isWindowPackageQuotationItem, normalizeWindowPackageItem } from './windowPackageQuotation';

export function isWindowQuotationItem(item: QuotationItem): item is WindowQuotationItem {
  return item.kind !== 'railing' && !isWindowPackageQuotationItem(item);
}

export function windowItemsOnly(items: QuotationItem[]): WindowQuotationItem[] {
  return items.filter(isWindowQuotationItem);
}

export function normalizeQuotationItemFromStorage(raw: unknown): QuotationItem | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  if (o.kind === 'railing' && o.railingLine && typeof o.id === 'string') {
    return {
      kind: 'railing',
      id: o.id,
      title: typeof o.title === 'string' ? o.title : 'Glass railing',
      railingLine: hydrateQuotationLine(structuredClone(o.railingLine as QuotationLine)),
    };
  }
  if (o.kind === 'window_package' && Array.isArray(o.units) && typeof o.id === 'string') {
    return normalizeWindowPackageItem(structuredClone(o) as unknown as import('../types').WindowPackageQuotationItem);
  }
  if (o.config && typeof o.id === 'string') {
    return {
      ...(o as unknown as WindowQuotationItem),
      kind: 'window',
    };
  }
  return null;
}
