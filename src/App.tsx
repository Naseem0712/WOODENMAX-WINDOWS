import React, { useState, useEffect, useMemo, useRef, useReducer, useCallback, lazy, Suspense } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import type { ProfileSeries, WindowConfig, HardwareItem, QuotationItem, WindowQuotationItem, VentilatorCell, GlassSpecialType, SavedColor, VentilatorCellType, PartitionPanelType, PartitionPanelConfig, QuotationSettings, HandleConfig, CornerSideConfig, LaminatedGlassConfig, DguGlassConfig, BatchAddItem, GlassGridConfig, LouverBayCrossAlign, DesignLayoutUnit, DesignLayoutActiveUnit } from './types';
import { FixedPanelPosition, ShutterConfigType, TrackType, GlassType, AreaType, WindowType, MirrorShape } from './types';
import { ControlsPanel } from './components/ControlsPanel';
import { WindowCanvas } from './components/WindowCanvas';
import { ErrorBoundary } from './components/ErrorBoundary';
import { QuotationPanel } from './components/QuotationPanel';
import { v4 as uuidv4 } from 'uuid';
import { ChevronLeftIcon } from './components/icons/ChevronLeftIcon';
import { WoodenMaxCatalogMenu } from './components/WoodenMaxCatalogMenu';
import { Logo } from './components/icons/Logo';
import { Button } from './components/ui/Button';
import { SpringScrollArea } from './components/ui/SpringScrollArea';
import { DownloadIcon } from './components/icons/DownloadIcon';
import { AdjustmentsIcon } from './components/icons/AdjustmentsIcon';
import { ListBulletIcon } from './components/icons/ListBulletIcon';
import { DocumentTextIcon } from './components/icons/DocumentTextIcon';
import {
  saveSnapshotForType,
  getSnapshotForType,
  clearSnapshotForType,
  type DesignSnapshot,
} from './utils/windowTypeDesignSnapshots';
import { SITE_ORIGIN } from './constants/site';
import { applyRouteJsonLd, applyRouteSeo, getGuideDisplayTitle, getMetaDescription } from './seo/meta';
import { DEFAULT_MATERIAL_RATES } from './constants/materialRates';
import { computeHardwareCostForQuotation } from './utils/quotationHardwareCost';
import { applyDesignerCorrectionToQuotationItem } from './utils/applyDesignerCorrectionToQuotationItem';
import {
  applyAppearanceFromPrimary,
  appearanceFingerprint,
  clearDesignLayoutSession,
  computeLayoutEstimateRows,
  computeLayoutPlacements,
  layoutBounds,
  layoutPrimaryLabel,
  loadDesignLayoutSession,
  saveDesignLayoutSession,
  syncLayoutCompanionTitles,
} from './utils/designLayout';
import {
  isOutlineBandCell,
  buildArchGridHorizontalDividers,
  isArchTopOutline,
  applyArchStraightBottomLayout,
  resolveCasementOutline,
  getPlainCasementVentilatorFields,
  sanitizeCasementOpeningIfNotUserSet,
} from './utils/casementOutlineGeometry';
import {
  allHSegmentsHidden,
  allVSegmentsHidden,
  pruneHiddenForRemovedHDivider,
  pruneHiddenForRemovedVDivider,
  withHiddenHSegment,
  withHiddenVSegment,
} from './utils/casementGridMullions';
import { computeInnerHoleDims } from './utils/handleDefaults';
import { calculateMaterialCostSummary } from './utils/materialCosting';
import { applyHomeownerDefaultsToConfig, loadHomeownerDefaults } from './utils/homeownerDefaultsStorage';
import { RailingDesignerApp } from './railing/App';
import { recalculateQuoteLine as recalculateRailingQuoteLine } from './railing/quotationFormat';
import { displayDesignTitle as railingDisplayTitle } from './railing/utils';
import type { QuotationLine } from './railing/types';
import { isWindowQuotationItem } from './utils/quotationItemKinds';
import { resolveProfileColorLabel } from './utils/profileColorLabel';
import {
  buildWindowPackageQuotationItem,
  isWindowPackageQuotationItem,
  normalizeWindowPackageItem,
  reconstructDesignLayoutFromPackage,
} from './utils/windowPackageQuotation';
import {
  loadSessionPrintElevationPhoto,
  saveSessionPrintElevationPhoto,
} from './utils/printElevationPhoto';
import { supportsOpenView } from './windowOpenView/supportsOpenView';
import {
  getLouverBaySeparatorMm,
  LOUVER_BAY_MAX,
  getValidLouverBays,
  getLouverCompoundOuterMm,
  getWindowQuotationAreaMm2,
} from './utils/louverBays';
import { useUserMode } from './components/UserModeProvider';
import type { UserMode } from './types';

function normalizeQuotationItemFromStorage(raw: unknown): QuotationItem | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  if (o.kind === 'railing' && o.railingLine && typeof o.id === 'string') {
    return {
      kind: 'railing',
      id: o.id,
      title: typeof o.title === 'string' ? o.title : 'Glass railing',
      railingLine: recalculateRailingQuoteLine(structuredClone(o.railingLine as QuotationLine)),
    };
  }
  if (o.kind === 'window_package' && Array.isArray(o.units) && typeof o.id === 'string') {
    return normalizeWindowPackageItem(structuredClone(o) as unknown as import('./types').WindowPackageQuotationItem);
  }
  if (o.config && typeof o.id === 'string') {
    return {
      ...(o as unknown as WindowQuotationItem),
      kind: 'window',
    };
  }
  return null;
}

function labelForMode(mode: UserMode): string {
  if (mode === 'manufacturer') return 'Manufacturer'
  if (mode === 'architect') return 'Architect'
  return 'Homeowner'
}

const BatchAddModal = lazy(() => import('./components/BatchAddModal').then(module => ({ default: module.BatchAddModal })));
const GuidesViewer = lazy(() => import('./components/GuidesViewer').then(module => ({ default: module.GuidesViewer })));
const QuotationListModal = lazy(() =>
  import('./components/QuotationListModal').then((m) => ({ default: m.QuotationListModal }))
);
const WindowOpenViewModal = lazy(() =>
  import('./windowOpenView/WindowOpenViewModal').then((m) => ({ default: m.WindowOpenViewModal }))
);
const Window3DPreviewModal = lazy(() => import('./window3d/Window3DPreviewModal'));

interface BeforeInstallPromptEvent extends Event {
    readonly platforms: Array<string>;
    readonly userChoice: Promise<{
      outcome: 'accepted' | 'dismissed',
      platform: string,
    }>;
    prompt(): Promise<void>;
}

type ConfigState = Omit<WindowConfig, 'series'>;

type ConfigAction =
  | { type: 'SET_FIELD'; field: keyof ConfigState; payload: any }
  | { type: 'ADD_FIXED_PANEL'; payload: FixedPanelPosition }
  | { type: 'REMOVE_FIXED_PANEL'; payload: string }
  | { type: 'UPDATE_FIXED_PANEL_SIZE'; payload: { id: string; size: number } }
  | { type: 'TOGGLE_DOOR_POSITION'; payload: { row: number; col: number, side: 'left' | 'right' | null } }
  | { type: 'HANDLE_VENTILATOR_CELL_CLICK'; payload: { row: number; col: number, side: 'left' | 'right' | null } }
  | { type: 'SET_GRID_SIZE'; payload: { rows: number; cols: number, side: 'left' | 'right' | null } }
  | { type: 'REMOVE_VERTICAL_DIVIDER'; payload: { index: number, side: 'left' | 'right' | null } }
  | { type: 'REMOVE_HORIZONTAL_DIVIDER'; payload: { index: number, side: 'left' | 'right' | null } }
  | { type: 'REMOVE_H_MULLION_SEGMENT'; payload: { dividerIndex: number; col: number; side: 'left' | 'right' | null } }
  | { type: 'REMOVE_V_MULLION_SEGMENT'; payload: { dividerIndex: number; row: number; side: 'left' | 'right' | null } }
  | { type: 'MOVE_HORIZONTAL_DIVIDER'; payload: { index: number; ratio: number; side: 'left' | 'right' | null } }
  | { type: 'MOVE_VERTICAL_DIVIDER'; payload: { index: number; ratio: number; side: 'left' | 'right' | null } }
  | { type: 'UPDATE_HANDLE'; payload: { panelId: string; newConfig: HandleConfig | null, side: 'left' | 'right' | null } }
  | { type: 'SET_SIDE_CONFIG'; payload: { side: 'left' | 'right'; config: Partial<CornerSideConfig> } }
  | { type: 'SET_WINDOW_TYPE'; payload: WindowType }
  | { type: 'SET_PARTITION_PANEL_COUNT'; payload: number }
  | { type: 'SET_PARTITION_PRESET'; payload: ConfigState['partitionPanels'] }
  | { type: 'SET_PARTITION_WIDTH_FRACTIONS'; payload: number[] }
  | { type: 'CYCLE_PARTITION_PANEL_TYPE'; payload: number }
  | { type: 'SET_PARTITION_HAS_TOP_CHANNEL'; payload: boolean }
  | { type: 'CYCLE_PARTITION_PANEL_FRAMING'; payload: number }
  | { type: 'UPDATE_PARTITION_PANEL'; payload: { index: number; partial: Partial<PartitionPanelConfig> } }
  | { type: 'ADD_LOUVER_ITEM'; payload: { type: 'profile' | 'gap' } }
  | { type: 'REMOVE_LOUVER_ITEM'; payload: { id: string } }
  | { type: 'UPDATE_LOUVER_ITEM'; payload: { id: string; size: number | '' } }
  | { type: 'ADD_LOUVER_BAY'; payload: { separatorMm?: number } }
  | { type: 'REMOVE_LOUVER_BAY'; payload: { id: string; separatorMm?: number } }
  | { type: 'UPDATE_LOUVER_BAY'; payload: { id: string; width?: number | ''; height?: number | ''; crossAlign?: LouverBayCrossAlign; offsetMm?: number | ''; separatorMm?: number } }
  | { type: 'SET_LOUVER_BAY_LAYOUT'; payload: { layout: 'vertical' | 'horizontal'; separatorMm?: number } }
  | { type: 'CLEAR_LOUVER_BAYS' }
  | { type: 'UPDATE_LAMINATED_CONFIG'; payload: Partial<LaminatedGlassConfig> }
  | { type: 'UPDATE_DGU_CONFIG'; payload: Partial<DguGlassConfig> }
  | { type: 'UPDATE_MIRROR_CONFIG'; payload: Partial<WindowConfig['mirrorConfig']> }
  | { type: 'LOAD_CONFIG'; payload: ConfigState }
  | { type: 'RESET_DESIGN' }
  | { type: 'LOAD_CONFIG_STATE'; payload: ConfigState };

const BASE_DIMENSIONS = {
    outerFrame: 0, outerFrameVertical: 0, fixedFrame: 0, shutterHandle: 0, shutterInterlock: 0,
    shutterTop: 0, shutterBottom: 0, shutterMeeting: 0, casementShutter: 0,
    mullion: 0, louverBlade: 0, louverProfile: 0, topTrack: 0, bottomTrack: 0, glassGridProfile: 0,
};

const ALL_PROFILES_16_FEET = {
    lengths: Object.keys(BASE_DIMENSIONS).reduce((acc, key) => ({ ...acc, [key]: 4876.8 }), {})
};

const DEFAULT_GLASS_OPTIONS = {
    thicknesses: [5, 6, 8, 10, 12],
    customThicknessAllowed: true,
    specialTypes: ['laminated', 'dgu'] as Exclude<GlassSpecialType, 'none'>[],
};

const SLIDING_HARDWARE_TEMPLATE: Omit<HardwareItem, 'id'>[] = [
    { name: 'Track Connector', qtyPerShutter: 4, rate: 30, unit: 'per_window' },
    { name: 'Shutter Connector', qtyPerShutter: 2, rate: 30, unit: 'per_shutter_or_door' },
    { name: 'Interlock Connector', qtyPerShutter: 2, rate: 25, unit: 'per_shutter_or_door' },
    { name: 'Interlock Cap', qtyPerShutter: 2, rate: 20, unit: 'per_shutter_or_door' },
    { name: 'Shutter Bearing', qtyPerShutter: 2, rate: 150, unit: 'per_shutter_or_door' },
    { name: 'Handle Single Point', qtyPerShutter: 1, rate: 450, unit: 'per_shutter_or_door' },
    { name: 'Handle Multi Point', qtyPerShutter: 0, rate: 1250, unit: 'per_shutter_or_door' },
    { name: 'Mortice Lock', qtyPerShutter: 0, rate: 1550, unit: 'per_shutter_or_door' },
    { name: 'Mesh Lock Single Point Touch Type', qtyPerShutter: 1, rate: 450, unit: 'per_shutter_or_door' },
];

const DEFAULT_SLIDING_HARDWARE: HardwareItem[] = SLIDING_HARDWARE_TEMPLATE.map((item) => ({ ...item, id: uuidv4() }));
const OPULENCE_SLIDING_HARDWARE: HardwareItem[] = [
    { id: uuidv4(), name: 'Interlock Cap', qtyPerShutter: 2, rate: 20, unit: 'per_shutter_or_door' },
    { id: uuidv4(), name: 'Shutter Bearing', qtyPerShutter: 2, rate: 220, unit: 'per_shutter_or_door' },
    { id: uuidv4(), name: 'Handle Single Point', qtyPerShutter: 1, rate: 450, unit: 'per_shutter_or_door' },
    { id: uuidv4(), name: 'Handle Multi Point', qtyPerShutter: 0, rate: 1850, unit: 'per_shutter_or_door' },
    { id: uuidv4(), name: 'Mortice Lock', qtyPerShutter: 0, rate: 1550, unit: 'per_shutter_or_door' },
    { id: uuidv4(), name: 'Mesh Lock Single Point Touch Type', qtyPerShutter: 1, rate: 450, unit: 'per_shutter_or_door' },
];

const normalizeHardwareKey = (name: string): string => name.toLowerCase().replace(/[^a-z0-9]/g, '');

const mapHardwareToSlidingKey = (name: string): string => {
    const key = normalizeHardwareKey(name);
    if (key.includes('track') && key.includes('connector')) return 'trackconnector';
    if (key.includes('outerprofilejointconnector')) return 'trackconnector';
    if (key.includes('shutter') && key.includes('connector')) return 'shutterconnector';
    if (key.includes('interlock') && key.includes('connector')) return 'interlockconnector';
    if (key.includes('interlock') && key.includes('cap')) return 'interlockcap';
    if (key.includes('bearing')) return 'shutterbearing';
    if (key.includes('handlemultipoint')) return 'handlemultipoint';
    if (key.includes('handlesinglepoint') || key === 'handle') return 'handlesinglepoint';
    if (key.includes('morticelock')) return 'morticelock';
    if (key.includes('mesh') && key.includes('lock')) return 'meshlocksinglepointtouchtype';
    return key;
};

const normalizeSlidingHardwareItems = (items: HardwareItem[]): HardwareItem[] => {
    const mappedByKey = new Map<string, HardwareItem>();
    for (const item of items) {
        const mappedKey = mapHardwareToSlidingKey(item.name || '');
        if (!mappedByKey.has(mappedKey)) {
            mappedByKey.set(mappedKey, item);
        }
    }
    return SLIDING_HARDWARE_TEMPLATE.map((tpl) => {
        const key = mapHardwareToSlidingKey(tpl.name);
        const existing = mappedByKey.get(key);
        if (!existing) return { ...tpl, id: uuidv4() };
        return {
            id: existing.id || uuidv4(),
            name: tpl.name,
            qtyPerShutter: Number(existing.qtyPerShutter) || 0,
            rate: Number(existing.rate) || 0,
            unit: existing.unit || tpl.unit,
        };
    });
};

const areHardwareItemsEqual = (a: HardwareItem[], b: HardwareItem[]): boolean => {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) {
        if (
            a[i].id !== b[i].id ||
            a[i].name !== b[i].name ||
            a[i].unit !== b[i].unit ||
            Number(a[i].qtyPerShutter) !== Number(b[i].qtyPerShutter) ||
            Number(a[i].rate) !== Number(b[i].rate)
        ) {
            return false;
        }
    }
    return true;
};

const normalizeSeriesHardwareForType = (input: ProfileSeries): ProfileSeries => {
    if (input.type !== WindowType.SLIDING) return input;
    const normalized = normalizeSlidingHardwareItems(input.hardwareItems || []);
    return { ...input, hardwareItems: normalized };
};

