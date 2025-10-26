import React, { useState, useMemo, useEffect } from 'react';
// FIX: Import the correct GlassGridConfig type.
import { WindowConfig, GlassGridConfig, WindowType } from '../types';

interface GeorgianBarsPanelProps {
    config: WindowConfig;
    setConfig: (field: 'glassGrid', value: GlassGridConfig) => void;
}

const Slider: React.FC<React.InputHTMLAttributes<HTMLInputElement> & { label: string, unit?: string }> = ({ label, unit, ...props }) => (
    <div className='flex-1'>
        <label className="block text-xs font-medium text-slate-300 mb-1">{label} <span className='text-slate-400'>{props.value}{unit}</span></label>
        <input type="range" className="w-full h-2 bg-slate-600 rounded-lg appearance-none cursor-pointer accent-indigo-500" {...props} />
    </div>
);

export const GeorgianBarsPanel: React.FC<GeorgianBarsPanelProps> = ({ config, setConfig }) => {
    const { glassGrid, windowType } = config;

    const availablePanels = useMemo(() => {
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
    
    const [activePanelId, setActivePanelId] = useState('default');
    
    useEffect(() => {
        if (!glassGrid.applyToAll && !availablePanels.some(p => p.id === activePanelId)) {
            setActivePanelId('default');
        }
    }, [availablePanels, activePanelId, glassGrid.applyToAll]);

    const activePattern = glassGrid.patterns[activePanelId] || glassGrid.patterns['default'];
    
    const handlePatternChange = (direction: 'horizontal' | 'vertical', field: 'count' | 'offset' | 'gap', value: number) => {
        const newPatterns = { ...glassGrid.patterns };
        const targetId = glassGrid.applyToAll ? 'default' : activePanelId;

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
        if(e.target.checked) setActivePanelId('default');
    }

    return (
        <div className="absolute bottom-0 left-0 right-0 bg-slate-800/80 backdrop-blur-sm border-t-2 border-slate-700 p-3 z-20 no-print">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 max-w-4xl mx-auto">
                {/* --- Settings --- */}
                <div className='space-y-3'>
                    <h4 className="text-sm font-semibold text-white">Georgian Bars Settings</h4>
                    <label className="flex items-center space-x-2 cursor-pointer">
                        <input type="checkbox" checked={glassGrid.applyToAll} onChange={handleApplyToAllChange} className="w-4 h-4 rounded bg-slate-800 border-slate-500 text-indigo-600 focus:ring-indigo-500" />
                        <span className="text-sm text-slate-200">Apply to All Panels</span>
                    </label>

                    {!glassGrid.applyToAll && (
                        <div>
                            <label className="block text-xs font-medium text-slate-300 mb-1">Target Panel</label>
                            <select value={activePanelId} onChange={e => setActivePanelId(e.target.value)} className="w-full px-2 py-1 bg-slate-700 border border-slate-600 rounded-md shadow-sm text-white focus:outline-none focus:ring-1 focus:ring-indigo-500 sm:text-xs">
                                <option value="default">Default</option>
                                {availablePanels.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                            </select>
                        </div>
                    )}
                </div>

                {/* --- Horizontal Bars --- */}
                <div className="space-y-3 p-3 bg-slate-900/50 rounded-md">
                     <h4 className="text-sm font-semibold text-white">Horizontal Bars</h4>
                     <div className='flex items-end gap-4'>
                        <Slider label="Offset" unit='mm' min={0} max={1000} step={10} value={activePattern.horizontal.offset} onChange={e => handlePatternChange('horizontal', 'offset', parseInt(e.target.value))} />
                        <Slider label="Gap" unit='mm' min={0} max={1000} step={10} value={activePattern.horizontal.gap} onChange={e => handlePatternChange('horizontal', 'gap', parseInt(e.target.value))} />
                     </div>
                </div>

                 {/* --- Vertical Bars --- */}
                <div className="space-y-3 p-3 bg-slate-900/50 rounded-md">
                     <h4 className="text-sm font-semibold text-white">Vertical Bars</h4>
                     <div className='flex items-end gap-4'>
                        <Slider label="Offset" unit='mm' min={0} max={1000} step={10} value={activePattern.vertical.offset} onChange={e => handlePatternChange('vertical', 'offset', parseInt(e.target.value))} />
                        <Slider label="Gap" unit='mm' min={0} max={1000} step={10} value={activePattern.vertical.gap} onChange={e => handlePatternChange('vertical', 'gap', parseInt(e.target.value))} />
                     </div>
                </div>
            </div>
        </div>
    );
};
