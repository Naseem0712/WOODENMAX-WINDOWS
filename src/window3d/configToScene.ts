import type { WindowConfig } from '../types';
import { ShutterConfigType, TrackType, WindowType } from '../types';

const MM = 0.001;

export type Window3DSceneKind = 'sliding' | 'casement' | 'louvers' | 'generic';

export type Window3DSceneSpec = {
  widthM: number;
  heightM: number;
  frameMm: number;
  profileColor: string;
  kind: Window3DSceneKind;
  shutterConfig: ShutterConfigType;
  trackCount: 2 | 3;
  louverOrientation: 'vertical' | 'horizontal';
  louverBladePitchMm: number;
  /** Full config reference for sliding layout (read-only in 3D) */
  windowConfig: WindowConfig;
};

/** Read-only snapshot for 3D — no side effects on app config. */
export function buildWindow3DSceneSpec(config: WindowConfig): Window3DSceneSpec | null {
  const w = Number(config.width) || 0;
  const h = Number(config.height) || 0;
  if (w <= 0 || h <= 0) return null;

  const frameMm = Math.max(20, Number(config.series.dimensions.outerFrame) || 50);
  const pattern = config.louverPattern ?? [];
  const louverBladePitchMm =
    pattern.reduce((sum, item) => sum + (Number(item.size) || 0), 0) || 80;

  const base = {
    widthM: w * MM,
    heightM: h * MM,
    frameMm,
    profileColor: config.profileColor?.startsWith('#') ? config.profileColor : '#64748b',
    shutterConfig: config.shutterConfig,
    trackCount: (Number(config.trackType) === TrackType.THREE_TRACK ? 3 : 2) as 2 | 3,
    louverOrientation: config.orientation ?? 'vertical',
    louverBladePitchMm,
    windowConfig: config,
  };

  switch (config.windowType) {
    case WindowType.SLIDING:
      return { ...base, kind: 'sliding' };
    case WindowType.LOUVERS:
      return { ...base, kind: 'louvers' };
    case WindowType.CASEMENT:
      return { ...base, kind: 'casement' };
    default:
      return { ...base, kind: 'generic' };
  }
}
