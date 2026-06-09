import { AreaType } from '../types';
import type {
  DesignLayoutActiveUnit,
  DesignLayoutCrossAlign,
  DesignLayoutSession,
  DesignLayoutSide,
  DesignLayoutUnit,
  WindowConfig,
} from '../types';
import { v4 as uuidv4 } from 'uuid';
import { getWindowQuotationAreaMm2 } from './louverBays';

export interface LayoutUnitPlacement {
  id: string;
  title: string;
  config: WindowConfig;
  xMm: number;
  yMm: number;
  widthMm: number;
  heightMm: number;
  anchorUnitId: DesignLayoutActiveUnit;
  side: DesignLayoutSide;
  gapMm: number;
}

function resolveOffsetMm(raw: number | '' | undefined): number | undefined {
  if (raw === '' || raw === undefined) return undefined;
  const n = Number(raw);
  return Number.isFinite(n) ? n : undefined;
}

/** Cross-axis start (mm) along anchor edge when attaching a unit. */
export function layoutCrossAxisStart(
  anchorCrossMm: number,
  unitCrossMm: number,
  align: DesignLayoutCrossAlign | undefined,
  offsetMm: number | '' | undefined,
): number {
  const maxStart = Math.max(0, anchorCrossMm - unitCrossMm);
  const off = resolveOffsetMm(offsetMm);
  if (off !== undefined) return Math.max(0, Math.min(off, maxStart));
  const a = align ?? 'top';
  if (a === 'top') return 0;
  if (a === 'bottom') return maxStart;
  return maxStart / 2;
}

/** Migrate legacy horizontal-chain fields to anchor/side model. */
export function normalizeLayoutUnit(
  unit: DesignLayoutUnit,
  index: number,
  priorCompanionIds: string[],
): DesignLayoutUnit {
  if (unit.anchorUnitId && unit.side) {
    return {
      ...unit,
      gapMm: Number(unit.gapMm) || 0,
      crossAlign: unit.crossAlign ?? 'top',
    };
  }

  const anchorUnitId: DesignLayoutActiveUnit =
    index === 0 ? 'primary' : priorCompanionIds[index - 1] ?? 'primary';
  const legacyOffset = Number(unit.offsetTopFromPrimaryMm) || 0;

  return {
    ...unit,
    anchorUnitId,
    side: 'right',
    gapMm: Number(unit.gapFromPrevMm) || 50,
    crossAlign: 'top',
    crossOffsetMm: legacyOffset !== 0 ? legacyOffset : '',
  };
}

export function cloneWindowConfigForLayout(config: WindowConfig): WindowConfig {
  return structuredClone(config);
}

/** Fields kept in sync from Window 1 (primary) across all layout units. */
const APPEARANCE_KEYS = [
  'profileColor',
  'profileTexture',
  'glassTexture',
  'glassThickness',
  'glassType',
  'glassSpecialType',
  'customGlassName',
  'laminatedGlassConfig',
  'dguGlassConfig',
] as const;

/** Copy frame colour, glass, and series from primary onto another unit config. */
export function applyAppearanceFromPrimary(primary: WindowConfig, target: WindowConfig): WindowConfig {
  const next = structuredClone(target);
  for (const key of APPEARANCE_KEYS) {
    (next as Record<string, unknown>)[key] = structuredClone(
      (primary as Record<string, unknown>)[key],
    );
  }
  if (primary.series) {
    next.series = primary.series;
  }
  return next;
}

export function appearanceFingerprint(config: WindowConfig): string {
  const slice: Record<string, unknown> = {};
  for (const key of APPEARANCE_KEYS) {
    slice[key] = (config as Record<string, unknown>)[key];
  }
  slice.seriesId = config.series?.id ?? '';
  return JSON.stringify(slice);
}

/**
 * When several units share the same anchor + side (e.g. all "right of Window 1"),
 * chain them sequentially so they sit side-by-side instead of overlapping.
 */
