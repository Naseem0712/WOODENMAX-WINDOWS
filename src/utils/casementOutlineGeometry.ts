import type { CasementOutlineConfig, WindowConfig } from '../types';

export type CasementOutlineHost = { casementOutline?: CasementOutlineConfig };

export const DEFAULT_CASEMENT_OUTLINE: CasementOutlineConfig = {
  shape: 'rect',
  cornerRadiusMm: 40,
  archStraightBottomMm: '',
  archSpringRatio: 0.28,
  archRadialMullions: 2,
  archMullionAngles: [],
  archInnerRingCount: 0,
  archInnerRingGapMm: 16,
};

export function resolveCasementOutline(config: CasementOutlineHost): CasementOutlineConfig {
  const raw = config.casementOutline ?? {};
  const rawAngles = raw.archMullionAngles;
  let archMullionAngles: number[] = DEFAULT_CASEMENT_OUTLINE.archMullionAngles ?? [];
  if (Array.isArray(rawAngles)) {
    archMullionAngles = rawAngles.filter((a) => Number.isFinite(a));
  } else if (typeof rawAngles === 'string' && rawAngles.trim()) {
    archMullionAngles = rawAngles
      .split(/[,;\s]+/)
      .map((s) => parseFloat(s.trim()))
      .filter((n) => Number.isFinite(n));
  }
  return {
    ...DEFAULT_CASEMENT_OUTLINE,
    ...raw,
    archMullionAngles,
    archInnerRingCount: Math.max(0, Math.min(2, Math.round(Number(raw.archInnerRingCount) || 0))),
    archInnerRingGapMm: raw.archInnerRingGapMm ?? DEFAULT_CASEMENT_OUTLINE.archInnerRingGapMm,
  };
}

export function isArchTopOutline(config: WindowConfig): boolean {
  return resolveCasementOutline(config).shape === 'arch_top';
}

export function isRoundedOutline(config: WindowConfig): boolean {
  const s = resolveCasementOutline(config).shape;
  return s === 'rounded_rect' || s === 'rounded_top' || s === 'rounded_bottom';
}

/** Y (mm) of arch spring / horizontal transom from top of inner opening. */
export function archSpringYMm(config: WindowConfig, innerH: number): number {
  const outline = resolveCasementOutline(config);
  if (outline.shape !== 'arch_top') return 0;
  const ratio = config.horizontalDividers?.[0] ?? outline.archSpringRatio;
  const clamped = Math.max(0.15, Math.min(0.55, ratio));
  const fromRatio = clamped * innerH;
  const innerW = innerH; // unknown here — caller can pass min with width
  return fromRatio;
}

/** Smallest arch-head band (mm) when user sets straight-bottom height. */
export const MIN_ARCH_ZONE_MM = 48;

export function idealArchSpringRatio(innerW: number, innerH: number): number {
  if (innerW <= 0 || innerH <= 0) return DEFAULT_CASEMENT_OUTLINE.archSpringRatio;
  return Math.min(0.55, Math.max(0.12, (innerH - MIN_ARCH_ZONE_MM) / innerH));
}

/** Circular-segment radius for chord width W and arch rise H (spring line to apex). */
export function archRadiusMm(innerW: number, archHeightMm: number): number {
  if (innerW <= 0 || archHeightMm <= 0) return 0;
  const W = innerW;
  const H = archHeightMm;
  return (W * W + 4 * H * H) / (8 * H);
}

/** @deprecated use MIN_ARCH_ZONE_MM — kept for panel hints */
export function minArchZoneMm(_innerW: number): number {
  return MIN_ARCH_ZONE_MM;
}

export function maxArchStraightBottomMm(_innerW: number, innerH: number): number {
  return Math.max(0, innerH - MIN_ARCH_ZONE_MM);
}

export function defaultArchStraightBottomMm(innerW: number, innerH: number): number {
  return Math.round(maxArchStraightBottomMm(innerW, innerH) * 0.72);
}

