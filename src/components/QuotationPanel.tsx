import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AreaType } from '../types';
import type { DesignLayoutActiveUnit } from '../types';
import type { LayoutEstimateRow } from '../utils/designLayout';
import { layoutEstimateTotals } from '../utils/designLayout';
import { Button } from './ui/Button';
import { Input } from './ui/Input';
import { Select } from './ui/Select';
import { XMarkIcon } from './icons/XMarkIcon';
import { PlusIcon } from './icons/PlusIcon';
import { ChevronDownIcon } from './icons/ChevronDownIcon';
import { UploadIcon } from './icons/UploadIcon';
import { processPrintElevationPhotoFile } from '../utils/printElevationPhoto';

interface QuotationPanelProps {
    idPrefix?: string;
    width: number;
    height: number;
    quotationOpeningMm2: number;
    windowTitle: string;
    setWindowTitle: (title: string) => void;
    quantity: number | '';
    setQuantity: (value: number | '') => void;
    areaType: AreaType;
    setAreaType: (type: AreaType) => void;
    rate: number | '';
    setRate: (value: number | '') => void;
    onSave: () => void;
    onUpdate: () => void;
    onCancelEdit: () => void;
    editingItemId: string | null;
    onBatchAdd: () => void;
    hardwareCostPerWindow: number;
    quotationItemCount: number;
    onViewQuotation: () => void;
    onClose?: () => void;
    bulkCorrectionLineCount?: number;
    onApplyBulkCorrection?: () => void;
    layoutEstimate?: LayoutEstimateRow[];
    activeLayoutUnitId?: DesignLayoutActiveUnit;
    onLayoutUnitRateChange?: (unitId: string, rate: number | '') => void;
    onSaveLayoutAll?: () => void;
    printElevationPhoto?: string;
    onPrintElevationPhotoChange?: (dataUrl: string | undefined) => void;
    printVisualWidthMm?: number;
    printVisualHeightMm?: number;
}

const QUOTE_BTN =
  '!h-7 !min-h-0 !px-2 !py-0.5 !text-[10px] sm:!text-[11px] !font-medium !shadow-none whitespace-nowrap shrink-0';

const PHOTO_BTN =
  'inline-flex h-7 shrink-0 cursor-pointer items-center gap-1 rounded border border-slate-600 bg-slate-700/80 px-1.5 text-[10px] font-medium text-slate-200 hover:bg-slate-600 disabled:opacity-50 sm:text-[11px]';

const CostDisplay: React.FC<{ label: string; value: number; isTotal?: boolean }> = ({
  label,
  value,
  isTotal = false,
}) => (
  <div
    className={`rounded-md px-1.5 py-1 text-center sm:px-2 sm:py-1.5 ${
      isTotal ? 'bg-slate-900 ring-1 ring-green-500' : 'bg-slate-700'
    }`}
  >
    <p className="text-[10px] text-slate-400 leading-tight sm:text-xs">{label}</p>
    <p
      className={`font-bold leading-tight ${
        isTotal ? 'text-base text-green-400 sm:text-lg' : 'text-sm text-white sm:text-base'
      }`}
    >
      ₹{Math.round(value).toLocaleString('en-IN')}
    </p>
  </div>
);

function mm2ToArea(mm2: number, areaType: AreaType): number {
    const conversionFactor = areaType === AreaType.SQFT ? 304.8 : 1000;
    return mm2 / (conversionFactor * conversionFactor);
}

function parseRateInput(raw: string): number | '' {
    const trimmed = raw.trim();
    if (trimmed === '') return '';
    const n = Number(trimmed);
    return Number.isFinite(n) && n >= 0 ? n : '';
}

function rateDisplayValue(
    unitId: string,
    row: LayoutEstimateRow,
    drafts: Record<string, string>,
    defaultRate: number,
): string {
    if (unitId in drafts) return drafts[unitId];
    if (row.customRateRaw !== '') return String(row.customRateRaw);
    if (unitId !== 'primary') return '';
    return defaultRate > 0 ? String(defaultRate) : '';
}

