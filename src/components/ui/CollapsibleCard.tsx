import React, { useState } from 'react';
import { ChevronDownIcon } from '../icons/ChevronDownIcon';

interface CollapsibleCardProps {
  title: string;
  children: React.ReactNode;
  className?: string;
  defaultOpen?: boolean;
}

export const CollapsibleCard: React.FC<CollapsibleCardProps> = ({ title, children, className, defaultOpen = false }) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div className={`bg-slate-800 rounded-lg shadow-md ${className}`}>
      <button
        className={`w-full flex justify-between items-center text-left text-lg font-semibold text-slate-100 p-4 focus:outline-none focus:ring-2 focus:ring-indigo-500 ${isOpen ? 'rounded-t-lg' : 'rounded-lg'}`}
        onClick={() => setIsOpen(!isOpen)}
        aria-expanded={isOpen}
      >
        <span>{title}</span>
        <ChevronDownIcon className={`w-5 h-5 text-slate-400 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
      </button>
      {isOpen && (
        <div className="p-4 pt-2 border-t border-slate-700">
            <div className="space-y-4">
                {children}
            </div>
        </div>
      )}
    </div>
  );
};
