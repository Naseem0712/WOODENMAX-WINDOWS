import React, { useRef, useState } from 'react';
import type { BOM, QuotationItem, QuotationSettings } from '../types';
import { WindowType } from '../types';
import { Button } from './ui/Button';
import { bomPdfFilename, printDocumentTitleForBom } from '../utils/pdfFilename';
import { getSlidingCuttingPlanPerWindow } from '../utils/slidingCuttingPlan';
import { formatMmAsFtInAndMm } from '../utils/formatCutLength';
import { planMeshOrGlassRoll, STANDARD_MESH_ROLL_LENGTHS_FT, STANDARD_MESH_ROLL_WIDTHS_FT } from '../utils/glassMeshRollPlanner';
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

        const customerName = settings.customer?.name;
        const captureW = element.scrollWidth || element.offsetWidth || 800;
        const captureH = element.scrollHeight || element.offsetHeight || 1100;

        setIsExporting(true);
        element.classList.add('pdf-export-mode');

        let opt: Record<string, unknown>;
        try {
            opt = {
            margin: [8, 8, 8, 8] as [number, number, number, number],
            filename: bomPdfFilename(customerName, pdfDateStamp),
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
                windowWidth: captureW,
                windowHeight: captureH,
            },
            jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' as const, compress: true },
            pagebreak: { mode: ['avoid-all', 'css', 'legacy'] as ('css' | 'legacy' | 'avoid-all')[] },
        };
        } catch (setupErr) {
            console.error('PDF export setup failed', setupErr);
            setIsExporting(false);
            element.classList.remove('pdf-export-mode');
            alert('Sorry, PDF export start nahi ho paaya.');
            return;
        }
        
        import('html2pdf.js')
            .then((mod: { default?: unknown }) => {
                const html2pdf = (typeof mod.default === 'function' ? mod.default : mod) as (...args: unknown[]) => any;
                if (typeof html2pdf !== 'function') {
                    throw new Error('html2pdf module did not load correctly');
                }
                return html2pdf()
                .from(element)
                .set(opt)
                .toPdf()
                .get('pdf')
                .then((pdf: any) => {
                    try {
                        const totalPages = pdf.internal.getNumberOfPages();
                        const pageWidth = pdf.internal.pageSize.getWidth();
                        const pageHeight = pdf.internal.pageSize.getHeight();
                        pdf.setFontSize(8);
                        pdf.setTextColor(100, 100, 100);
                        for (let i = 1; i <= totalPages; i++) {
                            pdf.setPage(i);
                            pdf.text(`Page ${i} of ${totalPages}`, pageWidth - 10, pageHeight - 6, { align: 'right' });
                        }
                    } catch (footerErr) {
                        console.warn('PDF page footer skipped', footerErr);
                    }
                })
                .save()
                .then(() => {
                    setIsExporting(false);
                    element.classList.remove('pdf-export-mode');
                })
                .catch((err: unknown) => {
                    console.error("PDF export failed", err);
                    setIsExporting(false);
                    element.classList.remove('pdf-export-mode');
                    alert("Sorry, there was an error exporting the PDF.");
                });
            })
            .catch((err: unknown) => {
                console.error("Failed to load PDF exporter", err);
                setIsExporting(false);
                element.classList.remove('pdf-export-mode');
                alert("Sorry, PDF tool could not be loaded. Please try again.");
            });
    };

    const handlePrint = () => {
        const prevTitle = document.title;
        document.title = printDocumentTitleForBom(settings.customer?.name);
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
        <div className="fixed inset-0 z-[70] flex min-h-0 flex-col bg-slate-900 print-preview-modal">
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
            <div ref={printContainerRef} className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain bg-slate-900 touch-pan-y print-preview-container custom-scrollbar">
                <div className="a4-page single-scroll-preview text-black">
                    <div className="print-header" style={{height: 'auto'}}>
                         <div className="flex justify-between items-start">
                             <div>
                                <h2 className="text-2xl font-bold text-black">Material Summary</h2>
                                <p className="text-xs">For Quotation: {settings.title}</p>
                                <p className="text-xs">Customer: {settings.customer?.name || ''}</p>
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
                                            {seriesData.glassCutsFlat && seriesData.glassCutsFlat.length > 0 && (
                                              <>
                                                <p className="mt-2 text-[7pt] leading-snug text-gray-700">
                                                  <strong>Roll-style planning:</strong> useful for mesh / film / interlayer bought by roll width (typ.{' '}
                                                  {STANDARD_MESH_ROLL_WIDTHS_FT.map((w) => `${w}'`).join(', ')}) and {STANDARD_MESH_ROLL_LENGTHS_FT.map((l) => `${l}'`).join(' / ')} length stock; cut rolls are common. Sheet glass is usually ordered by <strong>area</strong> or full sheets — treat &ldquo;roll width / run length&rdquo; here as a <strong>rough strip equivalent</strong> only. Narrow side of each pane is assumed across the roll; run length ≈ longer side × pane count.
                                                </p>
                                                <table className="mt-1 w-full text-left text-[7pt]">
                                                  <thead className="bg-gray-100">
                                                    <tr className="border-b border-black">
                                                      <th className="p-0.5">Glass type</th>
                                                      <th className="p-0.5">Cut size (mm)</th>
                                                      <th className="p-0.5 text-right">Panes (total qty)</th>
                                                      <th className="p-0.5 text-right">Area (sq ft)</th>
                                                      <th className="p-0.5 text-right">Roll width</th>
                                                      <th className="p-0.5 text-right">Run length</th>
                                                      <th className="p-0.5">Buy (50 / 100 ft)</th>
                                                    </tr>
                                                  </thead>
                                                  <tbody>
                                                    {seriesData.glassCutsFlat.map((row, idx) => {
                                                      const plan = planMeshOrGlassRoll(row.widthMm, row.heightMm, row.totalPanels);
                                                      const rollW =
                                                        plan.suggestedRollWidthFt != null
                                                          ? plan.fitsStandardWidth
                                                            ? `${plan.suggestedRollWidthFt}' std`
                                                            : `${plan.suggestedRollWidthFt}' (panel wider — order wider roll / sheet)`
                                                          : '—';
                                                      return (
                                                        <tr key={`${row.description}-${row.widthMm}-${row.heightMm}-${idx}`} className="border-b border-gray-300">
                                                          <td className="p-0.5 align-top font-semibold">{row.description}</td>
                                                          <td className="p-0.5 align-top">
                                                            {row.widthMm} × {row.heightMm}
                                                            <span className="block text-[6pt] text-gray-600">
                                                              {formatMmAsFtInAndMm(row.widthMm)} × {formatMmAsFtInAndMm(row.heightMm)}
                                                            </span>
                                                          </td>
                                                          <td className="p-0.5 text-right align-top">{row.totalPanels}</td>
                                                          <td className="p-0.5 text-right align-top">{row.areaSqFt.toFixed(2)}</td>
                                                          <td className="p-0.5 text-right align-top">{rollW}</td>
                                                          <td className="p-0.5 text-right align-top">{plan.totalRunningFt.toFixed(2)} rft</td>
                                                          <td className="p-0.5 align-top">{plan.purchaseHint}</td>
                                                        </tr>
                                                      );
                                                    })}
                                                  </tbody>
                                                </table>
                                              </>
                                            )}
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
                                            {seriesData.meshCutsFlat && seriesData.meshCutsFlat.length > 0 && (
                                              <>
                                                <p className="mt-2 text-[7pt] leading-snug text-gray-700">
                                                  Same roll rule as glass above: pick smallest standard width ({STANDARD_MESH_ROLL_WIDTHS_FT.map((w) => `${w}'`).join(', ')}) that covers the <strong>narrow</strong> side of each mesh pane; total <strong>running feet</strong> on that roll = longer side × pane count (sum rows for shop order).
                                                </p>
                                                <table className="mt-1 w-full text-left text-[7pt]">
                                                  <thead className="bg-gray-100">
                                                    <tr className="border-b border-black">
                                                      <th className="p-0.5">Cut size (mm)</th>
                                                      <th className="p-0.5 text-right">Panes (total qty)</th>
                                                      <th className="p-0.5 text-right">Area (sq ft)</th>
                                                      <th className="p-0.5 text-right">Roll width</th>
                                                      <th className="p-0.5 text-right">Run length</th>
                                                      <th className="p-0.5">Buy (50 / 100 ft)</th>
                                                    </tr>
                                                  </thead>
                                                  <tbody>
                                                    {seriesData.meshCutsFlat.map((row, idx) => {
                                                      const plan = planMeshOrGlassRoll(row.widthMm, row.heightMm, row.totalPanels);
                                                      const rollW =
                                                        plan.suggestedRollWidthFt != null
                                                          ? plan.fitsStandardWidth
                                                            ? `${plan.suggestedRollWidthFt}' std`
                                                            : `${plan.suggestedRollWidthFt}' (wider roll / cut sheet)`
                                                          : '—';
                                                      return (
                                                        <tr key={`mesh-${row.widthMm}-${row.heightMm}-${idx}`} className="border-b border-gray-300">
                                                          <td className="p-0.5 align-top">
                                                            {row.widthMm} × {row.heightMm}
                                                            <span className="block text-[6pt] text-gray-600">
                                                              {formatMmAsFtInAndMm(row.widthMm)} × {formatMmAsFtInAndMm(row.heightMm)}
                                                            </span>
                                                          </td>
                                                          <td className="p-0.5 text-right align-top">{row.totalPanels}</td>
                                                          <td className="p-0.5 text-right align-top">{row.areaSqFt.toFixed(2)}</td>
                                                          <td className="p-0.5 text-right align-top">{rollW}</td>
                                                          <td className="p-0.5 text-right align-top">{plan.totalRunningFt.toFixed(2)} rft</td>
                                                          <td className="p-0.5 align-top">{plan.purchaseHint}</td>
                                                        </tr>
                                                      );
                                                    })}
                                                  </tbody>
                                                </table>
                                              </>
                                            )}
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
                                <h3 className="text-lg font-bold bg-gray-200 p-2 -mx-2">Sliding Cutting Plan (cost breakdown)</h3>
                                <p className="text-[8pt] mt-2">
                                  Rows show <strong>full line quantity</strong> (per-window × qty). Track clips: bottom only, 2-track → 2 pcs, 3-track → 3 pcs × width, at track-clip powder rate.
                                </p>

                                {items
                                  .filter((item) => item.config.windowType === WindowType.SLIDING)
                                  .map((item) => {
                                    const plan = getSlidingCuttingPlanPerWindow(item, settings.materialRates);
                                    if (!plan) return null;
                                    const qty = Math.max(0, Number(item.quantity) || 0);
                                    if (qty <= 0) return null;
                                    const q = qty;
                                    return (
                                      <div key={item.id} className="mt-3">
                                        <h4 className="font-bold text-sm">
                                          {item.title} (
                                          {formatMmAsFtInAndMm(Number(item.config.width) || 0)} wide ×{' '}
                                          {formatMmAsFtInAndMm(Number(item.config.height) || 0)} high, qty {qty})
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
                                                <td className="p-1 text-right">
                                                  {line.pieces * q} ×{' '}
                                                  {formatMmAsFtInAndMm(line.pieceLengthFt / FEET_PER_MM)}
                                                  {qty > 1 && <span className="text-gray-500"> ({line.pieces}/win)</span>}
                                                </td>
                                                <td className="p-1 text-right">{(line.totalLengthFt * q).toFixed(2)}</td>
                                                <td className="p-1 text-right">₹ {Math.round(line.powderCost * q).toLocaleString('en-IN')}</td>
                                                <td className="p-1 text-right">{(line.aluminiumWeightKg * q).toFixed(2)} kg</td>
                                                <td className="p-1 text-right">₹ {Math.round(line.aluminiumCost * q).toLocaleString('en-IN')}</td>
                                                <td className="p-1 text-right font-semibold">₹ {Math.round(line.totalCost * q).toLocaleString('en-IN')}</td>
                                              </tr>
                                            ))}
                                            <tr className="border-b border-gray-300 bg-gray-50">
                                              <td className="p-1 font-semibold">Glass Cost</td>
                                              <td className="p-1 text-right">Rate ₹ {plan.totals.glassRatePerSqFt.toFixed(2)} / sq ft</td>
                                              <td className="p-1 text-right">{(plan.totals.glassAreaSqFt * q).toFixed(2)} sq ft</td>
                                              <td className="p-1 text-right">-</td>
                                              <td className="p-1 text-right">-</td>
                                              <td className="p-1 text-right">-</td>
                                              <td className="p-1 text-right font-semibold">₹ {Math.round(plan.totals.glassCost * q).toLocaleString('en-IN')}</td>
                                            </tr>
                                            <tr className="border-b-2 border-black bg-gray-100">
                                              <td className="p-1 font-bold">Per window (reference)</td>
                                              <td className="p-1 text-right">—</td>
                                              <td className="p-1 text-right font-bold">{plan.totals.totalLengthFt.toFixed(2)} rft</td>
                                              <td className="p-1 text-right font-bold">₹ {Math.round(plan.totals.powderCost).toLocaleString('en-IN')}</td>
                                              <td className="p-1 text-right font-bold">{plan.totals.aluminiumWeightKg.toFixed(2)} kg</td>
                                              <td className="p-1 text-right font-bold">₹ {Math.round(plan.totals.aluminiumCost).toLocaleString('en-IN')}</td>
                                              <td className="p-1 text-right font-bold">₹ {Math.round(plan.totals.totalCost).toLocaleString('en-IN')}</td>
                                            </tr>
                                            <tr className="bg-gray-100">
                                              <td className="p-1 font-bold">Line total (×{q})</td>
                                              <td className="p-1 text-right">{qty} window(s)</td>
                                              <td className="p-1 text-right font-bold">{(plan.totals.totalLengthFt * q).toFixed(2)} rft</td>
                                              <td className="p-1 text-right font-bold">₹ {Math.round(plan.totals.powderCost * q).toLocaleString('en-IN')}</td>
                                              <td className="p-1 text-right font-bold">{(plan.totals.aluminiumWeightKg * q).toFixed(2)} kg</td>
                                              <td className="p-1 text-right font-bold">₹ {Math.round(plan.totals.aluminiumCost * q).toLocaleString('en-IN')}</td>
                                              <td className="p-1 text-right font-bold">₹ {Math.round(plan.totals.totalCost * q).toLocaleString('en-IN')}</td>
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