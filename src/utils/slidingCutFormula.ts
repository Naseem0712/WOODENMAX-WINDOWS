import { ShutterConfigType, TrackType, WindowType } from '../types';
import type { ProfileSeries } from '../types';

/**
 * Canonical cutting-size formula for sliding windows (25 / 27 / 29 mm profiles).
 *
 * Given the shutter opening (aperture) W × H in mm:
 *   vertical cut length   = H - 80
 *   horizontal cut length = (W - 75) / N_glass + interlockThicknessMm / 2
 *   glass cut width       = horizontal - 60
 *   glass cut height      = vertical   - 100
 *
 * Piece counts per window (sum over glass + mesh shutters):
 *   Track top + bottom     : 2 × W (2-track rail OR 3-track rail)       [45-45]
 *   Jamb left + right      : 2 × H (vertical side frame)                 [45-45]
 *   Bottom track clips     : N_tracks pieces × (W - 100)                [90-90]
 *   Shutter top + bottom   : N_shutters × 2 pieces × horizontalCutMm    [45-90]
 *   Handle-side vertical   : N_shutters pieces × verticalCutMm           [45-45]
 *   Slim interlock         : (N_shutters − 1) pieces × verticalCutMm     [90-90]
 *   Reinforcement interlock: 1 piece × verticalCutMm (outer shutter)    [90-90]
 *
 * 2-track and 3-track use different track extrusions, so 2T vs 3T never share
 * stock. When the series has **separate** track vs jamb sections (`unified` =
 * false), horizontal pieces use `outerTrack2T` / `outerTrack3T` and vertical
 * jamb `outerJamb2T` / `outerJamb3T`. When **unified** (default for most
 * 25–29 mm: same section on all four sides), top+bottom+L+R share one pool per
 * track count: `outerPerimeter2T` / `outerPerimeter3T` so vertical and
 * horizontal off-cuts bin-pack together (lower wastage, lower cost). Profile
 * keys still come from `track2T` / `track3T` in that case.
 *
 * In reality top + bottom + handle-side vertical are all cut from the SAME
 * stock profile across every series — the calculator pools them into one
 * `shutterFrame` pool so bin-packing wastes less material. Mesh pieces share
 * that same pool by default; only if the user opts in (`separateMeshSections`)
 * do mesh top / bottom / handle / interlock go to their own pools.
 */
export const SLIDING_CUT_CONSTANTS = {
  /** Aperture-height reduction to get shutter vertical cut length. */
  VERTICAL_REDUCTION: 80,
  /** Aperture-width reduction before dividing across glass shutters. */
  HORIZONTAL_REDUCTION: 75,
  /** Aperture-width reduction to get bottom track clip piece length. */
  TRACK_CLIP_REDUCTION: 100,
  /** Default interlock thickness used when the series doesn't provide one. */
  DEFAULT_INTERLOCK_THICKNESS: 22,
  /** Shutter-width − this = glass cut width. */
  GLASS_WIDTH_REDUCTION: 60,
  /** Shutter-height − this = glass cut height. */
  GLASS_HEIGHT_REDUCTION: 100,
} as const;

export type SlidingCutAngle = '45-45' | '45-90' | '90-90';

export type SlidingPieceRole =
  | 'outerFrameHorizontal'
  | 'outerFrameVertical'
  | 'trackClip'
  | 'shutterHorizontal'
  | 'shutterHandle'
  | 'shutterSlimInterlock'
  | 'shutterReinfInterlock';

export type SlidingShutterType = 'glass' | 'mesh' | 'common';

/**
 * Logical pool key — pieces sharing a pool share a stock bar during bin
 * packing. Pool keys also drive weight-per-metre + powder rate lookups.
 *
 * Split (heavy outer): `outerTrack*` vs `outerJamb*`. Unified (typical
 * 25–29 mm): `outerPerimeter*` only — same stock for H and V; 2T/3T still
 * split.
 */
