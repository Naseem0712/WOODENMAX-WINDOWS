import React, { useRef, useState } from 'react';
import type { QuotationItem, QuotationSettings } from '../types';
import { Button } from './ui/Button';
import { XMarkIcon } from './icons/XMarkIcon';
import { TrashIcon } from './icons/TrashIcon';
import { Input } from './ui/Input';
import { PrinterIcon } from './icons/PrinterIcon';
import { UploadIcon } from './icons/UploadIcon';
import { Select } from './ui/Select';
import { PrintPreview } from './PrintPreview';

interface QuotationListModalProps {
  isOpen: boolean;
  onClose: () => void;
  items: QuotationItem[];
  onRemove: (id: string) => void;
  settings: QuotationSettings;
  setSettings: (settings: QuotationSettings) => void;
}

const Section: React.FC<{title: string, children: React.ReactNode, className?: string}> = ({title, children, className}) => (
    <div className={`bg-slate-700/50 p-4 rounded-lg ${className}`}>
        <h3 className="font-bold text-lg text-indigo-300 mb-3 border-b border-slate-600 pb-2">{title}</h3>
        <div className="space-y-3">{children}</div>
    </div>
);

const TextArea: React.FC<React.TextareaHTMLAttributes<HTMLTextAreaElement> & {label: string}> = ({label, ...props}) => (
    <div>
      <label className="block text-sm font-medium text-slate-300 mb-1">{label}</label>
      <textarea {...props} className="w-full h-24 px-3 py-2 bg-slate-800 border border-slate-600 rounded-md shadow-sm placeholder-slate-400 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm custom-scrollbar" />
    </div>
);


