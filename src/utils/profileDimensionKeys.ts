import { WindowType } from '../types';
import type { ProfileDimensions, ProfileSeries } from '../types';

/** All known profile dimension keys in consistent display order. */
export const ALL_PROFILE_DIMENSION_KEYS: (keyof ProfileDimensions)[] = [
  'outerFrame',
  'outerFrameVertical',
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

export function dimensionKeyLabel(key: keyof ProfileDimensions): string {
  return key.replace(/([A-Z])/g, ' $1').replace(/^./, (s) => s.toUpperCase());
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
