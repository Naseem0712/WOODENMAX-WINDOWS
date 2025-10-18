import React from 'react';
import { AreaType } from '../types';
import { Button } from './ui/Button';
import { Input } from './ui/Input';
import { Select } from './ui/Select';

interface QuotationPanelProps {
    width: number;
    height: number;
    windowTitle: string;
    setWindowTitle: (title: string) => void;
    quantity: number | '';
    setQuantity: (value: number | '') => void;
    areaType: AreaType;
    setAreaType: (type: AreaType) => void;
    rate: number | '';
    setRate: (value: number | '') => void;
    onSave: () => void;
    hardwareCostPerWindow: number;
    quotationItemCount: number;
    onViewQuotation: () => void;
}

const CostDisplay: React.FC<{label:string, value: number, isTotal?: boolean}> = ({label, value, isTotal = false}) => (
    <div className={`p-2 rounded-md ${isTotal ? 'bg-slate-900 ring-1 ring-green-500' : 'bg-slate-700'} text-center`}>
        <p className="text-xs text-slate-400">{label}</p>
        <p className={`font-bold ${isTotal ? 'text-xl text-green-400' : 'text-lg text-white'}`}>
            ₹ {Math.round(value).toLocaleString('en-IN')}
        </p>
    </div>
);


export const QuotationPanel: React.FC<QuotationPanelProps> = ({
    width, height, quantity, setQuantity, areaType, setAreaType, rate, setRate, onSave, windowTitle, setWindowTitle, hardwareCostPerWindow, quotationItemCount, onViewQuotation
}) => {

    const numQuantity = Number(quantity) || 0;
    const numRate = Number(rate) || 0;

    const conversionFactor = areaType === AreaType.SQFT ? 304.8 : 1000;
    const singleArea = (width / conversionFactor) * (height / conversionFactor);
    const totalArea = singleArea * numQuantity;
    const baseCost = totalArea * numRate;
    const totalHardwareCost = hardwareCostPerWindow * numQuantity;
    const totalCost = baseCost + totalHardwareCost;

    return (
        <div className="flex-shrink-0 p-4 bg-slate-800 border-t-2 border-slate-700 shadow-inner">
            <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end max-w-7xl mx-auto">
                <div className="md:col-span-3">
                    <h4 className="text-lg font-semibold text-slate-100 mb-2">Quotation Details</h4>
                    <div className="grid grid-cols-4 gap-2">
                        <div className="col-span-2">
                           <Input 
                                label="Window Tag" 
                                type="text" 
                                placeholder="e.g. Living Room"
                                value={windowTitle}
                                onChange={e => setWindowTitle(e.target.value)}
                            />
                        </div>
                        <Input 
                            label="Quantity" 
                            type="number"
                            inputMode="numeric"
                            placeholder="1"
                            value={quantity}
                            onChange={e => setQuantity(e.target.value === '' ? '' : parseInt(e.target.value) || 0)}
                        />
                        <Select
                            label="Unit"
                            value={areaType}
                            onChange={e => setAreaType(e.target.value as AreaType)}
                        >
                            <option value={AreaType.SQFT}>sq ft</option>
                            <option value={AreaType.SQMT}>sq mt</option>
                        </Select>
                    </div>
                </div>
                
                <div className="md:col-span-2">
                     <Input 
                        label="Base Rate" 
                        type="number"
                        inputMode="decimal"
                        placeholder="e.g., 550"
                        value={rate}
                        onChange={e => setRate(e.target.value === '' ? '' : parseInt(e.target.value) || 0)}
                        unit={`/ ${areaType}`}
                    />
                </div>

                <div className="md:col-span-5 grid grid-cols-4 gap-2 items-end">
                    <div className="p-2 rounded-md bg-slate-700 text-center col-span-1">
                        <p className="text-xs text-slate-400">Total Area</p>
                        <p className="text-lg font-bold text-white">{totalArea.toFixed(2)}</p>
                    </div>
                    <CostDisplay label="Base Cost" value={baseCost} />
                    <CostDisplay label="Hardware Cost" value={totalHardwareCost} />
                    <CostDisplay label="Total Cost" value={totalCost} isTotal={true}/>
                </div>

                <div className="md:col-span-2 flex flex-col space-y-2">
                    <Button onClick={onViewQuotation} variant="secondary" className="w-full h-10">
                        View Quotation ({quotationItemCount})
                    </Button>
                    <Button onClick={onSave} className="w-full h-10" disabled={totalCost <= 0}>
                        Save to Quotation
                    </Button>
                </div>

            </div>
        </div>
    );
};