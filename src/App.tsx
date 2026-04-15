import React, { useState, useEffect, useMemo, useRef, useReducer, useCallback, lazy, Suspense } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import type { ProfileSeries, WindowConfig, HardwareItem, QuotationItem, VentilatorCell, GlassSpecialType, SavedColor, VentilatorCellType, PartitionPanelType, PartitionPanelConfig, QuotationSettings, HandleConfig, CornerSideConfig, LaminatedGlassConfig, DguGlassConfig, BatchAddItem, GlassGridConfig } from './types';
import { FixedPanelPosition, ShutterConfigType, TrackType, GlassType, AreaType, WindowType, MirrorShape } from './types';
import { ControlsPanel } from './components/ControlsPanel';
import { WindowCanvas } from './components/WindowCanvas';
import { QuotationPanel } from './components/QuotationPanel';
import { v4 as uuidv4 } from 'uuid';
import { ChevronLeftIcon } from './components/icons/ChevronLeftIcon';
import { WoodenMaxCatalogMenu } from './components/WoodenMaxCatalogMenu';
import { Logo } from './components/icons/Logo';
import { Button } from './components/ui/Button';
import { DownloadIcon } from './components/icons/DownloadIcon';
import { AdjustmentsIcon } from './components/icons/AdjustmentsIcon';
import { ListBulletIcon } from './components/icons/ListBulletIcon';
import { DocumentTextIcon } from './components/icons/DocumentTextIcon';
import { QuotationListModal } from './components/QuotationListModal';
import {
  saveSnapshotForType,
  getSnapshotForType,
  clearSnapshotForType,
  type DesignSnapshot,
} from './utils/windowTypeDesignSnapshots';
import { SITE_ORIGIN } from './constants/site';
import { DEFAULT_MATERIAL_RATES } from './constants/materialRates';
import { applyRouteSeo, getMetaDescription } from './seo/meta';
import { computeHardwareCostForQuotation } from './utils/quotationHardwareCost';
import { applyDesignerCorrectionToQuotationItem } from './utils/applyDesignerCorrectionToQuotationItem';
import { calculateMaterialCostSummary } from './utils/materialCosting';

const BatchAddModal = lazy(() => import('./components/BatchAddModal').then(module => ({ default: module.BatchAddModal })));
const GuidesViewer = lazy(() => import('./components/GuidesViewer').then(module => ({ default: module.GuidesViewer })));

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
  | { type: 'UPDATE_HANDLE'; payload: { panelId: string; newConfig: HandleConfig | null, side: 'left' | 'right' | null } }
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
  | { type: 'SET_SIDE_CONFIG'; payload: { side: 'left' | 'right'; config: Partial<CornerSideConfig> } }
  | { type: 'UPDATE_LAMINATED_CONFIG'; payload: Partial<LaminatedGlassConfig> }
  | { type: 'UPDATE_DGU_CONFIG'; payload: Partial<DguGlassConfig> }
  | { type: 'UPDATE_MIRROR_CONFIG'; payload: Partial<WindowConfig['mirrorConfig']> }
  | { type: 'LOAD_CONFIG'; payload: ConfigState }
  | { type: 'RESET_DESIGN' };

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
    // 35mm Opulence Series
    {
        id: 'series-sliding-35mm-opulence-2t-slim-default',
        name: '35mm Opulence (2-Track, Slim Interlock)',
        type: WindowType.SLIDING,
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
        shutterTop: 55, shutterBottom: 55, shutterMeeting: 50,
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
            const newH = Array.from({ length: rows - 1 }).map((_, i) => (i + 1) / rows);
            const newV = Array.from({ length: cols - 1 }).map((_, i) => (i + 1) / cols);
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
        case 'UPDATE_HANDLE': {
            const { panelId, newConfig, side } = action.payload;
            const parts = panelId.split('-');
            const type = parts[0];

            const [configKey, config] = getSideConfig(side);
            let newSideConfig = { ...config };

            switch (type) {
                case 'sliding': {
                    const index = parseInt(parts[1], 10);
                    const newHandles = [...config.slidingHandles];
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
            return finalConfig;
        }
        case 'RESET_DESIGN': {
             return {
                ...initialConfig,
                windowType: state.windowType,
            };
        }
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

      return finalConfig;
    }
  } catch (error) {
    console.error("Could not load current config from localStorage", error);
  }
  return initialConfig;
};