export const QuotationPanel: React.FC<QuotationPanelProps> = React.memo(({
    idPrefix = '', width, height, quotationOpeningMm2, quantity, setQuantity, areaType, setAreaType, rate, setRate, onSave, onUpdate, onCancelEdit, editingItemId, onBatchAdd, windowTitle, setWindowTitle, hardwareCostPerWindow, quotationItemCount, onViewQuotation, onClose, bulkCorrectionLineCount = 0, onApplyBulkCorrection, layoutEstimate, activeLayoutUnitId, onLayoutUnitRateChange, onSaveLayoutAll, printElevationPhoto, onPrintElevationPhotoChange, printVisualWidthMm, printVisualHeightMm,
}) => {

    const numQuantity = Number(quantity) || 0;
    const [photoError, setPhotoError] = useState<string | null>(null);
    const [photoBusy, setPhotoBusy] = useState(false);
    const photoInputRef = useRef<HTMLInputElement>(null);

    const handlePrintPhotoFile = useCallback(
        async (e: React.ChangeEvent<HTMLInputElement>) => {
            const file = e.target.files?.[0];
            e.target.value = '';
            if (!file || !onPrintElevationPhotoChange) return;
            setPhotoBusy(true);
            setPhotoError(null);
            try {
                const dataUrl = await processPrintElevationPhotoFile(file);
                onPrintElevationPhotoChange(dataUrl);
            } catch (err) {
                setPhotoError(err instanceof Error ? err.message : 'Upload failed');
            } finally {
                setPhotoBusy(false);
            }
        },
        [onPrintElevationPhotoChange],
    );
    const numRate = Number(rate) || 0;
    const isMultiLayout = Boolean(layoutEstimate && layoutEstimate.length > 1);

    const [layoutEstimateOpen, setLayoutEstimateOpen] = useState(false);
    const [rateDrafts, setRateDrafts] = useState<Record<string, string>>({});

    const layoutUnitIds = layoutEstimate?.map((r) => r.id).join(',') ?? '';

    useEffect(() => {
        setRateDrafts({});
    }, [layoutUnitIds]);

    const commitRate = useCallback(
        (unitId: string, raw: string) => {
            const parsed = parseRateInput(raw);
            setRateDrafts((prev) => {
                const next = { ...prev };
                delete next[unitId];
                return next;
            });
            if (unitId === 'primary') {
                setRate(parsed);
            } else {
                onLayoutUnitRateChange?.(unitId, parsed);
            }
        },
        [onLayoutUnitRateChange, setRate],
    );

    const conversionFactor = areaType === AreaType.SQFT ? 304.8 : 1000;
    const mm2Raw = quotationOpeningMm2 > 0 ? quotationOpeningMm2 : (Number(width) || 0) * (Number(height) || 0);
    const singleArea = mm2Raw / (conversionFactor * conversionFactor);

    const layoutTotals = isMultiLayout && layoutEstimate
      ? layoutEstimateTotals(layoutEstimate, areaType, numQuantity)
      : null;

    const totalArea = layoutTotals ? layoutTotals.totalArea : singleArea * numQuantity;
    const baseCost = layoutTotals ? layoutTotals.baseCost : singleArea * numQuantity * numRate;
    const totalHardwareCost = layoutTotals ? layoutTotals.hardwareCost : hardwareCostPerWindow * numQuantity;
    const totalCost = layoutTotals ? layoutTotals.totalCost : baseCost + totalHardwareCost;

    const unitCount = layoutEstimate?.length ?? 0;

    return (
        <div className="overflow-x-hidden border-t-2 border-slate-700 bg-slate-800 p-1.5 shadow-inner sm:p-2 lg:rounded-none lg:p-2 rounded-t-lg">
            <div className="mx-auto max-w-7xl">
                <div className="mb-1 flex flex-wrap items-center gap-1">
                    <h2 className="shrink-0 text-xs font-semibold text-slate-100 sm:text-sm">Quotation</h2>
                    <Button onClick={onViewQuotation} variant="secondary" className={QUOTE_BTN}>
                        List ({quotationItemCount})
                    </Button>
                    {bulkCorrectionLineCount > 0 && !editingItemId && onApplyBulkCorrection ? (
                        <Button onClick={onApplyBulkCorrection} className={QUOTE_BTN}>
                            Fix ({bulkCorrectionLineCount})
                        </Button>
                    ) : null}
                    {editingItemId ? (
                        <>
                            <Button onClick={onCancelEdit} variant="secondary" className={QUOTE_BTN}>
                                Cancel
                            </Button>
                            <Button onClick={onUpdate} className={QUOTE_BTN} disabled={totalCost <= 0}>
                                Update
                            </Button>
                        </>
                    ) : isMultiLayout && onSaveLayoutAll ? (
                        <Button onClick={onSaveLayoutAll} className={QUOTE_BTN} disabled={totalCost <= 0}>
                            Save pkg · {unitCount}
                        </Button>
                    ) : (
                        <>
                            <Button onClick={onSave} className={QUOTE_BTN} disabled={totalCost <= 0}>
                                Add
                            </Button>
                            <Button onClick={onBatchAdd} variant="secondary" className={QUOTE_BTN}>
                                <PlusIcon className="mr-0.5 h-3 w-3 shrink-0" />
                                Batch
                            </Button>
                        </>
                    )}
                    {onPrintElevationPhotoChange ? (
                        <>
                            <input
                                ref={photoInputRef}
                                type="file"
                                accept="image/*"
                                className="sr-only"
                                disabled={photoBusy}
                                onChange={handlePrintPhotoFile}
                            />
                            <button
                                type="button"
                                className={PHOTO_BTN}
                                disabled={photoBusy}
                                title={`Print photo (optional) · ${Math.round(printVisualWidthMm ?? width)}×${Math.round(printVisualHeightMm ?? height)} mm`}
                                onClick={() => photoInputRef.current?.click()}
                            >
                                <UploadIcon className="h-3 w-3 shrink-0 text-slate-400" />
                                {photoBusy ? '…' : printElevationPhoto ? 'Photo ✓' : 'Photo'}
                            </button>
                            {printElevationPhoto ? (
                                <button
                                    type="button"
                                    className="h-7 shrink-0 rounded border border-slate-600 px-1.5 text-[10px] text-slate-400 hover:bg-slate-700 hover:text-slate-200"
                                    title="Remove print photo"
                                    onClick={() => {
                                        setPhotoError(null);
                                        onPrintElevationPhotoChange(undefined);
                                    }}
                                >
                                    ×
                                </button>
                            ) : null}
                        </>
                    ) : null}
                    {onClose ? (
                        <button
                            type="button"
                            onClick={onClose}
                            className="ml-auto flex h-7 w-7 shrink-0 items-center justify-center rounded-full hover:bg-slate-700 lg:hidden"
                            aria-label="Close quotation panel"
                        >
                            <XMarkIcon className="h-4 w-4 text-slate-400" />
                        </button>
                    ) : null}
                </div>
                {photoError ? (
                    <p className="mb-1 text-[10px] text-red-400">{photoError}</p>
                ) : null}
            </div>

            <div className="mx-auto grid max-w-7xl grid-cols-1 items-end gap-1.5 md:grid-cols-12 md:gap-2">
                <div className="md:col-span-4 lg:col-span-3">
                    <div className="grid grid-cols-4 gap-1.5">
                        <div className="col-span-2">
                           <Input 
                                id={`${idPrefix}window-title`}
                                name="window-title"
                                label="Window Tag" 
                                type="text" 
                                placeholder="e.g. Living Room"
                                value={windowTitle}
                                onChange={e => setWindowTitle(e.target.value)}
                            />
                        </div>
                        <Input 
                            id={`${idPrefix}quantity`}
                            name="quantity"
                            label="Quantity" 
                            type="number" 
                            inputMode="numeric"
                            placeholder="1"
                            value={quantity}
                            onChange={e => setQuantity(e.target.value === '' ? '' : parseInt(e.target.value) || 0)}
                        />
                        <Select
                            id={`${idPrefix}area-type`}
                            name="area-type"
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
                        id={`${idPrefix}base-rate`}
                        name="base-rate"
                        label={isMultiLayout ? 'Default rate (sab units)' : 'Base Rate'}
                        type="number" 
                        inputMode="decimal"
                        placeholder="e.g., 550"
                        value={rate}
                        onChange={e => {
                            const v = e.target.value;
                            setRate(v === '' ? '' : parseRateInput(v));
                        }}
                        unit={`/ ${areaType}`}
                    />
                </div>

                <div className="grid grid-cols-2 gap-1 items-end sm:grid-cols-4 sm:gap-1.5 md:col-span-6 lg:col-span-5">
                    <div className="rounded-md bg-slate-700 px-1.5 py-1 text-center sm:px-2 sm:py-1.5">
                        <p className="text-[10px] text-slate-400 leading-tight sm:text-xs">
                          {isMultiLayout ? 'Area' : 'Total area'}
                        </p>
                        <p className="text-sm font-bold text-white sm:text-base">{totalArea.toFixed(2)}</p>
                    </div>
                    <CostDisplay label="Base" value={baseCost} />
                    <CostDisplay label="Hardware" value={totalHardwareCost} />
                    <CostDisplay label="Total" value={totalCost} isTotal />
                </div>

            </div>

            {isMultiLayout && layoutEstimate ? (
              <div className="mx-auto mt-1.5 max-w-7xl">
              <div className="overflow-hidden rounded-md border border-slate-600/80 bg-slate-900/30">
                <button
                  type="button"
                  className="flex w-full items-center justify-between gap-2 px-2 py-1 text-left hover:bg-slate-800/50"
                  onClick={() => setLayoutEstimateOpen((v) => !v)}
                  aria-expanded={layoutEstimateOpen}
                >
                  <span className="text-[10px] font-medium text-slate-300 sm:text-[11px]">
                    Unit rates (×{numQuantity || 0})
                    {!layoutEstimateOpen ? (
                      <span className="ml-1.5 font-normal text-slate-500">
                        · ₹{Math.round(totalCost).toLocaleString('en-IN')}
                      </span>
                    ) : null}
                  </span>
                  <ChevronDownIcon
                    className={`h-3.5 w-3.5 shrink-0 text-slate-500 transition-transform ${layoutEstimateOpen ? 'rotate-180' : ''}`}
                  />
                </button>

                {layoutEstimateOpen ? (
                  <div className="max-h-[min(28vh,200px)] overflow-auto border-t border-slate-700/80">
                    <table className="w-full min-w-[480px] text-left text-[10px] sm:text-[11px]">
                      <thead>
                        <tr className="border-b border-slate-700 text-slate-400">
                          <th className="px-1.5 py-1 font-medium">Unit</th>
                          <th className="px-1.5 py-1 font-medium">Size</th>
                          <th className="px-1.5 py-1 font-medium text-right">Area</th>
                          <th className="px-1.5 py-1 font-medium text-right">Rate</th>
                          <th className="px-1.5 py-1 font-medium text-right">Hw</th>
                          <th className="px-1.5 py-1 font-medium text-right">Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {layoutEstimate.map((row) => {
                          const area = mm2ToArea(row.areaMm2, areaType) * numQuantity;
                          const draftRaw = rateDrafts[row.id];
                          const effectiveRate =
                            draftRaw !== undefined
                              ? Number(parseRateInput(draftRaw)) || numRate
                              : row.rate;
                          const lineBase = area * effectiveRate;
                          const lineHw = row.hardwareCost * numQuantity;
                          const lineTotal = lineBase + lineHw;
                          const isActive = row.id === activeLayoutUnitId;
                          const isPrimary = row.id === 'primary';
                          const displayVal = rateDisplayValue(row.id, row, rateDrafts, numRate);

                          return (
                            <tr
                              key={row.id}
                              className={`border-b border-slate-800 ${isActive ? 'bg-indigo-950/40' : ''}`}
                            >
                              <td className="px-1.5 py-1 text-slate-200">
                                {row.title}
                                {isActive ? <span className="ml-1 text-indigo-400">●</span> : null}
                              </td>
                              <td className="px-1.5 py-1 text-slate-400">
                                {row.width}×{row.height}
                              </td>
                              <td className="px-1.5 py-1 text-right text-slate-300">
                                {area.toFixed(2)} {areaType}
                              </td>
                              <td className="px-1.5 py-1 text-right">
                                <input
                                  type="number"
                                  inputMode="decimal"
                                  className="w-16 rounded border border-slate-600 bg-slate-800 px-1 py-0.5 text-right text-slate-200 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                                  placeholder={isPrimary ? 'Rate' : String(numRate || 'default')}
                                  value={displayVal}
                                  onChange={(e) => {
                                    setRateDrafts((prev) => ({
                                      ...prev,
                                      [row.id]: e.target.value,
                                    }));
                                  }}
                                  onBlur={(e) => commitRate(row.id, e.target.value)}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                      e.currentTarget.blur();
                                    }
                                  }}
                                  title={
                                    isPrimary
                                      ? 'Window 1 rate (global default)'
                                      : row.hasCustomRate
                                        ? 'Custom rate — clear for default'
                                        : `Default ${numRate}`
                                  }
                                />
                              </td>
                              <td className="px-1.5 py-1 text-right text-slate-400">
                                ₹{Math.round(lineHw).toLocaleString('en-IN')}
                              </td>
                              <td className="px-1.5 py-1 text-right font-semibold text-green-400/90">
                                ₹{Math.round(lineTotal).toLocaleString('en-IN')}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                      <tfoot>
                        <tr className="text-slate-300">
                          <td colSpan={2} className="px-1.5 py-1 font-semibold">Combined</td>
                          <td className="px-1.5 py-1 text-right font-bold">{totalArea.toFixed(2)}</td>
                          <td className="px-1.5 py-1 text-right text-slate-500">—</td>
                          <td className="px-1.5 py-1 text-right">₹{Math.round(totalHardwareCost).toLocaleString('en-IN')}</td>
                          <td className="px-1.5 py-1 text-right font-bold text-green-400">
                            ₹{Math.round(totalCost).toLocaleString('en-IN')}
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                ) : null}
              </div>
              </div>
            ) : null}
        </div>
    );
});
