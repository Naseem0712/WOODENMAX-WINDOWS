
import React, { useState, useMemo, useRef, useEffect } from 'react';
import type { ProfileSeries, HardwareItem, WindowConfig, GlassSpecialType, SavedColor, VentilatorCellType, PartitionPanelType, HandleConfig, CornerSideConfig, ProfileDimensions, LaminatedGlassConfig, DguGlassConfig, GlassGridConfig } from '../types';
import { FixedPanelPosition, ShutterConfigType, TrackType, WindowType, GlassType } from '../types';
import { Button } from './ui/Button';
import { Input } from './ui/Input';
import { Select } from './ui/Select';
import { PlusIcon } from './icons/PlusIcon';
import { TrashIcon } from './icons/TrashIcon';
import { DimensionInput, type Unit } from './ui/DimensionInput';
import { v4 as uuidv4 } from 'uuid';
import { XMarkIcon } from './icons/XMarkIcon';
import { CollapsibleCard } from './ui/CollapsibleCard';
import { RefreshIcon } from './icons/RefreshIcon';
import { SearchableSelect } from './ui/SearchableSelect';
import { UploadIcon } from './icons/UploadIcon';


interface ControlsPanelProps {
  config: WindowConfig;
  onClose: () => void;
  setConfig: (field: keyof WindowConfig, value: any) => void;
  setSideConfig: (config: Partial<CornerSideConfig>) => void;
  setGridSize: (rows: number, cols: number) => void;
  
  availableSeries: ProfileSeries[];
  onSeriesSelect: (id: string) => void;
  onSeriesSave: (name: string) => void;
  onSeriesDelete: (id: string) => void;

  addFixedPanel: (position: FixedPanelPosition) => void;
  removeFixedPanel: (id: string) => void;
  updateFixedPanelSize: (id: string, size: number) => void;

  onHardwareChange: (id: string, field: keyof HardwareItem, value: string | number) => void;
  onAddHardware: () => void;
  onRemoveHardware: (id: string) => void;
  
  toggleDoorPosition: (row: number, col: number) => void;
  onVentilatorCellClick: (row: number, col: number) => void;

  savedColors: SavedColor[];
  setSavedColors: (colors: SavedColor[]) => void;
  onUpdateHandle: (panelId: string, newConfig: HandleConfig | null) => void;

  onSetPartitionPanelCount: (count: number) => void;
  onCyclePartitionPanelType: (index: number) => void;
  onSetPartitionHasTopChannel: (hasChannel: boolean) => void;
  onCyclePartitionPanelFraming: (index: number) => void;
  onElevationGridChange: (action: 'add' | 'remove' | 'update' | 'update_prop', payload: any) => void;
  onLaminatedConfigChange: (payload: Partial<LaminatedGlassConfig>) => void;
  onDguConfigChange: (payload: Partial<DguGlassConfig>) => void;
  onResetDesign: () => void;

  activeCornerSide: 'left' | 'right';
  setActiveCornerSide: (side: 'left' | 'right') => void;
  idPrefix?: string;
}

function getContrastYIQ(hexcolor: string){
    if (!hexcolor || !hexcolor.startsWith('#')) return 'white';
    hexcolor = hexcolor.replace("#", "");
    if (hexcolor.length !== 6) return 'black';
    const r = parseInt(hexcolor.substr(0,2),16);
    const g = parseInt(hexcolor.substr(2,2),16);
    const b = parseInt(hexcolor.substr(4,2),16);
    const yiq = ((r*299)+(g*587)+(b*114))/1000;
    return (yiq >= 128) ? 'black' : 'white';
}

const Slider: React.FC<React.InputHTMLAttributes<HTMLInputElement> & { label: string, unit?: string }> = ({ id, label, unit, ...props }) => (
    <div className='flex-1'>
        <label htmlFor={id} className="block text-xs font-medium text-slate-300 mb-1">{label} <span className='text-slate-400'>{props.value}{unit}</span></label>
        <input type="range" id={id} name={id} className="w-full h-2 bg-slate-600 rounded-lg appearance-none cursor-pointer accent-indigo-500" {...props} />
    </div>
);

