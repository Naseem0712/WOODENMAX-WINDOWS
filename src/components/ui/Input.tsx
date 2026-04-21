import React, { useState, useEffect, useRef } from 'react';
import { scrollNearestVerticalOverflowAncestor } from '../../utils/scrollParentWheel';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
  unit?: string;
}

export const Input: React.FC<InputProps> = ({ label, id, unit, className, value, onChange, onFocus, onBlur, type = 'text', onWheel, ...props }) => {
  const [internalValue, setInternalValue] = useState(String(value ?? ''));
  const [isFocused, setIsFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Sync with prop value when not focused. This allows the component to be updated from the outside,
  // but prevents the parent's state from overwriting what the user is currently typing.
  useEffect(() => {
    if (!isFocused) {
      setInternalValue(String(value ?? ''));
    }
  }, [value, isFocused]);

  // React's onWheel is passive in many cases, so preventDefault does not stop touchpad/mouse wheel
  // from changing number inputs. Native non-passive listener routes scroll to the panel instead.
  useEffect(() => {
    if (type !== 'number') return;
    const el = inputRef.current;
    if (!el) return;
    const onWheelNative = (e: WheelEvent) => {
      e.preventDefault();
      scrollNearestVerticalOverflowAncestor(el, e);
    };
    el.addEventListener('wheel', onWheelNative, { passive: false });
    return () => el.removeEventListener('wheel', onWheelNative);
  }, [type]);

  const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    setIsFocused(true);
    e.target.select();
    if (onFocus) {
      onFocus(e);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    // Only update the internal state during typing. Do not call parent's onChange here.
    setInternalValue(e.target.value);
  };
  
  const handleWheel: React.WheelEventHandler<HTMLInputElement> = (e) => {
    onWheel?.(e);
  };

  const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    setIsFocused(false);
    
    // Create a new event object for the parent onChange because we need to pass our internalValue.
    const syntheticEvent = {
      ...e,
      target: {
        ...e.target,
        value: internalValue,
      },
    };
    
    // On blur, we "commit" the change by calling the parent's onChange, but only if the value differs.
    // This prevents unnecessary re-renders if the user just clicks in and out.
    if (internalValue !== String(value ?? '')) {
      if (onChange) {
        onChange(syntheticEvent as React.ChangeEvent<HTMLInputElement>);
      }
    }

    if (onBlur) {
      onBlur(e);
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
          ref={inputRef}
          id={id}
          type={type}
          className={`${baseClasses} ${className || ''}`}
          value={internalValue} // The input is always controlled by its internal state.
          onChange={handleChange}
          onFocus={handleFocus}
          onBlur={handleBlur}
          onWheel={handleWheel}
          autoComplete="off"
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