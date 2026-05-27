/** A4 quotation print/PDF — keep content inside printable area (no right-edge clip). */
export const QDOC_PAGE_MM = 210;
export const QDOC_MARGIN_MM = { top: 6, right: 6, bottom: 8, left: 6 } as const;
export const QDOC_CONTENT_MM = QDOC_PAGE_MM - QDOC_MARGIN_MM.left - QDOC_MARGIN_MM.right;
export const QDOC_PADDING_MM = { vertical: 2, horizontal: 3 } as const;

export const QDOC_CONTENT_PX = Math.round((QDOC_CONTENT_MM / 25.4) * 96);

export const QDOC_PDF_MARGINS_MM: [number, number, number, number] = [
  QDOC_MARGIN_MM.top,
  QDOC_MARGIN_MM.right,
  QDOC_MARGIN_MM.bottom,
  QDOC_MARGIN_MM.left,
];