export function resolveArchStraightBottomMm(
  config: CasementOutlineHost,
  innerW: number,
  innerH: number,
): number {
  const outline = resolveCasementOutline(config);
  const raw = outline.archStraightBottomMm;
  if (raw !== '' && Number.isFinite(Number(raw)) && Number(raw) > 0) {
    return Math.min(maxArchStraightBottomMm(innerW, innerH), Math.max(0, Number(raw)));
  }
  const springY = archSpringYMmForOpening(config as WindowConfig, innerW, innerH);
  return Math.max(0, innerH - springY);
}

export function archSpringYMmForOpening(config: WindowConfig, innerW: number, innerH: number): number {
  const outline = resolveCasementOutline(config);
  if (outline.shape !== 'arch_top') return 0;

  const straightRaw = outline.archStraightBottomMm;
  if (straightRaw !== '' && Number.isFinite(Number(straightRaw)) && Number(straightRaw) > 0) {
    const straight = Math.min(maxArchStraightBottomMm(innerW, innerH), Math.max(0, Number(straightRaw)));
    return Math.max(MIN_ARCH_ZONE_MM, innerH - straight);
  }

  const ratio =
    config.horizontalDividers?.[0] ??
    outline.archSpringRatio ??
    idealArchSpringRatio(innerW, innerH);
  const fromRatio = ratio * innerH;
  return Math.max(MIN_ARCH_ZONE_MM, Math.min(innerH - MIN_ARCH_ZONE_MM, fromRatio));
}

export function applyArchStraightBottomLayout(
  config: WindowConfig,
  innerW: number,
  innerH: number,
  straightBottomMm: number | '',
): Pick<WindowConfig, 'horizontalDividers'> & {
  casementOutline: CasementOutlineConfig;
} {
  const outline = resolveCasementOutline(config);
  let straight: number | '' = straightBottomMm;
  if (straight !== '' && Number.isFinite(Number(straight))) {
    straight = Math.min(maxArchStraightBottomMm(innerW, innerH), Math.max(0, Number(straight)));
  } else {
    straight = '';
  }
  const nextOutline: CasementOutlineConfig = {
    ...outline,
    archStraightBottomMm: straight,
  };
  const springY = archSpringYMmForOpening(
    { ...config, casementOutline: nextOutline },
    innerW,
    innerH,
  );
  const springR = springY / Math.max(innerH, 1);
  const h = [...(config.horizontalDividers ?? [])];
  if (h.length === 0) h.push(springR);
  else h[0] = springR;
  return {
    casementOutline: { ...nextOutline, archSpringRatio: springR },
    horizontalDividers: h,
  };
}

export type RadialSeg = { x1: number; y1: number; x2: number; y2: number };

function archMullionRaySegment(innerW: number, springY: number, angleDeg: number): RadialSeg | null {
  const clamped = ((angleDeg % 360) + 360) % 360;
  if (clamped <= 0 || clamped >= 180) return null;
  const cx = innerW / 2;
  const R = archRadiusMm(innerW, springY);
  if (R <= 0 || springY <= 0) return null;
  const cy = R;

  const rad = (clamped * Math.PI) / 180;
  const dx = Math.cos(rad);
  const dy = -Math.sin(rad);

  const fx = cx;
  const fy = springY;
  const ox = fx - cx;
  const oy = fy - cy;
  const b = 2 * (dx * ox + dy * oy);
  const c = ox * ox + oy * oy - R * R;
  const disc = b * b - 4 * c;
  if (disc < 0) return null;
  const sqrt = Math.sqrt(disc);
  const t1 = (-b - sqrt) / 2;
  const t2 = (-b + sqrt) / 2;
  const t = Math.max(t1, t2);
  if (!Number.isFinite(t) || t < 1) return null;

  return {
    x1: fx,
    y1: fy,
    x2: fx + t * dx,
    y2: fy + t * dy,
  };
}

/** @deprecated use archMullionRaySegment */
function segFromAngle(innerW: number, springY: number, angleDeg: number): RadialSeg | null {
  return archMullionRaySegment(innerW, springY, angleDeg);
}

