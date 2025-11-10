import type { WindowConfig, QuotationItem, ProfileDimensions, BOM, BOMSeries, BOMHardware, BOMProfile, GlassType, BOMGlass, BOMMesh } from '../types';
import { WindowType, ShutterConfigType, FixedPanelPosition } from '../types';

const FEET_TO_MM = 304.8;
const SQFT_TO_SQMM = 92903.04;
const SQMT_TO_SQMM = 1000000;
const DEFAULT_STANDARD_LENGTH_MM = 16 * FEET_TO_MM; // 4876.8

/**
 * First-Fit Decreasing bin packing algorithm.
 * Tries to fit a list of pieces into the minimum number of standard-length bars.
 */
function packPieces(pieces: number[], standardLength: number): number {
    if (pieces.length === 0) return 0;
    
    const sortedPieces = [...pieces].sort((a, b) => b - a);
    const bins: number[] = []; // Stores remaining space in each bar

    for (const piece of sortedPieces) {
        if (piece > standardLength) {
             // If a piece is larger than the standard length, it requires a special bar of its own size.
             // This is a simplification; in reality, this might require a special order or joining.
             // For counting purposes, each oversized piece counts as one special 'bin'.
             bins.push(0); // Add a full bin that can't be used further
             continue;
        };
        
        let placed = false;
        for (let i = 0; i < bins.length; i++) {
            if (piece <= bins[i]) {
                bins[i] -= piece;
                placed = true;
                break;
            }
        }

        if (!placed) {
            bins.push(standardLength - piece);
        }
    }
    return bins.length;
}

function getGlassDescription(config: WindowConfig): string {
    const formatType = (type: string) => type.replace(/_/g, ' ').replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());

    if (config.windowType === WindowType.MIRROR) {
        if (config.customGlassName) {
            return /\d+\s*mm/i.test(config.customGlassName) ? config.customGlassName : `${config.glassThickness || '?'}mm ${config.customGlassName}`;
        }
        return `${config.glassThickness || '?'}mm Mirror`;
    }

    if (config.glassSpecialType === 'laminated' && config.laminatedGlassConfig) {
        const { glass1Thickness, glass1Type, pvbThickness, glass2Thickness, glass2Type, isToughened } = config.laminatedGlassConfig;
        return `${glass1Thickness || '?'}mm ${formatType(glass1Type)} + ${pvbThickness || '?'}mm PVB + ${glass2Thickness || '?'}mm ${formatType(glass2Type)}${isToughened ? ' (Toughened)' : ''}`;
    }
    if (config.glassSpecialType === 'dgu' && config.dguGlassConfig) {
        const { glass1Thickness, glass1Type, airGap, glass2Thickness, glass2Type, isToughened } = config.dguGlassConfig;
        return `${glass1Thickness || '?'}mm ${formatType(glass1Type)} + ${airGap || '?'}mm Air Gap + ${glass2Thickness || '?'}mm ${formatType(glass2Type)}${isToughened ? ' (Toughened)' : ''}`;
    }
    
    let desc = `${config.glassThickness}mm ${formatType(config.glassType as GlassType)}`;
    if (config.customGlassName) {
        desc += ` - ${config.customGlassName}`;
    }
    return desc;
}

/**
 * Calculates profile, glass, mesh, and Georgian bar usage for a single window configuration.
 * This function recursively calls itself for corner window sides.
 */
