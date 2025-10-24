import React, { useState, useEffect, useMemo, useRef, useReducer, useCallback } from 'react';
import type { FixedPanel, ProfileSeries, WindowConfig, HardwareItem, QuotationItem, VentilatorCell, GlassSpecialType, SavedColor, VentilatorCellType, PartitionPanelType, QuotationSettings, HandleConfig, PartitionPanelConfig } from './types';
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
  | { type: 'TOGGLE_DOOR_POSITION'; payload: { row: number; col: number } }
  | { type: 'HANDLE_VENTILATOR_CELL_CLICK'; payload: { row: number; col: number } }
  | { type: 'SET_GRID_SIZE'; payload: { rows: number; cols: number } }
  | { type: 'REMOVE_VERTICAL_DIVIDER'; payload: number }
  | { type: 'REMOVE_HORIZONTAL_DIVIDER'; payload: number }
  | { type: 'UPDATE_HANDLE'; payload: { panelId: string; newConfig: HandleConfig | null } }
  | { type: 'SET_WINDOW_TYPE'; payload: WindowType }
  | { type: 'SET_PARTITION_PANEL_COUNT'; payload: number }
  | { type: 'CYCLE_PARTITION_PANEL_TYPE'; payload: number }
  | { type: 'SET_PARTITION_HAS_TOP_CHANNEL'; payload: boolean }
  | { type: 'CYCLE_PARTITION_PANEL_FRAMING'; payload: number }
  | { type: 'RESET_DESIGN' };


