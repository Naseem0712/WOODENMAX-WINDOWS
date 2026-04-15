import React, { useRef, useState } from 'react';
import type { BOM, QuotationItem, QuotationSettings } from '../types';
import { WindowType } from '../types';
import { Button } from './ui/Button';
import { bomPdfFilename, printDocumentTitleForBom } from '../utils/pdfFilename';
import { getSlidingCuttingPlanPerWindow } from '../utils/slidingCuttingPlan';
import { XMarkIcon } from './icons/XMarkIcon';
import { PrinterIcon } from './icons/PrinterIcon';
import { DownloadIcon } from './icons/DownloadIcon';

interface MaterialSummaryModalProps {
  isOpen: boolean;
  onClose: () => void;
  bom: BOM;
  items: QuotationItem[];
  settings: QuotationSettings;
}

const FEET_PER_MM = 0.00328084;

const profileKeyToName = (key: string) => {
    return key.replace(/([A-Z])/g, ' $1').replace(/^./, (str) => str.toUpperCase());
};

export const MaterialSummaryModal: React.FC<MaterialSummaryModalProps> = ({ isOpen, onClose, bom, items, settings }) => {
    const printContainerRef = useRef<HTMLDivElement>(null);
    const [isExporting, setIsExporting] = useState(false);

    if (!isOpen) return null;

    const quoteDate = new Date().toLocaleDateString('en-GB');
    const quoteNumber = `WM-BOM-${Date.now().toString().slice(-6)}`;
    const pdfDateStamp = new Date().toISOString().slice(0, 10);

    const handleExportPdf = () => {
        const element = printContainerRef.current?.querySelector<HTMLElement>('.a4-page');
        if (!element || isExporting) return;

        setIsExporting(true);
        element.classList.add('pdf-export-mode');

        const opt = {
            margin: [8, 8, 8, 8] as [number, number, number, number],
            filename: bomPdfFilename(settings.customer.name, pdfDateStamp),
            image: { type: 'jpeg' as const, quality: 0.95 },
            html2canvas: {
                scale: 2,
                logging: false,
                useCORS: true,
                allowTaint: true,
                backgroundColor: '#ffffff',
                letterRendering: true,
                scrollX: 0,
                scrollY: 0,
            },
            jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' as const, compress: true },
            pagebreak: { mode: ['avoid-all', 'css', 'legacy'] as ('css' | 'legacy' | 'avoid-all')[] },
        };
        
        import('html2pdf.js').then(({ default: html2pdf }) => {
            html2pdf()
                .from(element)
                .set(opt)
                .toPdf()
                .get('pdf')
                .then((pdf: any) => {
                    const totalPages = pdf.internal.getNumberOfPages();
                    const pageWidth = pdf.internal.pageSize.getWidth();
                    const pageHeight = pdf.internal.pageSize.getHeight();
                    pdf.setFontSize(8);
                    pdf.setTextColor(100);
                    for (let i = 1; i <= totalPages; i++) {
                        pdf.setPage(i);
                        pdf.text(`Page ${i} of ${totalPages}`, pageWidth - 10, pageHeight - 6, { align: 'right' });
                    }
                })
                .save()
                .then(() => {
                    setIsExporting(false);
                    element.classList.remove('pdf-export-mode');
                })
                .catch((err: any) => {
                    console.error("PDF export failed", err);
                    setIsExporting(false);
                    element.classList.remove('pdf-export-mode');
                    alert("Sorry, there was an error exporting the PDF.");
                });
        });
    };

    const handlePrint = () => {
        const prevTitle = document.title;
        document.title = printDocumentTitleForBom(settings.customer.name);
        let finished = false;
        const finish = () => {
            if (finished) return;
            finished = true;
            document.title = prevTitle;
            window.removeEventListener('afterprint', finish);
            window.clearTimeout(fallbackTimer);
        };
        const fallbackTimer = window.setTimeout(finish, 12000);
        window.addEventListener('afterprint', finish);
        window.print();
    };

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

                                    {seriesData.glass.length > 0 && (
                                        <>
                                            <h4 className="font-bold mt-4 mb-1 text-sm">Glass Summary</h4>
                                            <table className="w-full text-left text-[8pt]">
                                                <thead className="bg-gray-100">
                                                    <tr className="border-b-2 border-black">
                                                        <th className="p-1">Glass Description</th>
                                                        <th className="p-1 text-right">Total Area (sq ft)</th>
                                                        <th className="p-1 text-right">Total Area (sq mt)</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {seriesData.glass.map(item => (
                                                        <tr key={item.description} className="border-b border-gray-300">
                                                            <td className="p-1 font-semibold">{item.description}</td>
                                                            <td className="p-1 text-right">{item.totalAreaSqFt.toFixed(2)} sq ft</td>
                                                            <td className="p-1 text-right">{item.totalAreaSqMt.toFixed(2)} sq mt</td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </>
                                    )}

                                    {seriesData.mesh && seriesData.mesh.totalAreaSqFt > 0 && (
                                         <>
                                            <h4 className="font-bold mt-4 mb-1 text-sm">Mesh Summary</h4>
                                            <table className="w-full text-left text-[8pt]">
                                                <thead className="bg-gray-100">
                                                    <tr className="border-b-2 border-black">
                                                        <th className="p-1">Material</th>
                                                        <th className="p-1 text-right">Total Area (sq ft)</th>
                                                        <th className="p-1 text-right">Total Area (sq mt)</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    <tr className="border-b border-gray-300">
                                                        <td className="p-1 font-semibold">Sliding Mesh</td>
                                                        <td className="p-1 text-right">{seriesData.mesh.totalAreaSqFt.toFixed(2)} sq ft</td>
                                                        <td className="p-1 text-right">{seriesData.mesh.totalAreaSqMt.toFixed(2)} sq mt</td>
                                                    </tr>
                                                </tbody>
                                            </table>
                                        </>
                                    )}

                                    {seriesData.hardware.length > 0 && (
                                        <>
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
                                        </>
                                    )}
                                </div>
                            ))}

                            {items.some((item) => item.config.windowType === WindowType.SLIDING) && (
                              <div className="print-item">
                                <h3 className="text-lg font-bold bg-gray-200 p-2 -mx-2">Sliding Cutting Plan (Per Window Cost Breakdown)</h3>
                                <p className="text-[8pt] mt-2">
                                  Formula follows cutting-plan style: all-side track, track clips by track count, glass shutter sections,
                                  optional mesh sections, and slim/reinforcement interlock selection based on selected series.
                                </p>

                                {items
                                  .filter((item) => item.config.windowType === WindowType.SLIDING)
                                  .map((item) => {
                                    const plan = getSlidingCuttingPlanPerWindow(item, settings.materialRates);
                                    if (!plan) return null;
                                    const qty = Number(item.quantity) || 0;
                                    return (
                                      <div key={item.id} className="mt-3">
                                        <h4 className="font-bold text-sm">
                                          {item.title} ({((Number(item.config.width) || 0) * FEET_PER_MM).toFixed(2)} ft x {((Number(item.config.height) || 0) * FEET_PER_MM).toFixed(2)} ft, qty {qty})
                                        </h4>

                                        <table className="w-full text-left text-[8pt] mt-1">
                                          <thead className="bg-gray-100">
                                            <tr className="border-b-2 border-black">
                                              <th className="p-1">Section</th>
                                              <th className="p-1 text-right">Cutting Plan</th>
                                              <th className="p-1 text-right">Total Rft</th>
                                              <th className="p-1 text-right">Powder Cost</th>
                                              <th className="p-1 text-right">Aluminium Weight</th>
                                              <th className="p-1 text-right">Aluminium Cost</th>
                                              <th className="p-1 text-right">Line Total</th>
                                            </tr>
                                          </thead>
                                          <tbody>
                                            {plan.lines.map((line) => (
                                              <tr key={`${item.id}-${line.label}`} className="border-b border-gray-300">
                                                <td className="p-1 font-semibold">{line.label}</td>
                                                <td className="p-1 text-right">{line.pieces} x {line.pieceLengthFt.toFixed(2)} ft</td>
                                                <td className="p-1 text-right">{line.totalLengthFt.toFixed(2)}</td>
                                                <td className="p-1 text-right">₹ {Math.round(line.powderCost).toLocaleString('en-IN')}</td>
                                                <td className="p-1 text-right">{line.aluminiumWeightKg.toFixed(2)} kg</td>
                                                <td className="p-1 text-right">₹ {Math.round(line.aluminiumCost).toLocaleString('en-IN')}</td>
                                                <td className="p-1 text-right font-semibold">₹ {Math.round(line.totalCost).toLocaleString('en-IN')}</td>
                                              </tr>
                                            ))}
                                            <tr className="border-b border-gray-300 bg-gray-50">
                                              <td className="p-1 font-semibold">Glass Cost</td>
                                              <td className="p-1 text-right">Rate ₹ {plan.totals.glassRatePerSqFt.toFixed(2)} / sq ft</td>
                                              <td className="p-1 text-right">{plan.totals.glassAreaSqFt.toFixed(2)} sq ft</td>
                                              <td className="p-1 text-right">-</td>
                                              <td className="p-1 text-right">-</td>
                                              <td className="p-1 text-right">-</td>
                                              <td className="p-1 text-right font-semibold">₹ {Math.round(plan.totals.glassCost).toLocaleString('en-IN')}</td>
                                            </tr>
                                            <tr className="border-b-2 border-black bg-gray-100">
                                              <td className="p-1 font-bold">Per Window Total</td>
                                              <td className="p-1 text-right">-</td>
                                              <td className="p-1 text-right font-bold">{plan.totals.totalLengthFt.toFixed(2)} rft</td>
                                              <td className="p-1 text-right font-bold">₹ {Math.round(plan.totals.powderCost).toLocaleString('en-IN')}</td>
                                              <td className="p-1 text-right font-bold">{plan.totals.aluminiumWeightKg.toFixed(2)} kg</td>
                                              <td className="p-1 text-right font-bold">₹ {Math.round(plan.totals.aluminiumCost).toLocaleString('en-IN')}</td>
                                              <td className="p-1 text-right font-bold">₹ {Math.round(plan.totals.totalCost).toLocaleString('en-IN')}</td>
                                            </tr>
                                            <tr className="bg-gray-100">
                                              <td className="p-1 font-bold">Line Qty Total</td>
                                              <td className="p-1 text-right">{qty} window(s)</td>
                                              <td className="p-1 text-right font-bold">{(plan.totals.totalLengthFt * qty).toFixed(2)} rft</td>
                                              <td className="p-1 text-right font-bold">₹ {Math.round(plan.totals.powderCost * qty).toLocaleString('en-IN')}</td>
                                              <td className="p-1 text-right font-bold">{(plan.totals.aluminiumWeightKg * qty).toFixed(2)} kg</td>
                                              <td className="p-1 text-right font-bold">₹ {Math.round(plan.totals.aluminiumCost * qty).toLocaleString('en-IN')}</td>
                                              <td className="p-1 text-right font-bold">₹ {Math.round(plan.totals.totalCost * qty).toLocaleString('en-IN')}</td>
                                            </tr>
                                          </tbody>
                                        </table>
                                      </div>
                                    );
                                  })}
                              </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};