/** Fanlight mullions — custom angles (deg, 180=left, 90=top, 0=right) or auto evenly spaced. */
export function archMullionSegments(innerW: number, springY: number, outline: CasementOutlineConfig): RadialSeg[] {
  if (innerW <= 0 || springY <= 0) return [];
  const custom = (outline.archMullionAngles ?? []).filter((a) => Number.isFinite(a));
  if (custom.length > 0) {
    return custom
      .map((deg) => archMullionRaySegment(innerW, springY, deg))
      .filter((seg): seg is RadialSeg => seg != null);
  }
  const count = outline.archRadialMullions ?? 0;
  if (count <= 0) return [];
  const segs: RadialSeg[] = [];
  for (let i = 1; i <= count; i++) {
    const angleDeg = 180 - (i * 180) / (count + 1);
    const seg = archMullionRaySegment(innerW, springY, angleDeg);
    if (seg) segs.push(seg);
  }
  return segs;
}

/** @deprecated use archMullionSegments */
export function archRadialMullionSegments(innerW: number, springY: number, count: number): RadialSeg[] {
  return archMullionSegments(innerW, springY, { ...DEFAULT_CASEMENT_OUTLINE, archRadialMullions: count });
}

export function archTopClipPathD(innerW: number, innerH: number, springY: number): string {
  const r = archRadiusMm(innerW, springY);
  return `M 0 ${springY} L 0 ${innerH} L ${innerW} ${innerH} L ${innerW} ${springY} A ${r} ${r} 0 0 0 0 ${springY} Z`;
}

/** Fanlight glass / mullion zone — semicircle above spring line only (no square shoulders). */
export function archHeadZoneClipPathD(innerW: number, springY: number): string {
  if (springY <= 0) return '';
  const r = archRadiusMm(innerW, springY);
  return `M 0 ${springY} A ${r} ${r} 0 0 0 ${innerW} ${springY} Z`;
}

/** Boundary angles (deg) dividing fanlight into glass wedges — left → right. */
export function fanlightBoundaryAngles(outline: CasementOutlineConfig): number[] {
  const custom = (outline.archMullionAngles ?? []).filter((a) => Number.isFinite(a));
  let mids: number[];
  if (custom.length > 0) {
    mids = [...custom].sort((a, b) => b - a);
  } else {
    const count = outline.archRadialMullions ?? 0;
    mids = [];
    for (let i = 1; i <= count; i++) {
      mids.push(180 - (i * 180) / (count + 1));
    }
  }
  return [180, ...mids, 0];
}

function outerPointAtFanlightAngle(innerW: number, springY: number, angleDeg: number): { x: number; y: number } {
  if (angleDeg >= 179.5) return { x: 0, y: springY };
  if (angleDeg <= 0.5) return { x: innerW, y: springY };
  const seg = archMullionRaySegment(innerW, springY, angleDeg);
  if (!seg) return { x: innerW / 2, y: 0 };
  return { x: seg.x2, y: seg.y2 };
}

/** Glass wedge between two fanlight angles — arc follows the outer semicircle correctly. */
function archFanlightWedgePathD(
  innerW: number,
  springY: number,
  angleDeg1: number,
  angleDeg2: number,
): string {
  const cx = innerW / 2;
  const R = archRadiusMm(innerW, springY);
  const cy = R;
  const p1 = outerPointAtFanlightAngle(innerW, springY, angleDeg1);
  const p2 = outerPointAtFanlightAngle(innerW, springY, angleDeg2);
  const a1 = Math.atan2(p1.y - cy, p1.x - cx);
  const a2 = Math.atan2(p2.y - cy, p2.x - cx);
  let delta = a2 - a1;
  while (delta <= 0) delta += Math.PI * 2;
  while (delta > Math.PI * 2) delta -= Math.PI * 2;
  const largeArc = delta > Math.PI ? 1 : 0;
  const sweep = 1;
  return `M ${cx} ${springY} L ${p1.x} ${p1.y} A ${R} ${R} 0 ${largeArc} ${sweep} ${p2.x} ${p2.y} Z`;
}

/** Glass wedge paths between fanlight mullions (or one full semicircle when no mullions). */
export function archFanlightWedgePaths(
  innerW: number,
  springY: number,
  outline: CasementOutlineConfig,
): string[] {
  if (innerW <= 0 || springY <= 0) return [];
  const bounds = fanlightBoundaryAngles(outline);
  if (bounds.length <= 2) {
    const d = archHeadZoneClipPathD(innerW, springY);
    return d ? [d] : [];
  }
  const paths: string[] = [];
  for (let i = 0; i < bounds.length - 1; i++) {
    paths.push(archFanlightWedgePathD(innerW, springY, bounds[i], bounds[i + 1]));
  }
  return paths;
}