export type SlidingPiecePool =
  | 'outerPerimeter2T'
  | 'outerPerimeter3T'
  | 'outerTrack2T'
  | 'outerTrack3T'
  | 'outerJamb2T'
  | 'outerJamb3T'
  | 'trackClip'
  | 'shutterFrame'
  | 'shutterInterlock'
  | 'meshShutterFrame'
  | 'meshShutterInterlock';

export interface SlidingCutPiece {
  label: string;
  pieces: number;
  lengthMm: number;
  cutAngles: SlidingCutAngle;
  role: SlidingPieceRole;
  shutterType: SlidingShutterType;
  pool: SlidingPiecePool;
}

export interface SlidingShutterCounts {
  glass: number;
  mesh: number;
  total: number;
}

export interface SlidingCutLayout {
  apertureWidthMm: number;
  apertureHeightMm: number;
  trackCount: 2 | 3;
  counts: SlidingShutterCounts;
  /** Shutter vertical cut length (handle + every interlock). */
  verticalCutMm: number;
  /** Shutter top / bottom cut length. */
  horizontalCutMm: number;
  /** Bottom track clip piece length. */
  trackClipLengthMm: number;
  /** Glass sheet cut width (mesh cloth same). */
  glassWidthMm: number;
  /** Glass sheet cut height (mesh cloth same). */
  glassHeightMm: number;
  /** Interlock half added to each shutter width (half of profile thickness). */
  interlockHalfAddMm: number;
  /** Whether mesh sections were routed to their own pools. */
  meshSectionsSeparated: boolean;
  /** When true, outer H+V use the same `outerPerimeter2T/3T` pool (unified same section). */
  unifiedSlidingOuterPerimeter: boolean;
  pieces: SlidingCutPiece[];
}

/** Same stock for outer top/bottom and L/R (25–29mm style); `false` = split track/jamb (e.g. 35mm). */
export function isSlidingSeriesUnifiedOuter(
  series: Pick<ProfileSeries, 'type' | 'slidingOuterUnifiedPerimeter'>
): boolean {
  return series.type === WindowType.SLIDING && series.slidingOuterUnifiedPerimeter !== false;
}

export function getSlidingShutterCounts(config: ShutterConfigType): SlidingShutterCounts {
  switch (config) {
    case ShutterConfigType.TWO_GLASS:
      return { glass: 2, mesh: 0, total: 2 };
    case ShutterConfigType.THREE_GLASS:
      return { glass: 3, mesh: 0, total: 3 };
    case ShutterConfigType.TWO_GLASS_ONE_MESH:
      return { glass: 2, mesh: 1, total: 3 };
    case ShutterConfigType.FOUR_GLASS:
      return { glass: 4, mesh: 0, total: 4 };
    case ShutterConfigType.FOUR_GLASS_TWO_MESH:
      return { glass: 4, mesh: 2, total: 6 };
    default:
      return { glass: 2, mesh: 0, total: 2 };
  }
}

export interface SlidingCutLayoutInput {
  /** Aperture width (mm) — shutter travel region after fixed panels. */
  apertureWidthMm: number;
  /** Aperture height (mm) — shutter travel region after fixed panels. */
  apertureHeightMm: number;
  shutterConfig: ShutterConfigType;
  trackType: TrackType;
  /**
   * Interlock profile thickness in mm (typically 22). Half of this value is
   * added to each shutter width so interlocks overlap correctly when closed.
   */
  interlockThicknessMm?: number;
  /**
   * When true, mesh top / bottom / handle / interlock go to their own pools
   * (meshShutterFrame + meshShutterInterlock). When false (default), all
   * shutter frame pieces share the `shutterFrame` pool, all interlocks share
   * the `shutterInterlock` pool — less wastage in bin packing.
   */
  separateMeshSections?: boolean;
  /**
   * When not `false` (default): one outer section for top/bottom and L/R — shared
   * bin pack per 2T/3T. Pass `false` for split track vs jamb extrusion.
   */
  unifiedOuterPerimeter?: boolean;
}

