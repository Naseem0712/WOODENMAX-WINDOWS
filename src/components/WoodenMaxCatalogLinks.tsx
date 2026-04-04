import React from 'react';
import { WOODENMAX_WINDOW_CATALOG_LINKS } from '../constants/woodenmaxCatalogLinks';

/** Strip of outbound links to www.woodenmax.in window & catalog pages (SEO + UX). */
export const WoodenMaxCatalogLinks: React.FC = () => (
  <div
    className="no-print border-t border-slate-200/90 bg-gradient-to-b from-slate-50 to-slate-100/95 px-2 py-2 shadow-inner sm:px-3"
    aria-label="WoodenMax main site — windows & catalogue"
  >
    <p className="mb-1.5 text-center text-[10px] font-semibold uppercase tracking-wide text-slate-500 sm:text-left sm:text-xs">
      WoodenMax.in — windows &amp; catalogue
    </p>
    <nav className="flex flex-wrap items-center justify-center gap-x-2 gap-y-1 sm:justify-start">
      {WOODENMAX_WINDOW_CATALOG_LINKS.map(({ label, href }, i) => (
        <React.Fragment key={href}>
          {i > 0 && (
            <span className="hidden text-slate-300 sm:inline" aria-hidden="true">
              ·
            </span>
          )}
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="whitespace-nowrap rounded px-1 py-0.5 text-[10px] text-indigo-700 underline decoration-indigo-300 underline-offset-2 hover:text-indigo-900 hover:decoration-indigo-500 sm:text-xs"
          >
            {label}
          </a>
        </React.Fragment>
      ))}
    </nav>
  </div>
);

export default WoodenMaxCatalogLinks;
