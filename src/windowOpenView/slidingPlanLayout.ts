import { ShutterConfigType } from '../types';
import type { OpenViewSpec } from './types';

export type SlidePlanSeg = {
  x1: number;
  x2: number;
  lane: 1 | 2 | 3;
  thick: number;
  label?: string;
  arrow?: 'left' | 'right';
};

export type SlidingPlanMode = 'four_shutter' | 'stacked';

export function slidingPlanMode(shutterConfig: ShutterConfigType): SlidingPlanMode {
  switch (shutterConfig) {
    case ShutterConfigType.FOUR_GLASS:
    case ShutterConfigType.FOUR_GLASS_TWO_MESH:
      return 'four_shutter';
    default:
      return 'stacked';
  }
}

function interlockMm(spec: OpenViewSpec): number {
  return Number(spec.config.series?.dimensions?.shutterInterlock) || 20;
}

function panelIdx(id: string): number {
  return Number.parseInt(id.replace(/\D/g, ''), 10) || 0;
}

function slideTravel(panelW: number, innerW: number, openAmount: number): number {
  const t = Math.max(0, Math.min(1, openAmount));
  return Math.min(innerW * 0.4, panelW * 0.85) * t;
}

function panelInnerX(p: OpenViewSpec['panels'][0], innerX: number) {
  return { x1: p.xMm - innerX, x2: p.xMm + p.widthMm - innerX };
}

function stackedPanelWidth(innerW: number, interlock: number, shutterConfig: ShutterConfigType): number {
  const hasMesh = shutterConfig === ShutterConfigType.TWO_GLASS_ONE_MESH;
  const glassCount =
    shutterConfig === ShutterConfigType.TWO_GLASS
      ? 2
      : shutterConfig === ShutterConfigType.THREE_GLASS
        ? 3
        : 2;
  const divider = hasMesh ? 2 : glassCount;
  return (innerW + (divider - 1) * interlock) / divider;
}

/** One lane per shutter — 2-track clamps lane 3 → 2. */
function laneForPanel(shutterConfig: ShutterConfigType, idx: number, trackCount: number): 1 | 2 | 3 {
  let lane: 1 | 2 | 3;
  switch (shutterConfig) {
    case ShutterConfigType.TWO_GLASS:
      lane = idx === 0 ? 1 : 2;
      break;
    case ShutterConfigType.THREE_GLASS:
      lane = idx === 0 ? 1 : idx === 1 ? 2 : 3;
      break;
    case ShutterConfigType.TWO_GLASS_ONE_MESH:
      lane = idx === 0 ? 1 : idx === 1 ? 2 : 3;
      break;
    default:
      lane = 1;
  }
  if (trackCount < 3 && lane === 3) lane = 2;
  return lane;
}

/** Plan Y offset — doors hug the track line. */
export function slidingLaneYOffset(lane: number, mode: SlidingPlanMode, trackCount: number): number {
  if (mode === 'four_shutter') {
    if (lane === 1) return -4;
    if (lane === 2) return 4;
    return 7;
  }
  if (trackCount <= 2) return lane === 1 ? -4 : 4;
  if (lane === 1) return -4;
  if (lane === 2) return 0;
  return 4;
}

/** Stacked shutters share X span; slide apart from centre stack (not side-by-side). */
function stackedSegmentX(
  p: OpenViewSpec['panels'][0],
  idx: number,
  panelW: number,
  innerW: number,
  interlock: number,
  openAmount: number,
  shutterConfig: ShutterConfigType,
): { x1: number; x2: number } {
  const hasMesh = shutterConfig === ShutterConfigType.TWO_GLASS_ONE_MESH;
  const stackX = (innerW - panelW) / 2;
  const meshStackX = panelW - interlock;
  const travel = slideTravel(panelW, innerW, openAmount);

  if (hasMesh && idx === 0) {
    return { x1: 0, x2: panelW };
  }

  let x1 = hasMesh && idx >= 1 ? meshStackX : stackX;
  let x2 = x1 + panelW;

  if (!p.isFixed && p.slideDirection === 'left') {
    x1 -= travel;
    x2 -= travel;
  } else if (!p.isFixed && p.slideDirection === 'right') {
    x1 += travel;
    x2 += travel;
  }

  return { x1, x2 };
}

export function buildSlidingPlanSegments(spec: OpenViewSpec, openAmount: number): SlidePlanSeg[] {
  const innerW = spec.innerWidthMm ?? spec.totalWidthMm;
  const innerX = spec.innerOriginMm?.x ?? 0;
  const shutterConfig = spec.config.shutterConfig;
  const mode = slidingPlanMode(shutterConfig);
  const interlock = interlockMm(spec);
  const trackCount = spec.trackCount ?? 2;

  const sorted = [...spec.panels].sort((a, b) => panelIdx(a.id) - panelIdx(b.id));

  if (mode === 'four_shutter') {
    return sorted
      .sort((a, b) => (a.trackLane ?? 1) - (b.trackLane ?? 1))
      .map((p) => {
        const { x1, x2 } = panelInnerX(p, innerX);
        return {
          x1,
          x2,
          lane: (p.trackLane ?? 1) as 1 | 2 | 3,
          thick: p.isMesh ? 2 : 3.5,
          label: p.label,
          arrow:
            p.slideDirection === 'left' ? 'left' : p.slideDirection === 'right' ? 'right' : undefined,
        };
      });
  }

  const panelW = stackedPanelWidth(innerW, interlock, shutterConfig);

  return sorted.map((p) => {
    const idx = panelIdx(p.id);
    const { x1, x2 } = stackedSegmentX(p, idx, panelW, innerW, interlock, openAmount, shutterConfig);
    return {
      x1,
      x2,
      lane: laneForPanel(shutterConfig, idx, trackCount),
      thick: p.isMesh ? 2 : 3.5,
      label: p.label,
      arrow:
        p.slideDirection === 'left' ? 'left' : p.slideDirection === 'right' ? 'right' : undefined,
    };
  });
}

export function slidingOpenFractionHint(spec: OpenViewSpec): string | null {
  if (slidingPlanMode(spec.config.shutterConfig) === 'four_shutter') return null;
  return (spec.trackCount ?? 2) >= 3 ? '~75% opening when fully open' : '~50% opening when fully open';
}
