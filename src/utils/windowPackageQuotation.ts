import { v4 as uuidv4 } from 'uuid';
import type {
  AreaType,
  DesignLayoutCrossAlign,
  DesignLayoutSide,
  DesignLayoutUnit,
  HardwareItem,
  SavedColor,
  WindowConfig,
  WindowPackageQuotationItem,
  WindowPackageUnitLine,
  WindowQuotationItem,
} from '../types';
import type { LayoutUnitPlacement } from './designLayout';
import {
  cloneWindowConfigForLayout,
  layoutBounds,
  layoutCombinedGroupLabel,
  layoutCombinedLayoutRowLabel,
  layoutCompanionDefaultTitle,
  isGenericWindowNumberTitle,
  layoutCrossAxisStart,
  resolveLayoutUnitRate,
} from './designLayout';
import { getWindowQuotationAreaMm2 } from './louverBays';
import { resolveProfileColorLabel } from './profileColorLabel';
import { AreaType as AT } from '../types';

export function isWindowPackageQuotationItem(
  item: { kind?: string },
): item is WindowPackageQuotationItem {
  return item.kind === 'window_package';
}

const LEGACY_PACKAGE_TITLE_SUFFIX = ' — Façade package';

function packagePrimaryUnit(item: WindowPackageQuotationItem): WindowPackageUnitLine {
  return item.units.find((u) => u.id === 'primary') ?? item.units[0];
}

function packagePrimaryTitle(item: WindowPackageQuotationItem): string {
  return packagePrimaryUnit(item).title;
}

/** Fix legacy saved titles (package suffix + generic Window 2/3… copies). */
export function normalizeWindowPackageItem(
  item: WindowPackageQuotationItem,
): WindowPackageQuotationItem {
  const primaryTitle = packagePrimaryTitle(item);
  let title = item.title;
  if (title.endsWith(LEGACY_PACKAGE_TITLE_SUFFIX)) {
    title = primaryTitle;
  }

  let unitsChanged = false;
  const units = item.units.map((u, idx) => {
    if (u.id === 'primary') return u;
    if (isGenericWindowNumberTitle(u.title) && !isGenericWindowNumberTitle(primaryTitle)) {
      unitsChanged = true;
      return { ...u, title: layoutCompanionDefaultTitle(primaryTitle, idx + 1) };
    }
    return u;
  });

  if (title === item.title && !unitsChanged) return item;
  return { ...item, title, units };
}

export function packageCombinedSubtitle(item: WindowPackageQuotationItem): string {
  const group = layoutCombinedGroupLabel(packagePrimaryTitle(item));
  return `Combined ${group} · ${item.units.length} units · layout ${Math.round(item.layoutWidthMm)}×${Math.round(item.layoutHeightMm)} mm`;
}

export function packageLayoutRowLabel(item: WindowPackageQuotationItem): string {
  return layoutCombinedLayoutRowLabel(packagePrimaryTitle(item));
}

export function packageQuotationSubtotal(
  item: WindowPackageQuotationItem,
): number {
  const cf = item.areaType === AT.SQMT ? 1000 : 304.8;
  const div = cf * cf;
  const qty = Number(item.quantity) || 0;
  let total = 0;
  for (const u of item.units) {
    const area = (getWindowQuotationAreaMm2(u.config) / div) * qty;
    total += area * (Number(u.rate) || 0) + (Number(u.hardwareCost) || 0) * qty;
  }
  return total;
}

export function packageCombinedArea(
  item: WindowPackageQuotationItem,
): number {
  const cf = item.areaType === AT.SQMT ? 1000 : 304.8;
  const div = cf * cf;
  const qty = Number(item.quantity) || 0;
  return item.units.reduce(
    (s, u) => s + (getWindowQuotationAreaMm2(u.config) / div) * qty,
    0,
  );
}

/** Expand package into window lines for material costing / BOM. */
export function expandPackageToWindowItems(
  item: WindowPackageQuotationItem,
): WindowQuotationItem[] {
  const packageTitle = item.title;
  return item.units.map((u) => ({
    kind: 'window' as const,
    id: `${item.id}__${u.id}`,
    title: `${packageTitle} — ${u.title}`,
    config: u.config,
    quantity: item.quantity,
    areaType: item.areaType,
    rate: u.rate,
    hardwareCost: u.hardwareCost,
    hardwareItems: u.hardwareItems,
    profileColorName: u.profileColorName,
  }));
}

function inferCrossFromStart(
  anchorCross: number,
  unitCross: number,
  crossStart: number,
): { crossAlign: DesignLayoutCrossAlign; crossOffsetMm: number | '' } {
  const maxStart = Math.max(0, anchorCross - unitCross);
  const tol = 1.5;
  if (crossStart < -tol) {
    return { crossAlign: 'top', crossOffsetMm: 0 };
  }
  if (Math.abs(crossStart) <= tol) {
    return { crossAlign: 'top', crossOffsetMm: '' };
  }
  if (Math.abs(crossStart - maxStart) <= tol) {
    return { crossAlign: 'bottom', crossOffsetMm: '' };
  }
  if (maxStart > 0 && Math.abs(crossStart - maxStart / 2) <= tol) {
    return { crossAlign: 'center', crossOffsetMm: '' };
  }
  return {
    crossAlign: 'top',
    crossOffsetMm: Math.max(0, Math.min(Math.round(crossStart), maxStart)),
  };
}

