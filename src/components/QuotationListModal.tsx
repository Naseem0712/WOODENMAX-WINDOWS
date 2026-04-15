import React, { useRef, useState, useEffect, useMemo, useCallback } from 'react';
import type { QuotationItem, QuotationSettings, BOM } from '../types';
import { ShutterConfigType, WindowType } from '../types';
import { Button } from './ui/Button';
import { XMarkIcon } from './icons/XMarkIcon';
import { Input } from './ui/Input';
import { PrinterIcon } from './icons/PrinterIcon';
import { UploadIcon } from './icons/UploadIcon';
import { Select } from './ui/Select';
import { PrintPreview } from './PrintPreview';
import { DownloadIcon } from './icons/DownloadIcon';
import { generateBillOfMaterials } from '../utils/materialCalculator';
import { MaterialSummaryModal } from './MaterialSummaryModal';
import { calculateMaterialCostSummary } from '../utils/materialCosting';
import { ClipboardDocumentListIcon } from './icons/ClipboardDocumentListIcon';
import { PencilIcon } from './icons/PencilIcon';
import { TrashIcon } from './icons/TrashIcon';
import { sanitizeFilenameSegment } from '../utils/pdfFilename';
import { autoContinueTermsSerial } from '../utils/quotationText';
interface QuotationListModalProps {
  isOpen: boolean;
  onClose: () => void;
  items: QuotationItem[];
  setItems: (items: QuotationItem[]) => void;
  onRemove: (id: string) => void;
  onEdit: (id: string) => void;
  settings: QuotationSettings;
  setSettings: (settings: QuotationSettings) => void;
  onTogglePreview: (isPreviewing: boolean) => void;
  selectedLineIds: string[];
  onSelectedLineIdsChange: (ids: string[]) => void;
  /** Opens designer with first selected line; user changes in Configure, then applies from quotation bar. */
  onEditCorrection: () => void;
}

const Section: React.FC<{title: string, children: React.ReactNode, className?: string}> = ({title, children, className}) => (
    <div className={`bg-slate-700/50 p-4 rounded-lg ${className}`}>
        <h3 className="font-bold text-lg text-indigo-300 mb-3 border-b border-slate-600 pb-2">{title}</h3>
        <div className="space-y-3">{children}</div>
    </div>
);

const TextArea: React.FC<React.TextareaHTMLAttributes<HTMLTextAreaElement> & {label: string}> = ({id, label, ...props}) => (
    <div>
      <label htmlFor={id} className="block text-sm font-medium text-slate-300 mb-1">{label}</label>
      <textarea id={id} name={id} {...props} className="w-full h-24 px-3 py-2 bg-slate-800 border border-slate-600 rounded-md shadow-sm placeholder-slate-400 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm custom-scrollbar" />
    </div>
);


const WINDOW_TYPE_FILTER_LABEL: Record<WindowType, string> = {
  [WindowType.SLIDING]: 'Sliding',
  [WindowType.CASEMENT]: 'Casement',
  [WindowType.VENTILATOR]: 'Ventilator',
  [WindowType.GLASS_PARTITION]: 'Glass partition',
  [WindowType.CORNER]: 'Corner',
  [WindowType.MIRROR]: 'Mirror',
  [WindowType.LOUVERS]: 'Louvers',
};
const FEET_PER_MM = 0.00328084;

