import React from 'react';
import { NavLink } from 'react-router-dom';
import { guides } from '../guides/content';
import { Button } from './ui/Button';
import { ChevronLeftIcon } from './icons/ChevronLeftIcon';
import { Logo } from './icons/Logo';
import { guideOrder } from '../guides/order';

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
        <div className="flex flex-col h-screen bg-slate-900 text-slate-200">
            <header className="no-print z-40 flex flex-shrink-0 flex-col gap-2 border-b border-slate-200/90 bg-gradient-to-b from-white to-slate-100 px-3 py-2.5 shadow-sm sm:flex-row sm:items-center sm:justify-between">
                <div className="flex min-w-0 flex-1 items-center gap-2.5">
                    <div className="shrink-0 rounded-lg bg-white px-2 py-1.5 shadow-sm ring-1 ring-slate-200/90">
                        <Logo className="h-9 w-auto max-h-9 max-w-[min(100%,200px)] object-contain sm:h-10 sm:max-h-10" />
                    </div>
                    <div className="min-w-0">
                        <p className="text-base font-bold tracking-tight text-slate-800 sm:text-lg">Guides</p>
                        <p className="text-xs text-slate-600 sm:text-sm">Tips for every window type &amp; quotation</p>
                    </div>
                </div>
                <Button onClick={onClose} variant="primary" className="min-h-[44px] w-full shrink-0 justify-center sm:w-auto">
                    <ChevronLeftIcon className="mr-2 h-5 w-5" />
                    Back to Designer
                </Button>
            </header>
            <main className="flex flex-row flex-grow min-h-0">
                <aside className="w-64 bg-slate-800/50 p-4 flex-shrink-0 overflow-y-auto custom-scrollbar hidden md:block" aria-label="Guide topics">
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
                </aside>
                <article className="flex-grow p-6 md:p-8 lg:p-10 overflow-y-auto custom-scrollbar">
                    <div className="prose prose-invert max-w-none prose-headings:text-indigo-300 prose-headings:border-b prose-headings:border-slate-700 prose-headings:pb-2 prose-a:text-indigo-400 hover:prose-a:text-indigo-300 prose-strong:text-slate-100 prose-h2:mt-8 prose-h3:mt-6">
                        <header className="not-prose mb-6 border-b border-slate-700 pb-4">
                            <h1 className="text-3xl font-bold tracking-tight text-white md:text-4xl">{guideArticleHeading(content.title)}</h1>
                            <p className="mt-2 text-sm text-slate-400">WoodenMax Window Designer — help &amp; how-to</p>
                        </header>
                        <div dangerouslySetInnerHTML={{ __html: content.html }} />
                    </div>
                </article>
            </main>
        </div>
    );
};

export default GuidesViewer;
