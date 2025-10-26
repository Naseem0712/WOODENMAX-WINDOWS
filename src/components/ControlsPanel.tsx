import React, { useState, useMemo } from 'react';
import type { ProfileSeries, HardwareItem, WindowConfig, GlassSpecialType, SavedColor, VentilatorCellType, PartitionPanelType, HandleConfig, CornerSideConfig, ProfileDimensions, LaminatedGlassConfig, DguGlassConfig } from '../types';
import { FixedPanelPosition, ShutterConfigType, TrackType, WindowType, GlassType } from '../types';
import { Button } from './ui/Button';
import { Input } from './ui/Input';
import { Select } from './ui/Select';
import { PlusIcon } from './icons/PlusIcon';
import { TrashIcon } from './icons/TrashIcon';
import { DimensionInput } from './ui/DimensionInput';
import { v4 as uuidv4 } from 'uuid';
import { XMarkIcon } from './icons/XMarkIcon';
import { CollapsibleCard } from './ui/CollapsibleCard';
import { RefreshIcon } from './icons/RefreshIcon';
import { SearchableSelect } from './ui/SearchableSelect';


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
}

function getContrastYIQ(hexcolor: string){
    if (!hexcolor) return 'black';
    hexcolor = hexcolor.replace("#", "");
    if (hexcolor.length !== 6) return 'black';
    const r = parseInt(hexcolor.substr(0,2),16);
    const g = parseInt(hexcolor.substr(2,2),16);
    const b = parseInt(hexcolor.substr(4,2),16);
    const yiq = ((r*299)+(g*587)+(b*114))/1000;
    return (yiq >= 128) ? 'black' : 'white';
}

const Slider: React.FC<React.InputHTMLAttributes<HTMLInputElement> & { label: string }> = ({ label, ...props }) => (
    <div>
        <label className="block text-sm font-medium text-slate-300 mb-1">{label}</label>
        <input type="range" min="0" max="100" className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer" {...props} />
    </div>
);