function halfChordAtSpring(r: number, springY: number, cy: number): number {
  const dy = springY - cy;
  return Math.sqrt(Math.max(0, r * r - dy * dy));
}

/** Filled semicircular profile bands for inner arch rings (visible frame strips). */
export function archInnerRingBandPaths(
  innerW: number,
  springY: number,
  ringCount: number,
  gapMm: number,
  profileMm: number,
): string[] {
  const n = Math.max(0, Math.min(2, Math.round(ringCount)));
  if (n <= 0 || innerW <= 0 || springY <= 0) return [];
  const R = archRadiusMm(innerW, springY);
  const cx = innerW / 2;
  const cy = R;
  const gap = Math.max(4, gapMm);
  const prof = Math.max(4, profileMm);
  const paths: string[] = [];

  for (let i = 1; i <= n; i++) {
    const rOut = R - i * gap - (i - 1) * prof;
    const rIn = rOut - prof;
    if (rIn <= springY * 0.1) break;
    const halfOut = halfChordAtSpring(rOut, springY, cy);
    const halfIn = halfChordAtSpring(rIn, springY, cy);
    if (halfOut <= 8 || halfIn <= 4) continue;
    paths.push(
      `M ${cx - halfOut} ${springY} A ${rOut} ${rOut} 0 0 0 ${cx + halfOut} ${springY} ` +
        `L ${cx + halfIn} ${springY} A ${rIn} ${rIn} 0 0 1 ${cx - halfIn} ${springY} Z`,
    );
  }
  return paths;
}

/** @deprecated use archInnerRingBandPaths */
export function archInnerRingArcPaths(
  innerW: number,
  springY: number,
  ringCount: number,
  gapMm: number,
  profileMm: number,
): string[] {
  return archInnerRingBandPaths(innerW, springY, ringCount, gapMm, profileMm);
}

export function resolveArchInnerRingGapMm(outline: CasementOutlineConfig): number {
  const raw = outline.archInnerRingGapMm;
  if (raw !== '' && Number.isFinite(Number(raw)) && Number(raw) > 0) {
    return Math.max(4, Number(raw));
  }
  return 16;
}

/** Central angle (rad) of the outer arch from spring left to spring right. */
export function archCentralAngleRad(innerW: number, springY: number): number {
  const R = archRadiusMm(innerW, springY);
  if (R <= 0 || innerW <= 0 || springY <= 0) return 0;
  const cx = innerW / 2;
  const cy = R;
  const a1 = Math.atan2(springY - cy, -cx);
  const a2 = Math.atan2(springY - cy, cx);
  let theta = a2 - a1;
  while (theta <= 0) theta += Math.PI * 2;
  return theta;
}

export function archSemicircleArcLengthMm(innerW: number, springY: number): number {
  const R = archRadiusMm(innerW, springY);
  return R * archCentralAngleRad(innerW, springY);
}

export function archHeadGlassAreaMm2(innerW: number, springY: number): number {
  const R = archRadiusMm(innerW, springY);
  if (R <= 0) return 0;
  const theta = archCentralAngleRad(innerW, springY);
  return (R * R / 2) * (theta - Math.sin(theta));
}

/** Outer radius of inner ring i (1-based). */
export function archInnerRingOuterRadiusMm(
  innerW: number,
  springY: number,
  ringIndex: number,
  gapMm: number,
  profileMm: number,
): number {
  const R = archRadiusMm(innerW, springY);
  const gap = Math.max(4, gapMm);
  const prof = Math.max(4, profileMm);
  return R - ringIndex * gap - (ringIndex - 1) * prof;
}

export function archInnerRingArcLengthMm(
  innerW: number,
  springY: number,
  ringIndex: number,
  gapMm: number,
  profileMm: number,
): number {
  const r = archInnerRingOuterRadiusMm(innerW, springY, ringIndex, gapMm, profileMm);
  if (r <= springY * 0.1) return 0;
  return r * archCentralAngleRad(innerW, springY);
}

