import React, { useEffect, useRef } from 'react';
import { ChevronDownIcon } from '../icons/ChevronDownIcon';
import { scrollNearestVerticalOverflowAncestor } from '../../utils/scrollParentWheel';

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label: string;
  children: React.ReactNode;
}

export const Select: React.FC<SelectProps> = ({ label, id, children, onWheel: _onWheel, ...props }) => {
  const selectRef = useRef<HTMLSelectElement>(null);

  useEffect(() => {
    const el = selectRef.current;
    if (!el) return;
    const onWheelNative = (e: WheelEvent) => {
      e.preventDefault();
      scrollNearestVerticalOverflowAncestor(el, e);
    };
    el.addEventListener('wheel', onWheelNative, { passive: false });
    return () => el.removeEventListener('wheel', onWheelNative);
  }, []);

    return (
    <div>
      {label && <label htmlFor={id} className="block text-sm font-medium text-slate-300 mb-1">
        {label}
      </label>}
      <div className="relative">
        <select
          ref={selectRef}
          id={id}
          className="w-full pl-3 pr-10 py-2 bg-slate-800 border border-slate-600 rounded-md shadow-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm appearance-none"
          {...props}
        >
          {children}
        </select>
        <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-slate-400">
          <ChevronDownIcon className="w-5 h-5" />
        </div>
      </div>
    </div>
  );
};