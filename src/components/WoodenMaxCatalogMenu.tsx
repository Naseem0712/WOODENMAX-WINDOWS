import React from 'react';
import { WOODENMAX_WINDOW_CATALOG_LINKS } from '../constants/woodenmaxCatalogLinks';
import { ChevronDownIcon } from './icons/ChevronDownIcon';

/**
 * All outbound WoodenMax.in links in one dropdown — avoids a full-width link strip so the canvas stays tall.
 */
export const WoodenMaxCatalogMenu: React.FC<{ className?: string }> = ({ className = '' }) => (
  <details className={`relative ${className}`}>
    <summary
      className="flex cursor-pointer list-none items-center gap-1 rounded-lg border border-slate-300/95 bg-white px-2.5 py-2 text-xs font-semibold text-slate-800 shadow-sm transition hover:bg-slate-50 [&::-webkit-details-marker]:hidden"
      aria-label="WoodenMax.in product and catalogue links"
    >
      <span className="hidden sm:inline">WoodenMax.in — products</span>
      <span className="sm:hidden">Products</span>
      <ChevronDownIcon className="h-4 w-4 shrink-0 opacity-70" aria-hidden />
    </summary>
    <div
      className="absolute right-0 top-[calc(100%+6px)] z-[60] max-h-[min(70vh,22rem)] w-[min(calc(100vw-1.5rem),18rem)] overflow-y-auto rounded-xl border border-slate-200 bg-white py-2 shadow-xl ring-1 ring-black/5"
      role="menu"
    >
      <p className="px-3 pb-2 text-[10px] font-semibold uppercase tracking-wide text-slate-500">Windows &amp; catalogue</p>
      <ul className="space-y-0.5">
        {WOODENMAX_WINDOW_CATALOG_LINKS.map(({ label, href }) => (
          <li key={href}>
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="block px-3 py-2 text-sm text-indigo-800 hover:bg-indigo-50"
              role="menuitem"
            >
              {label}
            </a>
          </li>
        ))}
      </ul>
    </div>
  </details>
);

export default WoodenMaxCatalogMenu;
