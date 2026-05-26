import React, { useRef, useState } from 'react';
import type { BOM, BOMSeries, QuotationItem, QuotationSettings, ProfileDimensions } from '../types';
import { windowItemsOnly } from '../utils/quotationItemKinds';
import { quotationItemSubtotalContribution } from '../utils/quotationTotals';
import { WindowType } from '../types';
import { Button } from './ui/Button';
import { bomPdfFilename, printDocumentTitleForBom } from '../utils/pdfFilename';
import { getSlidingCuttingPlanPerWindow } from '../utils/slidingCuttingPlan';
import { formatMmAsFtInAndMm } from '../utils/formatCutLength';
import { planMeshOrGlassRoll, STANDARD_MESH_ROLL_WIDTHS_FT } from '../utils/glassMeshRollPlanner';
import { planGlassSheetCut } from '../utils/glassSheetPlanner';
import { buildSlidingSeriesCutReport } from '../utils/slidingSeriesCutReport';
import { dimensionKeyLabel } from '../utils/profileDimensionKeys';
import { XMarkIcon } from './icons/XMarkIcon';
import { PrinterIcon } from './icons/PrinterIcon';
import { DownloadIcon } from './icons/DownloadIcon';
import { calculateMaterialCostSummary } from '../utils/materialCosting';
import { getMinimumMakingChargeForItems, getProfitSafetyInfo, getRawDiscountAmount } from '../utils/pricingSafety';
import { SlidingSeriesBomBlock } from './SlidingSeriesBomBlock';

interface MaterialSummaryModalProps {
  isOpen: boolean;
  onClose: () => void;
  bom: BOM;
  items: QuotationItem[];
  settings: QuotationSettings;
}

const FEET_PER_MM = 0.00328084;

const profileKeyToName = (key: string) => {
    return dimensionKeyLabel(key as keyof ProfileDimensions);
};

const TRACK_RAIL_KEYS: readonly (keyof ProfileDimensions)[] = ['track2T', 'track3T'];
/** Sliding outer stock: 2T/3T track + 2T/3T jamb (no cross-mix in BOM / bin-pack). */
const SLIDING_OUTER_STOCK_KEYS: readonly (keyof ProfileDimensions)[] = [
    'track2T',
    'track3T',
    'jamb2T',
    'jamb3T',
];

/**
 * Small gray subtext that sits under profile-section labels in the Aluminium
 * Profiles table so fabricators / purchase read immediately which physical
 * cut roles are pooled into each row. These are the rows that would otherwise
 * look "missing" (e.g. "where is the mesh top/bottom row?") because the
 * calculator deliberately merges multiple roles that share a stock profile.
 */
const POOLED_ROW_HINTS: Partial<Record<keyof ProfileDimensions, string>> = {
    outerFrameVertical:
        'Non-sliding / legacy path. For sliding, vertical jamb is split: use jamb2T and jamb3T (2T outer and 3T outer do not share stock).',
    jamb2T:
        '2-track jamb (L + R) only — not pooled with 3-track jamb, track, or shutter stock.',
    jamb3T:
        '3-track jamb (L + R) only — not pooled with 2-track jamb, track, or shutter stock.',
    shutterTop:
        'Pools shutter top + bottom + handle-side vertical (all same stock). Glass & mesh share this row by default — toggle "Separate mesh sections" in settings to split mesh out into its own row below.',
    shutterInterlock:
        'Slim + reinforcement interlocks pooled. Mesh interlock also lands here unless "Separate mesh sections" is ON.',
    shutterBottom:
        'Mesh shutter top + bottom + handle-side vertical (only appears when "Separate mesh sections" is ON — else mesh pieces are pooled into the Shutter Top Rail row above).',
    shutterMeeting:
        'Mesh interlock stock (only when "Separate mesh sections" is ON — else pooled into Shutter Interlock).',
};