const BASE_DIMENSIONS = {
    outerFrame: 0, fixedFrame: 0, shutterHandle: 0, shutterInterlock: 0,
    shutterTop: 0, shutterBottom: 0, shutterMeeting: 0, casementShutter: 0,
    mullion: 0, louverBlade: 0, topTrack: 0, bottomTrack: 0, glassGridProfile: 0,
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

const initialConfig: ConfigState = {
    width: 1800,
    height: 2100,
    fixedPanels: [],
    glassType: GlassType.CLEAR,
    glassThickness: 8,
    customGlassName: '',
    glassSpecialType: 'none',
    profileColor: '#374151',
    glassGrid: { rows: 0, cols: 0 },
    windowType: WindowType.SLIDING,
    trackType: TrackType.TWO_TRACK,
    shutterConfig: ShutterConfigType.TWO_GLASS,
    fixedShutters: [],
    slidingHandles: [],
    verticalDividers: [0.5],
    horizontalDividers: [],
    doorPositions: [{ row: 0, col: 0 }, { row: 0, col: 1 }],
    ventilatorGrid: [],
    partitionPanels: { count: 2, types: [{ type: 'fixed' }, { type: 'sliding' }], hasTopChannel: true },
    cornerSubType: WindowType.SLIDING,
    leftWidth: 1200,
    rightWidth: 1200,
};

const SERIES_MAP: Record<WindowType, ProfileSeries> = {
    [WindowType.SLIDING]: DEFAULT_SLIDING_SERIES,
    [WindowType.CASEMENT]: DEFAULT_CASEMENT_SERIES,
    [WindowType.VENTILATOR]: DEFAULT_VENTILATOR_SERIES,
    [WindowType.GLASS_PARTITION]: DEFAULT_GLASS_PARTITION_SERIES,
    [WindowType.CORNER]: DEFAULT_CORNER_SERIES,
};

function configReducer(state: ConfigState, action: ConfigAction): ConfigState {
    switch (action.type) {
        case 'SET_FIELD':
            return { ...state, [action.field]: action.payload };
        case 'ADD_FIXED_PANEL':
            if (state.fixedPanels.some(p => p.position === action.payload)) return state;
            return { ...state, fixedPanels: [...state.fixedPanels, { id: uuidv4(), position: action.payload, size: 300 }] };
        case 'REMOVE_FIXED_PANEL':
            return { ...state, fixedPanels: state.fixedPanels.filter(p => p.id !== action.payload) };
        case 'UPDATE_FIXED_PANEL_SIZE':
            return { ...state, fixedPanels: state.fixedPanels.map(p => p.id === action.payload.id ? { ...p, size: action.payload.size } : p) };
        case 'TOGGLE_DOOR_POSITION': {
            const { row, col } = action.payload;
            const exists = state.doorPositions.some(p => p.row === row && p.col === col);
            if (exists) {
                return { ...state, doorPositions: state.doorPositions.filter(p => p.row !== row || p.col !== col) };
            } else {
                return { ...state, doorPositions: [...state.doorPositions, { row, col }] };
            }
        }
        case 'HANDLE_VENTILATOR_CELL_CLICK': {
            const { row, col } = action.payload;
            const sequence: VentilatorCellType[] = ['glass', 'louvers', 'door', 'exhaust_fan'];
            const newGrid = state.ventilatorGrid.map(r => r.slice());
            const currentType = newGrid[row][col].type;
            const currentIndex = sequence.indexOf(currentType);
            const nextType = sequence[(currentIndex + 1) % sequence.length];
            newGrid[row][col] = { ...newGrid[row][col], type: nextType };
            if (nextType !== 'door' && newGrid[row][col].handle) {
                delete newGrid[row][col].handle;
            }
            return { ...state, ventilatorGrid: newGrid };
        }
        case 'SET_GRID_SIZE': {
            const { rows, cols } = action.payload;
            const newH = Array.from({ length: rows - 1 }).map((_, i) => (i + 1) / rows);
            const newV = Array.from({ length: cols - 1 }).map((_, i) => (i + 1) / cols);
            return { ...state, horizontalDividers: newH, verticalDividers: newV };
        }
        case 'REMOVE_VERTICAL_DIVIDER': {
            const index = action.payload;
            const verticalDividers = state.verticalDividers.filter((_, i) => i !== index);
            const ventilatorGrid = state.ventilatorGrid.map(row => { row.splice(index + 1, 1); return row; });
            const doorPositions = state.doorPositions.filter(p => p.col !== index + 1).map(p => p.col > index + 1 ? { ...p, col: p.col - 1 } : p);
            return { ...state, verticalDividers, ventilatorGrid, doorPositions };
        }
        case 'REMOVE_HORIZONTAL_DIVIDER': {
            const index = action.payload;
            const horizontalDividers = state.horizontalDividers.filter((_, i) => i !== index);
            const ventilatorGrid = [...state.ventilatorGrid];
            ventilatorGrid.splice(index + 1, 1);
            const doorPositions = state.doorPositions.filter(p => p.row !== index + 1).map(p => p.row > index + 1 ? { ...p, row: p.row - 1 } : p);
            return { ...state, horizontalDividers, ventilatorGrid, doorPositions };
        }
        case 'UPDATE_HANDLE': {
            const { panelId, newConfig } = action.payload;
            const parts = panelId.split('-');
            const type = parts[0];
            let newState = { ...state };

            switch (type) {
                case 'sliding': {
                    const index = parseInt(parts[1], 10);
                    const newHandles = [...state.slidingHandles];
                    newHandles[index] = newConfig;
                    newState.slidingHandles = newHandles;
                    break;
                }
                case 'casement': {
                    const row = parseInt(parts[1], 10);
                    const col = parseInt(parts[2], 10);
                    newState.doorPositions = state.doorPositions.map(p => {
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
                    const newGrid = state.ventilatorGrid.map(r => r.slice());
                    if (newConfig) {
                        newGrid[row][col] = { ...newGrid[row][col], handle: newConfig };
                    } else if (newGrid[row][col]) {
                        delete newGrid[row][col].handle;
                    }
                    newState.ventilatorGrid = newGrid;
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
                    newState.partitionPanels = { ...state.partitionPanels, types: newTypes };
                    break;
                }
            }
            return newState;
        }
        case 'SET_WINDOW_TYPE': {
          const newType = action.payload;
          const newState = { ...state, windowType: newType };
          if (newType === WindowType.GLASS_PARTITION) {
            newState.fixedPanels = [];
          }
           if (newType === WindowType.CORNER) {
              newState.cornerSubType = WindowType.SLIDING;
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
        case 'RESET_DESIGN': {
             return {
                ...initialConfig,
                windowType: state.windowType,
                cornerSubType: initialConfig.cornerSubType,
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
      // Merge with default to ensure new fields are included if the app updates
      const parsed = JSON.parse(saved);
      // Ensure partitionPanels has the new properties
      if (parsed.partitionPanels && typeof parsed.partitionPanels.hasTopChannel === 'undefined') {
          parsed.partitionPanels.hasTopChannel = true;
      }
      if (parsed.partitionPanels && parsed.partitionPanels.types) {
          parsed.partitionPanels.types.forEach((t: any) => {
              if (typeof t.framing === 'undefined') t.framing = 'none';
          });
      }
      return { ...initialConfig, ...parsed };
    }
  } catch (error) {
    console.error("Could not load current config from localStorage", error);
  }
  return initialConfig;
};

const App: React.FC = () => {
  
  const [windowConfigState, dispatch] = useReducer(configReducer, getInitialConfig());
  const { windowType, trackType, shutterConfig, fixedShutters, slidingHandles, verticalDividers, horizontalDividers, doorPositions, ventilatorGrid, partitionPanels, cornerSubType } = windowConfigState;

  const [isPanelOpen, setIsPanelOpen] = useState(window.innerWidth >= 1024);
  const [isMobileQuoteOpen, setIsMobileQuoteOpen] = useState(false);
  
  // Series State
  const [series, setSeries] = useState<ProfileSeries>(() => {
    try {
      const item = window.localStorage.getItem('aluminium-window-last-series');
      if (item) {
        const parsed = JSON.parse(item);
        if(parsed.id && parsed.name && parsed.dimensions) {
          return parsed;
        }
      }
    } catch (error) { console.error("Could not load last used series", error); }
    return DEFAULT_SLIDING_SERIES;
  });

  const [savedSeries, setSavedSeries] = useState<ProfileSeries[]>(() => {
    try {
      const item = window.localStorage.getItem('aluminium-window-profiles');
      return item ? JSON.parse(item) : [];
    } catch (error) { console.error("Could not load profiles", error); return []; }
  });

  // Color State
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
  
  // Quotation State
  const [windowTitle, setWindowTitle] = useState<string>(() => window.localStorage.getItem('woodenmax-quotation-panel-title') || 'Window 1');
  const [quantity, setQuantity] = useState<number | ''>(() => { try { const s = window.localStorage.getItem('woodenmax-quotation-panel-quantity'); return s ? JSON.parse(s) : 1; } catch { return 1; } });
  const [areaType, setAreaType] = useState<AreaType>(() => (window.localStorage.getItem('woodenmax-quotation-panel-areaType') as AreaType) || AreaType.SQFT);
  const [rate, setRate] = useState<number | ''>(() => { try { const s = window.localStorage.getItem('woodenmax-quotation-panel-rate'); return s ? JSON.parse(s) : 550; } catch { return 550; } });
  const [quotationItems, setQuotationItems] = useState<QuotationItem[]>(() => { try { const s = window.localStorage.getItem('woodenmax-quotation-items'); return s ? JSON.parse(s) : []; } catch { return []; } });
  const [isQuotationModalOpen, setIsQuotationModalOpen] = useState(false);
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [quotationSettings, setQuotationSettings] = useState<QuotationSettings>(() => {
      try {
        const item = window.localStorage.getItem('woodenmax-quotation-settings');
        return item ? JSON.parse(item) : DEFAULT_QUOTATION_SETTINGS;
      } catch (error) { return DEFAULT_QUOTATION_SETTINGS; }
  });
  
  // PWA Install State
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  
  const panelRef = useRef<HTMLDivElement>(null);
  
  const windowConfig: WindowConfig = useMemo(() => ({
    ...windowConfigState,
    series
  }), [windowConfigState, series]);

  // --- PERSISTENCE EFFECTS ---
  useEffect(() => {
    try {
      window.localStorage.setItem('woodenmax-current-config', JSON.stringify(windowConfigState));
    } catch (error) {
      console.error("Could not save current config to localStorage", error);
    }
  }, [windowConfigState]);

  useEffect(() => {
    try {
      window.localStorage.setItem('woodenmax-quotation-items', JSON.stringify(quotationItems));
    } catch (error) {
      console.error("Could not save quotation items", error);
    }
  }, [quotationItems]);

  useEffect(() => {
    try {
      window.localStorage.setItem('woodenmax-quotation-panel-title', windowTitle);
      window.localStorage.setItem('woodenmax-quotation-panel-quantity', JSON.stringify(quantity));
      window.localStorage.setItem('woodenmax-quotation-panel-areaType', areaType);
      window.localStorage.setItem('woodenmax-quotation-panel-rate', JSON.stringify(rate));
    } catch (error) {
      console.error("Could not save quotation panel state", error);
    }
  }, [windowTitle, quantity, areaType, rate]);
  
  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      setInstallPrompt(e as BeforeInstallPromptEvent);
    };
    window.addEventListener('beforeinstallprompt', handler);

    const appInstalledHandler = () => {
        setInstallPrompt(null);
    };
    window.addEventListener('appinstalled', appInstalledHandler);

    return () => {
      window.removeEventListener('beforeinstallprompt', handler);
      window.removeEventListener('appinstalled', appInstalledHandler);
    };
  }, []);

  useEffect(() => {
    try {
      window.localStorage.setItem('aluminium-window-profiles', JSON.stringify(savedSeries));
    } catch (error) { console.error("Could not save profiles", error); }
  }, [savedSeries]);

  useEffect(() => {
    try {
        window.localStorage.setItem('aluminium-window-last-series', JSON.stringify(series));
    } catch (error) { console.error("Could not save last series", error); }
  }, [series]);

  useEffect(() => {
    try {
      window.localStorage.setItem('aluminium-window-colors', JSON.stringify(savedColors));
    } catch (error) { console.error("Could not save colors", error); }
  }, [savedColors]);

  useEffect(() => {
    try {
      window.localStorage.setItem('woodenmax-quotation-settings', JSON.stringify(quotationSettings));
    } catch (error) { console.error("Could not save quotation settings", error); }
  }, [quotationSettings]);
  
  const SERIES_MAP_MEMO = useMemo(() => SERIES_MAP, []);

  useEffect(() => {
    const typeToSync = windowType === WindowType.CORNER ? cornerSubType : windowType;
    if (series.type !== typeToSync) {
        const foundSeries = savedSeries.find(s => s.type === typeToSync);
        setSeries(foundSeries || SERIES_MAP_MEMO[typeToSync as WindowType] || DEFAULT_SLIDING_SERIES);
    }
  }, [windowType, series.type, savedSeries, SERIES_MAP_MEMO, cornerSubType]);
  
  const availableSeries = useMemo(() => [
    DEFAULT_SLIDING_SERIES, DEFAULT_CASEMENT_SERIES, DEFAULT_VENTILATOR_SERIES, 
    DEFAULT_GLASS_PARTITION_SERIES, DEFAULT_CORNER_SERIES, ...savedSeries
  ], [savedSeries]);
  
  const numShutters = useMemo(() => {
    const activeType = windowType === WindowType.CORNER ? cornerSubType : windowType;
    if (activeType !== WindowType.SLIDING) return 0;
    switch (shutterConfig) {
      case ShutterConfigType.TWO_GLASS: return 2;
      case ShutterConfigType.THREE_GLASS: return 3;
      case ShutterConfigType.TWO_GLASS_ONE_MESH: return 3;
      case ShutterConfigType.FOUR_GLASS: return 4;
      default: return 0;
    }
  }, [shutterConfig, windowType, cornerSubType]);

  useEffect(() => {
    if (trackType === TrackType.TWO_TRACK && ![ShutterConfigType.TWO_GLASS, ShutterConfigType.FOUR_GLASS].includes(shutterConfig)) {
      dispatch({ type: 'SET_FIELD', field: 'shutterConfig', payload: ShutterConfigType.TWO_GLASS });
    }
    if (trackType === TrackType.THREE_TRACK && ![ShutterConfigType.THREE_GLASS, ShutterConfigType.TWO_GLASS_ONE_MESH].includes(shutterConfig)) {
      dispatch({ type: 'SET_FIELD', field: 'shutterConfig', payload: ShutterConfigType.THREE_GLASS });
    }
  }, [trackType, shutterConfig]);

  useEffect(() => {
    const newFixedShutters = Array(numShutters).fill(false);
    for(let i=0; i < Math.min(fixedShutters.length, newFixedShutters.length); i++) { newFixedShutters[i] = fixedShutters[i]; }
    dispatch({ type: 'SET_FIELD', field: 'fixedShutters', payload: newFixedShutters });
    
    const newSlidingHandles = Array(numShutters).fill(null);
    for(let i=0; i < Math.min(slidingHandles.length, newSlidingHandles.length); i++) { newSlidingHandles[i] = slidingHandles[i]; }
    dispatch({ type: 'SET_FIELD', field: 'slidingHandles', payload: newSlidingHandles });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [numShutters]);
  
  useEffect(() => {
    const gridRows = horizontalDividers.length + 1;
    const gridCols = verticalDividers.length + 1;
    const newGrid: VentilatorCell[][] = Array.from({ length: gridRows }, () => 
        Array.from({ length: gridCols }, () => ({ type: 'glass' }))
    );
    for (let r = 0; r < Math.min(gridRows, ventilatorGrid.length); r++) {
        for (let c = 0; c < Math.min(gridCols, ventilatorGrid[r]?.length || 0); c++) {
            newGrid[r][c] = ventilatorGrid[r][c];
        }
    }
    dispatch({ type: 'SET_FIELD', field: 'ventilatorGrid', payload: newGrid });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [verticalDividers, horizontalDividers]);

  const addFixedPanel = useCallback((position: FixedPanelPosition) => dispatch({ type: 'ADD_FIXED_PANEL', payload: position }), []);
  const removeFixedPanel = useCallback((id: string) => dispatch({ type: 'REMOVE_FIXED_PANEL', payload: id }), []);
  const updateFixedPanelSize = useCallback((id: string, size: number) => dispatch({ type: 'UPDATE_FIXED_PANEL_SIZE', payload: { id, size } }), []);
  
  const handleSeriesSelect = useCallback((id: string) => {
    const selected = availableSeries.find(s => s.id === id);
    if(selected) {
      setSeries(selected);
       const activeType = windowType === WindowType.CORNER ? cornerSubType : windowType;
      if (selected.type !== activeType) {
        if(windowType === WindowType.CORNER) {
            dispatch({ type: 'SET_FIELD', field: 'cornerSubType', payload: selected.type });
        } else {
            dispatch({ type: 'SET_WINDOW_TYPE', payload: selected.type });
        }
      }
    }
  }, [availableSeries, windowType, cornerSubType]);
  
  const handleSeriesSave = useCallback((name: string) => {
    if (name && name.trim() !== '') {
       const activeType = windowType === WindowType.CORNER ? cornerSubType : windowType;
      const newSeries: ProfileSeries = {
        ...series,
        id: uuidv4(),
        name: name.trim(),
        type: activeType as WindowType,
      };
      setSavedSeries(prev => [...prev, newSeries]);
      setSeries(newSeries);
    }
  }, [series, windowType, cornerSubType]);
  
  const handleSeriesDelete = useCallback((id: string) => {
    if (id.includes('-default')) { return; }
     const activeType = windowType === WindowType.CORNER ? cornerSubType : windowType;
    if (window.confirm("Are you sure you want to delete this profile?")) {
      setSavedSeries(prev => prev.filter(s => s.id !== id));
      if (series.id === id) {
        setSeries(SERIES_MAP_MEMO[activeType as WindowType]);
      }
    }
  }, [series.id, windowType, cornerSubType, SERIES_MAP_MEMO]);
  
  const handleHardwareChange = useCallback((id: string, field: keyof HardwareItem, value: string | number) => {
    setSeries(prevSeries => ({
        ...prevSeries,
        hardwareItems: prevSeries.hardwareItems.map(item => item.id === id ? { ...item, [field]: value } : item)
    }));
  }, []);
  
  const addHardwareItem = useCallback(() => {
    setSeries(prevSeries => ({
        ...prevSeries,
        hardwareItems: [...prevSeries.hardwareItems, { id: uuidv4(), name: 'New Hardware', qtyPerShutter: 1, rate: 0, unit: 'per_shutter_or_door' }]
    }));
  }, []);
  
  const removeHardwareItem = useCallback((id: string) => {
    setSeries(prevSeries => ({
        ...prevSeries,
        hardwareItems: prevSeries.hardwareItems.filter(item => item.id !== id)
    }));
  }, []);

  const toggleDoorPosition = useCallback((row: number, col: number) => dispatch({ type: 'TOGGLE_DOOR_POSITION', payload: { row, col } }), []);
  const handleVentilatorCellClick = useCallback((row: number, col: number) => dispatch({ type: 'HANDLE_VENTILATOR_CELL_CLICK', payload: { row, col } }), []);
  const handleSetGridSize = useCallback((rows: number, cols: number) => dispatch({ type: 'SET_GRID_SIZE', payload: { rows, cols } }), []);
  const handleRemoveVerticalDivider = useCallback((index: number) => dispatch({ type: 'REMOVE_VERTICAL_DIVIDER', payload: index }), []);
  const handleRemoveHorizontalDivider = useCallback((index: number) => dispatch({ type: 'REMOVE_HORIZONTAL_DIVIDER', payload: index }), []);
  const handleUpdateHandle = useCallback((panelId: string, newConfig: HandleConfig | null) => dispatch({ type: 'UPDATE_HANDLE', payload: { panelId, newConfig } }), []);
  const onCyclePartitionPanelType = useCallback((index: number) => dispatch({ type: 'CYCLE_PARTITION_PANEL_TYPE', payload: index }), []);
  const onSetPartitionHasTopChannel = useCallback((hasChannel: boolean) => dispatch({ type: 'SET_PARTITION_HAS_TOP_CHANNEL', payload: hasChannel }), []);
  const onCyclePartitionPanelFraming = useCallback((index: number) => dispatch({ type: 'CYCLE_PARTITION_PANEL_FRAMING', payload: index }), []);
  const handleResetDesign = useCallback(() => {
    if (window.confirm("Are you sure you want to reset the current design? All changes will be lost.")) {
        dispatch({ type: 'RESET_DESIGN' });
    }
  }, []);

  const hardwareCostPerWindow = useMemo(() => {
    let numDoorsOrShutters = 0;
    const typeForCost = windowType === WindowType.CORNER ? cornerSubType : windowType;
    
    switch(typeForCost) {
        case WindowType.SLIDING: numDoorsOrShutters = numShutters; break;
        case WindowType.CASEMENT: numDoorsOrShutters = doorPositions.length; break;
        case WindowType.VENTILATOR: 
          numDoorsOrShutters = ventilatorGrid.flat().filter(cell => cell.type === 'door' || cell.type === 'louvers' || cell.type === 'exhaust_fan').length; 
          break;
        case WindowType.GLASS_PARTITION: 
            numDoorsOrShutters = partitionPanels.types.filter(t => t.type !== 'fixed').length;
            break;
    }
    
    const singleWindowCost = series.hardwareItems.reduce((total, item) => {
        const qty = Number(item.qtyPerShutter) || 0;
        const itemRate = Number(item.rate) || 0;
        const count = item.unit === 'per_shutter_or_door' ? numDoorsOrShutters : 1;
        return total + (qty * itemRate * count);
    }, 0);

    return windowType === WindowType.CORNER ? singleWindowCost * 2 : singleWindowCost;
  }, [series.hardwareItems, numShutters, doorPositions.length, ventilatorGrid, windowType, partitionPanels, cornerSubType]);

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

  const handleRemoveQuotationItem = useCallback((id: string) => {
      setQuotationItems(prev => prev.filter(item => item.id !== id));
  }, []);
  
  const handleInstallClick = async () => {
    if (!installPrompt) return;
    await installPrompt.prompt();
    const { outcome } = await installPrompt.userChoice;
    if (outcome === 'accepted') {
      console.log('User accepted the A2HS prompt');
    } else {
      console.log('User dismissed the A2HS prompt');
    }
    setInstallPrompt(null);
  };
  
  const setConfig = useCallback((field: keyof WindowConfig, value: any) => {
    if (field === 'series') {
        setSeries(value);
    } else {
        dispatch({ type: 'SET_FIELD', field: field as keyof ConfigState, payload: value });
    }
  }, []);
  
  const commonControlProps = useMemo(() => ({
    config: windowConfig,
    setConfig,
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
    onCyclePartitionPanelType,
    onSetPartitionHasTopChannel,
    onCyclePartitionPanelFraming,
    onResetDesign: handleResetDesign,
  }), [windowConfig, setConfig, handleSetGridSize, availableSeries, handleSeriesSelect, handleSeriesSave, handleSeriesDelete, addFixedPanel, removeFixedPanel, updateFixedPanelSize, handleHardwareChange, addHardwareItem, removeHardwareItem, toggleDoorPosition, handleVentilatorCellClick, savedColors, handleUpdateHandle, onCyclePartitionPanelType, onSetPartitionHasTopChannel, onCyclePartitionPanelFraming, handleResetDesign]);

  return (
    <>
      <QuotationListModal 
        isOpen={isQuotationModalOpen}
        onClose={() => setIsQuotationModalOpen(false)}
        items={quotationItems}
        setItems={setQuotationItems}
        onRemove={handleRemoveQuotationItem}
        settings={quotationSettings}
        setSettings={setQuotationSettings}
        onTogglePreview={setIsPreviewing}
      />
      <div className={`flex flex-col h-screen font-sans bg-slate-900 overflow-hidden ${isPreviewing ? 'hidden' : ''}`}>
        <header className="bg-slate-800 p-3 flex items-center shadow-md z-40 no-print">
            <Logo className="h-10 w-10 mr-4 flex-shrink-0" />
            <div className="flex-grow">
                <h1 className="text-2xl font-bold text-white tracking-wider">WoodenMax</h1>
                <p className="text-sm text-indigo-300">Reshaping spaces</p>
            </div>
             {installPrompt && (
                <Button onClick={handleInstallClick} variant="secondary" className="animate-pulse">
                    <DownloadIcon className="w-5 h-5 mr-2" /> Add to Home Screen
                </Button>
            )}
        </header>
        <div className="flex flex-row flex-grow min-h-0">
            {/* Desktop Side Panel */}
            <div ref={panelRef} className={`hidden lg:block flex-shrink-0 h-full transition-all duration-300 ease-in-out z-30 bg-slate-800 no-print ${isPanelOpen ? 'w-96' : 'w-0'}`}>
                <div className={`h-full overflow-hidden ${isPanelOpen ? 'w-96' : 'w-0'}`}>
                    <ControlsPanel {...commonControlProps} onClose={() => setIsPanelOpen(false)} />
                </div>
            </div>

            <div className="relative flex-1 flex flex-col min-w-0">
                {!isPanelOpen && (
                  <button 
                    onClick={() => setIsPanelOpen(true)}
                    className="absolute top-1/2 -translate-y-1/2 left-0 bg-slate-700 hover:bg-indigo-600 text-white w-6 h-24 rounded-r-lg z-20 focus:outline-none focus:ring-2 focus:ring-indigo-500 items-center justify-center transition-all duration-300 no-print hidden lg:flex"
                    aria-label="Expand panel"
                  >
                    <ChevronLeftIcon className="w-5 h-5 rotate-180" />
                  </button>
                )}
              <div className="flex-grow relative">
                 <WindowCanvas 
                    config={windowConfig} 
                    onRemoveVerticalDivider={handleRemoveVerticalDivider}
                    onRemoveHorizontalDivider={handleRemoveHorizontalDivider}
                  />
              </div>
              <div className="flex-shrink-0 no-print hidden lg:block">
                  <QuotationPanel 
                      width={Number(windowConfig.width) || 0}
                      height={Number(windowConfig.height) || 0}
                      quantity={quantity}
                      setQuantity={setQuantity}
                      areaType={areaType}
                      setAreaType={setAreaType}
                      rate={rate}
                      setRate={setRate}
                      onSave={handleSaveToQuotation}
                      windowTitle={windowTitle}
                      setWindowTitle={setWindowTitle}
                      hardwareCostPerWindow={hardwareCostPerWindow}
                      quotationItemCount={quotationItems.length}
                      onViewQuotation={() => setIsQuotationModalOpen(true)}
                  />
              </div>

              {/* Mobile Bottom Action Bar */}
              <div className="lg:hidden p-2 bg-slate-800 border-t-2 border-slate-700 grid grid-cols-2 gap-2 no-print">
                  <Button onClick={() => setIsPanelOpen(true)} variant="secondary" className="h-12">
                      <AdjustmentsIcon className="w-5 h-5 mr-2" /> Configure
                  </Button>
                  <Button onClick={() => setIsMobileQuoteOpen(true)} variant="secondary" className="h-12">
                       <ListBulletIcon className="w-5 h-5 mr-2" /> Quotation
                  </Button>
              </div>
            </div>
        </div>

        {/* Mobile Controls Panel (Bottom Sheet) */}
        <div 
          className={`lg:hidden fixed inset-0 bg-black bg-opacity-50 z-40 transition-opacity duration-300 ${isPanelOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
          onClick={() => setIsPanelOpen(false)}
        ></div>
        <div className={`lg:hidden fixed bottom-0 left-0 right-0 max-h-[85vh] flex flex-col transform transition-transform duration-300 ease-in-out z-50 bg-slate-800 rounded-t-lg no-print ${isPanelOpen ? 'translate-y-0' : 'translate-y-full'}`}>
           <ControlsPanel {...commonControlProps} onClose={() => setIsPanelOpen(false)} />
        </div>

         {/* Mobile Quotation Panel (Bottom Sheet) */}
        <div 
          className={`lg:hidden fixed inset-0 bg-black bg-opacity-50 z-40 transition-opacity duration-300 ${isMobileQuoteOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
          onClick={() => setIsMobileQuoteOpen(false)}
        ></div>
        <div className={`lg:hidden fixed bottom-0 left-0 right-0 flex flex-col transform transition-transform duration-300 ease-in-out z-50 bg-slate-800 rounded-t-lg no-print ${isMobileQuoteOpen ? 'translate-y-0' : 'translate-y-full'}`}>
            <QuotationPanel 
                width={Number(windowConfig.width) || 0}
                height={Number(windowConfig.height) || 0}
                quantity={quantity}
                setQuantity={setQuantity}
                areaType={areaType}
                setAreaType={setAreaType}
                rate={rate}
                setRate={setRate}
                onSave={handleSaveToQuotation}
                windowTitle={windowTitle}
                setWindowTitle={setWindowTitle}
                hardwareCostPerWindow={hardwareCostPerWindow}
                quotationItemCount={quotationItems.length}
                onViewQuotation={() => setIsQuotationModalOpen(true)}
                onClose={() => setIsMobileQuoteOpen(false)}
            />
        </div>
      </div>
    </>
  );
};

export default App;