function calculateUsage(config: WindowConfig): { 
    profiles: Map<keyof ProfileDimensions, number[]>, 
    glass: Map<string, number>, 
    mesh: number 
} {
    const profileUsage = new Map<keyof ProfileDimensions, number[]>();
    const glassUsage = new Map<string, number>();
    let meshArea = 0;

    const { series, fixedPanels } = config;
    const dims = series.dimensions;

    const addProfile = (key: keyof ProfileDimensions, ...lengths: number[]) => {
        if (!dims[key] || Number(dims[key]) === 0) return;
        const validLengths = lengths.filter(l => l > 0);
        if (validLengths.length === 0) return;
        if (!profileUsage.has(key)) profileUsage.set(key, []);
        profileUsage.get(key)!.push(...validLengths);
    };

    const addGlass = (panelId: string, width: number, height: number) => {
        if (width <= 0 || height <= 0) return;
        const area = width * height;
        const desc = getGlassDescription(config);
        glassUsage.set(desc, (glassUsage.get(desc) || 0) + area);
        
        // Georgian Bars
        const { glassGrid } = config;
        const pattern = glassGrid.applyToAll ? glassGrid.patterns['default'] : (glassGrid.patterns[panelId] || glassGrid.patterns['default']);
        if (pattern) {
            if (pattern.horizontal.count > 0) addProfile('glassGridProfile', ...Array(pattern.horizontal.count).fill(width));
            if (pattern.vertical.count > 0) addProfile('glassGridProfile', ...Array(pattern.vertical.count).fill(height));
        }
    };
    
    const addMesh = (panelId: string, width: number, height: number) => {
         if (width <= 0 || height <= 0) return;
         meshArea += width * height;
         // Georgian bars on mesh are not standard, but check just in case
         const { glassGrid } = config;
         const pattern = glassGrid.applyToAll ? glassGrid.patterns['default'] : (glassGrid.patterns[panelId] || glassGrid.patterns['default']);
         if (pattern) {
             if (pattern.horizontal.count > 0) addProfile('glassGridProfile', ...Array(pattern.horizontal.count).fill(width));
             if (pattern.vertical.count > 0) addProfile('glassGridProfile', ...Array(pattern.vertical.count).fill(height));
         }
    }

    if (config.windowType === WindowType.CORNER && config.leftConfig && config.rightConfig) {
        const leftConfig: WindowConfig = { ...config, ...config.leftConfig, width: config.leftWidth, height: config.height, windowType: config.leftConfig.windowType, fixedPanels: [] };
        const rightConfig: WindowConfig = { ...config, ...config.rightConfig, width: config.rightWidth, height: config.height, windowType: config.rightConfig.windowType, fixedPanels: [] };
        
        const leftUsage = calculateUsage(leftConfig);
        const rightUsage = calculateUsage(rightConfig);
        
        const mergedUsage = { profiles: leftUsage.profiles, glass: leftUsage.glass, mesh: leftUsage.mesh };

        for (const [key, pieces] of rightUsage.profiles.entries()) {
            if (mergedUsage.profiles.has(key)) mergedUsage.profiles.get(key)!.push(...pieces);
            else mergedUsage.profiles.set(key, pieces);
        }
        for (const [desc, area] of rightUsage.glass.entries()) {
            mergedUsage.glass.set(desc, (mergedUsage.glass.get(desc) || 0) + area);
        }
        mergedUsage.mesh += rightUsage.mesh;

        addProfile('outerFrame', Number(config.height) || 0, Number(config.height) || 0);
        return mergedUsage;
    }

    const w = Number(config.width) || 0;
    const h = Number(config.height) || 0;
    const frame = Number(dims.outerFrame) || 0;
    const verticalFrame = (dims.outerFrameVertical && Number(dims.outerFrameVertical) > 0) ? Number(dims.outerFrameVertical) : frame;

    const topFix = fixedPanels.find(p => p.position === FixedPanelPosition.TOP);
    const bottomFix = fixedPanels.find(p => p.position === FixedPanelPosition.BOTTOM);
    const leftFix = fixedPanels.find(p => p.position === FixedPanelPosition.LEFT);
    const rightFix = fixedPanels.find(p => p.position === FixedPanelPosition.RIGHT);

    const isFramed = config.windowType !== WindowType.GLASS_PARTITION && config.windowType !== WindowType.CORNER && config.windowType !== WindowType.LOUVERS && config.windowType !== WindowType.MIRROR;
    const holeX1 = leftFix ? leftFix.size : (isFramed ? verticalFrame : 0);
    const holeY1 = topFix ? topFix.size : (isFramed ? frame : 0);
    const holeX2 = rightFix ? w - rightFix.size : w - (isFramed ? verticalFrame : 0);
    const holeY2 = bottomFix ? h - bottomFix.size : h - (isFramed ? frame : 0);
    
    const innerW = Math.max(0, holeX2 - holeX1);
    const innerH = Math.max(0, holeY2 - holeY1);

    if (isFramed) {
        if (verticalFrame !== frame) {
            addProfile('outerFrame', w, w);
            addProfile('outerFrameVertical', h, h);
        } else {
            addProfile('outerFrame', w, w, h, h);
        }
    }
    
    if (topFix) addProfile('fixedFrame', innerW);
    if (bottomFix) addProfile('fixedFrame', innerW);
    if (leftFix) addProfile('fixedFrame', innerH);
    if (rightFix) addProfile('fixedFrame', innerH);
    
    if (topFix) addGlass('fixed-top', innerW, topFix.size - frame - Number(dims.fixedFrame));
    if (bottomFix) addGlass('fixed-bottom', innerW, bottomFix.size - frame - Number(dims.fixedFrame));
    if (leftFix) addGlass('fixed-left', leftFix.size - verticalFrame - Number(dims.fixedFrame), innerH);
    if (rightFix) addGlass('fixed-right', rightFix.size - verticalFrame - Number(dims.fixedFrame), innerH);
    
    switch (config.windowType) {
        case WindowType.SLIDING: {
            const { shutterConfig } = config;
            const interlock = Number(dims.shutterInterlock) || 0;

            if (shutterConfig === ShutterConfigType.FOUR_GLASS_TWO_MESH) {
                const shutterW = (innerW + 3 * interlock) / 4;
                for (let i = 0; i < 6; i++) {
                    addProfile('shutterTop', shutterW);
                    addProfile('shutterBottom', shutterW);
                    const isMesh = i === 2 || i === 3;
                    const glassW = shutterW - (i === 0 || i === 2 ? Number(dims.shutterHandle) : interlock) - (i === 3 || i === 5 ? Number(dims.shutterHandle) : interlock);
                    const glassH = innerH - Number(dims.shutterTop) - Number(dims.shutterBottom);
                    if (isMesh) addMesh(`sliding-${i}`, glassW, glassH);
                    else addGlass(`sliding-${i}`, glassW, glassH);
                }
                addProfile('shutterHandle', innerH, innerH, innerH, innerH); // 4 handles
                addProfile('shutterInterlock', innerH, innerH, innerH, innerH, innerH, innerH, innerH, innerH); // 8 interlocks
            } else if (shutterConfig === ShutterConfigType.FOUR_GLASS) {
                const meeting = Number(dims.shutterMeeting) || 0;
                const shutterW = (innerW + (2 * interlock) + meeting) / 4;
                 const profiles = [ { l: Number(dims.shutterHandle), r: interlock }, { l: interlock, r: meeting }, { l: meeting, r: interlock }, { l: interlock, r: Number(dims.shutterHandle) } ];
                for (let i = 0; i < 4; i++) {
                    addProfile('shutterTop', shutterW); addProfile('shutterBottom', shutterW);
                    addGlass(`sliding-${i}`, shutterW - profiles[i].l - profiles[i].r, innerH - Number(dims.shutterTop) - Number(dims.shutterBottom));
                }
                addProfile('shutterHandle', innerH, innerH); addProfile('shutterInterlock', innerH, innerH, innerH, innerH); addProfile('shutterMeeting', innerH, innerH);
            } else {
                const hasMesh = shutterConfig === ShutterConfigType.TWO_GLASS_ONE_MESH;
                const numShutters = shutterConfig === ShutterConfigType.TWO_GLASS ? 2 : 3;
                const shutterDivider = hasMesh ? 2 : numShutters;
                const shutterW = (innerW + (shutterDivider - 1) * interlock) / shutterDivider;
                for (let i = 0; i < numShutters; i++) {
                    addProfile('shutterTop', shutterW); addProfile('shutterBottom', shutterW);
                    const isMesh = hasMesh && i === 2;
                    const glassW = shutterW - (i === 0 ? Number(dims.shutterHandle) : interlock) - (i === numShutters-1 ? Number(dims.shutterHandle) : interlock);
                    const glassH = innerH - Number(dims.shutterTop) - Number(dims.shutterBottom);
                    if (isMesh) addMesh(`sliding-${i}`, glassW, glassH);
                    else addGlass(`sliding-${i}`, glassW, glassH);
                }
                addProfile('shutterHandle', innerH, innerH);
                addProfile('shutterInterlock', ...Array((numShutters - 1) * 2).fill(innerH));
            }
            break;
        }
        // ... other cases
    }
    
    return { profiles: profileUsage, glass: glassUsage, mesh: meshArea };
}


