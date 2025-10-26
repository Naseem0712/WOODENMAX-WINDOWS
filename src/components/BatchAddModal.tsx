import React, { useState, useEffect } from 'react';
import type { WindowConfig } from '../types';
import { v4 as uuidv4 } from 'uuid';
import { Button } from './ui/Button';
import { XMarkIcon } from './icons/XMarkIcon';
import { DimensionInput } from './ui/DimensionInput';
import { Input } from './ui/Input';
import { TrashIcon } from './icons/TrashIcon';
import { PlusIcon } from './icons/PlusIcon';
import { Select } from './ui/Select';

type Unit = 'mm' | 'cm' | 'in' | 'ft-in';

export interface BatchAddItem {
  id: string;
  title: string;
  width: number | '';
  height: number | '';
  quantity: number | '';
  rate: number | '';
}

interface BatchAddModalProps {
  isOpen: boolean;
  onClose: () => void;
  baseConfig: WindowConfig;
  baseRate: number | '';
  onSave: (items: BatchAddItem[]) => void;
}

export const BatchAddModal: React.FC<BatchAddModalProps> = ({ isOpen, onClose, baseConfig, baseRate, onSave }) => {
  const [rows, setRows] = useState<BatchAddItem[]>([]);
  const [unit, setUnit] = useState<Unit>('mm');

  useEffect(() => {
    if (isOpen) {
      setRows([
        {
          id: uuidv4(),
          title: '',
          width: '',
          height: '',
          quantity: 1,
          rate: baseRate,
        }
      ]);
    }
  }, [isOpen, baseRate]);

  if (!isOpen) return null;

  const handleAddRow = () => {
    setRows(prev => [
      ...prev,
      {
        id: uuidv4(),
        title: ``,
        width: '',
        height: '',
        quantity: 1,
        rate: baseRate,
      }
    ]);
  };

  const handleRemoveRow = (id: string) => {
    setRows(prev => prev.filter(row => row.id !== id));
  };

  const handleRowChange = (id: string, field: keyof BatchAddItem, value: string | number) => {
    setRows(prev => prev.map(row => row.id === id ? { ...row, [field]: value } : row));
  };

  const handleSaveClick = () => {
    onSave(rows);
  };

  return (
    <div 
      className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50 p-4"
      onClick={onClose}
      aria-modal="true"
      role="dialog"
    >
      <div 
        className="bg-slate-800 rounded-lg shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex justify-between items-center p-4 border-b border-slate-700">
          <div>
            <h2 className="text-2xl font-bold text-white">Add Multiple Sizes</h2>
            <p className="text-sm text-slate-400">Quickly add variations of the current design to your quotation.</p>
          </div>
          <Button onClick={onClose} variant="secondary" className="p-2 rounded-full h-10 w-10">
            <XMarkIcon className="w-6 h-6" />
          </Button>
        </div>

        <div className="flex-grow overflow-y-auto p-4 custom-scrollbar">
            <div className='flex justify-end mb-4'>
                <div className='w-48'>
                    <Select id="batch-unit-selector" name="batch-unit-selector" label="Dimension Unit" value={unit} onChange={e => setUnit(e.target.value as Unit)}>
                        <option value="mm">mm</option>
                        <option value="cm">cm</option>
                        <option value="in">in</option>
                        <option value="ft-in">ft-in</option>
                    </Select>
                </div>
            </div>

            <div className='space-y-3'>
                <div className="hidden md:grid grid-cols-12 gap-x-2 px-2 text-xs font-semibold text-slate-400">
                    <div className="col-span-3">Title</div>
                    <div className="col-span-2">Width</div>
                    <div className="col-span-2">Height</div>
                    <div className="col-span-2">Quantity</div>
                    <div className="col-span-2">Rate</div>
                    <div className="col-span-1"></div>
                </div>

                {rows.map((row, index) => (
                    <div key={row.id} className="bg-slate-700/50 rounded-lg p-3">
                        <div className="flex flex-col md:flex-row md:items-center md:gap-x-2 space-y-2 md:space-y-0">
                             <div className="flex-grow md:w-3/12">
                                <Input id={`batch-title-${row.id}`} name={`batch-title-${row.id}`} label="Title" placeholder={`Window ${index + 1}`} value={row.title} onChange={e => handleRowChange(row.id, 'title', e.target.value)} className="!py-1.5"/>
                            </div>
                            <div className="flex-grow md:w-2/12">
                                <DimensionInput id={`batch-width-${row.id}`} name={`batch-width-${row.id}`} label="Width" value_mm={row.width} onChange_mm={v => handleRowChange(row.id, 'width', v)} controlledUnit={unit} />
                            </div>
                            <div className="flex-grow md:w-2/12">
                                <DimensionInput id={`batch-height-${row.id}`} name={`batch-height-${row.id}`} label="Height" value_mm={row.height} onChange_mm={v => handleRowChange(row.id, 'height', v)} controlledUnit={unit} />
                            </div>
                            <div className="flex-grow md:w-2/12">
                                <Input id={`batch-qty-${row.id}`} name={`batch-qty-${row.id}`} label="Quantity" type="number" inputMode="numeric" placeholder="1" value={row.quantity} onChange={e => handleRowChange(row.id, 'quantity', e.target.value)} className="!py-1.5" />
                            </div>
                            <div className="flex-grow md:w-2/12">
                                <Input id={`batch-rate-${row.id}`} name={`batch-rate-${row.id}`} label="Rate" type="number" inputMode="numeric" placeholder="550" value={row.rate} onChange={e => handleRowChange(row.id, 'rate', e.target.value)} className="!py-1.5" />
                            </div>
                            <div className="flex-shrink-0 md:w-1/12 text-right">
                               {rows.length > 1 && (
                                <Button variant="danger" onClick={() => handleRemoveRow(row.id)} className="p-2 h-8 w-8 ml-auto">
                                    <TrashIcon className="w-4 h-4"/>
                                </Button>
                               )}
                            </div>
                        </div>
                    </div>
                ))}

                 <Button variant="secondary" onClick={handleAddRow} className="w-full mt-2">
                    <PlusIcon className="w-4 h-4 mr-2"/> Add Another Size
                </Button>
            </div>
        </div>
        
        <div className="flex-shrink-0 p-4 border-t border-slate-700 flex justify-end gap-2">
            <Button variant="secondary" onClick={onClose}>Cancel</Button>
            <Button onClick={handleSaveClick}>Save All ({rows.length}) to Quotation</Button>
        </div>
      </div>
    </div>
  );
};