type MobilePanelState = 'none' | 'configure' | 'quotation';
type AppView = 'designer' | 'guides';

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
}

const DesignerView: React.FC<DesignerViewProps> = React.memo((props) => {
  const {
    onOpenGuides,
    installPrompt, handleInstallClick, panelRef, isDesktopPanelOpen, setIsDesktopPanelOpen,
    commonControlProps, canvasKey, windowConfig, handleRemoveVerticalDivider, handleRemoveHorizontalDivider,
    quantity, setQuantity, areaType, setAreaType, rate, setRate,
    onSave, onUpdate, onCancelEdit, editingItemId,
    onBatchAdd, windowTitle, setWindowTitle, hardwareCostPerWindow, quotationItemCount,
    onViewQuotation, bulkCorrectionLineCount, onApplyBulkCorrection,
    activeMobilePanel, handleOpenConfigure, handleOpenQuote, handleCloseMobilePanels,
    isEmbedded,
    onOpenShortcuts
  } = props;

  return (
    <>
      {!isEmbedded && (
      <header className="no-print z-40 flex flex-col gap-2 border-b border-slate-200/90 bg-gradient-to-b from-white to-slate-100 px-3 py-2.5 shadow-sm sm:flex-row sm:items-center sm:gap-3">
            <div className="flex min-w-0 flex-1 items-center gap-2.5 sm:gap-3">
              <h1 className="sr-only">
                WoodenMax Window Designer — free aluminium &amp; uPVC window &amp; door design with PDF quotations and BOM
              </h1>
              <div className="shrink-0 rounded-lg bg-white px-2 py-1.5 shadow-sm ring-1 ring-slate-200/90">
                <Logo className="h-9 w-auto max-h-9 max-w-[min(100%,200px)] object-contain sm:h-10 sm:max-h-10" alt="WoodenMax logo" />
              </div>
              <p className="min-w-0 flex-1 text-xs font-medium leading-snug text-slate-700 sm:text-sm">
                Reshaping spaces — free window &amp; door design with instant quotations.
              </p>
            </div>
            <div className="flex shrink-0 items-center justify-end gap-2 sm:ml-auto">
              <WoodenMaxCatalogMenu />
              <Button onClick={onOpenGuides} variant="secondary" className="hidden sm:inline-flex">
                <DocumentTextIcon className="mr-2 h-5 w-5" /> Features &amp; Guides
              </Button>
              <Button onClick={onOpenShortcuts} variant="secondary" className="hidden sm:inline-flex">
                Keyboard
              </Button>
              <Button
                onClick={onOpenGuides}
                variant="secondary"
                className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center p-0 sm:hidden"
                aria-label="Features and guides"
              >
                <DocumentTextIcon className="h-6 w-6" />
              </Button>
              {installPrompt && (
                <Button onClick={handleInstallClick} variant="secondary" className="animate-pulse whitespace-nowrap text-xs sm:text-sm">
                  <DownloadIcon className="mr-1.5 h-4 w-4 sm:mr-2 sm:h-5 sm:w-5" />
                  <span className="hidden sm:inline">Add to Home Screen</span>
                  <span className="sm:hidden">Install app</span>
                </Button>
              )}
            </div>
        </header>
      )}
        <main className="flex flex-row flex-grow min-h-0">
            <div ref={panelRef} className={`hidden lg:block flex-shrink-0 h-full transition-all duration-300 ease-in-out z-30 bg-slate-800 no-print ${isDesktopPanelOpen ? 'w-96' : 'w-0'}`}>
                <div className={`h-full overflow-hidden ${isDesktopPanelOpen ? 'w-96' : 'w-0'}`}>
                    <ControlsPanel {...commonControlProps} idPrefix="desktop-" onClose={() => setIsDesktopPanelOpen(false)} />
                </div>
            </div>
            <div className="relative flex-1 flex flex-col min-w-0">
                {!isDesktopPanelOpen && ( <button onClick={() => setIsDesktopPanelOpen(true)} className="absolute top-1/2 -translate-y-1/2 left-0 bg-slate-700 hover:bg-indigo-600 text-white w-6 h-24 rounded-r-lg z-20 focus:outline-none focus:ring-2 focus:ring-indigo-500 items-center justify-center transition-all duration-300 no-print hidden lg:flex" aria-label="Expand panel"> <ChevronLeftIcon className="w-5 h-5 rotate-180" /> </button> )}
              <div className="flex-grow relative">
                 <WindowCanvas key={canvasKey} config={windowConfig} onRemoveVerticalDivider={handleRemoveVerticalDivider} onRemoveHorizontalDivider={handleRemoveHorizontalDivider} onToggleElevationDoor={() => {}} />
              </div>
              <div className="flex-shrink-0 no-print hidden lg:block">
                  <QuotationPanel idPrefix="desktop-" width={Number(windowConfig.width) || 0} height={Number(windowConfig.height) || 0} quantity={quantity} setQuantity={setQuantity} areaType={areaType} setAreaType={setAreaType} rate={rate} setRate={setRate} onSave={onSave} onUpdate={onUpdate} onCancelEdit={onCancelEdit} editingItemId={editingItemId} onBatchAdd={onBatchAdd} windowTitle={windowTitle} setWindowTitle={setWindowTitle} hardwareCostPerWindow={hardwareCostPerWindow} quotationItemCount={quotationItemCount} onViewQuotation={onViewQuotation} bulkCorrectionLineCount={bulkCorrectionLineCount} onApplyBulkCorrection={onApplyBulkCorrection} />
              </div>
              <div className="no-print grid grid-cols-2 gap-3 border-t-2 border-slate-700 bg-slate-800 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] lg:hidden">
                  <Button onClick={handleOpenConfigure} variant="secondary" className="min-h-[48px] justify-center text-sm font-semibold">
                    <AdjustmentsIcon className="mr-2 h-5 w-5 shrink-0" /> Configure
                  </Button>
                  <Button onClick={handleOpenQuote} variant="secondary" className="min-h-[48px] justify-center text-sm font-semibold">
                    <ListBulletIcon className="mr-2 h-5 w-5 shrink-0" /> Quotation
                  </Button>
              </div>
            </div>
        </main>
        {/* Mobile Configure Panel */}
        <div className={`lg:hidden fixed inset-0 bg-black bg-opacity-50 z-40 transition-opacity duration-300 ${activeMobilePanel === 'configure' ? 'opacity-100' : 'opacity-0 pointer-events-none'}`} onClick={handleCloseMobilePanels}></div>
        <div className={`no-print fixed bottom-0 left-0 right-0 z-50 flex max-h-[90vh] h-[min(90vh,100dvh)] flex-col rounded-t-xl bg-slate-800 pb-[env(safe-area-inset-bottom)] shadow-[0_-8px_30px_rgba(0,0,0,0.35)] transition-transform duration-300 ease-in-out lg:hidden ${activeMobilePanel === 'configure' ? 'translate-y-0' : 'translate-y-full'}`}>
           <div className="flex shrink-0 justify-center py-2" aria-hidden="true">
             <div className="h-1.5 w-12 rounded-full bg-slate-600" />
           </div>
           <div className="min-h-0 flex-1 overflow-hidden">
             <ControlsPanel {...commonControlProps} idPrefix="mobile-" onClose={handleCloseMobilePanels} />
           </div>
        </div>
        
        {/* Mobile Quotation Panel */}
        <div className={`lg:hidden fixed inset-0 bg-black bg-opacity-50 z-40 transition-opacity duration-300 ${activeMobilePanel === 'quotation' ? 'opacity-100' : 'opacity-0 pointer-events-none'}`} onClick={handleCloseMobilePanels}></div>
        <div className={`no-print fixed bottom-0 left-0 right-0 z-50 flex max-h-[92vh] h-[min(92vh,100dvh)] flex-col rounded-t-xl bg-slate-800 pb-[env(safe-area-inset-bottom)] shadow-[0_-8px_30px_rgba(0,0,0,0.35)] transition-transform duration-300 ease-in-out lg:hidden ${activeMobilePanel === 'quotation' ? 'translate-y-0' : 'translate-y-full'}`}>
            <div className="flex shrink-0 justify-center py-2" aria-hidden="true">
              <div className="h-1.5 w-12 rounded-full bg-slate-600" />
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto">
              <QuotationPanel idPrefix="mobile-" width={Number(windowConfig.width) || 0} height={Number(windowConfig.height) || 0} quantity={quantity} setQuantity={setQuantity} areaType={areaType} setAreaType={setAreaType} rate={rate} setRate={setRate} onSave={onSave} onUpdate={onUpdate} onCancelEdit={onCancelEdit} editingItemId={editingItemId} onBatchAdd={onBatchAdd} windowTitle={windowTitle} setWindowTitle={setWindowTitle} hardwareCostPerWindow={hardwareCostPerWindow} quotationItemCount={quotationItemCount} onViewQuotation={onViewQuotation} onClose={handleCloseMobilePanels} bulkCorrectionLineCount={bulkCorrectionLineCount} onApplyBulkCorrection={onApplyBulkCorrection} />
            </div>
        </div>
    </>
  );
});

