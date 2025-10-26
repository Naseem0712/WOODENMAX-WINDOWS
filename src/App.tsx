import React, { useState, useEffect, useMemo, useRef, useReducer, useCallback } from 'react';
import type { FixedPanel, ProfileSeries, WindowConfig, HardwareItem, QuotationItem, VentilatorCell, GlassSpecialType, SavedColor, VentilatorCellType, PartitionPanelType, QuotationSettings, HandleConfig, PartitionPanelConfig, CornerSideConfig, LaminatedGlassConfig, DguGlassConfig } from './types';
import { FixedPanelPosition, ShutterConfigType, TrackType, GlassType, AreaType, WindowType } from './types';
import { ControlsPanel } from './components/ControlsPanel';
import { WindowCanvas } from './components/WindowCanvas';
import { v4 as uuidv4 } from 'uuid';
import { ChevronLeftIcon } from './components/icons/ChevronLeftIcon';
import { QuotationPanel } from './components/QuotationPanel';
import { QuotationListModal } from './components/QuotationListModal';
import { Logo } from './components/icons/Logo';
import { Button } from './components/ui/Button';
import { DownloadIcon } from './components/icons/DownloadIcon';
import { AdjustmentsIcon } from './components/icons/AdjustmentsIcon';
import { ListBulletIcon } from './components/icons/ListBulletIcon';
import { DocumentTextIcon } from './components/icons/DocumentTextIcon';
import { BatchAddModal, type BatchAddItem } from './components/BatchAddModal';
import { ContentModal } from './components/ContentModal';

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
  | { type: 'CYCLE_PARTITION_PANEL_TYPE'; payload: number }
  | { type: 'SET_PARTITION_HAS_TOP_CHANNEL'; payload: boolean }
  | { type: 'CYCLE_PARTITION_PANEL_FRAMING'; payload: number }
  | { type: 'SET_SIDE_CONFIG'; payload: { side: 'left' | 'right'; config: Partial<CornerSideConfig> } }
  | { type: 'ADD_ELEVATION_PATTERN'; payload: { patternType: 'row' | 'col' } }
  | { type: 'REMOVE_ELEVATION_PATTERN'; payload: { patternType: 'row' | 'col'; index: number } }
  | { type: 'UPDATE_ELEVATION_PATTERN'; payload: { patternType: 'row' | 'col'; index: number; value: number | '' } }
  | { type: 'UPDATE_ELEVATION_GRID_PROP'; payload: { prop: 'verticalMullionSize' | 'horizontalTransomSize' | 'pressurePlateSize'; value: number | '' } }
  | { type: 'TOGGLE_ELEVATION_GLAZING_DOOR', payload: { row: number, col: number } }
  | { type: 'UPDATE_LAMINATED_CONFIG'; payload: Partial<LaminatedGlassConfig> }
  | { type: 'UPDATE_DGU_CONFIG'; payload: Partial<DguGlassConfig> }
  | { type: 'RESET_DESIGN' };


const BASE_DIMENSIONS = {
    outerFrame: 0, outerFrameVertical: 0, fixedFrame: 0, shutterHandle: 0, shutterInterlock: 0,
    shutterTop: 0, shutterBottom: 0, shutterMeeting: 0, casementShutter: 0,
    mullion: 0, louverBlade: 0, topTrack: 0, bottomTrack: 0, glassGridProfile: 0,
};

const ALL_PROFILES_16_FEET = {
    lengths: Object.keys(BASE_DIMENSIONS).reduce((acc, key) => ({ ...acc, [key]: 4876.8 }), {})
};

const DEFAULT_GLASS_OPTIONS = {
    thicknesses: [5, 6, 8, 10, 12],
    customThicknessAllowed: true,
    specialTypes: ['laminated', 'dgu'] as Exclude<GlassSpecialType, 'none'>[],
};

const DEFAULT_SLIDING_HARDWARE: HardwareItem[] = [
    { id: uuidv4(), name: 'Outer Profile Joint Connector', qtyPerShutter: 2, rate: 50, unit: 'per_window' },
    { id: uuidv4(), name: 'Shutter Joint Connector', qtyPerShutter: 4, rate: 30, unit: 'per_shutter_or_door' },
    { id: uuidv4(), name: 'PVC Angle', qtyPerShutter: 4, rate: 10, unit: 'per_shutter_or_door' },
    { id: uuidv4(), name: 'Handle', qtyPerShutter: 1, rate: 150, unit: 'per_shutter_or_door' },
    { id: uuidv4(), name: 'Bearing', qtyPerShutter: 2, rate: 80, unit: 'per_shutter_or_door' },
];

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
];

