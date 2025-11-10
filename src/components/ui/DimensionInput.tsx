import React, { useState, useEffect } from 'react';
import { Input } from './Input';

export type Unit = 'mm' | 'cm' | 'in' | 'ft-in';

interface DimensionInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'value'> {
  label: string;
  value_mm: number | '';
  onChange_mm: (value: number | '') => void;
  weightValue?: number | '';
  onWeightChange?: (value: number | '') => void;
  lengthValue?: number | '';
  onLengthChange?: (value: number | '') => void;
  controlledUnit?: Unit;
}

const parseToMm = (displayValue: string, unit: Unit): number | '' => {
    if (displayValue.trim() === '') return '';

    if (unit === 'ft-in') {
        // Regex to capture feet and inches from formats like 8'2", 8ft 2in, 8 2
        const match = displayValue.match(/(\d+\.?\d*)\s*(?:'|ft|feet)?\s*(\d+\.?\d*)?\s*(?:"|in|inch)?/);
        if (match) {
            const feet = parseFloat(match[1] || '0');
            const inches = parseFloat(match[2] || '0');
            return (feet * 12 + inches) * 25.4;
        }
        // Fallback for single number entry
        const num = parseFloat(displayValue);
        return isNaN(num) ? '' : (num * 12 * 25.4); // Assume feet if single number
    }
    
    const num = parseFloat(displayValue);
    if (isNaN(num)) return '';

    switch (unit) {
        case 'mm': return num;
        case 'cm': return num * 10;
        case 'in': return num * 25.4;
        default: return num;
    }
};

const formatFromMm = (mmValue: number, unit: Unit): string => {
    if (unit === 'ft-in') {
        const totalInches = mmValue / 25.4;
        const feet = Math.floor(totalInches / 12);
        const inches = totalInches % 12;
        if (Math.abs(inches) < 0.01) return `${feet}'`;
        return `${feet}' ${inches.toFixed(2)}"`;
    }

    let value: number;
    switch (unit) {
        case 'cm': value = mmValue / 10; break;
        case 'in': value = mmValue / 25.4; break;
        case 'mm':
        default: value = mmValue; break;
    }
    // Use toFixed for decimals, but parseInt if it's a whole number to avoid ".00"
    return parseFloat(value.toFixed(2)).toString();
};


export const DimensionInput: React.FC<DimensionInputProps> = ({ label, id, value_mm, onChange_mm, className, weightValue, onWeightChange, lengthValue, onLengthChange, controlledUnit, ...props }) => {
  const [internalUnit, setInternalUnit] = useState<Unit>('mm');
  const unit = controlledUnit || internalUnit;
  
  const [isFocused, setIsFocused] = useState(false);
  const [displayValue, setDisplayValue] = useState(() => value_mm !== '' ? formatFromMm(Number(value_mm), unit) : '');

  useEffect(() => {
    if (!isFocused) {
      setDisplayValue(value_mm !== '' ? formatFromMm(Number(value_mm), unit) : '');
    }
  }, [value_mm, unit, isFocused]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const currentInputValue = e.target.value;
    setDisplayValue(currentInputValue); // Store user's raw text for immediate display
    const newMmValue = parseToMm(currentInputValue, unit);
    onChange_mm(newMmValue); // Always notify parent of the canonical value (or '')
  };
  
  const handleUnitChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    if (!controlledUnit) {
      setInternalUnit(e.target.value as Unit);
    }
  };

  const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    setIsFocused(true);
    e.target.select();
  };

  const handleBlur = () => {
      setIsFocused(false);
      // The useEffect will now trigger and sync the value from the parent, showing the correctly formatted value.
  };

  return (
    <div className={className}>
      {label && <label htmlFor={id} className="block text-sm font-medium text-slate-300 mb-1">
        {label}
      </label>}
      <div className="relative flex">
        <input
          id={id}
          type="text"
          inputMode="decimal"
          className={`w-full pl-3 ${controlledUnit ? 'pr-3' : 'pr-20'} py-2 bg-slate-800 border border-slate-600 rounded-md shadow-sm placeholder-slate-400 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm`}
          value={displayValue}
          onChange={handleInputChange}
          onFocus={handleFocus}
          onBlur={handleBlur}
          {...props}
        />
        {!controlledUnit && (
          <div className="absolute inset-y-0 right-0 flex items-center">
              <label htmlFor={`${id}-unit-select`} className="sr-only">Units</label>
              <select
                  id={`${id}-unit-select`}
                  name={`${id}-unit`}
                  value={unit}
                  onChange={handleUnitChange}
                  className="h-full rounded-r-md border-transparent bg-transparent py-0 pl-2 pr-7 text-slate-400 focus:ring-2 focus:ring-inset focus:ring-indigo-600 sm:text-sm"
              >
                  <option>mm</option>
                  <option>cm</option>
                  <option>in</option>
                  <option value="ft-in">ft-in</option>
              </select>
          </div>
        )}
      </div>
      {onWeightChange && onLengthChange && (
        <div className="grid grid-cols-2 gap-2 mt-1">
            <Input
                type="number"
                inputMode="decimal"
                placeholder="Weight"
                id={`${id}-weight`}
                name={`${id}-weight`}
                label=""
                aria-label={`Weight for ${label}`}
                value={weightValue}
                onChange={e => onWeightChange(e.target.value === '' ? '' : Number(e.target.value))}
                className="!py-1 !pr-12"
                unit="kg/m"
            />
             <Input
                type="number"
                inputMode="decimal"
                placeholder="Length"
                id={`${id}-length`}
                name={`${id}-length`}
                label=""
                aria-label={`Length for ${label}`}
                value={lengthValue}
                onChange={e => onLengthChange(e.target.value === '' ? '' : Number(e.target.value))}
                className="!py-1 !pr-5"
                unit="m"
            />
        </div>
    )}
    </div>
  );
};