export const QuotationListModal: React.FC<QuotationListModalProps> = ({ isOpen, onClose, items, onRemove, settings, setSettings }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);

  if (!isOpen) return null;
  if (isPreviewOpen) {
    return <PrintPreview 
        isOpen={isPreviewOpen}
        onClose={() => setIsPreviewOpen(false)}
        items={items}
        settings={settings}
        setSettings={setSettings}
    />;
  }

  const handleSettingsChange = <
    K extends { [P in keyof QuotationSettings]: QuotationSettings[P] extends object ? P : never }[keyof QuotationSettings],
    F extends keyof QuotationSettings[K]
  >(section: K, field: F, value: QuotationSettings[K][F]) => {
    setSettings({
        ...settings,
        [section]: {
            ...settings[section],
            [field]: value,
        }
    });
  }

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        handleSettingsChange('company', 'logo', reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  }

  const subTotal = items.reduce((total, item) => {
    const conversionFactor = item.areaType === 'sqft' ? 304.8 : 1000;
    const singleArea = (Number(item.config.width) / conversionFactor) * (Number(item.config.height) / conversionFactor);
    const totalArea = singleArea * item.quantity;
    const baseCost = totalArea * item.rate;
    const totalHardwareCost = item.hardwareCost * item.quantity;
    return total + baseCost + totalHardwareCost;
  }, 0);

  const discountAmount = settings.financials.discountType === 'percentage' 
    ? subTotal * (Number(settings.financials.discount) / 100) 
    : Number(settings.financials.discount);
  
  const totalAfterDiscount = subTotal - discountAmount;
  const gstAmount = totalAfterDiscount * (Number(settings.financials.gstPercentage) / 100);
  const grandTotal = totalAfterDiscount + gstAmount;

  return (
    <div 
        className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50 p-4"
        onClick={onClose}
        aria-modal="true"
        role="dialog"
    >
      <div 
        className="bg-slate-800 rounded-lg shadow-2xl w-full max-w-7xl max-h-[90vh] flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex justify-between items-center p-4 border-b border-slate-700 no-print">
          <h2 className="text-2xl font-bold text-white">Quotation Generator</h2>
          <div className="flex items-center gap-2">
            <Button onClick={() => setIsPreviewOpen(true)} variant="secondary"><PrinterIcon className="w-5 h-5 mr-2"/> Print Preview</Button>
            <Button onClick={onClose} variant="secondary" className="p-2 rounded-full h-10 w-10">
                <XMarkIcon className="w-6 h-6" />
            </Button>
          </div>
        </div>

        <div className="flex-grow overflow-y-auto p-6 custom-scrollbar space-y-4">
            <Input label="Quotation Title" value={settings.title} onChange={e => setSettings({...settings, title: e.target.value})} className="mb-4 text-xl" />
            <div className="grid md:grid-cols-2 gap-4">
                <Section title="Your Company Details">
                    <div className="flex gap-4 items-center">
                        <img src={settings.company.logo || 'https://via.placeholder.com/80'} alt="Company Logo" className="w-20 h-20 rounded-md object-cover bg-slate-600"/>
                        <div className="flex-grow">
                            <Input label="Company Name" value={settings.company.name} onChange={e => handleSettingsChange('company', 'name', e.target.value)} />
                            <Button variant="secondary" className="w-full mt-2" onClick={() => fileInputRef.current?.click()}><UploadIcon className="w-4 h-4 mr-2"/> Upload Logo</Button>
                            <input type="file" ref={fileInputRef} onChange={handleLogoUpload} className="hidden" accept="image/*" />
                        </div>
                    </div>
                     <Input label="Address" value={settings.company.address} onChange={e => handleSettingsChange('company', 'address', e.target.value)} />
                     <div className="grid grid-cols-2 gap-4">
                        <Input label="Email" type="email" value={settings.company.email} onChange={e => handleSettingsChange('company', 'email', e.target.value)} />
                        <Input label="Website" value={settings.company.website} onChange={e => handleSettingsChange('company', 'website', e.target.value)} />
                     </div>
                </Section>
                <Section title="Customer Details">
                     <Input label="Customer Name" value={settings.customer.name} onChange={e => handleSettingsChange('customer', 'name', e.target.value)} />
                     <Input label="Address" value={settings.customer.address} onChange={e => handleSettingsChange('customer', 'address', e.target.value)} />
                     <Input label="Contact Person" value={settings.customer.contactPerson} onChange={e => handleSettingsChange('customer', 'contactPerson', e.target.value)} />
                </Section>
            </div>
            
            <Section title="Quotation Items">
                {items.length === 0 ? (
                    <p className="text-slate-400 text-center py-8">Your quotation is empty. Add items from the main screen.</p>
                ) : (
                    <div className="space-y-2">
                        {items.map((item, index) => {
                            const conversionFactor = item.areaType === 'sqft' ? 304.8 : 1000;
                            const singleArea = (Number(item.config.width) / conversionFactor) * (Number(item.config.height) / conversionFactor);
                            const totalArea = singleArea * item.quantity;
                            const baseCost = totalArea * item.rate;
                            const totalHardwareCost = item.hardwareCost * item.quantity;
                            const totalCost = baseCost + totalHardwareCost;

                            return (
                                <div key={item.id} className="bg-slate-900/50 p-3 rounded-lg flex flex-col md:flex-row md:items-center gap-4">
                                    <span className="font-bold text-slate-300">#{index+1}</span>
                                    <div className="flex-grow">
                                        <h4 className="font-bold text-md text-white">{item.title}</h4>
                                        <p className="text-xs text-slate-300">
                                            {item.config.width}mm x {item.config.height}mm  |  Qty: {item.quantity}  |  Rate: ₹{Math.round(item.rate)}/{item.areaType}
                                        </p>
                                    </div>
                                    <div className="flex items-center gap-4 text-xs whitespace-nowrap">
                                        <div className="text-right">
                                            <p className="text-slate-400">Hardware</p>
                                            <p className="font-semibold text-slate-200">₹{Math.round(totalHardwareCost).toLocaleString('en-IN')}</p>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-slate-400">Base Cost</p>
                                            <p className="font-semibold text-slate-200">₹{Math.round(baseCost).toLocaleString('en-IN')}</p>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-slate-400">Total</p>
                                            <p className="font-bold text-lg text-green-400">₹{Math.round(totalCost).toLocaleString('en-IN')}</p>
                                        </div>
                                    </div>
                                    <Button variant="danger" onClick={() => onRemove(item.id)} className="p-2 h-9 w-9 flex-shrink-0 no-print">
                                        <TrashIcon className="w-4 h-4"/>
                                    </Button>
                                </div>
                            )
                        })}
                    </div>
                )}
            </Section>

            <div className="grid md:grid-cols-2 gap-4">
                <Section title="Details & Terms">
                    <TextArea label="Description" value={settings.description} onChange={e => setSettings({...settings, description: e.target.value})} maxLength={1500} />
                    <TextArea label="Terms & Conditions" value={settings.terms} onChange={e => setSettings({...settings, terms: e.target.value})} />
                </Section>
                <Section title="Bank & Signature">
                    <div className="grid grid-cols-2 gap-4">
                        <Input label="A/C Name" value={settings.bankDetails.name} onChange={e => handleSettingsChange('bankDetails', 'name', e.target.value)} />
                        <Input label="A/C Number" type="text" inputMode="numeric" value={settings.bankDetails.accountNumber} onChange={e => handleSettingsChange('bankDetails', 'accountNumber', e.target.value)} />
                    </div>
                    <div className="grid grid-cols-3 gap-4">
                        <Input label="IFSC Code" value={settings.bankDetails.ifsc} onChange={e => handleSettingsChange('bankDetails', 'ifsc', e.target.value)} />
                        <Input label="Branch" value={settings.bankDetails.branch} onChange={e => handleSettingsChange('bankDetails', 'branch', e.target.value)} />
                        <Select label="A/C Type" value={settings.bankDetails.accountType} onChange={e => handleSettingsChange('bankDetails', 'accountType', e.target.value as 'savings' | 'current')}>
                            <option value="current">Current</option>
                            <option value="savings">Savings</option>
                        </Select>
                    </div>
                    <div className="pt-4">
                        <label className="block text-sm font-medium text-slate-300 mb-1">Authorised Signature</label>
                        <div className="h-24 border border-dashed border-slate-600 rounded-md"></div>
                    </div>
                </Section>
            </div>
        </div>

        <div className="p-4 bg-slate-900 border-t border-slate-700 flex flex-wrap justify-end items-center gap-4">
            <div className="text-right text-sm">
                <span className="text-slate-300">Sub Total:</span>
                <span className="font-semibold text-white ml-2">₹{Math.round(subTotal).toLocaleString('en-IN')}</span>
            </div>
            <div className="flex gap-2 items-center">
                <div className="w-32"><Input label="Discount" type="number" inputMode="decimal" value={settings.financials.discount} onChange={e => handleSettingsChange('financials', 'discount', e.target.value === '' ? '' : Number(e.target.value))}/></div>
                <Select label="" value={settings.financials.discountType} onChange={e => handleSettingsChange('financials', 'discountType', e.target.value as 'percentage' | 'fixed')} className="mt-5">
                    <option value="percentage">%</option>
                    <option value="fixed">₹</option>
                </Select>
                 <span className="text-red-400 text-sm mt-5">(-₹{Math.round(discountAmount).toLocaleString('en-IN')})</span>
            </div>
             <div className="flex gap-2 items-center">
                <div className="w-24"><Input label="GST" type="number" inputMode="decimal" value={settings.financials.gstPercentage} onChange={e => handleSettingsChange('financials', 'gstPercentage', e.target.value === '' ? '' : Number(e.target.value))} unit="%"/></div>
                <span className="text-green-400 text-sm mt-5">(+₹{Math.round(gstAmount).toLocaleString('en-IN')})</span>
            </div>
            <div className="text-right">
                <span className="text-lg font-semibold text-slate-300">Grand Total:</span>
                <span className="text-3xl font-bold text-green-400 ml-3">
                    ₹{Math.round(grandTotal).toLocaleString('en-IN')}
                </span>
            </div>
        </div>
      </div>
    </div>
  );
};