export function resolveChainedAnchorId(
  companions: DesignLayoutUnit[],
  index: number,
  priorIds: string[],
): DesignLayoutActiveUnit {
  const c = normalizeLayoutUnit(companions[index], index, priorIds);
  const rootId = c.anchorUnitId;
  const side = c.side ?? 'right';
  let chainTip: DesignLayoutActiveUnit = rootId;

  for (let j = 0; j < index; j++) {
    const pj = normalizeLayoutUnit(companions[j], j, priorIds.slice(0, j));
    if (pj.side !== side) continue;
    if (pj.anchorUnitId === rootId || pj.anchorUnitId === chainTip) {
      chainTip = pj.id;
    }
  }

  return chainTip;
}

/** Last unit in the layout row — default attach target for new copies. */
export function lastLayoutUnitId(
  companions: DesignLayoutUnit[],
): DesignLayoutActiveUnit {
  if (companions.length === 0) return 'primary';
  return companions[companions.length - 1].id;
}

export function computeLayoutPlacements(
  primary: WindowConfig,
  primaryTitle: string,
  companions: DesignLayoutUnit[],
): LayoutUnitPlacement[] {
  const primaryW = Number(primary.width) || 0;
  const primaryH = Number(primary.height) || 0;
  const byId = new Map<string, LayoutUnitPlacement>();

  byId.set('primary', {
    id: 'primary',
    title: primaryTitle || 'Window 1',
    config: primary,
    xMm: 0,
    yMm: 0,
    widthMm: primaryW,
    heightMm: primaryH,
    anchorUnitId: 'primary',
    side: 'right',
    gapMm: 0,
  });

  const priorIds: string[] = [];

  for (let i = 0; i < companions.length; i++) {
    const c = normalizeLayoutUnit(companions[i], i, priorIds);
    const effectiveAnchorId = resolveChainedAnchorId(companions, i, priorIds);
    const anchor = byId.get(effectiveAnchorId);
    if (!anchor) continue;

    const w = Number(c.config.width) || 0;
    const h = Number(c.config.height) || 0;
    const gap = Number(c.gapMm) || 0;
    let xMm = 0;
    let yMm = 0;

    switch (c.side) {
      case 'right':
        xMm = anchor.xMm + anchor.widthMm + gap;
        yMm = anchor.yMm + layoutCrossAxisStart(anchor.heightMm, h, c.crossAlign, c.crossOffsetMm);
        break;
      case 'left':
        xMm = anchor.xMm - gap - w;
        yMm = anchor.yMm + layoutCrossAxisStart(anchor.heightMm, h, c.crossAlign, c.crossOffsetMm);
        break;
      case 'bottom':
        yMm = anchor.yMm + anchor.heightMm + gap;
        xMm = anchor.xMm + layoutCrossAxisStart(anchor.widthMm, w, c.crossAlign, c.crossOffsetMm);
        break;
      case 'top':
        yMm = anchor.yMm - gap - h;
        xMm = anchor.xMm + layoutCrossAxisStart(anchor.widthMm, w, c.crossAlign, c.crossOffsetMm);
        break;
    }

    byId.set(c.id, {
      id: c.id,
      title: c.title,
      config: c.config,
      xMm,
      yMm,
      widthMm: w,
      heightMm: h,
      anchorUnitId: c.anchorUnitId,
      side: c.side,
      gapMm: gap,
    });
    priorIds.push(c.id);
  }

  const ordered: LayoutUnitPlacement[] = [byId.get('primary')!];
  for (const c of companions) {
    const p = byId.get(c.id);
    if (p) ordered.push(p);
  }
  return ordered;
}

export function layoutBounds(units: LayoutUnitPlacement[]) {
  let minX = 0;
  let minY = 0;
  let maxX = 0;
  let maxY = 0;
  for (const u of units) {
    minX = Math.min(minX, u.xMm);
    minY = Math.min(minY, u.yMm);
    maxX = Math.max(maxX, u.xMm + u.widthMm);
    maxY = Math.max(maxY, u.yMm + u.heightMm);
  }
  return {
    minXMm: minX,
    minYMm: minY,
    widthMm: maxX - minX,
    heightMm: maxY - minY,
  };
}

export function resolveUnitConfig(
  unitId: DesignLayoutActiveUnit,
  primary: WindowConfig,
  companions: DesignLayoutUnit[],
): WindowConfig {
  if (unitId === 'primary') return primary;
  return companions.find((c) => c.id === unitId)?.config ?? primary;
}

