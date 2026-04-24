import React from 'react';
import type { BOMSeries } from '../types';
import type {
  PerWindowLayoutRow,
  PoolCutBlock,
  QuotationLineCutBlock,
  SlidingSeriesCutReport,
} from '../utils/slidingSeriesCutReport';
import { fmtMmRuler, poolBlocksToRftWastageFt, stockBarLengthLabelFt } from '../utils/slidingSeriesCutReport';
import { formatMmAsFtInAndMm } from '../utils/formatCutLength';
import { planGlassSheetCut } from '../utils/glassSheetPlanner';
import { planMeshOrGlassRoll } from '../utils/glassMeshRollPlanner';

const FEET_PER_MM = 0.00328084;

const panelClass =
  'rounded border border-slate-400/90 bg-white p-2 print:border-slate-800';

function PoolTableRow({
  block,
  showWeight,
  compact: compactLayout,
}: {
  block: PoolCutBlock;
  showWeight: boolean;
  compact: boolean;
}) {
  const { usedFt, wasteFt, stockFt } = poolBlocksToRftWastageFt(block);
  return (
    <div className={compactLayout ? 'text-[7pt] mb-2 last:mb-0' : 'text-[7pt] mb-2'}>
      <div className="font-bold text-slate-900">
        {block.title}
        <span className="font-normal text-slate-600"> — {block.stockKeyLabel} @ {(block.standardLengthMm * FEET_PER_MM).toFixed(1)} ft</span>
      </div>
      <table className="w-full text-left border border-slate-300 mt-0.5">
        <thead className="bg-slate-100">
          <tr className="border-b border-slate-300">
            <th className="p-0.5">Length (mm)</th>
            <th className="p-0.5 text-right">Pcs</th>
            <th className="p-0.5">Part</th>
          </tr>
        </thead>
        <tbody>
          {block.sizeRows.map((row) => (
            <tr key={row.lengthMm} className="border-b border-slate-200 last:border-b-0">
              <td className="p-0.5 align-top">
                {fmtMmRuler(row.lengthMm)}
                <span className="block text-[6pt] text-slate-600">{formatMmAsFtInAndMm(row.lengthMm)}</span>
              </td>
              <td className="p-0.5 text-right align-top font-semibold">{row.pieceCount}</td>
              <td className="p-0.5 text-slate-700 align-top text-[6.5pt]">{row.partLabels.join(' + ')}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-0.5 text-[6.5pt] text-slate-800">
        {block.requiredBars} bars · {stockFt.toFixed(1)} rft stock · {usedFt.toFixed(1)} rft used · {wasteFt.toFixed(1)} rft waste
        {showWeight && block.totalWeightKg > 0 && (
          <>
            {' '}
            · {block.totalWeightKg.toFixed(2)} kg
          </>
        )}
        {block.pool === 'trackClip' && <span className="text-slate-500"> (clip)</span>}
      </p>
    </div>
  );
}

function StockRequiredTable({ report, showWeight }: { report: SlidingSeriesCutReport; showWeight: boolean }) {
  if (!report.materialPurchase || report.materialPurchase.length === 0) return null;
  return (
    <table className="w-full text-left text-[7pt]">
      <thead>
        <tr className="border-b-2 border-slate-400 bg-slate-100">
          <th className="p-0.5">Item</th>
          <th className="p-0.5 text-center">Bars</th>
          <th className="p-0.5 text-right">Pcs</th>
          <th className="p-0.5 text-right">Waste (rft)</th>
          {showWeight && <th className="p-0.5 text-right">kg</th>}
        </tr>
      </thead>
      <tbody>
        {report.materialPurchase.map((row) => {
          const b = row.block;
          const w = poolBlocksToRftWastageFt(b);
          return (
            <tr key={row.id} className="border-b border-slate-200 last:border-0">
              <td className="p-0.5 align-top font-medium text-slate-900">{row.title}</td>
              <td className="p-0.5 text-center align-top tabular-nums">
                {b.requiredBars} × {stockBarLengthLabelFt(b)}
              </td>
              <td className="p-0.5 text-right align-top tabular-nums">{b.totalPieceCount}</td>
              <td className="p-0.5 text-right align-top tabular-nums">{w.wasteFt.toFixed(2)}</td>
              {showWeight && (
                <td className="p-0.5 text-right align-top tabular-nums">
                  {b.totalWeightKg > 0 ? b.totalWeightKg.toFixed(2) : '—'}
                </td>
              )}
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

function HardwareTable({ hardware }: { hardware: BOMSeries['hardware'] }) {
  if (hardware.length === 0) {
    return <p className="text-[7pt] text-slate-500">—</p>;
  }
  return (
    <table className="w-full text-left text-[7pt]">
      <thead>
        <tr className="border-b-2 border-slate-400 bg-slate-100">
          <th className="p-0.5">Item</th>
          <th className="p-0.5 text-right">Qty</th>
        </tr>
      </thead>
      <tbody>
        {hardware.map((item) => (
          <tr key={item.name} className="border-b border-slate-200 last:border-0">
            <td className="p-0.5 font-medium">{item.name}</td>
            <td className="p-0.5 text-right tabular-nums">{item.totalQuantity} pcs</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function windowSizeCell(wmm?: number, hmm?: number) {
  if (wmm == null || hmm == null || (wmm <= 0 && hmm <= 0)) return '—';
  return (
    <span>
      {Math.round(wmm)}×{Math.round(hmm)} mm
      <span className="block text-[6pt] text-slate-600">
        {formatMmAsFtInAndMm(wmm)} W × {formatMmAsFtInAndMm(hmm)} H
      </span>
    </span>
  );
}

function GlassPanel({ seriesData }: { seriesData: BOMSeries }) {
  if (seriesData.glass.length === 0 && !(seriesData.glassCutsFlat && seriesData.glassCutsFlat.length)) {
    return <p className="text-[7pt] text-slate-500">None</p>;
  }
  return (
    <div>
      {seriesData.glass.length > 0 && (
        <p className="text-[6.5pt] text-slate-600 mb-0.5">By glass type (totals for the series)</p>
      )}
      {seriesData.glass.length > 0 && (
        <table className="w-full text-left text-[7pt]">
          <thead>
            <tr className="border-b-2 border-slate-400 bg-slate-100">
              <th className="p-0.5">Glass</th>
              <th className="p-0.5 text-right">ft²</th>
              <th className="p-0.5 text-right">m²</th>
            </tr>
          </thead>
          <tbody>
            {seriesData.glass.map((g) => (
              <tr key={g.description} className="border-b border-slate-200 last:border-0">
                <td className="p-0.5 font-medium">{g.description}</td>
                <td className="p-0.5 text-right tabular-nums">{g.totalAreaSqFt.toFixed(2)}</td>
                <td className="p-0.5 text-right tabular-nums">{g.totalAreaSqMt.toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {seriesData.glassCutsFlat && seriesData.glassCutsFlat.length > 0 && (
        <>
          <p className="text-[6.5pt] text-slate-600 mt-1.5 mb-0.5">By line — pane size &amp; parent window</p>
          <table className="w-full text-left text-[6.5pt]">
            <thead>
              <tr className="border-b border-slate-300 bg-slate-50">
                <th className="p-0.5">Quotation line</th>
                <th className="p-0.5">Window (opening)</th>
                <th className="p-0.5">Type</th>
                <th className="p-0.5">Pane mm</th>
                <th className="p-0.5 text-right">Panes</th>
                <th className="p-0.5 text-right">ft²</th>
                <th className="p-0.5 text-right">Sheets</th>
              </tr>
            </thead>
            <tbody>
              {seriesData.glassCutsFlat.map((row, idx) => {
                const plan = planGlassSheetCut(row.widthMm, row.heightMm, row.totalPanels);
                const best = plan.best;
                return (
                  <tr
                    key={`${row.quotationItemId ?? 'x'}-${row.description}-${row.widthMm}-${row.heightMm}-${idx}`}
                    className="border-b border-slate-200 last:border-0"
                  >
                    <td className="p-0.5 align-top font-medium text-[6.5pt]">{row.lineTitle ?? '—'}</td>
                    <td className="p-0.5 align-top">{windowSizeCell(row.windowWidthMm, row.windowHeightMm)}</td>
                    <td className="p-0.5 align-top font-medium">{row.description}</td>
                    <td className="p-0.5 align-top">
                      {row.widthMm}×{row.heightMm}
                    </td>
                    <td className="p-0.5 text-right align-top tabular-nums">{row.totalPanels}</td>
                    <td className="p-0.5 text-right align-top tabular-nums">{row.areaSqFt.toFixed(2)}</td>
                    <td className="p-0.5 text-right align-top tabular-nums">
                      {best ? best.sheetsRequired : '—'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </>
      )}
    </div>
  );
}

function MeshPanel({ seriesData }: { seriesData: BOMSeries }) {
  const hasMesh = seriesData.mesh && seriesData.mesh.totalAreaSqFt > 0;
  if (!hasMesh) {
    return <p className="text-[7pt] text-slate-500">—</p>;
  }
  return (
    <div>
      <table className="w-full text-left text-[7pt]">
        <thead>
          <tr className="border-b-2 border-slate-400 bg-slate-100">
            <th className="p-0.5">Mesh</th>
            <th className="p-0.5 text-right">ft²</th>
            <th className="p-0.5 text-right">m²</th>
            <th className="p-0.5 text-center">Cut sizes</th>
          </tr>
        </thead>
        <tbody>
          <tr className="border-b border-slate-200">
            <td className="p-0.5 font-medium">Roll</td>
            <td className="p-0.5 text-right tabular-nums">{seriesData.mesh!.totalAreaSqFt.toFixed(2)}</td>
            <td className="p-0.5 text-right tabular-nums">{seriesData.mesh!.totalAreaSqMt.toFixed(2)}</td>
            <td className="p-0.5 text-center tabular-nums">{(seriesData.meshCutsFlat?.length || 0) || '—'}</td>
          </tr>
        </tbody>
      </table>
      {seriesData.meshCutsFlat && seriesData.meshCutsFlat.length > 0 && (
        <>
          <p className="text-[6.5pt] text-slate-600 mt-1.5 mb-0.5">By line — mesh pane &amp; parent window</p>
          <table className="w-full text-left text-[6.5pt] mt-0">
            <thead>
              <tr className="border-b border-slate-300 bg-slate-50">
                <th className="p-0.5">Quotation line</th>
                <th className="p-0.5">Window (opening)</th>
                <th className="p-0.5">Pane mm</th>
                <th className="p-0.5 text-right">Panes</th>
                <th className="p-0.5 text-right">ft²</th>
                <th className="p-0.5 text-right">Roll</th>
                <th className="p-0.5 text-right">Run</th>
              </tr>
            </thead>
            <tbody>
              {seriesData.meshCutsFlat.map((row, idx) => {
                const plan = planMeshOrGlassRoll(row.widthMm, row.heightMm, row.totalPanels);
                const rollW =
                  plan.suggestedRollWidthFt != null
                    ? plan.fitsStandardWidth
                      ? `${plan.suggestedRollWidthFt}'`
                      : `${plan.suggestedRollWidthFt}'*`
                    : '—';
                return (
                  <tr
                    key={`m-${row.quotationItemId ?? 'x'}-${row.widthMm}-${row.heightMm}-${idx}`}
                    className="border-b border-slate-200 last:border-0"
                  >
                    <td className="p-0.5 align-top font-medium text-[6.5pt]">{row.lineTitle ?? '—'}</td>
                    <td className="p-0.5 align-top">{windowSizeCell(row.windowWidthMm, row.windowHeightMm)}</td>
                    <td className="p-0.5 align-top">
                      {row.widthMm}×{row.heightMm}
                    </td>
                    <td className="p-0.5 text-right tabular-nums">{row.totalPanels}</td>
                    <td className="p-0.5 text-right tabular-nums">{row.areaSqFt.toFixed(2)}</td>
                    <td className="p-0.5 text-right text-[6pt]">{rollW}</td>
                    <td className="p-0.5 text-right tabular-nums">{plan.totalRunningFt.toFixed(1)} rft</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </>
      )}
    </div>
  );
}

function KindBadge({ k }: { k?: PerWindowLayoutRow['kind'] }) {
  if (!k || k === 'common') return null;
  return (
    <span className="ml-0.5 rounded bg-white/80 px-0.5 text-[6pt] font-medium uppercase text-slate-600 ring-1 ring-slate-200">
      {k}
    </span>
  );
}

function LayoutSubsection({ title, rows }: { title: string; rows: PerWindowLayoutRow[] }) {
  if (rows.length === 0) return null;
  return (
    <div className="mb-1.5 last:mb-0">
      <div className="text-[6.5pt] font-semibold text-slate-800">{title}</div>
      <ul className="ml-1.5 list-none space-y-0.5 text-[7pt] text-slate-800">
        {rows.map((r, i) => (
          <li key={`${r.label}-${i}`}>
            <span className="font-bold tabular-nums">{r.pieces} pc</span> × {fmtMmRuler(r.lengthMm)}{' '}
            <span className="text-slate-500">({formatMmAsFtInAndMm(r.lengthMm)})</span>
            <KindBadge k={r.kind} />
            <span className="text-slate-600"> — {r.label}</span>{' '}
            <span className="font-mono text-[6.5pt] text-slate-500">{r.cutAngles}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function PerLineBlock({ line, showWeight, idx }: { line: QuotationLineCutBlock; showWeight: boolean; idx: number }) {
  const pw = line.perWindowLayout;
  return (
    <div className="border border-slate-200 rounded p-1.5 mb-2 bg-slate-50/50">
      <div className="font-bold text-slate-900 text-[8pt]">
        {idx + 1}. {line.title}
        <span className="font-normal text-slate-700"> — order qty {line.quantity}</span>
      </div>
      <div className="mt-1 rounded border border-slate-300 bg-white px-1.5 py-1 text-[7.5pt] text-slate-900">
        <span className="font-bold">Window (rough opening / line size):</span>{' '}
        {line.widthMm}×{line.heightMm} mm
        <span className="text-slate-600">
          {' '}
          ({formatMmAsFtInAndMm(line.widthMm)} W × {formatMmAsFtInAndMm(line.heightMm)} H)
        </span>
        <span className="text-slate-700"> — {line.trackCount}-track</span>
      </div>
      <div className="mt-1 grid grid-cols-1 gap-1.5 sm:grid-cols-2 text-[7pt]">
        <div className="min-h-0 rounded border border-amber-200/90 bg-amber-50/80 p-1.5 print:border-amber-300">
          <div className="mb-0.5 text-[7.5pt] font-bold text-amber-950">Outer frame (this window)</div>
          <LayoutSubsection title="Horizontal (track)" rows={pw.outer.horizontal} />
          <LayoutSubsection title="Vertical (jamb)" rows={pw.outer.vertical} />
          <LayoutSubsection title="Track clips" rows={pw.outer.trackClip} />
        </div>
        <div className="min-h-0 rounded border border-sky-200/90 bg-sky-50/80 p-1.5 print:border-sky-300">
          <div className="mb-0.5 text-[7.5pt] font-bold text-sky-950">Shutters (this window)</div>
          <LayoutSubsection title="Horizontal members" rows={pw.shutter.horizontal} />
          <LayoutSubsection title="Handle side (vertical)" rows={pw.shutter.handleVertical} />
          <LayoutSubsection title="Interlocks (vertical)" rows={pw.shutter.interlockVertical} />
        </div>
      </div>
      <div className="mt-2 text-[7pt]">
        {line.perPool.map((b) => (
          <PoolTableRow key={`${line.itemId}-${b.pool}`} block={b} showWeight={showWeight} compact />
        ))}
      </div>
    </div>
  );
}

export const SlidingSeriesBomBlock: React.FC<{
  report: SlidingSeriesCutReport;
  seriesData: BOMSeries;
  showWeight: boolean;
  mixedMode?: boolean;
}> = ({ report, seriesData, showWeight, mixedMode }) => {
  return (
    <div className="mt-2 space-y-2 text-[8pt] print:space-y-2">
      {mixedMode && (
        <p className="text-[7pt] text-amber-900 bg-amber-50 border border-amber-200 rounded px-1 py-0.5">
          Sliding items only. Other window types in this series: see the full BOM table below.
        </p>
      )}

      <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
        <div className={panelClass}>
          <h4 className="text-[9pt] font-bold text-slate-900 border-b border-slate-300 mb-1.5 pb-0.5">Stock required</h4>
          <StockRequiredTable report={report} showWeight={showWeight} />
        </div>
        <div className={panelClass}>
          <h4 className="text-[9pt] font-bold text-slate-900 border-b border-slate-300 mb-1.5 pb-0.5">Hardware required</h4>
          <HardwareTable hardware={seriesData.hardware} />
        </div>
      </div>

      <div className={panelClass}>
        <h4 className="text-[9pt] font-bold text-slate-900 border-b border-slate-300 mb-1.5 pb-0.5">Cut plan</h4>
        <div className="mb-2">
          <div className="text-[6.5pt] font-semibold text-slate-600 mb-0.5">All lines in series — by stock pool</div>
          {report.seriesPools.map((b) => (
            <PoolTableRow key={b.pool} block={b} showWeight={showWeight} compact={false} />
          ))}
        </div>
        <div>
          <div className="text-[6.5pt] font-semibold text-slate-600 mb-0.5">Each quotation line (includes line qty)</div>
          {report.lineBreakdown.map((line, i) => (
            <PerLineBlock key={line.itemId} line={line} showWeight={showWeight} idx={i} />
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
        <div className={panelClass}>
          <h4 className="text-[9pt] font-bold text-slate-900 border-b border-slate-300 mb-1.5 pb-0.5">Glass required</h4>
          <GlassPanel seriesData={seriesData} />
        </div>
        <div className={panelClass}>
          <h4 className="text-[9pt] font-bold text-slate-900 border-b border-slate-300 mb-1.5 pb-0.5">Mesh required</h4>
          <MeshPanel seriesData={seriesData} />
        </div>
      </div>
    </div>
  );
};

export type { PoolCutBlock, QuotationLineCutBlock, SlidingSeriesCutReport };
