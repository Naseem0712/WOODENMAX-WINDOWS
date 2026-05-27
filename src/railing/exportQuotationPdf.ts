import {
  QDOC_CONTENT_MM,
  QDOC_CONTENT_PX,
  QDOC_PADDING_MM,
  QDOC_PDF_MARGINS_MM,
} from './quotationPrintSheet';

type JsPdfDoc = {
  internal: {
    getNumberOfPages: () => number;
    pageSize: { getWidth: () => number; getHeight: () => number };
  };
  setPage: (n: number) => void;
  setFillColor: (n: number) => void;
  rect: (...args: number[]) => void;
  setTextColor: (n: number) => void;
  setFont: (a: string, b: string) => void;
  setFontSize: (n: number) => void;
  text: (t: string, x: number, y: number, o?: { align: string }) => void;
  output: (type: 'blob') => Blob;
};

type Html2PdfChain = {
  set: (opts: Record<string, unknown>) => {
    from: (el: HTMLElement) => {
      toPdf: () => {
        get: (key: string) => { then: (fn: (pdf: JsPdfDoc) => void) => Promise<unknown> };
        save: () => Promise<void>;
      };
    };
  };
};

async function loadHtml2Pdf(): Promise<Html2PdfChain> {
  const mod = await import('html2pdf.js');
  const html2pdf = (typeof mod.default === 'function' ? mod.default : mod) as Html2PdfChain;
  if (typeof html2pdf !== 'function') {
    throw new Error('html2pdf module did not load correctly');
  }
  return html2pdf;
}

function stampPdfPageNumbers(pdf: JsPdfDoc): void {
  try {
    const totalPages = pdf.internal.getNumberOfPages();
    const pageW = pdf.internal.pageSize.getWidth();
    const pageH = pdf.internal.pageSize.getHeight();
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(8);
    pdf.setTextColor(110);
    for (let i = 1; i <= totalPages; i++) {
      pdf.setPage(i);
      pdf.setFillColor(255, 255, 255);
      pdf.rect(pageW - 42, pageH - 12, 38, 8, 'F');
      pdf.setTextColor(110);
      pdf.text(`Page ${i} of ${totalPages}`, pageW - 8, pageH - 6, { align: 'right' });
    }
  } catch {
    /* optional page stamp */
  }
}

function pdfCaptureOptions(element: HTMLElement, filename: string) {
  const captureW = element.offsetWidth || QDOC_CONTENT_PX;
  const captureH = element.scrollHeight || element.offsetHeight || 1123;
  return {
    margin: QDOC_PDF_MARGINS_MM,
    filename,
    image: { type: 'jpeg' as const, quality: 0.96 },
    html2canvas: {
      scale: 2,
      logging: false,
      useCORS: true,
      allowTaint: true,
      backgroundColor: '#ffffff',
      scrollX: 0,
      scrollY: 0,
      windowWidth: captureW,
      windowHeight: captureH,
    },
    jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' as const, compress: true },
    pagebreak: {
      mode: ['css', 'legacy'] as ('css' | 'legacy')[],
      avoid: [
        '.quote-item-pack',
        '.quote-item-block',
        '.qdoc-final-totals',
        '.qdoc-terms-section',
        '.qdoc-header-panels',
        '.quote-item-head',
      ],
    },
  };
}

/** Apply A4 capture width; call returned cleanup in finally. */
export function prepareQuotationElementForPdf(element: HTMLElement): () => void {
  const prevWidth = element.style.width;
  const prevMaxWidth = element.style.maxWidth;
  const prevBoxSizing = element.style.boxSizing;
  const prevOverflow = element.style.overflowX;
  const prevPadding = element.style.padding;
  const prevMargin = element.style.margin;

  element.style.width = `${QDOC_CONTENT_MM}mm`;
  element.style.maxWidth = `${QDOC_CONTENT_MM}mm`;
  element.style.boxSizing = 'border-box';
  element.style.overflowX = 'hidden';
  element.style.margin = '0';
  element.style.padding = `${QDOC_PADDING_MM.vertical}mm ${QDOC_PADDING_MM.horizontal}mm`;

  return () => {
    element.style.width = prevWidth;
    element.style.maxWidth = prevMaxWidth;
    element.style.boxSizing = prevBoxSizing;
    element.style.overflowX = prevOverflow;
    element.style.padding = prevPadding;
    element.style.margin = prevMargin;
  };
}

async function buildRailingQuotationPdf(element: HTMLElement, filename: string): Promise<JsPdfDoc> {
  const html2pdf = await loadHtml2Pdf();
  await new Promise<void>((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
  });

  let pdfDoc: JsPdfDoc | null = null;
  await html2pdf()
    .set(pdfCaptureOptions(element, filename))
    .from(element)
    .toPdf()
    .get('pdf')
    .then((pdf) => {
      pdfDoc = pdf;
      stampPdfPageNumbers(pdf);
    });

  if (!pdfDoc) throw new Error('PDF generation failed');
  return pdfDoc;
}

/** Download PDF with page numbers (same layout as print). */
export async function exportRailingQuotationPdf(
  element: HTMLElement,
  filename: string,
): Promise<void> {
  const cleanup = prepareQuotationElementForPdf(element);
  try {
    const html2pdf = await loadHtml2Pdf();
    await new Promise<void>((resolve) => {
      requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
    });
    await html2pdf()
      .set(pdfCaptureOptions(element, filename))
      .from(element)
      .toPdf()
      .get('pdf')
      .then((pdf) => {
        stampPdfPageNumbers(pdf);
      })
      .save();
  } finally {
    cleanup();
  }
}

/** Open system print dialog on PDF (correct Page 1 of N — browsers show Page 0 for CSS counters). */
export async function printRailingQuotationPdf(element: HTMLElement): Promise<void> {
  const cleanup = prepareQuotationElementForPdf(element);
  let objectUrl: string | null = null;
  let iframe: HTMLIFrameElement | null = null;

  try {
    const pdf = await buildRailingQuotationPdf(element, 'quotation-print.pdf');
    const blob = pdf.output('blob');
    objectUrl = URL.createObjectURL(blob);
    iframe = document.createElement('iframe');
    iframe.setAttribute('title', 'Quotation print');
    iframe.style.cssText =
      'position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden';
    iframe.src = objectUrl;
    document.body.appendChild(iframe);

    await new Promise<void>((resolve, reject) => {
      const timer = window.setTimeout(() => reject(new Error('PDF print load timeout')), 30000);
      iframe!.onload = () => {
        window.clearTimeout(timer);
        try {
          iframe!.contentWindow?.focus();
          iframe!.contentWindow?.print();
          resolve();
        } catch (err) {
          reject(err);
        }
      };
    });
  } finally {
    cleanup();
    window.setTimeout(() => {
      if (objectUrl) URL.revokeObjectURL(objectUrl);
      iframe?.remove();
    }, 120000);
  }
}
