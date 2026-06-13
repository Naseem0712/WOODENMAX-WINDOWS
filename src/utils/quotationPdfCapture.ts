type PdfDoc = {
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
  save: () => Promise<void>;
};

type Html2PdfChain = {
  set: (opts: Record<string, unknown>) => {
    from: (el: HTMLElement) => {
      toPdf: () => {
        get: (key: string) => { then: (fn: (pdf: PdfDoc) => void) => Promise<unknown> };
        save: () => Promise<void>;
      };
    };
  };
};

let html2pdfLoad: Promise<Html2PdfChain> | null = null;

/** Warm up html2pdf while the user reviews the quotation. */
export function preloadHtml2Pdf(): void {
  if (html2pdfLoad) return;
  html2pdfLoad = import('html2pdf.js').then((mod) => {
    const fn = (typeof mod.default === 'function' ? mod.default : mod) as Html2PdfChain;
    if (typeof fn !== 'function') throw new Error('html2pdf module did not load correctly');
    return fn;
  });
}

async function getHtml2Pdf(): Promise<Html2PdfChain> {
  preloadHtml2Pdf();
  return html2pdfLoad!;
}

function nextFrame(): Promise<void> {
  return new Promise((resolve) => requestAnimationFrame(() => resolve()));
}

export type QuotationPdfCaptureOptions = {
  filename: string;
  captureW: number;
  captureH: number;
  canvasScale?: number;
  margins?: [number, number, number, number];
  stampPageNumbers?: (pdf: PdfDoc) => void;
};

export async function captureQuotationPdf(
  element: HTMLElement,
  options: QuotationPdfCaptureOptions,
): Promise<PdfDoc> {
  const html2pdf = await getHtml2Pdf();
  await nextFrame();

  const scale = options.canvasScale ?? 2;
  const margins = options.margins ?? [8, 8, 8, 8];
  let pdfDoc: PdfDoc | null = null;

  await html2pdf()
    .set({
      margin: margins,
      filename: options.filename,
      image: { type: 'jpeg' as const, quality: 0.95 },
      html2canvas: {
        scale,
        logging: false,
        useCORS: true,
        allowTaint: true,
        backgroundColor: '#ffffff',
        scrollX: 0,
        scrollY: 0,
        windowWidth: options.captureW,
        windowHeight: options.captureH,
      },
      jsPDF: {
        unit: 'mm',
        format: 'a4',
        orientation: 'portrait' as const,
        compress: true,
      },
      pagebreak: { mode: ['css', 'legacy'] as ('css' | 'legacy')[] },
    })
    .from(element)
    .toPdf()
    .get('pdf')
    .then((pdf) => {
      pdfDoc = pdf;
      options.stampPageNumbers?.(pdf);
    });

  if (!pdfDoc) throw new Error('PDF generation failed');
  return pdfDoc;
}

export function stampWoodenMaxPageNumbers(pdf: PdfDoc): void {
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
    /* optional */
  }
}

/** Open the system print dialog on a PDF blob (same pipeline as export — faster than printing live DOM). */
export function openPdfBlobPrintDialog(blob: Blob): Promise<void> {
  const objectUrl = URL.createObjectURL(blob);
  const iframe = document.createElement('iframe');
  iframe.setAttribute('title', 'Quotation print');
  iframe.style.cssText =
    'position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden';
  iframe.src = objectUrl;
  document.body.appendChild(iframe);

  return new Promise<void>((resolve, reject) => {
    const timer = window.setTimeout(() => reject(new Error('PDF print load timeout')), 30000);
    iframe.onload = () => {
      window.clearTimeout(timer);
      try {
        iframe.contentWindow?.focus();
        iframe.contentWindow?.print();
        resolve();
      } catch (err) {
        reject(err);
      }
    };
    iframe.onerror = () => {
      window.clearTimeout(timer);
      reject(new Error('PDF print iframe failed'));
    };
  }).finally(() => {
    window.setTimeout(() => {
      URL.revokeObjectURL(objectUrl);
      iframe.remove();
    }, 120000);
  });
}

export async function saveQuotationPdf(
  element: HTMLElement,
  options: QuotationPdfCaptureOptions,
): Promise<void> {
  const pdf = await captureQuotationPdf(element, options);
  pdf.save(options.filename);
}