export const ControlsPanel: React.FC<ControlsPanelProps> = React.memo((props) => {
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

  const { windowType, series, fixedPanels } = config;
  const [openCard, setOpenCard] = useState<string | null>('Design Type');
  const [isSavingSeries, setIsSavingSeries] = useState(false);
  const [newSeriesName, setNewSeriesName] = useState('');
  const [isAddingColor, setIsAddingColor] = useState(false);
  const [newColor, setNewColor] = useState({ name: '', hex: '#ffffff' });
  const [selectedPanelId, setSelectedPanelId] = useState<string>('');
  
  const isCorner = windowType === WindowType.CORNER;

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
            displayConfig.partitionPanels.types.forEach((p, i) => { if (p.type !== 'fixed') { panels.push({ id: `partition-${i}`, label: `Panel ${i + 1} (${p.type})` }); } });
            break;
    }
    if (selectedPanelId && !panels.some(p => p.id === selectedPanelId)) {
        setSelectedPanelId(panels[0]?.id || '');
    } else if (!selectedPanelId && panels.length > 0) {
        setSelectedPanelId(panels[0].id);
    }
    return panels;
  }, [displayConfig, selectedPanelId, activeWindowType]);

  const currentHandle = useMemo((): HandleConfig | null => {
    if (!selectedPanelId) return null;
    const parts = selectedPanelId.split('-');
    const type = parts[0];

    switch (type) {
        case 'sliding': return displayConfig.slidingHandles[parseInt(parts[1], 10)] || null;
        case 'casement': return displayConfig.doorPositions.find(p => p.row === parseInt(parts[1], 10) && p.col === parseInt(parts[2], 10))?.handle || null;
        case 'ventilator': return displayConfig.ventilatorGrid[parseInt(parts[1], 10)]?.[parseInt(parts[2], 10)]?.handle || null;
        case 'partition': return displayConfig.partitionPanels.types[parseInt(parts[1], 10)]?.handle || null;
        default: return null;
    }
  }, [selectedPanelId, displayConfig]);

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
  const handleAddColor = () => { if (newColor.name.trim() && newColor.hex) { setSavedColors([...savedColors, { ...newColor, id: uuidv4() }]); setNewColor({ name: '', hex: '#ffffff' }); setIsAddingColor(false); } };
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
                    <DimensionInput label="Left Wall Width" value_mm={config.leftWidth} onChange_mm={v => setConfig('leftWidth', v)} placeholder="e.g., 1200" />
                    <DimensionInput label="Right Wall Width" value_mm={config.rightWidth} onChange_mm={v => setConfig('rightWidth', v)} placeholder="e.g., 1200" />
                </div>
                 <DimensionInput label="Corner Post Width" value_mm={config.cornerPostWidth} onChange_mm={v => setConfig('cornerPostWidth', v)} placeholder="e.g., 100" />
            </>
        ) : (
            <DimensionInput label="Total Width" value_mm={config.width} onChange_mm={v => setConfig('width', v)} placeholder="e.g., 1800" />
        )}
        <DimensionInput label="Total Height" value_mm={config.height} onChange_mm={v => setConfig('height', v)} placeholder="e.g., 1200" />
      </CollapsibleCard>
      
      {isCorner && (
         <CollapsibleCard title="Corner Window Setup" isOpen={openCard === 'Corner Window Setup'} onToggle={() => handleToggleCard('Corner Window Setup')}>
            <div className="mb-4 grid grid-cols-2 bg-slate-700 rounded-md p-1 gap-1">
                <button onClick={() => setActiveCornerSide('left')} className={`p-2 text-sm font-semibold rounded ${activeCornerSide === 'left' ? 'bg-indigo-600 text-white' : 'text-slate-300 hover:bg-slate-600'}`}>Left Wall</button>
                <button onClick={() => setActiveCornerSide('right')} className={`p-2 text-sm font-semibold rounded ${activeCornerSide === 'right' ? 'bg-indigo-600 text-white' : 'text-slate-300 hover:bg-slate-600'}`}>Right Wall</button>
            </div>
            <Select label={`${activeCornerSide === 'left' ? 'Left' : 'Right'} Wall Type`} value={displayConfig.windowType} onChange={(e) => setSideConfig({ windowType: e.target.value as CornerSideConfig['windowType'] })}>
              <option value={WindowType.SLIDING}>Sliding</option>
              <option value={WindowType.CASEMENT}>Casement / Fixed</option>
              <option value={WindowType.VENTILATOR}>Ventilator</option>
            </Select>
         </CollapsibleCard>
      )}

      {activeWindowType === WindowType.ELEVATION_GLAZING && config.elevationGrid && (
        <CollapsibleCard title="Elevation Grid Pattern" isOpen={openCard === 'Elevation Grid Pattern'} onToggle={() => handleToggleCard('Elevation Grid Pattern')}>
          <div className="grid grid-cols-2 gap-4">
              <DimensionInput label="Mullion (Rafter) Size" value_mm={config.elevationGrid.mullionSize} onChange_mm={v => onElevationGridChange('update_prop', { prop: 'mullionSize', value: v })} />
              <DimensionInput label="Pressure/Cover Plate Size" value_mm={config.elevationGrid.pressurePlateSize} onChange_mm={v => onElevationGridChange('update_prop', { prop: 'pressurePlateSize', value: v })} />
          </div>
          <div className="mt-4 pt-4 border-t border-slate-700">
              <h4 className="text-base font-semibold text-slate-200 mb-2">Vertical Pattern (Columns)</h4>
              <div className="space-y-2">
                  {config.elevationGrid.colPattern.map((width, index) => (
                      <div key={index} className="flex items-end gap-2">
                          <DimensionInput label={`Width ${index + 1}`} value_mm={width} onChange_mm={v => onElevationGridChange('update', { patternType: 'col', index, value: v })} className="flex-grow" />
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
                          <DimensionInput label={`Height ${index + 1}`} value_mm={height} onChange_mm={v => onElevationGridChange('update', { patternType: 'row', index, value: v })} className="flex-grow" />
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
            <Select label="Track Type" value={displayConfig.trackType} onChange={(e) => isCorner ? setSideConfig({trackType: parseInt(e.target.value)}) : setConfig('trackType', parseInt(e.target.value) as TrackType)}>
                <option value={TrackType.TWO_TRACK}>2-Track</option>
                <option value={TrackType.THREE_TRACK}>3-Track</option>
            </Select>
            <Select label="Shutter Configuration" value={displayConfig.shutterConfig} onChange={(e) => isCorner ? setSideConfig({shutterConfig: e.target.value as ShutterConfigType}) : setConfig('shutterConfig', e.target.value as ShutterConfigType)}>
                {displayConfig.trackType === TrackType.TWO_TRACK && <><option value="2G">2 Glass Shutters</option><option value="4G">4 Glass Shutters</option></>}
                {displayConfig.trackType === TrackType.THREE_TRACK && <><option value="3G">3 Glass Shutters</option><option value="2G1M">2 Glass + 1 Mesh Shutter</option></>}
            </Select>
            {displayConfig.fixedShutters.length > 0 && (
              <div className="pt-2">
                <label className="block text-sm font-medium text-slate-300 mb-2">Shutter Fixing</label>
                <div className="grid grid-cols-2 gap-2">
                    {displayConfig.fixedShutters.map((_, i) => (
                        <label key={i} className="flex items-center space-x-2 p-2 bg-slate-700 rounded-md cursor-pointer hover:bg-slate-600">
                            <input type="checkbox" checked={displayConfig.fixedShutters[i] || false} onChange={e => handleFixShutterChange(i, e.target.checked)} className="w-4 h-4 rounded bg-slate-800 border-slate-500 text-indigo-600 focus:ring-indigo-500"/>
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
                  <Input label="Rows" type="number" inputMode="numeric" value={gridRows} min={1} onChange={e => setGridSize(Math.max(1, parseInt(e.target.value) || 1), gridCols)} />
                  <Input label="Columns" type="number" inputMode="numeric" value={gridCols} min={1} onChange={e => setGridSize(gridRows, Math.max(1, parseInt(e.target.value) || 1))} />
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
          {/* FIX: Changed setConfig to onSetPartitionPanelCount to fix incorrect prop usage. */}
          <Input label="Number of Panels" type="number" inputMode="numeric" min={1} max={8} value={config.partitionPanels.count} onChange={e => onSetPartitionPanelCount(Math.max(1, parseInt(e.target.value) || 1))}/>
           <label className="flex items-center space-x-2 cursor-pointer mt-2">
              <input type="checkbox" checked={config.partitionPanels.hasTopChannel} onChange={e => onSetPartitionHasTopChannel(e.target.checked)} className="w-4 h-4 rounded bg-slate-800 border-slate-500 text-indigo-600 focus:ring-indigo-500" />
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
              <Select label="Select Panel" value={selectedPanelId} onChange={e => setSelectedPanelId(e.target.value)}>
                {operablePanels.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}
              </Select>
              {selectedPanelId && (
                  <div className="p-2 bg-slate-700 rounded-md space-y-3">
                      <label className="flex items-center space-x-2 cursor-pointer">
                          <input type="checkbox" checked={!!currentHandle} onChange={e => onUpdateHandle(selectedPanelId, e.target.checked ? { x: 50, y: 50, orientation: 'vertical' } : null)} className="w-4 h-4 rounded bg-slate-800 border-slate-500 text-indigo-600 focus:ring-indigo-500" />
                          <span className="text-sm text-slate-200">Enable Handle</span>
                      </label>
                      {currentHandle && (
                          <div className="space-y-3">
                              <Slider label={`Horizontal Position: ${currentHandle.x}%`} value={currentHandle.x} onChange={e => onUpdateHandle(selectedPanelId, {...currentHandle, x: parseInt(e.target.value)})}/>
                              <Slider label={`Vertical Position: ${currentHandle.y}%`} value={currentHandle.y} onChange={e => onUpdateHandle(selectedPanelId, {...currentHandle, y: parseInt(e.target.value)})}/>
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
            <Select label="Glass Tint" value={config.glassType} onChange={(e) => setConfig('glassType', e.target.value as GlassType)}>
              {glassTypeOptions.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
            </Select>
            <Select label="Special Type" value={config.glassSpecialType} onChange={e => setConfig('glassSpecialType', e.target.value as GlassSpecialType)}>
                <option value="none">None</option>
                {series.glassOptions.specialTypes.map(t => <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>)}
            </Select>
        </div>
        {config.glassSpecialType === 'laminated' && config.laminatedGlassConfig && (
            <div className="p-3 bg-slate-900/50 rounded-md mt-4 space-y-3">
                <h4 className="text-base font-semibold text-slate-200">Laminated Glass Details</h4>
                <div className="grid grid-cols-2 gap-x-4 gap-y-3">
                    <Input label="Glass 1 Thickness" type="number" inputMode="decimal" value={config.laminatedGlassConfig.glass1Thickness} onChange={e => onLaminatedConfigChange({ glass1Thickness: e.target.value === '' ? '' : Number(e.target.value) })} unit="mm" />
                    <Select label="Glass 1 Type" value={config.laminatedGlassConfig.glass1Type} onChange={e => onLaminatedConfigChange({ glass1Type: e.target.value as GlassType })}>
                        {glassTypeOptions.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                    </Select>
                    <Input label="PVB Thickness" type="number" inputMode="decimal" value={config.laminatedGlassConfig.pvbThickness} onChange={e => onLaminatedConfigChange({ pvbThickness: e.target.value === '' ? '' : Number(e.target.value) })} unit="mm" />
                    <Select label="PVB Type" value={config.laminatedGlassConfig.pvbType} onChange={e => onLaminatedConfigChange({ pvbType: e.target.value as LaminatedGlassConfig['pvbType'] })}>
                        <option value="clear">Clear</option>
                        <option value="milky_white">Milky White</option>
                    </Select>
                    <Input label="Glass 2 Thickness" type="number" inputMode="decimal" value={config.laminatedGlassConfig.glass2Thickness} onChange={e => onLaminatedConfigChange({ glass2Thickness: e.target.value === '' ? '' : Number(e.target.value) })} unit="mm" />
                    <Select label="Glass 2 Type" value={config.laminatedGlassConfig.glass2Type} onChange={e => onLaminatedConfigChange({ glass2Type: e.target.value as GlassType })}>
                        {glassTypeOptions.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                    </Select>
                </div>
                <label className="flex items-center space-x-2 cursor-pointer pt-2">
                    <input type="checkbox" checked={config.laminatedGlassConfig.isToughened} onChange={e => onLaminatedConfigChange({ isToughened: e.target.checked })} className="w-4 h-4 rounded bg-slate-800 border-slate-500 text-indigo-600 focus:ring-indigo-500"/>
                    <span className="text-sm text-slate-200">Toughened / Tempered Glass</span>
                </label>
            </div>
        )}
        {config.glassSpecialType === 'dgu' && config.dguGlassConfig && (
            <div className="p-3 bg-slate-900/50 rounded-md mt-4 space-y-3">
                <h4 className="text-base font-semibold text-slate-200">DGU (Insulated) Glass Details</h4>
                <div className="grid grid-cols-2 gap-x-4 gap-y-3">
                    <Input label="Glass 1 Thickness" type="number" inputMode="decimal" value={config.dguGlassConfig.glass1Thickness} onChange={e => onDguConfigChange({ glass1Thickness: e.target.value === '' ? '' : Number(e.target.value) })} unit="mm" />
                    <Select label="Glass 1 Type" value={config.dguGlassConfig.glass1Type} onChange={e => onDguConfigChange({ glass1Type: e.target.value as GlassType })}>
                        {glassTypeOptions.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                    </Select>
                    <Select label="Air Gap" value={config.dguGlassConfig.airGap} onChange={e => onDguConfigChange({ airGap: e.target.value === '' ? '' : Number(e.target.value) })}>
                        {[6, 8, 10, 12, 15].map(g => <option key={g} value={g}>{g} mm</option>)}
                    </Select>
                    <div />
                    <Input label="Glass 2 Thickness" type="number" inputMode="decimal" value={config.dguGlassConfig.glass2Thickness} onChange={e => onDguConfigChange({ glass2Thickness: e.target.value === '' ? '' : Number(e.target.value) })} unit="mm" />
                    <Select label="Glass 2 Type" value={config.dguGlassConfig.glass2Type} onChange={e => onDguConfigChange({ glass2Type: e.target.value as GlassType })}>
                        {glassTypeOptions.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                    </Select>
                </div>
                <label className="flex items-center space-x-2 cursor-pointer pt-2">
                    <input type="checkbox" checked={config.dguGlassConfig.isToughened} onChange={e => onDguConfigChange({ isToughened: e.target.checked })} className="w-4 h-4 rounded bg-slate-800 border-slate-500 text-indigo-600 focus:ring-indigo-500"/>
                    <span className="text-sm text-slate-200">Toughened / Tempered Glass</span>
                </label>
            </div>
        )}
        {config.glassSpecialType === 'none' && (
            <div className="grid grid-cols-2 gap-4 mt-4">
            <div>
                <Select label="Glass Thickness" value={isCustomThickness ? 'custom' : displayConfig.glassThickness} onChange={handleThicknessChange}>
                    <option value="">Auto</option>
                    {series.glassOptions.thicknesses.map(t => <option key={t} value={t}>{t} mm</option>)}
                    {series.glassOptions.customThicknessAllowed && <option value="custom">Custom...</option>}
                </Select>
                {isCustomThickness && ( <Input label="Custom Thickness (mm)" type="number" inputMode="decimal" value={displayConfig.glassThickness} onChange={e => setConfig('glassThickness', e.target.value === '' ? '' : Number(e.target.value))} className="mt-2" /> )}
            </div>
            <Input label="Glass Name / Brand (Optional)" type="text" value={config.customGlassName} onChange={e => setConfig('customGlassName', e.target.value)} placeholder="e.g. Saint-Gobain" />
            </div>
        )}
        <div className="pt-4 mt-4 border-t border-slate-700">
             <label className="block text-sm font-medium text-slate-300 mb-2">Glass Grid</label>
             <div className="grid grid-cols-2 gap-4">
                <Input label="Rows" type="number" min="0" inputMode="numeric" value={config.glassGrid.rows} onChange={e => setConfig('glassGrid', {...config.glassGrid, rows: Math.max(0, parseInt(e.target.value) || 0)})} />
                <Input label="Columns" type="number" min="0" inputMode="numeric" value={config.glassGrid.cols} onChange={e => setConfig('glassGrid', {...config.glassGrid, cols: Math.max(0, parseInt(e.target.value) || 0)})} />
            </div>
        </div>
        <div className="pt-4 mt-4 border-t border-slate-700">
            <label className="block text-sm font-medium text-slate-300 mb-2">Profile Color</label>
            <div className="grid grid-cols-2 gap-2 mb-2">
                {savedColors.map(color => (
                    <button key={color.id} onClick={() => setConfig('profileColor', color.hex)} className={`w-full h-10 rounded-md text-sm font-medium border flex items-center justify-center relative group ${config.profileColor === color.hex ? 'ring-2 ring-offset-2 ring-offset-slate-800 ring-indigo-500' : 'border-slate-600'}`} style={{backgroundColor: color.hex, color: getContrastYIQ(color.hex)}}>
                        {color.name}
                        <button onClick={(e) => { e.stopPropagation(); handleDeleteColor(color.id)}} className="absolute top-0 right-0 m-1 p-0.5 bg-red-600 rounded-full text-white opacity-0 group-hover:opacity-100 focus:opacity-100"><TrashIcon className="w-3 h-3"/></button>
                    </button>
                ))}
            </div>
            {!isAddingColor ? ( <Button variant="secondary" className="w-full" onClick={() => setIsAddingColor(true)}><PlusIcon className="w-4 h-4 mr-2"/> Add New Color</Button> ) : (
                <div className="p-2 bg-slate-700 rounded-md space-y-2">
                    <Input label="Color Name" value={newColor.name} onChange={e => setNewColor({...newColor, name: e.target.value})} placeholder="e.g., Anodized Bronze" />
                    <Input label="Color Hex" type="color" value={newColor.hex} onChange={e => setNewColor({...newColor, hex: e.target.value})} className="w-full h-10 p-1"/>
                    <div className="grid grid-cols-2 gap-2"> <Button onClick={handleAddColor} disabled={!newColor.name.trim()}>Save Color</Button> <Button variant="secondary" onClick={() => setIsAddingColor(false)}>Cancel</Button> </div>
                </div>
            )}
        </div>
      </CollapsibleCard>
      
      {(!isCorner && ![WindowType.GLASS_PARTITION, WindowType.ELEVATION_GLAZING].includes(windowType)) && (
        <CollapsibleCard title="Fixed Panels" isOpen={openCard === 'Fixed Panels'} onToggle={() => handleToggleCard('Fixed Panels')}>
           <div className="grid grid-cols-2 gap-2">
              <Button variant="secondary" onClick={() => addFixedPanel(FixedPanelPosition.TOP)}><PlusIcon className="w-4 h-4 mr-2" /> Top</Button>
              <Button variant="secondary" onClick={() => addFixedPanel(FixedPanelPosition.BOTTOM)}><PlusIcon className="w-4 h-4 mr-2" /> Bottom</Button>
              <Button variant="secondary" onClick={() => addFixedPanel(FixedPanelPosition.LEFT)}><PlusIcon className="w-4 h-4 mr-2" /> Left</Button>
              <Button variant="secondary" onClick={() => addFixedPanel(FixedPanelPosition.RIGHT)}><PlusIcon className="w-4 h-4 mr-2" /> Right</Button>
           </div>
           {fixedPanels.length > 0 && (
               <div className="mt-4 space-y-3">
                   {fixedPanels.map(panel => (
                       <div key={panel.id} className="flex items-center gap-2 p-2 bg-slate-700 rounded">
                           <span className="flex-shrink-0 capitalize font-medium text-slate-300 w-16">{panel.position}</span>
                           <DimensionInput aria-label={`${panel.position} panel size`} placeholder="Size" value_mm={panel.size} onChange_mm={val => updateFixedPanelSize(panel.id, Number(val) || 0)} className="flex-grow" label=""/>
                           <Button variant="danger" onClick={() => removeFixedPanel(panel.id)} className="p-2 h-10 w-10"><TrashIcon className="w-5 h-5"/></Button>
                       </div>
                   ))}
               </div>
           )}
        </CollapsibleCard>
      )}

      <CollapsibleCard title="Profile Series Dimensions" isOpen={openCard === 'Profile Series Dimensions'} onToggle={() => handleToggleCard('Profile Series Dimensions')}>
        <div className="space-y-2">
           <SearchableSelect
              label="Active Profile"
              options={seriesOptions}
              value={series.id}
              onChange={onSeriesSelect}
              placeholder="Select or search for a profile..."
           />
          {!isSavingSeries ? (
              <div className="grid grid-cols-2 gap-2">
                <Button variant="secondary" onClick={handleInitiateSave}>Save Current As...</Button>
                <Button variant="danger" onClick={() => onSeriesDelete(series.id)} disabled={isDefaultSeries}>Delete Selected</Button>
              </div>
          ) : (
            <div className='p-2 bg-slate-700 rounded-md'>
                <Input label="New Series Name" placeholder='Enter a name...' value={newSeriesName} onChange={e => setNewSeriesName(e.target.value)} />
                <div className="grid grid-cols-2 gap-2 mt-2">
                    <Button onClick={handleConfirmSave} disabled={!newSeriesName.trim()}>Save</Button>
                    <Button variant='secondary' onClick={() => setIsSavingSeries(false)}>Cancel</Button>
                </div>
            </div>
          )}
        </div>
        <hr className="border-slate-700 my-4" />
        {activeWindowType === WindowType.SLIDING && ( <> 
        <DimensionInput label="Outer Frame (Top/Bottom)" value_mm={series.dimensions.outerFrame} onChange_mm={val => handleDimensionChange('outerFrame', val)} weightValue={series.weights?.outerFrame} onWeightChange={v => handleProfileDetailChange('weights', 'outerFrame', v)} lengthValue={series.lengths?.outerFrame} onLengthChange={v => handleProfileDetailChange('lengths', 'outerFrame', v)} /> 
        <DimensionInput label="Outer Frame (Vertical)" value_mm={series.dimensions.outerFrameVertical} onChange_mm={val => handleDimensionChange('outerFrameVertical', val)} weightValue={series.weights?.outerFrameVertical} onWeightChange={v => handleProfileDetailChange('weights', 'outerFrameVertical', v)} lengthValue={series.lengths?.outerFrameVertical} onLengthChange={v => handleProfileDetailChange('lengths', 'outerFrameVertical', v)} />
        { (fixedPanels.length > 0) && <DimensionInput label="Fixed Panel Frame" value_mm={series.dimensions.fixedFrame} onChange_mm={val => handleDimensionChange('fixedFrame', val)} weightValue={series.weights?.fixedFrame} onWeightChange={v => handleProfileDetailChange('weights', 'fixedFrame', v)} lengthValue={series.lengths?.fixedFrame} onLengthChange={v => handleProfileDetailChange('lengths', 'fixedFrame', v)} />} <DimensionInput label="Shutter Handle" value_mm={series.dimensions.shutterHandle} onChange_mm={val => handleDimensionChange('shutterHandle', val)} weightValue={series.weights?.shutterHandle} onWeightChange={v => handleProfileDetailChange('weights', 'shutterHandle', v)} lengthValue={series.lengths?.shutterHandle} onLengthChange={v => handleProfileDetailChange('lengths', 'shutterHandle', v)} /> <DimensionInput label="Shutter Interlock" value_mm={series.dimensions.shutterInterlock} onChange_mm={val => handleDimensionChange('shutterInterlock', val)} weightValue={series.weights?.shutterInterlock} onWeightChange={v => handleProfileDetailChange('weights', 'shutterInterlock', v)} lengthValue={series.lengths?.shutterInterlock} onLengthChange={v => handleProfileDetailChange('lengths', 'shutterInterlock', v)} /> { displayConfig.shutterConfig === ShutterConfigType.FOUR_GLASS && <DimensionInput label="Shutter Meeting" value_mm={series.dimensions.shutterMeeting} onChange_mm={val => handleDimensionChange('shutterMeeting', val)} weightValue={series.weights?.shutterMeeting} onWeightChange={v => handleProfileDetailChange('weights', 'shutterMeeting', v)} lengthValue={series.lengths?.shutterMeeting} onLengthChange={v => handleProfileDetailChange('lengths', 'shutterMeeting', v)} />} <DimensionInput label="Shutter Top/Bottom" value_mm={series.dimensions.shutterTop} onChange_mm={val => handleDimensionChange('shutterTop', val)} weightValue={series.weights?.shutterTop} onWeightChange={v => handleProfileDetailChange('weights', 'shutterTop', v)} lengthValue={series.lengths?.shutterTop} onLengthChange={v => handleProfileDetailChange('lengths', 'shutterTop', v)} /> </> )}
        {(activeWindowType === WindowType.CASEMENT || activeWindowType === WindowType.VENTILATOR) && ( <> <DimensionInput label="Outer Frame" value_mm={series.dimensions.outerFrame} onChange_mm={val => handleDimensionChange('outerFrame', val)} weightValue={series.weights?.outerFrame} onWeightChange={v => handleProfileDetailChange('weights', 'outerFrame', v)} lengthValue={series.lengths?.outerFrame} onLengthChange={v => handleProfileDetailChange('lengths', 'outerFrame', v)} /> <DimensionInput label="Fixed Panel Frame" value_mm={series.dimensions.fixedFrame} onChange_mm={val => handleDimensionChange('fixedFrame', val)} weightValue={series.weights?.fixedFrame} onWeightChange={v => handleProfileDetailChange('weights', 'fixedFrame', v)} lengthValue={series.lengths?.fixedFrame} onLengthChange={v => handleProfileDetailChange('lengths', 'fixedFrame', v)} /> <DimensionInput label="Shutter/Door Frame" value_mm={series.dimensions.casementShutter} onChange_mm={val => handleDimensionChange('casementShutter', val)} weightValue={series.weights?.casementShutter} onWeightChange={v => handleProfileDetailChange('weights', 'casementShutter', v)} lengthValue={series.lengths?.casementShutter} onLengthChange={v => handleProfileDetailChange('lengths', 'casementShutter', v)} /> <DimensionInput label="Mullion Profile" value_mm={series.dimensions.mullion} onChange_mm={val => handleDimensionChange('mullion', val)} weightValue={series.weights?.mullion} onWeightChange={v => handleProfileDetailChange('weights', 'mullion', v)} lengthValue={series.lengths?.mullion} onLengthChange={v => handleProfileDetailChange('lengths', 'mullion', v)} /> </> )}
        {activeWindowType === WindowType.VENTILATOR && ( <DimensionInput label="Louver Blade" value_mm={series.dimensions.louverBlade} onChange_mm={val => handleDimensionChange('louverBlade', val)} weightValue={series.weights?.louverBlade} onWeightChange={v => handleProfileDetailChange('weights', 'louverBlade', v)} lengthValue={series.lengths?.louverBlade} onLengthChange={v => handleProfileDetailChange('lengths', 'louverBlade', v)} /> )}
        {windowType === WindowType.GLASS_PARTITION && ( <> <DimensionInput label="Fixed Panel Frame" value_mm={series.dimensions.fixedFrame} onChange_mm={val => handleDimensionChange('fixedFrame', val)} weightValue={series.weights?.fixedFrame} onWeightChange={v => handleProfileDetailChange('weights', 'fixedFrame', v)} lengthValue={series.lengths?.fixedFrame} onLengthChange={v => handleProfileDetailChange('lengths', 'fixedFrame', v)} /> <DimensionInput label="Hinged Panel Frame" value_mm={series.dimensions.casementShutter} onChange_mm={val => handleDimensionChange('casementShutter', val)} weightValue={series.weights?.casementShutter} onWeightChange={v => handleProfileDetailChange('weights', 'casementShutter', v)} lengthValue={series.lengths?.casementShutter} onLengthChange={v => handleProfileDetailChange('lengths', 'casementShutter', v)} /> <DimensionInput label="Top Track Height" value_mm={series.dimensions.topTrack} onChange_mm={val => handleDimensionChange('topTrack', val)} weightValue={series.weights?.topTrack} onWeightChange={v => handleProfileDetailChange('weights', 'topTrack', v)} lengthValue={series.lengths?.topTrack} onLengthChange={v => handleProfileDetailChange('lengths', 'topTrack', v)} /> <DimensionInput label="Bottom Track Height" value_mm={series.dimensions.bottomTrack} onChange_mm={val => handleDimensionChange('bottomTrack', val)} weightValue={series.weights?.bottomTrack} onWeightChange={v => handleProfileDetailChange('weights', 'bottomTrack', v)} lengthValue={series.lengths?.bottomTrack} onLengthChange={v => handleProfileDetailChange('lengths', 'bottomTrack', v)} /> <DimensionInput label="Glass Grid Profile" value_mm={series.dimensions.glassGridProfile} onChange_mm={val => handleDimensionChange('glassGridProfile', val)} weightValue={series.weights?.glassGridProfile} onWeightChange={v => handleProfileDetailChange('weights', 'glassGridProfile', v)} lengthValue={series.lengths?.glassGridProfile} onLengthChange={v => handleProfileDetailChange('lengths', 'glassGridProfile', v)} /> </> )}
      </CollapsibleCard>

      <CollapsibleCard title="Hardware Configuration" isOpen={openCard === 'Hardware Configuration'} onToggle={() => handleToggleCard('Hardware Configuration')}>
          <div className="space-y-3">
              {series.hardwareItems.map(item => (
                  <div key={item.id} className="p-3 bg-slate-700 rounded-md">
                      <div className="flex justify-between items-center mb-2">
                          <input className="font-semibold text-slate-200 bg-transparent focus:bg-slate-600 rounded px-1 outline-none w-full" value={item.name} onChange={(e) => onHardwareChange(item.id, 'name', e.target.value)} />
                          <Button variant="danger" onClick={() => onRemoveHardware(item.id)} className="p-1 h-7 w-7 flex-shrink-0 ml-2"><TrashIcon className="w-4 h-4"/></Button>
                      </div>
                      <div className="grid grid-cols-3 gap-2">
                          <Input label="Qty" type="number" inputMode="numeric" value={item.qtyPerShutter} onChange={e => onHardwareChange(item.id, 'qtyPerShutter', e.target.value === '' ? '' : parseInt(e.target.value) || 0)} placeholder="e.g., 2"/>
                          <Input label="Rate" type="number" inputMode="decimal" value={item.rate} onChange={e => onHardwareChange(item.id, 'rate', e.target.value === '' ? '' : parseInt(e.target.value) || 0)} placeholder="e.g., 50"/>
                           <Select label="Unit" value={item.unit} onChange={(e) => onHardwareChange(item.id, 'unit', e.target.value as 'per_shutter_or_door' | 'per_window')}> <option value="per_shutter_or_door">Per Door/Panel</option> <option value="per_window">Per Window</option> </Select>
                      </div>
                  </div>
              ))}
          </div>
          <Button onClick={onAddHardware} variant="secondary" className="w-full mt-4"><PlusIcon className="w-4 h-4 mr-2"/> Add Hardware Item</Button>
      </CollapsibleCard>
    </div>
  );
});