export const ControlsPanel: React.FC<ControlsPanelProps> = React.memo(({ idPrefix = '', ...props }) => {
  const { 
    config, onClose, setConfig, setSideConfig, setGridSize, availableSeries, onSeriesSelect, onSeriesSave, onSeriesDelete,
    addFixedPanel, removeFixedPanel, updateFixedPanelSize,
    onHardwareChange, onAddHardware, onRemoveHardware,
    toggleDoorPosition, onVentilatorCellClick,
    savedColors, setSavedColors, onUpdateHandle,
    onSetPartitionPanelCount, onCyclePartitionPanelType, onSetPartitionHasTopChannel, onCyclePartitionPanelFraming, onElevationGridChange,
    onLaminatedConfigChange, onDguConfigChange,
    onResetDesign,
    activeCornerSide, setActiveCornerSide
  } = props;

  const { windowType, series, fixedPanels, glassGrid } = config;
  const [openCard, setOpenCard] = useState<string | null>('Design Type');
  const [isSavingSeries, setIsSavingSeries] = useState(false);
  const [newSeriesName, setNewSeriesName] = useState('');
  const [isAddingPreset, setIsAddingPreset] = useState(false);
  const [newPreset, setNewPreset] = useState<{name: string, value: string, type: 'color' | 'texture'}>({ name: '', value: '#ffffff', type: 'color' });
  const [selectedPanelId, setSelectedPanelId] = useState<string>('');
  const glassTextureUploadRef = useRef<HTMLInputElement>(null);
  const profileTextureUploadRef = useRef<HTMLInputElement>(null);
  
  const isCorner = windowType === WindowType.CORNER;

  // Georgian Bars Logic
  const [activeGeorgianPanelId, setActiveGeorgianPanelId] = useState('default');
  const [georgianUnit, setGeorgianUnit] = useState<Unit>('mm');

  const availableGeorgianPanels = useMemo(() => {
    const panels: { id: string, name: string }[] = [];
    switch(windowType) {
        case WindowType.SLIDING:
            const numShutters = config.shutterConfig === '2G' ? 2 : config.shutterConfig === '4G' ? 4 : 3;
            for (let i = 0; i < numShutters; i++) panels.push({ id: `sliding-${i}`, name: `Shutter ${i+1}`});
            break;
        case WindowType.CASEMENT:
        case WindowType.VENTILATOR:
            const rows = config.horizontalDividers.length + 1;
            const cols = config.verticalDividers.length + 1;
            for(let r=0; r<rows; r++) {
                for(let c=0; c<cols; c++) {
                    panels.push({ id: `cell-${r}-${c}`, name: `Panel (R${r+1},C${c+1})`});
                }
            }
            break;
        case WindowType.GLASS_PARTITION:
            for(let i=0; i<config.partitionPanels.count; i++) panels.push({ id: `partition-${i}`, name: `Panel ${i+1}`});
            break;
            case WindowType.ELEVATION_GLAZING:
            if (config.elevationGrid) {
                const rows = config.elevationGrid.rowPattern.length;
                const cols = config.elevationGrid.colPattern.length;
                    for(let r=0; r<rows; r++) {
                    for(let c=0; c<cols; c++) {
                        const isDoor = config.elevationGrid.doorPositions.some(p => p.row === r && p.col === c);
                        if (isDoor) {
                            panels.push({ id: `elevation-door-${r}-${c}`, name: `Door (R${r+1},C${c+1})` });
                        } else {
                            panels.push({ id: `elevation-${r}-${c}`, name: `Panel (R${r+1},C${c+1})` });
                        }
                    }
                }
            }
            break;
    }
    config.fixedPanels.forEach(p => panels.push({id: `fixed-${p.position}`, name: `Fixed ${p.position}`}));
    return panels;
  }, [config]);

  useEffect(() => {
    if (!glassGrid.applyToAll && !availableGeorgianPanels.some(p => p.id === activeGeorgianPanelId)) {
        setActiveGeorgianPanelId('default');
    }
  }, [availableGeorgianPanels, activeGeorgianPanelId, glassGrid.applyToAll]);

  const activeGeorgianPattern = glassGrid.patterns[activeGeorgianPanelId] || glassGrid.patterns['default'];
  
  const handleGeorgianPatternChange = (direction: 'horizontal' | 'vertical', field: 'count' | 'offset' | 'gap', value: number) => {
    const newPatterns = { ...glassGrid.patterns };
    const targetId = glassGrid.applyToAll ? 'default' : activeGeorgianPanelId;

    const currentPattern = newPatterns[targetId] || newPatterns['default'];
    
    newPatterns[targetId] = {
        ...currentPattern,
        [direction]: {
            ...currentPattern[direction],
            [field]: value
        }
    };
    setConfig('glassGrid', { ...glassGrid, patterns: newPatterns });
  };

  const handleApplyToAllChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setConfig('glassGrid', { ...glassGrid, applyToAll: e.target.checked });
    if(e.target.checked) setActiveGeorgianPanelId('default');
  }
  // End Georgian Bars Logic

  const handleGlassTextureUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onloadend = () => {
            setConfig('glassTexture', reader.result as string);
        };
        reader.readAsDataURL(file);
    }
  };
  
  const handleProfileTextureUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onloadend = () => {
            setConfig('profileColor', reader.result as string);
        };
        reader.readAsDataURL(file);
    }
  };

  const handleToggleCard = (title: string) => {
    setOpenCard(prev => prev === title ? null : title);
  };

  const displayConfig = useMemo(() => {
    if (isCorner && config.leftConfig && config.rightConfig) {
        const sideConfig = activeCornerSide === 'left' ? config.leftConfig : config.rightConfig;
        return { ...config, ...sideConfig };
    }
    return config;
  }, [config, isCorner, activeCornerSide]);

  const gridRows = displayConfig.horizontalDividers.length + 1;
  const gridCols = displayConfig.verticalDividers.length + 1;
  const activeWindowType = displayConfig.windowType;

  const operablePanels = useMemo(() => {
    const panels: { id: string; label: string }[] = [];
    switch (activeWindowType) {
        case WindowType.SLIDING:
            displayConfig.slidingHandles.forEach((_, i) => { panels.push({ id: `sliding-${i}`, label: `Shutter ${i + 1}` }); });
            break;
        case WindowType.CASEMENT:
            displayConfig.doorPositions.forEach(p => { panels.push({ id: `casement-${p.row}-${p.col}`, label: `Door (R${p.row + 1}, C${p.col + 1})` }); });
            break;
        case WindowType.VENTILATOR:
            displayConfig.ventilatorGrid.forEach((row, r) => { row.forEach((cell, c) => { if (cell.type === 'door') { panels.push({ id: `ventilator-${r}-${c}`, label: `Door (R${r + 1}, C${c + 1})` }); } }); });
            break;
        case WindowType.GLASS_PARTITION:
            config.partitionPanels.types.forEach((p, i) => { if (p.type !== 'fixed') { panels.push({ id: `partition-${i}`, label: `Panel ${i + 1} (${p.type})` }); } });
            break;
        case WindowType.ELEVATION_GLAZING:
            config.elevationGrid?.doorPositions.forEach(p => { panels.push({ id: `elevation-${p.row}-${p.col}`, label: `Door (R${p.row + 1}, C${p.col + 1})` }); });
            break;
    }
    if (selectedPanelId && !panels.some(p => p.id === selectedPanelId)) {
        setSelectedPanelId(panels[0]?.id || '');
    } else if (!selectedPanelId && panels.length > 0) {
        setSelectedPanelId(panels[0].id);
    }
    return panels;
  }, [displayConfig, config, selectedPanelId, activeWindowType]);

  const currentHandle = useMemo((): HandleConfig | null => {
    if (!selectedPanelId) return null;
    const parts = selectedPanelId.split('-');
    const type = parts[0];

    switch (type) {
        case 'sliding': return displayConfig.slidingHandles[parseInt(parts[1], 10)] || null;
        case 'casement': return displayConfig.doorPositions.find(p => p.row === parseInt(parts[1], 10) && p.col === parseInt(parts[2], 10))?.handle || null;
        case 'ventilator': return displayConfig.ventilatorGrid[parseInt(parts[1], 10)]?.[parseInt(parts[2], 10)]?.handle || null;
        case 'partition': return config.partitionPanels.types[parseInt(parts[1], 10)]?.handle || null;
        case 'elevation': return config.elevationGrid?.doorPositions.find(p => p.row === parseInt(parts[1], 10) && p.col === parseInt(parts[2], 10))?.handle || null;
        default: return null;
    }
  }, [selectedPanelId, displayConfig, config]);

  const handleDimensionChange = (key: keyof ProfileSeries['dimensions'], value: number | '') => {
    setConfig('series', { ...series, dimensions: { ...series.dimensions, [key]: value } });
  };

  const handleProfileDetailChange = (field: 'weights' | 'lengths', key: keyof ProfileDimensions, value: number | '') => {
      setConfig('series', { ...series, [field]: { ...(series[field] || {}), [key]: value } });
  };

  const handleFixShutterChange = (index: number, isChecked: boolean) => {
      const newFixedShutters = [...displayConfig.fixedShutters];
      newFixedShutters[index] = isChecked;
      if (isCorner) { setSideConfig({ fixedShutters: newFixedShutters }); } 
      else { setConfig('fixedShutters', newFixedShutters); }
  };
  
  const handleInitiateSave = () => { setNewSeriesName(series.name.includes('Standard') ? '' : series.name); setIsSavingSeries(true); };
  const handleConfirmSave = () => { if (newSeriesName.trim()) { onSeriesSave(newSeriesName.trim()); setIsSavingSeries(false); setNewSeriesName(''); } };
  
  const handleInitiateAddPreset = () => {
    const isTexture = !config.profileColor.startsWith('#');
    setNewPreset({
        name: '',
        value: config.profileColor,
        type: isTexture ? 'texture' : 'color'
    });
    setIsAddingPreset(true);
  };
  const handleAddPreset = () => { if (newPreset.name.trim() && newPreset.value) { setSavedColors([...savedColors, { ...newPreset, id: uuidv4() }]); setNewPreset({ name: '', value: '#ffffff', type: 'color' }); setIsAddingPreset(false); } };
  const handleDeleteColor = (id: string) => { setSavedColors(savedColors.filter(c => c.id !== id)); }

  const isDefaultSeries = series.id.includes('-default');
  
  const seriesOptions = useMemo(() => {
    return availableSeries
      .filter(s => s.type === activeWindowType)
      .map(s => ({ value: s.id, label: s.name }));
  }, [availableSeries, activeWindowType]);

  const getVentilatorCellLabel = (type: VentilatorCellType) => {
    switch(type) {
        case 'glass': return 'Glass'; case 'louvers': return 'Louvers'; case 'door': return 'Door'; case 'exhaust_fan': return 'Ex-Fan';
        default: return 'Fixed';
    }
  };
  
  const isCustomThickness = useMemo(() => {
    return series.glassOptions.customThicknessAllowed && displayConfig.glassThickness !== '' && !series.glassOptions.thicknesses.includes(Number(displayConfig.glassThickness));
  }, [displayConfig.glassThickness, series.glassOptions]);

  const handleThicknessChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value;
    const thickness = value === 'custom' ? 15 : (value === '' ? '' : Number(value));
    setConfig('glassThickness', thickness);
  };
  
  const glassTypeOptions = [
    { value: GlassType.CLEAR, label: "Clear" },
    { value: GlassType.FROSTED, label: "Frosted" },
    { value: GlassType.TINTED_BLUE, label: "Tinted Blue" },
    { value: GlassType.CLEAR_SAPPHIRE, label: "Clear Sapphire" },
    { value: GlassType.BROWN_TINTED, label: "Brown Tinted" },
    { value: GlassType.BLACK_TINTED, label: "Black Tinted" },
  ];

  return (
    <div className="w-full p-4 space-y-4 overflow-y-auto bg-slate-800 h-full custom-scrollbar">
      <div className="flex justify-between items-center pb-2 border-b border-slate-700">
        <h2 className="text-2xl font-bold text-white">Configuration</h2>
        <div className="flex items-center gap-2">
            <button onClick={onResetDesign} className="p-2 rounded-full hover:bg-slate-700 text-slate-400 hover:text-white" aria-label="Reset design" title="Reset Design"> <RefreshIcon className="w-6 h-6" /> </button>
            <button onClick={onClose} className="p-2 rounded-full hover:bg-slate-700 text-slate-400 hover:text-white" aria-label="Close panel"> <XMarkIcon className="w-6 h-6" /> </button>
        </div>
      </div>

      <CollapsibleCard title="Design Type" isOpen={openCard === 'Design Type'} onToggle={() => handleToggleCard('Design Type')}>
          <div className="grid grid-cols-3 bg-slate-700 rounded-md p-1 gap-1">
              {[WindowType.SLIDING, WindowType.CASEMENT, WindowType.VENTILATOR, WindowType.GLASS_PARTITION, WindowType.ELEVATION_GLAZING, WindowType.CORNER].map(type => {
                  const typeLabel = type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
                  const isActive = (isCorner && type === WindowType.CORNER) || (!isCorner && windowType === type);
                  return <button key={type} onClick={() => setConfig('windowType', type)} className={`p-2 text-xs font-semibold rounded capitalize ${isActive ? 'bg-indigo-600 text-white' : 'text-slate-300 hover:bg-slate-600'}`}>{typeLabel}</button>
              })}
          </div>
      </CollapsibleCard>
      
      <CollapsibleCard title="Overall Dimensions" isOpen={openCard === 'Overall Dimensions'} onToggle={() => handleToggleCard('Overall Dimensions')}>
        {isCorner ? (
            <>
                <div className="grid grid-cols-2 gap-4">
                    <DimensionInput id={`${idPrefix}left-width`} name="left-width" label="Left Wall Width" value_mm={config.leftWidth} onChange_mm={v => setConfig('leftWidth', v)} placeholder="e.g., 1200" />
                    <DimensionInput id={`${idPrefix}right-width`} name="right-width" label="Right Wall Width" value_mm={config.rightWidth} onChange_mm={v => setConfig('rightWidth', v)} placeholder="e.g., 1200" />
                </div>
                 <DimensionInput id={`${idPrefix}corner-post-width`} name="corner-post-width" label="Corner Post Width" value_mm={config.cornerPostWidth} onChange_mm={v => setConfig('cornerPostWidth', v)} placeholder="e.g., 100" />
            </>
        ) : (
            <DimensionInput id={`${idPrefix}total-width`} name="total-width" label="Total Width" value_mm={config.width} onChange_mm={v => setConfig('width', v)} placeholder="e.g., 1800" />
        )}
        <DimensionInput id={`${idPrefix}total-height`} name="total-height" label="Total Height" value_mm={config.height} onChange_mm={v => setConfig('height', v)} placeholder="e.g., 1200" />
      </CollapsibleCard>
      
      {isCorner && (
         <CollapsibleCard title="Corner Window Setup" isOpen={openCard === 'Corner Window Setup'} onToggle={() => handleToggleCard('Corner Window Setup')}>
            <div className="mb-4 grid grid-cols-2 bg-slate-700 rounded-md p-1 gap-1">
                <button onClick={() => setActiveCornerSide('left')} className={`p-2 text-sm font-semibold rounded ${activeCornerSide === 'left' ? 'bg-indigo-600 text-white' : 'text-slate-300 hover:bg-slate-600'}`}>Left Wall</button>
                <button onClick={() => setActiveCornerSide('right')} className={`p-2 text-sm font-semibold rounded ${activeCornerSide === 'right' ? 'bg-indigo-600 text-white' : 'text-slate-300 hover:bg-slate-600'}`}>Right Wall</button>
            </div>
            <Select id={`${idPrefix}corner-side-type`} name="corner-side-type" label={`${activeCornerSide === 'left' ? 'Left' : 'Right'} Wall Type`} value={displayConfig.windowType} onChange={(e) => setSideConfig({ windowType: e.target.value as CornerSideConfig['windowType'] })}>
              <option value={WindowType.SLIDING}>Sliding</option>
              <option value={WindowType.CASEMENT}>Casement / Fixed</option>
              <option value={WindowType.VENTILATOR}>Ventilator</option>
            </Select>
         </CollapsibleCard>
      )}

      {activeWindowType === WindowType.ELEVATION_GLAZING && config.elevationGrid && (
        <CollapsibleCard title="Elevation Grid Pattern" isOpen={openCard === 'Elevation Grid Pattern'} onToggle={() => handleToggleCard('Elevation Grid Pattern')}>
           <p className="text-xs text-slate-400 mb-4">Click on a glass panel in the canvas to turn it into an operable door.</p>
          <div className="grid grid-cols-2 gap-4">
              <DimensionInput id={`${idPrefix}elevation-v-mullion`} name="elevation-v-mullion" label="Vertical Mullion Size" value_mm={config.elevationGrid.verticalMullionSize} onChange_mm={v => onElevationGridChange('update_prop', { prop: 'verticalMullionSize', value: v })} />
              <DimensionInput id={`${idPrefix}elevation-h-transom`} name="elevation-h-transom" label="Horizontal Transom Size" value_mm={config.elevationGrid.horizontalTransomSize} onChange_mm={v => onElevationGridChange('update_prop', { prop: 'horizontalTransomSize', value: v })} />
          </div>
          <DimensionInput id={`${idPrefix}elevation-pressure-plate`} name="elevation-pressure-plate" label="Pressure/Cover Plate Size" value_mm={config.elevationGrid.pressurePlateSize} onChange_mm={v => onElevationGridChange('update_prop', { prop: 'pressurePlateSize', value: v })} />
          <div className="mt-4 pt-4 border-t border-slate-700">
             <DimensionInput 
                id={`${idPrefix}elevation-floor-height`}
                name="elevation-floor-height"
                label="Floor to Floor Height (Optional)" 
                value_mm={config.elevationGrid.floorHeight} 
                onChange_mm={v => onElevationGridChange('update_prop', { prop: 'floorHeight', value: v })} 
                placeholder="For vertical profile calc."
            />
          </div>
          <div className="mt-4 pt-4 border-t border-slate-700">
              <h4 className="text-base font-semibold text-slate-200 mb-2">Vertical Pattern (Columns)</h4>
              <div className="space-y-2">
                  {config.elevationGrid.colPattern.map((width, index) => (
                      <div key={index} className="flex items-end gap-2">
                          <DimensionInput id={`${idPrefix}elevation-col-${index}`} name={`elevation-col-${index}`} label={`Width ${index + 1}`} value_mm={width} onChange_mm={v => onElevationGridChange('update', { patternType: 'col', index, value: v })} className="flex-grow" />
                          <Button variant="danger" onClick={() => onElevationGridChange('remove', { patternType: 'col', index })} className="p-2 h-10 w-10 flex-shrink-0"><TrashIcon className="w-5 h-5"/></Button>
                      </div>
                  ))}
              </div>
              <Button variant="secondary" className="w-full mt-2" onClick={() => onElevationGridChange('add', { patternType: 'col' })}><PlusIcon className="w-4 h-4 mr-2" /> Add Column Width</Button>
          </div>
           <div className="mt-4 pt-4 border-t border-slate-700">
              <h4 className="text-base font-semibold text-slate-200 mb-2">Horizontal Pattern (Rows)</h4>
              <div className="space-y-2">
                  {config.elevationGrid.rowPattern.map((height, index) => (
                       <div key={index} className="flex items-end gap-2">
                          <DimensionInput id={`${idPrefix}elevation-row-${index}`} name={`elevation-row-${index}`} label={`Height ${index + 1}`} value_mm={height} onChange_mm={v => onElevationGridChange('update', { patternType: 'row', index, value: v })} className="flex-grow" />
                          <Button variant="danger" onClick={() => onElevationGridChange('remove', { patternType: 'row', index })} className="p-2 h-10 w-10 flex-shrink-0"><TrashIcon className="w-5 h-5"/></Button>
                      </div>
                  ))}
              </div>
              <Button variant="secondary" className="w-full mt-2" onClick={() => onElevationGridChange('add', { patternType: 'row' })}><PlusIcon className="w-4 h-4 mr-2" /> Add Row Height</Button>
          </div>
        </CollapsibleCard>
      )}

      {activeWindowType === WindowType.SLIDING && (
        <CollapsibleCard title="Track & Shutter Setup" isOpen={openCard === 'Track & Shutter Setup'} onToggle={() => handleToggleCard('Track & Shutter Setup')}>
            <Select id={`${idPrefix}track-type`} name="track-type" label="Track Type" value={displayConfig.trackType} onChange={(e) => isCorner ? setSideConfig({trackType: parseInt(e.target.value)}) : setConfig('trackType', parseInt(e.target.value) as TrackType)}>
                <option value={TrackType.TWO_TRACK}>2-Track</option>
                <option value={TrackType.THREE_TRACK}>3-Track</option>
            </Select>
            <Select id={`${idPrefix}shutter-config`} name="shutter-config" label="Shutter Configuration" value={displayConfig.shutterConfig} onChange={(e) => isCorner ? setSideConfig({shutterConfig: e.target.value as ShutterConfigType}) : setConfig('shutterConfig', e.target.value as ShutterConfigType)}>
                {displayConfig.trackType === TrackType.TWO_TRACK && <><option value="2G">2 Glass Shutters</option><option value="4G">4 Glass Shutters</option></>}
                {displayConfig.trackType === TrackType.THREE_TRACK && <><option value="3G">3 Glass Shutters</option><option value="2G1M">2 Glass + 1 Mesh Shutter</option></>}
            </Select>
            {displayConfig.fixedShutters.length > 0 && (
              <div className="pt-2">
                <label className="block text-sm font-medium text-slate-300 mb-2">Shutter Fixing</label>
                <div className="grid grid-cols-2 gap-2">
                    {displayConfig.fixedShutters.map((_, i) => (
                        <label key={i} className="flex items-center space-x-2 p-2 bg-slate-700 rounded-md cursor-pointer hover:bg-slate-600">
                            <input type="checkbox" id={`${idPrefix}fix-shutter-${i}`} name={`fix-shutter-${i}`} checked={displayConfig.fixedShutters[i] || false} onChange={e => handleFixShutterChange(i, e.target.checked)} className="w-4 h-4 rounded bg-slate-800 border-slate-500 text-indigo-600 focus:ring-indigo-500"/>
                            <span className="text-sm text-slate-200">Fix Shutter {i + 1}</span>
                        </label>
                    ))}
                </div>
              </div>
            )}
        </CollapsibleCard>
      )}

      {(activeWindowType === WindowType.CASEMENT || activeWindowType === WindowType.VENTILATOR) && (
          <CollapsibleCard title="Grid Layout" isOpen={openCard === 'Grid Layout'} onToggle={() => handleToggleCard('Grid Layout')}>
              <div className="grid grid-cols-2 gap-4">
                  <Input id={`${idPrefix}grid-rows`} name="grid-rows" label="Rows" type="number" inputMode="numeric" value={gridRows} min={1} onChange={e => setGridSize(Math.max(1, parseInt(e.target.value) || 1), gridCols)} />
                  <Input id={`${idPrefix}grid-cols`} name="grid-cols" label="Columns" type="number" inputMode="numeric" value={gridCols} min={1} onChange={e => setGridSize(gridRows, Math.max(1, parseInt(e.target.value) || 1))} />
              </div>
              <div className="mt-4">
                  <label className="block text-sm font-medium text-slate-300 mb-2">Panel Configuration (Click to toggle)</label>
                  <p className="text-xs text-slate-400 mb-2">You can also click grid lines on the canvas to merge panels.</p>
                  <div className="bg-slate-900 p-2 rounded-md max-h-64 overflow-auto custom-scrollbar">
                    <div className="grid gap-1" style={{gridTemplateRows: `repeat(${gridRows}, 1fr)`, gridTemplateColumns: `repeat(${gridCols}, 1fr)`}}>
                        {Array.from({length: gridRows * gridCols}).map((_, index) => {
                            const row = Math.floor(index / gridCols);
                            const col = index % gridCols;
                            if (activeWindowType === WindowType.CASEMENT) {
                                const isDoor = displayConfig.doorPositions.some(p => p.row === row && p.col === col);
                                return ( <button key={`${row}-${col}`} onClick={() => toggleDoorPosition(row, col)} className={`aspect-square rounded text-xs font-semibold flex items-center justify-center ${isDoor ? 'bg-indigo-500 text-white' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'}`}>{isDoor ? 'Door' : 'Fixed'}</button> );
                            }
                            if (activeWindowType === WindowType.VENTILATOR) {
                                const cell = displayConfig.ventilatorGrid[row]?.[col];
                                const cellType = cell?.type || 'glass';
                                const colorClass = cellType === 'door' ? 'bg-indigo-500 text-white' : cellType === 'louvers' ? 'bg-sky-600 text-white' : cellType === 'exhaust_fan' ? 'bg-teal-600 text-white' : 'bg-slate-700 text-slate-300 hover:bg-slate-600';
                                return ( <button key={`${row}-${col}`} onClick={() => onVentilatorCellClick(row, col)} className={`aspect-square rounded text-xs font-semibold flex items-center justify-center ${colorClass}`}>{getVentilatorCellLabel(cellType)}</button> );
                            }
                            return null;
                        })}
                    </div>
                  </div>
              </div>
          </CollapsibleCard>
      )}

      {windowType === WindowType.GLASS_PARTITION && (
        <CollapsibleCard title="Partition Panel Setup" isOpen={openCard === 'Partition Panel Setup'} onToggle={() => handleToggleCard('Partition Panel Setup')}>
          <Input id={`${idPrefix}partition-count`} name="partition-count" label="Number of Panels" type="number" inputMode="numeric" min={1} max={8} value={config.partitionPanels.count} onChange={e => onSetPartitionPanelCount(Math.max(1, parseInt(e.target.value) || 1))}/>
           <label className="flex items-center space-x-2 cursor-pointer mt-2">
              <input type="checkbox" id={`${idPrefix}partition-has-top-channel`} name="partition-has-top-channel" checked={config.partitionPanels.hasTopChannel} onChange={e => onSetPartitionHasTopChannel(e.target.checked)} className="w-4 h-4 rounded bg-slate-800 border-slate-500 text-indigo-600 focus:ring-indigo-500" />
              <span className="text-sm text-slate-200">Enable Top/Bottom Channel</span>
          </label>
          {config.partitionPanels.count > 0 && (
            <div className="pt-2">
              <label className="block text-sm font-medium text-slate-300 mb-2">Panel Types (Click to change)</label>
              <div className="grid grid-cols-1 gap-2">
                  {Array.from({length: config.partitionPanels.count}).map((_, i) => {
                      const panelConfig = config.partitionPanels.types[i] || { type: 'fixed' };
                      const {type, framing = 'none'} = panelConfig;
                      const typeColorClass = type === 'sliding' ? 'bg-sky-600 hover:bg-sky-700' : type === 'hinged' ? 'bg-indigo-600 hover:bg-indigo-700' : 'bg-slate-700 hover:bg-slate-600';
                      const frameColorClass = framing === 'full' ? 'bg-amber-600 hover:bg-amber-700' : 'bg-slate-700 hover:bg-slate-600';
                      return (
                        <div key={i} className="grid grid-cols-3 gap-1 text-white text-sm font-semibold">
                            <div className="p-2 rounded-l-md bg-slate-800 col-span-1 flex items-center justify-center">Panel {i + 1}</div>
                            <button onClick={() => onCyclePartitionPanelType(i)} className={`p-2 capitalize ${typeColorClass} transition-colors`}>{type}</button>
                            <button onClick={() => onCyclePartitionPanelFraming(i)} disabled={type === 'hinged'} className={`p-2 rounded-r-md capitalize ${frameColorClass} transition-colors ${type === 'hinged' ? 'opacity-50 cursor-not-allowed' : ''}`}>{type === 'hinged' ? 'Framed' : (framing === 'full' ? 'Framed' : 'Frameless')}</button>
                        </div>
                      )
                  })}
              </div>
            </div>
          )}
        </CollapsibleCard>
      )}

      {operablePanels.length > 0 && (
          <CollapsibleCard title="Handle Configuration" isOpen={openCard === 'Handle Configuration'} onToggle={() => handleToggleCard('Handle Configuration')}>
              <Select id={`${idPrefix}handle-panel-select`} name="handle-panel-select" label="Select Panel" value={selectedPanelId} onChange={e => setSelectedPanelId(e.target.value)}>
                {operablePanels.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}
              </Select>
              {selectedPanelId && (
                  <div className="p-2 bg-slate-700 rounded-md space-y-3">
                      <label className="flex items-center space-x-2 cursor-pointer">
                          <input type="checkbox" id={`${idPrefix}handle-enable`} name="handle-enable" checked={!!currentHandle} onChange={e => onUpdateHandle(selectedPanelId, e.target.checked ? { x: 50, y: 50, orientation: 'vertical' } : null)} className="w-4 h-4 rounded bg-slate-800 border-slate-500 text-indigo-600 focus:ring-indigo-500" />
                          <span className="text-sm text-slate-200">Enable Handle</span>
                      </label>
                      {currentHandle && (
                          <div className="space-y-3">
                              <Slider id={`${idPrefix}handle-pos-x`} name="handle-pos-x" label={`Horizontal Position: ${currentHandle.x}%`} value={currentHandle.x} onChange={e => onUpdateHandle(selectedPanelId, {...currentHandle, x: parseInt(e.target.value)})}/>
                              <Slider id={`${idPrefix}handle-pos-y`} name="handle-pos-y" label={`Vertical Position: ${currentHandle.y}%`} value={currentHandle.y} onChange={e => onUpdateHandle(selectedPanelId, {...currentHandle, y: parseInt(e.target.value)})}/>
                               <div className="grid grid-cols-2 gap-2">
                                <Button variant={currentHandle.orientation === 'vertical' ? 'primary' : 'secondary'} onClick={() => onUpdateHandle(selectedPanelId, {...currentHandle, orientation: 'vertical'})}>Vertical</Button>
                                <Button variant={currentHandle.orientation === 'horizontal' ? 'primary' : 'secondary'} onClick={() => onUpdateHandle(selectedPanelId, {...currentHandle, orientation: 'horizontal'})}>Horizontal</Button>
                              </div>
                          </div>
                      )}
                  </div>
              )}
          </CollapsibleCard>
      )}

      <CollapsibleCard title="Appearance" isOpen={openCard === 'Appearance'} onToggle={() => handleToggleCard('Appearance')}>
        <div className="grid grid-cols-2 gap-4">
            <Select id={`${idPrefix}appearance-glass-tint`} name="appearance-glass-tint" label="Glass Tint" value={config.glassType} onChange={(e) => setConfig('glassType', e.target.value as GlassType)}>
              {glassTypeOptions.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
            </Select>
            <Select id={`${idPrefix}appearance-special-type`} name="appearance-special-type" label="Special Type" value={config.glassSpecialType} onChange={e => setConfig('glassSpecialType', e.target.value as GlassSpecialType)}>
                <option value="none">None</option>
                {series.glassOptions.specialTypes.map(t => <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>)}
            </Select>
        </div>
        {config.glassSpecialType === 'laminated' && config.laminatedGlassConfig && (
            <div className="p-3 bg-slate-900/50 rounded-md mt-4 space-y-3">
                <h4 className="text-base font-semibold text-slate-200">Laminated Glass Details</h4>
                <div className="grid grid-cols-2 gap-x-4 gap-y-3">
                    <Input id={`${idPrefix}laminated-g1-thickness`} name="laminated-g1-thickness" label="Glass 1 Thickness" type="number" inputMode="decimal" value={config.laminatedGlassConfig.glass1Thickness} onChange={e => onLaminatedConfigChange({ glass1Thickness: e.target.value === '' ? '' : Number(e.target.value) })} unit="mm" />
                    <Select id={`${idPrefix}laminated-g1-type`} name="laminated-g1-type" label="Glass 1 Type" value={config.laminatedGlassConfig.glass1Type} onChange={e => onLaminatedConfigChange({ glass1Type: e.target.value as GlassType })}>
                        {glassTypeOptions.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                    </Select>
                    <Input id={`${idPrefix}laminated-pvb-thickness`} name="laminated-pvb-thickness" label="PVB Thickness" type="number" inputMode="decimal" value={config.laminatedGlassConfig.pvbThickness} onChange={e => onLaminatedConfigChange({ pvbThickness: e.target.value === '' ? '' : Number(e.target.value) })} unit="mm" />
                    <Select id={`${idPrefix}laminated-pvb-type`} name="laminated-pvb-type" label="PVB Type" value={config.laminatedGlassConfig.pvbType} onChange={e => onLaminatedConfigChange({ pvbType: e.target.value as LaminatedGlassConfig['pvbType'] })}>
                        <option value="clear">Clear</option>
                        <option value="milky_white">Milky White</option>
                    </Select>
                    <Input id={`${idPrefix}laminated-g2-thickness`} name="laminated-g2-thickness" label="Glass 2 Thickness" type="number" inputMode="decimal" value={config.laminatedGlassConfig.glass2Thickness} onChange={e => onLaminatedConfigChange({ glass2Thickness: e.target.value === '' ? '' : Number(e.target.value) })} unit="mm" />
                    <Select id={`${idPrefix}laminated-g2-type`} name="laminated-g2-type" label="Glass 2 Type" value={config.laminatedGlassConfig.glass2Type} onChange={e => onLaminatedConfigChange({ glass2Type: e.target.value as GlassType })}>
                        {glassTypeOptions.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                    </Select>
                </div>
                <label className="flex items-center space-x-2 cursor-pointer pt-2">
                    <input type="checkbox" id={`${idPrefix}laminated-is-toughened`} name="laminated-is-toughened" checked={config.laminatedGlassConfig.isToughened} onChange={e => onLaminatedConfigChange({ isToughened: e.target.checked })} className="w-4 h-4 rounded bg-slate-800 border-slate-500 text-indigo-600 focus:ring-indigo-500"/>
                    <span className="text-sm text-slate-200">Toughened / Tempered Glass</span>
                </label>
            </div>
        )}
        {config.glassSpecialType === 'dgu' && config.dguGlassConfig && (
            <div className="p-3 bg-slate-900/50 rounded-md mt-4 space-y-3">
                <h4 className="text-base font-semibold text-slate-200">DGU Glass Details</h4>
                <div className="grid grid-cols-2 gap-x-4 gap-y-3">
                    <Input id={`${idPrefix}dgu-g1-thickness`} name="dgu-g1-thickness" label="Glass 1 Thickness" type="number" inputMode="decimal" value={config.dguGlassConfig.glass1Thickness} onChange={e => onDguConfigChange({ glass1Thickness: e.target.value === '' ? '' : Number(e.target.value) })} unit="mm" />
                    <Select id={`${idPrefix}dgu-g1-type`} name="dgu-g1-type" label="Glass 1 Type" value={config.dguGlassConfig.glass1Type} onChange={e => onDguConfigChange({ glass1Type: e.target.value as GlassType })}>
                        {glassTypeOptions.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                    </Select>
                    <Input id={`${idPrefix}dgu-air-gap`} name="dgu-air-gap" label="Air Gap" type="number" inputMode="decimal" value={config.dguGlassConfig.airGap} onChange={e => onDguConfigChange({ airGap: e.target.value === '' ? '' : Number(e.target.value) })} unit="mm" />
                    <div />
                    <Input id={`${idPrefix}dgu-g2-thickness`} name="dgu-g2-thickness" label="Glass 2 Thickness" type="number" inputMode="decimal" value={config.dguGlassConfig.glass2Thickness} onChange={e => onDguConfigChange({ glass2Thickness: e.target.value === '' ? '' : Number(e.target.value) })} unit="mm" />
                    <Select id={`${idPrefix}dgu-g2-type`} name="dgu-g2-type" label="Glass 2 Type" value={config.dguGlassConfig.glass2Type} onChange={e => onDguConfigChange({ glass2Type: e.target.value as GlassType })}>
                        {glassTypeOptions.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                    </Select>
                </div>
                <label className="flex items-center space-x-2 cursor-pointer pt-2">
                    <input type="checkbox" id={`${idPrefix}dgu-is-toughened`} name="dgu-is-toughened" checked={config.dguGlassConfig.isToughened} onChange={e => onDguConfigChange({ isToughened: e.target.checked })} className="w-4 h-4 rounded bg-slate-800 border-slate-500 text-indigo-600 focus:ring-indigo-500"/>
                    <span className="text-sm text-slate-200">Toughened / Tempered Glass</span>
                </label>
            </div>
        )}
        <div className="grid grid-cols-2 gap-4 mt-4">
            <Select id={`${idPrefix}appearance-glass-thickness`} name="appearance-glass-thickness" label="Glass Thickness" value={isCustomThickness ? 'custom' : config.glassThickness} onChange={handleThicknessChange}>
                <option value="">Default</option>
                {series.glassOptions.thicknesses.map(t => <option key={t} value={t}>{t} mm</option>)}
                {series.glassOptions.customThicknessAllowed && <option value="custom">Custom...</option>}
            </Select>
            {isCustomThickness && <Input id={`${idPrefix}appearance-glass-thickness-custom`} name="appearance-glass-thickness-custom" label="Custom Thickness" type="number" inputMode="decimal" value={config.glassThickness} onChange={e => setConfig('glassThickness', e.target.value === '' ? '' : Number(e.target.value))} unit="mm" />}
        </div>
        {isCustomThickness && <Input id={`${idPrefix}custom-glass-name`} name="custom-glass-name" label="Custom Glass Name (Optional)" type="text" placeholder="e.g., Saint-Gobain Sun Ban" value={config.customGlassName} onChange={e => setConfig('customGlassName', e.target.value)} />}
        <div className='mt-4 pt-4 border-t border-slate-700'>
             <h4 className="text-base font-semibold text-slate-200 mb-2">Glass Texture</h4>
             <Button variant="secondary" className="w-full" onClick={() => glassTextureUploadRef.current?.click()}> <UploadIcon className="w-4 h-4 mr-2" /> Upload Texture </Button>
             <input type="file" ref={glassTextureUploadRef} onChange={handleGlassTextureUpload} className="hidden" accept="image/*" />
             {config.glassTexture && <Button variant="danger" className="w-full mt-2" onClick={() => setConfig('glassTexture', '')}> Remove Texture </Button>}
        </div>
        <div className='mt-4 pt-4 border-t border-slate-700'>
            <h4 className="text-base font-semibold text-slate-200 mb-2">Profile Color / Texture</h4>
            <div className="flex flex-wrap gap-2">
                {savedColors.map(color => (
                    <button key={color.id} onClick={() => setConfig('profileColor', color.value)} onContextMenu={(e) => { e.preventDefault(); if (window.confirm(`Delete color "${color.name}"?`)) { handleDeleteColor(color.id); } }} className="relative group w-12 h-12 rounded-md border-2" style={{ borderColor: config.profileColor === color.value ? '#4f46e5' : 'transparent', background: color.type === 'color' ? color.value : `url(${color.value})`, backgroundSize: 'cover' }}>
                        <span className="absolute -top-6 left-1/2 -translate-x-1/2 bg-slate-900 text-white text-xs px-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">{color.name}</span>
                    </button>
                ))}
                <button onClick={handleInitiateAddPreset} className="w-12 h-12 rounded-md border-2 border-dashed border-slate-500 flex items-center justify-center hover:bg-slate-600"> <PlusIcon className="w-6 h-6 text-slate-400" /> </button>
            </div>
             {isAddingPreset && (
              <div className="mt-2 p-3 bg-slate-600 rounded-md space-y-2">
                  <Input id={`${idPrefix}new-preset-name`} name="new-preset-name" label="Preset Name" value={newPreset.name} onChange={e => setNewPreset({...newPreset, name: e.target.value})}/>
                  <div className='flex gap-2 items-end'>
                    <Input id={`${idPrefix}new-preset-value`} name="new-preset-value" label="Color Value" type="color" value={newPreset.value} onChange={e => setNewPreset({...newPreset, value: e.target.value, type: 'color'})} className='p-1 h-10'/>
                    <Button variant="secondary" className="h-10" onClick={() => profileTextureUploadRef.current?.click()}><UploadIcon className='w-4 h-4'/></Button>
                    <input type="file" ref={profileTextureUploadRef} onChange={e => { const file = e.target.files?.[0]; if (file) { const reader = new FileReader(); reader.onloadend = () => setNewPreset({...newPreset, value: reader.result as string, type: 'texture'}); reader.readAsDataURL(file); } }} className="hidden" accept="image/*" />
                  </div>
                  <div className="flex gap-2"> <Button onClick={handleAddPreset} className="flex-grow">Save</Button> <Button variant="secondary" onClick={() => setIsAddingPreset(false)} className="flex-grow">Cancel</Button> </div>
              </div>
            )}
        </div>
      </CollapsibleCard>

      <CollapsibleCard title="Georgian Bars" isOpen={openCard === 'Georgian Bars'} onToggle={() => handleToggleCard('Georgian Bars')}>
        <div className="grid grid-cols-2 gap-4">
            <DimensionInput id={`${idPrefix}georgian-bar-thickness`} name="georgian-bar-thickness" label="Bar Thickness" value_mm={glassGrid.barThickness} onChange_mm={v => setConfig('glassGrid', {...glassGrid, barThickness: v === '' ? 0 : v})} controlledUnit={georgianUnit} />
            <Select id={`${idPrefix}georgian-unit-select`} label="Unit" value={georgianUnit} onChange={e => setGeorgianUnit(e.target.value as Unit)}>
                <option value="mm">mm</option>
                <option value="cm">cm</option>
                <option value="in">in</option>
                <option value="ft-in">ft-in</option>
            </Select>
        </div>
        <label className="flex items-center space-x-2 cursor-pointer mt-4">
              <input type="checkbox" id={`${idPrefix}georgian-apply-all`} name="georgian-apply-all" checked={glassGrid.applyToAll} onChange={handleApplyToAllChange} className="w-4 h-4 rounded bg-slate-800 border-slate-500 text-indigo-600 focus:ring-indigo-500" />
              <span className="text-sm text-slate-200">Apply to all panels</span>
        </label>
        {!glassGrid.applyToAll && availableGeorgianPanels.length > 0 && (
          <Select id={`${idPrefix}georgian-panel-select`} name="georgian-panel-select" label="Target Panel" value={activeGeorgianPanelId} onChange={e => setActiveGeorgianPanelId(e.target.value)}>
             <option value="default">Default Pattern</option>
             {availableGeorgianPanels.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </Select>
        )}
        <div className="mt-4 pt-4 border-t border-slate-700 space-y-4">
            <div>
                <h4 className="text-base font-semibold text-slate-200 mb-2">Horizontal Bars</h4>
                <div className="grid grid-cols-3 gap-2">
                    <Input id={`${idPrefix}georgian-h-count`} name="georgian-h-count" label="Count" type="number" value={activeGeorgianPattern.horizontal.count} onChange={e => handleGeorgianPatternChange('horizontal', 'count', parseInt(e.target.value) || 0)} />
                    <DimensionInput id={`${idPrefix}georgian-h-offset`} name="georgian-h-offset" label="Offset" value_mm={activeGeorgianPattern.horizontal.offset} onChange_mm={v => handleGeorgianPatternChange('horizontal', 'offset', v === '' ? 0 : v)} controlledUnit={georgianUnit} />
                    <DimensionInput id={`${idPrefix}georgian-h-gap`} name="georgian-h-gap" label="Gap" value_mm={activeGeorgianPattern.horizontal.gap} onChange_mm={v => handleGeorgianPatternChange('horizontal', 'gap', v === '' ? 0 : v)} controlledUnit={georgianUnit} />
                </div>
            </div>
             <div>
                <h4 className="text-base font-semibold text-slate-200 mb-2">Vertical Bars</h4>
                <div className="grid grid-cols-3 gap-2">
                    <Input id={`${idPrefix}georgian-v-count`} name="georgian-v-count" label="Count" type="number" value={activeGeorgianPattern.vertical.count} onChange={e => handleGeorgianPatternChange('vertical', 'count', parseInt(e.target.value) || 0)} />
                    <DimensionInput id={`${idPrefix}georgian-v-offset`} name="georgian-v-offset" label="Offset" value_mm={activeGeorgianPattern.vertical.offset} onChange_mm={v => handleGeorgianPatternChange('vertical', 'offset', v === '' ? 0 : v)} controlledUnit={georgianUnit} />
                    <DimensionInput id={`${idPrefix}georgian-v-gap`} name="georgian-v-gap" label="Gap" value_mm={activeGeorgianPattern.vertical.gap} onChange_mm={v => handleGeorgianPatternChange('vertical', 'gap', v === '' ? 0 : v)} controlledUnit={georgianUnit} />
                </div>
            </div>
        </div>
      </CollapsibleCard>
      
      {windowType !== WindowType.GLASS_PARTITION && windowType !== WindowType.ELEVATION_GLAZING && (
          <CollapsibleCard title="Fixed Panels" isOpen={openCard === 'Fixed Panels'} onToggle={() => handleToggleCard('Fixed Panels')}>
          <div className="grid grid-cols-2 gap-2">
              <Button variant="secondary" onClick={() => addFixedPanel(FixedPanelPosition.TOP)}><PlusIcon className="w-4 h-4 mr-2"/> Top</Button>
              <Button variant="secondary" onClick={() => addFixedPanel(FixedPanelPosition.BOTTOM)}><PlusIcon className="w-4 h-4 mr-2"/> Bottom</Button>
              <Button variant="secondary" onClick={() => addFixedPanel(FixedPanelPosition.LEFT)}><PlusIcon className="w-4 h-4 mr-2"/> Left</Button>
              <Button variant="secondary" onClick={() => addFixedPanel(FixedPanelPosition.RIGHT)}><PlusIcon className="w-4 h-4 mr-2"/> Right</Button>
          </div>
          {fixedPanels.length > 0 && (
            <div className="mt-4 pt-4 border-t border-slate-700 space-y-2">
              {fixedPanels.map(panel => (
                <div key={panel.id} className="flex items-end gap-2">
                  <DimensionInput id={`${idPrefix}fixed-panel-${panel.id}`} name={`fixed-panel-${panel.id}`} label={`Fixed Panel ${panel.position}`} value_mm={panel.size} onChange_mm={v => updateFixedPanelSize(panel.id, v === '' ? 0 : v)} />
                  <Button variant="danger" onClick={() => removeFixedPanel(panel.id)} className="p-2 h-10 w-10 flex-shrink-0"><TrashIcon className="w-5 h-5"/></Button>
                </div>
              ))}
            </div>
          )}
        </CollapsibleCard>
      )}

      <CollapsibleCard title="Profile Series" isOpen={openCard === 'Profile Series'} onToggle={() => handleToggleCard('Profile Series')}>
        <SearchableSelect id={`${idPrefix}series-select`} label="Select Series" options={seriesOptions} value={series.id} onChange={onSeriesSelect} />
        <div className="flex gap-2 mt-2">
            <Button variant="secondary" className="w-full" onClick={handleInitiateSave}>Save as New...</Button>
            {!isDefaultSeries && <Button variant="danger" className="w-full" onClick={() => onSeriesDelete(series.id)}>Delete</Button>}
        </div>
        {isSavingSeries && (
          <div className="mt-2 p-3 bg-slate-600 rounded-md space-y-2">
            <Input id={`${idPrefix}new-series-name`} name="new-series-name" label="New Series Name" value={newSeriesName} onChange={e => setNewSeriesName(e.target.value)} />
            <div className="flex gap-2"> <Button onClick={handleConfirmSave} className="flex-grow">Save</Button> <Button variant="secondary" onClick={() => setIsSavingSeries(false)} className="flex-grow">Cancel</Button> </div>
          </div>
        )}
        <div className="mt-4 pt-4 border-t border-slate-700 space-y-2">
          <h4 className="text-base font-semibold text-slate-200">Profile Dimensions</h4>
          {Object.keys(series.dimensions).map(key => {
            const label = key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());
            return (
                <DimensionInput key={key} id={`${idPrefix}dim-${key}`} name={`dim-${key}`} label={label} value_mm={series.dimensions[key as keyof typeof series.dimensions]} onChange_mm={v => handleDimensionChange(key as keyof ProfileSeries['dimensions'], v)} weightValue={series.weights?.[key as keyof ProfileDimensions]} onWeightChange={v => handleProfileDetailChange('weights', key as keyof ProfileDimensions, v)} lengthValue={series.lengths?.[key as keyof ProfileDimensions]} onLengthChange={v => handleProfileDetailChange('lengths', key as keyof ProfileDimensions, v)} />
            )
          })}
        </div>
        <div className="mt-4 pt-4 border-t border-slate-700 space-y-2">
          <h4 className="text-base font-semibold text-slate-200">Hardware Items</h4>
          {series.hardwareItems.map(item => (
            <div key={item.id} className="bg-slate-900/50 p-3 rounded-md grid grid-cols-12 gap-2">
              <div className="col-span-12"><Input id={`${idPrefix}hw-${item.id}-name`} name={`hw-${item.id}-name`} label="Name" value={item.name} onChange={e => onHardwareChange(item.id, 'name', e.target.value)} /></div>
              <div className="col-span-4"><Input id={`${idPrefix}hw-${item.id}-qty`} name={`hw-${item.id}-qty`} label="Qty" type="number" value={item.qtyPerShutter} onChange={e => onHardwareChange(item.id, 'qtyPerShutter', e.target.value === '' ? '' : Number(e.target.value))} /></div>
              <div className="col-span-5"><Input id={`${idPrefix}hw-${item.id}-rate`} name={`hw-${item.id}-rate`} label="Rate" type="number" value={item.rate} onChange={e => onHardwareChange(item.id, 'rate', e.target.value === '' ? '' : Number(e.target.value))} /></div>
              <div className="col-span-3 flex items-end"><Button variant="danger" onClick={() => onRemoveHardware(item.id)} className="p-2 h-10 w-full"><TrashIcon className="w-5 h-5"/></Button></div>
              <div className="col-span-12"><Select id={`${idPrefix}hw-${item.id}-unit`} name={`hw-${item.id}-unit`} label="Unit" value={item.unit} onChange={e => onHardwareChange(item.id, 'unit', e.target.value as HardwareItem['unit'])}><option value="per_shutter_or_door">Per Shutter/Door</option><option value="per_window">Per Window</option></Select></div>
            </div>
          ))}
          <Button variant="secondary" className="w-full" onClick={onAddHardware}><PlusIcon className="w-4 h-4 mr-2"/> Add Hardware Item</Button>
        </div>
      </CollapsibleCard>

    </div>
  );
});
