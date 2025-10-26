import React, { useState, useEffect } from 'react';

type Unit = 'mm' | 'cm' | 'in' | 'ft-in';

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
  
  const [displayValue, setDisplayValue] = useState('');
  const [isFocused, setIsFocused] = useState(false);

  useEffect(() => {
    // Only update display value from props if the input is not focused
    // to avoid disrupting user input
    if (!isFocused && value_mm !== '') {
        setDisplayValue(formatFromMm(Number(value_mm), unit));
    } else if (!isFocused && value_mm === '') {
        setDisplayValue('');
    }
  }, [value_mm, unit, isFocused]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newDisplayValue = e.target.value;
    setDisplayValue(newDisplayValue);
    const newMmValue = parseToMm(newDisplayValue, unit);
    if (newMmValue !== '') {
      onChange_mm(newMmValue);
    }
  };
  
  const handleUnitChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newUnit = e.target.value as Unit;
    setInternalUnit(newUnit);
    // When unit changes, re-format the display value from the canonical mm value
    if (value_mm !== '') {
        setDisplayValue(formatFromMm(Number(value_mm), newUnit));
    }
  };

  const handleBlur = () => {
      setIsFocused(false);
      // On blur, reformat the input to a clean, consistent representation
      if (value_mm !== '') {
          setDisplayValue(formatFromMm(Number(value_mm), unit));
      } else {
          setDisplayValue('');
          onChange_mm('');
      }
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
          className="w-full pl-3 pr-20 py-2 bg-slate-800 border border-slate-600 rounded-md shadow-sm placeholder-slate-400 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
          value={displayValue}
          onChange={handleInputChange}
          onFocus={(e) => {
            setIsFocused(true);
            e.target.select();
          }}
          onBlur={handleBlur}
          {...props}
        />
        {!controlledUnit && (
          <div className="absolute inset-y-0 right-0 flex items-center">
              <select
                  aria-label="Units"
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
            <div className="relative">
                <input
                    type="number"
                    inputMode="decimal"
                    placeholder="Weight"
                    id={`${id}-weight`}
                    aria-label={`Weight for ${label}`}
                    name={`${id}-weight`}
                    value={weightValue}
                    onChange={e => onWeightChange(e.target.value === '' ? '' : Number(e.target.value))}
                    className="w-full pl-3 pr-12 py-1 bg-slate-700 border border-slate-600 rounded-md text-white text-xs focus:ring-1 focus:ring-indigo-500"
                    onFocus={(e) => e.target.select()}
                />
                <span className="absolute inset-y-0 right-0 flex items-center pr-2 text-xs text-slate-400 pointer-events-none">kg/m</span>
            </div>
             <div className="relative">
                <input
                    type="number"
                    inputMode="decimal"
                    placeholder="Length"
                    id={`${id}-length`}
                    aria-label={`Length for ${label}`}
                    name={`${id}-length`}
                    value={lengthValue}
                    onChange={e => onLengthChange(e.target.value === '' ? '' : Number(e.target.value))}
                    className="w-full pl-3 pr-5 py-1 bg-slate-700 border border-slate-600 rounded-md text-white text-xs focus:ring-1 focus:ring-indigo-500"
                    onFocus={(e) => e.target.select()}
                />
                <span className="absolute inset-y-0 right-0 flex items-center pr-2 text-xs text-slate-400 pointer-events-none">m</span>
            </div>
        </div>
    )}
    </div>
  );
};