export const DEFAULT_LAYOUT_PRIMARY_TITLE = 'Window 1';

export function layoutPrimaryLabel(title: string | undefined | null): string {
  const t = String(title ?? '').trim();
  return t || DEFAULT_LAYOUT_PRIMARY_TITLE;
}

export function isGenericWindowNumberTitle(title: string): boolean {
  return /^window\s*\d+$/i.test(title.trim());
}

/** Companion unit title (2, 3, …) derived from the primary window tag. */
export function layoutCompanionDefaultTitle(primaryTitle: string, unitNumber: number): string {
  const base = layoutPrimaryLabel(primaryTitle);
  if (isGenericWindowNumberTitle(base)) {
    return `Window ${unitNumber}`;
  }
  return `${base} ${unitNumber}`;
}

/** Lowercase plural label for combined package subtitle (e.g. shower partitions). */
export function layoutCombinedGroupLabel(primaryTitle: string): string {
  const base = layoutPrimaryLabel(primaryTitle);
  if (isGenericWindowNumberTitle(base)) return 'façade';
  const lower = base.toLowerCase();
  return lower.endsWith('s') ? lower : `${lower}s`;
}

export function layoutCombinedLayoutRowLabel(primaryTitle: string): string {
  if (layoutCombinedGroupLabel(primaryTitle) === 'façade') return 'Façade layout';
  return 'Combined layout';
}

/** Rename generic Window 2/3… copies to match a custom primary tag. */
export function syncLayoutCompanionTitles(
  primaryTitle: string,
  companions: DesignLayoutUnit[],
): DesignLayoutUnit[] {
  return companions.map((c, i) => {
    if (isGenericWindowNumberTitle(c.title)) {
      return { ...c, title: layoutCompanionDefaultTitle(primaryTitle, i + 2) };
    }
    return c;
  });
}

export function newLayoutUnitFromConfig(
  config: WindowConfig,
  index: number,
  primaryTitle: string = DEFAULT_LAYOUT_PRIMARY_TITLE,
  anchorUnitId: DesignLayoutActiveUnit = 'primary',
  side: DesignLayoutSide = 'right',
  crossAlign: DesignLayoutCrossAlign = 'top',
): DesignLayoutUnit {
  return {
    id: uuidv4(),
    title: layoutCompanionDefaultTitle(primaryTitle, index + 2),
    config: cloneWindowConfigForLayout(config),
    anchorUnitId,
    side,
    gapMm: 0,
    crossAlign,
    crossOffsetMm: '',
    rate: '',
  };
}

export function resolveLayoutUnitRate(
  unitId: DesignLayoutActiveUnit,
  globalRate: number,
  companions: DesignLayoutUnit[],
): number {
  if (unitId === 'primary') return globalRate;
  const c = companions.find((x) => x.id === unitId);
  const raw = c?.rate;
  if (raw !== '' && raw !== undefined && Number.isFinite(Number(raw))) return Number(raw);
  return globalRate;
}

export type LayoutEstimateRow = {
  id: DesignLayoutActiveUnit;
  title: string;
  width: number;
  height: number;
  areaMm2: number;
  rate: number;
  hardwareCost: number;
  hasCustomRate: boolean;
  /** Raw per-unit rate field (empty = use global default). */
  customRateRaw: number | '';
};

export function computeLayoutEstimateRows(
  placements: LayoutUnitPlacement[],
  companions: DesignLayoutUnit[],
  globalRate: number,
  hardwareCostFor: (cfg: WindowConfig) => number,
): LayoutEstimateRow[] {
  return placements.map((p) => {
    const areaMm2 = getWindowQuotationAreaMm2(p.config);
    const unitRate = resolveLayoutUnitRate(p.id, globalRate, companions);
    const companion = companions.find((c) => c.id === p.id);
    const customRateRaw = p.id === 'primary' ? '' : (companion?.rate ?? '');
    const custom = customRateRaw !== '';
    return {
      id: p.id,
      title: p.title,
      width: Number(p.config.width) || 0,
      height: Number(p.config.height) || 0,
      areaMm2,
      rate: unitRate,
      hardwareCost: hardwareCostFor(p.config),
      hasCustomRate: custom,
      customRateRaw,
    };
  });
}

