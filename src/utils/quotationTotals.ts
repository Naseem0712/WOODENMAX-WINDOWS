import { quoteLineAmount } from '../railing/quotationFormat';
import type { QuotationItem, QuotationSettings } from '../types';
import { AreaType, type WindowQuotationItem } from '../types';
import { getRawDiscountAmount } from './pricingSafety';
import { isWindowQuotationItem } from './quotationItemKinds';
import { getWindowQuotationAreaMm2 } from './louverBays';
import { isWindowPackageQuotationItem, packageQuotationSubtotal } from './windowPackageQuotation';

function roundMoney(n: number): number {
  return Math.round(n * 100) / 100;
}

function windowItemRawSubtotal(item: WindowQuotationItem): number {
  const conversionFactor = item.areaType === AreaType.SQFT ? 304.8 : 1000;
  const qty = Number(item.quantity) || 0;
  const rate = Number(item.rate) || 0;
  const hardware = Number(item.hardwareCost) || 0;
  const singleArea =
    getWindowQuotationAreaMm2(item.config) / (conversionFactor * conversionFactor);
  return singleArea * qty * rate + hardware * qty;
}

/** Per-line total before discount / GST — rounded to 2 decimals (matches print line amounts). */
export function quotationItemLineTotal(item: QuotationItem): number {
  if (isWindowPackageQuotationItem(item)) {
    return roundMoney(packageQuotationSubtotal(item));
  }
  if (isWindowQuotationItem(item)) {
    return roundMoney(windowItemRawSubtotal(item));
  }
  if (item.kind === 'railing' && item.railingLine) {
    return roundMoney(quoteLineAmount(item.railingLine));
  }
  return 0;
}

/** @deprecated alias — use quotationItemLineTotal */
export function quotationItemSubtotalContribution(item: QuotationItem): number {
  return quotationItemLineTotal(item);
}

export interface QuotationFinancials {
  subTotal: number;
  discountAmount: number;
  totalAfterDiscount: number;
  gstAmount: number;
  grandTotal: number;
}

/** Shared subtotal → discount → GST → grand total (print + quotation list). */
export function computeQuotationFinancials(
  items: QuotationItem[],
  settings: QuotationSettings,
  profitBeforeDiscount: number,
): QuotationFinancials {
  const subTotal = roundMoney(items.reduce((total, item) => total + quotationItemLineTotal(item), 0));
  const rawDiscountAmount = getRawDiscountAmount(subTotal, settings);
  const maxDiscountAllowed = Math.max(0, profitBeforeDiscount * 0.5);
  const discountAmount = roundMoney(Math.min(rawDiscountAmount, maxDiscountAllowed));
  const totalAfterDiscount = roundMoney(subTotal - discountAmount);
  const gstPct = Number(settings.financials?.gstPercentage ?? 0);
  const gstAmount = roundMoney(totalAfterDiscount * (gstPct / 100));
  const grandTotal = roundMoney(totalAfterDiscount + gstAmount);
  return { subTotal, discountAmount, totalAfterDiscount, gstAmount, grandTotal };
}