const PREDEFINED_SLIDING_SERIES: ProfileSeries[] = [
    // 25mm Series
    {
        id: 'series-sliding-25mm-2t-default',
        name: '25mm Sliding Series (2-Track)',
        type: WindowType.SLIDING,
        dimensions: { ...BASE_DIMENSIONS, outerFrame: 40, shutterHandle: 63, shutterTop: 63, shutterBottom: 63, shutterInterlock: 20 },
        weights: { outerFrame: 0.880, shutterHandle: 0.835, shutterTop: 0.835, shutterBottom: 0.835, shutterInterlock: 0.803 },
        ...ALL_PROFILES_16_FEET,
        hardwareItems: DEFAULT_SLIDING_HARDWARE,
        glassOptions: DEFAULT_GLASS_OPTIONS,
    },
    {
        id: 'series-sliding-25mm-2tc-default',
        name: '25mm Sliding Series (2-Track w/ Cover)',
        type: WindowType.SLIDING,
        dimensions: { ...BASE_DIMENSIONS, outerFrame: 42.75, shutterHandle: 63, shutterTop: 63, shutterBottom: 63, shutterInterlock: 20 },
        weights: { outerFrame: 1.780, shutterHandle: 0.835, shutterTop: 0.835, shutterBottom: 0.835, shutterInterlock: 0.803 },
        ...ALL_PROFILES_16_FEET,
        hardwareItems: DEFAULT_SLIDING_HARDWARE,
        glassOptions: DEFAULT_GLASS_OPTIONS,
    },
     {
        id: 'series-sliding-25mm-slim-default',
        name: '25mm Sliding Series (Slim Interlock)',
        type: WindowType.SLIDING,
        dimensions: { ...BASE_DIMENSIONS, outerFrame: 40, shutterHandle: 63, shutterTop: 63, shutterBottom: 63, shutterInterlock: 20 },
        weights: { outerFrame: 0.880, shutterHandle: 0.835, shutterTop: 0.835, shutterBottom: 0.835, shutterInterlock: 0.468 },
        ...ALL_PROFILES_16_FEET,
        hardwareItems: DEFAULT_SLIDING_HARDWARE,
        glassOptions: DEFAULT_GLASS_OPTIONS,
    },
    {
        id: 'series-sliding-25mm-3t-default',
        name: '25mm Sliding Series (3-Track)',
        type: WindowType.SLIDING,
        dimensions: { ...BASE_DIMENSIONS, outerFrame: 40, shutterHandle: 63, shutterTop: 63, shutterBottom: 63, shutterInterlock: 20 },
        weights: { outerFrame: 1.471, shutterHandle: 0.835, shutterTop: 0.835, shutterBottom: 0.835, shutterInterlock: 0.803 },
        ...ALL_PROFILES_16_FEET,
        hardwareItems: DEFAULT_SLIDING_HARDWARE,
        glassOptions: DEFAULT_GLASS_OPTIONS,
    },
    {
        id: 'series-sliding-25mm-3tc-default',
        name: '25mm Sliding Series (3-Track w/ Cover)',
        type: WindowType.SLIDING,
        dimensions: { ...BASE_DIMENSIONS, outerFrame: 42.75, shutterHandle: 63, shutterTop: 63, shutterBottom: 63, shutterInterlock: 20 },
        weights: { outerFrame: 1.676, shutterHandle: 0.835, shutterTop: 0.835, shutterBottom: 0.835, shutterInterlock: 0.803 },
        ...ALL_PROFILES_16_FEET,
        hardwareItems: DEFAULT_SLIDING_HARDWARE,
        glassOptions: DEFAULT_GLASS_OPTIONS,
    },
    // 27mm Series
    {
        id: 'series-sliding-27mm-2t-default',
        name: '27mm Sliding Series (2-Track)',
        type: WindowType.SLIDING,
        dimensions: { ...BASE_DIMENSIONS, outerFrame: 42, shutterHandle: 65, shutterTop: 65, shutterBottom: 65, shutterInterlock: 65, shutterMeeting: 2 },
        weights: { outerFrame: 0.750, shutterHandle: 0.826, shutterTop: 0.826, shutterBottom: 0.826, shutterInterlock: 0.826, shutterMeeting: 0.303 },
        ...ALL_PROFILES_16_FEET,
        hardwareItems: DEFAULT_SLIDING_HARDWARE,
        glassOptions: DEFAULT_GLASS_OPTIONS,
    },
    {
        id: 'series-sliding-27mm-2tc-default',
        name: '27mm Sliding Series (2-Track w/ Cover)',
        type: WindowType.SLIDING,
        dimensions: { ...BASE_DIMENSIONS, outerFrame: 46, shutterHandle: 65, shutterTop: 65, shutterBottom: 65, shutterInterlock: 65, shutterMeeting: 2 },
        weights: { outerFrame: 1.205, shutterHandle: 0.826, shutterTop: 0.826, shutterBottom: 0.826, shutterInterlock: 0.826, shutterMeeting: 0.303 },
        ...ALL_PROFILES_16_FEET,
        hardwareItems: DEFAULT_SLIDING_HARDWARE,
        glassOptions: DEFAULT_GLASS_OPTIONS,
    },
    {
        id: 'series-sliding-27mm-3t-default',
        name: '27mm Sliding Series (3-Track)',
        type: WindowType.SLIDING,
        dimensions: { ...BASE_DIMENSIONS, outerFrame: 42, shutterHandle: 65, shutterTop: 65, shutterBottom: 65, shutterInterlock: 65, shutterMeeting: 2 },
        weights: { outerFrame: 1.150, shutterHandle: 0.826, shutterTop: 0.826, shutterBottom: 0.826, shutterInterlock: 0.826, shutterMeeting: 0.303 },
        ...ALL_PROFILES_16_FEET,
        hardwareItems: DEFAULT_SLIDING_HARDWARE,
        glassOptions: DEFAULT_GLASS_OPTIONS,
    },
    {
        id: 'series-sliding-27mm-3tc-default',
        name: '27mm Sliding Series (3-Track w/ Cover)',
        type: WindowType.SLIDING,
        dimensions: { ...BASE_DIMENSIONS, outerFrame: 46, shutterHandle: 65, shutterTop: 65, shutterBottom: 65, shutterInterlock: 65, shutterMeeting: 2 },
        weights: { outerFrame: 1.666, shutterHandle: 0.826, shutterTop: 0.826, shutterBottom: 0.826, shutterInterlock: 0.826, shutterMeeting: 0.303 },
        ...ALL_PROFILES_16_FEET,
        hardwareItems: DEFAULT_SLIDING_HARDWARE,
        glassOptions: DEFAULT_GLASS_OPTIONS,
    },
    // 28mm Series
    {
        id: 'series-sliding-28mm-2t-slim-default',
        name: '28mm Sliding (2-Track, Slim Interlock)',
        type: WindowType.SLIDING,
        dimensions: { ...BASE_DIMENSIONS, outerFrame: 46, outerFrameVertical: 22, shutterHandle: 55, shutterTop: 55, shutterBottom: 55, shutterInterlock: 20 },
        weights: { outerFrame: 1.205, outerFrameVertical: 0.832, shutterHandle: 0.765, shutterTop: 0.765, shutterBottom: 0.765, shutterInterlock: 0.515 },
        ...ALL_PROFILES_16_FEET, hardwareItems: DEFAULT_SLIDING_HARDWARE, glassOptions: DEFAULT_GLASS_OPTIONS,
    },
    {
        id: 'series-sliding-28mm-2t-reinf-default',
        name: '28mm Sliding (2-Track, Reinf. Interlock)',
        type: WindowType.SLIDING,
        dimensions: { ...BASE_DIMENSIONS, outerFrame: 46, outerFrameVertical: 22, shutterHandle: 55, shutterTop: 55, shutterBottom: 55, shutterInterlock: 16 },
        weights: { outerFrame: 1.205, outerFrameVertical: 0.832, shutterHandle: 0.765, shutterTop: 0.765, shutterBottom: 0.765, shutterInterlock: 0.921 },
        ...ALL_PROFILES_16_FEET, hardwareItems: DEFAULT_SLIDING_HARDWARE, glassOptions: DEFAULT_GLASS_OPTIONS,
    },
    {
        id: 'series-sliding-28mm-3t-slim-default',
        name: '28mm Sliding (3-Track, Slim Interlock)',
        type: WindowType.SLIDING,
        dimensions: { ...BASE_DIMENSIONS, outerFrame: 46, outerFrameVertical: 22, shutterHandle: 55, shutterTop: 55, shutterBottom: 55, shutterInterlock: 20 },
        weights: { outerFrame: 1.666, outerFrameVertical: 1.229, shutterHandle: 0.765, shutterTop: 0.765, shutterBottom: 0.765, shutterInterlock: 0.515 },
        ...ALL_PROFILES_16_FEET, hardwareItems: DEFAULT_SLIDING_HARDWARE, glassOptions: DEFAULT_GLASS_OPTIONS,
    },
    {
        id: 'series-sliding-28mm-3t-reinf-default',
        name: '28mm Sliding (3-Track, Reinf. Interlock)',
        type: WindowType.SLIDING,
        dimensions: { ...BASE_DIMENSIONS, outerFrame: 46, outerFrameVertical: 22, shutterHandle: 55, shutterTop: 55, shutterBottom: 55, shutterInterlock: 16 },
        weights: { outerFrame: 1.666, outerFrameVertical: 1.229, shutterHandle: 0.765, shutterTop: 0.765, shutterBottom: 0.765, shutterInterlock: 0.921 },
        ...ALL_PROFILES_16_FEET, hardwareItems: DEFAULT_SLIDING_HARDWARE, glassOptions: DEFAULT_GLASS_OPTIONS,
    },
    // 29mm Series
    {
        id: 'series-sliding-29mm-2t-slim-default',
        name: '29mm Sliding (2-Track, Slim Interlock)',
        type: WindowType.SLIDING,
        dimensions: { ...BASE_DIMENSIONS, outerFrame: 47.7, shutterHandle: 65, shutterTop: 65, shutterBottom: 65, shutterInterlock: 28 },
        weights: { outerFrame: 1.150, shutterHandle: 0.942, shutterTop: 0.942, shutterBottom: 0.942, shutterInterlock: 0.640 },
        ...ALL_PROFILES_16_FEET, hardwareItems: DEFAULT_SLIDING_HARDWARE, glassOptions: DEFAULT_GLASS_OPTIONS,
    },
    {
        id: 'series-sliding-29mm-2t-reinf-default',
        name: '29mm Sliding (2-Track, Reinf. Interlock)',
        type: WindowType.SLIDING,
        dimensions: { ...BASE_DIMENSIONS, outerFrame: 47.7, shutterHandle: 65, shutterTop: 65, shutterBottom: 65, shutterInterlock: 28 },
        weights: { outerFrame: 1.150, shutterHandle: 0.942, shutterTop: 0.942, shutterBottom: 0.942, shutterInterlock: 0.990 },
        ...ALL_PROFILES_16_FEET, hardwareItems: DEFAULT_SLIDING_HARDWARE, glassOptions: DEFAULT_GLASS_OPTIONS,
    },
    {
        id: 'series-sliding-29mm-2tc-slim-default',
        name: '29mm Sliding (2-Track w/ Cover, Slim Interlock)',
        type: WindowType.SLIDING,
        dimensions: { ...BASE_DIMENSIONS, outerFrame: 50.2, shutterHandle: 65, shutterTop: 65, shutterBottom: 65, shutterInterlock: 28 },
        weights: { outerFrame: 1.317, shutterHandle: 0.942, shutterTop: 0.942, shutterBottom: 0.942, shutterInterlock: 0.640 },
        ...ALL_PROFILES_16_FEET, hardwareItems: DEFAULT_SLIDING_HARDWARE, glassOptions: DEFAULT_GLASS_OPTIONS,
    },
    {
        id: 'series-sliding-29mm-2tc-reinf-default',
        name: '29mm Sliding (2-Track w/ Cover, Reinf. Interlock)',
        type: WindowType.SLIDING,
        dimensions: { ...BASE_DIMENSIONS, outerFrame: 50.2, shutterHandle: 65, shutterTop: 65, shutterBottom: 65, shutterInterlock: 28 },
        weights: { outerFrame: 1.317, shutterHandle: 0.942, shutterTop: 0.942, shutterBottom: 0.942, shutterInterlock: 0.990 },
        ...ALL_PROFILES_16_FEET, hardwareItems: DEFAULT_SLIDING_HARDWARE, glassOptions: DEFAULT_GLASS_OPTIONS,
    },
    {
        id: 'series-sliding-29mm-3t-slim-default',
        name: '29mm Sliding (3-Track, Slim Interlock)',
        type: WindowType.SLIDING,
        dimensions: { ...BASE_DIMENSIONS, outerFrame: 47.7, shutterHandle: 65, shutterTop: 65, shutterBottom: 65, shutterInterlock: 28 },
        weights: { outerFrame: 1.675, shutterHandle: 0.942, shutterTop: 0.942, shutterBottom: 0.942, shutterInterlock: 0.640 },
        ...ALL_PROFILES_16_FEET, hardwareItems: DEFAULT_SLIDING_HARDWARE, glassOptions: DEFAULT_GLASS_OPTIONS,
    },
    {
        id: 'series-sliding-29mm-3t-reinf-default',
        name: '29mm Sliding (3-Track, Reinf. Interlock)',
        type: WindowType.SLIDING,
        dimensions: { ...BASE_DIMENSIONS, outerFrame: 47.7, shutterHandle: 65, shutterTop: 65, shutterBottom: 65, shutterInterlock: 28 },
        weights: { outerFrame: 1.675, shutterHandle: 0.942, shutterTop: 0.942, shutterBottom: 0.942, shutterInterlock: 0.990 },
        ...ALL_PROFILES_16_FEET, hardwareItems: DEFAULT_SLIDING_HARDWARE, glassOptions: DEFAULT_GLASS_OPTIONS,
    },
    {
        id: 'series-sliding-29mm-3tc-slim-default',
        name: '29mm Sliding (3-Track w/ Cover, Slim Interlock)',
        type: WindowType.SLIDING,
        dimensions: { ...BASE_DIMENSIONS, outerFrame: 50.2, shutterHandle: 65, shutterTop: 65, shutterBottom: 65, shutterInterlock: 28 },
        weights: { outerFrame: 1.943, shutterHandle: 0.942, shutterTop: 0.942, shutterBottom: 0.942, shutterInterlock: 0.640 },
        ...ALL_PROFILES_16_FEET, hardwareItems: DEFAULT_SLIDING_HARDWARE, glassOptions: DEFAULT_GLASS_OPTIONS,
    },
    {
        id: 'series-sliding-29mm-3tc-reinf-default',
        name: '29mm Sliding (3-Track w/ Cover, Reinf. Interlock)',
        type: WindowType.SLIDING,
        dimensions: { ...BASE_DIMENSIONS, outerFrame: 50.2, shutterHandle: 65, shutterTop: 65, shutterBottom: 65, shutterInterlock: 28 },
        weights: { outerFrame: 1.943, shutterHandle: 0.942, shutterTop: 0.942, shutterBottom: 0.942, shutterInterlock: 0.990 },
        ...ALL_PROFILES_16_FEET, hardwareItems: DEFAULT_SLIDING_HARDWARE, glassOptions: DEFAULT_GLASS_OPTIONS,
    },
    // 35mm Opulence Series — different track vs jamb extrusion; no H↔V off-cut sharing
    {
        id: 'series-sliding-35mm-opulence-2t-slim-default',
        name: '35mm Opulence (2-Track, Slim Interlock)',
        type: WindowType.SLIDING,
        slidingOuterUnifiedPerimeter: false,
        dimensions: { ...BASE_DIMENSIONS, outerFrame: 97, outerFrameVertical: 100, fixedFrame: 31, shutterHandle: 59, shutterTop: 58, shutterBottom: 58, shutterInterlock: 27 },
        weights: { outerFrame: 1.680, outerFrameVertical: 1.200, fixedFrame: 0.300, shutterHandle: 0.920, shutterTop: 0.910, shutterBottom: 0.910, shutterInterlock: 0.720 },
        ...ALL_PROFILES_16_FEET,
        hardwareItems: OPULENCE_SLIDING_HARDWARE,
        glassOptions: DEFAULT_GLASS_OPTIONS,
    },
    {
        id: 'series-sliding-35mm-opulence-2t-reinf-default',
        name: '35mm Opulence (2-Track, Reinf. Interlock)',
        type: WindowType.SLIDING,
        slidingOuterUnifiedPerimeter: false,
        dimensions: { ...BASE_DIMENSIONS, outerFrame: 97, outerFrameVertical: 100, fixedFrame: 31, shutterHandle: 59, shutterTop: 58, shutterBottom: 58, shutterInterlock: 27 },
        weights: { outerFrame: 1.680, outerFrameVertical: 1.200, fixedFrame: 0.300, shutterHandle: 0.920, shutterTop: 0.910, shutterBottom: 0.910, shutterInterlock: 1.200 },
        ...ALL_PROFILES_16_FEET,
        hardwareItems: OPULENCE_SLIDING_HARDWARE,
        glassOptions: DEFAULT_GLASS_OPTIONS,
    },
    {
        id: 'series-sliding-35mm-opulence-3t-slim-default',
        name: '35mm Opulence (3-Track, Slim Interlock)',
        type: WindowType.SLIDING,
        slidingOuterUnifiedPerimeter: false,
        dimensions: { ...BASE_DIMENSIONS, outerFrame: 145, outerFrameVertical: 150, fixedFrame: 31, shutterHandle: 59, shutterTop: 58, shutterBottom: 58, shutterInterlock: 27 },
        weights: { outerFrame: 2.120, outerFrameVertical: 1.720, fixedFrame: 0.300, shutterHandle: 0.920, shutterTop: 0.910, shutterBottom: 0.910, shutterInterlock: 0.720 },
        ...ALL_PROFILES_16_FEET,
        hardwareItems: OPULENCE_SLIDING_HARDWARE,
        glassOptions: DEFAULT_GLASS_OPTIONS,
    },
    {
        id: 'series-sliding-35mm-opulence-3t-reinf-default',
        name: '35mm Opulence (3-Track, Reinf. Interlock)',
        type: WindowType.SLIDING,
        slidingOuterUnifiedPerimeter: false,
        dimensions: { ...BASE_DIMENSIONS, outerFrame: 145, outerFrameVertical: 150, fixedFrame: 31, shutterHandle: 59, shutterTop: 58, shutterBottom: 58, shutterInterlock: 27 },
        weights: { outerFrame: 2.120, outerFrameVertical: 1.720, fixedFrame: 0.300, shutterHandle: 0.920, shutterTop: 0.910, shutterBottom: 0.910, shutterInterlock: 1.200 },
        ...ALL_PROFILES_16_FEET,
        hardwareItems: OPULENCE_SLIDING_HARDWARE,
        glassOptions: DEFAULT_GLASS_OPTIONS,
    },
];

const DEFAULT_SLIDING_SERIES: ProfileSeries = {
    id: 'series-sliding-default',
    name: 'Standard Sliding Series',
    type: WindowType.SLIDING,
    dimensions: {
        ...BASE_DIMENSIONS,
        outerFrame: 60, fixedFrame: 25, shutterHandle: 45, shutterInterlock: 25,
        shutterTop: 55, shutterBottom: 55, shutterMeeting: 25,
    },
    hardwareItems: DEFAULT_SLIDING_HARDWARE,
    glassOptions: DEFAULT_GLASS_OPTIONS,
};

const DEFAULT_CASEMENT_HARDWARE: HardwareItem[] = [
    { id: uuidv4(), name: 'Outer Frame Connector', qtyPerShutter: 4, rate: 40, unit: 'per_window' },
    { id: uuidv4(), name: 'Mullion Connector', qtyPerShutter: 2, rate: 35, unit: 'per_window' },
    { id: uuidv4(), name: 'Door Connector', qtyPerShutter: 4, rate: 25, unit: 'per_shutter_or_door' },
    { id: uuidv4(), name: 'Lock', qtyPerShutter: 1, rate: 250, unit: 'per_shutter_or_door' },
    { id: uuidv4(), name: 'Hinges', qtyPerShutter: 3, rate: 70, unit: 'per_shutter_or_door' },
];

const CASEMENT_40_HARDWARE: HardwareItem[] = [
    { id: uuidv4(), name: 'Outer Connector', qtyPerShutter: 4, rate: 40, unit: 'per_window' },
    { id: uuidv4(), name: 'Shutter Connector (all side)', qtyPerShutter: 4, rate: 40, unit: 'per_shutter_or_door' },
    { id: uuidv4(), name: 'Butt Hinges', qtyPerShutter: 2, rate: 120, unit: 'per_shutter_or_door' },
    { id: uuidv4(), name: 'Door Holder', qtyPerShutter: 2, rate: 180, unit: 'per_shutter_or_door' },
    { id: uuidv4(), name: 'Handle Single Point', qtyPerShutter: 1, rate: 250, unit: 'per_shutter_or_door' },
    { id: uuidv4(), name: 'Handle Multi Point', qtyPerShutter: 0, rate: 1450, unit: 'per_shutter_or_door' },
    { id: uuidv4(), name: 'Friction Stay 8 inch (optional set)', qtyPerShutter: 0, rate: 180, unit: 'per_shutter_or_door' },
    { id: uuidv4(), name: 'Friction Stay 10 inch (optional set)', qtyPerShutter: 0, rate: 220, unit: 'per_shutter_or_door' },
    { id: uuidv4(), name: 'Friction Stay 12 inch (optional set)', qtyPerShutter: 0, rate: 350, unit: 'per_shutter_or_door' },
    { id: uuidv4(), name: 'Friction Stay 14 inch (optional set)', qtyPerShutter: 0, rate: 450, unit: 'per_shutter_or_door' },
];

const CASEMENT_50_HARDWARE: HardwareItem[] = [
    { id: uuidv4(), name: 'Outer Connector', qtyPerShutter: 4, rate: 40, unit: 'per_window' },
    { id: uuidv4(), name: 'Shutter Connector (all side)', qtyPerShutter: 4, rate: 40, unit: 'per_shutter_or_door' },
    { id: uuidv4(), name: 'Butt Hinges', qtyPerShutter: 2, rate: 160, unit: 'per_shutter_or_door' },
    { id: uuidv4(), name: 'Door Holder', qtyPerShutter: 2, rate: 180, unit: 'per_shutter_or_door' },
    { id: uuidv4(), name: 'Handle Single Point', qtyPerShutter: 1, rate: 250, unit: 'per_shutter_or_door' },
    { id: uuidv4(), name: 'Handle Multi Point', qtyPerShutter: 0, rate: 1450, unit: 'per_shutter_or_door' },
    { id: uuidv4(), name: 'Mortice Lock', qtyPerShutter: 0, rate: 1550, unit: 'per_shutter_or_door' },
    { id: uuidv4(), name: 'Friction Stay 8 inch (optional set)', qtyPerShutter: 0, rate: 180, unit: 'per_shutter_or_door' },
    { id: uuidv4(), name: 'Friction Stay 10 inch (optional set)', qtyPerShutter: 0, rate: 220, unit: 'per_shutter_or_door' },
    { id: uuidv4(), name: 'Friction Stay 12 inch (optional set)', qtyPerShutter: 0, rate: 350, unit: 'per_shutter_or_door' },
    { id: uuidv4(), name: 'Friction Stay 14 inch (optional set)', qtyPerShutter: 0, rate: 450, unit: 'per_shutter_or_door' },
];

const DEFAULT_CASEMENT_SERIES: ProfileSeries = {
    id: 'series-casement-default',
    name: 'Standard Casement Series',
    type: WindowType.CASEMENT,
    dimensions: { ...BASE_DIMENSIONS, outerFrame: 60, fixedFrame: 25, casementShutter: 70, mullion: 80 },
    hardwareItems: DEFAULT_CASEMENT_HARDWARE,
    glassOptions: DEFAULT_GLASS_OPTIONS,
};

const PREDEFINED_CASEMENT_SERIES: ProfileSeries[] = [
    {
        id: 'series-casement-40mm-small-default',
        name: '40mm Casement (Mullion Small)',
        type: WindowType.CASEMENT,
        dimensions: { ...BASE_DIMENSIONS, outerFrame: 40, fixedFrame: 20, casementShutter: 40, mullion: 35 },
        weights: { outerFrame: 0.600, fixedFrame: 0.240, casementShutter: 0.900, mullion: 0.900 },
        ...ALL_PROFILES_16_FEET,
        hardwareItems: CASEMENT_40_HARDWARE,
        glassOptions: DEFAULT_GLASS_OPTIONS,
    },
    {
        id: 'series-casement-40mm-big-default',
        name: '40mm Casement (Mullion Big)',
        type: WindowType.CASEMENT,
        dimensions: { ...BASE_DIMENSIONS, outerFrame: 40, fixedFrame: 20, casementShutter: 40, mullion: 35 },
        weights: { outerFrame: 0.600, fixedFrame: 0.240, casementShutter: 0.900, mullion: 0.980 },
        ...ALL_PROFILES_16_FEET,
        hardwareItems: CASEMENT_40_HARDWARE,
        glassOptions: DEFAULT_GLASS_OPTIONS,
    },
    {
        id: 'series-casement-50mm-small-default',
        name: '50mm Casement (Mullion Small)',
        type: WindowType.CASEMENT,
        dimensions: { ...BASE_DIMENSIONS, outerFrame: 50, fixedFrame: 25, casementShutter: 50, mullion: 40 },
        weights: { outerFrame: 1.200, casementShutter: 1.350, mullion: 1.400 },
        ...ALL_PROFILES_16_FEET,
        hardwareItems: CASEMENT_50_HARDWARE,
        glassOptions: DEFAULT_GLASS_OPTIONS,
    },
    {
        id: 'series-casement-50mm-big-default',
        name: '50mm Casement (Mullion Big)',
        type: WindowType.CASEMENT,
        dimensions: { ...BASE_DIMENSIONS, outerFrame: 50, fixedFrame: 25, casementShutter: 50, mullion: 40 },
        weights: { outerFrame: 1.200, casementShutter: 1.350, mullion: 4.900 },
        ...ALL_PROFILES_16_FEET,
        hardwareItems: CASEMENT_50_HARDWARE,
        glassOptions: DEFAULT_GLASS_OPTIONS,
    },
];

const DEFAULT_VENTILATOR_HARDWARE: HardwareItem[] = [
    { id: uuidv4(), name: 'Frame Connector', qtyPerShutter: 4, rate: 30, unit: 'per_window' },
    { id: uuidv4(), name: 'Mullion Clip', qtyPerShutter: 4, rate: 20, unit: 'per_window' },
    { id: uuidv4(), name: 'Louvers Pin', qtyPerShutter: 10, rate: 5, unit: 'per_shutter_or_door' },
    { id: uuidv4(), name: 'Door Hinge', qtyPerShutter: 2, rate: 50, unit: 'per_shutter_or_door' },
];

const DEFAULT_VENTILATOR_SERIES: ProfileSeries = {
    id: 'series-ventilator-default',
    name: 'Standard Ventilator Series',
    type: WindowType.VENTILATOR,
    dimensions: { ...BASE_DIMENSIONS, outerFrame: 50, fixedFrame: 20, casementShutter: 45, mullion: 50, louverBlade: 25 },
    hardwareItems: DEFAULT_VENTILATOR_HARDWARE,
    glassOptions: DEFAULT_GLASS_OPTIONS,
};

const PREDEFINED_VENTILATOR_SERIES: ProfileSeries[] = [
    {
        id: 'series-ventilator-25mm-slim-default',
        name: '25mm Ventilator Slim Series',
        type: WindowType.VENTILATOR,
        dimensions: { ...BASE_DIMENSIONS, outerFrame: 25, fixedFrame: 25, casementShutter: 42, mullion: 25, louverBlade: 25 },
        weights: {
            outerFrame: 0.850,
            outerFrameVertical: 1.200, // Corner profile mapping
            fixedFrame: 0.280, // Door outer 25x50 mapping
            casementShutter: 1.630, // Door vertical 76x42 mapping
            mullion: 0.820, // Divider 25x50
            louverBlade: 0.550, // Z-louver 75x4
        },
        lengths: { ...ALL_PROFILES_16_FEET.lengths, mullion: 3500 }, // Slim vertical divider @ 3.5m
        hardwareItems: [
            ...DEFAULT_VENTILATOR_HARDWARE,
            { id: uuidv4(), name: 'Divider Slim Vertical 3.5m', qtyPerShutter: 1, rate: 550, unit: 'per_window' },
        ],
        glassOptions: DEFAULT_GLASS_OPTIONS,
    },
];

const DEFAULT_PARTITION_HARDWARE: HardwareItem[] = [
  { id: uuidv4(), name: 'Sliding Shower Set', qtyPerShutter: 1, rate: 2500, unit: 'per_shutter_or_door' },
  { id: uuidv4(), name: 'Hinges (for openable)', qtyPerShutter: 3, rate: 350, unit: 'per_shutter_or_door' },
  { id: uuidv4(), name: 'Door Seal', qtyPerShutter: 1, rate: 500, unit: 'per_shutter_or_door' },
  { id: uuidv4(), name: 'Handle Knob/Pull', qtyPerShutter: 1, rate: 400, unit: 'per_shutter_or_door' },
];

const PARTITION_SLIM_HARDWARE: HardwareItem[] = [
  { id: uuidv4(), name: 'Butterfly Hinges 4 inch', qtyPerShutter: 5, rate: 140, unit: 'per_shutter_or_door' },
  { id: uuidv4(), name: 'Butterfly Hinges 5 inch', qtyPerShutter: 0, rate: 180, unit: 'per_shutter_or_door' },
  { id: uuidv4(), name: 'Mortice Lock', qtyPerShutter: 0, rate: 1550, unit: 'per_shutter_or_door' },
  { id: uuidv4(), name: 'Door Stopper (optional)', qtyPerShutter: 0, rate: 1100, unit: 'per_shutter_or_door' },
  { id: uuidv4(), name: 'Door Closer (optional)', qtyPerShutter: 0, rate: 2750, unit: 'per_shutter_or_door' },
];

const DEFAULT_GLASS_PARTITION_SERIES: ProfileSeries = {
  id: 'series-partition-default',
  name: 'Standard Glass Partition',
  type: WindowType.GLASS_PARTITION,
  dimensions: { ...BASE_DIMENSIONS, topTrack: 50, bottomTrack: 20, fixedFrame: 25, casementShutter: 35 },
  hardwareItems: DEFAULT_PARTITION_HARDWARE,
  glassOptions: {
    thicknesses: [8, 10, 12],
    customThicknessAllowed: true,
    specialTypes: ['laminated'],
  },
};