export function computeSlidingCutLayout(input: SlidingCutLayoutInput): SlidingCutLayout {
  const W = Math.max(0, Number(input.apertureWidthMm) || 0);
  const H = Math.max(0, Number(input.apertureHeightMm) || 0);
  const trackCount: 2 | 3 = Number(input.trackType) === TrackType.THREE_TRACK ? 3 : 2;
  const counts = getSlidingShutterCounts(input.shutterConfig);
  const separateMeshSections = !!input.separateMeshSections && counts.mesh > 0;
  const unifiedOuter = input.unifiedOuterPerimeter !== false;

  const {
    VERTICAL_REDUCTION,
    HORIZONTAL_REDUCTION,
    TRACK_CLIP_REDUCTION,
    DEFAULT_INTERLOCK_THICKNESS,
    GLASS_WIDTH_REDUCTION,
    GLASS_HEIGHT_REDUCTION,
  } = SLIDING_CUT_CONSTANTS;

  const interlockThicknessMm =
    Number.isFinite(input.interlockThicknessMm) && Number(input.interlockThicknessMm) > 0
      ? Number(input.interlockThicknessMm)
      : DEFAULT_INTERLOCK_THICKNESS;
  const interlockHalfAddMm = interlockThicknessMm / 2;

  const verticalCutMm = Math.max(0, H - VERTICAL_REDUCTION);
  const horizontalCutMm =
    counts.glass > 0 ? Math.max(0, (W - HORIZONTAL_REDUCTION) / counts.glass + interlockHalfAddMm) : 0;
  const trackClipLengthMm = Math.max(0, W - TRACK_CLIP_REDUCTION);
  const glassWidthMm = Math.max(0, horizontalCutMm - GLASS_WIDTH_REDUCTION);
  const glassHeightMm = Math.max(0, verticalCutMm - GLASS_HEIGHT_REDUCTION);

  const pieces: SlidingCutPiece[] = [];
  const add = (p: SlidingCutPiece) => {
    if (p.pieces > 0 && p.lengthMm > 0) pieces.push(p);
  };

  // Outer: either one pool for H+V (unified, same section) or track vs jamb pools.
  const trackPool: SlidingPiecePool = trackCount === 3 ? 'outerTrack3T' : 'outerTrack2T';
  const jambOnlyPool: SlidingPiecePool = trackCount === 3 ? 'outerJamb3T' : 'outerJamb2T';
  const perimeterPool: SlidingPiecePool = trackCount === 3 ? 'outerPerimeter3T' : 'outerPerimeter2T';
  const outerHPool = unifiedOuter ? perimeterPool : trackPool;
  const outerVPool = unifiedOuter ? perimeterPool : jambOnlyPool;
  add({
    label: unifiedOuter
      ? `Outer frame — top & bottom (${trackCount}-track, same section as L+R vertical)`
      : `Outer frame — top & bottom (${trackCount}-track rail)`,
    pieces: 2,
    lengthMm: W,
    cutAngles: '45-45',
    role: 'outerFrameHorizontal',
    shutterType: 'common',
    pool: outerHPool,
  });
  add({
    label: unifiedOuter
      ? `Outer frame — left & right (${trackCount}-track, same section as top/bottom track)`
      : 'Outer frame — left & right (jamb)',
    pieces: 2,
    lengthMm: H,
    cutAngles: '45-45',
    role: 'outerFrameVertical',
    shutterType: 'common',
    pool: outerVPool,
  });

  add({
    label: `Bottom track clip (${trackCount}-track)`,
    pieces: trackCount,
    lengthMm: trackClipLengthMm,
    cutAngles: '90-90',
    role: 'trackClip',
    shutterType: 'common',
    pool: 'trackClip',
  });

  // Shutter frame pieces — top+bottom and handle-side verticals. All three
  // are cut from the same stock profile per series, so they share a pool.
  // When mesh sections are separated, mesh gets its own pool.
  const framePool = (type: 'glass' | 'mesh'): SlidingPiecePool => {
    if (type === 'mesh' && separateMeshSections) return 'meshShutterFrame';
    return 'shutterFrame';
  };
  const interlockPool = (type: 'glass' | 'mesh'): SlidingPiecePool => {
    if (type === 'mesh' && separateMeshSections) return 'meshShutterInterlock';
    return 'shutterInterlock';
  };

  if (separateMeshSections) {
    // Glass frame pieces
    add({
      label: 'Glass shutter top + bottom',
      pieces: counts.glass * 2,
      lengthMm: horizontalCutMm,
      cutAngles: '45-90',
      role: 'shutterHorizontal',
      shutterType: 'glass',
      pool: framePool('glass'),
    });
    add({
      label: 'Glass handle-side vertical',
      pieces: counts.glass,
      lengthMm: verticalCutMm,
      cutAngles: '45-45',
      role: 'shutterHandle',
      shutterType: 'glass',
      pool: framePool('glass'),
    });
    // Glass interlocks: (glass - 1) slim + 1 reinforcement
    add({
      label: 'Glass slim interlock (vertical)',
      pieces: Math.max(0, counts.glass - 1),
      lengthMm: verticalCutMm,
      cutAngles: '90-90',
      role: 'shutterSlimInterlock',
      shutterType: 'glass',
      pool: interlockPool('glass'),
    });
    add({
      label: 'Glass reinforcement interlock (vertical)',
      pieces: counts.glass > 0 ? 1 : 0,
      lengthMm: verticalCutMm,
      cutAngles: '90-90',
      role: 'shutterReinfInterlock',
      shutterType: 'glass',
      pool: interlockPool('glass'),
    });

    // Mesh frame pieces (separate pool)
    add({
      label: 'Mesh shutter top + bottom',
      pieces: counts.mesh * 2,
      lengthMm: horizontalCutMm,
      cutAngles: '45-90',
      role: 'shutterHorizontal',
      shutterType: 'mesh',
      pool: framePool('mesh'),
    });
    add({
      label: 'Mesh handle-side vertical',
      pieces: counts.mesh,
      lengthMm: verticalCutMm,
      cutAngles: '45-45',
      role: 'shutterHandle',
      shutterType: 'mesh',
      pool: framePool('mesh'),
    });
    add({
      label: 'Mesh slim interlock (vertical)',
      pieces: counts.mesh,
      lengthMm: verticalCutMm,
      cutAngles: '90-90',
      role: 'shutterSlimInterlock',
      shutterType: 'mesh',
      pool: interlockPool('mesh'),
    });
  } else {
    // Unified (default) — glass + mesh share the same pools.
    add({
      label: 'Shutter top + bottom',
      pieces: counts.total * 2,
      lengthMm: horizontalCutMm,
      cutAngles: '45-90',
      role: 'shutterHorizontal',
      shutterType: 'common',
      pool: 'shutterFrame',
    });
    add({
      label: 'Shutter handle-side vertical',
      pieces: counts.total,
      lengthMm: verticalCutMm,
      cutAngles: '45-45',
      role: 'shutterHandle',
      shutterType: 'common',
      pool: 'shutterFrame',
    });
    add({
      label: 'Slim interlock (vertical)',
      pieces: Math.max(0, counts.total - 1),
      lengthMm: verticalCutMm,
      cutAngles: '90-90',
      role: 'shutterSlimInterlock',
      shutterType: 'common',
      pool: 'shutterInterlock',
    });
    add({
      label: 'Reinforcement interlock (vertical)',
      pieces: counts.total > 0 ? 1 : 0,
      lengthMm: verticalCutMm,
      cutAngles: '90-90',
      role: 'shutterReinfInterlock',
      shutterType: 'common',
      pool: 'shutterInterlock',
    });
  }

  return {
    apertureWidthMm: W,
    apertureHeightMm: H,
    trackCount,
    counts,
    verticalCutMm,
    horizontalCutMm,
    trackClipLengthMm,
    glassWidthMm,
    glassHeightMm,
    interlockHalfAddMm,
    meshSectionsSeparated: separateMeshSections,
    unifiedSlidingOuterPerimeter: unifiedOuter,
    pieces,
  };
}
