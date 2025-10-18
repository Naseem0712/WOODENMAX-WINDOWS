import React, { useState, useMemo } from 'react';
import type { FixedPanel, ProfileDimensions, ProfileSeries, GlassType, HardwareItem, VentilatorCell, WindowConfig, GlassSpecialType, SavedColor, VentilatorCellType, PartitionPanelType, PartitionPanelConfig, HandleConfig } from '../types';
import { FixedPanelPosition, ShutterConfigType, TrackType, WindowType } from '../types';
import { Button } from './ui/Button';
import { Card } from './ui/Card';
import { Input } from './ui/Input';
import { Select } from './ui/Select';
import { PlusIcon } from './icons/PlusIcon';
import { TrashIcon } from './icons/TrashIcon';
import { DimensionInput } from './ui/DimensionInput';
import { v4 as uuidv4 } from 'uuid';
import { ChevronLeftIcon } from './icons/ChevronLeftIcon';


interface ControlsPanelProps {
  config: WindowConfig;
  onClose: () => void;
  setConfig: <K extends keyof WindowConfig>(field: K, value: WindowConfig[K]) => void;
  setGridSize: (rows: number, cols: number) => void;
  
  availableSeries: ProfileSeries[];
  onSeriesSelect: (id: string) => void;
  onSeriesSave: (name: string) => void;
  onSeriesDelete: (id: string) => void;

