/** Common stocked mesh / film roll widths (feet). */
export const STANDARD_MESH_ROLL_WIDTHS_FT = [4, 4.5, 5] as const;
/** Common roll lengths in market (feet). */
export const STANDARD_MESH_ROLL_LENGTHS_FT = [50, 100] as const;

const MM_TO_FT = 0.00328084;

export interface RollPlanResult {
  /** Narrower panel side placed across roll width (mm). */
  crossSideMm: number;
  /** Longer side runs along roll length (mm). */
  alongSideMm: number;
  /** Smallest standard roll width (ft) that fits crossSide; null if panel too wide for 5'. */
  suggestedRollWidthFt: number | null;
  /** Running feet along roll = (along side ft) × panel count. */
  totalRunningFt: number;
  /** True if suggestedRollWidthFt covers cross side. */
  fitsStandardWidth: boolean;
  /** Short hint for 50' / 100' purchase. */
  purchaseHint: string;
}

function purchaseHintForRunningLength(totalRunningFt: number): string {
  if (!Number.isFinite(totalRunningFt) || totalRunningFt <= 0) return '—';
  const r = Math.ceil(totalRunningFt * 10) / 10;
  if (r <= 50) return `${r} rft → 1× 50' roll enough`;
  if (r <= 100) return `${r} rft → 1× 100' roll (or 2× 50')`;
  const n50 = Math.ceil(r / 50);
  const n100 = Math.ceil(r / 100);
  return `${r} rft → ${n100}× 100' or ${n50}× 50' (approx.)`;
}

/**
 * Assumes roll is bought by **width** (4' / 4.5' / 5'); you pay **running feet** along the roll.
 * Panel is laid with **narrow side** across roll width to minimise roll width.
 */
export function planMeshOrGlassRoll(
  widthMm: number,
  heightMm: number,
  totalPanels: number
): RollPlanResult {
  const w = Math.max(0, widthMm);
  const h = Math.max(0, heightMm);
  const crossSideMm = Math.min(w, h);
  const alongSideMm = Math.max(w, h);
  const crossFt = crossSideMm * MM_TO_FT;
  const alongFt = alongSideMm * MM_TO_FT;
  const totalRunningFt = alongFt * Math.max(0, totalPanels);

  let suggestedRollWidthFt: number | null = null;
  for (const rw of STANDARD_MESH_ROLL_WIDTHS_FT) {
    if (rw + 1e-6 >= crossFt) {
      suggestedRollWidthFt = rw;
      break;
    }
  }
  const fitsStandardWidth = suggestedRollWidthFt !== null;
  if (!fitsStandardWidth) {
    suggestedRollWidthFt = STANDARD_MESH_ROLL_WIDTHS_FT[STANDARD_MESH_ROLL_WIDTHS_FT.length - 1];
  }

  return {
    crossSideMm,
    alongSideMm,
    suggestedRollWidthFt,
    totalRunningFt,
    fitsStandardWidth,
    purchaseHint: purchaseHintForRunningLength(totalRunningFt),
  };
}