const PREDEFINED_PARTITION_SERIES: ProfileSeries[] = [
  {
    id: 'series-partition-40mm-default',
    name: '40mm Glass Door & Window',
    type: WindowType.GLASS_PARTITION,
    dimensions: { ...BASE_DIMENSIONS, topTrack: 40, bottomTrack: 40, fixedFrame: 20, casementShutter: 40, mullion: 35 },
    weights: {
      topTrack: 0.600,
      bottomTrack: 0.600,
      fixedFrame: 0.240,
      casementShutter: 0.900,
      mullion: 0.900,
    },
    ...ALL_PROFILES_16_FEET,
    hardwareItems: DEFAULT_PARTITION_HARDWARE,
    glassOptions: {
      thicknesses: [8, 10, 12],
      customThicknessAllowed: true,
      specialTypes: ['laminated'],
    },
  },
  {
    id: 'series-partition-50mm-default',
    name: '50mm Glass Door & Window',
    type: WindowType.GLASS_PARTITION,
    dimensions: { ...BASE_DIMENSIONS, topTrack: 50, bottomTrack: 50, fixedFrame: 25, casementShutter: 50, mullion: 40 },
    weights: {
      topTrack: 1.200,
      bottomTrack: 1.200,
      casementShutter: 1.350,
      mullion: 1.400,
    },
    ...ALL_PROFILES_16_FEET,
    hardwareItems: DEFAULT_PARTITION_HARDWARE,
    glassOptions: {
      thicknesses: [8, 10, 12],
      customThicknessAllowed: true,
      specialTypes: ['laminated'],
    },
  },
  {
    id: 'series-partition-25mm-slim-default',
    name: '25mm Partition Slim Series',
    type: WindowType.GLASS_PARTITION,
    dimensions: { ...BASE_DIMENSIONS, topTrack: 25, bottomTrack: 25, fixedFrame: 25, casementShutter: 75, mullion: 25 },
    weights: {
      topTrack: 0.850, // 25x50 outer profile
      bottomTrack: 0.850,
      fixedFrame: 0.280, // Door outer 25x50 mapping
      mullion: 0.820, // Divider 25x50
      casementShutter: 1.420, // Door top/bottom 75x42 mapping
      outerFrameVertical: 1.200, // Corner profile reference
    },
    lengths: { ...ALL_PROFILES_16_FEET.lengths, mullion: 3500 },
    hardwareItems: [
      ...PARTITION_SLIM_HARDWARE,
      { id: uuidv4(), name: 'Divider Slim Vertical 3.5m', qtyPerShutter: 1, rate: 550, unit: 'per_window' },
    ],
    glassOptions: {
      thicknesses: [8, 10, 12],
      customThicknessAllowed: true,
      specialTypes: ['laminated'],
    },
  },
];

const DEFAULT_CORNER_SERIES: ProfileSeries = {
    id: 'series-corner-default',
    name: 'Standard Corner Series',
    type: WindowType.CORNER,
    dimensions: { ...BASE_DIMENSIONS, outerFrame: 60, fixedFrame: 25, casementShutter: 70, mullion: 80 },
    hardwareItems: [], // Hardware derived from sub-type
    glassOptions: DEFAULT_GLASS_OPTIONS,
};

const DEFAULT_MIRROR_SERIES: ProfileSeries = {
    id: 'series-mirror-default',
    name: 'Standard Mirror Frame',
    type: WindowType.MIRROR,
    dimensions: { ...BASE_DIMENSIONS, outerFrame: 30 },
    hardwareItems: [],
    glassOptions: {
        thicknesses: [4, 5, 6, 8],
        customThicknessAllowed: true,
        specialTypes: [],
    },
};

const DEFAULT_LOUVERS_HARDWARE: HardwareItem[] = [
    { id: uuidv4(), name: 'Louver End Cap', qtyPerShutter: 2, rate: 50, unit: 'per_shutter_or_door' },
    { id: uuidv4(), name: 'Mounting Bracket', qtyPerShutter: 2, rate: 100, unit: 'per_shutter_or_door' },
];

const DEFAULT_LOUVERS_SERIES: ProfileSeries = {
    id: 'series-louvers-default',
    name: 'Standard Louver Series',
    type: WindowType.LOUVERS,
    dimensions: { ...BASE_DIMENSIONS, louverProfile: 50 },
    hardwareItems: DEFAULT_LOUVERS_HARDWARE,
    glassOptions: { thicknesses: [], customThicknessAllowed: false, specialTypes: [] },
};

const DEFAULT_QUOTATION_SETTINGS: QuotationSettings = {
    company: { logo: '/logo.jpg', name: 'WoodenMax', address: '123 Wood Lane, Timber Town', email: 'info@woodenmax.com', website: 'www.woodenmax.in', gstNumber: '' },
    customer: { name: '', address: '', contactPerson: '', email: '', website: '', gstNumber: '', architectName: '' },
    financials: { gstPercentage: 18, discount: 0, discountType: 'percentage' },
    bankDetails: { name: '', accountNumber: '', ifsc: '', branch: '', accountType: 'current' },
    title: 'Quotation - WoodenMax Window Designer',
    terms: '1. 50% advance payment required.\n2. Prices are exclusive of taxes.\n3. Delivery within 4-6 weeks.',
    description: 'Supply and installation of premium aluminium windows and partitions as per the agreed specifications.',
    materialRates: DEFAULT_MATERIAL_RATES,
};

const defaultCornerSideConfig: CornerSideConfig = {
    windowType: WindowType.SLIDING,
    trackType: TrackType.TWO_TRACK,
    shutterConfig: ShutterConfigType.TWO_GLASS,
    fixedShutters: [],
    slidingHandles: [],
    verticalDividers: [],
    horizontalDividers: [],
    doorPositions: [],
    ventilatorGrid: [],
};

const defaultGlassGridPattern = { count: 0, offset: 100, gap: 200 };
const defaultGlassGrid: GlassGridConfig = {
    applyToAll: true,
    barThickness: 15,
    patterns: {
        'default': {
            horizontal: { ...defaultGlassGridPattern },
            vertical: { ...defaultGlassGridPattern }
        }
    }
};

const initialConfig: ConfigState = {
    width: 1500,
    height: 1200,
    fixedPanels: [],
    glassType: GlassType.CLEAR,
    glassTexture: '',
    glassThickness: 8,
    customGlassName: '',
    glassSpecialType: 'none',
    profileColor: '#374151',
    profileTexture: '',
    glassGrid: defaultGlassGrid,
    windowType: WindowType.SLIDING,
    laminatedGlassConfig: {
        glass1Thickness: 6,
        glass1Type: GlassType.CLEAR,
        pvbThickness: 1.52,
        pvbType: 'clear',
        glass2Thickness: 5,
        glass2Type: GlassType.CLEAR,
        isToughened: true,
    },
    dguGlassConfig: {
        glass1Thickness: 6,
        glass1Type: GlassType.CLEAR,
        airGap: 12,
        glass2Thickness: 6,
        glass2Type: GlassType.CLEAR,
        isToughened: true,
    },
    trackType: TrackType.TWO_TRACK,
    shutterConfig: ShutterConfigType.TWO_GLASS,
    fixedShutters: [],
    slidingHandles: [],
    verticalDividers: [],
    horizontalDividers: [],
    doorPositions: [],
    ventilatorGrid: [],
    partitionPanels: { count: 2, types: [{ type: 'fixed' }, { type: 'sliding' }], hasTopChannel: true },
    louverPattern: [{ id: uuidv4(), type: 'profile', size: 50 }, { id: uuidv4(), type: 'gap', size: 50 }],
    orientation: 'vertical',
    louverBays: [],
    louverBayLayout: 'vertical',
    leftWidth: 1200,
    rightWidth: 1200,
    cornerPostWidth: 100,
    leftConfig: defaultCornerSideConfig,
    rightConfig: { ...defaultCornerSideConfig, verticalDividers: [0.5], doorPositions: [{ row: 0, col: 0 }, { row: 0, col: 1 }] },
    mirrorConfig: {
        shape: MirrorShape.RECTANGLE,
        isFrameless: false,
        cornerRadius: 50,
    },
    casementOutline: {
        shape: 'rect',
        cornerRadiusMm: 40,
        archStraightBottomMm: '',
        archSpringRatio: 0.28,
        archRadialMullions: 2,
        archMullionAngles: [],
        archInnerRingCount: 0,
        archInnerRingGapMm: 16,
    },
};

const SERIES_MAP: Record<WindowType, ProfileSeries> = {
    [WindowType.SLIDING]: DEFAULT_SLIDING_SERIES,
    [WindowType.CASEMENT]: DEFAULT_CASEMENT_SERIES,
    [WindowType.VENTILATOR]: DEFAULT_VENTILATOR_SERIES,
    [WindowType.GLASS_PARTITION]: DEFAULT_GLASS_PARTITION_SERIES,
    [WindowType.CORNER]: DEFAULT_CORNER_SERIES,
    [WindowType.MIRROR]: DEFAULT_MIRROR_SERIES,
    [WindowType.LOUVERS]: DEFAULT_LOUVERS_SERIES,
};

function withLouverOuterSynced(state: ConfigState, separatorMm = 0): ConfigState {
    if (state.windowType !== WindowType.LOUVERS) return state;
    const wc = state as unknown as WindowConfig;
    const bays = getValidLouverBays(wc);
    const layout = state.louverBayLayout || 'vertical';
    const sep = Number.isFinite(separatorMm) && separatorMm >= 0 ? separatorMm : 0;
    if (bays.length === 0) return state;
    if (bays.length === 1) {
        return { ...state, width: bays[0].width, height: bays[0].height };
    }
    const outer = getLouverCompoundOuterMm(bays, layout, sep);
    return { ...state, width: outer.width, height: outer.height };
}

function configReducer(state: ConfigState, action: ConfigAction): ConfigState {
    const getSideConfig = (side: 'left' | 'right' | null): [keyof ConfigState | null, ConfigState | CornerSideConfig] => {
      if (state.windowType === WindowType.CORNER && side) {
        const key = side === 'left' ? 'leftConfig' : 'rightConfig';
        return [key, state[key]!];
      }
      return [null, state];
    };

    switch (action.type) {
        case 'SET_FIELD':
            return { ...state, [action.field]: action.payload };
        case 'SET_SIDE_CONFIG': {
            const { side, config } = action.payload;
            const configKey = side === 'left' ? 'leftConfig' : 'rightConfig';
            return {
                ...state,
                [configKey]: { ...state[configKey]!, ...config },
            };
        }
        case 'ADD_FIXED_PANEL':
            if (state.fixedPanels.some(p => p.position === action.payload)) return state;
            return { ...state, fixedPanels: [...state.fixedPanels, { id: uuidv4(), position: action.payload, size: 300 }] };
        case 'REMOVE_FIXED_PANEL':
            return { ...state, fixedPanels: state.fixedPanels.filter(p => p.id !== action.payload) };
        case 'UPDATE_FIXED_PANEL_SIZE':
            return { ...state, fixedPanels: state.fixedPanels.map(p => p.id === action.payload.id ? { ...p, size: action.payload.size } : p) };
        case 'TOGGLE_DOOR_POSITION': {
            const { row, col, side } = action.payload;
            const [configKey, config] = getSideConfig(side);
            const gridRows = config.horizontalDividers.length + 1;
            const gridCols = config.verticalDividers.length + 1;
            if ('casementOutline' in config && isOutlineBandCell(config, row, col, gridRows, gridCols)) {
              return state;
            }
            if (row === 0 && 'casementOutline' in config && config.casementOutline?.shape === 'arch_top') {
              return state;
            }
            const exists = config.doorPositions.some(p => p.row === row && p.col === col);
            const newDoorPositions = exists 
                ? config.doorPositions.filter(p => p.row !== row || p.col !== col) 
                : [...config.doorPositions, { row, col }];
            
            if (configKey) {
                return { ...state, [configKey]: { ...config, doorPositions: newDoorPositions } };
            }
            return { ...state, doorPositions: newDoorPositions };
        }
        case 'HANDLE_VENTILATOR_CELL_CLICK': {
            const { row, col, side } = action.payload;
            const [configKey, config] = getSideConfig(side);
            const gridRows = config.horizontalDividers.length + 1;
            const gridCols = config.verticalDividers.length + 1;
            if ('casementOutline' in config && isOutlineBandCell(config, row, col, gridRows, gridCols)) {
              return state;
            }
            const sequence: VentilatorCellType[] = ['glass', 'louvers', 'door', 'exhaust_fan'];
            const newGrid = config.ventilatorGrid.map(r => r.slice());
            const currentType = newGrid[row][col].type;
            const currentIndex = sequence.indexOf(currentType);
            const nextType = sequence[(currentIndex + 1) % sequence.length];
            newGrid[row][col] = { ...newGrid[row][col], type: nextType };
            if (nextType !== 'door' && newGrid[row][col].handle) {
                delete newGrid[row][col].handle;
            }
            if (configKey) {
                return { ...state, [configKey]: { ...config, ventilatorGrid: newGrid } };
            }
            return { ...state, ventilatorGrid: newGrid };
        }
        case 'SET_GRID_SIZE': {
            const { rows, cols, side } = action.payload;
            const [configKey, config] = getSideConfig(side);
            let newH = Array.from({ length: rows - 1 }).map((_, i) => (i + 1) / rows);
            const newV = Array.from({ length: cols - 1 }).map((_, i) => (i + 1) / cols);
            if ('casementOutline' in config && isArchTopOutline(config as WindowConfig)) {
              const host = configKey
                ? ({ ...state, [configKey]: config } as WindowConfig)
                : (state as WindowConfig);
              const inner = computeInnerHoleDims({
                ...host,
                series: host.series ?? SERIES_MAP[host.windowType],
              });
              newH = buildArchGridHorizontalDividers(rows, config as WindowConfig, inner.innerW, inner.innerH);
            }
            const newConfig = { ...config, horizontalDividers: newH, verticalDividers: newV };
            if (configKey) {
                return { ...state, [configKey]: newConfig };
            }
            return { ...state, ...newConfig };
        }
        case 'REMOVE_VERTICAL_DIVIDER': {
            const { index, side } = action.payload;
            const [configKey, config] = getSideConfig(side);
            const verticalDividers = config.verticalDividers.filter((_, i) => i !== index);
            const ventilatorGrid = config.ventilatorGrid.map(row => { row.splice(index + 1, 1); return row; });
            const doorPositions = config.doorPositions.filter(p => p.col !== index + 1).map(p => p.col > index + 1 ? { ...p, col: p.col - 1 } : p);
            const newConfig = { ...config, verticalDividers, ventilatorGrid, doorPositions };
            if (configKey) {
                return { ...state, [configKey]: newConfig };
            }
            return { ...state, ...newConfig };
        }
        case 'REMOVE_HORIZONTAL_DIVIDER': {
            const { index, side } = action.payload;
            const [configKey, config] = getSideConfig(side);
            if ('casementOutline' in config && isArchTopOutline(config as WindowConfig) && index === 0) {
              return state;
            }
            const horizontalDividers = config.horizontalDividers.filter((_, i) => i !== index);
            const ventilatorGrid = [...config.ventilatorGrid];
            ventilatorGrid.splice(index + 1, 1);
            const doorPositions = config.doorPositions.filter(p => p.row !== index + 1).map(p => p.row > index + 1 ? { ...p, row: p.row - 1 } : p);
            const newConfig = { ...config, horizontalDividers, ventilatorGrid, doorPositions };
            if (configKey) {
                return { ...state, [configKey]: newConfig };
            }
            return { ...state, ...newConfig };
        }
        case 'REMOVE_H_MULLION_SEGMENT': {
            const { dividerIndex, col, side } = action.payload;
            const [configKey, config] = getSideConfig(side);
            if ('casementOutline' in config && isArchTopOutline(config as WindowConfig) && dividerIndex === 0) {
              return state;
            }
            const gridCols = config.verticalDividers.length + 1;
            const nextHidden = withHiddenHSegment(config as WindowConfig, dividerIndex, col);
            if (allHSegmentsHidden(nextHidden!, dividerIndex, gridCols)) {
              const horizontalDividers = config.horizontalDividers.filter((_, i) => i !== dividerIndex);
              const ventilatorGrid = [...config.ventilatorGrid];
              ventilatorGrid.splice(dividerIndex + 1, 1);
              const doorPositions = config.doorPositions
                .filter((p) => p.row !== dividerIndex + 1)
                .map((p) => (p.row > dividerIndex + 1 ? { ...p, row: p.row - 1 } : p));
              const hiddenMullionSegments = pruneHiddenForRemovedHDivider(nextHidden!, dividerIndex);
              const newConfig = { ...config, horizontalDividers, ventilatorGrid, doorPositions, hiddenMullionSegments };
              if (configKey) return { ...state, [configKey]: newConfig };
              return { ...state, ...newConfig };
            }
            const newConfig = { ...config, hiddenMullionSegments: nextHidden };
            if (configKey) return { ...state, [configKey]: newConfig };
            return { ...state, ...newConfig };
        }
        case 'REMOVE_V_MULLION_SEGMENT': {
            const { dividerIndex, row, side } = action.payload;
            const [configKey, config] = getSideConfig(side);
            const gridRows = config.horizontalDividers.length + 1;
            const nextHidden = withHiddenVSegment(config as WindowConfig, dividerIndex, row);
            if (allVSegmentsHidden(nextHidden!, dividerIndex, gridRows)) {
              const verticalDividers = config.verticalDividers.filter((_, i) => i !== dividerIndex);
              const ventilatorGrid = config.ventilatorGrid.map((r) => {
                r.splice(dividerIndex + 1, 1);
                return r;
              });
              const doorPositions = config.doorPositions
                .filter((p) => p.col !== dividerIndex + 1)
                .map((p) => (p.col > dividerIndex + 1 ? { ...p, col: p.col - 1 } : p));
              const hiddenMullionSegments = pruneHiddenForRemovedVDivider(nextHidden!, dividerIndex);
              const newConfig = { ...config, verticalDividers, ventilatorGrid, doorPositions, hiddenMullionSegments };
              if (configKey) return { ...state, [configKey]: newConfig };
              return { ...state, ...newConfig };
            }
            const newConfig = { ...config, hiddenMullionSegments: nextHidden };
            if (configKey) return { ...state, [configKey]: newConfig };
            return { ...state, ...newConfig };
        }
        case 'MOVE_HORIZONTAL_DIVIDER': {
            const { index, ratio, side } = action.payload;
            const [configKey, config] = getSideConfig(side);
            const clamped = Math.max(0.05, Math.min(0.95, ratio));
            const h = [...config.horizontalDividers];
            if (index < 0 || index >= h.length) return state;
            h[index] = clamped;
            let newConfig: typeof config = { ...config, horizontalDividers: h };
            if ('casementOutline' in config && isArchTopOutline(config as WindowConfig) && index === 0) {
              const host = configKey ? ({ ...state, [configKey]: config } as WindowConfig) : (state as WindowConfig);
              const inner = computeInnerHoleDims({ ...host, series: host.series ?? SERIES_MAP[host.windowType] });
              const straightBottom = Math.max(0, inner.innerH * (1 - clamped));
              const patch = applyArchStraightBottomLayout(
                { ...(config as WindowConfig), horizontalDividers: h },
                inner.innerW,
                inner.innerH,
                Math.round(straightBottom),
              );
              newConfig = {
                ...config,
                horizontalDividers: patch.horizontalDividers,
                casementOutline: patch.casementOutline,
              };
            }
            if (configKey) return { ...state, [configKey]: newConfig };
            return { ...state, ...newConfig };
        }
        case 'MOVE_VERTICAL_DIVIDER': {
            const { index, ratio, side } = action.payload;
            const [configKey, config] = getSideConfig(side);
            const clamped = Math.max(0.05, Math.min(0.95, ratio));
            const v = [...config.verticalDividers];
            if (index < 0 || index >= v.length) return state;
            v[index] = clamped;
            const newConfig = { ...config, verticalDividers: v };
            if (configKey) return { ...state, [configKey]: newConfig };
            return { ...state, ...newConfig };
        }
        case 'UPDATE_HANDLE': {
            const { panelId, newConfig, side } = action.payload;
            const parts = panelId.split('-');
            const type = parts[0];

            const [configKey, config] = getSideConfig(side);
            let newSideConfig = { ...config };

            switch (type) {
                case 'sliding': {
                    const index = parseInt(parts[1], 10);
                    const newHandles = [...(config.slidingHandles ?? [])];
                    while (newHandles.length <= index) newHandles.push(null);
                    newHandles[index] = newConfig;
                    newSideConfig.slidingHandles = newHandles;
                    break;
                }
                case 'casement': {
                    const row = parseInt(parts[1], 10);
                    const col = parseInt(parts[2], 10);
                    newSideConfig.doorPositions = config.doorPositions.map(p => {
                        if (p.row === row && p.col === col) {
                            if (newConfig) return { ...p, handle: newConfig };
                            const { handle, ...rest } = p;
                            return rest;
                        }
                        return p;
                    });
                    break;
                }
                case 'ventilator': {
                    const row = parseInt(parts[1], 10);
                    const col = parseInt(parts[2], 10);
                    const newGrid = config.ventilatorGrid.map(r => r.slice());
                    if (newConfig) {
                        newGrid[row][col] = { ...newGrid[row][col], handle: newConfig };
                    } else if (newGrid[row][col]) {
                        delete newGrid[row][col].handle;
                    }
                    newSideConfig.ventilatorGrid = newGrid;
                    break;
                }
                case 'partition': { 
                    const index = parseInt(parts[1], 10);
                    const newTypes = [...state.partitionPanels.types];
                    if (newConfig) {
                        newTypes[index] = { ...newTypes[index], handle: newConfig };
                    } else if (newTypes[index]) {
                        delete newTypes[index].handle;
                    }
                    return { ...state, partitionPanels: { ...state.partitionPanels, types: newTypes } };
                }
            }

            if (configKey) {
                return { ...state, [configKey]: newSideConfig };
            }
            return { ...state, ...newSideConfig };
        }
        case 'SET_WINDOW_TYPE': {
            const newType = action.payload;

            // Preserve essential properties that should carry over between designs
            const preservedState = {
                width: state.width,
                height: state.height,
                profileColor: state.profileColor,
                profileTexture: state.profileTexture,
                glassType: state.glassType,
                glassThickness: state.glassThickness,
                glassSpecialType: state.glassSpecialType,
                laminatedGlassConfig: state.laminatedGlassConfig,
                dguGlassConfig: state.dguGlassConfig,
                glassGrid: state.glassGrid,
                customGlassName: state.customGlassName,
                glassTexture: state.glassTexture,
                // For corner windows, we need to preserve their specific dimensions and configs
                leftWidth: state.leftWidth,
                rightWidth: state.rightWidth,
                cornerPostWidth: state.cornerPostWidth,
                leftConfig: state.leftConfig,
                rightConfig: state.rightConfig,
            };

            // Start with a clean slate from initialConfig, apply preserved state, then set new type
            const newState: ConfigState = {
                ...initialConfig,
                ...preservedState,
                windowType: newType,
            };

            // Special handling for corner windows to ensure side configs exist if they were null
            if (newType === WindowType.CORNER) {
                newState.leftConfig = state.leftConfig || defaultCornerSideConfig;
                newState.rightConfig = state.rightConfig || defaultCornerSideConfig;
            }

            if (newType === WindowType.CASEMENT || newType === WindowType.VENTILATOR) {
                Object.assign(newState, getPlainCasementVentilatorFields());
            }

            return newState;
        }
        case 'SET_PARTITION_PANEL_COUNT': {
          const count = Math.max(1, action.payload);
          const old = state.partitionPanels;
          const newTypes = Array.from({ length: count }, (_, i) => old.types[i] || { type: 'fixed' as PartitionPanelType });
          let wf = old.widthFractions;
          if (!wf || wf.length !== count) {
            wf = Array.from({ length: count }, () => 1 / count);
          }
          return {
            ...state,
            partitionPanels: {
              ...old,
              count,
              types: newTypes,
              widthFractions: wf,
            },
          };
        }
        case 'SET_PARTITION_PRESET': {
          const p = action.payload;
          const wf =
            p.widthFractions && p.widthFractions.length === p.count
              ? [...p.widthFractions]
              : Array.from({ length: p.count }, () => 1 / p.count);
          return {
            ...state,
            partitionPanels: {
              count: p.count,
              types: p.types.map((t) => ({ ...t })),
              hasTopChannel: p.hasTopChannel,
              widthFractions: wf,
            },
          };
        }
        case 'SET_PARTITION_WIDTH_FRACTIONS': {
          const raw = action.payload;
          const count = state.partitionPanels.count;
          const padded =
            raw.length >= count
              ? raw.slice(0, count)
              : [...raw, ...Array.from({ length: count - raw.length }, () => 1)];
          const sum = padded.reduce((a, b) => a + Math.max(0.0001, b), 0);
          const widthFractions = padded.map((x) => Math.max(0.0001, x) / sum);
          return {
            ...state,
            partitionPanels: { ...state.partitionPanels, widthFractions },
          };
        }
        case 'CYCLE_PARTITION_PANEL_TYPE': {
            const index = action.payload;
            const sequence: PartitionPanelType[] = ['fixed', 'sliding', 'hinged', 'fold'];
            const currentConfig = state.partitionPanels.types[index];
            const currentType = currentConfig.type;
            let ci = sequence.indexOf(currentType);
            if (ci === -1) ci = 0;
            const nextType = sequence[(ci + 1) % sequence.length];
            const newTypes = [...state.partitionPanels.types];
            newTypes[index] = { ...currentConfig, type: nextType };
            if (nextType === 'fixed' && newTypes[index].handle) {
                delete newTypes[index].handle;
            }
            if (nextType === 'fold') {
                if (newTypes[index].foldLeafCount == null) newTypes[index].foldLeafCount = 2;
            } else {
                delete newTypes[index].foldLeafCount;
                delete newTypes[index].foldFrameTopMm;
                delete newTypes[index].foldFrameBottomMm;
                delete newTypes[index].foldFrameSideMm;
                delete newTypes[index].foldFrameLeftMm;
                delete newTypes[index].foldFrameRightMm;
            }
            return { ...state, partitionPanels: { ...state.partitionPanels, types: newTypes } };
        }
        case 'SET_PARTITION_HAS_TOP_CHANNEL': {
            return { ...state, partitionPanels: { ...state.partitionPanels, hasTopChannel: action.payload }};
        }
        case 'CYCLE_PARTITION_PANEL_FRAMING': {
            const index = action.payload;
            const newTypes = [...state.partitionPanels.types];
            const currentFraming = newTypes[index].framing || 'none';
            newTypes[index] = { ...newTypes[index], framing: currentFraming === 'none' ? 'full' : 'none' };
            return { ...state, partitionPanels: { ...state.partitionPanels, types: newTypes } };
        }
        case 'UPDATE_PARTITION_PANEL': {
            const { index, partial } = action.payload;
            const newTypes = [...state.partitionPanels.types];
            if (!newTypes[index]) return state;
            newTypes[index] = { ...newTypes[index], ...partial };
            if ('heightMm' in partial && (partial.heightMm === '' || partial.heightMm == null)) {
              delete newTypes[index].heightAlign;
            }
            if (newTypes[index].type === 'fixed' && newTypes[index].handle) {
              delete newTypes[index].handle;
            }
            return { ...state, partitionPanels: { ...state.partitionPanels, types: newTypes } };
        }
        case 'ADD_LOUVER_ITEM':
            return { ...state, louverPattern: [...state.louverPattern, { id: uuidv4(), type: action.payload.type, size: 50 }] };
        case 'REMOVE_LOUVER_ITEM':
            return { ...state, louverPattern: state.louverPattern.filter(item => item.id !== action.payload.id) };
        case 'UPDATE_LOUVER_ITEM':
            return { ...state, louverPattern: state.louverPattern.map(item => item.id === action.payload.id ? { ...item, size: action.payload.size } : item) };
        case 'ADD_LOUVER_BAY': {
            const sep = action.payload.separatorMm ?? 0;
            let bays = [...(state.louverBays ?? [])];
            if (bays.length >= LOUVER_BAY_MAX) return state;
            if (bays.length === 0) {
                const w = Number(state.width) || 1500;
                const h = Number(state.height) || 1200;
                bays = [
                    { id: uuidv4(), width: w, height: h, crossAlign: 'top' },
                    { id: uuidv4(), width: Math.round(w * 0.62) || 920, height: Math.round(h * 0.52) || 620, crossAlign: 'center' },
                ];
            } else {
                const last = bays[bays.length - 1];
                bays.push({
                    id: uuidv4(),
                    width: Number(last.width) || 900,
                    height: Number(last.height) || 1200,
                    crossAlign: 'center',
                });
            }
            return withLouverOuterSynced({ ...state, louverBays: bays }, sep);
        }
        case 'REMOVE_LOUVER_BAY': {
            const filtered = (state.louverBays ?? []).filter((b) => b.id !== action.payload.id);
            const sep = action.payload.separatorMm ?? 0;
            const temp = { ...state, louverBays: filtered } as WindowConfig;
            const valid = getValidLouverBays(temp);
            if (valid.length <= 1) {
                const w = valid.length === 1 ? valid[0].width : Number(state.width) || 0;
                const h = valid.length === 1 ? valid[0].height : Number(state.height) || 0;
                return {
                    ...state,
                    louverBays: [],
                    louverBayLayout: 'vertical',
                    width: w,
                    height: h,
                };
            }
            return withLouverOuterSynced({ ...state, louverBays: filtered }, sep);
        }
        case 'UPDATE_LOUVER_BAY': {
            const { id, separatorMm, width: bw, height: bh, crossAlign, offsetMm } = action.payload;
            const louverBays = (state.louverBays ?? []).map((b) =>
                b.id !== id
                    ? b
                    : {
                          ...b,
                          ...(bw !== undefined ? { width: bw } : {}),
                          ...(bh !== undefined ? { height: bh } : {}),
                          ...(crossAlign !== undefined ? { crossAlign } : {}),
                          ...(offsetMm !== undefined ? { offsetMm } : {}),
                      },
            );
            return withLouverOuterSynced({ ...state, louverBays }, separatorMm ?? 0);
        }
        case 'SET_LOUVER_BAY_LAYOUT': {
            const { layout, separatorMm } = action.payload;
            const next = { ...state, louverBayLayout: layout };
            if (getValidLouverBays(next as unknown as WindowConfig).length < 2) return next;
            return withLouverOuterSynced(next, separatorMm ?? 0);
        }
        case 'CLEAR_LOUVER_BAYS':
            return { ...state, louverBays: [], louverBayLayout: 'vertical' };
        case 'UPDATE_LAMINATED_CONFIG':
            return { ...state, laminatedGlassConfig: { ...state.laminatedGlassConfig, ...action.payload } };
        case 'UPDATE_DGU_CONFIG':
            return { ...state, dguGlassConfig: { ...state.dguGlassConfig, ...action.payload } };
        case 'UPDATE_MIRROR_CONFIG':
            return { ...state, mirrorConfig: { ...state.mirrorConfig, ...action.payload } };
        case 'LOAD_CONFIG': {
            const parsed = action.payload;
            const finalConfig: ConfigState = {
              ...initialConfig,
              ...parsed,
              glassGrid: { ...initialConfig.glassGrid, ...(parsed.glassGrid || {}) },
              glassTexture: parsed.glassTexture || '',
              profileTexture: parsed.profileTexture ?? '',
              partitionPanels: { ...initialConfig.partitionPanels, ...(parsed.partitionPanels || {}) },
              laminatedGlassConfig: { ...initialConfig.laminatedGlassConfig, ...(parsed.laminatedGlassConfig || {}) },
              dguGlassConfig: { ...initialConfig.dguGlassConfig, ...(parsed.dguGlassConfig || {}) },
              mirrorConfig: { ...initialConfig.mirrorConfig, ...(parsed.mirrorConfig || {}) },
              leftConfig: { ...defaultCornerSideConfig, ...(parsed.leftConfig || {}) },
              rightConfig: { ...defaultCornerSideConfig, ...(parsed.rightConfig || {}) },
              louverPattern: parsed.louverPattern || initialConfig.louverPattern,
              orientation: parsed.orientation || initialConfig.orientation,
              louverBays: Array.isArray(parsed.louverBays) ? parsed.louverBays : initialConfig.louverBays,
              louverBayLayout:
                parsed.louverBayLayout === 'horizontal' ? 'horizontal' : 'vertical',
            };
            finalConfig.partitionPanels.types = finalConfig.partitionPanels.types || [];
            if (finalConfig.leftConfig) {
                finalConfig.leftConfig.slidingHandles = finalConfig.leftConfig.slidingHandles || [];
                finalConfig.leftConfig.doorPositions = finalConfig.leftConfig.doorPositions || [];
                finalConfig.leftConfig.ventilatorGrid = finalConfig.leftConfig.ventilatorGrid || [];
            }
            if (finalConfig.rightConfig) {
                finalConfig.rightConfig.slidingHandles = finalConfig.rightConfig.slidingHandles || [];
                finalConfig.rightConfig.doorPositions = finalConfig.rightConfig.doorPositions || [];
                finalConfig.rightConfig.ventilatorGrid = finalConfig.rightConfig.ventilatorGrid || [];
            }
            return withLouverOuterSynced(finalConfig, 50);
        }
        case 'RESET_DESIGN': {
             const base = {
                ...initialConfig,
                windowType: state.windowType,
            };
             try {
               const d = loadHomeownerDefaults();
               return d ? (applyHomeownerDefaultsToConfig(base as any, d) as any) : base;
             } catch {
               return base;
             }
        }
        case 'LOAD_CONFIG_STATE':
            return withLouverOuterSynced({ ...action.payload }, 50);
        default:
            return state;
    }
}

