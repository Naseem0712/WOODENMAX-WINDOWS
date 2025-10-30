import React, { useState, useMemo, useRef, useEffect } from 'react';
import type { ProfileSeries, HardwareItem, WindowConfig, GlassSpecialType, SavedColor, VentilatorCellType, PartitionPanelType, HandleConfig, CornerSideConfig, ProfileDimensions, LaminatedGlassConfig, DguGlassConfig, GlassGridConfig, LouverPatternItem } from '../types';
import { FixedPanelPosition, ShutterConfigType, TrackType, WindowType, GlassType, MirrorShape } from '../types';
import { Button } from './ui/Button';
import { Input } from './ui/Input';
import { Select } from './ui/Select';
import { PlusIcon } from './icons/PlusIcon';
import { TrashIcon } from './icons/TrashIcon';
import { DimensionInput, type Unit } from './ui/DimensionInput';
import { v4 as uuidv4 } from 'uuid';
import { XMarkIcon } from './icons/XMarkIcon';
import { CollapsibleCard } from './ui/CollapsibleCard';
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

  onAddLouverItem: (type: 'profile' | 'gap') => void;
  onRemoveLouverItem: (id: string) => void;
  onUpdateLouverItem: (id: string, size: number | '') => void;

  onLaminatedConfigChange: (payload: Partial<LaminatedGlassConfig>) => void;
  onDguConfigChange: (payload: Partial<DguGlassConfig>) => void;
  onUpdateMirrorConfig: (payload: Partial<WindowConfig['mirrorConfig']>) => void;
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
    onSetPartitionPanelCount, onCyclePartitionPanelType, onSetPartitionHasTopChannel, onCyclePartitionPanelFraming,
    onAddLouverItem, onRemoveLouverItem, onUpdateLouverItem,
    onLaminatedConfigChange, onDguConfigChange, onUpdateMirrorConfig,
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
    { value: GlassType.VERTICAL_FLUTED, label: "Vertical Fluted" },
    { value: GlassType.TINTED_BLUE, label: "Tinted Blue" },
    { value: GlassType.TINTED_GREY, label: "Tinted Grey" },
    { value: GlassType.CLEAR_SAPPHIRE, label: "Clear Sapphire" },
    { value: GlassType.BROWN_TINTED, label: "Brown Tinted" },
    { value: GlassType.BLACK_TINTED, label: "Black Tinted" },
  ];

  return (
    <div className="w-full flex flex-col h-full bg-slate-800">
      <div className="flex-shrink-0 flex justify-between items-center p-4 pb-2 border-b border-slate-700">
        <h2 className="text-2xl font-bold text-white">Configuration</h2>
        <div className="flex items-center gap-2">
            <button onClick={onResetDesign} className="p-2 rounded-full hover:bg-slate-700 text-slate-400 hover:text-white" aria-label="Reset design" title="Reset Design"> <TrashIcon className="w-6 h-6" /> </button>
            <button onClick={onClose} className="p-2 rounded-full hover:bg-slate-700 text-slate-400 hover:text-white" aria-label="Close panel"> <XMarkIcon className="w-6 h-6" /> </button>
        </div>
      </div>
      <div className="flex-grow overflow-y-auto custom-scrollbar" style={{ touchAction: 'pan-y' }}>
        <div className="p-4 space-y-4">
            <CollapsibleCard title="Design Type" isOpen={openCard === 'Design Type'} onToggle={() => handleToggleCard('Design Type')}>
                <div className="grid grid-cols-4 bg-slate-700 rounded-md p-1 gap-1">
                    {[WindowType.SLIDING, WindowType.CASEMENT, WindowType.VENTILATOR, WindowType.GLASS_PARTITION, WindowType.LOUVERS, WindowType.CORNER, WindowType.MIRROR].map(type => {
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

            {windowType === WindowType.LOUVERS && (
              <CollapsibleCard title="Louver Pattern" isOpen={openCard === 'Louver Pattern'} onToggle={() => handleToggleCard('Louver Pattern')}>
                  <div className="space-y-2">
                      {config.louverPattern.map((item, index) => (
                          <div key={item.id} className="flex items-end gap-2 p-2 bg-slate-900/50 rounded-md">
                              <div className="flex-shrink-0 w-16 text-center">
                                  <span className={`text-xs font-bold ${item.type === 'profile' ? 'text-indigo-300' : 'text-slate-400'}`}>
                                      {item.type.toUpperCase()}
                                  </span>
                              </div>
                              <DimensionInput
                                  id={`${idPrefix}louver-item-${item.id}`}
                                  name={`louver-item-${item.id}`}
                                  label={`Size ${index + 1}`}
                                  value_mm={item.size}
                                  onChange_mm={v => onUpdateLouverItem(item.id, v)}
                              />
                              <Button variant="danger" onClick={() => onRemoveLouverItem(item.id)} className="p-2 h-10 w-10 flex-shrink-0">
                                  <TrashIcon className="w-5 h-5"/>
                              </Button>
                          </div>
                      ))}
                  </div>
                  <div className="grid grid-cols-2 gap-2 mt-3">
                      <Button variant="secondary" onClick={() => onAddLouverItem('profile')}><PlusIcon className="w-4 h-4 mr-2"/> Add Profile</Button>
                      <Button variant="secondary" onClick={() => onAddLouverItem('gap')}><PlusIcon className="w-4 h-4 mr-2"/> Add Gap</Button>
                  </div>
                  <div className="mt-4 pt-4 border-t border-slate-700">
                      <label className="block text-sm font-medium text-slate-300 mb-2">Orientation</label>
                      <div className="grid grid-cols-2 gap-2">
                          <Button variant={config.orientation === 'vertical' ? 'primary' : 'secondary'} onClick={() => setConfig('orientation', 'vertical')}>Vertical</Button>
                          <Button variant={config.orientation === 'horizontal' ? 'primary' : 'secondary'} onClick={() => setConfig('orientation', 'horizontal')}>Horizontal</Button>
                      </div>
                  </div>
              </CollapsibleCard>
            )}

            {windowType === WindowType.MIRROR && (
              <CollapsibleCard title="Mirror Shape & Style" isOpen={openCard === 'Mirror Shape & Style'} onToggle={() => handleToggleCard('Mirror Shape & Style')}>
                  <div className="space-y-4">
                      <div>
                          <label className="block text-sm font-medium text-slate-300 mb-2">Shape</label>
                          <div className="grid grid-cols-2 gap-2">
                              {[MirrorShape.RECTANGLE, MirrorShape.ROUNDED_RECTANGLE, MirrorShape.CAPSULE, MirrorShape.OVAL].map(shape => (
                                  <Button 
                                      key={shape}
                                      variant={config.mirrorConfig.shape === shape ? 'primary' : 'secondary'}
                                      onClick={() => onUpdateMirrorConfig({ shape })}
                                      className="capitalize"
                                  >
                                      {shape.replace('_', ' ')}
                                  </Button>
                              ))}
                          </div>
                      </div>

                      {config.mirrorConfig.shape === MirrorShape.ROUNDED_RECTANGLE && (
                          <DimensionInput 
                              id={`${idPrefix}mirror-corner-radius`} 
                              name="mirror-corner-radius" 
                              label="Corner Radius" 
                              value_mm={config.mirrorConfig.cornerRadius} 
                              onChange_mm={v => onUpdateMirrorConfig({ cornerRadius: v })} 
                          />
                      )}

                      <label className="flex items-center space-x-2 cursor-pointer pt-2">
                          <input 
                              type="checkbox" 
                              id={`${idPrefix}mirror-frameless`} 
                              name="mirror-frameless" 
                              checked={config.mirrorConfig.isFrameless} 
                              onChange={e => onUpdateMirrorConfig({ isFrameless: e.target.checked })} 
                              className="w-4 h-4 rounded bg-slate-800 border-slate-500 text-indigo-600 focus:ring-indigo-500"
                          />
                          <span className="text-sm text-slate-200">Frameless Design</span>
                      </label>
                      
                      {!config.mirrorConfig.isFrameless && (
                          <p className="text-xs text-slate-400">Frame thickness can be adjusted in the "Profile Series" section under "Outer Frame".</p>
                      )}
                  </div>
              </CollapsibleCard>
            )}
            
            {/* The rest of the collapsible cards */}
            {activeWindowType === WindowType.SLIDING && (
              <CollapsibleCard title="Track & Shutter Setup" isOpen={openCard === 'Track & Shutter Setup'} onToggle={() => handleToggleCard('Track & Shutter Setup')}>
                  {/* ... content ... */}
              </CollapsibleCard>
            )}

            {(activeWindowType === WindowType.CASEMENT || activeWindowType === WindowType.VENTILATOR) && (
                <CollapsibleCard title="Grid Layout" isOpen={openCard === 'Grid Layout'} onToggle={() => handleToggleCard('Grid Layout')}>
                    {/* ... content ... */}
                </CollapsibleCard>
            )}

            {windowType === WindowType.GLASS_PARTITION && (
              <CollapsibleCard title="Partition Panel Setup" isOpen={openCard === 'Partition Panel Setup'} onToggle={() => handleToggleCard('Partition Panel Setup')}>
                {/* ... content ... */}
              </CollapsibleCard>
            )}

            {operablePanels.length > 0 && (
                <CollapsibleCard title="Handle Configuration" isOpen={openCard === 'Handle Configuration'} onToggle={() => handleToggleCard('Handle Configuration')}>
                    {/* ... content ... */}
                </CollapsibleCard>
            )}

            <CollapsibleCard title="Appearance" isOpen={openCard === 'Appearance'} onToggle={() => handleToggleCard('Appearance')}>
              {/* ... content ... */}
            </CollapsibleCard>

            {windowType !== WindowType.LOUVERS && (
                <CollapsibleCard title="Georgian Bars" isOpen={openCard === 'Georgian Bars'} onToggle={() => handleToggleCard('Georgian Bars')}>
                  {/* ... content ... */}
                </CollapsibleCard>
            )}
            
            {windowType !== WindowType.GLASS_PARTITION && windowType !== WindowType.MIRROR && windowType !== WindowType.LOUVERS && (
                <CollapsibleCard title="Fixed Panels" isOpen={openCard === 'Fixed Panels'} onToggle={() => handleToggleCard('Fixed Panels')}>
                {/* ... content ... */}
              </CollapsibleCard>
            )}

            <CollapsibleCard title="Profile Series" isOpen={openCard === 'Profile Series'} onToggle={() => handleToggleCard('Profile Series')}>
              {/* ... content ... */}
            </CollapsibleCard>
        </div>
      </div>
    </div>
  );
});