export const QuotationListModal: React.FC<QuotationListModalProps> = ({
  isOpen,
  onClose,
  items,
  setItems,
  onRemove,
  onEdit,
  settings,
  setSettings,
  onTogglePreview,
  selectedLineIds,
  onSelectedLineIdsChange,
  onEditCorrection,
}) => {
  const companyLogoInputRef = useRef<HTMLInputElement>(null);
  const importQuotationInputRef = useRef<HTMLInputElement>(null);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [isMaterialSummaryOpen, setIsMaterialSummaryOpen] = useState(false);
  const [bom, setBom] = useState<BOM | null>(null);
  const [typeFilter, setTypeFilter] = useState<WindowType | 'all'>('all');
  const visibleItems = useMemo(() => {
    if (typeFilter === 'all') return items;
    return items.filter((i) => i.config.windowType === typeFilter);
  }, [items, typeFilter]);
  const makingChargePerSqFt = Number(settings.materialRates.makingChargePerSqFt) || 120;
  const materialCostSummary = useMemo(
    () => calculateMaterialCostSummary(items, settings.materialRates, makingChargePerSqFt),
    [items, settings.materialRates]
  );
  const rateUsage = useMemo(() => {
    const source = visibleItems.length > 0 ? visibleItems : items;
    const glassClear = new Set<string>();
    const glassLaminated = new Set<string>();
    const glassDgu = new Set<string>();
    let usesSliding = false;
    let usesMesh = false;
    let usesSlimInterlock = false;

    for (const item of source) {
      const config = item.config;
      if (config.windowType === WindowType.SLIDING) {
        usesSliding = true;
        if (config.shutterConfig === ShutterConfigType.TWO_GLASS_ONE_MESH || config.shutterConfig === ShutterConfigType.FOUR_GLASS_TWO_MESH) {
          usesMesh = true;
        }
        const isReinf = /reinf|reinforcement/i.test(`${config.series.name} ${config.series.id}`);
        if (!isReinf) usesSlimInterlock = true;
      }

      if (config.glassSpecialType === 'laminated') {
        const key = `${Number(config.laminatedGlassConfig?.glass1Thickness) || 0}+${Number(config.laminatedGlassConfig?.glass2Thickness) || 0}`;
        glassLaminated.add(key);
      } else if (config.glassSpecialType === 'dgu') {
        const key = `${Number(config.dguGlassConfig?.glass1Thickness) || 0}+${Number(config.dguGlassConfig?.airGap) || 0}+${Number(config.dguGlassConfig?.glass2Thickness) || 0}`;
        glassDgu.add(key);
      } else {
        glassClear.add(String(Number(config.glassThickness) || 0));
      }
    }

    return {
      usesSliding,
      usesMesh,
      usesSlimInterlock,
      glassClear,
      glassLaminated,
      glassDgu,
    };
  }, [visibleItems, items]);

  const toggleSelect = useCallback(
    (id: string) => {
      onSelectedLineIdsChange(
        selectedLineIds.includes(id) ? selectedLineIds.filter((x) => x !== id) : [...selectedLineIds, id]
      );
    },
    [selectedLineIds, onSelectedLineIdsChange]
  );

  const selectAllVisible = useCallback(() => {
    const next = new Set(selectedLineIds);
    visibleItems.forEach((i) => next.add(i.id));
    onSelectedLineIdsChange(Array.from(next));
  }, [selectedLineIds, visibleItems, onSelectedLineIdsChange]);

  const clearSelection = useCallback(() => onSelectedLineIdsChange([]), [onSelectedLineIdsChange]);

  useEffect(() => {
    if (!isOpen) setTypeFilter('all');
  }, [isOpen]);

  useEffect(() => {
    onTogglePreview(isPreviewOpen || isMaterialSummaryOpen);
  }, [isPreviewOpen, isMaterialSummaryOpen, onTogglePreview]);
  
  useEffect(() => {
    if (isPreviewOpen) {
        document.documentElement.classList.add('print-preview-active');
    } else {
        document.documentElement.classList.remove('print-preview-active');
    }
    return () => {
        document.documentElement.classList.remove('print-preview-active');
    };
  }, [isPreviewOpen]);

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

  if (isMaterialSummaryOpen && bom) {
      return <MaterialSummaryModal 
        isOpen={isMaterialSummaryOpen} 
        onClose={() => setIsMaterialSummaryOpen(false)}
        bom={bom}
        items={items}
        settings={settings}
      />
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

  const handleMaterialRateChange = (
    group: 'powderCoatingPerRft' | 'clear' | 'laminated' | 'dgu',
    key: string,
    value: number
  ) => {
    if (group === 'powderCoatingPerRft') {
      setSettings({
        ...settings,
        materialRates: {
          ...settings.materialRates,
          powderCoatingPerRft: {
            ...settings.materialRates.powderCoatingPerRft,
            [key]: value,
          },
        },
      });
      return;
    }

    setSettings({
      ...settings,
      materialRates: {
        ...settings.materialRates,
        glassPerSqFt: {
          ...settings.materialRates.glassPerSqFt,
          [group]: {
            ...settings.materialRates.glassPerSqFt[group],
            [key]: value,
          },
        },
      },
    });
  };

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

  const handleExport = () => {
    const quotationData = {
        settings,
        items,
    };
    const jsonString = JSON.stringify(quotationData, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    const date = new Date().toISOString().slice(0, 10);
    const customer = sanitizeFilenameSegment(settings.customer.name, 'Customer');
    link.download = `WoodenMax-Quotation-${customer}-${date}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
        try {
            const result = event.target?.result as string;
            const data = JSON.parse(result);
            if (data.settings && data.items && Array.isArray(data.items)) {
                const importedSettings: QuotationSettings = {
                  ...settings,
                  ...data.settings,
                  company: {
                    ...settings.company,
                    ...data.settings.company,
                    gstNumber: String(data.settings.company?.gstNumber || '').toUpperCase(),
                  },
                  customer: {
                    ...settings.customer,
                    ...data.settings.customer,
                    gstNumber: String(data.settings.customer?.gstNumber || '').toUpperCase(),
                  },
                  financials: { ...settings.financials, ...data.settings.financials },
                  bankDetails: { ...settings.bankDetails, ...data.settings.bankDetails },
                  materialRates: {
                    ...settings.materialRates,
                    ...data.settings.materialRates,
                    makingChargePerSqFt: Number(data.settings.materialRates?.makingChargePerSqFt) || settings.materialRates.makingChargePerSqFt,
                    meshPerSqFt: Number(data.settings.materialRates?.meshPerSqFt) || settings.materialRates.meshPerSqFt,
                    meshShutterOptions: {
                      ...settings.materialRates.meshShutterOptions,
                      ...data.settings.materialRates?.meshShutterOptions,
                      separateSections: Boolean(data.settings.materialRates?.meshShutterOptions?.separateSections),
                    },
                    wastageCartagePerSqFt: Number(data.settings.materialRates?.wastageCartagePerSqFt) || settings.materialRates.wastageCartagePerSqFt || 0,
                    profit: {
                      ...settings.materialRates.profit,
                      ...data.settings.materialRates?.profit,
                      mode: data.settings.materialRates?.profit?.mode === 'per_sqft' ? 'per_sqft' : (settings.materialRates.profit.mode || 'percentage'),
                      value: Number(data.settings.materialRates?.profit?.value) || settings.materialRates.profit.value,
                    },
                    powderCoatingPerRft: {
                      ...settings.materialRates.powderCoatingPerRft,
                      ...data.settings.materialRates?.powderCoatingPerRft,
                    },
                    glassPerSqFt: {
                      ...settings.materialRates.glassPerSqFt,
                      ...data.settings.materialRates?.glassPerSqFt,
                      clear: {
                        ...settings.materialRates.glassPerSqFt.clear,
                        ...data.settings.materialRates?.glassPerSqFt?.clear,
                      },
                      laminated: {
                        ...settings.materialRates.glassPerSqFt.laminated,
                        ...data.settings.materialRates?.glassPerSqFt?.laminated,
                      },
                      dgu: {
                        ...settings.materialRates.glassPerSqFt.dgu,
                        ...data.settings.materialRates?.glassPerSqFt?.dgu,
                      },
                    },
                  },
                };
                setSettings(importedSettings);
                setItems(data.items);
                alert('Quotation imported successfully!');
            } else {
                throw new Error('Invalid quotation file format.');
            }
        } catch (error) {
            console.error('Failed to import quotation:', error);
            alert('Error: Could not import the quotation file. It might be invalid or corrupted.');
        }
    };
    reader.readAsText(file);
    e.target.value = ''; // Reset file input
  };
  
  const handleGenerateBom = () => {
      if (items.length === 0) {
          alert("Please add items to the quotation before generating a material summary.");
          return;
      }
      const calculatedBom = generateBillOfMaterials(items);
      setBom(calculatedBom);
      setIsMaterialSummaryOpen(true);
  }

  const handleExportStockNeed = () => {
    if (items.length === 0) {
      alert("Please add items before exporting stock need.");
      return;
    }
    const bomData = generateBillOfMaterials(items);
    const csvRows: string[][] = [];
    csvRows.push(['Party Name', settings.customer.name || '']);
    csvRows.push(['Quotation Title', settings.title || '']);
    csvRows.push(['Date', new Date().toISOString().slice(0, 10)]);
    csvRows.push([]);
    csvRows.push([
      'Category',
      'Series',
      'Item',
      'Unit',
      'Purchase Qty',
      'Used Length (ft)',
      'Purchase Length (ft)',
      'Wastage (ft)',
      'Used Weight (kg)',
      'Purchase Weight (kg)',
      'Wastage (kg)',
      'Area (sq ft)',
      'Cutting Plan (ft pieces)',
    ]);

    bomData.forEach((seriesData) => {
      seriesData.profiles.forEach((profile) => {
        const usedLengthFt = profile.totalLength * FEET_PER_MM;
        const purchaseLengthFt = profile.requiredBars * profile.standardLength * FEET_PER_MM;
        const wastageFt = Math.max(0, purchaseLengthFt - usedLengthFt);
        const usedWeight = profile.totalWeight || 0;
        const purchaseWeight = ((profile.requiredBars * profile.standardLength) / 1000) * (profile.weightPerMeter || 0);
        const wastageWeight = Math.max(0, purchaseWeight - usedWeight);
        const piecesFt = profile.pieces.map((p) => (p * FEET_PER_MM).toFixed(2));
        const cuttingPlan = piecesFt.length > 40
          ? `${piecesFt.slice(0, 40).join(' | ')} | ... (+${piecesFt.length - 40} pcs)`
          : piecesFt.join(' | ');
        csvRows.push([
          'Profile',
          seriesData.seriesName,
          profile.profileKey,
          'ft / kg',
          String(profile.requiredBars),
          usedLengthFt.toFixed(2),
          purchaseLengthFt.toFixed(2),
          wastageFt.toFixed(2),
          usedWeight.toFixed(2),
          purchaseWeight.toFixed(2),
          wastageWeight.toFixed(2),
          '',
          cuttingPlan,
        ]);
      });

      seriesData.glass.forEach((g) => {
        csvRows.push([
          'Glass',
          seriesData.seriesName,
          g.description,
          'sq ft',
          '',
          '',
          '',
          '',
          '',
          '',
          '',
          g.totalAreaSqFt.toFixed(2),
          '',
        ]);
      });

      if (seriesData.mesh) {
        csvRows.push([
          'Mesh',
          seriesData.seriesName,
          'Mesh Area',
          'sq ft',
          '',
          '',
          '',
          '',
          '',
          '',
          '',
          seriesData.mesh.totalAreaSqFt.toFixed(2),
          '',
        ]);
      }

      seriesData.hardware.forEach((hw) => {
        csvRows.push([
          'Hardware',
          seriesData.seriesName,
          hw.name,
          'pcs',
          String(hw.totalQuantity),
          '',
          '',
          '',
          '',
          '',
          '',
          '',
          '',
        ]);
      });
    });

    const toCsvCell = (value: string) => `"${String(value ?? '').replace(/"/g, '""')}"`;
    const csvText = csvRows.map((row) => row.map(toCsvCell).join(',')).join('\n');
    const blob = new Blob([csvText], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    const date = new Date().toISOString().slice(0, 10);
    const customer = sanitizeFilenameSegment(settings.customer.name, 'Party');
    link.download = `Stock-Need-${customer}-${date}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

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
  const profitBeforeDiscount = materialCostSummary.totals.profitCost;
  const profitAfterDiscount = profitBeforeDiscount - discountAmount;
  
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
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center p-4 border-b border-slate-700 no-print gap-4 sm:gap-0">
          <h2 className="text-2xl font-bold text-white">Quotation Generator</h2>
          <div className="flex items-center gap-2 flex-wrap justify-end">
            <Button onClick={handleGenerateBom} variant="secondary"><ClipboardDocumentListIcon className="w-5 h-5 mr-2"/> Export Materials (BOM)</Button>
            <Button onClick={handleExportStockNeed} variant="secondary"><ClipboardDocumentListIcon className="w-5 h-5 mr-2"/> Export Stock Need</Button>
            <Button onClick={handleExport} variant="secondary"><DownloadIcon className="w-5 h-5 mr-2"/> Export JSON</Button>
            <Button onClick={() => importQuotationInputRef.current?.click()} variant="secondary"><UploadIcon className="w-5 h-5 mr-2"/> Import JSON</Button>
            <input type="file" ref={importQuotationInputRef} onChange={handleImport} className="hidden" accept="application/json" />
            <Button onClick={() => setIsPreviewOpen(true)}><PrinterIcon className="w-5 h-5 mr-2"/> Print Preview</Button>
            <Button onClick={onClose} variant="secondary" className="p-2 rounded-full h-10 w-10">
                <XMarkIcon className="w-6 h-6" />
            </Button>
          </div>
        </div>

        <div className="flex-grow overflow-y-auto p-6 custom-scrollbar">
            <div className="space-y-4">
              <div className="mb-4">
                  <label htmlFor="modal-quotation-title" className="sr-only">Quotation Title</label>
                  <input id="modal-quotation-title" name="modal-quotation-title" value={settings.title} onChange={e => setSettings({...settings, title: e.target.value})} className="w-full text-2xl font-bold bg-transparent border-0 border-b-2 border-slate-700 hover:border-slate-500 focus:ring-0 focus:border-indigo-500 p-1 text-white transition-colors" />
              </div>
              <div className="grid md:grid-cols-2 gap-4">
                  <Section title="Your Company Details">
                      <div className="flex gap-4 items-center">
                          <img src={settings.company.logo || 'https://via.placeholder.com/80'} alt="Company Logo" className="w-20 h-20 rounded-md object-cover bg-slate-600"/>
                          <div className="flex-grow">
                              <Input id="modal-company-name" name="modal-company-name" label="Company Name" value={settings.company.name} onChange={e => handleSettingsChange('company', 'name', e.target.value)} />
                              <Button variant="secondary" className="w-full mt-2" onClick={() => companyLogoInputRef.current?.click()}><UploadIcon className="w-4 h-4 mr-2"/> Upload Logo</Button>
                              <input type="file" ref={companyLogoInputRef} onChange={handleLogoUpload} className="hidden" accept="image/*" />
                          </div>
                      </div>
                      <Input id="modal-company-address" name="modal-company-address" label="Address" value={settings.company.address} onChange={e => handleSettingsChange('company', 'address', e.target.value)} />
                      <div className="grid grid-cols-2 gap-4">
                          <Input id="modal-company-email" name="modal-company-email" label="Email" type="email" value={settings.company.email} onChange={e => handleSettingsChange('company', 'email', e.target.value)} />
                          <Input id="modal-company-website" name="modal-company-website" label="Website" value={settings.company.website} onChange={e => handleSettingsChange('company', 'website', e.target.value)} />
                      </div>
                      <Input
                        id="modal-company-gst-number"
                        name="modal-company-gst-number"
                        label="GST Number (Optional)"
                        value={settings.company.gstNumber || ''}
                        onChange={e => handleSettingsChange('company', 'gstNumber', e.target.value.toUpperCase())}
                      />
                  </Section>
                  <Section title="Customer Details">
                      <Input id="modal-customer-name" name="modal-customer-name" label="Customer Name" value={settings.customer.name} onChange={e => handleSettingsChange('customer', 'name', e.target.value)} />
                      <Input id="modal-customer-address" name="modal-customer-address" label="Address" value={settings.customer.address} onChange={e => handleSettingsChange('customer', 'address', e.target.value)} />
                      <Input id="modal-customer-contact" name="modal-customer-contact" label="Contact Person" value={settings.customer.contactPerson} onChange={e => handleSettingsChange('customer', 'contactPerson', e.target.value)} />
                      <div className="grid grid-cols-2 gap-4">
                          <Input id="modal-customer-email" name="modal-customer-email" label="Email (Optional)" type="email" value={settings.customer.email || ''} onChange={e => handleSettingsChange('customer', 'email', e.target.value)} />
                          <Input id="modal-customer-website" name="modal-customer-website" label="Website (Optional)" value={settings.customer.website || ''} onChange={e => handleSettingsChange('customer', 'website', e.target.value)} />
                      </div>
                      <Input
                        id="modal-customer-gst-number"
                        name="modal-customer-gst-number"
                        label="Customer GST Number (Optional)"
                        value={settings.customer.gstNumber || ''}
                        onChange={e => handleSettingsChange('customer', 'gstNumber', e.target.value.toUpperCase())}
                      />
                  </Section>
              </div>
              
              <Section title="Quotation Items">
                  {items.length === 0 ? (
                      <p className="text-slate-400 text-center py-8">Your quotation is empty. Add items from the main screen or import a quotation file.</p>
                  ) : (
                      <div className="space-y-3">
                          <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-center gap-2 justify-between">
                            <div className="flex flex-wrap items-center gap-2">
                              <label className="text-sm text-slate-300 flex items-center gap-2">
                                <span>Show type</span>
                                <select
                                  value={typeFilter}
                                  onChange={(e) => setTypeFilter(e.target.value as WindowType | 'all')}
                                  className="bg-slate-800 border border-slate-600 rounded-md px-2 py-1 text-white text-sm"
                                >
                                  <option value="all">All</option>
                                  {(Object.values(WindowType) as WindowType[]).map((t) => (
                                    <option key={t} value={t}>
                                      {WINDOW_TYPE_FILTER_LABEL[t]}
                                    </option>
                                  ))}
                                </select>
                              </label>
                              <Button type="button" variant="secondary" className="text-xs py-1 h-8" onClick={selectAllVisible}>
                                Select visible
                              </Button>
                              <Button type="button" variant="secondary" className="text-xs py-1 h-8" onClick={clearSelection}>
                                Clear selection
                              </Button>
                            </div>
                            <Button
                              type="button"
                              onClick={onEditCorrection}
                              disabled={selectedLineIds.length === 0}
                              className="no-print"
                            >
                              Edit correction ({selectedLineIds.length})
                            </Button>
                          </div>
                          <div className="space-y-2">
                          {visibleItems.map((item) => {
                              const conversionFactor = item.areaType === 'sqft' ? 304.8 : 1000;
                              const singleArea = (Number(item.config.width) / conversionFactor) * (Number(item.config.height) / conversionFactor);
                              const totalArea = singleArea * item.quantity;
                              const baseCost = totalArea * item.rate;
                              const totalHardwareCost = item.hardwareCost * item.quantity;
                              const totalCost = baseCost + totalHardwareCost;
                              const materialCost = materialCostSummary.byItemId[item.id];
                              const globalIndex = items.findIndex((i) => i.id === item.id) + 1;
                              const wt = item.config.windowType;

                              return (
                                  <div key={item.id} className="bg-slate-900/50 p-3 rounded-lg flex flex-col md:flex-row md:items-center gap-4">
                                      <label className="flex items-center gap-2 cursor-pointer shrink-0 no-print">
                                        <input
                                          type="checkbox"
                                          checked={selectedLineIds.includes(item.id)}
                                          onChange={() => toggleSelect(item.id)}
                                          className="rounded border-slate-500"
                                          aria-label={`Select ${item.title}`}
                                        />
                                        <span className="font-bold text-slate-300">#{globalIndex}</span>
                                      </label>
                                      <div className="flex-grow min-w-0">
                                          <h4 className="font-bold text-md text-white">{item.title}</h4>
                                          <p className="text-xs text-slate-300">
                                              <span className="text-indigo-300/90">{WINDOW_TYPE_FILTER_LABEL[wt]}</span>
                                              {' · '}
                                              {item.config.width}mm x {item.config.height}mm  |  Qty: {item.quantity}  |  Rate: ₹{Math.round(item.rate)}/{item.areaType}
                                          </p>
                                          {materialCost && (
                                            <p className="text-xs text-amber-300 mt-1">
                                              Basic rate (material calc): ₹{Math.round(materialCost.basicRatePerSqFt).toLocaleString('en-IN')}/sq ft
                                              {' · '}Hardware: ₹{Math.round(materialCost.hardwareCost).toLocaleString('en-IN')}
                                              {' · '}Total: ₹{Math.round(materialCost.totalCost).toLocaleString('en-IN')}
                                            </p>
                                          )}
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
                                      <div className="flex items-center gap-2">
                                        <Button variant="secondary" onClick={() => onEdit(item.id)} className="p-2 h-9 w-9 flex-shrink-0 no-print" aria-label={`Edit ${item.title}`}>
                                          <PencilIcon className="w-4 h-4" />
                                        </Button>
                                        <Button variant="danger" onClick={() => onRemove(item.id)} className="p-2 h-9 w-9 flex-shrink-0 no-print" aria-label={`Delete ${item.title}`}>
                                            <TrashIcon className="w-4 h-4"/>
                                        </Button>
                                      </div>
                                  </div>
                              )
                          })}
                          </div>
                      </div>
                  )}
              </Section>

              <div className="grid md:grid-cols-2 gap-4">
                  <Section title="Details & Terms">
                      <TextArea id="modal-quotation-description" name="modal-quotation-description" label="Description" value={settings.description} onChange={e => setSettings({...settings, description: e.target.value})} maxLength={1500} />
                      <p className="text-[11px] text-slate-400 -mt-2">Use **text** or *text* to make text bold in preview/print.</p>
                      <TextArea id="modal-quotation-terms" name="modal-quotation-terms" label="Terms & Conditions" value={settings.terms} onChange={e => setSettings({...settings, terms: autoContinueTermsSerial(e.target.value)})} />
                      <p className="text-[11px] text-slate-400 -mt-2">Use **bold** text and start first line with `a`/`1`; next lines auto-continue serials.</p>
                  </Section>
                  <Section title="Bank & Signature">
                      <div className="grid grid-cols-2 gap-4">
                          <Input id="modal-bank-ac-name" name="modal-bank-ac-name" label="A/C Name" value={settings.bankDetails.name} onChange={e => handleSettingsChange('bankDetails', 'name', e.target.value)} />
                          <Input id="modal-bank-ac-number" name="modal-bank-ac-number" label="A/C Number" type="text" inputMode="numeric" value={settings.bankDetails.accountNumber} onChange={e => handleSettingsChange('bankDetails', 'accountNumber', e.target.value)} />
                      </div>
                      <div className="grid grid-cols-3 gap-4">
                          <Input id="modal-bank-ifsc" name="modal-bank-ifsc" label="IFSC Code" value={settings.bankDetails.ifsc} onChange={e => handleSettingsChange('bankDetails', 'ifsc', e.target.value.toUpperCase())} />
                          <Input id="modal-bank-branch" name="modal-bank-branch" label="Branch" value={settings.bankDetails.branch} onChange={e => handleSettingsChange('bankDetails', 'branch', e.target.value)} />
                          <Select id="modal-bank-ac-type" name="modal-bank-ac-type" label="A/C Type" value={settings.bankDetails.accountType} onChange={e => handleSettingsChange('bankDetails', 'accountType', e.target.value as 'savings' | 'current')}>
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

              <Section title="Material Rates (Editable Anytime)">
                <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-3">
                  <Input
                    id="modal-rate-making-charge"
                    name="modal-rate-making-charge"
                    label="Making Charge"
                    type="number"
                    inputMode="decimal"
                    value={settings.materialRates.makingChargePerSqFt}
                    onChange={(e) =>
                      handleSettingsChange(
                        'materialRates',
                        'makingChargePerSqFt',
                        e.target.value === '' ? 0 : Number(e.target.value)
                      )
                    }
                    unit="₹ / sq ft"
                  />
                  <Select
                    id="modal-rate-profit-mode"
                    name="modal-rate-profit-mode"
                    label="Profit Mode"
                    value={settings.materialRates.profit.mode}
                    onChange={(e) =>
                      handleSettingsChange('materialRates', 'profit', {
                        ...settings.materialRates.profit,
                        mode: e.target.value as 'percentage' | 'per_sqft',
                      })
                    }
                  >
                    <option value="percentage">Percentage (%)</option>
                    <option value="per_sqft">Per Sq Ft (₹)</option>
                  </Select>
                  <Input
                    id="modal-rate-profit-value"
                    name="modal-rate-profit-value"
                    label="Profit Value"
                    type="number"
                    inputMode="decimal"
                    value={settings.materialRates.profit.value}
                    onChange={(e) =>
                      handleSettingsChange(
                        'materialRates',
                        'profit',
                        { ...settings.materialRates.profit, value: e.target.value === '' ? 0 : Number(e.target.value) }
                      )
                    }
                    unit={settings.materialRates.profit.mode === 'percentage' ? '%' : '₹ / sq ft'}
                  />
                  <Input
                    id="modal-rate-wastage-cartage"
                    name="modal-rate-wastage-cartage"
                    label="Wastage/Cartage (hidden)"
                    type="number"
                    inputMode="decimal"
                    value={settings.materialRates.wastageCartagePerSqFt}
                    onChange={(e) =>
                      handleSettingsChange(
                        'materialRates',
                        'wastageCartagePerSqFt',
                        e.target.value === '' ? 0 : Number(e.target.value)
                      )
                    }
                    unit="₹ / sq ft"
                  />
                  <Input
                    id="modal-rate-aluminium-profile"
                    name="modal-rate-aluminium-profile"
                    label="Aluminium Profile"
                    type="number"
                    inputMode="decimal"
                    value={settings.materialRates.aluminiumProfilePerKg}
                    onChange={(e) =>
                      handleSettingsChange(
                        'materialRates',
                        'aluminiumProfilePerKg',
                        e.target.value === '' ? 0 : Number(e.target.value)
                      )
                    }
                    unit="₹ / kg"
                  />
                  {rateUsage.usesSliding && (
                    <Input
                      id="modal-rate-powder-track"
                      name="modal-rate-powder-track"
                      label="Powder Coating Track"
                      type="number"
                      inputMode="decimal"
                      value={settings.materialRates.powderCoatingPerRft.track}
                      onChange={(e) =>
                        handleMaterialRateChange('powderCoatingPerRft', 'track', e.target.value === '' ? 0 : Number(e.target.value))
                      }
                      unit="₹ / rft"
                    />
                  )}
                  {rateUsage.usesSliding && (
                    <Input
                      id="modal-rate-powder-shutter-sections"
                      name="modal-rate-powder-shutter-sections"
                      label="Powder Coating Shutter/Top/Bottom/Reinf."
                      type="number"
                      inputMode="decimal"
                      value={settings.materialRates.powderCoatingPerRft.shutterSections}
                      onChange={(e) =>
                        handleMaterialRateChange('powderCoatingPerRft', 'shutterSections', e.target.value === '' ? 0 : Number(e.target.value))
                      }
                      unit="₹ / rft"
                    />
                  )}
                  {rateUsage.usesSlimInterlock && (
                    <Input
                      id="modal-rate-powder-slim-interlock"
                      name="modal-rate-powder-slim-interlock"
                      label="Powder Coating Slim Interlock"
                      type="number"
                      inputMode="decimal"
                      value={settings.materialRates.powderCoatingPerRft.slimInterlock}
                      onChange={(e) =>
                        handleMaterialRateChange('powderCoatingPerRft', 'slimInterlock', e.target.value === '' ? 0 : Number(e.target.value))
                      }
                      unit="₹ / rft"
                    />
                  )}
                  {rateUsage.usesMesh && (
                    <Input
                      id="modal-rate-mesh"
                      name="modal-rate-mesh"
                      label="Mesh Rate (W/2 x H)"
                      type="number"
                      inputMode="decimal"
                      value={settings.materialRates.meshPerSqFt}
                      onChange={(e) =>
                        handleSettingsChange(
                          'materialRates',
                          'meshPerSqFt',
                          e.target.value === '' ? 0 : Number(e.target.value)
                        )
                      }
                      unit="₹ / sq ft"
                    />
                  )}
                </div>

                {rateUsage.usesMesh && (
                  <details className="rounded-md border border-slate-600 bg-slate-900/40 p-3">
                    <summary className="cursor-pointer text-xs font-semibold text-slate-300">Hidden Mesh Options</summary>
                    <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-3 pt-3">
                      <label className="flex items-center space-x-2 cursor-pointer pt-2">
                        <input
                          type="checkbox"
                          checked={settings.materialRates.meshShutterOptions.separateSections}
                          onChange={(e) =>
                            handleSettingsChange('materialRates', 'meshShutterOptions', {
                              ...settings.materialRates.meshShutterOptions,
                              separateSections: e.target.checked,
                            })
                          }
                          className="w-4 h-4 rounded bg-slate-800 border-slate-500 text-indigo-600 focus:ring-indigo-500"
                        />
                        <span className="text-sm text-slate-200">Mesh shutter sections separate</span>
                      </label>
                      <Input
                        id="modal-rate-mesh-clip-per-shutter"
                        name="modal-rate-mesh-clip-per-shutter"
                        label="Mesh Clip per Mesh Shutter"
                        type="number"
                        inputMode="decimal"
                        value={settings.materialRates.meshShutterOptions.meshClipPerMeshShutter}
                        onChange={(e) =>
                          handleSettingsChange('materialRates', 'meshShutterOptions', {
                            ...settings.materialRates.meshShutterOptions,
                            meshClipPerMeshShutter: e.target.value === '' ? 0 : Number(e.target.value),
                          })
                        }
                      />
                      <Input
                        id="modal-rate-mesh-clip-length"
                        name="modal-rate-mesh-clip-length"
                        label="Mesh Clip Length"
                        type="number"
                        inputMode="decimal"
                        value={settings.materialRates.meshShutterOptions.meshClipLengthFt}
                        onChange={(e) =>
                          handleSettingsChange('materialRates', 'meshShutterOptions', {
                            ...settings.materialRates.meshShutterOptions,
                            meshClipLengthFt: e.target.value === '' ? 0 : Number(e.target.value),
                          })
                        }
                        unit="ft"
                      />
                      <Input
                        id="modal-rate-mesh-clip-weight"
                        name="modal-rate-mesh-clip-weight"
                        label="Mesh Clip Weight"
                        type="number"
                        inputMode="decimal"
                        value={settings.materialRates.meshShutterOptions.meshClipWeightKgPerPc}
                        onChange={(e) =>
                          handleSettingsChange('materialRates', 'meshShutterOptions', {
                            ...settings.materialRates.meshShutterOptions,
                            meshClipWeightKgPerPc: e.target.value === '' ? 0 : Number(e.target.value),
                          })
                        }
                        unit="kg / pc"
                      />
                      <Input
                        id="modal-rate-mesh-clip-powder"
                        name="modal-rate-mesh-clip-powder"
                        label="Mesh Clip Powder Rate"
                        type="number"
                        inputMode="decimal"
                        value={settings.materialRates.meshShutterOptions.meshClipPowderRatePerRft}
                        onChange={(e) =>
                          handleSettingsChange('materialRates', 'meshShutterOptions', {
                            ...settings.materialRates.meshShutterOptions,
                            meshClipPowderRatePerRft: e.target.value === '' ? 0 : Number(e.target.value),
                          })
                        }
                        unit="₹ / rft"
                      />
                    </div>
                  </details>
                )}

                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3 pt-2">
                  {rateUsage.glassClear.has('5') && <Input id="modal-rate-glass-clear-5" name="modal-rate-glass-clear-5" label="Glass Clear 5mm" type="number" inputMode="decimal" value={settings.materialRates.glassPerSqFt.clear['5']} onChange={(e) => handleMaterialRateChange('clear', '5', e.target.value === '' ? 0 : Number(e.target.value))} unit="₹ / sq ft" />}
                  {rateUsage.glassClear.has('6') && <Input id="modal-rate-glass-clear-6" name="modal-rate-glass-clear-6" label="Glass Clear 6mm" type="number" inputMode="decimal" value={settings.materialRates.glassPerSqFt.clear['6']} onChange={(e) => handleMaterialRateChange('clear', '6', e.target.value === '' ? 0 : Number(e.target.value))} unit="₹ / sq ft" />}
                  {rateUsage.glassClear.has('8') && <Input id="modal-rate-glass-clear-8" name="modal-rate-glass-clear-8" label="Glass Clear 8mm" type="number" inputMode="decimal" value={settings.materialRates.glassPerSqFt.clear['8']} onChange={(e) => handleMaterialRateChange('clear', '8', e.target.value === '' ? 0 : Number(e.target.value))} unit="₹ / sq ft" />}
                  {rateUsage.glassClear.has('10') && <Input id="modal-rate-glass-clear-10" name="modal-rate-glass-clear-10" label="Glass Clear 10mm" type="number" inputMode="decimal" value={settings.materialRates.glassPerSqFt.clear['10']} onChange={(e) => handleMaterialRateChange('clear', '10', e.target.value === '' ? 0 : Number(e.target.value))} unit="₹ / sq ft" />}
                  {rateUsage.glassClear.has('12') && <Input id="modal-rate-glass-clear-12" name="modal-rate-glass-clear-12" label="Glass Clear 12mm" type="number" inputMode="decimal" value={settings.materialRates.glassPerSqFt.clear['12']} onChange={(e) => handleMaterialRateChange('clear', '12', e.target.value === '' ? 0 : Number(e.target.value))} unit="₹ / sq ft" />}
                  {rateUsage.glassLaminated.has('5+5') && <Input id="modal-rate-glass-lam-55" name="modal-rate-glass-lam-55" label="Glass 5+5mm Laminated" type="number" inputMode="decimal" value={settings.materialRates.glassPerSqFt.laminated['5+5']} onChange={(e) => handleMaterialRateChange('laminated', '5+5', e.target.value === '' ? 0 : Number(e.target.value))} unit="₹ / sq ft" />}
                  {rateUsage.glassLaminated.has('6+6') && <Input id="modal-rate-glass-lam-66" name="modal-rate-glass-lam-66" label="Glass 6+6mm Laminated" type="number" inputMode="decimal" value={settings.materialRates.glassPerSqFt.laminated['6+6']} onChange={(e) => handleMaterialRateChange('laminated', '6+6', e.target.value === '' ? 0 : Number(e.target.value))} unit="₹ / sq ft" />}
                  {rateUsage.glassDgu.has('6+12+6') && <Input id="modal-rate-glass-dgu-6126" name="modal-rate-glass-dgu-6126" label="Glass 6+12+6mm DGU" type="number" inputMode="decimal" value={settings.materialRates.glassPerSqFt.dgu['6+12+6']} onChange={(e) => handleMaterialRateChange('dgu', '6+12+6', e.target.value === '' ? 0 : Number(e.target.value))} unit="₹ / sq ft" />}
                  {rateUsage.glassDgu.has('5+12+5') && <Input id="modal-rate-glass-dgu-5125" name="modal-rate-glass-dgu-5125" label="Glass 5+12+5mm DGU" type="number" inputMode="decimal" value={settings.materialRates.glassPerSqFt.dgu['5+12+5']} onChange={(e) => handleMaterialRateChange('dgu', '5+12+5', e.target.value === '' ? 0 : Number(e.target.value))} unit="₹ / sq ft" />}
                </div>

              </Section>
            </div>
            
            <div className="mt-6 p-4 bg-slate-900 border-t border-slate-700 flex flex-wrap justify-end items-center gap-4 rounded-b-lg -mx-6 -mb-6">
                <div className="text-right text-sm">
                    <span className="text-amber-300">Material Total (incl. making @ ₹{makingChargePerSqFt}/sq ft):</span>
                    <span className="font-semibold text-amber-200 ml-2">₹{Math.round(materialCostSummary.totals.totalCost).toLocaleString('en-IN')}</span>
                </div>
                <div className="text-right text-sm">
                    <span className="text-amber-300">Avg Basic Rate:</span>
                    <span className="font-semibold text-amber-200 ml-2">₹{Math.round(materialCostSummary.totals.basicRatePerSqFt).toLocaleString('en-IN')}/sq ft</span>
                </div>
                <div className="text-right text-sm">
                    <span className="text-amber-300">Making Amount:</span>
                    <span className="font-semibold text-amber-200 ml-2">₹{Math.round(materialCostSummary.totals.makingCost).toLocaleString('en-IN')}</span>
                </div>
                <div className="text-right text-sm">
                    <span className="text-amber-300">Profit (After Discount):</span>
                    <span className={`font-semibold ml-2 ${profitAfterDiscount >= 0 ? 'text-amber-200' : 'text-red-300'}`}>
                      ₹{Math.round(profitAfterDiscount).toLocaleString('en-IN')}
                    </span>
                </div>
                <div className="text-right text-sm">
                    <span className="text-amber-300">Used vs Purchased (rft):</span>
                    <span className="font-semibold text-amber-200 ml-2">
                      {materialCostSummary.totals.usedLengthFt.toFixed(2)} / {materialCostSummary.totals.purchasedLengthFt.toFixed(2)}
                    </span>
                </div>
                <div className="text-right text-sm">
                    <span className="text-amber-300">Wastage:</span>
                    <span className="font-semibold text-amber-200 ml-2">{materialCostSummary.totals.wastageLengthFt.toFixed(2)} rft</span>
                </div>
                <div className="text-right text-sm">
                    <span className="text-amber-300">Used vs Purchased (kg):</span>
                    <span className="font-semibold text-amber-200 ml-2">
                      {materialCostSummary.totals.usedWeightKg.toFixed(2)} / {materialCostSummary.totals.purchasedWeightKg.toFixed(2)}
                    </span>
                </div>
                <div className="text-right text-sm">
                    <span className="text-amber-300">Wastage (kg):</span>
                    <span className="font-semibold text-amber-200 ml-2">{materialCostSummary.totals.wastageWeightKg.toFixed(2)} kg</span>
                </div>
                <div className="text-right text-sm">
                    <span className="text-slate-300">Sub Total:</span>
                    <span className="font-semibold text-white ml-2">₹{Math.round(subTotal).toLocaleString('en-IN')}</span>
                </div>
                <div className="flex gap-2 items-end">
                    <div className="w-32"><Input id="modal-discount-amount" name="modal-discount-amount" label="Discount" type="number" inputMode="decimal" value={settings.financials.discount} onChange={e => handleSettingsChange('financials', 'discount', e.target.value === '' ? '' : Number(e.target.value))}/></div>
                    <Select id="modal-discount-type" name="modal-discount-type" label="" aria-label="Discount Type" value={settings.financials.discountType} onChange={e => handleSettingsChange('financials', 'discountType', e.target.value as 'percentage' | 'fixed')}>
                        <option value="percentage">%</option>
                        <option value="fixed">₹</option>
                    </Select>
                    <span className="text-red-400 text-sm pb-2">(-₹{Math.round(discountAmount).toLocaleString('en-IN')})</span>
                </div>
                <div className="flex gap-2 items-end">
                    <div className="w-24"><Input id="modal-gst-percentage" name="modal-gst-percentage" label="GST" type="number" inputMode="decimal" value={settings.financials.gstPercentage} onChange={e => handleSettingsChange('financials', 'gstPercentage', e.target.value === '' ? '' : Number(e.target.value))} unit="%"/></div>
                    <span className="text-green-400 text-sm pb-2">(+₹{Math.round(gstAmount).toLocaleString('en-IN')})</span>
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
    </div>
  );
};