const getInitialConfig = (): ConfigState => {
  try {
    const saved = window.localStorage.getItem('woodenmax-current-config');
    if (saved) {
      const parsed = JSON.parse(saved);
      
      if (typeof parsed !== 'object' || parsed === null) {
        console.warn("Invalid config in localStorage, falling back to default.");
        return initialConfig;
      }

      // --- Migration for Glass Grid ---
      if (parsed.glassGrid && typeof parsed.glassGrid.rows !== 'undefined') {
          const newGlassGrid: GlassGridConfig = JSON.parse(JSON.stringify(defaultGlassGrid));
          newGlassGrid.patterns['default'].vertical.count = parsed.glassGrid.cols || 0;
          newGlassGrid.patterns['default'].horizontal.count = parsed.glassGrid.rows || 0;
          // If bar thickness was in series, move it
          if (parsed.series?.dimensions?.glassGridProfile) {
              newGlassGrid.barThickness = parsed.series.dimensions.glassGridProfile;
          }
          parsed.glassGrid = newGlassGrid;
          delete parsed.legacyGlassGrid; // or delete parsed.glassGrid if it was named that
      }


      // Create a new config, starting with defaults, then overriding with saved values.
      const finalConfig: ConfigState = {
          ...initialConfig,
          ...parsed,
          glassGrid: { ...initialConfig.glassGrid, ...(parsed.glassGrid || {}) },
          glassTexture: parsed.glassTexture || '',
          partitionPanels: { ...initialConfig.partitionPanels, ...(parsed.partitionPanels || {}) },
          laminatedGlassConfig: { ...initialConfig.laminatedGlassConfig, ...(parsed.laminatedGlassConfig || {}) },
          dguGlassConfig: { ...initialConfig.dguGlassConfig, ...(parsed.dguGlassConfig || {}) },
          mirrorConfig: { ...initialConfig.mirrorConfig, ...(parsed.mirrorConfig || {}) },
          leftConfig: { ...defaultCornerSideConfig, ...(parsed.leftConfig || {}) },
          rightConfig: { ...defaultCornerSideConfig, ...(parsed.rightConfig || {}) },
          louverPattern: parsed.louverPattern || initialConfig.louverPattern,
          orientation: parsed.orientation || initialConfig.orientation,
          louverBays: Array.isArray(parsed.louverBays) ? parsed.louverBays : initialConfig.louverBays,
          louverBayLayout: parsed.louverBayLayout === 'horizontal' ? 'horizontal' : 'vertical',
      };

      // Ensure critical arrays inside nested objects are present
      finalConfig.partitionPanels.types = finalConfig.partitionPanels.types || [];
      if (finalConfig.leftConfig) {
        finalConfig.leftConfig.slidingHandles = finalConfig.leftConfig.slidingHandles || [];
        finalConfig.leftConfig.doorPositions = finalConfig.leftConfig.doorPositions || [];
        finalConfig.leftConfig.ventilatorGrid = finalConfig.leftConfig.ventilatorGrid || [];
      }
      if (finalConfig.rightConfig) {
        finalConfig.rightConfig.slidingHandles = finalConfig.rightConfig.slidingHandles || [];
        finalConfig.rightConfig.doorPositions = finalConfig.rightConfig.doorPositions || [];
        finalConfig.rightConfig.ventilatorGrid = finalConfig.rightConfig.ventilatorGrid || [];
      }
      
      // Specific migrations for older state shapes
      if (typeof finalConfig.partitionPanels.hasTopChannel === 'undefined') {
          finalConfig.partitionPanels.hasTopChannel = true;
      }
      if (finalConfig.partitionPanels.types) {
          finalConfig.partitionPanels.types.forEach((t: any) => {
              if (t && typeof t.framing === 'undefined') t.framing = 'none';
          });
      }

            const base = withLouverOuterSynced(
              sanitizeCasementOpeningIfNotUserSet(finalConfig),
              50,
            );
            const sessionPhoto = loadSessionPrintElevationPhoto();
            if (sessionPhoto) base.printElevationPhoto = sessionPhoto;
            const d = loadHomeownerDefaults();
            return d ? (applyHomeownerDefaultsToConfig(base as any, d) as any) : base;
    }
  } catch (error) {
    console.error("Could not load current config from localStorage", error);
  }
  const d = loadHomeownerDefaults();
  return d ? (applyHomeownerDefaultsToConfig(initialConfig as any, d) as any) : initialConfig;
};

type MobilePanelState = 'none' | 'configure' | 'quotation';
type AppView = 'designer' | 'guides' | 'railing';

interface DesignerViewProps {
  onOpenGuides: () => void;
  installPrompt: BeforeInstallPromptEvent | null;
  handleInstallClick: () => void;
  panelRef: React.RefObject<HTMLDivElement>;
  isDesktopPanelOpen: boolean;
  setIsDesktopPanelOpen: (isOpen: boolean) => void;
  commonControlProps: any; // Using any for brevity, but it's the complex object
  canvasKey: string;
  windowConfig: WindowConfig;
  handleRemoveVerticalDivider: (index: number) => void;
  handleRemoveHorizontalDivider: (index: number) => void;
  handleRemoveHMullionSegment: (dividerIndex: number, col: number) => void;
  handleRemoveVMullionSegment: (dividerIndex: number, row: number) => void;
  handleMoveHorizontalDivider: (index: number, ratio: number) => void;
  handleMoveVerticalDivider: (index: number, ratio: number) => void;
  quantity: number | '';
  setQuantity: (value: number | '') => void;
  areaType: AreaType;
  setAreaType: (type: AreaType) => void;
  rate: number | '';
  setRate: (value: number | '') => void;
  onSave: () => void;
  onUpdate: () => void;
  onCancelEdit: () => void;
  editingItemId: string | null;
  onBatchAdd: () => void;
  windowTitle: string;
  setWindowTitle: (title: string) => void;
  hardwareCostPerWindow: number;
  quotationItemCount: number;
  onViewQuotation: () => void;
  bulkCorrectionLineCount: number;
  onApplyBulkCorrection: () => void;
  activeMobilePanel: MobilePanelState;
  handleOpenConfigure: () => void;
  handleOpenQuote: () => void;
  handleCloseMobilePanels: () => void;
  isEmbedded: boolean;
  onOpenShortcuts: () => void;
  quotationSettings: QuotationSettings;
  layoutCompanions: DesignLayoutUnit[];
  activeLayoutUnitId: DesignLayoutActiveUnit;
  onActiveLayoutUnitChange: (id: DesignLayoutActiveUnit) => void;
  onAddLayoutUnits: (units: DesignLayoutUnit[]) => void;
  onRemoveLayoutUnit: (id: string) => void;
  onUpdateLayoutUnit: (id: string, partial: Partial<DesignLayoutUnit>) => void;
  onSaveLayoutAllToQuotation: () => void;
  layoutPrimaryForCanvas: WindowConfig;
  layoutCompanionsForCanvas: DesignLayoutUnit[];
  layoutEstimate?: import('./utils/designLayout').LayoutEstimateRow[];
  onLayoutUnitRateChange: (unitId: string, rate: number | '') => void;
  printElevationPhoto?: string;
  onPrintElevationPhotoChange: (dataUrl: string | undefined) => void;
  printVisualWidthMm: number;
  printVisualHeightMm: number;
}

