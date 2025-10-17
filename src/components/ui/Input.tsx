
import React from 'react';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
  unit?: string;
}

export const Input: React.FC<InputProps> = ({ label, id, unit, ...props }) => {
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium text-slate-300 mb-1">
        {label}
      </label>
      <div className="relative">
        <input
          id={id}
          className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-md shadow-sm placeholder-slate-400 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
          {...props}
        />
        {unit && (
          <span className="absolute inset-y-0 right-0 flex items-center pr-3 text-sm text-slate-400 pointer-events-none">
            {unit}
          </span>
        )}
      </div>
    </div>
  );
};