const DEFAULT_SLIDING_SERIES: ProfileSeries = {
    id: 'series-sliding-default',
    name: 'Standard Sliding Series',
    type: WindowType.SLIDING,
    dimensions: {
        ...BASE_DIMENSIONS,
        outerFrame: 60, fixedFrame: 25, shutterHandle: 45, shutterInterlock: 25,
        shutterTop: 55, shutterBottom: 55, shutterMeeting: 50, glassGridProfile: 15,
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

const DEFAULT_CASEMENT_SERIES: ProfileSeries = {
    id: 'series-casement-default',
    name: 'Standard Casement Series',
    type: WindowType.CASEMENT,
    dimensions: { ...BASE_DIMENSIONS, outerFrame: 60, fixedFrame: 25, casementShutter: 70, mullion: 80, glassGridProfile: 15 },
    hardwareItems: DEFAULT_CASEMENT_HARDWARE,
    glassOptions: DEFAULT_GLASS_OPTIONS,
};

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
    dimensions: { ...BASE_DIMENSIONS, outerFrame: 50, fixedFrame: 20, casementShutter: 45, mullion: 50, louverBlade: 25, glassGridProfile: 15 },
    hardwareItems: DEFAULT_VENTILATOR_HARDWARE,
    glassOptions: DEFAULT_GLASS_OPTIONS,
};

const DEFAULT_PARTITION_HARDWARE: HardwareItem[] = [
  { id: uuidv4(), name: 'Sliding Shower Set', qtyPerShutter: 1, rate: 2500, unit: 'per_shutter_or_door' },
  { id: uuidv4(), name: 'Hinges (for openable)', qtyPerShutter: 3, rate: 350, unit: 'per_shutter_or_door' },
  { id: uuidv4(), name: 'Door Seal', qtyPerShutter: 1, rate: 500, unit: 'per_shutter_or_door' },
  { id: uuidv4(), name: 'Handle Knob/Pull', qtyPerShutter: 1, rate: 400, unit: 'per_shutter_or_door' },
];

const DEFAULT_GLASS_PARTITION_SERIES: ProfileSeries = {
  id: 'series-partition-default',
  name: 'Standard Glass Partition',
  type: WindowType.GLASS_PARTITION,
  dimensions: { ...BASE_DIMENSIONS, topTrack: 50, bottomTrack: 20, fixedFrame: 25, casementShutter: 35, glassGridProfile: 15 },
  hardwareItems: DEFAULT_PARTITION_HARDWARE,
  glassOptions: {
    thicknesses: [8, 10, 12],
    customThicknessAllowed: true,
    specialTypes: ['laminated'],
  },
};

const DEFAULT_ELEVATION_GLAZING_SERIES: ProfileSeries = {
  id: 'series-glazing-default',
  name: 'Standard Structural Glazing',
  type: WindowType.ELEVATION_GLAZING,
  dimensions: { ...BASE_DIMENSIONS, outerFrame: 75, mullion: 50, casementShutter: 65 },
  hardwareItems: DEFAULT_CASEMENT_HARDWARE,
  glassOptions: {
    thicknesses: [8, 10, 12, 15],
    customThicknessAllowed: true,
    specialTypes: ['dgu', 'laminated'],
  },
};

const DEFAULT_CORNER_SERIES: ProfileSeries = {
    id: 'series-corner-default',
    name: 'Standard Corner Series',
    type: WindowType.CORNER,
    dimensions: { ...BASE_DIMENSIONS, outerFrame: 60, fixedFrame: 25, casementShutter: 70, mullion: 80, glassGridProfile: 15 },
    hardwareItems: [], // Hardware derived from sub-type
    glassOptions: DEFAULT_GLASS_OPTIONS,
};

const DEFAULT_QUOTATION_SETTINGS: QuotationSettings = {
    company: { logo: '', name: 'WoodenMax', address: '123 Wood Lane, Timber Town', email: 'info@woodenmax.com', website: 'www.woodenmax.com' },
    customer: { name: '', address: '', contactPerson: '' },
    financials: { gstPercentage: 18, discount: 0, discountType: 'percentage' },
    bankDetails: { name: '', accountNumber: '', ifsc: '', branch: '', accountType: 'current' },
    title: 'Quotation for Aluminium Works',
    terms: '1. 50% advance payment required.\n2. Prices are exclusive of taxes.\n3. Delivery within 4-6 weeks.',
    description: 'Supply and installation of premium aluminium windows and partitions as per the agreed specifications.'
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

const initialConfig: ConfigState = {
    width: 15000,
    height: 15000,
    fixedPanels: [],
    glassType: GlassType.CLEAR,
    glassThickness: 8,
    customGlassName: '',
    glassSpecialType: 'none',
    profileColor: '#374151',
    glassGrid: { rows: 0, cols: 0 },
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
    verticalDividers: [0.5],
    horizontalDividers: [],
    doorPositions: [{ row: 0, col: 0 }, { row: 0, col: 1 }],
    ventilatorGrid: [],
    partitionPanels: { count: 2, types: [{ type: 'fixed' }, { type: 'sliding' }], hasTopChannel: true },
    elevationGrid: {
        rowPattern: [609.6, 1524, 609.6, 609.6], // 2ft, 5ft, 2ft, 2ft
        colPattern: [1000, 1200, 1500], // 1m, 1.2m, 1.5m
        verticalMullionSize: 50,
        horizontalTransomSize: 50,
        pressurePlateSize: 60,
        doorPositions: [],
    },
    leftWidth: 1200,
    rightWidth: 1200,
    cornerPostWidth: 100,
    leftConfig: defaultCornerSideConfig,
    rightConfig: { ...defaultCornerSideConfig, verticalDividers: [0.5], doorPositions: [{ row: 0, col: 0 }, { row: 0, col: 1 }] },
};

const SERIES_MAP: Record<WindowType, ProfileSeries> = {
    [WindowType.SLIDING]: DEFAULT_SLIDING_SERIES,
    [WindowType.CASEMENT]: DEFAULT_CASEMENT_SERIES,
    [WindowType.VENTILATOR]: DEFAULT_VENTILATOR_SERIES,
    [WindowType.GLASS_PARTITION]: DEFAULT_GLASS_PARTITION_SERIES,
    [WindowType.ELEVATION_GLAZING]: DEFAULT_ELEVATION_GLAZING_SERIES,
    [WindowType.CORNER]: DEFAULT_CORNER_SERIES,
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

            if (type === 'elevation') {
                 if (!state.elevationGrid) return state;
                 const row = parseInt(parts[1], 10);
                 const col = parseInt(parts[2], 10);
                 const newDoorPositions = state.elevationGrid.doorPositions.map(p => {
                     if (p.row === row && p.col === col) {
                         if (newConfig) return { ...p, handle: newConfig };
                         const { handle, ...rest } = p;
                         return rest;
                     }
                     return p;
                 });
                 return { ...state, elevationGrid: { ...state.elevationGrid, doorPositions: newDoorPositions } };
            }

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
          const newState: ConfigState = { ...state, windowType: newType };
          if (newType === WindowType.GLASS_PARTITION || newType === WindowType.ELEVATION_GLAZING) {
            newState.fixedPanels = [];
          }
           if (newType === WindowType.CORNER) {
              newState.leftConfig = state.leftConfig || defaultCornerSideConfig;
              newState.rightConfig = state.rightConfig || defaultCornerSideConfig;
              newState.leftWidth = state.leftWidth || 1200;
              newState.rightWidth = state.rightWidth || 1200;
          }
          return newState;
        }
        case 'SET_PARTITION_PANEL_COUNT': {
          const count = action.payload;
          return {
            ...state,
            partitionPanels: {
              ...state.partitionPanels,
              count,
              types: Array.from({ length: count }, (_, i) => state.partitionPanels.types[i] || { type: 'fixed' as PartitionPanelType }),
            }
          };
        }
        case 'CYCLE_PARTITION_PANEL_TYPE': {
            const index = action.payload;
            const sequence: PartitionPanelType[] = ['fixed', 'sliding', 'hinged'];
            const currentConfig = state.partitionPanels.types[index];
            const currentType = currentConfig.type;
            const currentIndex = sequence.indexOf(currentType);
            const nextType = sequence[(currentIndex + 1) % sequence.length];
            const newTypes = [...state.partitionPanels.types];
            newTypes[index] = { ...currentConfig, type: nextType };
            if (nextType === 'fixed' && newTypes[index].handle) {
                delete newTypes[index].handle;
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
        case 'ADD_ELEVATION_PATTERN': {
            const { patternType } = action.payload;
            if (!state.elevationGrid) return state;
            const key = patternType === 'row' ? 'rowPattern' : 'colPattern';
            const newPattern = [...state.elevationGrid[key], 1000];
            return { ...state, elevationGrid: { ...state.elevationGrid, [key]: newPattern } };
        }
        case 'REMOVE_ELEVATION_PATTERN': {
            const { patternType, index } = action.payload;
            if (!state.elevationGrid) return state;
            const key = patternType === 'row' ? 'rowPattern' : 'colPattern';
            const newPattern = state.elevationGrid[key].filter((_, i) => i !== index);
            return { ...state, elevationGrid: { ...state.elevationGrid, [key]: newPattern } };
        }
        case 'UPDATE_ELEVATION_PATTERN': {
            const { patternType, index, value } = action.payload;
            if (!state.elevationGrid) return state;
            const key = patternType === 'row' ? 'rowPattern' : 'colPattern';
            const newPattern = [...state.elevationGrid[key]];
            newPattern[index] = value;
            return { ...state, elevationGrid: { ...state.elevationGrid, [key]: newPattern } };
        }
        case 'UPDATE_ELEVATION_GRID_PROP': {
            const { prop, value } = action.payload;
            if (!state.elevationGrid) return state;
            return { ...state, elevationGrid: { ...state.elevationGrid, [prop]: value } };
        }
        case 'TOGGLE_ELEVATION_GLAZING_DOOR': {
             if (!state.elevationGrid) return state;
            const { row, col } = action.payload;
            const exists = state.elevationGrid.doorPositions.some(p => p.row === row && p.col === col);
            const newDoorPositions = exists
                ? state.elevationGrid.doorPositions.filter(p => p.row !== row || p.col !== col)
                : [...state.elevationGrid.doorPositions, { row, col }];
            return { ...state, elevationGrid: { ...state.elevationGrid, doorPositions: newDoorPositions } };
        }
        case 'UPDATE_LAMINATED_CONFIG':
            return { ...state, laminatedGlassConfig: { ...state.laminatedGlassConfig, ...action.payload } };
        case 'UPDATE_DGU_CONFIG':
            return { ...state, dguGlassConfig: { ...state.dguGlassConfig, ...action.payload } };
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
      if (parsed.partitionPanels && typeof parsed.partitionPanels.hasTopChannel === 'undefined') {
          parsed.partitionPanels.hasTopChannel = true;
      }
      if (parsed.partitionPanels && parsed.partitionPanels.types) {
          parsed.partitionPanels.types.forEach((t: any) => {
              if (typeof t.framing === 'undefined') t.framing = 'none';
          });
      }
      if (!parsed.laminatedGlassConfig) {
        parsed.laminatedGlassConfig = initialConfig.laminatedGlassConfig;
      }
      if (!parsed.dguGlassConfig) {
        parsed.dguGlassConfig = initialConfig.dguGlassConfig;
      }
      return { ...initialConfig, ...parsed };
    }
  } catch (error) {
    console.error("Could not load current config from localStorage", error);
  }
  return initialConfig;
};

type MobilePanelState = 'none' | 'configure' | 'quotation';

const App: React.FC = () => {
  
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
        if(parsed.id && parsed.name && parsed.dimensions) { return parsed; }
      }
    } catch (error) { console.error("Could not load last used series", error); }
    return DEFAULT_SLIDING_SERIES;
  });

  const [savedSeries, setSavedSeries] = useState<ProfileSeries[]>(() => {
    try {
      const item = window.localStorage.getItem('aluminium-window-profiles');
      const userSaved = item ? JSON.parse(item).filter((s: ProfileSeries) => !s.id.includes('-default')) : [];
      return [...PREDEFINED_SLIDING_SERIES, ...userSaved];
    } catch (error) { console.error("Could not load profiles", error); return [...PREDEFINED_SLIDING_SERIES]; }
  });

  const [savedColors, setSavedColors] = useState<SavedColor[]>(() => {
      try {
        const item = window.localStorage.getItem('aluminium-window-colors');
        return item ? JSON.parse(item) : [
            { id: uuidv4(), name: 'Matt Black', hex: '#374151' },
            { id: uuidv4(), name: 'Dark Grey', hex: '#4B5563' },
            { id: uuidv4(), name: 'White', hex: '#F9FAFB' },
            { id: uuidv4(), name: 'Champion Gold', hex: '#D6A158' },
        ];
      } catch (error) { return []; }
  });
  
  const [windowTitle, setWindowTitle] = useState<string>(() => window.localStorage.getItem('woodenmax-quotation-panel-title') || 'Window 1');
  const [quantity, setQuantity] = useState<number | ''>(() => { try { const s = window.localStorage.getItem('woodenmax-quotation-panel-quantity'); return s ? JSON.parse(s) : 1; } catch { return 1; } });
  const [areaType, setAreaType] = useState<AreaType>(() => (window.localStorage.getItem('woodenmax-quotation-panel-areaType') as AreaType) || AreaType.SQFT);
  const [rate, setRate] = useState<number | ''>(() => { try { const s = window.localStorage.getItem('woodenmax-quotation-panel-rate'); return s ? JSON.parse(s) : 550; } catch { return 550; } });
  const [quotationItems, setQuotationItems] = useState<QuotationItem[]>(() => { try { const s = window.localStorage.getItem('woodenmax-quotation-items'); return s ? JSON.parse(s) : []; } catch { return []; } });
  const [isQuotationModalOpen, setIsQuotationModalOpen] = useState(false);
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [isBatchAddModalOpen, setIsBatchAddModalOpen] = useState(false);
  const [isContentModalOpen, setIsContentModalOpen] = useState(false);

  const [quotationSettings, setQuotationSettings] = useState<QuotationSettings>(() => {
      try {
        const item = window.localStorage.getItem('woodenmax-quotation-settings');
        return item ? JSON.parse(item) : DEFAULT_QUOTATION_SETTINGS;
      } catch (error) { return DEFAULT_QUOTATION_SETTINGS; }
  });
  
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  
  const windowConfig: WindowConfig = useMemo(() => ({
    ...windowConfigState,
    series
  }), [windowConfigState, series]);

  // --- PERSISTENCE EFFECTS ---
  useEffect(() => { window.localStorage.setItem('woodenmax-current-config', JSON.stringify(windowConfigState)); }, [windowConfigState]);
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
  useEffect(() => { window.localStorage.setItem('aluminium-window-colors', JSON.stringify(savedColors)); }, [savedColors]);
  useEffect(() => { window.localStorage.setItem('woodenmax-quotation-settings', JSON.stringify(quotationSettings)); }, [quotationSettings]);
  
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
        DEFAULT_GLASS_PARTITION_SERIES, DEFAULT_ELEVATION_GLAZING_SERIES, DEFAULT_CORNER_SERIES, ...savedSeries
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
        if (sideConfig.trackType === TrackType.THREE_TRACK && ![ShutterConfigType.THREE_GLASS, ShutterConfigType.TWO_GLASS_ONE_MESH].includes(sideConfig.shutterConfig)) {
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
        if (windowConfigState.trackType === TrackType.THREE_TRACK && ![ShutterConfigType.THREE_GLASS, ShutterConfigType.TWO_GLASS_ONE_MESH].includes(windowConfigState.shutterConfig)) {
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
        }

        if (sideConfig.fixedShutters.length !== numSideShutters || sideConfig.slidingHandles.length !== numSideShutters) {
             const newFixedShutters = Array(numSideShutters).fill(false);
             for(let i=0; i < Math.min(sideConfig.fixedShutters.length, newFixedShutters.length); i++) { newFixedShutters[i] = sideConfig.fixedShutters[i]; }
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
            for(let i=0; i < Math.min(windowConfigState.fixedShutters.length, newFixedShutters.length); i++) { newFixedShutters[i] = windowConfigState.fixedShutters[i]; }
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
            dispatch({ type: 'SET_WINDOW_TYPE', payload: selected.type });
        }
      }
    }
  }, [availableSeries, windowType, windowConfig, activeCornerSide]);
  
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
  const onCyclePartitionPanelType = useCallback((index: number) => dispatch({ type: 'CYCLE_PARTITION_PANEL_TYPE', payload: index }), []);
  const onSetPartitionHasTopChannel = useCallback((hasChannel: boolean) => dispatch({ type: 'SET_PARTITION_HAS_TOP_CHANNEL', payload: hasChannel }), []);
  const onCyclePartitionPanelFraming = useCallback((index: number) => dispatch({ type: 'CYCLE_PARTITION_PANEL_FRAMING', payload: index }), []);
  
  const handleElevationGridChange = useCallback((action: 'add' | 'remove' | 'update' | 'update_prop', payload: any) => {
    switch (action) {
        case 'add': dispatch({ type: 'ADD_ELEVATION_PATTERN', payload }); break;
        case 'remove': dispatch({ type: 'REMOVE_ELEVATION_PATTERN', payload }); break;
        case 'update': dispatch({ type: 'UPDATE_ELEVATION_PATTERN', payload }); break;
        case 'update_prop': dispatch({ type: 'UPDATE_ELEVATION_GRID_PROP', payload }); break;
    }
  }, []);

  const handleToggleElevationDoor = useCallback((row: number, col: number) => {
    dispatch({ type: 'TOGGLE_ELEVATION_GLAZING_DOOR', payload: { row, col } });
  }, []);

  const handleLaminatedConfigChange = useCallback((payload: Partial<LaminatedGlassConfig>) => {
    dispatch({ type: 'UPDATE_LAMINATED_CONFIG', payload });
  }, []);
  const handleDguConfigChange = useCallback((payload: Partial<DguGlassConfig>) => {
    dispatch({ type: 'UPDATE_DGU_CONFIG', payload });
  }, []);

  const handleResetDesign = useCallback(() => {
    if (window.confirm("Are you sure you want to reset the current design? All changes will be lost.")) {
        dispatch({ type: 'RESET_DESIGN' });
    }
  }, []);

  const hardwareCostPerWindow = useMemo(() => {
    const calculateSideCost = (config: WindowConfig | CornerSideConfig | undefined) => {
        if (!config) return 0;
        
        return series.hardwareItems.reduce((total, item) => {
            const qty = Number(item.qtyPerShutter) || 0;
            const itemRate = Number(item.rate) || 0;
            let panelCount = 0;

            if (item.unit === 'per_window') {
                panelCount = 1;
            } else if (item.unit === 'per_shutter_or_door') {
                if (config.windowType === WindowType.VENTILATOR) {
                    const doorCells = config.ventilatorGrid.flat().filter(c => c.type === 'door').length;
                    const louverCells = config.ventilatorGrid.flat().filter(c => c.type === 'louvers').length;
                    const name = item.name.toLowerCase();
                    if (name.includes('louver')) {
                        panelCount = louverCells;
                    } else { // Hinge, lock, handle, etc., are for doors
                        panelCount = doorCells;
                    }
                } else if (config.windowType === WindowType.ELEVATION_GLAZING) {
                    panelCount = (config as WindowConfig).elevationGrid.doorPositions.length;
                } else {
                     switch(config.windowType) {
                        case WindowType.SLIDING: panelCount = config.shutterConfig === '2G' ? 2 : config.shutterConfig === '4G' ? 4 : 3; break;
                        case WindowType.CASEMENT: panelCount = config.doorPositions.length; break;
                        case WindowType.GLASS_PARTITION: panelCount = (config as WindowConfig).partitionPanels.types.filter(t => t.type !== 'fixed').length; break;
                    }
                }
            }
            return total + (qty * itemRate * panelCount);
        }, 0);
    };

    if (windowType === WindowType.CORNER) {
        return calculateSideCost(windowConfig.leftConfig) + calculateSideCost(windowConfig.rightConfig);
    }
    return calculateSideCost(windowConfig);
  }, [series.hardwareItems, windowConfig, windowType]);

  const handleSaveToQuotation = useCallback(() => {
    const colorName = savedColors.find(c => c.hex === windowConfig.profileColor)?.name;
    const newItem: QuotationItem = {
        id: uuidv4(),
        title: windowTitle || 'Untitled Window',
        config: JSON.parse(JSON.stringify(windowConfig)),
        quantity: Number(quantity) || 1,
        areaType,
        rate: Number(rate) || 0,
        hardwareCost: hardwareCostPerWindow,
        hardwareItems: JSON.parse(JSON.stringify(series.hardwareItems)),
        profileColorName: colorName,
    };
    setQuotationItems(prev => [...prev, newItem]);
    alert(`"${newItem.title}" saved to quotation! You now have ${quotationItems.length + 1} item(s).`);
  }, [windowTitle, windowConfig, quantity, areaType, rate, hardwareCostPerWindow, series.hardwareItems, savedColors, quotationItems.length]);

  const handleBatchSave = useCallback((items: BatchAddItem[]) => {
    const colorName = savedColors.find(c => c.hex === windowConfig.profileColor)?.name;
    const newQuotationItems: QuotationItem[] = items
      .filter(item => Number(item.width) > 0 && Number(item.height) > 0)
      .map(item => {
        const itemConfig = JSON.parse(JSON.stringify(windowConfig));
        itemConfig.width = Number(item.width);
        itemConfig.height = Number(item.height);
        
        // Note: hardwareCost is based on the original design.
        // A more complex implementation could recalculate it per size.
        return {
          id: uuidv4(),
          title: item.title || 'Untitled Window',
          config: itemConfig,
          quantity: Number(item.quantity) || 1,
          areaType,
          rate: Number(item.rate) || 0,
          hardwareCost: hardwareCostPerWindow,
          hardwareItems: JSON.parse(JSON.stringify(series.hardwareItems)),
          profileColorName: colorName,
        };
    });

    setQuotationItems(prev => [...prev, ...newQuotationItems]);
    setIsBatchAddModalOpen(false);
    alert(`${newQuotationItems.length} item(s) saved to quotation! You now have ${quotationItems.length + newQuotationItems.length} item(s).`);
  }, [windowConfig, areaType, hardwareCostPerWindow, series.hardwareItems, savedColors, quotationItems.length]);


  const handleRemoveQuotationItem = useCallback((id: string) => { setQuotationItems(prev => prev.filter(item => item.id !== id)); }, []);
  
  const handleInstallClick = async () => {
    if (!installPrompt) return;
    await installPrompt.prompt();
    const { outcome } = await installPrompt.userChoice;
    if (outcome === 'accepted') { console.log('User accepted the A2HS prompt'); } 
    else { console.log('User dismissed the A2HS prompt'); }
    setInstallPrompt(null);
  };
  
  const setConfig = useCallback((field: keyof WindowConfig, value: any) => {
    if (field === 'series') { setSeries(value); } 
    else { dispatch({ type: 'SET_FIELD', field: field as keyof ConfigState, payload: value }); }
  }, []);

  const setSideConfig = useCallback((config: Partial<CornerSideConfig>) => {
    dispatch({ type: 'SET_SIDE_CONFIG', payload: { side: activeCornerSide, config } });
  }, [activeCornerSide]);
  
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
    onCyclePartitionPanelType,
    onSetPartitionHasTopChannel,
    onCyclePartitionPanelFraming,
    onElevationGridChange: handleElevationGridChange,
    onLaminatedConfigChange: handleLaminatedConfigChange,
    onDguConfigChange: handleDguConfigChange,
    onResetDesign: handleResetDesign,
    activeCornerSide,
    setActiveCornerSide
  }), [windowConfig, setConfig, setSideConfig, handleSetGridSize, availableSeries, handleSeriesSelect, handleSeriesSave, handleSeriesDelete, addFixedPanel, removeFixedPanel, updateFixedPanelSize, handleHardwareChange, addHardwareItem, removeHardwareItem, toggleDoorPosition, handleVentilatorCellClick, savedColors, handleUpdateHandle, onSetPartitionPanelCount, onCyclePartitionPanelType, onSetPartitionHasTopChannel, onCyclePartitionPanelFraming, handleElevationGridChange, handleLaminatedConfigChange, handleDguConfigChange, handleResetDesign, activeCornerSide]);

  const handleOpenConfigure = () => setActiveMobilePanel('configure');
  const handleOpenQuote = () => setActiveMobilePanel('quotation');
  const handleCloseMobilePanels = () => setActiveMobilePanel('none');
  
  const handleViewQuotation = () => {
    setIsQuotationModalOpen(true);
    handleCloseMobilePanels();
  };

  const handleBatchAdd = () => {
    setIsBatchAddModalOpen(true);
    handleCloseMobilePanels();
  };

  return (
    <>
      <QuotationListModal isOpen={isQuotationModalOpen} onClose={() => setIsQuotationModalOpen(false)} items={quotationItems} setItems={setQuotationItems} onRemove={handleRemoveQuotationItem} settings={quotationSettings} setSettings={setQuotationSettings} onTogglePreview={setIsPreviewing} />
      <BatchAddModal isOpen={isBatchAddModalOpen} onClose={() => setIsBatchAddModalOpen(false)} baseConfig={windowConfig} baseRate={rate} onSave={handleBatchSave} />
      <ContentModal isOpen={isContentModalOpen} onClose={() => setIsContentModalOpen(false)} />
      
      <div className={`flex flex-col h-screen font-sans bg-slate-900 overflow-hidden ${isPreviewing ? 'hidden' : ''}`}>
        <header className="bg-slate-800 p-3 flex items-center shadow-md z-40 no-print">
            <Logo className="h-10 w-10 mr-4 flex-shrink-0" />
            <div className="flex-grow">
                <h1 className="text-2xl font-bold text-white tracking-wider">WoodenMax Architectural Elements</h1>
                <p className="text-sm text-indigo-300">Powered by Real Vibe Studio</p>
            </div>
            <div className='flex items-center gap-2'>
              <Button onClick={() => setIsContentModalOpen(true)} variant="secondary" className="hidden sm:inline-flex"> <DocumentTextIcon className="w-5 h-5 mr-2" /> Features & Guides </Button>
              {installPrompt && ( <Button onClick={handleInstallClick} variant="secondary" className="animate-pulse"> <DownloadIcon className="w-5 h-5 mr-2" /> Add to Home Screen </Button> )}
            </div>
        </header>
        <div className="flex flex-row flex-grow min-h-0">
            <div ref={panelRef} className={`hidden lg:block flex-shrink-0 h-full transition-all duration-300 ease-in-out z-30 bg-slate-800 no-print ${isDesktopPanelOpen ? 'w-96' : 'w-0'}`}>
                <div className={`h-full overflow-hidden ${isDesktopPanelOpen ? 'w-96' : 'w-0'}`}>
                    <ControlsPanel {...commonControlProps} onClose={() => setIsDesktopPanelOpen(false)} />
                </div>
            </div>
            <div className="relative flex-1 flex flex-col min-w-0">
                {!isDesktopPanelOpen && ( <button onClick={() => setIsDesktopPanelOpen(true)} className="absolute top-1/2 -translate-y-1/2 left-0 bg-slate-700 hover:bg-indigo-600 text-white w-6 h-24 rounded-r-lg z-20 focus:outline-none focus:ring-2 focus:ring-indigo-500 items-center justify-center transition-all duration-300 no-print hidden lg:flex" aria-label="Expand panel"> <ChevronLeftIcon className="w-5 h-5 rotate-180" /> </button> )}
              <div className="flex-grow relative">
                 <WindowCanvas config={windowConfig} onRemoveVerticalDivider={handleRemoveVerticalDivider} onRemoveHorizontalDivider={handleRemoveHorizontalDivider} onToggleElevationDoor={handleToggleElevationDoor} />
              </div>
              <div className="flex-shrink-0 no-print hidden lg:block">
                  <QuotationPanel width={Number(windowConfig.width) || 0} height={Number(windowConfig.height) || 0} quantity={quantity} setQuantity={setQuantity} areaType={areaType} setAreaType={setAreaType} rate={rate} setRate={setRate} onSave={handleSaveToQuotation} onBatchAdd={handleBatchAdd} windowTitle={windowTitle} setWindowTitle={setWindowTitle} hardwareCostPerWindow={hardwareCostPerWindow} quotationItemCount={quotationItems.length} onViewQuotation={handleViewQuotation} />
              </div>
              <div className="lg:hidden p-2 bg-slate-800 border-t-2 border-slate-700 grid grid-cols-2 gap-2 no-print">
                  <Button onClick={handleOpenConfigure} variant="secondary" className="h-12"> <AdjustmentsIcon className="w-5 h-5 mr-2" /> Configure </Button>
                  <Button onClick={handleOpenQuote} variant="secondary" className="h-12"> <ListBulletIcon className="w-5 h-5 mr-2" /> Quotation </Button>
              </div>
            </div>
        </div>
        {/* Mobile Configure Panel */}
        <div className={`lg:hidden fixed inset-0 bg-black bg-opacity-50 z-40 transition-opacity duration-300 ${activeMobilePanel === 'configure' ? 'opacity-100' : 'opacity-0 pointer-events-none'}`} onClick={handleCloseMobilePanels}></div>
        <div className={`lg:hidden fixed bottom-0 left-0 right-0 max-h-[85vh] flex flex-col transform transition-transform duration-300 ease-in-out z-50 bg-slate-800 rounded-t-lg no-print ${activeMobilePanel === 'configure' ? 'translate-y-0' : 'translate-y-full'}`}>
           <ControlsPanel {...commonControlProps} onClose={handleCloseMobilePanels} />
        </div>
        
        {/* Mobile Quotation Panel */}
        <div className={`lg:hidden fixed inset-0 bg-black bg-opacity-50 z-40 transition-opacity duration-300 ${activeMobilePanel === 'quotation' ? 'opacity-100' : 'opacity-0 pointer-events-none'}`} onClick={handleCloseMobilePanels}></div>
        <div className={`lg:hidden fixed bottom-0 left-0 right-0 flex flex-col transform transition-transform duration-300 ease-in-out z-50 bg-slate-800 rounded-t-lg no-print ${activeMobilePanel === 'quotation' ? 'translate-y-0' : 'translate-y-full'}`}>
            <QuotationPanel width={Number(windowConfig.width) || 0} height={Number(windowConfig.height) || 0} quantity={quantity} setQuantity={setQuantity} areaType={areaType} setAreaType={setAreaType} rate={rate} setRate={setRate} onSave={handleSaveToQuotation} onBatchAdd={handleBatchAdd} windowTitle={windowTitle} setWindowTitle={setWindowTitle} hardwareCostPerWindow={hardwareCostPerWindow} quotationItemCount={quotationItems.length} onViewQuotation={handleViewQuotation} onClose={handleCloseMobilePanels} />
        </div>
      </div>
    </>
  );
};

export default App;