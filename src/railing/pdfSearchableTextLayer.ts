import {
  QDOC_CONTENT_MM,
  QDOC_MARGIN_MM,
  QDOC_PAGE_MM,
} from './quotationPrintSheet';

type PdfTextDoc = {
  internal: {
    getNumberOfPages: () => number;
  };
  setPage: (n: number) => void;
  setFont: (face: string, style: string) => void;
  setFontSize: (size: number) => void;
  text: (
    t: string,
    x: number,
    y: number,
    options?: { align?: string; maxWidth?: number; renderingMode?: string; lineHeightFactor?: number },
  ) => void;
};

const PAGE_HEIGHT_MM = 297;
const PAGE_INNER_HEIGHT_MM = PAGE_HEIGHT_MM - QDOC_MARGIN_MM.top - QDOC_MARGIN_MM.bottom;

const PDF_TEXT_SELECTORS = [
  '.qdoc-brand-name',
  '.qdoc-tag',
  '.qdoc-panel-title',
  '.qdoc-section-title',
  '.qdoc-info-label',
  '.qdoc-info-value',
  '.qdoc-link',
  '.qdoc-intro p',
  '.qdoc-terms-list li',
  '.qdoc-bank-table td',
  '.qdoc-totals-table th',
  '.qdoc-totals-table td',
  '.quote-item-head h3',
  '.qdoc-line-type',
  '.spec-label',
  '.spec-value',
  '.item-notes',
  '.dim-title',
  '.dim-lines',
  '.dim-height',
  '.qdoc-item-extras',
  '.qdoc-price-h',
  '.qdoc-col-basis',
  '.qdoc-col-rate',
  '.qdoc-col-sets',
  '.qdoc-col-amount',
  '.qdoc-sign-block p',
].join(', ');

function positionWithinRoot(el: HTMLElement, root: HTMLElement): { x: number; y: number; h: number } {
  const rootRect = root.getBoundingClientRect();
  const elRect = el.getBoundingClientRect();
  return {
    x: elRect.left - rootRect.left + root.scrollLeft,
    y: elRect.top - rootRect.top + root.scrollTop,
    h: elRect.height,
  };
}

function pxToMm(px: number, mmPerPx: number): number {
  return px * mmPerPx;
}

function pageForY(yPx: number, pageInnerHeightPx: number, totalPages: number): number {
  return Math.min(totalPages, Math.max(1, Math.floor(yPx / pageInnerHeightPx) + 1));
}

/** Invisible + structured text so PDF stays searchable (intro, terms, names, amounts). */
export function stampSearchableTextLayer(pdf: PdfTextDoc, root: HTMLElement): void {
  if (!root.isConnected) return;

  const captureWidthPx = root.offsetWidth || root.scrollWidth || 1;
  const mmPerPx = QDOC_CONTENT_MM / captureWidthPx;
  const pageInnerHeightPx = PAGE_INNER_HEIGHT_MM / mmPerPx;
  const totalPages = pdf.internal.getNumberOfPages();
  const maxTextMm = QDOC_PAGE_MM - QDOC_MARGIN_MM.left - QDOC_MARGIN_MM.right;

  const blocks: Array<{ text: string; xPx: number; yPx: number; fontSizePx: number }> = [];
  const seen = new Set<string>();

  root.querySelectorAll(PDF_TEXT_SELECTORS).forEach((node) => {
    if (!(node instanceof HTMLElement)) return;
    if (node.closest('svg, [aria-hidden="true"], .no-print, .quote-mini-svg')) return;
    const text = node.innerText.replace(/\s+/g, ' ').trim();
    if (!text || text.length < 2) return;
    const key = `${text}|${node.className}`;
    if (seen.has(key)) return;
    seen.add(key);

    const style = window.getComputedStyle(node);
    if (style.display === 'none' || style.visibility === 'hidden') return;

    const pos = positionWithinRoot(node, root);
    if (pos.h < 1) return;

    blocks.push({
      text,
      xPx: pos.x,
      yPx: pos.y + pos.h * 0.85,
      fontSizePx: parseFloat(style.fontSize) || 10,
    });
  });

  for (const block of blocks) {
    const pageIdx = pageForY(block.yPx, pageInnerHeightPx, totalPages);
    const yOnPagePx = block.yPx - (pageIdx - 1) * pageInnerHeightPx;
    const xMm = QDOC_MARGIN_MM.left + pxToMm(block.xPx, mmPerPx);
    const yMm = QDOC_MARGIN_MM.top + pxToMm(yOnPagePx, mmPerPx);
    const fontSizeMm = Math.max(6, Math.min(12, block.fontSizePx * 0.28));

    pdf.setPage(pageIdx);
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(fontSizeMm);
    pdf.text(block.text, xMm, yMm, {
      maxWidth: maxTextMm,
      renderingMode: 'invisible',
      lineHeightFactor: 1.15,
    });
  }

  /** Structured appendix on last page — fallback for AI/OCR when layout coords drift. */
  const appendix = buildTextAppendix(root);
  if (appendix.length > 0) {
    pdf.setPage(totalPages);
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(6);
    let yMm = PAGE_HEIGHT_MM - QDOC_MARGIN_MM.bottom - 4;
    for (const line of appendix.slice(0, 40)) {
      pdf.text(line, QDOC_MARGIN_MM.left, yMm, {
        maxWidth: maxTextMm,
        renderingMode: 'invisible',
        lineHeightFactor: 1.2,
      });
      yMm -= 2.8;
      if (yMm < QDOC_MARGIN_MM.top + 10) break;
    }
  }
}

function buildTextAppendix(root: HTMLElement): string[] {
  const lines: string[] = [];
  const intro = root.querySelector('.qdoc-intro')?.textContent?.replace(/\s+/g, ' ').trim();
  if (intro) lines.push(`Description: ${intro}`);

  root.querySelectorAll('.qdoc-terms-list li').forEach((li, i) => {
    const t = li.textContent?.replace(/\s+/g, ' ').trim();
    if (t) lines.push(`Term ${i + 1}: ${t}`);
  });

  root.querySelectorAll('.quote-item-head h3').forEach((h) => {
    const t = h.textContent?.replace(/\s+/g, ' ').trim();
    if (t) lines.push(`Product: ${t}`);
  });

  const client = root.querySelector('.qdoc-panel-client')?.textContent?.replace(/\s+/g, ' ').trim();
  if (client) lines.push(`Client: ${client.slice(0, 200)}`);

  return lines;
}
