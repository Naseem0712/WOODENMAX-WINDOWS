/**
 * Glass is cut from flat **sheets** (not rolls). Pick the smallest standard
 * sheet that yields ≥1 pane for the requested cut, and estimate how many
 * sheets are needed + yield %.
 *
 * Sheet sizes are typical retail/fabrication sizes (mm, width × height). The
 * planner tries both orientations (normal and rotated) when fitting panes.
 */

export interface GlassSheet {
  /** Short human label shown in the UI. */
  name: string;
  widthMm: number;
  heightMm: number;
}

/** Common stocked flat-glass sheet sizes used across Indian fabrication. */
export const STANDARD_GLASS_SHEETS_MM: readonly GlassSheet[] = [
  { name: "2440 × 1830 (8' × 6')", widthMm: 2440, heightMm: 1830 },
  { name: "3050 × 2140 (10' × 7')", widthMm: 3050, heightMm: 2140 },
  { name: "3300 × 2250 (10.8' × 7.4')", widthMm: 3300, heightMm: 2250 },
] as const;

const MM_TO_FT = 0.00328084;

/** How many panes of `cut` fit inside a sheet (checks both orientations). */
function panesPerSheet(cutW: number, cutH: number, sheetW: number, sheetH: number): number {
  if (cutW <= 0 || cutH <= 0 || sheetW <= 0 || sheetH <= 0) return 0;
  const fitNormal =
    cutW <= sheetW && cutH <= sheetH
      ? Math.floor(sheetW / cutW) * Math.floor(sheetH / cutH)
      : 0;
  const fitRotated =
    cutH <= sheetW && cutW <= sheetH
      ? Math.floor(sheetW / cutH) * Math.floor(sheetH / cutW)
      : 0;
  return Math.max(fitNormal, fitRotated);
}

export interface GlassSheetOption {
  sheet: GlassSheet;
  /** Panes that fit on one sheet (best orientation). 0 = cut too large. */
  panesPerSheet: number;
  /** Sheets needed to deliver `totalPanels` panes. Infinity if cut too large. */
  sheetsRequired: number;
  /** Material yield = (cut area × panes) / sheet area. 0..1. */
  yield: number;
}

export interface GlassSheetPlan {
  cutWidthMm: number;
  cutHeightMm: number;
  totalPanels: number;
  /** All standard sheet sizes evaluated (in catalogue order). */
  options: GlassSheetOption[];
  /** Best pick = fewest sheets, then highest yield. Null if no sheet fits. */
  best: GlassSheetOption | null;
  /** True when every standard sheet is too small for the cut. */
  oversized: boolean;
  /** Total pane area in sq ft (cut size × qty). */
  totalAreaSqFt: number;
  /** Short human hint: e.g. "2× 8'×6' sheets (84% yield)". */
  purchaseHint: string;
}

function buildPurchaseHint(best: GlassSheetOption | null, oversized: boolean): string {
  if (oversized || !best) return 'Custom / oversized sheet required';
  const y = Math.round(best.yield * 100);
  return `${best.sheetsRequired}× ${best.sheet.name} (${y}% yield)`;
}

/**
 * Plan how many standard glass sheets to order to yield `totalPanels` panes of
 * `cutWidthMm × cutHeightMm`. The function considers panel rotation and picks
 * the option needing the fewest sheets (tie-break: higher yield).
 */
export function planGlassSheetCut(
  cutWidthMm: number,
  cutHeightMm: number,
  totalPanels: number
): GlassSheetPlan {
  const cw = Math.max(0, cutWidthMm);
  const ch = Math.max(0, cutHeightMm);
  const qty = Math.max(0, Math.floor(totalPanels));

  const options: GlassSheetOption[] = STANDARD_GLASS_SHEETS_MM.map((sheet) => {
    const panes = panesPerSheet(cw, ch, sheet.widthMm, sheet.heightMm);
    const sheetsRequired = panes > 0 && qty > 0 ? Math.ceil(qty / panes) : panes > 0 ? 0 : Infinity;
    const yieldRatio =
      panes > 0 ? (cw * ch * panes) / (sheet.widthMm * sheet.heightMm) : 0;
    return { sheet, panesPerSheet: panes, sheetsRequired, yield: yieldRatio };
  });

  const usable = options.filter((o) => o.panesPerSheet > 0 && Number.isFinite(o.sheetsRequired));
  let best: GlassSheetOption | null = null;
  for (const o of usable) {
    if (
      !best ||
      o.sheetsRequired < best.sheetsRequired ||
      (o.sheetsRequired === best.sheetsRequired && o.yield > best.yield)
    ) {
      best = o;
    }
  }
  const oversized = usable.length === 0;

  const totalAreaSqFt = cw * ch * qty * MM_TO_FT * MM_TO_FT;

  return {
    cutWidthMm: cw,
    cutHeightMm: ch,
    totalPanels: qty,
    options,
    best,
    oversized,
    totalAreaSqFt,
    purchaseHint: buildPurchaseHint(best, oversized),
  };
}