/** Visible semicircular ring strokes (same curve family as outer arch). */
export function archInnerRingStrokeSegments(
  innerW: number,
  springY: number,
  ringCount: number,
  gapMm: number,
  profileMm: number,
): { d: string; strokeWidth: number }[] {
  const n = Math.max(0, Math.min(2, Math.round(ringCount)));
  if (n <= 0 || innerW <= 0 || springY <= 0) return [];
  const cx = innerW / 2;
  const cy = archRadiusMm(innerW, springY);
  const prof = Math.max(4, profileMm);
  const out: { d: string; strokeWidth: number }[] = [];
  for (let i = 1; i <= n; i++) {
    const rOuter = archInnerRingOuterRadiusMm(innerW, springY, i, gapMm, prof);
    if (rOuter <= prof * 2) break;
    const half = halfChordAtSpring(rOuter, springY, cy);
    if (half <= 8) continue;
    out.push({
      d: `M ${cx - half} ${springY} A ${rOuter} ${rOuter} 0 0 0 ${cx + half} ${springY}`,
      strokeWidth: prof,
    });
  }
  return out;
}

/** CSS clip-path path() for arch-head glass (px coords). */
export function archHeadClipPathCss(innerW: number, springY: number, scale: number): string {
  if (springY <= 0) return '';
  const wPx = innerW * scale;
  const syPx = springY * scale;
  const rPx = archRadiusMm(innerW, springY) * scale;
  return `path('M 0 ${syPx} A ${rPx} ${rPx} 0 0 0 ${wPx} ${syPx} Z')`;
}

export function archTopFramePathD(innerW: number, springY: number, frameMm: number): string {
  const r = Math.max(0, archRadiusMm(innerW, springY) - frameMm);
  return `M ${frameMm} ${springY} A ${r} ${r} 0 0 1 ${innerW - frameMm} ${springY}`;
}

/** SVG even-odd ring: outer window boundary minus inner opening (arch-top). */
export function archOuterFrameProfileLengthsMm(
  windowW: number,
  windowH: number,
  holeY: number,
  springYInner: number,
): { bottomMm: number; verticalMm: number; archMm: number } {
  const sy = holeY + springYInner;
  const verticalMm = Math.max(0, windowH - sy);
  return {
    bottomMm: windowW,
    verticalMm,
    archMm: archSemicircleArcLengthMm(windowW, sy),
  };
}

/** SVG even-odd ring: outer window boundary minus inner opening (arch-top). */
export function buildArchOuterFrameRingD(
  windowW: number,
  windowH: number,
  holeX: number,
  holeY: number,
  innerW: number,
  innerH: number,
  springY: number,
): string {
  const sy = holeY + springY;
  const ri = archRadiusMm(innerW, springY);
  const ro = archRadiusMm(windowW, sy);
  const outer = `M 0 ${windowH} L ${windowW} ${windowH} L ${windowW} ${sy} A ${ro} ${ro} 0 0 0 0 ${sy} Z`;
  const inner = `M ${holeX} ${sy} L ${holeX} ${holeY + innerH} L ${holeX + innerW} ${holeY + innerH} L ${holeX + innerW} ${sy} A ${ri} ${ri} 0 0 0 ${holeX} ${sy} Z`;
  return `${outer} ${inner}`;
}