const App: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const [windowConfigState, dispatch] = useReducer(configReducer, getInitialConfig());
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
      return Array.isArray(parsed) ? parsed : [];
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
                          laminated: {
                              ...DEFAULT_QUOTATION_SETTINGS.materialRates.glassPerSqFt.laminated,
                              ...savedSettings.materialRates?.glassPerSqFt?.laminated,
                          },
                          dgu: {
                              ...DEFAULT_QUOTATION_SETTINGS.materialRates.glassPerSqFt.dgu,
                              ...savedSettings.materialRates?.glassPerSqFt?.dgu,
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
      dispatch({ type: 'LOAD_CONFIG', payload: restored.config });
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

    if (appView === 'guides') {
        if (guideSlug === 'index') {
          pageTitle = 'Features & Guides | WoodenMax Window Designer';
        } else {
          const guideTitle = guideSlug.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase());
          pageTitle = `${guideTitle} | Guides & Help | WoodenMax Window Designer`;
        }
        canonicalUrl = `${SITE_ORIGIN}/guides/${guideSlug}`;
    } else if (windowType) {
        const mapped = titleMap[windowType];
        if (mapped) {
            pageTitle = `${mapped} | WoodenMax`;
        } else {
            const typeLabel = windowType.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase());
            pageTitle = `${typeLabel} Design Tool | WoodenMax Window Designer`;
        }
        canonicalUrl = `${SITE_ORIGIN}/design/${windowType}`;
    }

    document.title = pageTitle;

    const description = getMetaDescription({
      appView: appView === 'guides' ? 'guides' : 'designer',
      windowType,
      guideSlug,
    });
    applyRouteSeo({ title: pageTitle, description, canonicalUrl });

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
        dispatch({ type: 'RESET_DESIGN' });
    }
  }, [windowConfigState.windowType]);

  const hardwareCostPerWindow = useMemo(
    () => computeHardwareCostForQuotation(windowConfig, series.hardwareItems),
    [series.hardwareItems, windowConfig]
  );

  const handleSaveToQuotation = useCallback(() => {
    const colorName = savedColors.find(c => c.value === windowConfig.profileColor)?.name;
    const configForQuotation = JSON.parse(JSON.stringify(windowConfig));

    const newItem: QuotationItem = {
        id: uuidv4(),
        title: windowTitle || 'Untitled Window',
        config: configForQuotation,
        quantity: Number(quantity) || 1,
        areaType,
        rate: Number(rate) || 0,
        hardwareCost: hardwareCostPerWindow,
        hardwareItems: JSON.parse(JSON.stringify(series.hardwareItems)),
        profileColorName: colorName || (windowConfig.profileColor.startsWith('data:') ? 'Custom Texture' : windowConfig.profileColor),
    };
    setQuotationItems(prev => applySlidingBasicRateProtection([...prev, newItem]));
    alert(`"${newItem.title}" saved to quotation! You now have ${quotationItems.length + 1} item(s).`);
  }, [windowTitle, windowConfig, quantity, areaType, rate, hardwareCostPerWindow, series.hardwareItems, savedColors, quotationItems.length, applySlidingBasicRateProtection]);

  const handleBatchSave = useCallback((items: BatchAddItem[]) => {
    const colorName = savedColors.find(c => c.value === windowConfig.profileColor)?.name;
    const baseConfigForQuotation = JSON.parse(JSON.stringify(windowConfig));

    const newQuotationItems: QuotationItem[] = items
      .filter(item => Number(item.width) > 0 && Number(item.height) > 0)
      .map(item => {
        const itemConfig = JSON.parse(JSON.stringify(baseConfigForQuotation));
        itemConfig.width = Number(item.width);
        itemConfig.height = Number(item.height);
        
        return {
          id: uuidv4(),
          title: item.title || 'Untitled Window',
          config: itemConfig,
          quantity: Number(item.quantity) || 1,
          areaType,
          rate: Number(item.rate) || 0,
          hardwareCost: hardwareCostPerWindow,
          hardwareItems: JSON.parse(JSON.stringify(series.hardwareItems)),
          profileColorName: colorName || (windowConfig.profileColor.startsWith('data:') ? 'Custom Texture' : windowConfig.profileColor),
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
    const { outcome } = await installPrompt.userChoice;
    if (outcome === 'accepted') { console.log('User accepted the A2HS prompt'); } 
    else { console.log('User dismissed the A2HS prompt'); }
    setInstallPrompt(null);
  };
  
  const setConfig = useCallback((field: keyof WindowConfig, value: any) => {
    if (field === 'series') {
      setSeries(value);
    } else if (field === 'windowType') {
      navigate(`/design/${value}`);
    }
    else {
      if (field === 'profileColor' || field === 'profileTexture' || field === 'glassTexture') {
        setCanvasKey(uuidv4());
      }
      dispatch({ type: 'SET_FIELD', field: field as keyof ConfigState, payload: value });
    }
  }, [navigate]);

  const setSideConfig = useCallback((config: Partial<CornerSideConfig>) => {
    dispatch({ type: 'SET_SIDE_CONFIG', payload: { side: activeCornerSide, config } });
  }, [activeCornerSide]);
  
  const handleEditItem = useCallback((id: string) => {
    const itemToEdit = quotationItems.find(item => item.id === id);
    if (itemToEdit) {
        const { series, ...configState } = itemToEdit.config;
        dispatch({ type: 'LOAD_CONFIG', payload: configState });
        setSeries(series);
        setWindowTitle(itemToEdit.title);
        setQuantity(itemToEdit.quantity);
        setRate(itemToEdit.rate);
        setAreaType(itemToEdit.areaType);
        setEditingItemId(id);
        setQuotationBulkTargetIds([]);
        setIsQuotationModalOpen(false);
        setActiveMobilePanel('none');
        navigate(`/design/${itemToEdit.config.windowType}`);
    }
  }, [quotationItems, navigate]);

  const handleUpdateQuotationItem = useCallback(() => {
    if (!editingItemId) return;

    const colorName = savedColors.find(c => c.value === windowConfig.profileColor)?.name;
    const configForQuotation = JSON.parse(JSON.stringify(windowConfig));

    const updatedItem: QuotationItem = {
        id: editingItemId,
        title: windowTitle || 'Untitled Window',
        config: configForQuotation,
        quantity: Number(quantity) || 1,
        areaType,
        rate: Number(rate) || 0,
        hardwareCost: hardwareCostPerWindow,
        hardwareItems: JSON.parse(JSON.stringify(series.hardwareItems)),
        profileColorName: colorName || (windowConfig.profileColor.startsWith('data:') ? 'Custom Texture' : windowConfig.profileColor),
    };

    setQuotationItems(prev => applySlidingBasicRateProtection(prev.map(item => item.id === editingItemId ? updatedItem : item)));
    
    setEditingItemId(null);
    alert(`"${updatedItem.title}" updated successfully!`);
  }, [editingItemId, savedColors, windowConfig, windowTitle, quantity, areaType, rate, hardwareCostPerWindow, series.hardwareItems, applySlidingBasicRateProtection]);

  const handleCancelEdit = useCallback(() => {
    if (window.confirm("Are you sure you want to cancel editing? Any changes will be lost.")) {
        setEditingItemId(null);
        dispatch({ type: 'RESET_DESIGN' });
        setWindowTitle('Window 1');
        setQuantity(1);
        setRate(550);
        setAreaType(AreaType.SQFT);
    }
  }, []);

  const handleEditCorrectionFromSelection = useCallback(() => {
    if (quotationBulkTargetIds.length === 0) return;
    const idSet = new Set(quotationBulkTargetIds);
    const selectedInOrder = quotationItems.filter((i) => idSet.has(i.id));
    if (selectedInOrder.length === 0) {
      setQuotationBulkTargetIds([]);
      return;
    }
    const wt = selectedInOrder[0].config.windowType;
    if (!selectedInOrder.every((i) => i.config.windowType === wt)) {
      alert('Bulk correction: select rows of the same window type only.');
      return;
    }
    const first = selectedInOrder[0];
    const { series: ser, ...configState } = first.config;
    dispatch({ type: 'LOAD_CONFIG', payload: configState });
    setSeries(ser);
    setWindowTitle(first.title);
    setQuantity(first.quantity);
    setRate(first.rate);
    setAreaType(first.areaType);
    setEditingItemId(null);
    setCanvasKey(uuidv4());
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
      const merged = applyDesignerCorrectionToQuotationItem(item, {
        designerConfig: windowConfig,
        designerSeries: series,
        savedColors,
      });
      if (!merged) {
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
    onLaminatedConfigChange: handleLaminatedConfigChange,
    onDguConfigChange: handleDguConfigChange,
    onUpdateMirrorConfig: handleUpdateMirrorConfig,
    onResetDesign: handleResetDesign,
    activeCornerSide,
    setActiveCornerSide
  }), [windowConfig, setConfig, setSideConfig, handleSetGridSize, availableSeries, handleSeriesSelect, handleSeriesSave, handleSeriesDelete, addFixedPanel, removeFixedPanel, updateFixedPanelSize, handleHardwareChange, addHardwareItem, removeHardwareItem, toggleDoorPosition, handleVentilatorCellClick, savedColors, handleUpdateHandle, onSetPartitionPanelCount, onSetPartitionPreset, onSetPartitionWidthFractions, onCyclePartitionPanelType, onSetPartitionHasTopChannel, onCyclePartitionPanelFraming, onUpdatePartitionPanel, onAddLouverItem, onRemoveLouverItem, onUpdateLouverItem, handleLaminatedConfigChange, handleDguConfigChange, handleUpdateMirrorConfig, handleResetDesign, activeCornerSide]);

  const handleOpenConfigure = () => setActiveMobilePanel('configure');
  const handleOpenQuote = () => setActiveMobilePanel('quotation');
  const handleCloseMobilePanels = () => setActiveMobilePanel('none');
  
  const handleViewQuotation = useCallback(() => {
    setIsQuotationModalOpen(true);
    setActiveMobilePanel('none');
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
  
  const loadingFallback = <div className="fixed inset-0 bg-slate-900 bg-opacity-80 flex items-center justify-center z-[100] no-print"><div className="text-white">Loading...</div></div>;

  return (
    <>
      {isQuotationModalOpen && (
          <QuotationListModal isOpen={isQuotationModalOpen} onClose={() => setIsQuotationModalOpen(false)} items={quotationItems} setItems={(items) => setQuotationItems(applySlidingBasicRateProtection(items))} onRemove={handleRemoveQuotationItem} onEdit={handleEditItem} settings={quotationSettings} setSettings={setQuotationSettings} onTogglePreview={setIsPreviewing} selectedLineIds={quotationBulkTargetIds} onSelectedLineIdsChange={setQuotationBulkTargetIds} onEditCorrection={handleEditCorrectionFromSelection} />
      )}
      {isBatchAddModalOpen && (
          <Suspense fallback={loadingFallback}>
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
      
      <div className={`flex flex-col h-screen font-sans bg-slate-900 overflow-hidden ${isPreviewing ? 'hidden' : ''}`}>
        <Suspense fallback={loadingFallback}>
            {appView === 'designer' ? (
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