const DesignerView: React.FC<DesignerViewProps> = React.memo((props) => {
  const canvasViewportRef = useRef<HTMLDivElement>(null);
  const [showOpenViewModal, setShowOpenViewModal] = useState(false);
  const [show3DPreview, setShow3DPreview] = useState(false);
  const { state: userModeState, setMode: setUserMode } = useUserMode();

  const {
    onOpenGuides,
    installPrompt, handleInstallClick, panelRef, isDesktopPanelOpen, setIsDesktopPanelOpen,
    commonControlProps, canvasKey, windowConfig, handleRemoveVerticalDivider, handleRemoveHorizontalDivider,
    handleRemoveHMullionSegment, handleRemoveVMullionSegment, handleMoveHorizontalDivider, handleMoveVerticalDivider,
    quantity, setQuantity, areaType, setAreaType, rate, setRate,
    onSave, onUpdate, onCancelEdit, editingItemId,
    onBatchAdd, windowTitle, setWindowTitle, hardwareCostPerWindow, quotationItemCount,
    onViewQuotation, bulkCorrectionLineCount, onApplyBulkCorrection,
    activeMobilePanel, handleOpenConfigure, handleOpenQuote, handleCloseMobilePanels,
    isEmbedded,
    onOpenShortcuts,
    layoutCompanions,
    activeLayoutUnitId,
    onActiveLayoutUnitChange,
    onAddLayoutUnits,
    onRemoveLayoutUnit,
    onUpdateLayoutUnit,
    onSaveLayoutAllToQuotation,
    layoutPrimaryForCanvas,
    layoutCompanionsForCanvas,
    layoutEstimate,
    onLayoutUnitRateChange,
    printElevationPhoto,
    onPrintElevationPhotoChange,
    printVisualWidthMm,
    printVisualHeightMm,
  } = props;

  // Keep model in view after refresh — avoid scroll jumping to empty inflated height.
  useEffect(() => {
    const el = canvasViewportRef.current;
    if (!el) return;
    el.scrollTop = 0;
  }, [canvasKey, windowConfig.windowType]);

  const quotationOpeningMm2 = useMemo(() => getWindowQuotationAreaMm2(windowConfig), [windowConfig]);
  const openViewAvailable = useMemo(() => supportsOpenView(windowConfig), [windowConfig]);

  const layoutPlacements = useMemo(() => {
    if (layoutCompanionsForCanvas.length === 0) return undefined;
    return computeLayoutPlacements(layoutPrimaryForCanvas, windowTitle, layoutCompanionsForCanvas);
  }, [layoutPrimaryForCanvas, windowTitle, layoutCompanionsForCanvas]);

  return (
    <>
    <div className="flex min-h-0 min-w-0 flex-1 flex-col">
      {/* One flex child for app shell; keeps fixed mobile layers from breaking flex-1 on this scroller. */}
      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-x-hidden overflow-y-hidden">
      {!isEmbedded && (
      <header className="no-print z-40 flex shrink-0 flex-col gap-1 border-b border-slate-200/90 bg-gradient-to-b from-white to-slate-100 px-2.5 py-1.5 shadow-sm sm:flex-row sm:items-center sm:gap-2">
            <div className="flex min-w-0 flex-1 items-center gap-2 sm:gap-2.5">
              {/* Long SEO headings: Tailwind `sr-only` = visually hidden (not shown on screen). Visible line is the <p> tagline below. */}
              <div className="sr-only">
                <h1>WoodenMax Window Designer — system window calculators, aluminium &amp; uPVC online design, instant window quotations, profile optimizers, PDF &amp; BOM</h1>
                <h2>Window design &amp; costing: sliding 2/3 track, casement, ventilators, glass partitions, louvers, L-corner, mirrors</h2>
                <h3>Window quotation generator, cutting list &amp; material packing for fabricators, architects &amp; project teams</h3>
              </div>
              <div className="shrink-0 rounded-md bg-white px-1.5 py-1 shadow-sm ring-1 ring-slate-200/90">
                <Logo className="h-7 w-auto max-h-7 max-w-[min(100%,180px)] object-contain sm:h-8 sm:max-h-8" alt="WoodenMax logo" />
              </div>
              <p className="min-w-0 flex-1 text-[11px] font-medium leading-tight text-slate-700 sm:text-xs">
                Reshaping spaces — free window &amp; door design with instant quotations.
              </p>
            </div>
            <div className="flex min-h-9 shrink-0 items-center justify-end gap-1.5 sm:ml-auto sm:min-h-0">
              <WoodenMaxCatalogMenu />
              <div className="hidden items-center gap-1 rounded-md bg-white px-2 py-1 text-xs font-semibold text-slate-700 shadow-sm ring-1 ring-slate-200/90 sm:inline-flex">
                <span className="text-[11px] text-slate-500">Mode</span>
                <select
                  value={userModeState.mode}
                  onChange={(e) => setUserMode(e.target.value as UserMode)}
                  className="bg-transparent text-xs font-semibold text-slate-800 outline-none"
                  aria-label="Select user mode"
                >
                  <option value="homeowner">Homeowner</option>
                  <option value="architect">Architect</option>
                  <option value="manufacturer">Manufacturer</option>
                </select>
              </div>
              <Button onClick={onOpenGuides} variant="secondary" className="hidden px-2.5 py-1 text-xs sm:inline-flex">
                <DocumentTextIcon className="mr-1.5 h-4 w-4" /> Features &amp; Guides
              </Button>
              <Button onClick={onOpenShortcuts} variant="secondary" className="hidden px-2.5 py-1 text-xs sm:inline-flex">
                Keyboard
              </Button>
              <Button
                onClick={() => setShowOpenViewModal(true)}
                variant="secondary"
                className="hidden px-2.5 py-1 text-xs sm:inline-flex"
                disabled={!openViewAvailable}
                title={openViewAvailable ? 'Customer open view — sliding / fold / openable' : 'Open view: sliding, casement, ventilator, or operable partition only'}
              >
                Open View
              </Button>
              <Button
                onClick={() => setShow3DPreview(true)}
                variant="secondary"
                className="hidden px-2.5 py-1 text-xs sm:inline-flex"
                title="3D preview — orbit and slide open"
              >
                3D Preview
              </Button>
              <Button
                onClick={onOpenGuides}
                variant="secondary"
                className="inline-flex min-h-10 min-w-10 items-center justify-center p-0 sm:hidden"
                aria-label="Features and guides"
              >
                <DocumentTextIcon className="h-5 w-5" />
              </Button>
              <button
                type="button"
                className="inline-flex min-h-10 min-w-10 items-center justify-center rounded-md bg-white/10 text-[10px] font-bold text-slate-100 ring-1 ring-white/15 sm:hidden"
                onClick={() => {
                  const next = userModeState.mode === 'homeowner' ? 'architect' : userModeState.mode === 'architect' ? 'manufacturer' : 'homeowner'
                  setUserMode(next)
                }}
                aria-label={`Mode: ${labelForMode(userModeState.mode)}. Tap to change.`}
                title={`Mode: ${labelForMode(userModeState.mode)} (tap to change)`}
              >
                {userModeState.mode === 'manufacturer' ? 'MFG' : userModeState.mode === 'architect' ? 'ARC' : 'HOME'}
              </button>
              {installPrompt && (
                <Button onClick={handleInstallClick} variant="secondary" className="animate-pulse whitespace-nowrap px-2 py-1 text-[11px] sm:text-xs">
                  <DownloadIcon className="mr-1 h-3.5 w-3.5 sm:mr-1.5 sm:h-4 sm:w-4" />
                  <span className="hidden sm:inline">Add to Home Screen</span>
                  <span className="sm:hidden">Install app</span>
                </Button>
              )}
            </div>
        </header>
      )}
        <main className="flex min-h-0 w-full min-w-0 flex-1 flex-row items-stretch overflow-hidden">
            <div ref={panelRef} className={`hidden min-h-0 shrink-0 flex-col bg-slate-800 no-print transition-[width] duration-300 ease-in-out lg:flex z-30 ${isDesktopPanelOpen ? 'w-96' : 'w-0'}`}>
                <div className="flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
                    <ErrorBoundary title="Controls panel crashed">
                      <ControlsPanel
                        {...commonControlProps}
                        idPrefix="desktop-"
                        onClose={() => setIsDesktopPanelOpen(false)}
                        layoutCompanions={layoutCompanions}
                        activeLayoutUnitId={activeLayoutUnitId}
                        onActiveLayoutUnitChange={onActiveLayoutUnitChange}
                        onAddLayoutUnits={onAddLayoutUnits}
                        onRemoveLayoutUnit={onRemoveLayoutUnit}
                        onUpdateLayoutUnit={onUpdateLayoutUnit}
                        onSaveLayoutAllToQuotation={onSaveLayoutAllToQuotation}
                        windowTitle={windowTitle}
                      />
                    </ErrorBoundary>
                </div>
            </div>
            <div className="relative flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
                {!isDesktopPanelOpen && ( <button onClick={() => setIsDesktopPanelOpen(true)} className="absolute top-1/2 -translate-y-1/2 left-0 bg-slate-700 hover:bg-indigo-600 text-white w-6 h-24 rounded-r-lg z-20 focus:outline-none focus:ring-2 focus:ring-indigo-500 items-center justify-center transition-all duration-300 no-print hidden lg:flex" aria-label="Expand panel"> <ChevronLeftIcon className="w-5 h-5 rotate-180" /> </button> )}
              <SpringScrollArea
                ref={canvasViewportRef}
                className="relative flex min-h-0 min-w-0 flex-1 flex-col overflow-x-hidden overflow-y-auto overscroll-y-contain custom-scrollbar touch-pan-y"
              >
                <div className="box-border flex w-full min-h-full flex-col items-center justify-center gap-2 px-4 py-6">
                  {layoutCompanions.length > 0 ? (
                    <p className="text-center text-[11px] text-slate-400">
                      Window par click karein ya 1,2,3… select karein —{' '}
                      <strong className="text-indigo-300">
                        {activeLayoutUnitId === 'primary'
                          ? windowTitle || 'Window 1'
                          : layoutCompanions.find((c) => c.id === activeLayoutUnitId)?.title ?? 'Unit'}
                      </strong>{' '}
                      edit ho rahi hai
                    </p>
                  ) : null}
                  <ErrorBoundary title="Canvas crashed">
                    <WindowCanvas
                      key={canvasKey}
                      fitViewportRef={canvasViewportRef}
                      config={windowConfig}
                      layoutPlacements={layoutPlacements}
                      activeLayoutUnitId={activeLayoutUnitId}
                      onSelectLayoutUnit={onActiveLayoutUnitChange}
                      onRemoveVerticalDivider={handleRemoveVerticalDivider}
                      onRemoveHorizontalDivider={handleRemoveHorizontalDivider}
                      onRemoveHMullionSegment={handleRemoveHMullionSegment}
                      onRemoveVMullionSegment={handleRemoveVMullionSegment}
                      onMoveHorizontalDivider={handleMoveHorizontalDivider}
                      onMoveVerticalDivider={handleMoveVerticalDivider}
                      onToggleElevationDoor={() => {}}
                      onUpdateHandle={commonControlProps.onUpdateHandle}
                      enableDoorHandleDrag={userModeState.mode === 'homeowner'}
                    />
                  </ErrorBoundary>
                </div>
              </SpringScrollArea>
              <div className="no-print relative z-20 hidden max-h-[min(32vh,240px)] shrink-0 overflow-y-auto overscroll-y-contain border-t border-slate-700 custom-scrollbar lg:block lg:shadow-[0_-8px_24px_rgba(0,0,0,0.3)]">
                <QuotationPanel
                  idPrefix="desktop-"
                  width={Number(windowConfig.width) || 0}
                  height={Number(windowConfig.height) || 0}
                  quotationOpeningMm2={quotationOpeningMm2}
                  quantity={quantity}
                  setQuantity={setQuantity}
                  areaType={areaType}
                  setAreaType={setAreaType}
                  rate={rate}
                  setRate={setRate}
                  onSave={onSave}
                  onUpdate={onUpdate}
                  onCancelEdit={onCancelEdit}
                  editingItemId={editingItemId}
                  onBatchAdd={onBatchAdd}
                  windowTitle={windowTitle}
                  setWindowTitle={setWindowTitle}
                  hardwareCostPerWindow={hardwareCostPerWindow}
                  quotationItemCount={quotationItemCount}
                  onViewQuotation={onViewQuotation}
                  bulkCorrectionLineCount={bulkCorrectionLineCount}
                  onApplyBulkCorrection={onApplyBulkCorrection}
                  layoutEstimate={layoutEstimate}
                  activeLayoutUnitId={activeLayoutUnitId}
                  onLayoutUnitRateChange={onLayoutUnitRateChange}
                  onSaveLayoutAll={onSaveLayoutAllToQuotation}
                  printElevationPhoto={printElevationPhoto}
                  onPrintElevationPhotoChange={onPrintElevationPhotoChange}
                  printVisualWidthMm={printVisualWidthMm}
                  printVisualHeightMm={printVisualHeightMm}
                />
              </div>
              <div className="no-print grid grid-cols-2 gap-2 border-t border-slate-700 bg-slate-800 px-2 py-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] lg:hidden">
                  <Button onClick={handleOpenConfigure} variant="secondary" className="!h-10 !min-h-0 justify-center !px-2 !text-xs !font-semibold !shadow-none">
                    <AdjustmentsIcon className="mr-1.5 h-4 w-4 shrink-0" /> Configure
                  </Button>
                  <Button onClick={handleOpenQuote} variant="secondary" className="!h-10 !min-h-0 justify-center !px-2 !text-xs !font-semibold !shadow-none">
                    <ListBulletIcon className="mr-1.5 h-4 w-4 shrink-0" /> Quote
                  </Button>
              </div>
            </div>
        </main>
      </div>
        {/* Mobile Configure Panel */}
        <div className={`lg:hidden fixed inset-0 bg-black bg-opacity-50 z-40 transition-opacity duration-300 ${activeMobilePanel === 'configure' ? 'opacity-100' : 'opacity-0 pointer-events-none'}`} onClick={handleCloseMobilePanels}></div>
        <div className={`no-print fixed bottom-0 left-0 right-0 z-50 flex max-h-[90vh] h-[min(90vh,100dvh)] flex-col rounded-t-xl bg-slate-800 pb-[env(safe-area-inset-bottom)] shadow-[0_-8px_30px_rgba(0,0,0,0.35)] transition-transform duration-300 ease-in-out lg:hidden ${activeMobilePanel === 'configure' ? 'translate-y-0' : 'translate-y-full'}`}>
           <div className="flex shrink-0 justify-center py-2" aria-hidden="true">
             <div className="h-1.5 w-12 rounded-full bg-slate-600" />
           </div>
           <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
             <ErrorBoundary title="Controls panel crashed">
               <ControlsPanel
                 {...commonControlProps}
                 idPrefix="mobile-"
                 onClose={handleCloseMobilePanels}
                 layoutCompanions={layoutCompanions}
                 activeLayoutUnitId={activeLayoutUnitId}
                 onActiveLayoutUnitChange={onActiveLayoutUnitChange}
                 onAddLayoutUnits={onAddLayoutUnits}
                 onRemoveLayoutUnit={onRemoveLayoutUnit}
                 onUpdateLayoutUnit={onUpdateLayoutUnit}
                 onSaveLayoutAllToQuotation={onSaveLayoutAllToQuotation}
                 windowTitle={windowTitle}
               />
             </ErrorBoundary>
           </div>
        </div>
        
        {/* Mobile Quotation Panel */}
        <div className={`lg:hidden fixed inset-0 bg-black bg-opacity-50 z-40 transition-opacity duration-300 ${activeMobilePanel === 'quotation' ? 'opacity-100' : 'opacity-0 pointer-events-none'}`} onClick={handleCloseMobilePanels}></div>
        <div className={`no-print fixed bottom-0 left-0 right-0 z-50 flex max-h-[92vh] h-[min(92vh,100dvh)] flex-col rounded-t-xl bg-slate-800 pb-[env(safe-area-inset-bottom)] shadow-[0_-8px_30px_rgba(0,0,0,0.35)] transition-transform duration-300 ease-in-out lg:hidden ${activeMobilePanel === 'quotation' ? 'translate-y-0' : 'translate-y-full'}`}>
            <div className="flex shrink-0 justify-center py-2" aria-hidden="true">
              <div className="h-1.5 w-12 rounded-full bg-slate-600" />
            </div>
            <SpringScrollArea className="min-h-0 flex-1 overflow-y-auto custom-scrollbar touch-pan-y">
              <QuotationPanel idPrefix="mobile-" width={Number(windowConfig.width) || 0} height={Number(windowConfig.height) || 0} quotationOpeningMm2={quotationOpeningMm2} quantity={quantity} setQuantity={setQuantity} areaType={areaType} setAreaType={setAreaType} rate={rate} setRate={setRate} onSave={onSave} onUpdate={onUpdate} onCancelEdit={onCancelEdit} editingItemId={editingItemId} onBatchAdd={onBatchAdd} windowTitle={windowTitle} setWindowTitle={setWindowTitle} hardwareCostPerWindow={hardwareCostPerWindow} quotationItemCount={quotationItemCount} onViewQuotation={onViewQuotation} onClose={handleCloseMobilePanels} bulkCorrectionLineCount={bulkCorrectionLineCount} onApplyBulkCorrection={onApplyBulkCorrection} layoutEstimate={layoutEstimate} activeLayoutUnitId={activeLayoutUnitId} onLayoutUnitRateChange={onLayoutUnitRateChange} onSaveLayoutAll={onSaveLayoutAllToQuotation} printElevationPhoto={printElevationPhoto} onPrintElevationPhotoChange={onPrintElevationPhotoChange} printVisualWidthMm={printVisualWidthMm} printVisualHeightMm={printVisualHeightMm} />
            </SpringScrollArea>
        </div>
    </div>
    {showOpenViewModal ? (
      <ErrorBoundary title="Open view crashed">
        <Suspense fallback={null}>
          <WindowOpenViewModal config={windowConfig} onClose={() => setShowOpenViewModal(false)} />
        </Suspense>
      </ErrorBoundary>
    ) : null}
    {show3DPreview ? (
      <ErrorBoundary title="3D preview crashed">
        <Suspense fallback={null}>
          <Window3DPreviewModal config={windowConfig} onClose={() => setShow3DPreview(false)} />
        </Suspense>
      </ErrorBoundary>
    ) : null}
    </>
  );
});