/** SVG even-odd ring for rounded opening. */
export function buildRoundedOuterFrameRingD(
  windowW: number,
  windowH: number,
  holeX: number,
  holeY: number,
  innerW: number,
  innerH: number,
  cornerMm: number,
  shape: 'rounded_rect' | 'rounded_top' | 'rounded_bottom',
): string {
  const rIn = Math.min(cornerMm, innerW / 2, innerH / 2);
  const rOut = rIn + Math.min(holeX, holeY, windowW - holeX - innerW, windowH - holeY - innerH);
  const tl = shape !== 'rounded_bottom' ? rOut : 0;
  const tr = shape !== 'rounded_bottom' ? rOut : 0;
  const br = shape !== 'rounded_top' ? rOut : 0;
  const bl = shape !== 'rounded_top' ? rOut : 0;
  const itl = shape !== 'rounded_bottom' ? rIn : 0;
  const itr = shape !== 'rounded_bottom' ? rIn : 0;
  const ibr = shape !== 'rounded_top' ? rIn : 0;
  const ibl = shape !== 'rounded_top' ? rIn : 0;
  const outer = `M ${bl} ${windowH} L ${windowW - br} ${windowH} Q ${windowW} ${windowH} ${windowW} ${windowH - br} L ${windowW} ${tl} Q ${windowW} 0 ${windowW - tr} 0 L ${tl} 0 Q 0 0 0 ${tl} L 0 ${windowH - bl} Q 0 ${windowH} ${bl} ${windowH} Z`;
  const ix = holeX;
  const iy = holeY;
  const iw = innerW;
  const ih = innerH;
  const inner = `M ${ix + ibl} ${iy + ih} L ${ix + iw - ibr} ${iy + ih} Q ${ix + iw} ${iy + ih} ${ix + iw} ${iy + ih - ibr} L ${ix + iw} ${iy + itl} Q ${ix + iw} ${iy} ${ix + iw - itr} ${iy} L ${ix + itl} ${iy} Q ${ix} ${iy} ${ix} ${iy + itl} L ${ix} ${iy + ih - ibl} Q ${ix} ${iy + ih} ${ix + ibl} ${iy + ih} Z`;
  return `${outer} ${inner}`;
}

export function needsShapedOuterFrame(config: WindowConfig): boolean {
  const s = resolveCasementOutline(config).shape;
  return s !== 'rect';
}

/** Relative spring position for grid row 0 (fixed arch zone). */
export function archSpringRatio(config: WindowConfig, innerW: number, innerH: number): number {
  return archSpringYMmForOpening(config, innerW, innerH) / Math.max(innerH, 1);
}

export function syncArchSpringDivider(config: WindowConfig, innerW: number, innerH: number): number[] {
  const h = [...(config.horizontalDividers ?? [])];
  const spring = idealArchSpringRatio(innerW, innerH);
  if (config.horizontalDividers?.[0] == null) {
    if (h.length === 0) h.push(spring);
    else h[0] = spring;
  }
  return h;
}

export function buildArchGridHorizontalDividers(
  rows: number,
  config: WindowConfig,
  innerW: number,
  innerH: number,
): number[] {
  if (rows <= 1) return [];
  const springR = archSpringRatio(config, innerW, innerH);
  const dividers: number[] = [];
  for (let i = 0; i < rows - 1; i++) {
    dividers.push(
      i === 0 ? springR : springR + (i / (rows - 1)) * (1 - springR),
    );
  }
  return dividers;
}

export function applyCasementDTypePreset(
  cols: 1 | 2 = 1,
  innerW = 0,
  innerH = 0,
): Partial<WindowConfig> {
  const straightBottom =
    innerW > 0 && innerH > 0 ? defaultArchStraightBottomMm(innerW, innerH) : '';
  const springR =
    innerW > 0 && innerH > 0
      ? archSpringYMmForOpening(
          {
            ...( {} as WindowConfig),
            casementOutline: {
              ...DEFAULT_CASEMENT_OUTLINE,
              shape: 'arch_top',
              archStraightBottomMm: straightBottom,
            },
            horizontalDividers: [],
          },
          innerW,
          innerH,
        ) / innerH
      : 0.28;
  const doorPositions =
    cols === 2
      ? [
          { row: 1, col: 0 },
          { row: 1, col: 1 },
        ]
      : [{ row: 1, col: 0 }];
  return {
    casementOutline: {
      shape: 'arch_top',
      cornerRadiusMm: 40,
      archStraightBottomMm: straightBottom,
      archSpringRatio: springR,
      archRadialMullions: 2,
      archMullionAngles: [135, 90, 45],
    },
    horizontalDividers: [springR],
    verticalDividers: cols === 2 ? [0.5] : [],
    doorPositions,
  };
}