const ProfileBomTable: React.FC<{
  seriesData: BOMSeries;
  showWeightCol: boolean;
  heading: string;
  intro?: string;
  profileKeyToNameFn: (k: string) => string;
}> = ({ seriesData, showWeightCol, heading, intro, profileKeyToNameFn }) => (
  <>
    <h4 className="font-bold mt-3 mb-1 text-sm">{heading}</h4>
    {intro && <p className="text-[7pt] text-gray-600 leading-snug mb-1">{intro}</p>}
    <table className="w-full text-left text-[8pt]">
      <thead className="bg-gray-100">
        <tr className="border-b-2 border-black">
          <th className="p-1">Profile Section</th>
          <th className="p-1 text-center">Cut Pieces</th>
          <th className="p-1 text-center">Stock Bars</th>
          <th className="p-1 text-right">Total Length (ft)</th>
          {showWeightCol && <th className="p-1 text-right">Total Weight (kg)</th>}
        </tr>
      </thead>
      <tbody>
        {seriesData.profiles.map((profile) => {
          const isTrack = SLIDING_OUTER_STOCK_KEYS.includes(profile.profileKey as keyof ProfileDimensions);
          const pooledHint = POOLED_ROW_HINTS[profile.profileKey as keyof ProfileDimensions];
          return (
            <tr key={profile.profileKey} className={`border-b border-gray-300 ${isTrack ? 'bg-amber-50' : ''}`}>
              <td className="p-1 font-semibold align-top">
                {profileKeyToNameFn(profile.profileKey)}
                {pooledHint && (
                  <span className="block text-[7pt] font-normal text-gray-600 leading-snug mt-0.5">{pooledHint}</span>
                )}
              </td>
              <td className="p-1 text-center align-top">{profile.pieces.length} pcs</td>
              <td className="p-1 text-center align-top">
                {profile.requiredBars} bars × {(profile.standardLength * FEET_PER_MM).toFixed(1)} ft
              </td>
              <td className="p-1 text-right align-top">{(profile.totalLength * FEET_PER_MM).toFixed(2)} ft</td>
              {showWeightCol && (
                <td className="p-1 text-right align-top">{profile.totalWeight > 0 ? `${profile.totalWeight.toFixed(2)} kg` : '-'}</td>
              )}
            </tr>
          );
        })}
      </tbody>
    </table>
  </>
);