export function layoutEstimateTotals(
  rows: LayoutEstimateRow[],
  areaType: AreaType,
  quantity: number,
): { totalArea: number; baseCost: number; hardwareCost: number; totalCost: number } {
  const conversionFactor = areaType === AreaType.SQMT ? 1000 : 304.8;
  const div = conversionFactor * conversionFactor;
  const qty = Math.max(0, quantity);
  let totalArea = 0;
  let baseCost = 0;
  let hardwareCost = 0;
  for (const row of rows) {
    const singleArea = row.areaMm2 / div;
    totalArea += singleArea * qty;
    baseCost += singleArea * qty * row.rate;
    hardwareCost += row.hardwareCost * qty;
  }
  return { totalArea, baseCost, hardwareCost, totalCost: baseCost + hardwareCost };
}

/** Human label for combined façade shape. */
export function describeLayoutShape(units: LayoutUnitPlacement[]): string {
  if (units.length <= 1) return 'Single window';
  const bounds = layoutBounds(units);
  const sumArea = units.reduce((s, u) => s + u.widthMm * u.heightMm, 0);
  const bboxArea = bounds.widthMm * bounds.heightMm;
  const yKeys = new Set(units.map((u) => Math.round(u.yMm / 10)));
  const xKeys = new Set(units.map((u) => Math.round(u.xMm / 10)));

  if (sumArea < bboxArea * 0.92 && yKeys.size > 1 && xKeys.size > 1) {
    return 'L-shape / stepped';
  }
  if (yKeys.size === 1 && xKeys.size > 1) return 'Straight row';
  if (xKeys.size === 1 && yKeys.size > 1) return 'Vertical stack';
  if (yKeys.size > 1 || xKeys.size > 1) return 'Combined layout';
  return 'Straight row';
}

/** Valid anchor targets for companion at list index (no forward references). */
export function layoutAnchorOptions(
  primaryTitle: string,
  companions: DesignLayoutUnit[],
  unitIndex: number,
): { id: DesignLayoutActiveUnit; label: string }[] {
  const options: { id: DesignLayoutActiveUnit; label: string }[] = [
    { id: 'primary', label: `${primaryTitle || 'Window 1'} (primary)` },
  ];
  for (let i = 0; i < unitIndex; i++) {
    options.push({ id: companions[i].id, label: companions[i].title });
  }
  return options;
}

export function crossAlignLabel(side: DesignLayoutSide): { axis: string; top: string; center: string; bottom: string } {
  const vertical = side === 'left' || side === 'right';
  return vertical
    ? { axis: 'Height align', top: 'Top', center: 'Middle', bottom: 'Bottom' }
    : { axis: 'Width align', top: 'Left', center: 'Center', bottom: 'Right' };
}

const LAYOUT_STORAGE_KEY = 'woodenmax-design-layout';

export function sanitizeLayoutCompanions(companions: DesignLayoutUnit[]): DesignLayoutUnit[] {
  const priorIds: string[] = [];
  const out: DesignLayoutUnit[] = [];
  for (let i = 0; i < companions.length; i++) {
    const normalized = normalizeLayoutUnit(companions[i], i, priorIds);
    out.push(normalized);
    priorIds.push(normalized.id);
  }
  return out;
}

export function loadDesignLayoutSession(): DesignLayoutSession | null {
  try {
    const raw = window.localStorage.getItem(LAYOUT_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as DesignLayoutSession;
    if (!parsed || !Array.isArray(parsed.companions)) return null;
    const companions = sanitizeLayoutCompanions(parsed.companions);
    const activeUnitId = parsed.activeUnitId ?? 'primary';
    const activeOk =
      activeUnitId === 'primary' || companions.some((c) => c.id === activeUnitId);
    return {
      companions,
      activeUnitId: activeOk ? activeUnitId : 'primary',
    };
  } catch {
    return null;
  }
}

export function saveDesignLayoutSession(session: DesignLayoutSession): void {
  try {
    window.localStorage.setItem(LAYOUT_STORAGE_KEY, JSON.stringify(session));
  } catch {
    /* ignore quota */
  }
}

export function clearDesignLayoutSession(): void {
  try {
    window.localStorage.removeItem(LAYOUT_STORAGE_KEY);
  } catch {
    /* ignore */
  }
}
