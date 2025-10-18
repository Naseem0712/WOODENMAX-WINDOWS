import React, { useState, useEffect, useMemo } from 'react';
import type { FixedPanel, ProfileSeries, WindowConfig, HardwareItem, QuotationItem, VentilatorCell, GlassSpecialType, SavedColor, VentilatorCellType, PartitionPanelType, QuotationSettings, HandleConfig, PartitionPanelConfig } from './types';
import { FixedPanelPosition, ShutterConfigType, TrackType, GlassType, AreaType, WindowType } from './types';
import { ControlsPanel } from './components/ControlsPanel';
import { WindowCanvas } from './components/WindowCanvas';
import { v4 as uuidv4 } from 'uuid';
import { QuotationPanel } from './components/QuotationPanel';
import { QuotationListModal } from './components/QuotationListModal';
import { Logo } from './components/icons/Logo';
import { Button } from './components/ui/Button';
import { DownloadIcon } from './components/icons/DownloadIcon';
import { AdjustmentsIcon } from './components/icons/AdjustmentsIcon';
import { XMarkIcon } from './components/icons/XMarkIcon';

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
    specialTypes: ['laminated', 'dgu'] as Exclude<GlassSpecialType, 'none' | 'custom'>[],
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
  }
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
  const [isDesktopPanelOpen, setIsDesktopPanelOpen] = useState(true);
  const [isMobilePanelOpen, setIsMobilePanelOpen] = useState(false);
  const [glassType, setGlassType] = useState<GlassType>(GlassType.CLEAR);
  const [glassThickness, setGlassThickness] = useState<WindowConfig['glassThickness']>('');
  const [customGlassThickness, setCustomGlassThickness] = useState<number | ''>('');
  const [glassSpecialType, setGlassSpecialType] = useState<GlassSpecialType>('none');
  const [customGlassSpecialType, setCustomGlassSpecialType] = useState('');
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
        if(parsed.id && parsed.name && parsed.dimensions) return parsed;
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
  const [isMobile, setIsMobile] = useState(window.innerWidth < 1024);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 1024);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      setInstallPrompt(e as BeforeInstallPromptEvent);
    };
    window.addEventListener('beforeinstallprompt', handler);
    const appInstalledHandler = () => setInstallPrompt(null);
    window.addEventListener('appinstalled', appInstalledHandler);

    return () => {
      window.removeEventListener('beforeinstallprompt', handler);
      window.removeEventListener('appinstalled', appInstalledHandler);
    };
  }, []);

  useEffect(() => { window.localStorage.setItem('aluminium-window-profiles', JSON.stringify(savedSeries)); }, [savedSeries]);
  useEffect(() => { window.localStorage.setItem('aluminium-window-last-series', JSON.stringify(series)); }, [series]);
  useEffect(() => { window.localStorage.setItem('aluminium-window-colors', JSON.stringify(savedColors)); }, [savedColors]);
  useEffect(() => { window.localStorage.setItem('woodenmax-quotation-settings', JSON.stringify(quotationSettings)); }, [quotationSettings]);

  const SERIES_MAP: Record<WindowType, ProfileSeries> = {
    [WindowType.SLIDING]: DEFAULT_SLIDING_SERIES,
    [WindowType.CASEMENT]: DEFAULT_CASEMENT_SERIES,
    [WindowType.VENTILATOR]: DEFAULT_VENTILATOR_SERIES,
    [WindowType.GLASS_PARTITION]: DEFAULT_GLASS_PARTITION_SERIES,
  };

  useEffect(() => {
    if (series.type !== windowType) setSeries(SERIES_MAP[windowType] || DEFAULT_SLIDING_SERIES);
    if (windowType === WindowType.GLASS_PARTITION) setFixedPanels([]);
  }, [windowType, series.type]);
  
  const availableSeries = [
    DEFAULT_SLIDING_SERIES, DEFAULT_CASEMENT_SERIES, DEFAULT_VENTILATOR_SERIES, 
    DEFAULT_GLASS_PARTITION_SERIES, ...savedSeries
  ];
  
  const numShutters = useMemo(() => {
    if (windowType !== WindowType.SLIDING) return 0;
    return {
      [ShutterConfigType.TWO_GLASS]: 2,
      [ShutterConfigType.THREE_GLASS]: 3,
      [ShutterConfigType.TWO_GLASS_ONE_MESH]: 3,
      [ShutterConfigType.FOUR_GLASS]: 4,
    }[shutterConfig] || 0;
  }, [shutterConfig, windowType]);

  useEffect(() => {
    if (trackType === TrackType.TWO_TRACK && ![ShutterConfigType.TWO_GLASS, ShutterConfigType.FOUR_GLASS].includes(shutterConfig)) {
      setShutterConfig(ShutterConfigType.TWO_GLASS);
    } else if (trackType === TrackType.THREE_TRACK && ![ShutterConfigType.THREE_GLASS, ShutterConfigType.TWO_GLASS_ONE_MESH].includes(shutterConfig)) {
      setShutterConfig(ShutterConfigType.THREE_GLASS);
    }
  }, [trackType, shutterConfig]);

  useEffect(() => {
    setFixedShutters(current => Array(numShutters).fill(false).map((v, i) => current[i] || v));
    setSlidingHandles(current => Array(numShutters).fill(null).map((v, i) => current[i] || v));
  }, [numShutters]);
  
  useEffect(() => {
    setVentilatorGrid(currentGrid => {
        const gridRows = horizontalDividers.length + 1;
        const gridCols = verticalDividers.length + 1;
        const newGrid: VentilatorCell[][] = Array.from({ length: gridRows }, () => Array.from({ length: gridCols }, () => ({ type: 'glass' })));
        for (let r = 0; r < Math.min(gridRows, currentGrid.length); r++) {
            for (let c = 0; c < Math.min(gridCols, currentGrid[r]?.length || 0); c++) {
                newGrid[r][c] = currentGrid[r][c];
            }
        }
        return newGrid;
    });
  }, [verticalDividers, horizontalDividers]);

   useEffect(() => {
    setPartitionPanels(current => ({ ...current, types: Array(current.count).fill({ type: 'fixed' as PartitionPanelType }).map((v, i) => current.types[i] || v) }));
  }, [partitionPanels.count]);

  const addFixedPanel = (position: FixedPanelPosition) => {
    if (!fixedPanels.some(p => p.position === position)) setFixedPanels(prev => [...prev, { id: uuidv4(), position, size: 300 }]);
  };
  const removeFixedPanel = (id: string) => setFixedPanels(prev => prev.filter(p => p.id !== id));
  const updateFixedPanelSize = (id: string, size: number) => setFixedPanels(prev => prev.map(p => p.id === id ? {...p, size} : p));
  
  const handleSeriesSelect = (id: string) => {
    const selected = availableSeries.find(s => s.id === id);
    if(selected) { setSeries(selected); setWindowType(selected.type); }
  };
  
  const handleSeriesSave = (name: string) => {
    if (name.trim()) {
      const newSeries: ProfileSeries = { ...series, id: uuidv4(), name: name.trim(), type: windowType };
      setSavedSeries(prev => [...prev, newSeries]);
      setSeries(newSeries);
    }
  };
  
  const handleSeriesDelete = (id: string) => {
    if (id.includes('-default') || !window.confirm("Are you sure you want to delete this profile?")) return;
    setSavedSeries(prev => prev.filter(s => s.id !== id));
    if (series.id === id) setSeries(SERIES_MAP[windowType]);
  };
  
  const handleHardwareChange = (id: string, field: keyof HardwareItem, value: string | number) => {
    setSeries(prev => ({ ...prev, hardwareItems: prev.hardwareItems.map(item => item.id === id ? { ...item, [field]: value } : item) }));
  };
  const addHardwareItem = () => {
    setSeries(prev => ({ ...prev, hardwareItems: [...prev.hardwareItems, { id: uuidv4(), name: 'New Hardware', qtyPerShutter: 1, rate: 0, unit: 'per_shutter_or_door' }] }));
  };
  const removeHardwareItem = (id: string) => {
    setSeries(prev => ({ ...prev, hardwareItems: prev.hardwareItems.filter(item => item.id !== id) }));
  };

  const toggleDoorPosition = (row: number, col: number) => {
    setDoorPositions(prev => prev.some(p => p.row === row && p.col === col) ? prev.filter(p => p.row !== row || p.col !== col) : [...prev, { row, col }]);
  };

  const handleVentilatorCellClick = (row: number, col: number) => {
    const sequence: VentilatorCellType[] = ['glass', 'louvers', 'door', 'exhaust_fan'];
    setVentilatorGrid(prev => {
        const newGrid = prev.map(r => r.slice());
        const currentType = newGrid[row][col].type;
        const nextType = sequence[(sequence.indexOf(currentType) + 1) % sequence.length];
        newGrid[row][col] = { ...newGrid[row][col], type: nextType };
        if (nextType !== 'door' && newGrid[row][col].handle) delete newGrid[row][col].handle;
        return newGrid;
    });
  };

  const handleSetGridSize = (rows: number, cols: number) => {
      setHorizontalDividers(Array.from({length: rows - 1}).map((_, i) => (i + 1) / rows));
      setVerticalDividers(Array.from({length: cols - 1}).map((_, i) => (i + 1) / cols));
  };

  const handleRemoveVerticalDivider = (index: number) => {
      setVerticalDividers(prev => prev.filter((_, i) => i !== index));
  };
  const handleRemoveHorizontalDivider = (index: number) => {
      setHorizontalDividers(prev => prev.filter((_, i) => i !== index));
  };

  const handleUpdateHandle = (panelId: string, newConfig: HandleConfig | null) => {
    const [type, p1, p2] = panelId.split('-');
    switch (type) {
        case 'sliding': setSlidingHandles(p => { const n = [...p]; n[parseInt(p1)] = newConfig; return n; }); break;
        case 'casement': setDoorPositions(p => p.map(d => (d.row === parseInt(p1) && d.col === parseInt(p2)) ? (newConfig ? {...d, handle: newConfig} : (({handle, ...rest}) => rest)(d)) : d)); break;
        case 'ventilator': setVentilatorGrid(p => { const n = p.map(r=>r.slice()); if(newConfig) n[parseInt(p1)][parseInt(p2)].handle=newConfig; else delete n[parseInt(p1)][parseInt(p2)].handle; return n; }); break;
        case 'partition': setPartitionPanels(p => { const n = [...p.types]; if(newConfig) n[parseInt(p1)].handle=newConfig; else delete n[parseInt(p1)].handle; return {...p, types: n}; }); break;
    }
  };

  const hardwareCostPerWindow = useMemo(() => {
    let numDoorsOrShutters = 0;
    switch(windowType) {
        case WindowType.SLIDING: numDoorsOrShutters = numShutters; break;
        case WindowType.CASEMENT: numDoorsOrShutters = doorPositions.length; break;
        case WindowType.VENTILATOR: numDoorsOrShutters = ventilatorGrid.flat().filter(c => c.type === 'door' || c.type === 'louvers' || c.type === 'exhaust_fan').length; break;
        case WindowType.GLASS_PARTITION: numDoorsOrShutters = partitionPanels.types.filter(t => t.type !== 'fixed').length; break;
    }
    return series.hardwareItems.reduce((total, item) => total + (Number(item.qtyPerShutter) || 0) * (Number(item.rate) || 0) * (item.unit === 'per_shutter_or_door' ? numDoorsOrShutters : 1), 0);
  }, [series.hardwareItems, numShutters, doorPositions.length, ventilatorGrid, windowType, partitionPanels]);

  const windowConfig: WindowConfig = useMemo(() => ({
    width, height, series, fixedPanels, glassType, glassThickness, customGlassThickness, glassSpecialType, customGlassSpecialType, profileColor, glassGrid, windowType,
    trackType, shutterConfig, fixedShutters, slidingHandles, verticalDividers, horizontalDividers, doorPositions, ventilatorGrid, partitionPanels,
  }), [width, height, series, fixedPanels, glassType, glassThickness, customGlassThickness, glassSpecialType, customGlassSpecialType, profileColor, glassGrid, windowType, trackType, shutterConfig, fixedShutters, slidingHandles, verticalDividers, horizontalDividers, doorPositions, ventilatorGrid, partitionPanels]);

  const handleSaveToQuotation = () => {
    const newItem: QuotationItem = {
        id: uuidv4(), title: windowTitle || 'Untitled Window', config: windowConfig, quantity: Number(quantity) || 1, areaType,
        rate: Number(rate) || 0, hardwareCost: hardwareCostPerWindow, hardwareItems: JSON.parse(JSON.stringify(series.hardwareItems)),
        profileColorName: savedColors.find(c => c.hex === windowConfig.profileColor)?.name,
    };
    setQuotationItems(prev => [...prev, newItem]);
    alert(`"${newItem.title}" saved to quotation! You now have ${quotationItems.length + 1} item(s).`);
  }
  
  const handleInstallClick = async () => {
    if (installPrompt) await installPrompt.prompt();
  };

  const panelProps = {
      config: windowConfig,
      setConfig: (field: keyof WindowConfig, value: any) => {
        const setters: Record<keyof WindowConfig, Function> = {
          width: setWidth, height: setHeight, series: setSeries, fixedPanels: setFixedPanels, glassType: setGlassType, glassThickness: setGlassThickness, customGlassThickness: setCustomGlassThickness,
          glassSpecialType: setGlassSpecialType, customGlassSpecialType: setCustomGlassSpecialType, profileColor: setProfileColor, glassGrid: setGlassGrid, windowType: setWindowType, trackType: setTrackType,
          shutterConfig: setShutterConfig, fixedShutters: setFixedShutters, slidingHandles: setSlidingHandles, verticalDividers: setVerticalDividers, horizontalDividers: setHorizontalDividers,
          doorPositions: setDoorPositions, ventilatorGrid: setVentilatorGrid, partitionPanels: setPartitionPanels,
        };
        setters[field]?.(value);
      },
      setGridSize: handleSetGridSize, availableSeries: availableSeries, onSeriesSelect: handleSeriesSelect, onSeriesSave: handleSeriesSave,
      onSeriesDelete: handleSeriesDelete, fixedPanels: fixedPanels, addFixedPanel: addFixedPanel, removeFixedPanel: removeFixedPanel,
      updateFixedPanelSize: updateFixedPanelSize, onHardwareChange: handleHardwareChange, onAddHardware: addHardwareItem, onRemoveHardware: removeHardwareItem,
      toggleDoorPosition: toggleDoorPosition, onVentilatorCellClick: handleVentilatorCellClick, savedColors: savedColors, setSavedColors: setSavedColors, onUpdateHandle: handleUpdateHandle,
  };

  return (
    <>
      <QuotationListModal isOpen={isQuotationModalOpen} onClose={() => setIsQuotationModalOpen(false)} items={quotationItems} onRemove={id => setQuotationItems(p => p.filter(i => i.id !== id))} settings={quotationSettings} setSettings={setQuotationSettings} />
      
      <div className="flex flex-col h-screen font-sans bg-slate-900 overflow-hidden">
        <header className="bg-slate-800 p-3 flex items-center justify-between shadow-md z-40 no-print shrink-0">
            <div className="flex items-center">
                <Logo className="h-10 w-10 mr-4 shrink-0" />
                <div className="hidden sm:block">
                    <h1 className="text-2xl font-bold text-white tracking-wider">WoodenMax</h1>
                    <p className="text-sm text-indigo-300">Reshaping spaces</p>
                </div>
            </div>
            <div className="flex items-center gap-2">
                {installPrompt && ( <Button onClick={handleInstallClick} variant="secondary" className="hidden md:inline-flex"><DownloadIcon className="w-5 h-5 mr-2" /> Add to Home Screen</Button> )}
                {isMobile && (
                    <Button onClick={() => setIsMobilePanelOpen(p => !p)} variant="secondary" className="p-2 h-10 w-10">
                        {isMobilePanelOpen ? <XMarkIcon className="w-6 h-6"/> : <AdjustmentsIcon className="w-6 h-6"/>}
                    </Button>
                )}
            </div>
        </header>

        <div className="flex flex-row flex-grow min-h-0">
            {/* Desktop Panel */}
            <div className={`shrink-0 h-full transition-all duration-300 ease-in-out z-30 bg-slate-800 no-print hidden lg:block ${isDesktopPanelOpen ? 'w-96' : 'w-0'}`}>
                <div className={`h-full overflow-hidden ${isDesktopPanelOpen ? 'w-96' : 'w-0'}`}>
                    <ControlsPanel {...panelProps} onClose={() => setIsDesktopPanelOpen(false)} />
                </div>
            </div>

            <div className="relative flex-1 flex flex-col min-w-0">
                {!isDesktopPanelOpen && !isMobile && (
                  <button onClick={() => setIsDesktopPanelOpen(true)} className="absolute top-1/2 -translate-y-1/2 left-0 bg-slate-700 hover:bg-indigo-600 text-white w-6 h-24 rounded-r-lg z-20 focus:outline-none focus:ring-2 focus:ring-indigo-500 flex items-center justify-center transition-all duration-300 no-print" aria-label="Expand panel">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5 rotate-180"><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" /></svg>
                  </button>
                )}

              <div className={`flex-grow ${isMobile ? 'h-[60%]' : 'h-full'}`}>
                <WindowCanvas config={windowConfig} onRemoveVerticalDivider={handleRemoveVerticalDivider} onRemoveHorizontalDivider={handleRemoveHorizontalDivider} />
              </div>
              
              <div className={`shrink-0 ${isMobile ? 'h-[40%] hidden' : ''}`}>
                 <QuotationPanel width={Number(width)} height={Number(height)} quantity={quantity} setQuantity={setQuantity} areaType={areaType} setAreaType={setAreaType} rate={rate} setRate={setRate} onSave={handleSaveToQuotation} windowTitle={windowTitle} setWindowTitle={setWindowTitle} hardwareCostPerWindow={hardwareCostPerWindow} quotationItemCount={quotationItems.length} onViewQuotation={() => setIsQuotationModalOpen(true)} />
              </div>

              {/* Mobile Panel */}
              {isMobile && isMobilePanelOpen && (
                <div className="absolute bottom-0 left-0 right-0 h-[40%] z-30 bg-slate-800 border-t-2 border-slate-700 shadow-lg no-print">
                   <ControlsPanel {...panelProps} onClose={() => setIsMobilePanelOpen(false)} />
                </div>
              )}
            </div>
        </div>
      </div>
    </>
  );
};

export default App;