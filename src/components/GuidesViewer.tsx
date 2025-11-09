import React, { useEffect } from 'react';
import { guides } from '../guides/content';
import { Button } from './ui/Button';
import { ChevronLeftIcon } from './icons/ChevronLeftIcon';
import { Logo } from './icons/Logo';
import { guideOrder } from '../guides/order';

interface GuidesViewerProps {
    activeSlug: string;
    onClose: () => void;
}

export const GuidesViewer: React.FC<GuidesViewerProps> = ({ activeSlug, onClose }) => {
    const content = guides[activeSlug] || guides.index;

    useEffect(() => {
        const title = content.title || 'Guides';
        document.title = `${title} | WoodenMax Designer`;
    }, [content.title]);

    return (
        <div className="flex flex-col h-screen bg-slate-900 text-slate-200">
            <header className="bg-slate-800 p-3 flex items-center shadow-md z-40 no-print flex-shrink-0">
                <Logo className="h-10 w-10 mr-4 flex-shrink-0" />
                <div className="flex-grow">
                    <h1 className="text-2xl font-bold text-white tracking-wider">Features & Guides</h1>
                    <p className="text-sm text-indigo-300">Learn how to use the WoodenMax Designer</p>
                </div>
                <Button onClick={onClose} variant="primary">
                    <ChevronLeftIcon className="w-5 h-5 mr-2" />
                    Back to Designer
                </Button>
            </header>
            <main className="flex flex-row flex-grow min-h-0">
                <aside className="w-64 bg-slate-800/50 p-4 flex-shrink-0 overflow-y-auto custom-scrollbar hidden md:block">
                    <nav>
                        <ul className="space-y-2">
                            {guideOrder.map(slug => {
                                const guide = guides[slug];
                                if (!guide) return null;
                                return (
                                    <li key={slug}>
                                        <a 
                                            href={`#/guides/${slug}`} 
                                            className={`block px-3 py-2 rounded-md text-sm font-medium transition-colors ${activeSlug === slug ? 'bg-indigo-600 text-white' : 'text-slate-300 hover:bg-slate-700 hover:text-white'}`}
                                        >
                                            {guide.title}
                                        </a>
                                    </li>
                                );
                            })}
                        </ul>
                    </nav>
                </aside>
                <article className="flex-grow p-6 md:p-8 lg:p-10 overflow-y-auto custom-scrollbar">
                    <div className="prose prose-invert max-w-none prose-headings:text-indigo-300 prose-headings:border-b prose-headings:border-slate-700 prose-headings:pb-2 prose-a:text-indigo-400 hover:prose-a:text-indigo-300 prose-strong:text-slate-100">
                        <h1 className="text-4xl font-bold mb-4">{content.title}</h1>
                        <div dangerouslySetInnerHTML={{ __html: content.html }} />
                    </div>
                </article>
            </main>
        </div>
    );
};

export default GuidesViewer;