function inferLayoutAttachment(
  unit: WindowPackageUnitLine,
  anchors: WindowPackageUnitLine[],
): {
  anchorId: string;
  side: DesignLayoutSide;
  gapMm: number;
  crossAlign: DesignLayoutCrossAlign;
  crossOffsetMm: number | '';
} {
  const ux = unit.xMm;
  const uy = unit.yMm;
  const uw = unit.widthMm;
  const uh = unit.heightMm;
  const tol = 2;
  let best = {
    anchorId: anchors[anchors.length - 1]?.id ?? 'primary',
    side: 'right' as DesignLayoutSide,
    gapMm: 0,
    crossAlign: 'top' as DesignLayoutCrossAlign,
    crossOffsetMm: '' as number | '',
    error: Infinity,
  };

  for (const anchor of anchors) {
    const ax = anchor.xMm;
    const ay = anchor.yMm;
    const aw = anchor.widthMm;
    const ah = anchor.heightMm;

    const candidates: Array<{
      side: DesignLayoutSide;
      gap: number;
      crossStart: number;
      anchorCross: number;
      unitCross: number;
    }> = [
      { side: 'right', gap: ux - ax - aw, crossStart: uy - ay, anchorCross: ah, unitCross: uh },
      { side: 'left', gap: ax - ux - uw, crossStart: uy - ay, anchorCross: ah, unitCross: uh },
      { side: 'bottom', gap: uy - ay - ah, crossStart: ux - ax, anchorCross: aw, unitCross: uw },
      { side: 'top', gap: ay - uy - uh, crossStart: ux - ax, anchorCross: aw, unitCross: uw },
    ];

    for (const c of candidates) {
      const { crossAlign, crossOffsetMm } = inferCrossFromStart(
        c.anchorCross,
        c.unitCross,
        c.crossStart,
      );
      const expectedCross =
        c.side === 'right' || c.side === 'left'
          ? ay + layoutCrossAxisStart(c.anchorCross, c.unitCross, crossAlign, crossOffsetMm)
          : ax + layoutCrossAxisStart(c.anchorCross, c.unitCross, crossAlign, crossOffsetMm);
      const actualCross = c.side === 'right' || c.side === 'left' ? uy : ux;
      const err =
        (c.gap < -tol ? 10000 : 0) +
        Math.abs(actualCross - expectedCross) +
        (c.gap < 0 ? Math.abs(c.gap) : 0);
      if (err < best.error) {
        best = {
          anchorId: anchor.id,
          side: c.side,
          gapMm: Math.max(0, Math.round(c.gap)),
          crossAlign,
          crossOffsetMm,
          error: err,
        };
      }
    }
  }

  return best;
}

/** Restore multi-window layout session from a saved façade package. */
export function reconstructDesignLayoutFromPackage(item: WindowPackageQuotationItem): {
  primaryTitle: string;
  primaryConfig: WindowConfig;
  primaryRate: number;
  primaryHardwareItems: HardwareItem[];
  companions: DesignLayoutUnit[];
} {
  if (item.units.length === 0) {
    throw new Error('Package has no units');
  }

  const primaryUnit = item.units.find((u) => u.id === 'primary') ?? item.units[0];
  const others = item.units.filter((u) => u.id !== primaryUnit.id);
  const placed: WindowPackageUnitLine[] = [primaryUnit];
  const companions: DesignLayoutUnit[] = [];

  for (const unit of others) {
    const attach = inferLayoutAttachment(unit, placed);
    companions.push({
      id: unit.id,
      title: unit.title,
      config: cloneWindowConfigForLayout(unit.config),
      anchorUnitId: attach.anchorId === primaryUnit.id ? 'primary' : attach.anchorId,
      side: attach.side,
      gapMm: attach.gapMm,
      crossAlign: attach.crossAlign,
      crossOffsetMm: attach.crossOffsetMm,
      rate: unit.rate,
    });
    placed.push(unit);
  }

  return {
    primaryTitle: primaryUnit.title,
    primaryConfig: cloneWindowConfigForLayout(primaryUnit.config),
    primaryRate: primaryUnit.rate,
    primaryHardwareItems: primaryUnit.hardwareItems,
    companions,
  };
}

export function buildWindowPackageQuotationItem(input: {
  placements: LayoutUnitPlacement[];
  companions: DesignLayoutUnit[];
  globalRate: number;
  quantity: number;
  areaType: AreaType;
  packageTitle: string;
  savedColors: SavedColor[];
  defaultHardwareItems: HardwareItem[];
  hardwareCostFor: (cfg: WindowConfig, hw: HardwareItem[]) => number;
  printElevationPhoto?: string;
  existingId?: string;
}): WindowPackageQuotationItem {
  const bounds = layoutBounds(input.placements);
  const units: WindowPackageUnitLine[] = input.placements.map((p) => {
    const hw = p.config.series?.hardwareItems ?? input.defaultHardwareItems;
    return {
      id: p.id,
      title: p.title,
      config: JSON.parse(JSON.stringify(p.config)) as WindowConfig,
      rate: resolveLayoutUnitRate(p.id, input.globalRate, input.companions),
      hardwareCost: input.hardwareCostFor(p.config, hw),
      hardwareItems: JSON.parse(JSON.stringify(hw)) as HardwareItem[],
      profileColorName: resolveProfileColorLabel(
        p.config.profileColor,
        undefined,
        input.savedColors,
      ),
      xMm: p.xMm,
      yMm: p.yMm,
      widthMm: p.widthMm,
      heightMm: p.heightMm,
    };
  });

  return {
    kind: 'window_package',
    id: input.existingId ?? uuidv4(),
    title: input.packageTitle,
    quantity: input.quantity,
    areaType: input.areaType,
    units,
    layoutMinXMm: bounds.minXMm,
    layoutMinYMm: bounds.minYMm,
    layoutWidthMm: bounds.widthMm,
    layoutHeightMm: bounds.heightMm,
    printElevationPhoto: input.printElevationPhoto || undefined,
  };
}
