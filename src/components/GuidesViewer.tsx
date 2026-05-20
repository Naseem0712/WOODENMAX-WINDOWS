import React from 'react';
import { NavLink } from 'react-router-dom';
import { guides } from '../guides/content';
import { Button } from './ui/Button';
import { ChevronLeftIcon } from './icons/ChevronLeftIcon';
import { Logo } from './icons/Logo';
import { guideOrder } from '../guides/order';
import { COMPANY_BRAND, CONTACT_EMAIL } from '../constants/site';
import { SEO_CONTENT_MODIFIED } from '../seo/siteSeo';
import { WoodenMaxCatalogMenu } from './WoodenMaxCatalogMenu';
import { SpringScrollArea } from './ui/SpringScrollArea';

interface GuidesViewerProps {
    activeSlug: string;
    onClose: () => void;
}

function guideArticleHeading(raw: string): string {
    return raw.replace(/^[\p{Extended_Pictographic}\uFE0F\u200d\s]+/u, '').trim() || raw;
}

export const GuidesViewer: React.FC<GuidesViewerProps> = ({ activeSlug, onClose }) => {
    const content = guides[activeSlug] || guides.index;

    return (
        <div className="flex min-h-0 flex-1 flex-col bg-slate-900 text-slate-200">
            <header className="no-print z-40 flex shrink-0 flex-col gap-1 border-b border-slate-200/90 bg-gradient-to-b from-white to-slate-100 px-2.5 py-1.5 shadow-sm sm:flex-row sm:items-center sm:justify-between sm:gap-2">
                <div className="flex min-w-0 flex-1 items-center gap-2 sm:gap-2.5">
                    <div className="shrink-0 rounded-md bg-white px-1.5 py-1 shadow-sm ring-1 ring-slate-200/90">
                        <Logo className="h-7 w-auto max-h-7 max-w-[min(100%,180px)] object-contain sm:h-8 sm:max-h-8" />
                    </div>
                    <div className="min-w-0">
                        <p className="text-sm font-bold tracking-tight text-slate-800 sm:text-base">Guides</p>
                        <p className="text-[11px] text-slate-600 sm:text-xs">Tips for every window type &amp; quotation</p>
                    </div>
                </div>
                <div className="flex w-full shrink-0 flex-col gap-1.5 sm:w-auto sm:flex-row sm:items-center sm:justify-end">
                    <WoodenMaxCatalogMenu className="w-full sm:w-auto" />
                    <Button onClick={onClose} variant="primary" className="min-h-9 w-full shrink-0 justify-center px-3 py-1.5 text-sm sm:w-auto sm:min-h-0">
                        <ChevronLeftIcon className="mr-1.5 h-4 w-4" />
                        Back to Designer
                    </Button>
                </div>
            </header>
            <main className="flex min-h-0 flex-1 flex-row">
                <SpringScrollArea className="hidden w-64 flex-shrink-0 overflow-y-auto overscroll-y-contain bg-slate-800/50 p-4 touch-pan-y custom-scrollbar md:block" aria-label="Guide topics">
                    <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-400">Topics</h2>
                    <nav>
                        <ul className="space-y-2">
                            {guideOrder.map(slug => {
                                const guide = guides[slug];
                                if (!guide) return null;
                                return (
                                    <li key={slug}>
                                        <NavLink
                                            to={`/guides/${slug}`}
                                            className={({ isActive }) =>
                                                `block px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                                                    isActive ? 'bg-indigo-600 text-white' : 'text-slate-300 hover:bg-slate-700 hover:text-white'
                                                }`
                                            }
                                        >
                                            {guide.title}
                                        </NavLink>
                                    </li>
                                );
                            })}
                        </ul>
                    </nav>
                </SpringScrollArea>
                <SpringScrollArea className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain p-6 touch-pan-y custom-scrollbar md:p-8 lg:p-10">
                    <div className="prose prose-invert max-w-none prose-headings:text-indigo-300 prose-headings:border-b prose-headings:border-slate-700 prose-headings:pb-2 prose-a:text-indigo-400 hover:prose-a:text-indigo-300 prose-strong:text-slate-100 prose-h2:mt-8 prose-h3:mt-6">
                        <header className="not-prose mb-6 border-b border-slate-700 pb-4">
                            <h1 className="text-3xl font-bold tracking-tight text-white md:text-4xl">{guideArticleHeading(content.title)}</h1>
                            <p className="mt-2 text-sm text-slate-400">
                                Published by{' '}
                                <a href="https://www.woodenmax.in" target="_blank" rel="noopener noreferrer" className="text-indigo-400 hover:text-indigo-300">
                                    {COMPANY_BRAND}
                                </a>
                                {' '}
                                · Window design &amp; fabrication expertise · Last updated {SEO_CONTENT_MODIFIED}
                            </p>
                            <p className="mt-1 text-xs text-slate-500">
                                Questions:{' '}
                                <a href={`mailto:${CONTACT_EMAIL}`} className="text-indigo-400 hover:text-indigo-300">
                                    {CONTACT_EMAIL}
                                </a>
                            </p>
                        </header>
                        <div dangerouslySetInnerHTML={{ __html: content.html }} />
                    </div>
                </SpringScrollArea>
            </main>
        </div>
    );
};

export default GuidesViewer;
