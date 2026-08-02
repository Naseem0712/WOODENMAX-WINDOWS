import React from 'react';
import {
  PRINT_WATERMARK_BRAND,
  PRINT_WATERMARK_PREFIX,
  PRINT_WATERMARK_URL,
} from '../constants/site';

/** Clickable WEOS credit for print / PDF HTML footers. */
export const PrintWeosCredit: React.FC<{ className?: string }> = ({ className = '' }) => (
  <span className={className}>
    {PRINT_WATERMARK_PREFIX}
    <a
      href={PRINT_WATERMARK_URL}
      target="_blank"
      rel="noopener noreferrer"
      className="print-weos-link"
    >
      {PRINT_WATERMARK_BRAND}
    </a>
  </span>
);
