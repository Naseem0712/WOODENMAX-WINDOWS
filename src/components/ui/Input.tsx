import React, { useState, useEffect } from 'react';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
  unit?: string;
}

export const Input: React.FC<InputProps> = ({ label, id, unit, className, value, onChange, onFocus, onBlur, ...props }) => {
  const [internalValue, setInternalValue] = useState(String(value ?? ''));
  const [isFocused, setIsFocused] = useState(false);

  useEffect(() => {
    // Sync with the parent component's value, but only when the input is not focused.
    // This prevents the parent's state updates from interrupting the user while they are typing.
    if (!isFocused) {
      setInternalValue(String(value ?? ''));
    }
  }, [value, isFocused]);

  const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    setIsFocused(true);
    e.target.select();
    if (onFocus) {
      onFocus(e);
    }
  };

  const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    setIsFocused(false);
    if (onBlur) {
      onBlur(e);
    }
    // After blurring, the `useEffect` hook will run and sync the input's display
    // with the canonical value from the parent component.
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInternalValue(e.target.value); // Update the visual state of the input immediately.
    if (onChange) {
      onChange(e); // Propagate the event to the parent component to update its state.
    }
  };
  
  const baseClasses = "w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-md shadow-sm placeholder-slate-400 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm";

  return (
    <div>
      {label && <label htmlFor={id} className="block text-sm font-medium text-slate-300 mb-1">
        {label}
      </label>}
      <div className="relative">
        <input
          id={id}
          className={`${baseClasses} ${className || ''}`}
          value={internalValue}
          onChange={handleChange}
          onFocus={handleFocus}
          onBlur={handleBlur}
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