const App: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { state: userModeState, setFlag, getFlag } = useUserMode();

  // Architect: auto-fill recommended base rate once (keeps clicks minimal).
  useEffect(() => {
    if (userModeState.mode !== 'architect') return;
    if (getFlag('architect_window_rate_autofill')) return;
    setRate(650);
    try {
      window.localStorage.setItem('woodenmax-quotation-panel-rate', JSON.stringify(650));
    } catch {
      // ignore
    }
    setFlag('architect_window_rate_autofill', true);
  }, [getFlag, setFlag, userModeState.mode]);

  const [windowConfigState, dispatch] = useReducer(configReducer, getInitialConfig());
  const [layoutCompanions, setLayoutCompanions] = useState<DesignLayoutUnit[]>(() => {
    return loadDesignLayoutSession()?.companions ?? [];
  });
  const [activeLayoutUnitId, setActiveLayoutUnitId] = useState<DesignLayoutActiveUnit>(() => {
    return loadDesignLayoutSession()?.activeUnitId ?? 'primary';
  });
  const [layoutPrimarySnapshot, setLayoutPrimarySnapshot] = useState<WindowConfig | null>(null);
  const frozenPrimaryConfigRef = useRef<ConfigState | null>(null);
  const { windowType } = windowConfigState;

  const [isDesktopPanelOpen, setIsDesktopPanelOpen] = useState(window.innerWidth >= 1024);
  const [activeMobilePanel, setActiveMobilePanel] = useState<MobilePanelState>('none');
  const [activeCornerSide, setActiveCornerSide] = useState<'left' | 'right'>('left');
  
  const [series, setSeries] = useState<ProfileSeries>(() => {
    try {
      const item = window.localStorage.getItem('aluminium-window-last-series');
      if (item) {
        const parsed = JSON.parse(item);
        if(parsed.id && parsed.name && parsed.dimensions) { return normalizeSeriesHardwareForType(parsed); }
      }
    } catch (error) { console.error("Could not load last used series", error); }
    return normalizeSeriesHardwareForType(DEFAULT_SLIDING_SERIES);
  });

  const [savedSeries, setSavedSeries] = useState<ProfileSeries[]>(() => {
    try {
      const item = window.localStorage.getItem('aluminium-window-profiles');
      const userSaved = item ? JSON.parse(item).filter((s: ProfileSeries) => !s.id.includes('-default')) : [];
      return [
        ...PREDEFINED_SLIDING_SERIES,
        ...PREDEFINED_CASEMENT_SERIES,
        ...PREDEFINED_VENTILATOR_SERIES,
        ...PREDEFINED_PARTITION_SERIES,
        ...userSaved,
      ].map((s) => normalizeSeriesHardwareForType(s));
    } catch (error) {
      console.error("Could not load profiles", error);
      return [
        ...PREDEFINED_SLIDING_SERIES,
        ...PREDEFINED_CASEMENT_SERIES,
        ...PREDEFINED_VENTILATOR_SERIES,
        ...PREDEFINED_PARTITION_SERIES,
      ];
    }
  });

  const [savedColors, setSavedColors] = useState<SavedColor[]>(() => {
      try {
        const item = window.localStorage.getItem('aluminium-window-colors');
        return item ? JSON.parse(item) : [
            { id: uuidv4(), name: 'Matt Black', value: '#374151', type: 'color' },
            { id: uuidv4(), name: 'Dark Grey', value: '#4B5563', type: 'color' },
            { id: uuidv4(), name: 'White', value: '#F9FAFB', type: 'color' },
            { id: uuidv4(), name: 'Champion Gold', value: '#D6A158', type: 'color' },
        ];
      } catch (error) { return []; }
  });
  
  const [windowTitle, setWindowTitle] = useState<string>(() => window.localStorage.getItem('woodenmax-quotation-panel-title') || 'Window 1');
  const [quantity, setQuantity] = useState<number | ''>(() => { try { const s = window.localStorage.getItem('woodenmax-quotation-panel-quantity'); return s ? JSON.parse(s) : 1; } catch { return 1; } });
  const [areaType, setAreaType] = useState<AreaType>(() => (window.localStorage.getItem('woodenmax-quotation-panel-areaType') as AreaType) || AreaType.SQFT);
  const [rate, setRate] = useState<number | ''>(() => { try { const s = window.localStorage.getItem('woodenmax-quotation-panel-rate'); return s ? JSON.parse(s) : 550; } catch { return 550; } });
  const [quotationItems, setQuotationItems] = useState<QuotationItem[]>(() => { 
    try { 
      const s = window.localStorage.getItem('woodenmax-quotation-items'); 
      const parsed = s ? JSON.parse(s) : [];
      if (!Array.isArray(parsed)) return [];
      const out: QuotationItem[] = [];
      for (const row of parsed) {
        const n = normalizeQuotationItemFromStorage(row);
        if (n) out.push(n);
      }
      return out;
    } catch { 
      return []; 
    } 
  });
  /** Quotation lines selected for bulk correction (checkboxes); apply uses this on the main screen. */
  const [quotationBulkTargetIds, setQuotationBulkTargetIds] = useState<string[]>([]);
  const [isQuotationModalOpen, setIsQuotationModalOpen] = useState(false);
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [isBatchAddModalOpen, setIsBatchAddModalOpen] = useState(false);
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  
  const [appView, setAppView] = useState<AppView>('designer');
  const [guideSlug, setGuideSlug] = useState('index');

  const [quotationSettings, setQuotationSettings] = useState<QuotationSettings>(() => {
      try {
          const item = window.localStorage.getItem('woodenmax-quotation-settings');
          if (item) {
              const savedSettings = JSON.parse(item);
              // Deep merge to ensure nested objects get new default properties from updates
              const mergedSettings: QuotationSettings = {
                  ...DEFAULT_QUOTATION_SETTINGS,
                  ...savedSettings,
                  company: { ...DEFAULT_QUOTATION_SETTINGS.company, ...savedSettings.company },
                  customer: { ...DEFAULT_QUOTATION_SETTINGS.customer, ...savedSettings.customer },
                  financials: { ...DEFAULT_QUOTATION_SETTINGS.financials, ...savedSettings.financials },
                  bankDetails: { ...DEFAULT_QUOTATION_SETTINGS.bankDetails, ...savedSettings.bankDetails },
                  materialRates: {
                      ...DEFAULT_QUOTATION_SETTINGS.materialRates,
                      ...savedSettings.materialRates,
                      makingChargePerSqFt: Number(savedSettings.materialRates?.makingChargePerSqFt) || DEFAULT_QUOTATION_SETTINGS.materialRates.makingChargePerSqFt,
                      meshPerSqFt: Number(savedSettings.materialRates?.meshPerSqFt) || DEFAULT_QUOTATION_SETTINGS.materialRates.meshPerSqFt,
                      meshShutterOptions: {
                          ...DEFAULT_QUOTATION_SETTINGS.materialRates.meshShutterOptions,
                          ...savedSettings.materialRates?.meshShutterOptions,
                          separateSections: Boolean(savedSettings.materialRates?.meshShutterOptions?.separateSections),
                      },
                      wastageCartagePerSqFt: Number(savedSettings.materialRates?.wastageCartagePerSqFt) || 0,
                      profit: {
                          ...DEFAULT_QUOTATION_SETTINGS.materialRates.profit,
                          ...savedSettings.materialRates?.profit,
                          mode: savedSettings.materialRates?.profit?.mode === 'per_sqft' ? 'per_sqft' : 'percentage',
                          value: Number(savedSettings.materialRates?.profit?.value) || DEFAULT_QUOTATION_SETTINGS.materialRates.profit.value,
                      },
                      powderCoatingPerRft: {
                          ...DEFAULT_QUOTATION_SETTINGS.materialRates.powderCoatingPerRft,
                          ...savedSettings.materialRates?.powderCoatingPerRft,
                      },
                      glassPerSqFt: {
                          ...DEFAULT_QUOTATION_SETTINGS.materialRates.glassPerSqFt,
                          ...savedSettings.materialRates?.glassPerSqFt,
                          clear: {
                              ...DEFAULT_QUOTATION_SETTINGS.materialRates.glassPerSqFt.clear,
                              ...savedSettings.materialRates?.glassPerSqFt?.clear,
                          },
                          tinted: {
                              ...(DEFAULT_QUOTATION_SETTINGS.materialRates.glassPerSqFt as any).tinted,
                              ...(savedSettings.materialRates?.glassPerSqFt as any)?.tinted,
                          },
                          reflective: {
                              ...(DEFAULT_QUOTATION_SETTINGS.materialRates.glassPerSqFt as any).reflective,
                              ...(savedSettings.materialRates?.glassPerSqFt as any)?.reflective,
                          },
                          laminated: {
                              ...DEFAULT_QUOTATION_SETTINGS.materialRates.glassPerSqFt.laminated,
                              ...savedSettings.materialRates?.glassPerSqFt?.laminated,
                          },
                          dgu: {
                              ...DEFAULT_QUOTATION_SETTINGS.materialRates.glassPerSqFt.dgu,
                              ...savedSettings.materialRates?.glassPerSqFt?.dgu,
                          },
                          extras: {
                              ...(DEFAULT_QUOTATION_SETTINGS.materialRates.glassPerSqFt as any).extras,
                              ...(savedSettings.materialRates?.glassPerSqFt as any)?.extras,
                          },
                      },
                  },
              };
              mergedSettings.company.gstNumber = (mergedSettings.company.gstNumber || '').toUpperCase();
              mergedSettings.customer.gstNumber = (mergedSettings.customer.gstNumber || '').toUpperCase();
              return mergedSettings;
          }
          return DEFAULT_QUOTATION_SETTINGS;
      } catch (error) { return DEFAULT_QUOTATION_SETTINGS; }
  });
  
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [canvasKey, setCanvasKey] = useState(() => uuidv4());
  const [isShortcutHelpOpen, setIsShortcutHelpOpen] = useState(false);
  const applySlidingBasicRateProtection = useCallback((items: QuotationItem[]): QuotationItem[] => {
    if (items.length === 0) return items;
    const summary = calculateMaterialCostSummary(
      items,
      quotationSettings.materialRates,
      Number(quotationSettings.materialRates.makingChargePerSqFt) || 120
    );
    let changed = false;
    const mapped = items.map((item) => {
      if (!isWindowQuotationItem(item)) return item;
      if (item.config.windowType !== WindowType.SLIDING) return item;
      const base = summary.byItemId[item.id];
      if (!base) return item;
      const safeRate = Number(base.basicRatePerSqFt) || 0;
      if (item.rate !== safeRate || item.hardwareCost !== 0) {
        changed = true;
        return { ...item, rate: safeRate, hardwareCost: 0 };
      }
      return item;
    });
    return changed ? mapped : items;
  }, [quotationSettings.materialRates]);

  const handleUpsertUnifiedRailingLine = useCallback(
    (line: QuotationLine) => {
      const rec = recalculateRailingQuoteLine(structuredClone(line));
      const title =
        rec.designName?.trim() ||
        railingDisplayTitle(rec.draftSnapshot) ||
        rec.designLabel ||
        'Glass railing';
      const uni: QuotationItem = {
        kind: 'railing',
        id: rec.id,
        title,
        railingLine: rec,
      };
      setQuotationItems((prev) => {
        const idx = prev.findIndex((i) => i.kind === 'railing' && i.id === rec.id);
        const merged = idx >= 0 ? prev.map((p, i) => (i === idx ? uni : p)) : [...prev, uni];
        return applySlidingBasicRateProtection(merged);
      });
    },
    [applySlidingBasicRateProtection],
  );

  const handleReplaceUnifiedRailingLines = useCallback(
    (lines: QuotationLine[]) => {
      setQuotationItems((prev) => {
        const windows = prev.filter(isWindowQuotationItem);
        const railingItems: QuotationItem[] = lines.map((line) => {
          const rec = recalculateRailingQuoteLine(structuredClone(line));
          const title =
            rec.designName?.trim() ||
            railingDisplayTitle(rec.draftSnapshot) ||
            rec.designLabel ||
            'Glass railing';
          return {
            kind: 'railing',
            id: rec.id,
            title,
            railingLine: rec,
          };
        });
        return applySlidingBasicRateProtection([...windows, ...railingItems]);
      });
    },
    [applySlidingBasicRateProtection],
  );

  const unifiedRailingLines = useMemo(
    () =>
      quotationItems
        .filter((i): i is Extract<QuotationItem, { kind: 'railing' }> => i.kind === 'railing')
        .map((i) => i.railingLine),
    [quotationItems],
  );

  const handleRemoveUnifiedRailingLine = useCallback(
    (id: string) => {
      setQuotationItems((prev) =>
        applySlidingBasicRateProtection(prev.filter((i) => !(i.kind === 'railing' && i.id === id))),
      );
    },
    [applySlidingBasicRateProtection],
  );

  const handleClearUnifiedRailingLines = useCallback(() => {
    setQuotationItems((prev) =>
      applySlidingBasicRateProtection(prev.filter(isWindowQuotationItem)),
    );
  }, [applySlidingBasicRateProtection]);

  const panelRef = useRef<HTMLDivElement>(null);
  const lastAppliedSearchRef = useRef<string>('');
  const isEmbedded = useMemo(() => new URLSearchParams(location.search).get('embed') === '1', [location.search]);

  useEffect(() => {
    setQuotationBulkTargetIds((prev) => {
      const valid = new Set(quotationItems.map((i) => i.id));
      const next = prev.filter((id) => valid.has(id));
      return next.length === prev.length ? prev : next;
    });
  }, [quotationItems]);

  useEffect(() => {
    if (series.type !== WindowType.SLIDING) return;
    const normalized = normalizeSlidingHardwareItems(series.hardwareItems || []);
    if (!areHardwareItemsEqual(series.hardwareItems || [], normalized)) {
      setSeries((prev) => ({ ...prev, hardwareItems: normalized }));
    }
  }, [series]);

  useEffect(() => {
    setQuotationItems((prev) => applySlidingBasicRateProtection(prev));
  }, [applySlidingBasicRateProtection]);

  const configRef = useRef(windowConfigState);
  const seriesRef = useRef(series);
  useEffect(() => {
    configRef.current = windowConfigState;
  }, [windowConfigState]);
  useEffect(() => {
    seriesRef.current = series;
  }, [series]);

  const persistSnapshotAndSwitchWindowType = useCallback((newType: WindowType) => {
    const oldType = configRef.current.windowType;
    if (oldType === newType) return;

    const snapshot: DesignSnapshot = {
      config: JSON.parse(JSON.stringify(configRef.current)) as ConfigState,
      series: JSON.parse(JSON.stringify(seriesRef.current)) as ProfileSeries,
    };
    saveSnapshotForType(oldType, snapshot);

    const restored = getSnapshotForType(newType);
    if (restored) {
      const config = sanitizeCasementOpeningIfNotUserSet({
        ...restored.config,
        windowType: newType,
      } as ConfigState);
      dispatch({ type: 'LOAD_CONFIG', payload: config });
      setSeries(restored.series);
    } else {
      dispatch({ type: 'SET_WINDOW_TYPE', payload: newType });
      setSeries(SERIES_MAP[newType] || DEFAULT_SLIDING_SERIES);
    }
  }, [dispatch]);

  // --- ROUTING (pathname) & SEO ---
  useEffect(() => {
    const path = location.pathname;
    if (path === '/' || path === '') {
      navigate(`/design/${configRef.current.windowType}`, { replace: true });
      return;
    }
    if (path.startsWith('/guides')) {
      const parts = path.split('/').filter(Boolean);
      const slug = parts[1] || 'index';
      setAppView('guides');
      setGuideSlug(slug);
      return;
    }
    if (path.startsWith('/design/railing')) {
      setAppView('railing');
      return;
    }
    if (path.startsWith('/design')) {
      setAppView('designer');
      const parts = path.split('/').filter(Boolean);
      const seg = parts[1];
      const foundType = seg ? Object.values(WindowType).find((t) => t === seg) : undefined;
      if (foundType && foundType !== configRef.current.windowType) {
        persistSnapshotAndSwitchWindowType(foundType);
      } else if (seg && !foundType) {
        navigate('/design/sliding', { replace: true });
      } else if (!seg) {
        navigate(`/design/${configRef.current.windowType}`, { replace: true });
      }
      return;
    }
    navigate(`/design/${configRef.current.windowType}`, { replace: true });
  }, [location.pathname, navigate, persistSnapshotAndSwitchWindowType]);

  useEffect(() => {
    const baseUrl = `${SITE_ORIGIN}/`;
    let canonicalUrl = baseUrl;

    const titleMap: Partial<Record<WindowType, string>> = {
        [WindowType.SLIDING]: 'Sliding Window & Door Designer | 2-Track, 3-Track Systems',
        [WindowType.CASEMENT]: 'Design Casement Windows, Doors & Foldable Systems Online',
        [WindowType.VENTILATOR]: 'Bathroom Ventilator Design Tool | Louvers & Exhaust Options',
        [WindowType.GLASS_PARTITION]: 'Create Modern Glass & Shower Partitions | Fixed, Sliding & Openable Designs',
        [WindowType.LOUVERS]: 'Premium Louver Design Tool | Elevation, Ventilation & Decorative Louvers',
        [WindowType.CORNER]: 'L-Type Corner Window Designer | Sliding & Casement Options',
        [WindowType.MIRROR]: 'Online Mirror Design Tool | Round, Square, Capsule & Custom Shapes',
    };
    
    let pageTitle = 'WoodenMax Window Designer | Aluminium & uPVC Window & Door Design + Quotations';

    let pageKind: 'design' | 'guide' | 'home' = 'home';
    let breadcrumbLabel: string | undefined;

    if (appView === 'guides') {
        pageKind = 'guide';
        const guideLabel = getGuideDisplayTitle(guideSlug);
        breadcrumbLabel = guideLabel;
        if (guideSlug === 'index') {
          pageTitle = 'Features & Guides | WoodenMax Window Designer';
        } else {
          pageTitle = `${guideLabel} | Guides & Help | WoodenMax Window Designer`;
        }
        canonicalUrl = `${SITE_ORIGIN}/guides/${guideSlug}`;
    } else if (appView === 'railing') {
        pageKind = 'design';
        pageTitle =
          'Glass & SS Railing Designer | Staircase & Balcony Layouts — Combined quotations | WoodenMax';
        breadcrumbLabel = 'Glass railing';
        canonicalUrl = `${SITE_ORIGIN}/design/railing`;
    } else if (windowType) {
        pageKind = 'design';
        const mapped = titleMap[windowType];
        breadcrumbLabel = mapped ?? windowType.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase());
        if (mapped) {
            pageTitle = `${mapped} | WoodenMax`;
        } else {
            pageTitle = `${breadcrumbLabel} Design Tool | WoodenMax Window Designer`;
        }
        canonicalUrl = `${SITE_ORIGIN}/design/${windowType}`;
    }

    document.title = pageTitle;

    const description = getMetaDescription({
      appView:
        appView === 'guides' ? 'guides' : appView === 'railing' ? 'railing' : 'designer',
      windowType,
      guideSlug,
    });
    applyRouteSeo({ title: pageTitle, description, canonicalUrl, pageKind });
    applyRouteJsonLd({
      canonicalUrl,
      title: pageTitle,
      description,
      pageKind,
      breadcrumbLabel,
    });

    let link = document.querySelector<HTMLLinkElement>("link[rel='canonical']");
    if (!link) {
        link = document.createElement('link');
        link.rel = 'canonical';
        document.head.appendChild(link);
    }
    link.href = canonicalUrl;

  }, [windowType, appView, guideSlug]);

  useEffect(() => {
    if (appView !== 'designer') return;
    if (lastAppliedSearchRef.current === location.search) return;
    lastAppliedSearchRef.current = location.search;

    const params = new URLSearchParams(location.search);
    const hasConfigParams = ['type', 'width', 'height', 'title', 'qty', 'rate', 'area'].some((key) => params.has(key));
    if (!hasConfigParams) return;

    const requestedType = params.get('type');
    const isKnownType = requestedType && Object.values(WindowType).includes(requestedType as WindowType);
    if (isKnownType && requestedType !== windowType) {
      navigate(`/design/${requestedType}${location.search}`, { replace: true });
      return;
    }

    const widthParam = Number(params.get('width'));
    if (Number.isFinite(widthParam) && widthParam > 0) {
      dispatch({ type: 'SET_FIELD', field: 'width', payload: widthParam });
    }
    const heightParam = Number(params.get('height'));
    if (Number.isFinite(heightParam) && heightParam > 0) {
      dispatch({ type: 'SET_FIELD', field: 'height', payload: heightParam });
    }
    const titleParam = params.get('title');
    if (titleParam) {
      setWindowTitle(titleParam);
    }
    const qtyParam = Number(params.get('qty'));
    if (Number.isFinite(qtyParam) && qtyParam > 0) {
      setQuantity(qtyParam);
    }
    const rateParam = Number(params.get('rate'));
    if (Number.isFinite(rateParam) && rateParam >= 0) {
      setRate(rateParam);
    }
    const areaParam = params.get('area');
    if (areaParam === AreaType.SQFT || areaParam === AreaType.SQMT) {
      setAreaType(areaParam as AreaType);
    }
  }, [appView, location.search, navigate, windowType]);
  
  const windowConfig: WindowConfig = useMemo(() => ({
    ...windowConfigState,
    series
  }), [windowConfigState, series]);

  const configStateFromWindowConfig = useCallback((wc: WindowConfig): ConfigState => {
    const { series: _s, ...state } = wc;
    return state as ConfigState;
  }, []);

  const layoutCompanionsForCanvas = useMemo(() => {
    if (activeLayoutUnitId === 'primary') return layoutCompanions;
    return layoutCompanions.map((c) =>
      c.id === activeLayoutUnitId ? { ...c, config: windowConfig } : c,
    );
  }, [layoutCompanions, activeLayoutUnitId, windowConfig]);

  const layoutPrimaryForCanvas = useMemo(() => {
    if (activeLayoutUnitId === 'primary') return windowConfig;
    if (layoutPrimarySnapshot) return layoutPrimarySnapshot;
    return windowConfig;
  }, [activeLayoutUnitId, windowConfig, layoutPrimarySnapshot]);

  const layoutGetUnitConfig = useCallback(
    (id: DesignLayoutActiveUnit) => {
      if (id === 'primary') return layoutPrimaryForCanvas;
      if (id === activeLayoutUnitId) return windowConfig;
      return layoutCompanions.find((c) => c.id === id)?.config ?? layoutPrimaryForCanvas;
    },
    [layoutPrimaryForCanvas, activeLayoutUnitId, windowConfig, layoutCompanions],
  );

  useEffect(() => {
    if (activeLayoutUnitId === 'primary') {
      frozenPrimaryConfigRef.current = windowConfigState;
      setLayoutPrimarySnapshot(windowConfig);
    }
  }, [activeLayoutUnitId, windowConfig, windowConfigState]);

  useEffect(() => {
    if (layoutCompanions.length === 0 && activeLayoutUnitId === 'primary') {
      clearDesignLayoutSession();
      return;
    }
    saveDesignLayoutSession({ companions: layoutCompanions, activeUnitId: activeLayoutUnitId });
  }, [layoutCompanions, activeLayoutUnitId]);

  const layoutSessionRestoredRef = useRef(false);
  useEffect(() => {
    if (layoutSessionRestoredRef.current) return;
    layoutSessionRestoredRef.current = true;
    if (activeLayoutUnitId === 'primary' || layoutCompanions.length === 0) return;
    const unit = layoutCompanions.find((c) => c.id === activeLayoutUnitId);
    if (!unit) {
      setActiveLayoutUnitId('primary');
      return;
    }
    frozenPrimaryConfigRef.current = windowConfigState;
    setLayoutPrimarySnapshot({ ...windowConfigState, series });
    dispatch({ type: 'LOAD_CONFIG_STATE', payload: configStateFromWindowConfig(unit.config) });
  }, []);

  // --- PERSISTENCE EFFECTS ---
  useEffect(() => {
    try {
        const stateToSave = { ...windowConfigState };
        // Don't save large texture data to local storage for the *current* config to avoid errors
        // but it will be saved to quotation items for printing
        if (stateToSave.profileColor && stateToSave.profileColor.startsWith('data:image')) {
            stateToSave.profileColor = '#374151'; // Reset to default to avoid storage errors
        }
        if (stateToSave.profileTexture && stateToSave.profileTexture.startsWith('data:image')) {
            stateToSave.profileTexture = '';
        }
        if (stateToSave.glassTexture) {
            stateToSave.glassTexture = ''; // Do not persist texture data
        }
        if (stateToSave.printElevationPhoto) {
            saveSessionPrintElevationPhoto(stateToSave.printElevationPhoto);
            delete stateToSave.printElevationPhoto;
        }
        window.localStorage.setItem('woodenmax-current-config', JSON.stringify(stateToSave));
    } catch (error) {
        console.error("Could not save current config to localStorage:", error);
    }
  }, [windowConfigState]);

  useEffect(() => { window.localStorage.setItem('woodenmax-quotation-items', JSON.stringify(quotationItems)); }, [quotationItems]);
  useEffect(() => {
    window.localStorage.setItem('woodenmax-quotation-panel-title', windowTitle);
    window.localStorage.setItem('woodenmax-quotation-panel-quantity', JSON.stringify(quantity));
    window.localStorage.setItem('woodenmax-quotation-panel-areaType', areaType);
    window.localStorage.setItem('woodenmax-quotation-panel-rate', JSON.stringify(rate));
  }, [windowTitle, quantity, areaType, rate]);
  useEffect(() => {
    const handler = (e: Event) => { e.preventDefault(); setInstallPrompt(e as BeforeInstallPromptEvent); };
    window.addEventListener('beforeinstallprompt', handler);
    const appInstalledHandler = () => { setInstallPrompt(null); };
    window.addEventListener('appinstalled', appInstalledHandler);
    return () => {
      window.removeEventListener('beforeinstallprompt', handler);
      window.removeEventListener('appinstalled', appInstalledHandler);
    };
  }, []);
  useEffect(() => {
      const userSaved = savedSeries.filter(s => !s.id.includes('-default'));
      window.localStorage.setItem('aluminium-window-profiles', JSON.stringify(userSaved));
  }, [savedSeries]);
  useEffect(() => { window.localStorage.setItem('aluminium-window-last-series', JSON.stringify(series)); }, [series]);
  useEffect(() => {
    try {
        const colorsToSave = savedColors.filter(c => c.type === 'color');
        window.localStorage.setItem('aluminium-window-colors', JSON.stringify(colorsToSave));
    } catch (error) {
        console.error("Could not save colors to localStorage:", error);
    }
  }, [savedColors]);
  useEffect(() => { window.localStorage.setItem('woodenmax-quotation-settings', JSON.stringify(quotationSettings)); }, [quotationSettings]);
  
  useEffect(() => {
    // Lock body scroll when any modal or mobile panel is open
    if (activeMobilePanel !== 'none' || isQuotationModalOpen || isBatchAddModalOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }

    // Cleanup function to ensure scroll is restored on component unmount
    return () => {
      document.body.style.overflow = '';
    };
  }, [activeMobilePanel, isQuotationModalOpen, isBatchAddModalOpen]);

  useEffect(() => {
    if (!isQuotationModalOpen && isPreviewing) {
      setIsPreviewing(false);
    }
  }, [isQuotationModalOpen, isPreviewing]);

  const SERIES_MAP_MEMO = useMemo(() => SERIES_MAP, []);

  useEffect(() => {
    const activeConfig = windowType === WindowType.CORNER 
      ? (activeCornerSide === 'left' ? windowConfigState.leftConfig : windowConfigState.rightConfig) 
      : windowConfigState;
    const typeToSync = activeConfig?.windowType;

    if (typeToSync && series.type !== typeToSync) {
        const foundSeries = savedSeries.find(s => s.type === typeToSync);
        setSeries(foundSeries || SERIES_MAP_MEMO[typeToSync as WindowType] || DEFAULT_SLIDING_SERIES);
    }
  }, [windowType, windowConfigState, activeCornerSide, series.type, savedSeries, SERIES_MAP_MEMO]);
  
  const availableSeries = useMemo(() => {
    const allSeries = [
        DEFAULT_SLIDING_SERIES, DEFAULT_CASEMENT_SERIES, DEFAULT_VENTILATOR_SERIES, 
        DEFAULT_GLASS_PARTITION_SERIES, DEFAULT_CORNER_SERIES, DEFAULT_MIRROR_SERIES, 
        DEFAULT_LOUVERS_SERIES, ...savedSeries
    ];
    return allSeries.filter((s, index, self) => index === self.findIndex(t => t.id === s.id));
  }, [savedSeries]);
  
  const numShutters = useMemo(() => {
    const activeConfig = windowType === WindowType.CORNER
        ? (activeCornerSide === 'left' ? windowConfig.leftConfig : windowConfig.rightConfig)
        : windowConfig;
    if (!activeConfig || activeConfig.windowType !== WindowType.SLIDING) return 0;
    
    switch (activeConfig.shutterConfig) {
      case ShutterConfigType.TWO_GLASS: return 2;
      case ShutterConfigType.THREE_GLASS: return 3;
      case ShutterConfigType.TWO_GLASS_ONE_MESH: return 3;
      case ShutterConfigType.FOUR_GLASS: return 4;
      case ShutterConfigType.FOUR_GLASS_TWO_MESH: return 6;
      default: return 0;
    }
  }, [windowConfig, windowType, activeCornerSide]);

  useEffect(() => {
    const checkAndUpdateSideConfig = (side: 'left' | 'right') => {
        const sideConfig = windowConfigState[side === 'left' ? 'leftConfig' : 'rightConfig'];
        if (!sideConfig) return;

        let changed = false;
        const newSideConfig: Partial<CornerSideConfig> = {};

        if (sideConfig.trackType === TrackType.TWO_TRACK && ![ShutterConfigType.TWO_GLASS, ShutterConfigType.FOUR_GLASS].includes(sideConfig.shutterConfig)) {
            newSideConfig.shutterConfig = ShutterConfigType.TWO_GLASS;
            changed = true;
        }
        if (sideConfig.trackType === TrackType.THREE_TRACK && ![ShutterConfigType.THREE_GLASS, ShutterConfigType.TWO_GLASS_ONE_MESH, ShutterConfigType.FOUR_GLASS_TWO_MESH].includes(sideConfig.shutterConfig)) {
            newSideConfig.shutterConfig = ShutterConfigType.THREE_GLASS;
            changed = true;
        }

        if (changed) {
            dispatch({ type: 'SET_SIDE_CONFIG', payload: { side, config: newSideConfig } });
        }
    };
    if (windowType === WindowType.CORNER) {
        checkAndUpdateSideConfig('left');
        checkAndUpdateSideConfig('right');
    } else if (windowType === WindowType.SLIDING) {
        if (windowConfigState.trackType === TrackType.TWO_TRACK && ![ShutterConfigType.TWO_GLASS, ShutterConfigType.FOUR_GLASS].includes(windowConfigState.shutterConfig)) {
            dispatch({ type: 'SET_FIELD', field: 'shutterConfig', payload: ShutterConfigType.TWO_GLASS });
        }
        if (windowConfigState.trackType === TrackType.THREE_TRACK && ![ShutterConfigType.THREE_GLASS, ShutterConfigType.TWO_GLASS_ONE_MESH, ShutterConfigType.FOUR_GLASS_TWO_MESH].includes(windowConfigState.shutterConfig)) {
            dispatch({ type: 'SET_FIELD', field: 'shutterConfig', payload: ShutterConfigType.THREE_GLASS });
        }
    }
  }, [windowConfigState, windowType]);
  
  useEffect(() => {
    const updateSideShutters = (side: 'left' | 'right') => {
        const sideConfig = windowConfigState[side === 'left' ? 'leftConfig' : 'rightConfig'];
        if (!sideConfig || sideConfig.windowType !== WindowType.SLIDING) return;
        
        let numSideShutters = 0;
        switch (sideConfig.shutterConfig) {
            case ShutterConfigType.TWO_GLASS: numSideShutters = 2; break;
            case ShutterConfigType.THREE_GLASS: case ShutterConfigType.TWO_GLASS_ONE_MESH: numSideShutters = 3; break;
            case ShutterConfigType.FOUR_GLASS: numSideShutters = 4; break;
            case ShutterConfigType.FOUR_GLASS_TWO_MESH: numSideShutters = 6; break;
        }

        if (sideConfig.fixedShutters.length !== numSideShutters || sideConfig.slidingHandles.length !== numSideShutters) {
             const newFixedShutters = Array(numSideShutters).fill(false);
             if (sideConfig.shutterConfig === ShutterConfigType.FOUR_GLASS_TWO_MESH) {
                if (numSideShutters > 0) newFixedShutters[0] = true;
                if (numSideShutters > 1) newFixedShutters[numSideShutters - 1] = true;
             } else {
                for(let i=0; i < Math.min(sideConfig.fixedShutters.length, newFixedShutters.length); i++) { newFixedShutters[i] = sideConfig.fixedShutters[i]; }
             }
             const newSlidingHandles = Array(numSideShutters).fill(null);
             for(let i=0; i < Math.min(sideConfig.slidingHandles.length, newSlidingHandles.length); i++) { newSlidingHandles[i] = sideConfig.slidingHandles[i]; }
             dispatch({ type: 'SET_SIDE_CONFIG', payload: { side, config: { fixedShutters: newFixedShutters, slidingHandles: newSlidingHandles } } });
        }
    };
    if (windowType === WindowType.CORNER) {
        updateSideShutters('left');
        updateSideShutters('right');
    } else if (windowType === WindowType.SLIDING) {
        if (windowConfigState.fixedShutters.length !== numShutters || windowConfigState.slidingHandles.length !== numShutters) {
            const newFixedShutters = Array(numShutters).fill(false);
            if (windowConfigState.shutterConfig === ShutterConfigType.FOUR_GLASS_TWO_MESH) {
                if (numShutters > 0) newFixedShutters[0] = true;
                if (numShutters > 1) newFixedShutters[numShutters - 1] = true;
            } else {
                for(let i=0; i < Math.min(windowConfigState.fixedShutters.length, newFixedShutters.length); i++) { newFixedShutters[i] = windowConfigState.fixedShutters[i]; }
            }
            const newSlidingHandles = Array(numShutters).fill(null);
            for(let i=0; i < Math.min(windowConfigState.slidingHandles.length, newSlidingHandles.length); i++) { newSlidingHandles[i] = windowConfigState.slidingHandles[i]; }
            dispatch({ type: 'SET_FIELD', field: 'fixedShutters', payload: newFixedShutters });
            dispatch({ type: 'SET_FIELD', field: 'slidingHandles', payload: newSlidingHandles });
        }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [windowConfigState, windowType, numShutters]);
  
  useEffect(() => {
    const updateSideGrid = (side: 'left' | 'right') => {
      const sideConfig = windowConfigState[side === 'left' ? 'leftConfig' : 'rightConfig'];
      if (!sideConfig || ![WindowType.CASEMENT, WindowType.VENTILATOR].includes(sideConfig.windowType)) return;

      const gridRows = sideConfig.horizontalDividers.length + 1;
      const gridCols = sideConfig.verticalDividers.length + 1;
      const newGrid: VentilatorCell[][] = Array.from({ length: gridRows }, () => 
          Array.from({ length: gridCols }, () => ({ type: 'glass' }))
      );
      for (let r = 0; r < Math.min(gridRows, sideConfig.ventilatorGrid.length); r++) {
          for (let c = 0; c < Math.min(gridCols, sideConfig.ventilatorGrid[r]?.length || 0); c++) {
              newGrid[r][c] = sideConfig.ventilatorGrid[r][c];
          }
      }
      dispatch({ type: 'SET_SIDE_CONFIG', payload: { side, config: { ventilatorGrid: newGrid } } });
    };

    if (windowType === WindowType.CORNER) {
        updateSideGrid('left');
        updateSideGrid('right');
    } else if ([WindowType.CASEMENT, WindowType.VENTILATOR].includes(windowType)) {
        const gridRows = windowConfigState.horizontalDividers.length + 1;
        const gridCols = windowConfigState.verticalDividers.length + 1;
        const newGrid: VentilatorCell[][] = Array.from({ length: gridRows }, () => Array.from({ length: gridCols }, () => ({ type: 'glass' })));
        for (let r = 0; r < Math.min(gridRows, windowConfigState.ventilatorGrid.length); r++) {
            for (let c = 0; c < Math.min(gridCols, windowConfigState.ventilatorGrid[r]?.length || 0); c++) {
                newGrid[r][c] = windowConfigState.ventilatorGrid[r][c];
            }
        }
        dispatch({ type: 'SET_FIELD', field: 'ventilatorGrid', payload: newGrid });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [windowConfigState.leftConfig?.verticalDividers, windowConfigState.leftConfig?.horizontalDividers, windowConfigState.rightConfig?.verticalDividers, windowConfigState.rightConfig?.horizontalDividers, windowConfigState.verticalDividers, windowConfigState.horizontalDividers, windowType]);

  useEffect(() => {
    if (![WindowType.CASEMENT, WindowType.VENTILATOR].includes(windowType)) return;
    if (!isArchTopOutline(windowConfigState as WindowConfig)) return;
    const outline = resolveCasementOutline(windowConfigState);
    if (outline.archStraightBottomMm === '' || !Number(outline.archStraightBottomMm)) return;
    const inner = computeInnerHoleDims({
      ...windowConfigState,
      series: series ?? SERIES_MAP[windowType],
    });
    const patch = applyArchStraightBottomLayout(
      windowConfigState as WindowConfig,
      inner.innerW,
      inner.innerH,
      outline.archStraightBottomMm,
    );
    const nextR = patch.horizontalDividers[0];
    const curR = windowConfigState.horizontalDividers[0];
    if (nextR == null || curR == null || Math.abs(nextR - curR) < 0.0001) return;
    dispatch({ type: 'SET_FIELD', field: 'horizontalDividers', payload: patch.horizontalDividers });
    dispatch({
      type: 'SET_FIELD',
      field: 'casementOutline',
      payload: { ...outline, ...patch.casementOutline },
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    windowType,
    windowConfigState.width,
    windowConfigState.height,
    windowConfigState.fixedPanels,
    series.id,
    windowConfigState.casementOutline?.archStraightBottomMm,
    windowConfigState.casementOutline?.shape,
  ]);

  const addFixedPanel = useCallback((position: FixedPanelPosition) => dispatch({ type: 'ADD_FIXED_PANEL', payload: position }), []);
  const removeFixedPanel = useCallback((id: string) => dispatch({ type: 'REMOVE_FIXED_PANEL', payload: id }), []);
  const updateFixedPanelSize = useCallback((id: string, size: number) => dispatch({ type: 'UPDATE_FIXED_PANEL_SIZE', payload: { id, size } }), []);
  
  const handleSeriesSelect = useCallback((id: string) => {
    const selected = availableSeries.find(s => s.id === id);
    if(selected) {
      setSeries(selected);
       const activeConfig = windowType === WindowType.CORNER ? (activeCornerSide === 'left' ? windowConfig.leftConfig : windowConfig.rightConfig) : windowConfig;
      if (selected.type !== activeConfig?.windowType) {
        if(windowType === WindowType.CORNER) {
            dispatch({ type: 'SET_SIDE_CONFIG', payload: { side: activeCornerSide, config: { windowType: selected.type as CornerSideConfig['windowType'] } } });
        } else {
            // Path change: routing effect syncs type via persistSnapshotAndSwitchWindowType
            navigate(`/design/${selected.type}`);
        }
      }
    }
  }, [availableSeries, windowType, windowConfig, activeCornerSide, navigate]);

  const handleActiveLayoutUnitChange = useCallback(
    (nextId: DesignLayoutActiveUnit) => {
      if (nextId === activeLayoutUnitId) return;

      let companions = layoutCompanions;
      if (activeLayoutUnitId !== 'primary') {
        companions = layoutCompanions.map((c) =>
          c.id === activeLayoutUnitId ? { ...c, config: windowConfig } : c,
        );
        setLayoutCompanions(companions);
      }

      if (activeLayoutUnitId === 'primary' && nextId !== 'primary') {
        frozenPrimaryConfigRef.current = windowConfigState;
        setLayoutPrimarySnapshot(windowConfig);
      }

      if (nextId === 'primary') {
        if (frozenPrimaryConfigRef.current) {
          dispatch({ type: 'LOAD_CONFIG_STATE', payload: frozenPrimaryConfigRef.current });
        }
      } else {
        const unit = companions.find((c) => c.id === nextId);
        if (unit) {
          const primaryCfg =
            activeLayoutUnitId === 'primary' ? windowConfig : layoutPrimarySnapshot ?? windowConfig;
          const cfg = applyAppearanceFromPrimary(primaryCfg, unit.config);
          if (cfg.series?.id && cfg.series.id !== series?.id) {
            handleSeriesSelect(cfg.series.id);
          }
          dispatch({ type: 'LOAD_CONFIG_STATE', payload: configStateFromWindowConfig(cfg) });
        }
      }

      setActiveLayoutUnitId(nextId);
    },
    [
      activeLayoutUnitId,
      windowConfig,
      windowConfigState,
      layoutCompanions,
      series?.id,
      handleSeriesSelect,
      configStateFromWindowConfig,
    ],
  );

  const handleAddLayoutUnits = useCallback(
    (units: DesignLayoutUnit[]) => {
      if (units.length === 0) return;

      setLayoutCompanions((prev) => {
        let next = prev;
        if (activeLayoutUnitId !== 'primary') {
          next = prev.map((c) =>
            c.id === activeLayoutUnitId ? { ...c, config: windowConfig } : c,
          );
        }
        return [...next, ...units];
      });

      if (activeLayoutUnitId === 'primary') {
        frozenPrimaryConfigRef.current = windowConfigState;
        setLayoutPrimarySnapshot(windowConfig);
      }

      const last = units[units.length - 1];
      if (last.config.series?.id && last.config.series.id !== series?.id) {
        handleSeriesSelect(last.config.series.id);
      }
      dispatch({ type: 'LOAD_CONFIG_STATE', payload: configStateFromWindowConfig(last.config) });
      setActiveLayoutUnitId(last.id);
    },
    [
      activeLayoutUnitId,
      windowConfig,
      windowConfigState,
      series?.id,
      handleSeriesSelect,
      configStateFromWindowConfig,
      layoutPrimarySnapshot,
    ],
  );

  const primaryAppearanceKey = useMemo(
    () => appearanceFingerprint(layoutPrimaryForCanvas),
    [layoutPrimaryForCanvas],
  );

  useEffect(() => {
    if (layoutCompanions.length === 0) return;
    const primary = layoutPrimaryForCanvas;
    setLayoutCompanions((prev) =>
      prev.map((c) => ({
        ...c,
        config: applyAppearanceFromPrimary(primary, c.config),
      })),
    );
  }, [primaryAppearanceKey]);

  const handleRemoveLayoutUnit = useCallback(
    (id: string) => {
      if (activeLayoutUnitId === id) {
        if (frozenPrimaryConfigRef.current) {
          dispatch({ type: 'LOAD_CONFIG_STATE', payload: frozenPrimaryConfigRef.current });
        }
        setActiveLayoutUnitId('primary');
      }
      setLayoutCompanions((prev) => prev.filter((c) => c.id !== id));
    },
    [activeLayoutUnitId],
  );

  const handleUpdateLayoutUnit = useCallback((id: string, partial: Partial<DesignLayoutUnit>) => {
    setLayoutCompanions((prev) => prev.map((c) => (c.id === id ? { ...c, ...partial } : c)));
  }, []);
  
  const handleSeriesSave = useCallback((name: string) => {
    if (name && name.trim() !== '') {
       const activeConfig = windowType === WindowType.CORNER ? (activeCornerSide === 'left' ? windowConfig.leftConfig : windowConfig.rightConfig) : windowConfig;
      const newSeries: ProfileSeries = {
        ...series,
        id: uuidv4(),
        name: name.trim(),
        type: activeConfig?.windowType as WindowType,
      };
      setSavedSeries(prev => [...prev, newSeries]);
      setSeries(newSeries);
    }
  }, [series, windowType, windowConfig, activeCornerSide]);
  
  const handleSeriesDelete = useCallback((id: string) => {
    if (id.includes('-default')) { return; }
     const activeConfig = windowType === WindowType.CORNER ? (activeCornerSide === 'left' ? windowConfig.leftConfig : windowConfig.rightConfig) : windowConfig;
    if (window.confirm("Are you sure you want to delete this profile?")) {
      setSavedSeries(prev => prev.filter(s => s.id !== id));
      if (series.id === id) {
        setSeries(SERIES_MAP_MEMO[activeConfig?.windowType as WindowType]);
      }
    }
  }, [series.id, windowType, windowConfig, activeCornerSide, SERIES_MAP_MEMO]);
  
  const handleHardwareChange = useCallback((id: string, field: keyof HardwareItem, value: string | number) => {
    setSeries(prevSeries => ({ ...prevSeries, hardwareItems: prevSeries.hardwareItems.map(item => item.id === id ? { ...item, [field]: value } : item) }));
  }, []);
  
  const addHardwareItem = useCallback(() => {
    setSeries(prevSeries => ({ ...prevSeries, hardwareItems: [...prevSeries.hardwareItems, { id: uuidv4(), name: 'New Hardware', qtyPerShutter: 1, rate: 0, unit: 'per_shutter_or_door' }] }));
  }, []);
  
  const removeHardwareItem = useCallback((id: string) => {
    setSeries(prevSeries => ({ ...prevSeries, hardwareItems: prevSeries.hardwareItems.filter(item => item.id !== id) }));
  }, []);

  const getSide = useCallback(() => windowType === WindowType.CORNER ? activeCornerSide : null, [windowType, activeCornerSide]);

  const toggleDoorPosition = useCallback((row: number, col: number) => dispatch({ type: 'TOGGLE_DOOR_POSITION', payload: { row, col, side: getSide() } }), [getSide]);
  const handleVentilatorCellClick = useCallback((row: number, col: number) => dispatch({ type: 'HANDLE_VENTILATOR_CELL_CLICK', payload: { row, col, side: getSide() } }), [getSide]);
  const handleSetGridSize = useCallback((rows: number, cols: number) => dispatch({ type: 'SET_GRID_SIZE', payload: { rows, cols, side: getSide() } }), [getSide]);
  const handleRemoveVerticalDivider = useCallback((index: number) => dispatch({ type: 'REMOVE_VERTICAL_DIVIDER', payload: { index, side: getSide() } }), [getSide]);
  const handleRemoveHorizontalDivider = useCallback((index: number) => dispatch({ type: 'REMOVE_HORIZONTAL_DIVIDER', payload: { index, side: getSide() } }), [getSide]);
  const handleRemoveHMullionSegment = useCallback((dividerIndex: number, col: number) => dispatch({ type: 'REMOVE_H_MULLION_SEGMENT', payload: { dividerIndex, col, side: getSide() } }), [getSide]);
  const handleRemoveVMullionSegment = useCallback((dividerIndex: number, row: number) => dispatch({ type: 'REMOVE_V_MULLION_SEGMENT', payload: { dividerIndex, row, side: getSide() } }), [getSide]);
  const handleMoveHorizontalDivider = useCallback((index: number, ratio: number) => dispatch({ type: 'MOVE_HORIZONTAL_DIVIDER', payload: { index, ratio, side: getSide() } }), [getSide]);
  const handleMoveVerticalDivider = useCallback((index: number, ratio: number) => dispatch({ type: 'MOVE_VERTICAL_DIVIDER', payload: { index, ratio, side: getSide() } }), [getSide]);
  const handleUpdateHandle = useCallback((panelId: string, newConfig: HandleConfig | null) => dispatch({ type: 'UPDATE_HANDLE', payload: { panelId, newConfig, side: getSide() } }), [getSide]);
  const onSetPartitionPanelCount = useCallback((count: number) => dispatch({ type: 'SET_PARTITION_PANEL_COUNT', payload: count }), []);
  const onSetPartitionPreset = useCallback((p: ConfigState['partitionPanels']) => dispatch({ type: 'SET_PARTITION_PRESET', payload: p }), []);
  const onSetPartitionWidthFractions = useCallback((f: number[]) => dispatch({ type: 'SET_PARTITION_WIDTH_FRACTIONS', payload: f }), []);
  const onCyclePartitionPanelType = useCallback((index: number) => dispatch({ type: 'CYCLE_PARTITION_PANEL_TYPE', payload: index }), []);
  const onSetPartitionHasTopChannel = useCallback((hasChannel: boolean) => dispatch({ type: 'SET_PARTITION_HAS_TOP_CHANNEL', payload: hasChannel }), []);
  const onCyclePartitionPanelFraming = useCallback((index: number) => dispatch({ type: 'CYCLE_PARTITION_PANEL_FRAMING', payload: index }), []);
  const onUpdatePartitionPanel = useCallback((index: number, partial: Partial<PartitionPanelConfig>) => {
    dispatch({ type: 'UPDATE_PARTITION_PANEL', payload: { index, partial } });
  }, []);
  
  const onAddLouverItem = useCallback((type: 'profile' | 'gap') => dispatch({ type: 'ADD_LOUVER_ITEM', payload: { type } }), []);
  const onRemoveLouverItem = useCallback((id: string) => dispatch({ type: 'REMOVE_LOUVER_ITEM', payload: { id } }), []);
  const onUpdateLouverItem = useCallback((id: string, size: number | '') => dispatch({ type: 'UPDATE_LOUVER_ITEM', payload: { id, size } }), []);

  const louverSepMm = useMemo(() => getLouverBaySeparatorMm(series.dimensions), [series.dimensions]);
  const onAddLouverBay = useCallback(
    () => dispatch({ type: 'ADD_LOUVER_BAY', payload: { separatorMm: louverSepMm } }),
    [louverSepMm],
  );
  const onRemoveLouverBay = useCallback(
    (id: string) => dispatch({ type: 'REMOVE_LOUVER_BAY', payload: { id, separatorMm: louverSepMm } }),
    [louverSepMm],
  );
  const onUpdateLouverBayDim = useCallback(
    (id: string, field: 'width' | 'height', value: number | '') => {
      dispatch({
        type: 'UPDATE_LOUVER_BAY',
        payload:
          field === 'width'
            ? { id, width: value, separatorMm: louverSepMm }
            : { id, height: value, separatorMm: louverSepMm },
      });
    },
    [louverSepMm],
  );
  const onUpdateLouverBayPosition = useCallback(
    (id: string, partial: { crossAlign?: LouverBayCrossAlign; offsetMm?: number | '' }) => {
      dispatch({ type: 'UPDATE_LOUVER_BAY', payload: { id, ...partial, separatorMm: louverSepMm } });
    },
    [louverSepMm],
  );
  const onSetLouverBayLayout = useCallback(
    (layout: 'vertical' | 'horizontal') =>
      dispatch({ type: 'SET_LOUVER_BAY_LAYOUT', payload: { layout, separatorMm: louverSepMm } }),
    [louverSepMm],
  );
  const onClearLouverBays = useCallback(() => dispatch({ type: 'CLEAR_LOUVER_BAYS' }), []);

  const handleLaminatedConfigChange = useCallback((payload: Partial<LaminatedGlassConfig>) => {
    dispatch({ type: 'UPDATE_LAMINATED_CONFIG', payload });
  }, []);
  const handleDguConfigChange = useCallback((payload: Partial<DguGlassConfig>) => {
    dispatch({ type: 'UPDATE_DGU_CONFIG', payload });
  }, []);
  const handleUpdateMirrorConfig = useCallback((payload: Partial<WindowConfig['mirrorConfig']>) => {
    dispatch({ type: 'UPDATE_MIRROR_CONFIG', payload });
  }, []);

  const handleResetDesign = useCallback(() => {
    if (window.confirm("Are you sure you want to reset the current design? All changes will be lost.")) {
        clearSnapshotForType(windowConfigState.windowType);
        setLayoutCompanions([]);
        setActiveLayoutUnitId('primary');
        clearDesignLayoutSession();
        saveSessionPrintElevationPhoto(undefined);
        frozenPrimaryConfigRef.current = null;
        setLayoutPrimarySnapshot(null);
        dispatch({ type: 'RESET_DESIGN' });
    }
  }, [windowConfigState.windowType]);

  const hardwareCostPerWindow = useMemo(
    () => computeHardwareCostForQuotation(windowConfig, series.hardwareItems),
    [series.hardwareItems, windowConfig]
  );

  const buildQuotationItemFromConfig = useCallback(
    (cfg: WindowConfig, title: string, rateOverride?: number): WindowQuotationItem => {
      const hw = cfg.series?.hardwareItems ?? series.hardwareItems;
      const configForQuotation = JSON.parse(JSON.stringify(cfg)) as WindowConfig;
      const printElevationPhoto = configForQuotation.printElevationPhoto;
      delete configForQuotation.printElevationPhoto;
      return {
        id: uuidv4(),
        title: title || 'Untitled Window',
        config: configForQuotation,
        quantity: Number(quantity) || 1,
        areaType,
        rate: rateOverride !== undefined ? rateOverride : Number(rate) || 0,
        hardwareCost: computeHardwareCostForQuotation(cfg, hw),
        hardwareItems: JSON.parse(JSON.stringify(hw)),
        profileColorName: resolveProfileColorLabel(cfg.profileColor, undefined, savedColors),
        printElevationPhoto: printElevationPhoto || undefined,
      };
    },
    [savedColors, series.hardwareItems, quantity, areaType, rate],
  );

  const handleSaveToQuotation = useCallback(() => {
    const newItem = buildQuotationItemFromConfig(windowConfig, windowTitle || 'Untitled Window');
    setQuotationItems((prev) => applySlidingBasicRateProtection([...prev, newItem]));
    alert(`"${newItem.title}" saved to quotation! You now have ${quotationItems.length + 1} item(s).`);
  }, [windowTitle, windowConfig, buildQuotationItemFromConfig, quotationItems.length, applySlidingBasicRateProtection]);

  const buildPackageItemFromCurrentLayout = useCallback(
    (existingId?: string) => {
      const primaryLabel = layoutPrimaryLabel(windowTitle);
      const syncedCompanions = syncLayoutCompanionTitles(
        primaryLabel,
        layoutCompanionsForCanvas,
      );
      const placements = computeLayoutPlacements(
        layoutPrimaryForCanvas,
        primaryLabel,
        syncedCompanions,
      );
      return normalizeWindowPackageItem(
        buildWindowPackageQuotationItem({
          placements,
          companions: syncedCompanions,
          globalRate: Number(rate) || 0,
          quantity: Number(quantity) || 1,
          areaType,
          packageTitle: primaryLabel,
          savedColors,
          defaultHardwareItems: series.hardwareItems,
          hardwareCostFor: (cfg, hw) => computeHardwareCostForQuotation(cfg, hw),
          printElevationPhoto: windowConfig.printElevationPhoto,
          existingId,
        }),
      );
    },
    [
      layoutPrimaryForCanvas,
      windowTitle,
      layoutCompanionsForCanvas,
      rate,
      quantity,
      areaType,
      savedColors,
      series.hardwareItems,
      windowConfig.printElevationPhoto,
    ],
  );

  const handleSaveLayoutAllToQuotation = useCallback(() => {
    if (layoutCompanionsForCanvas.length === 0) return;
    const editingPackage =
      editingItemId != null &&
      quotationItems.some(
        (i) => i.id === editingItemId && isWindowPackageQuotationItem(i),
      );
    const packageItem = buildPackageItemFromCurrentLayout(
      editingPackage ? editingItemId! : undefined,
    );

    if (editingPackage) {
      setQuotationItems((prev) =>
        applySlidingBasicRateProtection(
          prev.map((item) => (item.id === editingItemId ? packageItem : item)),
        ),
      );
      setEditingItemId(null);
      alert(`"${packageItem.title}" updated successfully!`);
      return;
    }

    setQuotationItems((prev) => applySlidingBasicRateProtection([...prev, packageItem]));
    alert(
      `Combined package (${packageItem.units.length} units) saved! You now have ${quotationItems.length + 1} item(s).`,
    );
  }, [
    layoutCompanionsForCanvas,
    editingItemId,
    quotationItems,
    buildPackageItemFromCurrentLayout,
    quotationItems.length,
    applySlidingBasicRateProtection,
  ]);

  const handlePrintElevationPhotoChange = useCallback(
    (dataUrl: string | undefined) => {
      dispatch({
        type: 'SET_FIELD',
        field: 'printElevationPhoto',
        payload: dataUrl ?? undefined,
      });
      saveSessionPrintElevationPhoto(dataUrl);
    },
    [dispatch],
  );

  const printVisualSizeMm = useMemo(() => {
    if (layoutCompanionsForCanvas.length > 0) {
      const placements = computeLayoutPlacements(
        layoutPrimaryForCanvas,
        windowTitle || 'Window 1',
        layoutCompanionsForCanvas,
      );
      const b = layoutBounds(placements);
      return { w: b.widthMm, h: b.heightMm };
    }
    return {
      w: Number(windowConfig.width) || 1500,
      h: Number(windowConfig.height) || 1200,
    };
  }, [layoutCompanionsForCanvas, layoutPrimaryForCanvas, windowTitle, windowConfig.width, windowConfig.height]);

  const layoutEstimate = useMemo(() => {
    if (layoutCompanionsForCanvas.length === 0) return undefined;
    const placements = computeLayoutPlacements(
      layoutPrimaryForCanvas,
      windowTitle || 'Window 1',
      layoutCompanionsForCanvas,
    );
    return computeLayoutEstimateRows(
      placements,
      layoutCompanionsForCanvas,
      Number(rate) || 0,
      (cfg) => computeHardwareCostForQuotation(cfg, cfg.series?.hardwareItems ?? series.hardwareItems),
    );
  }, [layoutCompanionsForCanvas, layoutPrimaryForCanvas, windowTitle, rate, series.hardwareItems]);

  const handleLayoutUnitRateChange = useCallback((unitId: string, unitRate: number | '') => {
    if (unitId === 'primary') {
      setRate(unitRate);
      return;
    }
    handleUpdateLayoutUnit(unitId, { rate: unitRate });
  }, [handleUpdateLayoutUnit, setRate]);

  const handleBatchSave = useCallback((items: BatchAddItem[]) => {
    const baseConfigForQuotation = JSON.parse(JSON.stringify(windowConfig));

    const newQuotationItems: QuotationItem[] = items
      .filter(item => Number(item.width) > 0 && Number(item.height) > 0)
      .map(item => {
        const itemConfig = JSON.parse(JSON.stringify(baseConfigForQuotation));
        itemConfig.width = Number(item.width);
        itemConfig.height = Number(item.height);
        if (itemConfig.windowType === WindowType.LOUVERS) {
          itemConfig.louverBays = [];
          itemConfig.louverBayLayout = 'vertical';
        }
        
        return {
          id: uuidv4(),
          title: item.title || 'Untitled Window',
          config: itemConfig,
          quantity: Number(item.quantity) || 1,
          areaType,
          rate: Number(item.rate) || 0,
          hardwareCost: hardwareCostPerWindow,
          hardwareItems: JSON.parse(JSON.stringify(series.hardwareItems)),
          profileColorName: resolveProfileColorLabel(itemConfig.profileColor, undefined, savedColors),
        };
    });

    setQuotationItems(prev => applySlidingBasicRateProtection([...prev, ...newQuotationItems]));
    setIsBatchAddModalOpen(false);
    alert(`${newQuotationItems.length} item(s) saved to quotation! You now have ${quotationItems.length + newQuotationItems.length} item(s).`);
  }, [windowConfig, areaType, hardwareCostPerWindow, series.hardwareItems, savedColors, quotationItems.length, applySlidingBasicRateProtection]);


  const handleRemoveQuotationItem = useCallback((id: string) => {
    setQuotationItems(prev => applySlidingBasicRateProtection(prev.filter(item => item.id !== id)));
  }, [applySlidingBasicRateProtection]);
  
  const handleInstallClick = async () => {
    if (!installPrompt) return;
    await installPrompt.prompt();
    await installPrompt.userChoice;
    setInstallPrompt(null);
  };
  
  const setConfig = useCallback((field: keyof WindowConfig, value: any) => {
    if (field === 'series') {
      setSeries(value);
    } else if (field === 'windowType') {
      navigate(`/design/${value}`);
    }
    else {
      dispatch({ type: 'SET_FIELD', field: field as keyof ConfigState, payload: value });
    }
  }, [navigate]);

  const setSideConfig = useCallback((config: Partial<CornerSideConfig>) => {
    dispatch({ type: 'SET_SIDE_CONFIG', payload: { side: activeCornerSide, config } });
  }, [activeCornerSide]);
  
  const handleEditItem = useCallback((id: string) => {
    const itemToEdit = quotationItems.find(item => item.id === id);
    if (!itemToEdit) return;

    if (itemToEdit.kind === 'railing') {
      try {
        sessionStorage.setItem(
          'wm-railing-unified-restore-v1',
          JSON.stringify({ line: itemToEdit.railingLine }),
        );
      } catch {
        /* ignore */
      }
      setIsQuotationModalOpen(false);
      setQuotationBulkTargetIds([]);
      setIsPreviewing(false);
      navigate('/design/railing');
      return;
    }

    if (isWindowPackageQuotationItem(itemToEdit)) {
      try {
        const restored = reconstructDesignLayoutFromPackage(itemToEdit);
        const { series: ser, ...configState } = restored.primaryConfig;
        dispatch({ type: 'LOAD_CONFIG', payload: configState });
        if (ser?.id) {
          const matched = availableSeries.find((s) => s.id === ser.id);
          setSeries(
            matched
              ? { ...matched, hardwareItems: ser.hardwareItems ?? restored.primaryHardwareItems }
              : ser,
          );
        } else if (restored.primaryHardwareItems.length > 0) {
          setSeries((prev) => ({ ...prev, hardwareItems: restored.primaryHardwareItems }));
        }
        const itemPhoto = itemToEdit.printElevationPhoto;
        dispatch({
          type: 'SET_FIELD',
          field: 'printElevationPhoto',
          payload: itemPhoto,
        });
        saveSessionPrintElevationPhoto(itemPhoto);
        setLayoutCompanions(restored.companions);
        setActiveLayoutUnitId('primary');
        saveDesignLayoutSession({ companions: restored.companions, activeUnitId: 'primary' });
        frozenPrimaryConfigRef.current = null;
        setLayoutPrimarySnapshot(null);
        setWindowTitle(restored.primaryTitle);
        setQuantity(itemToEdit.quantity);
        setRate(restored.primaryRate);
        setAreaType(itemToEdit.areaType);
        setEditingItemId(id);
        setQuotationBulkTargetIds([]);
        setIsPreviewing(false);
        setIsQuotationModalOpen(false);
        setActiveMobilePanel('none');
        navigate(`/design/${restored.primaryConfig.windowType}`);
      } catch (err) {
        console.error('Failed to restore package for edit', err);
        alert('Could not open this package for editing.');
      }
      return;
    }

    if (!isWindowQuotationItem(itemToEdit)) return;

    const { series: ser, ...configState } = itemToEdit.config;
    dispatch({ type: 'LOAD_CONFIG', payload: configState });
    if (ser?.id) {
      const matched = availableSeries.find((s) => s.id === ser.id);
      setSeries(
        matched
          ? { ...matched, hardwareItems: ser.hardwareItems ?? itemToEdit.hardwareItems }
          : ser,
      );
    } else if (itemToEdit.hardwareItems?.length) {
      setSeries((prev) => ({ ...prev, hardwareItems: itemToEdit.hardwareItems }));
    }
    const itemPhoto = itemToEdit.printElevationPhoto;
    dispatch({
      type: 'SET_FIELD',
      field: 'printElevationPhoto',
      payload: itemPhoto,
    });
    saveSessionPrintElevationPhoto(itemPhoto);
    setLayoutCompanions([]);
    setActiveLayoutUnitId('primary');
    saveDesignLayoutSession({ companions: [], activeUnitId: 'primary' });
    frozenPrimaryConfigRef.current = null;
    setLayoutPrimarySnapshot(null);
    setWindowTitle(itemToEdit.title);
    setQuantity(itemToEdit.quantity);
    setRate(itemToEdit.rate);
    setAreaType(itemToEdit.areaType);
    setEditingItemId(id);
    setQuotationBulkTargetIds([]);
    setIsPreviewing(false);
    setIsQuotationModalOpen(false);
    setActiveMobilePanel('none');
    navigate(`/design/${itemToEdit.config.windowType}`);
  }, [quotationItems, navigate, availableSeries, dispatch]);

  const handleUpdateQuotationItem = useCallback(() => {
    if (!editingItemId) return;

    const existing = quotationItems.find((i) => i.id === editingItemId);
    if (existing && isWindowPackageQuotationItem(existing)) {
      if (layoutCompanionsForCanvas.length === 0) {
        alert('This package has no layout windows to update.');
        return;
      }
      const packageItem = buildPackageItemFromCurrentLayout(editingItemId);
      setQuotationItems((prev) =>
        applySlidingBasicRateProtection(
          prev.map((item) => (item.id === editingItemId ? packageItem : item)),
        ),
      );
      setEditingItemId(null);
      alert(`"${packageItem.title}" updated successfully!`);
      return;
    }

    const configForQuotation = JSON.parse(JSON.stringify(windowConfig)) as WindowConfig;
    const printElevationPhoto = configForQuotation.printElevationPhoto;
    delete configForQuotation.printElevationPhoto;

    const updatedItem: QuotationItem = {
        kind: 'window',
        id: editingItemId,
        title: windowTitle || 'Untitled Window',
        config: configForQuotation,
        quantity: Number(quantity) || 1,
        areaType,
        rate: Number(rate) || 0,
        hardwareCost: hardwareCostPerWindow,
        hardwareItems: JSON.parse(JSON.stringify(series.hardwareItems)),
        profileColorName: resolveProfileColorLabel(windowConfig.profileColor, undefined, savedColors),
        printElevationPhoto: printElevationPhoto || undefined,
    };

    setQuotationItems(prev => applySlidingBasicRateProtection(prev.map(item => item.id === editingItemId ? updatedItem : item)));
    
    setEditingItemId(null);
    alert(`"${updatedItem.title}" updated successfully!`);
  }, [
    editingItemId,
    quotationItems,
    layoutCompanionsForCanvas.length,
    buildPackageItemFromCurrentLayout,
    savedColors,
    windowConfig,
    windowTitle,
    quantity,
    areaType,
    rate,
    hardwareCostPerWindow,
    series.hardwareItems,
    applySlidingBasicRateProtection,
  ]);

  const handleCancelEdit = useCallback(() => {
    if (window.confirm("Are you sure you want to cancel editing? Any changes will be lost.")) {
        setEditingItemId(null);
        setLayoutCompanions([]);
        setActiveLayoutUnitId('primary');
        saveDesignLayoutSession({ companions: [], activeUnitId: 'primary' });
        frozenPrimaryConfigRef.current = null;
        setLayoutPrimarySnapshot(null);
        dispatch({ type: 'RESET_DESIGN' });
        setWindowTitle('Window 1');
        setQuantity(1);
        setRate(550);
        setAreaType(AreaType.SQFT);
    }
  }, [dispatch]);

  const handleEditCorrectionFromSelection = useCallback(() => {
    if (quotationBulkTargetIds.length === 0) return;
    const idSet = new Set(quotationBulkTargetIds);
    const selectedInOrder = quotationItems.filter((i) => idSet.has(i.id));
    if (selectedInOrder.length === 0) {
      setQuotationBulkTargetIds([]);
      return;
    }
    if (selectedInOrder.some((i) => i.kind === 'railing')) {
      alert('Bulk correction: edit railing lines in the Glass railing designer (Edit).');
      return;
    }
    const windowRows = selectedInOrder.filter(isWindowQuotationItem);
    if (windowRows.length === 0) {
      setQuotationBulkTargetIds([]);
      return;
    }
    const wt = windowRows[0].config.windowType;
    if (!windowRows.every((i) => i.config.windowType === wt)) {
      alert('Bulk correction: select rows of the same window type only.');
      return;
    }
    const first = windowRows[0];
    const { series: ser, ...configState } = first.config;
    dispatch({ type: 'LOAD_CONFIG', payload: configState });
    setSeries(ser);
    setWindowTitle(first.title);
    setQuantity(first.quantity);
    setRate(first.rate);
    setAreaType(first.areaType);
    setEditingItemId(null);
    setCanvasKey(uuidv4());
    setIsPreviewing(false);
    setIsQuotationModalOpen(false);
    setActiveMobilePanel('none');
    navigate(`/design/${wt}`);
  }, [quotationBulkTargetIds, quotationItems, navigate, dispatch]);

  const handleBulkApplyDesignerToSelected = useCallback(() => {
    if (quotationBulkTargetIds.length === 0) return;
    const idSet = new Set(quotationBulkTargetIds);
    let updated = 0;
    let skipped = 0;
    const newItems = quotationItems.map((item) => {
      if (!idSet.has(item.id)) return item;
      if (!isWindowQuotationItem(item)) {
        skipped++;
        return item;
      }
      const merged = applyDesignerCorrectionToQuotationItem(item, {
        designerConfig: windowConfig,
        designerSeries: series,
        savedColors,
      });
      if (!merged) {
        skipped++;
        return item;
      }
      if (!isWindowQuotationItem(merged)) {
        skipped++;
        return item;
      }
      updated++;
      merged.rate = Number(rate) || 0;
      merged.areaType = areaType;
      return merged;
    });
    if (updated === 0) {
      alert(
        'Could not apply. Open the same window type on the designer as the selected quotation lines, then try again.'
      );
      return;
    }
    setQuotationItems(applySlidingBasicRateProtection(newItems));
    setQuotationBulkTargetIds([]);
    alert(
      `Correction applied to ${updated} product(s).${skipped > 0 ? ` Skipped ${skipped} (type mismatch).` : ''} Each line keeps its own size, quantity, and layout; rate and area unit match the quotation panel.`
    );
  }, [quotationBulkTargetIds, quotationItems, windowConfig, series, savedColors, rate, areaType, applySlidingBasicRateProtection]);

  const handleHomeownerLiveBaseRate = useCallback(
    (next: number) => {
      if (userModeState.mode !== 'homeowner') return;
      const rounded = Math.round(next);
      if (rounded > 0) setRate(rounded);
    },
    [userModeState.mode],
  );

  const commonControlProps = useMemo(() => ({
    config: windowConfig,
    setConfig,
    setSideConfig,
    setGridSize: handleSetGridSize,
    availableSeries: availableSeries,
    onSeriesSelect: handleSeriesSelect,
    onSeriesSave: handleSeriesSave,
    onSeriesDelete: handleSeriesDelete,
    addFixedPanel: addFixedPanel,
    removeFixedPanel: removeFixedPanel,
    updateFixedPanelSize: updateFixedPanelSize,
    onHardwareChange: handleHardwareChange,
    onAddHardware: addHardwareItem,
    onRemoveHardware: removeHardwareItem,
    toggleDoorPosition: toggleDoorPosition,
    onVentilatorCellClick: handleVentilatorCellClick,
    savedColors: savedColors,
    setSavedColors: setSavedColors,
    onUpdateHandle: handleUpdateHandle,
    onSetPartitionPanelCount,
    onSetPartitionPreset,
    onSetPartitionWidthFractions,
    onCyclePartitionPanelType,
    onSetPartitionHasTopChannel,
    onCyclePartitionPanelFraming,
    onUpdatePartitionPanel,
    onAddLouverItem,
    onRemoveLouverItem,
    onUpdateLouverItem,
    onAddLouverBay,
    onRemoveLouverBay,
    onUpdateLouverBayDim,
    onUpdateLouverBayPosition,
    onSetLouverBayLayout,
    onClearLouverBays,
    onLaminatedConfigChange: handleLaminatedConfigChange,
    onDguConfigChange: handleDguConfigChange,
    onUpdateMirrorConfig: handleUpdateMirrorConfig,
    onResetDesign: handleResetDesign,
    activeCornerSide,
    setActiveCornerSide,
    materialRates: quotationSettings.materialRates,
    openingMm2: getWindowQuotationAreaMm2(windowConfig),
    onHomeownerLiveBaseRate: handleHomeownerLiveBaseRate,
    layoutGetUnitConfig,
  }), [windowConfig, setConfig, setSideConfig, handleSetGridSize, availableSeries, handleSeriesSelect, handleSeriesSave, handleSeriesDelete, addFixedPanel, removeFixedPanel, updateFixedPanelSize, handleHardwareChange, addHardwareItem, removeHardwareItem, toggleDoorPosition, handleVentilatorCellClick, savedColors, handleUpdateHandle, onSetPartitionPanelCount, onSetPartitionPreset, onSetPartitionWidthFractions, onCyclePartitionPanelType, onSetPartitionHasTopChannel, onCyclePartitionPanelFraming, onUpdatePartitionPanel, onAddLouverBay, onRemoveLouverBay, onUpdateLouverBayDim, onUpdateLouverBayPosition, onSetLouverBayLayout, onClearLouverBays, handleLaminatedConfigChange, handleDguConfigChange, handleUpdateMirrorConfig, handleResetDesign, activeCornerSide, quotationSettings.materialRates, handleHomeownerLiveBaseRate, layoutGetUnitConfig]);

  const handleOpenConfigure = () => setActiveMobilePanel('configure');
  const handleOpenQuote = () => setActiveMobilePanel('quotation');
  const handleCloseMobilePanels = () => setActiveMobilePanel('none');
  
  const handleViewQuotation = useCallback(() => {
    setIsQuotationModalOpen(true);
    setActiveMobilePanel('none');
  }, []);

  /** Must clear preview flag whenever the quotation modal closes; otherwise the designer stays `hidden`. */
  const handleCloseQuotationModal = useCallback(() => {
    setIsPreviewing(false);
    setIsQuotationModalOpen(false);
  }, []);

  const handleBatchAdd = useCallback(() => {
    setIsBatchAddModalOpen(true);
    setActiveMobilePanel('none');
  }, []);

  useEffect(() => {
    const isTextInputTarget = (target: EventTarget | null): boolean => {
      if (!(target instanceof HTMLElement)) return false;
      return (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.tagName === 'SELECT' ||
        target.isContentEditable
      );
    };

    const onKeyDown = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase();
      const hasModifier = event.ctrlKey || event.metaKey;
      const typing = isTextInputTarget(event.target);

      if (key === 'escape') {
        if (isShortcutHelpOpen) {
          setIsShortcutHelpOpen(false);
          return;
        }
        if (isQuotationModalOpen) {
          setIsPreviewing(false);
          setIsQuotationModalOpen(false);
          return;
        }
        if (isBatchAddModalOpen) {
          setIsBatchAddModalOpen(false);
          return;
        }
        if (activeMobilePanel !== 'none') {
          setActiveMobilePanel('none');
        }
        return;
      }

      if (!hasModifier) return;
      if (typing) return;

      if (key === '/' || key === '?') {
        event.preventDefault();
        setIsShortcutHelpOpen((prev) => !prev);
        return;
      }

      if (key === 's' && appView === 'designer') {
        event.preventDefault();
        if (editingItemId) handleUpdateQuotationItem();
        else handleSaveToQuotation();
        return;
      }
      if (key === 'q' && appView === 'designer') {
        event.preventDefault();
        handleViewQuotation();
        return;
      }
      if (key === 'b' && appView === 'designer') {
        event.preventDefault();
        handleBatchAdd();
        return;
      }
      if (key === 'r' && appView === 'designer') {
        event.preventDefault();
        handleResetDesign();
        return;
      }
      if (key === 'g') {
        event.preventDefault();
        navigate('/guides/index');
        return;
      }
      if (key === '8' || event.code === 'Digit8') {
        event.preventDefault();
        navigate('/design/railing');
        return;
      }

      const typeByDigit: Record<string, WindowType> = {
        '1': WindowType.SLIDING,
        '2': WindowType.CASEMENT,
        '3': WindowType.VENTILATOR,
        '4': WindowType.GLASS_PARTITION,
        '5': WindowType.LOUVERS,
        '6': WindowType.CORNER,
        '7': WindowType.MIRROR,
      };
      if (typeByDigit[key]) {
        event.preventDefault();
        navigate(`/design/${typeByDigit[key]}`);
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [
    appView,
    editingItemId,
    handleBatchAdd,
    handleResetDesign,
    handleSaveToQuotation,
    handleUpdateQuotationItem,
    isBatchAddModalOpen,
    isQuotationModalOpen,
    isShortcutHelpOpen,
    activeMobilePanel,
    navigate,
  ]);
  
  return (
    <>
      {isQuotationModalOpen && (
        <Suspense fallback={null}>
          <QuotationListModal
            isOpen={isQuotationModalOpen}
            onClose={handleCloseQuotationModal}
            items={quotationItems}
            setItems={(items) => setQuotationItems(applySlidingBasicRateProtection(items))}
            onRemove={handleRemoveQuotationItem}
            onEdit={handleEditItem}
            settings={quotationSettings}
            setSettings={setQuotationSettings}
            onTogglePreview={setIsPreviewing}
            selectedLineIds={quotationBulkTargetIds}
            onSelectedLineIdsChange={setQuotationBulkTargetIds}
            onEditCorrection={handleEditCorrectionFromSelection}
            savedColors={savedColors}
          />
        </Suspense>
      )}
      {isBatchAddModalOpen && (
          <Suspense fallback={null}>
              <BatchAddModal isOpen={isBatchAddModalOpen} onClose={() => setIsBatchAddModalOpen(false)} baseConfig={windowConfig} baseRate={rate} onSave={handleBatchSave} />
          </Suspense>
      )}
      {isShortcutHelpOpen && (
        <div className="fixed inset-0 z-[120] bg-black/70 p-4 no-print" onClick={() => setIsShortcutHelpOpen(false)}>
          <div className="mx-auto mt-12 w-full max-w-2xl rounded-lg border border-slate-600 bg-slate-900 p-5 text-slate-200 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-semibold text-white">Keyboard Controls</h2>
            <p className="mt-1 text-xs text-slate-400">Works across designer and guides. Use Ctrl on Windows/Linux, Cmd on macOS.</p>
            <div className="mt-4 grid grid-cols-1 gap-2 text-sm sm:grid-cols-2">
              <div><strong>Ctrl/Cmd + S</strong> Save/Update quotation line</div>
              <div><strong>Ctrl/Cmd + Q</strong> Open quotation list</div>
              <div><strong>Ctrl/Cmd + B</strong> Open batch add</div>
              <div><strong>Ctrl/Cmd + R</strong> Reset design</div>
              <div><strong>Ctrl/Cmd + G</strong> Open guides</div>
              <div><strong>Ctrl/Cmd + /</strong> Toggle this help</div>
              <div><strong>Ctrl/Cmd + 1..7</strong> Quick switch feature types</div>
              <div><strong>Ctrl/Cmd + 8</strong> Glass railing designer</div>
              <div><strong>Esc</strong> Close active modal/panel</div>
            </div>
            <div className="mt-4 rounded border border-slate-700 bg-slate-800/70 p-3 text-xs text-slate-300">
              <p><strong>Embed/API params:</strong> <code>?embed=1&type=sliding&width=1800&height=1200&title=Ad%20Demo&qty=1&rate=650&area=sqft</code></p>
            </div>
            <div className="mt-4 flex justify-end">
              <Button variant="secondary" onClick={() => setIsShortcutHelpOpen(false)}>Close</Button>
            </div>
          </div>
        </div>
      )}
      
      <div
        className={`flex min-h-0 flex-1 flex-col overflow-x-hidden overscroll-y-contain font-sans bg-slate-900 ${
          appView === 'designer' || appView === 'railing'
            ? 'overflow-y-hidden'
            : 'overflow-y-auto'
        } ${isPreviewing || isQuotationModalOpen || isBatchAddModalOpen ? 'hidden' : ''}`}
      >
        <Suspense fallback={null}>
            {appView === 'railing' ? (
                <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
                  <div className="railing-embed-scroll-host custom-scrollbar min-h-0 flex-1 touch-pan-y overflow-x-hidden overflow-y-auto overscroll-y-contain [-webkit-overflow-scrolling:touch]">
                    <RailingDesignerApp
                      embedUnified={{
                        onPushLine: handleUpsertUnifiedRailingLine,
                        onBackToWindows: () => navigate(`/design/${windowType}`),
                        onReplaceUnifiedRailingLines: handleReplaceUnifiedRailingLines,
                        onRemoveLine: handleRemoveUnifiedRailingLine,
                        onClearLines: handleClearUnifiedRailingLines,
                        unifiedLines: unifiedRailingLines,
                      }}
                    />
                  </div>
                </div>
            ) : appView === 'designer' ? (
                <DesignerView
                    onOpenGuides={() => navigate('/guides/index')}
                    installPrompt={installPrompt}
                    handleInstallClick={handleInstallClick}
                    panelRef={panelRef}
                    isDesktopPanelOpen={isDesktopPanelOpen}
                    setIsDesktopPanelOpen={setIsDesktopPanelOpen}
                    commonControlProps={commonControlProps}
                    canvasKey={canvasKey}
                    windowConfig={windowConfig}
                    handleRemoveVerticalDivider={handleRemoveVerticalDivider}
                    handleRemoveHorizontalDivider={handleRemoveHorizontalDivider}
                    handleRemoveHMullionSegment={handleRemoveHMullionSegment}
                    handleRemoveVMullionSegment={handleRemoveVMullionSegment}
                    handleMoveHorizontalDivider={handleMoveHorizontalDivider}
                    handleMoveVerticalDivider={handleMoveVerticalDivider}
                    quantity={quantity}
                    setQuantity={setQuantity}
                    areaType={areaType}
                    setAreaType={setAreaType}
                    rate={rate}
                    setRate={setRate}
                    onSave={handleSaveToQuotation}
                    onUpdate={handleUpdateQuotationItem}
                    onCancelEdit={handleCancelEdit}
                    editingItemId={editingItemId}
                    onBatchAdd={handleBatchAdd}
                    windowTitle={windowTitle}
                    setWindowTitle={setWindowTitle}
                    hardwareCostPerWindow={hardwareCostPerWindow}
                    quotationItemCount={quotationItems.length}
                    onViewQuotation={handleViewQuotation}
                    bulkCorrectionLineCount={quotationBulkTargetIds.length}
                    onApplyBulkCorrection={handleBulkApplyDesignerToSelected}
                    activeMobilePanel={activeMobilePanel}
                    handleOpenConfigure={handleOpenConfigure}
                    handleOpenQuote={handleOpenQuote}
                    handleCloseMobilePanels={handleCloseMobilePanels}
                    isEmbedded={isEmbedded}
                    onOpenShortcuts={() => setIsShortcutHelpOpen(true)}
                    quotationSettings={quotationSettings}
                    layoutCompanions={layoutCompanions}
                    activeLayoutUnitId={activeLayoutUnitId}
                    onActiveLayoutUnitChange={handleActiveLayoutUnitChange}
                    onAddLayoutUnits={handleAddLayoutUnits}
                    onRemoveLayoutUnit={handleRemoveLayoutUnit}
                    onUpdateLayoutUnit={handleUpdateLayoutUnit}
                    onSaveLayoutAllToQuotation={handleSaveLayoutAllToQuotation}
                    layoutPrimaryForCanvas={layoutPrimaryForCanvas}
                    layoutCompanionsForCanvas={layoutCompanionsForCanvas}
                    layoutEstimate={layoutEstimate}
                    onLayoutUnitRateChange={handleLayoutUnitRateChange}
                    printElevationPhoto={windowConfig.printElevationPhoto}
                    onPrintElevationPhotoChange={handlePrintElevationPhotoChange}
                    printVisualWidthMm={printVisualSizeMm.w}
                    printVisualHeightMm={printVisualSizeMm.h}
                />
            ) : (
                <GuidesViewer 
                    activeSlug={guideSlug} 
                    onClose={() => navigate(`/design/${windowType}`)}
                />
            )}
        </Suspense>
      </div>
    </>
  );
};

export default App;