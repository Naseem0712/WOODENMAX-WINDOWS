import React, { useRef, useState } from 'react';
import type { BOM, BOMSeries, QuotationSettings } from './types';
import { Button } from './components/ui/Button';
import { XMarkIcon } from './components/icons/XMarkIcon';
import { PrinterIcon } from './components/icons/PrinterIcon';
import { DownloadIcon } from './components/icons/DownloadIcon';

interface MaterialSummaryModalProps {
  isOpen: boolean;
  onClose: () => void;
  bom: BOM;
  settings: QuotationSettings;
}

const FEET_PER_MM = 0.00328084;

const profileKeyToName = (key: string) => {
    return key.replace(/([A-Z])/g, ' $1').replace(/^./, (str) => str.toUpperCase());
};

export const MaterialSummaryModal: React.FC<MaterialSummaryModalProps> = ({ isOpen, onClose, bom, settings }) => {
    const printContainerRef = useRef<HTMLDivElement>(null);
    const [isExporting, setIsExporting] = useState(false);

    if (!isOpen) return null;

    const quoteDate = new Date().toLocaleDateString('en-GB');
    const quoteNumber = `WM-BOM-${Date.now().toString().slice(-6)}`;

    const handleExportPdf = () => {
        const element = printContainerRef.current?.querySelector<HTMLElement>('.a4-page');
        if (!element || isExporting) return;

        setIsExporting(true);
        element.classList.add('pdf-export-mode');

        const opt = {
            margin: 0,
            filename: `Material-Summary-${settings.customer.name || 'WoodenMax'}-${quoteNumber}.pdf`,
            image: { type: 'jpeg' as const, quality: 0.98 },
            html2canvas: { scale: 2, logging: false, useCORS: true, backgroundColor: '#ffffff' },
            jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' as const },
            pagebreak: { mode: ['css', 'legacy'] }
        };
        
        import('html2pdf.js').then(({ default: html2pdf }) => {
            html2pdf().from(element).set(opt).save().then(() => {
                setIsExporting(false);
                element.classList.remove('pdf-export-mode');
            }).catch((err: any) => {
                console.error("PDF export failed", err);
                setIsExporting(false);
                element.classList.remove('pdf-export-mode');
                alert("Sorry, there was an error exporting the PDF.");
            });
        });
    };

    const handlePrint = () => { window.print(); };

    return (
        <div className="fixed inset-0 bg-slate-900 z-50 flex flex-col print-preview-modal">
            {isExporting && (
              <div className="absolute inset-0 bg-black bg-opacity-75 flex flex-col items-center justify-center z-[100] no-print">
                <svg className="animate-spin h-10 w-10 text-white mb-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                <h3 className="text-white text-xl font-bold">Generating PDF...</h3>
              </div>
            )}
            <div className="flex-shrink-0 bg-slate-800 p-3 flex justify-between items-center no-print">
                <h2 className="text-xl font-bold text-white">Material Summary (Bill of Materials)</h2>
                <div className="flex gap-2">
                    <Button onClick={handleExportPdf} variant="secondary" disabled={isExporting}>
                        {isExporting ? 'Exporting...' : <><DownloadIcon className="w-5 h-5 mr-2"/> Export PDF</>}
                    </Button>
                    <Button onClick={handlePrint}><PrinterIcon className="w-5 h-5 mr-2"/> Print</Button>
                    <Button onClick={onClose} variant="secondary"><XMarkIcon className="w-5 h-5 mr-2"/> Close</Button>
                </div>
            </div>
            <div ref={printContainerRef} className="flex-grow overflow-y-auto bg-slate-900 print-preview-container custom-scrollbar">
                <div className="a4-page single-scroll-preview text-black">
                    <div className="print-header" style={{height: 'auto'}}>
                         <div className="flex justify-between items-start">
                             <div>
                                <h2 className="text-2xl font-bold text-black">Material Summary</h2>
                                <p className="text-xs">For Quotation: {settings.title}</p>
                                <p className="text-xs">Customer: {settings.customer.name}</p>
                             </div>
                             <div className="text-right text-xs">
                                <p><strong>Date:</strong> {quoteDate}</p>
                                <p><strong>Ref #:</strong> {quoteNumber}</p>
                            </div>
                         </div>
                    </div>

                    <div className="print-content" style={{display: 'block'}}>
                        <div className="w-full text-xs mt-4 space-y-6">
                            {bom.map(seriesData => (
                                <div key={seriesData.seriesId} className="print-item">
                                    <h3 className="text-lg font-bold bg-gray-200 p-2 -mx-2">{seriesData.seriesName}</h3>
                                    
                                    <h4 className="font-bold mt-3 mb-1 text-sm">Aluminium Profiles</h4>
                                    <table className="w-full text-left text-[8pt]">
                                        <thead className="bg-gray-100">
                                            <tr className="border-b-2 border-black">
                                                <th className="p-1">Profile Section</th>
                                                <th className="p-1 text-center">Required Bars</th>
                                                <th className="p-1 text-right">Total Length (ft)</th>
                                                {seriesData.profiles.some(p => p.weightPerMeter) && <th className="p-1 text-right">Total Weight (kg)</th>}
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {seriesData.profiles.map(profile => (
                                                <tr key={profile.profileKey} className="border-b border-gray-300">
                                                    <td className="p-1 font-semibold">{profileKeyToName(profile.profileKey)}</td>
                                                    <td className="p-1 text-center">{profile.requiredBars} pcs @ {(profile.standardLength * FEET_PER_MM).toFixed(1)} ft</td>
                                                    <td className="p-1 text-right">{(profile.totalLength * FEET_PER_MM).toFixed(2)} ft</td>
                                                    {seriesData.profiles.some(p => p.weightPerMeter) && <td className="p-1 text-right">{profile.totalWeight > 0 ? `${profile.totalWeight.toFixed(2)} kg` : '-'}</td>}
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>

                                    <h4 className="font-bold mt-4 mb-1 text-sm">Hardware & Accessories</h4>
                                    <table className="w-full text-left text-[8pt]">
                                        <thead className="bg-gray-100">
                                            <tr className="border-b-2 border-black">
                                                <th className="p-1">Item Name</th>
                                                <th className="p-1 text-right">Total Quantity</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {seriesData.hardware.map(item => (
                                                <tr key={item.name} className="border-b border-gray-300">
                                                    <td className="p-1 font-semibold">{item.name}</td>
                                                    <td className="p-1 text-right">{item.totalQuantity} pcs</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