/**
 * Generates a complete Bill of Materials from a list of quotation items.
 */
export function generateBillOfMaterials(items: QuotationItem[]): BOM {
    const seriesMap = new Map<string, { 
        name: string; 
        profiles: Map<keyof ProfileDimensions, number[]>; 
        hardware: Map<string, number>; 
        series: QuotationItem['config']['series'];
        glass: Map<string, number>; // area in mm^2
        meshArea: number; // area in mm^2
    }>();

    for (const item of items) {
        const { config, quantity } = item;
        const { series } = config;

        if (!seriesMap.has(series.id)) {
            seriesMap.set(series.id, {
                name: series.name,
                profiles: new Map(),
                hardware: new Map(),
                series: series,
                glass: new Map(),
                meshArea: 0,
            });
        }
        const seriesData = seriesMap.get(series.id)!;

        // Calculate usage for one item
        const singleUsage = calculateUsage(config);
        
        // Add usage for all quantities of the item
        for (let i = 0; i < quantity; i++) {
            for (const [key, pieces] of singleUsage.profiles.entries()) {
                if (!seriesData.profiles.has(key)) seriesData.profiles.set(key, []);
                seriesData.profiles.get(key)!.push(...pieces);
            }
            for (const [desc, area] of singleUsage.glass.entries()) {
                seriesData.glass.set(desc, (seriesData.glass.get(desc) || 0) + area);
            }
            seriesData.meshArea += singleUsage.mesh;
        }
        
        // Calculate and add hardware for all quantities
        for (const hw of series.hardwareItems) {
            const qtyPerUnit = Number(hw.qtyPerShutter) || 0;
            let unitsPerWindow = 0;
            if (hw.unit === 'per_window') {
                unitsPerWindow = 1;
            } else if (hw.unit === 'per_shutter_or_door') {
                // This logic needs to be robust for all window types
                 switch(config.windowType) {
                    case WindowType.SLIDING:
                        switch(config.shutterConfig) {
                            case ShutterConfigType.TWO_GLASS: unitsPerWindow = 2; break;
                            case ShutterConfigType.THREE_GLASS: case ShutterConfigType.TWO_GLASS_ONE_MESH: unitsPerWindow = 3; break;
                            case ShutterConfigType.FOUR_GLASS: unitsPerWindow = 4; break;
                            case ShutterConfigType.FOUR_GLASS_TWO_MESH: unitsPerWindow = 6; break;
                        }
                        break;
                    case WindowType.CASEMENT: unitsPerWindow = config.doorPositions.length; break;
                    case WindowType.GLASS_PARTITION: unitsPerWindow = config.partitionPanels.types.filter(t => t.type !== 'fixed').length; break;
                    case WindowType.VENTILATOR:
                        const doorCells = config.ventilatorGrid.flat().filter(c => c.type === 'door').length;
                        const louverCells = config.ventilatorGrid.flat().filter(c => c.type === 'louvers').length;
                        unitsPerWindow = hw.name.toLowerCase().includes('louver') ? louverCells : doorCells;
                        break;
                }
            }
            const totalQty = qtyPerUnit * unitsPerWindow * quantity;
            if (totalQty > 0) {
                seriesData.hardware.set(hw.name, (seriesData.hardware.get(hw.name) || 0) + totalQty);
            }
        }
    }

    const bom: BOM = [];
    for (const [seriesId, data] of seriesMap.entries()) {
        const bomSeries: BOMSeries = {
            seriesId,
            seriesName: data.name,
            profiles: [],
            hardware: [],
            glass: [],
        };

        for (const [profileKey, pieces] of data.profiles.entries()) {
            const stdLengthKey = profileKey as keyof ProfileDimensions;
            const standardLength = Number(data.series.lengths?.[stdLengthKey]) || DEFAULT_STANDARD_LENGTH_MM;
            const requiredBars = packPieces(pieces, standardLength);
            const totalLength = pieces.reduce((sum, p) => sum + p, 0);
            const weightPerMeter = Number(data.series.weights?.[stdLengthKey]) || 0;
            
            const bomProfile: BOMProfile = {
                profileKey: profileKey as keyof ProfileDimensions,
                totalLength, standardLength, weightPerMeter, pieces, requiredBars,
                totalWeight: (totalLength / 1000) * weightPerMeter,
            };
            bomSeries.profiles.push(bomProfile);
        }

        for (const [name, totalQuantity] of data.hardware.entries()) {
            bomSeries.hardware.push({ name, totalQuantity });
        }
        
        for (const [description, totalArea] of data.glass.entries()) {
            bomSeries.glass.push({
                description,
                totalAreaSqFt: totalArea / SQFT_TO_SQMM,
                totalAreaSqMt: totalArea / SQMT_TO_SQMM,
            });
        }

        if (data.meshArea > 0) {
            bomSeries.mesh = {
                totalAreaSqFt: data.meshArea / SQFT_TO_SQMM,
                totalAreaSqMt: data.meshArea / SQMT_TO_SQMM,
            };
        }
        
        bom.push(bomSeries);
    }

    return bom;
}