  fixedPanels: FixedPanel[];
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

export const ControlsPanel: React.FC<ControlsPanelProps> = (props) => {
  const { 
    config, onClose, setConfig, setGridSize, availableSeries, onSeriesSelect, onSeriesSave, onSeriesDelete,
    fixedPanels, addFixedPanel, removeFixedPanel, updateFixedPanelSize,
    onHardwareChange, onAddHardware, onRemoveHardware,
    toggleDoorPosition, onVentilatorCellClick,
    savedColors, setSavedColors, onUpdateHandle
  } = props;

  const { windowType, series, verticalDividers, horizontalDividers } = config;
  const gridRows = horizontalDividers.length + 1;
  const gridCols = verticalDividers.length + 1;


  const [isSavingSeries, setIsSavingSeries] = useState(false);
  const [newSeriesName, setNewSeriesName] = useState('');
  const [isAddingColor, setIsAddingColor] = useState(false);
  const [newColor, setNewColor] = useState({ name: '', hex: '#ffffff' });
  const [selectedPanelId, setSelectedPanelId] = useState<string>('');

  const operablePanels = useMemo(() => {
    const panels: { id: string; label: string }[] = [];
    switch (config.windowType) {
        case WindowType.SLIDING:
            config.slidingHandles.forEach((_, i) => {
                panels.push({ id: `sliding-${i}`, label: `Shutter ${i + 1}` });
            });
            break;
        case WindowType.CASEMENT:
            config.doorPositions.forEach(p => {
                panels.push({ id: `casement-${p.row}-${p.col}`, label: `Door (R${p.row + 1}, C${p.col + 1})` });
            });
            break;
        case WindowType.VENTILATOR:
            config.ventilatorGrid.forEach((row, r) => {
                row.forEach((cell, c) => {
                    if (cell.type === 'door') {
                        panels.push({ id: `ventilator-${r}-${c}`, label: `Door (R${r + 1}, C${c + 1})` });
                    }
                });
            });
            break;
        case WindowType.GLASS_PARTITION:
            config.partitionPanels.types.forEach((p, i) => {
                if (p.type !== 'fixed') {
                    panels.push({ id: `partition-${i}`, label: `Panel ${i + 1} (${p.type})` });
                }
            });
            break;
    }
    // Auto-select first panel if current selection is invalid
    if (selectedPanelId && !panels.some(p => p.id === selectedPanelId)) {
        setSelectedPanelId(panels[0]?.id || '');
    } else if (!selectedPanelId && panels.length > 0) {
        setSelectedPanelId(panels[0].id);
    }
    return panels;
  }, [config, selectedPanelId]);


  const currentHandle = useMemo((): HandleConfig | null => {
    if (!selectedPanelId) return null;
    const parts = selectedPanelId.split('-');
    const type = parts[0];

    switch (type) {
        case 'sliding': return config.slidingHandles[parseInt(parts[1], 10)] || null;
        case 'casement': return config.doorPositions.find(p => p.row === parseInt(parts[1], 10) && p.col === parseInt(parts[2], 10))?.handle || null;
        case 'ventilator': return config.ventilatorGrid[parseInt(parts[1], 10)]?.[parseInt(parts[2], 10)]?.handle || null;
        case 'partition': return config.partitionPanels.types[parseInt(parts[1], 10)]?.handle || null;
        default: return null;
    }
  }, [selectedPanelId, config]);

  const handleDimensionChange = <K extends keyof ProfileDimensions,>(key: K, value: number | '') => {
    setConfig('series', {
      ...series,
      dimensions: { ...series.dimensions, [key]: value },
    });
  };

  const handleFixShutterChange = (index: number, isChecked: boolean) => {
      const newFixedShutters = [...config.fixedShutters];
      newFixedShutters[index] = isChecked;
      setConfig('fixedShutters', newFixedShutters);
  };
  
  const handleInitiateSave = () => {
    setNewSeriesName(series.name.includes('Standard') ? '' : series.name);
    setIsSavingSeries(true);
  };

  const handleConfirmSave = () => {
    if (newSeriesName.trim()) {
      onSeriesSave(newSeriesName.trim());
      setIsSavingSeries(false);
      setNewSeriesName('');
    }
  };

  const handleAddColor = () => {
    if (newColor.name.trim() && newColor.hex) {
        setSavedColors([...savedColors, { ...newColor, id: uuidv4() }]);
        setNewColor({ name: '', hex: '#ffffff' });
        setIsAddingColor(false);
    }
  };

  const handleDeleteColor = (id: string) => {
      setSavedColors(savedColors.filter(c => c.id !== id));
  }

  const isDefaultSeries = series.id.includes('-default');
  const filteredAvailableSeries = availableSeries.filter(s => s.type === windowType);

  const getVentilatorCellLabel = (type: VentilatorCellType) => {
    switch(type) {
        case 'glass': return 'Glass';
        case 'louvers': return 'Louvers';
        case 'door': return 'Door';
        case 'exhaust_fan': return 'Ex-Fan';
        default: return 'Fixed';
    }
  };

  const cyclePartitionPanelType = (index: number) => {
    const sequence: PartitionPanelType[] = ['fixed', 'sliding', 'hinged'];
    const currentType = config.partitionPanels.types[index].type;
    const currentIndex = sequence.indexOf(currentType);
    const nextType = sequence[(currentIndex + 1) % sequence.length];
    
    const newTypes = [...config.partitionPanels.types];
    newTypes[index] = { ...newTypes[index], type: nextType };
    setConfig('partitionPanels', { ...config.partitionPanels, types: newTypes });
  };

  return (
    <div className="w-full lg:w-96 p-4 space-y-6 overflow-y-auto bg-slate-800 h-full custom-scrollbar">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-white">Window Configuration</h2>
        <button 
            onClick={onClose} 
            className="p-2 rounded-full hover:bg-slate-700 text-slate-400 hover:text-white lg:hidden" 
            aria-label="Collapse panel"
        >
            <ChevronLeftIcon className="w-6 h-6" />
        </button>
      </div>

      <Card title="Design Type">
          <div className="grid grid-cols-2 bg-slate-700 rounded-md p-1 gap-1">
              <button onClick={() => setConfig('windowType', WindowType.SLIDING)} className={`p-2 text-sm font-semibold rounded ${windowType === WindowType.SLIDING ? 'bg-indigo-600 text-white' : 'text-slate-300 hover:bg-slate-600'}`}>Sliding</button>
              <button onClick={() => setConfig('windowType', WindowType.CASEMENT)} className={`p-2 text-sm font-semibold rounded ${windowType === WindowType.CASEMENT ? 'bg-indigo-600 text-white' : 'text-slate-300 hover:bg-slate-600'}`}>Casement</button>
              <button onClick={() => setConfig('windowType', WindowType.VENTILATOR)} className={`p-2 text-sm font-semibold rounded ${windowType === WindowType.VENTILATOR ? 'bg-indigo-600 text-white' : 'text-slate-300 hover:bg-slate-600'}`}>Ventilator</button>
              <button onClick={() => setConfig('windowType', WindowType.GLASS_PARTITION)} className={`p-2 text-sm font-semibold rounded ${windowType === WindowType.GLASS_PARTITION ? 'bg-indigo-600 text-white' : 'text-slate-300 hover:bg-slate-600'}`}>Partition</button>
          </div>
      </Card>
      
      <Card title="Overall Dimensions">
        <DimensionInput label="Total Width" value_mm={config.width} onChange_mm={v => setConfig('width', v)} placeholder="e.g., 1800" />
        <DimensionInput label="Total Height" value_mm={config.height} onChange_mm={v => setConfig('height', v)} placeholder="e.g., 1200" />
      </Card>

      {windowType === WindowType.SLIDING && (
        <Card title="Track & Shutter Setup">
            <Select label="Track Type" value={config.trackType} onChange={(e) => setConfig('trackType', parseInt(e.target.value) as TrackType)}>
            <option value={TrackType.TWO_TRACK}>2-Track</option>
            <option value={TrackType.THREE_TRACK}>3-Track</option>
            </Select>
            <Select label="Shutter Configuration" value={config.shutterConfig} onChange={(e) => setConfig('shutterConfig', e.target.value as ShutterConfigType)}>
            {config.trackType === TrackType.TWO_TRACK && <option value="2G">2 Glass Shutters</option>}
            {config.trackType === TrackType.TWO_TRACK && <option value="4G">4 Glass Shutters</option>}
            {config.trackType === TrackType.THREE_TRACK && <option value="3G">3 Glass Shutters</option>}
            {config.trackType === TrackType.THREE_TRACK && <option value="2G1M">2 Glass + 1 Mesh Shutter</option>}
            </Select>
            {config.fixedShutters.length > 0 && (
              <div className="pt-2">
                <label className="block text-sm font-medium text-slate-300 mb-2">Shutter Fixing</label>
                <div className="grid grid-cols-2 gap-2">
                    {config.fixedShutters.map((_, i) => (
                        <label key={i} className="flex items-center space-x-2 p-2 bg-slate-700 rounded-md cursor-pointer hover:bg-slate-600">
                            <input type="checkbox" checked={config.fixedShutters[i] || false} onChange={e => handleFixShutterChange(i, e.target.checked)} className="w-4 h-4 rounded bg-slate-800 border-slate-500 text-indigo-600 focus:ring-indigo-500"/>
                            <span className="text-sm text-slate-200">Fix Shutter {i + 1}</span>
                        </label>
                    ))}
                </div>
              </div>
            )}
        </Card>
      )}

      {(windowType === WindowType.CASEMENT || windowType === WindowType.VENTILATOR) && (
          <Card title="Grid Layout">
              <div className="grid grid-cols-2 gap-4">
                  <Input label="Rows" type="number" inputMode="numeric" value={gridRows} min={1} onChange={e => setGridSize(Math.max(1, parseInt(e.target.value) || 1), gridCols)} />
                  <Input label="Columns" type="number" inputMode="numeric" value={gridCols} min={1} onChange={e => setGridSize(gridRows, Math.max(1, parseInt(e.target.value) || 1))} />
              </div>
              <div className="mt-4">
                  <label className="block text-sm font-medium text-slate-300 mb-2">Panel Configuration (Click to toggle)</label>
                  <p className="text-xs text-slate-400 mb-2">You can also click grid lines on the canvas to merge panels.</p>
                  <div className="bg-slate-900 p-2 rounded-md">
                    <div className="grid gap-1" style={{gridTemplateRows: `repeat(${gridRows}, 1fr)`, gridTemplateColumns: `repeat(${gridCols}, 1fr)`}}>
                        {Array.from({length: gridRows * gridCols}).map((_, index) => {
                            const row = Math.floor(index / gridCols);
                            const col = index % gridCols;
                            
                            if (windowType === WindowType.CASEMENT) {
                                const isDoor = config.doorPositions.some(p => p.row === row && p.col === col);
                                return ( <button key={`${row}-${col}`} onClick={() => toggleDoorPosition(row, col)} className={`aspect-square rounded text-xs font-semibold flex items-center justify-center ${isDoor ? 'bg-indigo-500 text-white' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'}`}>{isDoor ? 'Door' : 'Fixed'}</button> );
                            }
                            if (windowType === WindowType.VENTILATOR) {
                                const cell = config.ventilatorGrid[row]?.[col];
                                const cellType = cell?.type || 'glass';
                                const colorClass = cellType === 'door' ? 'bg-indigo-500 text-white' 
                                                 : cellType === 'louvers' ? 'bg-sky-600 text-white' 
                                                 : cellType === 'exhaust_fan' ? 'bg-teal-600 text-white'
                                                 : 'bg-slate-700 text-slate-300 hover:bg-slate-600';
                                return ( <button key={`${row}-${col}`} onClick={() => onVentilatorCellClick(row, col)} className={`aspect-square rounded text-xs font-semibold flex items-center justify-center ${colorClass}`}>{getVentilatorCellLabel(cellType)}</button> );
                            }
                            return null;
                        })}
                    </div>
                  </div>
              </div>
          </Card>
      )}

      {windowType === WindowType.GLASS_PARTITION && (
        <Card title="Partition Panel Setup">
          <Input label="Number of Panels" type="number" min={1} max={8} inputMode="numeric" value={config.partitionPanels.count} onChange={e => setConfig('partitionPanels', {...config.partitionPanels, count: Math.max(1, parseInt(e.target.value) || 1) })}/>
          {config.partitionPanels.count > 0 && (
            <div className="pt-2">
              <label className="block text-sm font-medium text-slate-300 mb-2">Panel Types (Click to cycle)</label>
              <div className="grid grid-cols-2 gap-2">
                  {Array.from({length: config.partitionPanels.count}).map((_, i) => {
                      const type = config.partitionPanels.types[i]?.type || 'fixed';
                      const colorClass = type === 'sliding' ? 'bg-sky-600 text-white' : type === 'hinged' ? 'bg-indigo-500 text-white' : 'bg-slate-700 text-slate-300';
                      return (
                          <button key={i} onClick={() => cyclePartitionPanelType(i)} className={`p-2 rounded-md text-sm font-semibold text-center capitalize ${colorClass} hover:opacity-80`}>
                              Panel {i + 1}: {type}
                          </button>
                      )
                  })}
              </div>
            </div>
          )}
        </Card>
      )}

      {operablePanels.length > 0 && (
          <Card title="Handle Configuration">
              <Select label="Select Panel" value={selectedPanelId} onChange={e => setSelectedPanelId(e.target.value)}>
                {operablePanels.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}
              </Select>
              {selectedPanelId && (
                  <div className="p-2 bg-slate-700 rounded-md space-y-3">
                      <label className="flex items-center space-x-2 cursor-pointer">
                          <input 
                              type="checkbox" 
                              checked={!!currentHandle} 
                              onChange={e => onUpdateHandle(selectedPanelId, e.target.checked ? { x: 50, y: 50, orientation: 'vertical' } : null)}
                              className="w-4 h-4 rounded bg-slate-800 border-slate-500 text-indigo-600 focus:ring-indigo-500"
                          />
                          <span className="text-sm text-slate-200">Enable Handle</span>
                      </label>
                      {currentHandle && (
                          <div className="space-y-3">
                              <Slider 
                                label={`Horizontal Position: ${currentHandle.x}%`}
                                value={currentHandle.x}
                                onChange={e => onUpdateHandle(selectedPanelId, {...currentHandle, x: parseInt(e.target.value)})}
                              />
                              <Slider 
                                label={`Vertical Position: ${currentHandle.y}%`}
                                value={currentHandle.y}
                                onChange={e => onUpdateHandle(selectedPanelId, {...currentHandle, y: parseInt(e.target.value)})}
                              />
                               <div className="grid grid-cols-2 gap-2">
                                <Button variant={currentHandle.orientation === 'vertical' ? 'primary' : 'secondary'} onClick={() => onUpdateHandle(selectedPanelId, {...currentHandle, orientation: 'vertical'})}>Vertical</Button>
                                <Button variant={currentHandle.orientation === 'horizontal' ? 'primary' : 'secondary'} onClick={() => onUpdateHandle(selectedPanelId, {...currentHandle, orientation: 'horizontal'})}>Horizontal</Button>
                              </div>
                          </div>
                      )}
                  </div>
              )}
          </Card>
      )}

      <Card title="Appearance">
        <Select label="Glass Tint" value={config.glassType} onChange={(e) => setConfig('glassType', e.target.value as GlassType)}>
          <option value="clear">Clear</option>
          <option value="frosted">Frosted</option>
          <option value="tinted-blue">Tinted Blue</option>
        </Select>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Select label="Glass Thickness" value={config.glassThickness} onChange={e => setConfig('glassThickness', e.target.value as WindowConfig['glassThickness'])}>
                <option value="">Auto</option>
                {series.glassOptions.thicknesses.map(t => <option key={t} value={t}>{t} mm</option>)}
                {series.glassOptions.customThicknessAllowed && <option value="custom">Custom...</option>}
            </Select>
            {config.glassThickness === 'custom' && (
              <Input 
                label="Custom Thickness" 
                type="number"
                inputMode="decimal"
                unit="mm" 
                className="mt-2"
                value={config.customGlassThickness} 
                onChange={e => setConfig('customGlassThickness', e.target.value === '' ? '' : Number(e.target.value))}
                placeholder="e.g., 7"
              />
            )}
          </div>
           <div>
              <Select label="Special Type" value={config.glassSpecialType} onChange={e => setConfig('glassSpecialType', e.target.value as GlassSpecialType)}>
                  <option value="none">None</option>
                  {series.glassOptions.specialTypes.map(t => <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>)}
                  <option value="custom">Custom...</option>
              </Select>
              {config.glassSpecialType === 'custom' && (
                  <Input 
                      label="Custom Type Name"
                      type="text"
                      className="mt-2"
                      value={config.customGlassSpecialType}
                      onChange={e => setConfig('customGlassSpecialType', e.target.value)}
                      placeholder="e.g., Toughened"
                  />
              )}
           </div>
        </div>
        
        <div className="pt-4 mt-4 border-t border-slate-700">
             <label className="block text-sm font-medium text-slate-300 mb-2">Glass Grid</label>
             <div className="grid grid-cols-2 gap-4">
                <Input label="Rows" type="number" inputMode="numeric" min="0" value={config.glassGrid.rows} onChange={e => setConfig('glassGrid', {...config.glassGrid, rows: Math.max(0, parseInt(e.target.value) || 0)})} />
                <Input label="Columns" type="number" inputMode="numeric" min="0" value={config.glassGrid.cols} onChange={e => setConfig('glassGrid', {...config.glassGrid, cols: Math.max(0, parseInt(e.target.value) || 0)})} />
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
            {!isAddingColor ? (
                <Button variant="secondary" className="w-full" onClick={() => setIsAddingColor(true)}><PlusIcon className="w-4 h-4 mr-2"/> Add New Color</Button>
            ) : (
                <div className="p-2 bg-slate-700 rounded-md space-y-2">
                    <Input label="Color Name" value={newColor.name} onChange={e => setNewColor({...newColor, name: e.target.value})} placeholder="e.g., Anodized Bronze" />
                    <Input label="Color Hex" type="color" value={newColor.hex} onChange={e => setNewColor({...newColor, hex: e.target.value})} className="w-full h-10 p-1"/>
                    <div className="grid grid-cols-2 gap-2">
                        <Button onClick={handleAddColor} disabled={!newColor.name.trim()}>Save Color</Button>
                        <Button variant="secondary" onClick={() => setIsAddingColor(false)}>Cancel</Button>
                    </div>
                </div>
            )}
        </div>
      </Card>
      
      {windowType !== WindowType.GLASS_PARTITION && (
        <Card title="Fixed Panels">
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
        </Card>
      )}

      <Card title="Profile Series Dimensions">
        <div className="space-y-2">
          <Select label="Active Profile" value={series.id} onChange={(e) => onSeriesSelect(e.target.value)}>
            {filteredAvailableSeries.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
             {!filteredAvailableSeries.some(s => s.id === series.id) && <option value={series.id} disabled>Custom (Unsaved)</option>}
          </Select>
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

        {windowType === WindowType.SLIDING && (
            <>
                <DimensionInput label="Outer Frame" value_mm={series.dimensions.outerFrame} onChange_mm={val => handleDimensionChange('outerFrame', val)}/>
                <DimensionInput label="Fixed Panel Frame" value_mm={series.dimensions.fixedFrame} onChange_mm={val => handleDimensionChange('fixedFrame', val)} />
                <DimensionInput label="Shutter Handle" value_mm={series.dimensions.shutterHandle} onChange_mm={val => handleDimensionChange('shutterHandle', val)} />
                <DimensionInput label="Shutter Interlock" value_mm={series.dimensions.shutterInterlock} onChange_mm={val => handleDimensionChange('shutterInterlock', val)} />
                <DimensionInput label="Shutter Meeting" value_mm={series.dimensions.shutterMeeting} onChange_mm={val => handleDimensionChange('shutterMeeting', val)} />
                <DimensionInput label="Shutter Top/Bottom" value_mm={series.dimensions.shutterTop} onChange_mm={val => handleDimensionChange('shutterTop', val)} />
            </>
        )}
        {(windowType === WindowType.CASEMENT || windowType === WindowType.VENTILATOR) && (
            <>
                <DimensionInput label="Outer Frame" value_mm={series.dimensions.outerFrame} onChange_mm={val => handleDimensionChange('outerFrame', val)}/>
                <DimensionInput label="Fixed Panel Frame" value_mm={series.dimensions.fixedFrame} onChange_mm={val => handleDimensionChange('fixedFrame', val)} />
                <DimensionInput label="Shutter/Door Frame" value_mm={series.dimensions.casementShutter} onChange_mm={val => handleDimensionChange('casementShutter', val)} />
                <DimensionInput label="Mullion Profile" value_mm={series.dimensions.mullion} onChange_mm={val => handleDimensionChange('mullion', val)} />
            </>
        )}
        {windowType === WindowType.VENTILATOR && (
            <DimensionInput label="Louver Blade" value_mm={series.dimensions.louverBlade} onChange_mm={val => handleDimensionChange('louverBlade', val)} />
        )}
        {windowType === WindowType.GLASS_PARTITION && (
            <>
                <DimensionInput label="Fixed Panel Frame" value_mm={series.dimensions.fixedFrame} onChange_mm={val => handleDimensionChange('fixedFrame', val)} />
                <DimensionInput label="Hinged Panel Frame" value_mm={series.dimensions.casementShutter} onChange_mm={val => handleDimensionChange('casementShutter', val)} />
                <DimensionInput label="Top Track Height" value_mm={series.dimensions.topTrack} onChange_mm={val => handleDimensionChange('topTrack', val)} />
                <DimensionInput label="Bottom Track Height" value_mm={series.dimensions.bottomTrack} onChange_mm={val => handleDimensionChange('bottomTrack', val)} />
                <DimensionInput label="Glass Grid Profile" value_mm={series.dimensions.glassGridProfile} onChange_mm={val => handleDimensionChange('glassGridProfile', val)} />
            </>
        )}

      </Card>

      <Card title="Hardware Configuration">
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
                           <Select label="Unit" value={item.unit} onChange={(e) => onHardwareChange(item.id, 'unit', e.target.value)}>
                              <option value="per_shutter_or_door">Per Door/Panel</option>
                              <option value="per_window">Per Window</option>
                          </Select>
                      </div>
                  </div>
              ))}
          </div>
          <Button onClick={onAddHardware} variant="secondary" className="w-full mt-4"><PlusIcon className="w-4 h-4 mr-2"/> Add Hardware Item</Button>
      </Card>
    </div>
  );
};