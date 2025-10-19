import React, { useState, useEffect, useMemo, useRef } from 'react';
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
    weights: {},
    lengths: {},
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
    weights: {},
    lengths: {},
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
    weights: {},
    lengths: {},
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
  weights: {},
  lengths: {},
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

const App: React.FC = () => {
  // Shared State
  const [width, setWidth] = useState<number | ''>(1800);
  const [height, setHeight] = useState<number | ''>(2100);
  const [fixedPanels, setFixedPanels] = useState<FixedPanel[]>([]);
  const [isPanelOpen, setIsPanelOpen] = useState(window.innerWidth >= 1024);
  const [isMobileQuoteOpen, setIsMobileQuoteOpen] = useState(false);

  const [glassType, setGlassType] = useState<GlassType>(GlassType.CLEAR);
  const [glassThickness, setGlassThickness] = useState<number | ''>(8);
  const [glassSpecialType, setGlassSpecialType] = useState<GlassSpecialType>('none');
  const [profileColor, setProfileColor] = useState<string>('#374151');
  const [glassGrid, setGlassGrid] = useState({ rows: 0, cols: 0 });
  
  // Window Type State
  const [windowType, setWindowType] = useState<WindowType>(WindowType.SLIDING);
  
  // Sliding Window State
  const [trackType, setTrackType] = useState<TrackType>(TrackType.TWO_TRACK);
  const [shutterConfig, setShutterConfig] = useState<ShutterConfigType>(ShutterConfigType.TWO_GLASS);
  const [fixedShutters, setFixedShutters] = useState<boolean[]>([]);
  const [slidingHandles, setSlidingHandles] = useState<(HandleConfig | null)[]>([]);

  
  // Casement & Ventilator State
  const [verticalDividers, setVerticalDividers] = useState<number[]>([0.5]);
  const [horizontalDividers, setHorizontalDividers] = useState<number[]>([]);
  const [doorPositions, setDoorPositions] = useState<{row: number, col: number, handle?: HandleConfig}[]>([{row:0, col:0}, {row:0, col:1}]);

  // Ventilator-specific State
  const [ventilatorGrid, setVentilatorGrid] = useState<VentilatorCell[][]>([]);

  // Glass Partition State
  const [partitionPanels, setPartitionPanels] = useState<{ count: number, types: PartitionPanelConfig[] }>({ count: 2, types: [{ type: 'fixed' }, { type: 'sliding' }] });

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
  const [windowTitle, setWindowTitle] = useState<string>('Window 1');
  const [quantity, setQuantity] = useState<number | ''>(1);
  const [areaType, setAreaType] = useState<AreaType>(AreaType.SQFT);
  const [rate, setRate] = useState<number | ''>(550);
  const [quotationItems, setQuotationItems] = useState<QuotationItem[]>([]);
  const [isQuotationModalOpen, setIsQuotationModalOpen] = useState(false);
  const [quotationSettings, setQuotationSettings] = useState<QuotationSettings>(() => {
      try {
        const item = window.localStorage.getItem('woodenmax-quotation-settings');
        return item ? JSON.parse(item) : DEFAULT_QUOTATION_SETTINGS;
      } catch (error) { return DEFAULT_QUOTATION_SETTINGS; }
  });
  
  // PWA Install State
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  
  const panelRef = useRef<HTMLDivElement>(null);

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
  
  const SERIES_MAP: Record<WindowType, ProfileSeries> = {
    [WindowType.SLIDING]: DEFAULT_SLIDING_SERIES,
    [WindowType.CASEMENT]: DEFAULT_CASEMENT_SERIES,
    [WindowType.VENTILATOR]: DEFAULT_VENTILATOR_SERIES,
    [WindowType.GLASS_PARTITION]: DEFAULT_GLASS_PARTITION_SERIES,
  };

  useEffect(() => {
    // When switching window type, set a relevant default series
    if (series.type !== windowType) {
        setSeries(SERIES_MAP[windowType] || DEFAULT_SLIDING_SERIES);
    }
    // Reset fixed panels for partition
    if (windowType === WindowType.GLASS_PARTITION) {
        setFixedPanels([]);
    }
  }, [windowType]);
  
  const availableSeries = [
    DEFAULT_SLIDING_SERIES, DEFAULT_CASEMENT_SERIES, DEFAULT_VENTILATOR_SERIES, 
    DEFAULT_GLASS_PARTITION_SERIES, ...savedSeries
  ];
  
  const numShutters = useMemo(() => {
    if (windowType !== WindowType.SLIDING) return 0;
    switch (shutterConfig) {
      case ShutterConfigType.TWO_GLASS: return 2;
      case ShutterConfigType.THREE_GLASS: return 3;
      case ShutterConfigType.TWO_GLASS_ONE_MESH: return 3;
      case ShutterConfigType.FOUR_GLASS: return 4;
      default: return 0;
    }
  }, [shutterConfig, windowType]);

  useEffect(() => {
    if (trackType === TrackType.TWO_TRACK && ![ShutterConfigType.TWO_GLASS, ShutterConfigType.FOUR_GLASS].includes(shutterConfig)) {
      setShutterConfig(ShutterConfigType.TWO_GLASS);
    }
    if (trackType === TrackType.THREE_TRACK && ![ShutterConfigType.THREE_GLASS, ShutterConfigType.TWO_GLASS_ONE_MESH].includes(shutterConfig)) {
      setShutterConfig(ShutterConfigType.THREE_GLASS);
    }
  }, [trackType, shutterConfig]);

  useEffect(() => {
    setFixedShutters(current => {
        const newArray = Array(numShutters).fill(false);
        for(let i=0; i < Math.min(current.length, newArray.length); i++) { newArray[i] = current[i]; }
        return newArray;
    });
     setSlidingHandles(current => {
        const newArray = Array(numShutters).fill(null);
        for(let i=0; i < Math.min(current.length, newArray.length); i++) { newArray[i] = current[i]; }
        return newArray;
    });
  }, [numShutters]);
  
  useEffect(() => {
    setVentilatorGrid(currentGrid => {
        const gridRows = horizontalDividers.length + 1;
        const gridCols = verticalDividers.length + 1;
        const newGrid: VentilatorCell[][] = Array.from({ length: gridRows }, () => 
            Array.from({ length: gridCols }, () => ({ type: 'glass' }))
        );
        for (let r = 0; r < Math.min(gridRows, currentGrid.length); r++) {
            for (let c = 0; c < Math.min(gridCols, currentGrid[r]?.length || 0); c++) {
                newGrid[r][c] = currentGrid[r][c];
            }
        }
        return newGrid;
    });
  }, [verticalDividers, horizontalDividers]);

   useEffect(() => {
    setPartitionPanels(current => ({
      ...current,
      types: Array(current.count).fill({ type: 'fixed' as PartitionPanelType }).map((v, i) => current.types[i] || v),
    }));
  }, [partitionPanels.count]);

  const addFixedPanel = (position: FixedPanelPosition) => {
    if (fixedPanels.some(p => p.position === position)) return;
    setFixedPanels(prev => [...prev, { id: uuidv4(), position, size: 300 }]);
  };
  
  const removeFixedPanel = (id: string) => setFixedPanels(prev => prev.filter(p => p.id !== id));
  
  const updateFixedPanelSize = (id: string, size: number) => setFixedPanels(prev => prev.map(p => p.id === id ? {...p, size} : p));
  
  const handleSeriesSelect = (id: string) => {
    const selected = availableSeries.find(s => s.id === id);
    if(selected) {
      setSeries(selected);
      setWindowType(selected.type);
    }
  };
  
  const handleSeriesSave = (name: string) => {
    if (name && name.trim() !== '') {
      const newSeries: ProfileSeries = {
        ...series,
        id: uuidv4(),
        name: name.trim(),
        type: windowType,
      };
      setSavedSeries(prev => [...prev, newSeries]);
      setSeries(newSeries);
    }
  };
  
  const handleSeriesDelete = (id: string) => {
    if (id.includes('-default')) { return; }
    if (window.confirm("Are you sure you want to delete this profile?")) {
      setSavedSeries(prev => prev.filter(s => s.id !== id));
      if (series.id === id) {
        setSeries(SERIES_MAP[windowType]);
      }
    }
  };
  
  const handleHardwareChange = (id: string, field: keyof HardwareItem, value: string | number) => {
    setSeries(prevSeries => ({
        ...prevSeries,
        hardwareItems: prevSeries.hardwareItems.map(item => item.id === id ? { ...item, [field]: value } : item)
    }));
  };
  
  const addHardwareItem = () => {
    setSeries(prevSeries => ({
        ...prevSeries,
        hardwareItems: [...prevSeries.hardwareItems, { id: uuidv4(), name: 'New Hardware', qtyPerShutter: 1, rate: 0, unit: 'per_shutter_or_door' }]
    }));
  };
  
  const removeHardwareItem = (id: string) => {
    setSeries(prevSeries => ({
        ...prevSeries,
        hardwareItems: prevSeries.hardwareItems.filter(item => item.id !== id)
    }));
  };

  const toggleDoorPosition = (row: number, col: number) => {
    setDoorPositions(prev => {
        const exists = prev.some(p => p.row === row && p.col === col);
        if (exists) {
            return prev.filter(p => p.row !== row || p.col !== col);
        } else {
            return [...prev, { row, col }];
        }
    });
  };

  const handleVentilatorCellClick = (row: number, col: number) => {
    const sequence: VentilatorCellType[] = ['glass', 'louvers', 'door', 'exhaust_fan'];
    setVentilatorGrid(prev => {
        const newGrid = prev.map(r => r.slice());
        const currentType = newGrid[row][col].type;
        const currentIndex = sequence.indexOf(currentType);
        const nextType = sequence[(currentIndex + 1) % sequence.length];
        newGrid[row][col] = { ...newGrid[row][col], type: nextType };
        // Remove handle if it's not a door anymore
        if (nextType !== 'door' && newGrid[row][col].handle) {
            delete newGrid[row][col].handle;
        }
        return newGrid;
    });
  };

  const handleSetGridSize = (rows: number, cols: number) => {
      const newH = Array.from({length: rows - 1}).map((_, i) => (i + 1) / rows);
      const newV = Array.from({length: cols - 1}).map((_, i) => (i + 1) / cols);
      setHorizontalDividers(newH);
      setVerticalDividers(newV);
  };

  const handleRemoveVerticalDivider = (index: number) => {
      setVerticalDividers(prev => prev.filter((_, i) => i !== index));
      setVentilatorGrid(prev => prev.map(row => {
          row.splice(index + 1, 1);
          return row;
      }));
      setDoorPositions(prev => prev.filter(p => p.col !== index + 1).map(p => p.col > index + 1 ? {...p, col: p.col - 1} : p));
  };
  
  const handleRemoveHorizontalDivider = (index: number) => {
      setHorizontalDividers(prev => prev.filter((_, i) => i !== index));
      setVentilatorGrid(prev => {
          prev.splice(index + 1, 1);
          return prev;
      });
      setDoorPositions(prev => prev.filter(p => p.row !== index + 1).map(p => p.row > index + 1 ? {...p, row: p.row - 1} : p));
  };

  const handleUpdateHandle = (panelId: string, newConfig: HandleConfig | null) => {
    const parts = panelId.split('-');
    const type = parts[0];

    switch (type) {
        case 'sliding': {
            const index = parseInt(parts[1], 10);
            setSlidingHandles(prev => {
                const newHandles = [...prev];
                newHandles[index] = newConfig;
                return newHandles;
            });
            break;
        }
        case 'casement': {
            const row = parseInt(parts[1], 10);
            const col = parseInt(parts[2], 10);
            setDoorPositions(prev => prev.map(p => {
                if (p.row === row && p.col === col) {
                    if (newConfig) return { ...p, handle: newConfig };
                    const { handle, ...rest } = p;
                    return rest;
                }
                return p;
            }));
            break;
        }
        case 'ventilator': {
            const row = parseInt(parts[1], 10);
            const col = parseInt(parts[2], 10);
            setVentilatorGrid(prev => {
                const newGrid = prev.map(r => r.slice());
                if (newConfig) {
                    newGrid[row][col] = { ...newGrid[row][col], handle: newConfig };
                } else if (newGrid[row][col]) {
                    delete newGrid[row][col].handle;
                }
                return newGrid;
            });
            break;
        }
        case 'partition': {
            const index = parseInt(parts[1], 10);
            setPartitionPanels(prev => {
                const newTypes = [...prev.types];
                if (newConfig) {
                    newTypes[index] = { ...newTypes[index], handle: newConfig };
                } else if (newTypes[index]) {
                    delete newTypes[index].handle;
                }
                return { ...prev, types: newTypes };
            });
            break;
        }
    }
  };

  const hardwareCostPerWindow = useMemo(() => {
    let numDoorsOrShutters = 0;
    
    switch(windowType) {
        case WindowType.SLIDING: numDoorsOrShutters = numShutters; break;
        case WindowType.CASEMENT: numDoorsOrShutters = doorPositions.length; break;
        case WindowType.VENTILATOR: 
          numDoorsOrShutters = ventilatorGrid.flat().filter(cell => cell.type === 'door' || cell.type === 'louvers' || cell.type === 'exhaust_fan').length; 
          break;
        case WindowType.GLASS_PARTITION: 
            numDoorsOrShutters = partitionPanels.types.filter(t => t.type !== 'fixed').length;
            break;
    }
    
    return series.hardwareItems.reduce((total, item) => {
        const qty = Number(item.qtyPerShutter) || 0;
        const itemRate = Number(item.rate) || 0;
        const count = item.unit === 'per_shutter_or_door' ? numDoorsOrShutters : 1;
        return total + (qty * itemRate * count);
    }, 0);

  }, [series.hardwareItems, numShutters, doorPositions.length, ventilatorGrid, windowType, partitionPanels, horizontalDividers, verticalDividers]);

  const windowConfig: WindowConfig = useMemo(() => ({
    width: width,
    height: height,
    series,
    fixedPanels,
    glassType,
    glassThickness: Number(glassThickness) || 0,
    glassSpecialType,
    profileColor,
    glassGrid,
    windowType,
    trackType,
    shutterConfig,
    fixedShutters,
    slidingHandles,
    verticalDividers,
    horizontalDividers,
    doorPositions,
    ventilatorGrid,
    partitionPanels,
  }), [width, height, series, fixedPanels, glassType, glassThickness, glassSpecialType, profileColor, glassGrid, windowType, trackType, shutterConfig, fixedShutters, slidingHandles, verticalDividers, horizontalDividers, doorPositions, ventilatorGrid, partitionPanels]);

  const handleSaveToQuotation = () => {
    const colorName = savedColors.find(c => c.hex === windowConfig.profileColor)?.name;
    const newItem: QuotationItem = {
        id: uuidv4(),
        title: windowTitle || 'Untitled Window',
        config: windowConfig,
        quantity: Number(quantity) || 1,
        areaType,
        rate: Number(rate) || 0,
        hardwareCost: hardwareCostPerWindow,
        hardwareItems: JSON.parse(JSON.stringify(series.hardwareItems)),
        profileColorName: colorName,
    };
    setQuotationItems(prev => [...prev, newItem]);
    alert(`"${newItem.title}" saved to quotation! You now have ${quotationItems.length + 1} item(s).`);
  }

  const handleRemoveQuotationItem = (id: string) => {
      setQuotationItems(prev => prev.filter(item => item.id !== id));
  }
  
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
  
  const commonControlProps = {
    config: windowConfig,
    setConfig: (field: keyof WindowConfig, value: any) => {
        switch(field) {
            case 'width': setWidth(value); break;
            case 'height': setHeight(value); break;
            case 'series': setSeries(value); break;
            case 'glassType': setGlassType(value); break;
            case 'glassThickness': setGlassThickness(value); break;
            case 'glassSpecialType': setGlassSpecialType(value); break;
            case 'profileColor': setProfileColor(value); break;
            case 'glassGrid': setGlassGrid(value); break;
            case 'windowType': setWindowType(value); break;
            case 'trackType': setTrackType(value); break;
            case 'shutterConfig': setShutterConfig(value); break;
            case 'fixedShutters': setFixedShutters(value); break;
            case 'slidingHandles': setSlidingHandles(value); break;
            case 'doorPositions': setDoorPositions(value); break;
            case 'ventilatorGrid': setVentilatorGrid(value); break;
            case 'partitionPanels': setPartitionPanels(value); break;
        }
    },
    setGridSize: handleSetGridSize,
    availableSeries: availableSeries,
    onSeriesSelect: handleSeriesSelect,
    onSeriesSave: handleSeriesSave,
    onSeriesDelete: handleSeriesDelete,
    fixedPanels: fixedPanels,
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
  };


  return (
    <>
      <QuotationListModal 
        isOpen={isQuotationModalOpen}
        onClose={() => setIsQuotationModalOpen(false)}
        items={quotationItems}
        onRemove={handleRemoveQuotationItem}
        settings={quotationSettings}
        setSettings={setQuotationSettings}
      />
      <div className="flex flex-col h-screen font-sans bg-slate-900 overflow-hidden">
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
                      width={Number(width) || 0}
                      height={Number(height) || 0}
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
        <div className={`lg:hidden fixed bottom-0 left-0 right-0 max-h-[85vh] transform transition-transform duration-300 ease-in-out z-50 bg-slate-800 rounded-t-lg no-print ${isPanelOpen ? 'translate-y-0' : 'translate-y-full'}`}>
           <ControlsPanel {...commonControlProps} onClose={() => setIsPanelOpen(false)} />
        </div>

         {/* Mobile Quotation Panel (Bottom Sheet) */}
        <div 
          className={`lg:hidden fixed inset-0 bg-black bg-opacity-50 z-40 transition-opacity duration-300 ${isMobileQuoteOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
          onClick={() => setIsMobileQuoteOpen(false)}
        ></div>
        <div className={`lg:hidden fixed bottom-0 left-0 right-0 transform transition-transform duration-300 ease-in-out z-50 bg-slate-800 rounded-t-lg no-print ${isMobileQuoteOpen ? 'translate-y-0' : 'translate-y-full'}`}>
            <QuotationPanel 
                width={Number(width) || 0}
                height={Number(height) || 0}
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