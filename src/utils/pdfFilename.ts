/** Safe file name segments for PDF / print (Windows, macOS, Linux). */
export function sanitizeFilenameSegment(input: string, fallback: string): string {
  const raw = input.trim() || fallback;
  const cleaned = raw
    .replace(/[<>:"/\\|?*\x00-\x1f]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
  return cleaned || fallback;
}

export function quotationPdfFilename(customerName: string, dateStamp: string): string {
  const customer = sanitizeFilenameSegment(customerName, 'Customer');
  return `WoodenMax-Quotation-${customer}-${dateStamp}.pdf`;
}

export function bomPdfFilename(customerName: string, dateStamp: string): string {
  const customer = sanitizeFilenameSegment(customerName, 'Customer');
  return `WoodenMax-BOM-${customer}-${dateStamp}.pdf`;
}

export function printDocumentTitleForQuotation(customerName: string): string {
  const customer = sanitizeFilenameSegment(customerName, 'Customer');
  return `WoodenMax-Quotation-${customer}`;
}

export function printDocumentTitleForBom(customerName: string): string {
  const customer = sanitizeFilenameSegment(customerName, 'Customer');
  return `WoodenMax-BOM-${customer}`;
}