/** Effective corner inset (mm) for band mullions — matches outer frame rounding. */
export function roundedCornerInsetMm(config: WindowConfig, innerW: number, innerH: number): number {
  const r = Number(resolveCasementOutline(config).cornerRadiusMm) || 40;
  return Math.max(16, Math.min(r, innerW / 2 - 1, innerH / 2 - 1));
}

export function roundedBandDividerRatios(
  config: WindowConfig,
  innerW: number,
  innerH: number,
): { vertical: number[]; horizontal: number[]; minRows: number; minCols: number } {
  const shape = resolveCasementOutline(config).shape;
  const inset = roundedCornerInsetMm(config, innerW, innerH);
  const vx = inset / Math.max(innerW, 1);
  const vy = inset / Math.max(innerH, 1);
  const vertical: number[] = [];
  const horizontal: number[] = [];
  let minRows = 1;
  let minCols = 1;

  if (shape === 'rounded_rect') {
    vertical.push(vx, 1 - vx);
    horizontal.push(vy, 1 - vy);
    minRows = 3;
    minCols = 3;
  } else if (shape === 'rounded_top') {
    vertical.push(vx, 1 - vx);
    horizontal.push(vy);
    minRows = 2;
    minCols = 3;
  } else if (shape === 'rounded_bottom') {
    vertical.push(vx, 1 - vx);
    horizontal.push(1 - vy);
    minRows = 2;
    minCols = 3;
  }

  horizontal.sort((a, b) => a - b);
  vertical.sort((a, b) => a - b);
  return { vertical, horizontal, minRows, minCols };
}

/** Fixed band around rounded corners — doors / operable panels cannot sit here. */
export function isOutlineBandCell(
  config: CasementOutlineHost,
  row: number,
  col: number,
  gridRows: number,
  gridCols: number,
): boolean {
  const shape = resolveCasementOutline(config).shape;
  if (shape === 'arch_top') return row === 0;
  if (shape === 'rect') return false;

  const lastRow = gridRows - 1;
  const lastCol = gridCols - 1;

  if (shape === 'rounded_rect') {
    return row === 0 || row === lastRow || col === 0 || col === lastCol;
  }
  if (shape === 'rounded_top') {
    return row === 0 || col === 0 || col === lastCol;
  }
  if (shape === 'rounded_bottom') {
    return row === lastRow || col === 0 || col === lastCol;
  }
  return false;
}

export function filterDoorsToOperableZone(
  config: WindowConfig,
  doorPositions: WindowConfig['doorPositions'],
  gridRows: number,
  gridCols: number,
): WindowConfig['doorPositions'] {
  return doorPositions.filter(
    (p) => !isOutlineBandCell(config, p.row, p.col, gridRows, gridCols),
  );
}

/** Auto band mullions + minimum grid so rounding is separated from operable centre. */
export function applyRoundedBandLayout(
  config: WindowConfig,
  innerW: number,
  innerH: number,
): Pick<WindowConfig, 'horizontalDividers' | 'verticalDividers' | 'doorPositions'> & {
  gridRows: number;
  gridCols: number;
} {
  const { vertical, horizontal, minRows, minCols } = roundedBandDividerRatios(config, innerW, innerH);
  const gridRows = Math.max(minRows, horizontal.length + 1);
  const gridCols = Math.max(minCols, vertical.length + 1);
  return {
    horizontalDividers: horizontal,
    verticalDividers: vertical,
    doorPositions: filterDoorsToOperableZone(config, config.doorPositions, gridRows, gridCols),
    gridRows,
    gridCols,
  };
}

export function applyCasementRoundedPreset(innerW = 0, innerH = 0): Partial<WindowConfig> {
  const casementOutline = {
    shape: 'rounded_rect' as const,
    cornerRadiusMm: 152,
    archSpringRatio: 0.28,
    archRadialMullions: 0,
    archMullionAngles: [] as number[],
  };
  if (innerW <= 0 || innerH <= 0) {
    return { casementOutline };
  }
  const band = applyRoundedBandLayout({ ...({} as WindowConfig), casementOutline, doorPositions: [] }, innerW, innerH);
  return {
    casementOutline,
    horizontalDividers: band.horizontalDividers,
    verticalDividers: band.verticalDividers,
    doorPositions: [],
  };
}