const FullMeshBom: React.FC<{
  seriesData: BOMSeries;
  showSeriesSummaryRow: boolean;
  summaryBoxTitle: string;
  seriesSummaryBlurb: string;
  distinctSizesLabel: string;
}> = ({ seriesData, showSeriesSummaryRow, summaryBoxTitle, seriesSummaryBlurb, distinctSizesLabel }) => {
  if (!seriesData.mesh || seriesData.mesh.totalAreaSqFt <= 0) return null;
  return (
    <div className={showSeriesSummaryRow ? 'mt-4 border border-emerald-300 bg-emerald-50 rounded p-2 text-[8pt]' : ''}>
      {showSeriesSummaryRow ? (
        <>
          <div className="font-bold text-emerald-900 mb-1">{summaryBoxTitle}</div>
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-emerald-300">
                <th className="p-0.5">Material</th>
                <th className="p-0.5 text-right">Total Area (sq ft)</th>
                <th className="p-0.5 text-right">Total Area (sq mt)</th>
                <th className="p-0.5 text-center">{distinctSizesLabel}</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="p-0.5 font-semibold">Sliding Mesh Roll</td>
                <td className="p-0.5 text-right">{seriesData.mesh.totalAreaSqFt.toFixed(2)}</td>
                <td className="p-0.5 text-right">{seriesData.mesh.totalAreaSqMt.toFixed(2)}</td>
                <td className="p-0.5 text-center">{(seriesData.meshCutsFlat?.length || 0)} distinct</td>
              </tr>
            </tbody>
          </table>
          <p className="mt-1 text-[7pt] text-emerald-800 leading-snug">{seriesSummaryBlurb}</p>
        </>
      ) : (
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
      {seriesData.meshCutsFlat && seriesData.meshCutsFlat.length > 0 && (
        <>
          <p className="mt-2 text-[7pt] leading-snug text-gray-700">
            <strong>Mesh is supplied on rolls</strong> (unlike glass sheets). Pick the smallest standard roll width (
            {STANDARD_MESH_ROLL_WIDTHS_FT.map((w) => `${w}'`).join(', ')}) that covers the <strong>narrow</strong> side
            of each mesh pane; total <strong>running feet</strong> on that roll = longer side × pane count (sum rows for
            shop order).
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
    </div>
  );
};

export const MaterialSummaryModal: React.FC<MaterialSummaryModalProps> = ({ isOpen, onClose, bom, items, settings }) => {
    const printContainerRef = useRef<HTMLDivElement>(null);
    const [isExporting, setIsExporting] = useState(false);
    const customer = settings.customer ?? {
        name: '',
        address: '',
        contactPerson: '',
        email: '',
        website: '',
        gstNumber: '',
        architectName: '',
    };
    const isLikelyMobile = (() => {
        try {
            const ua = typeof navigator !== 'undefined' ? (navigator.userAgent || '') : '';
            const coarsePointer =
                typeof window !== 'undefined' &&
                typeof window.matchMedia === 'function' &&
                window.matchMedia('(pointer: coarse)').matches;
            return /android|iphone|ipad|ipod|mobile/i.test(ua) || coarsePointer;
        } catch {
            return false;
        }
    })();

    if (!isOpen) return null;

    const quoteDate = new Date().toLocaleDateString('en-GB');
    const quoteNumber = `WM-BOM-${Date.now().toString().slice(-6)}`;
    const pdfDateStamp = new Date().toISOString().slice(0, 10);
    const makingChargePerSqFt = Number(settings.materialRates.makingChargePerSqFt) || 120;
    const bomItems = windowItemsOnly(items);
    const materialCostSummary = calculateMaterialCostSummary(bomItems, settings.materialRates, makingChargePerSqFt);
    const subTotal = items.reduce((total, item) => total + quotationItemSubtotalContribution(item), 0);
    const rawDiscountAmount = getRawDiscountAmount(subTotal, settings);
    const profitBeforeDiscount = materialCostSummary.totals.profitCost;
    const maxDiscountAllowed = Math.max(0, profitBeforeDiscount * 0.5);
    const discountAmount = Math.min(rawDiscountAmount, maxDiscountAllowed);
    const profitAfterDiscount = profitBeforeDiscount - discountAmount;
    const preProfitTotal = Math.max(materialCostSummary.totals.totalCost - profitBeforeDiscount, 0);
    const effectiveProfitPct = preProfitTotal > 0 ? (profitAfterDiscount / preProfitTotal) * 100 : 0;
    const profitSafety = getProfitSafetyInfo(effectiveProfitPct, profitAfterDiscount);
    const makingChargeMin = getMinimumMakingChargeForItems(items);
    const makingChargeBelowMin = makingChargeMin > 0 && makingChargePerSqFt < makingChargeMin;

    const handleExportPdf = () => {
        const element = printContainerRef.current?.querySelector<HTMLElement>('.a4-page');
        if (!element || isExporting) return;

        const captureW = element.scrollWidth || element.offsetWidth || 800;
        const captureH = element.scrollHeight || element.offsetHeight || 1100;

        setIsExporting(true);
        element.classList.add('pdf-export-mode');

        let opt: Record<string, unknown>;
        try {
            opt = {
                margin: [8, 8, 8, 8] as [number, number, number, number],
                filename: bomPdfFilename(customer.name, pdfDateStamp),
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
                pagebreak: { mode: ['css', 'legacy'] as ('css' | 'legacy')[] },
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
                        console.error('PDF export failed', err);
                        setIsExporting(false);
                        element.classList.remove('pdf-export-mode');
                        alert('Sorry, there was an error exporting the PDF.');
                    });
            })
            .catch((err: unknown) => {
                console.error('Failed to load PDF exporter', err);
                setIsExporting(false);
                element.classList.remove('pdf-export-mode');
                alert('Sorry, PDF tool could not be loaded. Please try again.');
            });
    };

    const handlePrint = () => {
        if (isLikelyMobile || typeof window.print !== 'function') {
            handleExportPdf();
            return;
        }
        const prevTitle = document.title;
        document.title = printDocumentTitleForBom(customer.name);
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
                    <Button onClick={handlePrint}><PrinterIcon className="w-5 h-5 mr-2"/>{isLikelyMobile ? 'Download/Print PDF' : 'Print'}</Button>
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
                                <p className="text-xs">Customer: {customer.name}</p>
                             </div>
                             <div className="text-right text-xs">
                                <p><strong>Date:</strong> {quoteDate}</p>
                                <p><strong>Ref #:</strong> {quoteNumber}</p>
                            </div>
                         </div>
                    </div>

                    <div className="print-content" style={{display: 'block'}}>
                        <div className={`text-[8pt] p-2 border rounded mb-3 ${profitSafety.colorClass}`}>
                            <strong className={profitSafety.textClass}>Profit Safety: {profitSafety.label.toUpperCase()}</strong>
                            <span className="ml-2">({effectiveProfitPct.toFixed(2)}% after discount)</span>
                            <span className="ml-2">Discount cap ₹{Math.round(maxDiscountAllowed).toLocaleString('en-IN')}</span>
                        </div>
                        {makingChargeMin > 0 && (
                          <div className={`text-[8pt] p-2 border rounded mb-3 ${makingChargeBelowMin ? 'bg-red-100 border-red-300 text-red-700' : 'bg-emerald-100 border-emerald-300 text-emerald-700'}`}>
                            Making charge minimum: ₹{makingChargeMin}/sq ft
                            {makingChargeBelowMin ? ` (current ₹${makingChargePerSqFt}/sq ft)` : ' (ok)'}
                          </div>
                        )}
                        {items.length > bomItems.length && (
                          <div className="rounded border border-sky-400/50 bg-sky-50 p-2 text-[8pt] text-sky-950">
                            <strong>Note:</strong> Is combined quote mein{' '}
                            <strong>glass railing</strong> line(s) bhi shamil hain — window profile / mesh BOM yahan sirf
                            window items ke liye hai. Railing ka production BOM railing tool se export karein.
                          </div>
                        )}
                        <div className="w-full text-xs mt-4 space-y-6">
                            {bom.map(seriesData => {
                                const trackRows = seriesData.profiles.filter((p) => TRACK_RAIL_KEYS.includes(p.profileKey as keyof ProfileDimensions));
                                const hasMeshSummary = !!(seriesData.mesh && seriesData.mesh.totalAreaSqFt > 0);
                                const showWeightCol = seriesData.profiles.some((p) => p.weightPerMeter);
                                const seriesWindowItems = bomItems.filter((i) => i.config.series.id === seriesData.seriesId);
                                const allSlidingInSeries =
                                    seriesWindowItems.length > 0 && seriesWindowItems.every((i) => i.config.windowType === WindowType.SLIDING);
                                const slidingReport = buildSlidingSeriesCutReport(
                                    seriesData.seriesId,
                                    bomItems,
                                    settings.materialRates,
                                    { separateMeshSections: !!settings.materialRates?.meshShutterOptions?.separateSections }
                                );
                                const useSlidingBom = !!slidingReport;
                                return (
                                <div key={seriesData.seriesId} className="print-item">
                                    <h3 className="text-lg font-bold bg-gray-200 p-2 -mx-2">{seriesData.seriesName}</h3>

                                    {useSlidingBom && slidingReport && (
                                        <SlidingSeriesBomBlock
                                            report={slidingReport}
                                            seriesData={seriesData}
                                            showWeight={showWeightCol}
                                            mixedMode={!allSlidingInSeries}
                                        />
                                    )}

                                    {useSlidingBom && !allSlidingInSeries && (
                                        <ProfileBomTable
                                            seriesData={seriesData}
                                            showWeightCol={showWeightCol}
                                            heading="BOM (all types in this series) — full stock / quotation"
                                            intro="Jab is series me sliding ke alava aur window type bhi hain, yahan poora pooled BOM dikh raha hai (sab types mila ke). Upar wala 'Sliding' block sirf sliding lines ka detail + wastage hai."
                                            profileKeyToNameFn={profileKeyToName}
                                        />
                                    )}

                                    {!useSlidingBom && trackRows.length > 0 && (
                                      <div className="mt-3 border border-amber-300 bg-amber-50 rounded p-2 text-[8pt]">
                                        <div className="font-bold text-amber-900 mb-1">Track Rail Requirement (horizontal top + bottom)</div>
                                        <table className="w-full text-left">
                                          <thead>
                                            <tr className="border-b border-amber-300">
                                              <th className="p-0.5">Track Type</th>
                                              <th className="p-0.5 text-center">Cut Pieces</th>
                                              <th className="p-0.5 text-center">Stock Bars</th>
                                              <th className="p-0.5 text-right">Total Length (ft)</th>
                                              {showWeightCol && <th className="p-0.5 text-right">Weight (kg)</th>}
                                            </tr>
                                          </thead>
                                          <tbody>
                                            {trackRows.map((tr) => (
                                              <tr key={`trk-${tr.profileKey}`} className="border-b border-amber-200 last:border-b-0">
                                                <td className="p-0.5 font-semibold">{dimensionKeyLabel(tr.profileKey as keyof ProfileDimensions)}</td>
                                                <td className="p-0.5 text-center">{tr.pieces.length} pcs</td>
                                                <td className="p-0.5 text-center">{tr.requiredBars} bars × {(tr.standardLength * FEET_PER_MM).toFixed(1)} ft</td>
                                                <td className="p-0.5 text-right">{(tr.totalLength * FEET_PER_MM).toFixed(2)} ft</td>
                                                {showWeightCol && <td className="p-0.5 text-right">{tr.totalWeight > 0 ? `${tr.totalWeight.toFixed(2)} kg` : '—'}</td>}
                                              </tr>
                                            ))}
                                          </tbody>
                                        </table>
                                        <p className="mt-1 text-[7pt] text-amber-800 leading-snug">
                                          <strong>Read this row as:</strong> <em>Cut Pieces</em> = physical pieces fabricator will cut (2 per window × qty);
                                          {' '}<em>Stock Bars</em> = how many 16 ft aluminium bars purchase should order. These numbers are NOT equal — many cut pieces
                                          come from one stock bar. 2-track and 3-track use physically different extrusions (different kg/m), so they are listed as separate rows
                                          even though the <em>vertical jamb</em> (left + right side frame) is the SAME profile for both — you&apos;ll see a single pooled
                                          <code className="px-0.5">Outer Frame — Vertical Jamb</code> row in the Aluminium Profiles table below that mixes 2T + 3T window verticals.
                                          Weight / stock length for these track rows falls back to the generic <code className="px-0.5">outerFrame</code> row if the series hasn&apos;t filled
                                          dedicated <code className="px-0.5">track2T</code> / <code className="px-0.5">track3T</code> values.
                                        </p>
                                      </div>
                                    )}

                                    {!useSlidingBom && hasMeshSummary && (
                                      <div className="mt-3 border border-emerald-300 bg-emerald-50 rounded p-2 text-[8pt]">
                                        <div className="font-bold text-emerald-900 mb-1">Mesh Requirement (this series)</div>
                                        <table className="w-full text-left">
                                          <thead>
                                            <tr className="border-b border-emerald-300">
                                              <th className="p-0.5">Material</th>
                                              <th className="p-0.5 text-right">Total Area (sq ft)</th>
                                              <th className="p-0.5 text-right">Total Area (sq mt)</th>
                                              <th className="p-0.5 text-center">Distinct Cut Sizes</th>
                                            </tr>
                                          </thead>
                                          <tbody>
                                            <tr>
                                              <td className="p-0.5 font-semibold">Sliding Mesh Roll</td>
                                              <td className="p-0.5 text-right">{seriesData.mesh!.totalAreaSqFt.toFixed(2)}</td>
                                              <td className="p-0.5 text-right">{seriesData.mesh!.totalAreaSqMt.toFixed(2)}</td>
                                              <td className="p-0.5 text-center">{seriesData.meshCutsFlat?.length || 0}</td>
                                            </tr>
                                          </tbody>
                                        </table>
                                        <p className="mt-1 text-[7pt] text-emerald-800 leading-snug">
                                          Only items with a mesh shutter contribute here. By default the mesh shutter&apos;s aluminium
                                          sections (top / bottom / handle / interlock) are pooled with glass shutter sections for
                                          minimum wastage — toggle <em>Separate mesh sections</em> in settings to bin-pack mesh
                                          frames into their own stock pool. The full mesh cutting plan is below.
                                        </p>
                                      </div>
                                    )}

                                    {!useSlidingBom && (
                                        <ProfileBomTable
                                            seriesData={seriesData}
                                            showWeightCol={showWeightCol}
                                            heading="Aluminium Profiles"
                                            intro="How to read: Cut Pieces = actual pieces fabricator cuts; Stock Bars = 16 ft aluminium rods to purchase. Rows that look 'missing' (e.g. separate handle / mesh-top) are deliberately pooled — subtext on each row. Pooling = shared stock profile (less wastage)."
                                            profileKeyToNameFn={profileKeyToName}
                                        />
                                    )}

                                    {!useSlidingBom && hasMeshSummary && (
                                        <FullMeshBom
                                            seriesData={seriesData}
                                            showSeriesSummaryRow
                                            summaryBoxTitle="Mesh (roll) — area + cut sizes"
                                            seriesSummaryBlurb="Mesh ke aluminium chaukhat / sections uper ‘Sliding — cuts’ block me count ho chuke. Yahan sirf mesh kapda (roll) — size-wise."
                                            distinctSizesLabel="Sizes"
                                        />
                                    )}

                                    {seriesData.glass.length > 0 && !useSlidingBom && (
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
                                                  <strong>Sheet-based cutting plan:</strong> flat glass is supplied as <strong>rectangular sheets</strong> (not rolls). For every cut size we pick the smallest standard sheet that yields ≥1 pane (panel rotation allowed), then estimate how many sheets are required and material yield %. Final invoicing is still done on <strong>total area (sq ft × rate)</strong>; this table helps the shop order whole sheets.
                                                </p>
                                                <table className="mt-1 w-full text-left text-[7pt]">
                                                  <thead className="bg-gray-100">
                                                    <tr className="border-b border-black">
                                                      <th className="p-0.5">Line</th>
                                                      <th className="p-0.5">Window</th>
                                                      <th className="p-0.5">Glass type</th>
                                                      <th className="p-0.5">Cut size (mm)</th>
                                                      <th className="p-0.5 text-right">Panes (total qty)</th>
                                                      <th className="p-0.5 text-right">Area (sq ft)</th>
                                                      <th className="p-0.5">Best sheet</th>
                                                      <th className="p-0.5 text-right">Panes / sheet</th>
                                                      <th className="p-0.5 text-right">Sheets req.</th>
                                                      <th className="p-0.5 text-right">Yield %</th>
                                                    </tr>
                                                  </thead>
                                                  <tbody>
                                                    {seriesData.glassCutsFlat.map((row, idx) => {
                                                      const plan = planGlassSheetCut(row.widthMm, row.heightMm, row.totalPanels);
                                                      const best = plan.best;
                                                      return (
                                                        <tr key={`${row.quotationItemId ?? 'x'}-${row.description}-${row.widthMm}-${row.heightMm}-${idx}`} className="border-b border-gray-300">
                                                          <td className="p-0.5 align-top font-semibold text-[6.5pt]">{row.lineTitle ?? '—'}</td>
                                                          <td className="p-0.5 align-top text-[6.5pt]">
                                                            {row.windowWidthMm != null && row.windowHeightMm != null && row.windowWidthMm > 0
                                                              ? (
                                                                <>
                                                                  {row.windowWidthMm}×{row.windowHeightMm} mm
                                                                  <span className="block text-[6pt] text-gray-600">
                                                                    {formatMmAsFtInAndMm(row.windowWidthMm)} W × {formatMmAsFtInAndMm(row.windowHeightMm)} H
                                                                  </span>
                                                                </>
                                                              )
                                                              : '—'}
                                                          </td>
                                                          <td className="p-0.5 align-top font-semibold">{row.description}</td>
                                                          <td className="p-0.5 align-top">
                                                            {row.widthMm} × {row.heightMm}
                                                            <span className="block text-[6pt] text-gray-600">
                                                              {formatMmAsFtInAndMm(row.widthMm)} × {formatMmAsFtInAndMm(row.heightMm)}
                                                            </span>
                                                          </td>
                                                          <td className="p-0.5 text-right align-top">{row.totalPanels}</td>
                                                          <td className="p-0.5 text-right align-top">{row.areaSqFt.toFixed(2)}</td>
                                                          <td className="p-0.5 align-top">
                                                            {best
                                                              ? best.sheet.name
                                                              : <span className="text-red-600">Oversized — custom sheet</span>}
                                                          </td>
                                                          <td className="p-0.5 text-right align-top">{best ? best.panesPerSheet : '—'}</td>
                                                          <td className="p-0.5 text-right align-top">{best ? best.sheetsRequired : '—'}</td>
                                                          <td className="p-0.5 text-right align-top">{best ? `${Math.round(best.yield * 100)}%` : '—'}</td>
                                                        </tr>
                                                      );
                                                    })}
                                                  </tbody>
                                                </table>
                                              </>
                                            )}
                                        </>
                                    )}

                                    {!useSlidingBom && hasMeshSummary && (
                                        <FullMeshBom
                                            seriesData={seriesData}
                                            showSeriesSummaryRow={false}
                                            summaryBoxTitle=""
                                            seriesSummaryBlurb=""
                                            distinctSizesLabel=""
                                        />
                                    )}

                                    {seriesData.hardware.length > 0 && !useSlidingBom && (
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
                                );
                            })}

                            {bomItems.some((item) => item.config.windowType === WindowType.SLIDING) && (
                              <div className="print-item">
                                <h3 className="text-lg font-bold bg-gray-200 p-2 -mx-2">Sliding cost (per line)</h3>
                                {bomItems
                                  .filter((item) => item.config.windowType === WindowType.SLIDING)
                                  .map((item) => {
                                    const plan = getSlidingCuttingPlanPerWindow(item, settings.materialRates, {
                                      separateMeshSections: !!settings.materialRates?.meshShutterOptions?.separateSections,
                                    });
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
                                        <table className="w-full text-left text-[8pt] mt-0.5">
                                          <thead className="bg-gray-100">
                                            <tr className="border-b-2 border-black">
                                              <th className="p-1">Section</th>
                                              <th className="p-1 text-center">Cut°</th>
                                              <th className="p-1 text-right">Cutting Plan</th>
                                              <th className="p-1 text-right">Total Rft</th>
                                              <th className="p-1 text-right">Powder Cost</th>
                                              <th className="p-1 text-right">Aluminium Weight</th>
                                              <th className="p-1 text-right">Aluminium Cost</th>
                                              <th className="p-1 text-right">Line Total</th>
                                            </tr>
                                          </thead>
                                          <tbody>
                                            {plan.lines.map((line) => {
                                              const hasAlu = line.aluminiumWeightKg > 0;
                                              const isTrackClip = line.pool === 'trackClip';
                                              return (
                                              <tr key={`${item.id}-${line.label}`} className="border-b border-gray-300">
                                                <td className="p-1 font-semibold">{line.label}</td>
                                                <td className="p-1 text-center font-mono">{line.cutAngles}</td>
                                                <td className="p-1 text-right">
                                                  {line.pieces * q} ×{' '}
                                                  {formatMmAsFtInAndMm(line.pieceLengthMm)}
                                                  {qty > 1 && <span className="text-gray-500"> ({line.pieces}/win)</span>}
                                                </td>
                                                <td className="p-1 text-right">{(line.totalLengthFt * q).toFixed(2)}</td>
                                                <td className="p-1 text-right">₹ {Math.round(line.powderCost * q).toLocaleString('en-IN')}</td>
                                                <td className="p-1 text-right">
                                                  {hasAlu
                                                    ? `${(line.aluminiumWeightKg * q).toFixed(2)} kg`
                                                    : isTrackClip
                                                      ? <span className="text-gray-500" title="Track clip weight is billed as a separate accessory — only powder coating charged here">— (accessory)</span>
                                                      : '—'}
                                                </td>
                                                <td className="p-1 text-right">
                                                  {hasAlu
                                                    ? `₹ ${Math.round(line.aluminiumCost * q).toLocaleString('en-IN')}`
                                                    : '—'}
                                                </td>
                                                <td className="p-1 text-right font-semibold">₹ {Math.round(line.totalCost * q).toLocaleString('en-IN')}</td>
                                              </tr>
                                              );
                                            })}
                                            <tr className="border-b border-gray-300 bg-gray-50">
                                              <td className="p-1 font-semibold">Glass Cost</td>
                                              <td className="p-1 text-center">—</td>
                                              <td className="p-1 text-right">Rate ₹ {plan.totals.glassRatePerSqFt.toFixed(2)} / sq ft</td>
                                              <td className="p-1 text-right">{(plan.totals.glassAreaSqFt * q).toFixed(2)} sq ft</td>
                                              <td className="p-1 text-right">-</td>
                                              <td className="p-1 text-right">-</td>
                                              <td className="p-1 text-right">-</td>
                                              <td className="p-1 text-right font-semibold">₹ {Math.round(plan.totals.glassCost * q).toLocaleString('en-IN')}</td>
                                            </tr>
                                            <tr className="border-b-2 border-black bg-gray-100">
                                              <td className="p-1 font-bold">Per window (reference)</td>
                                              <td className="p-1 text-center">—</td>
                                              <td className="p-1 text-right">—</td>
                                              <td className="p-1 text-right font-bold">{plan.totals.totalLengthFt.toFixed(2)} rft</td>
                                              <td className="p-1 text-right font-bold">₹ {Math.round(plan.totals.powderCost).toLocaleString('en-IN')}</td>
                                              <td className="p-1 text-right font-bold">{plan.totals.aluminiumWeightKg.toFixed(2)} kg</td>
                                              <td className="p-1 text-right font-bold">₹ {Math.round(plan.totals.aluminiumCost).toLocaleString('en-IN')}</td>
                                              <td className="p-1 text-right font-bold">₹ {Math.round(plan.totals.totalCost).toLocaleString('en-IN')}</td>
                                            </tr>
                                            <tr className="bg-gray-100">
                                              <td className="p-1 font-bold">Line total (×{q})</td>
                                              <td className="p-1 text-center">—</td>
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