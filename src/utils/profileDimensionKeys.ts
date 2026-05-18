import { WindowType } from '../types';
import type { ProfileDimensions, ProfileSeries } from '../types';

/** All known profile dimension keys in consistent display order. */
export const ALL_PROFILE_DIMENSION_KEYS: (keyof ProfileDimensions)[] = [
  'outerFrame',
  'outerFrameVertical',
  'track2T',
  'track3T',
  'jamb2T',
  'jamb3T',
  'fixedFrame',
  'shutterHandle',
  'shutterInterlock',
  'shutterTop',
  'shutterBottom',
  'shutterMeeting',
  'casementShutter',
  'mullion',
  'louverBlade',
  'louverProfile',
  'topTrack',
  'bottomTrack',
  'glassGridProfile',
];

/** Default visible keys per window type (what the designer actually uses). */
export const DEFAULT_DIMENSION_KEYS_BY_WINDOW_TYPE: Record<WindowType, (keyof ProfileDimensions)[]> = {
  [WindowType.SLIDING]: [
    'outerFrame',
    'outerFrameVertical',
    'track2T',
    'track3T',
    'jamb2T',
    'jamb3T',
    'fixedFrame',
    'shutterHandle',
    'shutterInterlock',
    'shutterTop',
    'shutterBottom',
    'shutterMeeting',
    'glassGridProfile',
  ],
  [WindowType.CASEMENT]: [
    'outerFrame',
    'outerFrameVertical',
    'fixedFrame',
    'casementShutter',
    'mullion',
    'glassGridProfile',
  ],
  [WindowType.VENTILATOR]: [
    'outerFrame',
    'outerFrameVertical',
    'fixedFrame',
    'casementShutter',
    'mullion',
    'louverBlade',
    'glassGridProfile',
  ],
  [WindowType.GLASS_PARTITION]: [
    'topTrack',
    'bottomTrack',
    'fixedFrame',
    'casementShutter',
    'glassGridProfile',
  ],
  [WindowType.CORNER]: [
    'outerFrame',
    'outerFrameVertical',
    'fixedFrame',
    'casementShutter',
    'mullion',
    'glassGridProfile',
  ],
  [WindowType.MIRROR]: ['outerFrame', 'glassGridProfile'],
  [WindowType.LOUVERS]: ['louverProfile'],
};

/** Friendly labels that read better than camelCase split. */
const DIMENSION_KEY_LABELS: Partial<Record<keyof ProfileDimensions, string>> = {
  track2T: '2-Track Outer Frame (top + bottom rail)',
  track3T: '3-Track Outer Frame (top + bottom rail)',
  jamb2T: 'Outer jamb — 2-track only (L + R; not mixed with 3-track stock)',
  jamb3T: 'Outer jamb — 3-track only (L + R; not mixed with 2-track stock)',
  outerFrame: 'Outer Frame (generic / fallback)',
  outerFrameVertical: 'Outer Frame — Vertical Jamb (left + right)',
  shutterHandle: 'Shutter — Handle-side Vertical',
  shutterTop: 'Shutter — Top Rail',
  shutterBottom: 'Shutter — Bottom Rail',
  shutterInterlock: 'Shutter — Interlock',
  shutterMeeting: 'Shutter — Mesh Interlock (separated)',
  fixedFrame: 'Fixed Panel Frame',
};

export function dimensionKeyLabel(key: keyof ProfileDimensions): string {
  const explicit = DIMENSION_KEY_LABELS[key];
  if (explicit) return explicit;
  return key.replace(/([A-Z])/g, ' $1').replace(/^./, (s) => s.toUpperCase());
}

/**
 * For sliding windows, the newer profile keys below fall back to a generic
 * key when a series hasn't explicitly defined them yet. Callers should use
 * {@link resolveSeriesNumeric} to look up weight / stock-length / dimension
 * values so that legacy series (which only have `outerFrame` filled) keep
 * pricing correctly, while modern series that split out
 * `track2T` / `track3T` / `outerFrameVertical` get per-extrusion accuracy.
 *
 * Crucially, the BOM identity / bin-pack pool still uses the PRIMARY key
 * (track2T vs track3T) so the quotation surfaces 2-track vs 3-track stock
 * requirements as separate line items — even if the numbers came from the
 * shared `outerFrame` fallback.
 */
export const SLIDING_PROFILE_FALLBACK_CHAIN: Partial<
  Record<keyof ProfileDimensions, (keyof ProfileDimensions)[]>
> = {
  track2T: ['outerFrame'],
  track3T: ['outerFrame'],
  jamb2T: ['outerFrameVertical', 'outerFrame'],
  jamb3T: ['outerFrameVertical', 'outerFrame'],
  outerFrameVertical: ['outerFrame'],
  // Mesh interlock falls back to the shared glass interlock when mesh is
  // not being pooled separately (e.g. legacy series without a dedicated
  // mesh-meeting rail configured).
  shutterMeeting: ['shutterInterlock'],
};

/**
 * Read a numeric value (dimension / weight / stock length) for a profile key
 * from a series, trying the key first and then the sliding fallback chain.
 * Returns 0 when nothing is defined — callers can then substitute a default.
 */
export function resolveSeriesNumeric(
  source: Partial<Record<keyof ProfileDimensions, number | ''>> | undefined,
  primaryKey: keyof ProfileDimensions
): number {
  const direct = Number(source?.[primaryKey]);
  if (Number.isFinite(direct) && direct > 0) return direct;
  const chain = SLIDING_PROFILE_FALLBACK_CHAIN[primaryKey] || [];
  for (const fb of chain) {
    const v = Number(source?.[fb]);
    if (Number.isFinite(v) && v > 0) return v;
  }
  return 0;
}

/** Returns true when at least one key in [primary, ...fallbacks] is set with
 *  a positive numeric value on the given series dimension map. Useful to
 *  decide whether a sliding piece should even be added to the BOM (e.g. if
 *  a series has outer frame defined via either `track2T` or `outerFrame`). */
export function hasResolvedSeriesValue(
  source: Partial<Record<keyof ProfileDimensions, number | ''>> | undefined,
  primaryKey: keyof ProfileDimensions
): boolean {
  return resolveSeriesNumeric(source, primaryKey) > 0;
}

export function getOrderedProfileDimensionKeys(series: ProfileSeries): (keyof ProfileDimensions)[] {
  const defaults = DEFAULT_DIMENSION_KEYS_BY_WINDOW_TYPE[series.type] ?? [];
  const extra = series.extraDimensionKeys ?? [];
  const set = new Set<keyof ProfileDimensions>([...defaults, ...extra]);
  return ALL_PROFILE_DIMENSION_KEYS.filter((k) => set.has(k));
}

export function getAddableProfileDimensionKeys(series: ProfileSeries): (keyof ProfileDimensions)[] {
  const shown = new Set(getOrderedProfileDimensionKeys(series));
  return ALL_PROFILE_DIMENSION_KEYS.filter((k) => !shown.has(k));
}
