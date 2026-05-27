/** Prepare on-screen quotation document for print or PDF capture. */
export async function waitForQuotationPrintRoot(): Promise<HTMLElement> {
  for (let i = 0; i < 20; i++) {
    const root = document.getElementById('quotation-print-root');
    const doc = root?.querySelector('.quotation-doc');
    if (root && doc) return root;
    await new Promise((r) => window.setTimeout(r, 80));
  }
  throw new Error('Quotation document not ready');
}

export function isMobileOrPrintUnavailable(): boolean {
  if (typeof window === 'undefined') return false;
  const coarse = window.matchMedia('(max-width: 768px)').matches;
  const touch = 'ontouchstart' in window && coarse;
  return coarse || touch || typeof window.print !== 'function';
}
