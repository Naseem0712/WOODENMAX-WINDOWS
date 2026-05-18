const MM_PER_INCH = 25.4;
/** 1 inch = 8 sutra (1/8 inch); display uses standard eighth fractions, not decimal inches. */
const EIGHTH_UNICODE = ['\u215B', '\u00BC', '\u215C', '\u00BD', '\u215D', '\u00BE', '\u215E'] as const; // ⅛ ¼ ⅜ ½ ⅝ ¾ ⅞

function gcd(a: number, b: number): number {
  let x = Math.abs(a);
  let y = Math.abs(b);
  while (y !== 0) {
    const t = y;
    y = x % y;
    x = t;
  }
  return x || 1;
}

/** Reduced text fraction n/d for eighths-based inches (fallback if font lacks Unicode). */
function fractionTextFromEighths(eighths: number): string {
  if (eighths <= 0 || eighths > 7) return '';
  const g = gcd(eighths, 8);
  const n = eighths / g;
  const d = 8 / g;
  return `${n}/${d}`;
}

/**
 * mm → `4'11⅝" (1515 mm)` style: feet, whole inches, then nearest **1/8 inch** (8 sutra per inch),
 * not decimal inches like 11.65".
 */
export function formatMmAsFtInAndMm(mmRaw: number): string {
  const mm = Math.round(mmRaw);
  if (!Number.isFinite(mm) || mm <= 0) return '—';

  let totalInches = mm / MM_PER_INCH;
  let ft = Math.floor(totalInches / 12);
  let inchRem = totalInches - ft * 12;

  let wholeIn = Math.floor(inchRem + 1e-9);
  let frac = inchRem - wholeIn;
  let eighths = Math.round(frac * 8);

  if (eighths >= 8) {
    wholeIn += 1;
    eighths = 0;
  }
  if (wholeIn >= 12) {
    ft += Math.floor(wholeIn / 12);
    wholeIn = wholeIn % 12;
  }

  let inchPart: string;
  if (eighths <= 0) {
    inchPart = `${wholeIn}`;
  } else {
    const sym = EIGHTH_UNICODE[eighths - 1];
    inchPart = `${wholeIn}${sym}`;
  }

  return `${ft}'${inchPart}" (${mm} mm)`;
}

/** Same as {@link formatMmAsFtInAndMm} but ASCII-only fraction (e.g. `4'11-5/8"`) for CSV / plain text. */
export function formatMmAsFtInAndMmAscii(mmRaw: number): string {
  const mm = Math.round(mmRaw);
  if (!Number.isFinite(mm) || mm <= 0) return '—';

  let totalInches = mm / MM_PER_INCH;
  let ft = Math.floor(totalInches / 12);
  let inchRem = totalInches - ft * 12;

  let wholeIn = Math.floor(inchRem + 1e-9);
  let frac = inchRem - wholeIn;
  let eighths = Math.round(frac * 8);

  if (eighths >= 8) {
    wholeIn += 1;
    eighths = 0;
  }
  if (wholeIn >= 12) {
    ft += Math.floor(wholeIn / 12);
    wholeIn = wholeIn % 12;
  }

  const fracTxt = fractionTextFromEighths(eighths);
  const inchPart = fracTxt ? `${wholeIn}-${fracTxt}` : `${wholeIn}`;

  return `${ft}'${inchPart}" (${mm} mm)`;
}
