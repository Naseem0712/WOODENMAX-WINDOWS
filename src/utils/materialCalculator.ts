import type { WindowConfig, QuotationItem, ProfileDimensions, BOM, BOMSeries, BOMHardware, BOMProfile } from '../types';
import { WindowType, ShutterConfigType, FixedPanelPosition } from '../types';

const FEET_TO_MM = 304.8;
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
        if (piece > standardLength) continue; 
        
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

/**
 * Calculates the lengths of all profile pieces required for a single window configuration.
 */
function calculateProfileUsage(config: WindowConfig): Map<keyof ProfileDimensions, number[]> {
    const usage = new Map<keyof ProfileDimensions, number[]>();
    const { series, fixedPanels } = config;
    const dims = series.dimensions;

    const add = (key: keyof ProfileDimensions, ...lengths: number[]) => {
        if (!dims[key] || Number(dims[key]) === 0) return;
        const validLengths = lengths.filter(l => l > 0);
        if (validLengths.length === 0) return;

        if (!usage.has(key)) usage.set(key, []);
        usage.get(key)!.push(...validLengths);
    };

    const w = Number(config.width) || 0;
    const h = Number(config.height) || 0;
    const frame = Number(dims.outerFrame) || 0;

    const topFix = fixedPanels.find(p => p.position === FixedPanelPosition.TOP);
    const bottomFix = fixedPanels.find(p => p.position === FixedPanelPosition.BOTTOM);
    const leftFix = fixedPanels.find(p => p.position === FixedPanelPosition.LEFT);
    const rightFix = fixedPanels.find(p => p.position === FixedPanelPosition.RIGHT);

    const holeX1 = leftFix ? leftFix.size : frame;
    const holeY1 = topFix ? topFix.size : frame;
    const holeX2 = rightFix ? w - rightFix.size : w - frame;
    const holeY2 = bottomFix ? h - bottomFix.size : h - frame;

    const innerW = holeX2 - holeX1;
    const innerH = holeY2 - holeY1;

    // Outer Frame and Fixed Panels
    if (config.windowType !== WindowType.GLASS_PARTITION && config.windowType !== WindowType.CORNER) {
        add('outerFrame', w, w, h, h);
        if (topFix) add('fixedFrame', innerW);
        if (bottomFix) add('fixedFrame', innerW);
        if (leftFix) add('fixedFrame', innerH);
        if (rightFix) add('fixedFrame', innerH);
    }
    
    // Window-type specific calculations
    switch (config.windowType) {
        case WindowType.SLIDING: {
            const { shutterConfig } = config;
            const is4G = shutterConfig === ShutterConfigType.FOUR_GLASS;
            const numShutters = is4G ? 4 : (shutterConfig === ShutterConfigType.TWO_GLASS ? 2 : 3);
            const hasMesh = shutterConfig === ShutterConfigType.TWO_GLASS_ONE_MESH;
            const interlock = Number(dims.shutterInterlock) || 0;
            const meeting = Number(dims.shutterMeeting) || 0;

            if (is4G) {
                const shutterW = (innerW + (2 * interlock) + meeting) / 4;
                add('shutterTop', shutterW, shutterW, shutterW, shutterW);
                add('shutterBottom', shutterW, shutterW, shutterW, shutterW);
                add('shutterHandle', innerH, innerH);
                add('shutterInterlock', innerH, innerH, innerH, innerH);
                add('shutterMeeting', innerH, innerH);
            } else {
                const shutterDivider = hasMesh ? 2 : numShutters;
                const shutterW = (innerW + (shutterDivider - 1) * interlock) / shutterDivider;
                for (let i = 0; i < numShutters; i++) {
                    add('shutterTop', shutterW);
                    add('shutterBottom', shutterW);
                    if (i === 0 || i === numShutters - 1) add('shutterHandle', innerH);
                    if (i > 0) add('shutterInterlock', innerH);
                    if (i < numShutters - 1) add('shutterInterlock', innerH);
                }
            }
            break;
        }
        case WindowType.CASEMENT:
        case WindowType.VENTILATOR: {
            const { verticalDividers, horizontalDividers, doorPositions, ventilatorGrid } = config;
            const mullion = Number(dims.mullion) || 0;

            verticalDividers.forEach(() => add('mullion', innerH));
            horizontalDividers.forEach(() => add('mullion', innerW));

            const gridCols = verticalDividers.length + 1;
            const gridRows = horizontalDividers.length + 1;

            for (let r = 0; r < gridRows; r++) {
                for (let c = 0; c < gridCols; c++) {
                    const x_start_rel = c === 0 ? 0 : verticalDividers[c - 1];
                    const x_end_rel = c === verticalDividers.length ? 1 : verticalDividers[c];
                    const y_start_rel = r === 0 ? 0 : horizontalDividers[r - 1];
                    const y_end_rel = r === horizontalDividers.length ? 1 : horizontalDividers[r];
                    const cellW = (x_end_rel - x_start_rel) * innerW - (gridCols > 1 ? mullion : 0);
                    const cellH = (y_end_rel - y_start_rel) * innerH - (gridRows > 1 ? mullion : 0);

                    const isDoor = doorPositions.some(p => p.row === r && p.col === c);
                    const cellType = ventilatorGrid[r]?.[c]?.type;

                    if (isDoor || cellType === 'door') {
                        add('casementShutter', cellW, cellW, cellH, cellH);
                    }
                    if (cellType === 'louvers') {
                         if (dims.louverBlade && Number(dims.louverBlade) > 0) {
                            const bladeH = Number(dims.louverBlade);
                            const numLouvers = Math.ceil(cellH / bladeH);
                            for(let i=0; i<numLouvers; i++) add('louverBlade', cellW);
                         }
                    }
                }
            }
            break;
        }
    }
    return usage;
}


/**
 * Generates a complete Bill of Materials from a list of quotation items.
 */
export function generateBillOfMaterials(items: QuotationItem[]): BOM {
    const seriesMap = new Map<string, { name: string; profiles: Map<keyof ProfileDimensions, number[]>; hardware: Map<string, number>; series: QuotationItem['config']['series'] }>();

    for (const item of items) {
        const { config, quantity } = item;
        const { series } = config;

        if (!seriesMap.has(series.id)) {
            seriesMap.set(series.id, {
                name: series.name,
                profiles: new Map(),
                hardware: new Map(),
                series: series,
            });
        }
        const seriesData = seriesMap.get(series.id)!;

        // Calculate usage for one item
        const singleProfileUsage = calculateProfileUsage(config);
        
        // Add profiles for all quantities
        for (let i = 0; i < quantity; i++) {
            for (const [key, pieces] of singleProfileUsage.entries()) {
                if (!seriesData.profiles.has(key)) seriesData.profiles.set(key, []);
                seriesData.profiles.get(key)!.push(...pieces);
            }
        }
        
        // Calculate and add hardware for all quantities
        for (const hw of series.hardwareItems) {
            const qtyPerUnit = Number(hw.qtyPerShutter) || 0;
            let unitsPerWindow = 0;

            if (hw.unit === 'per_window') {
                unitsPerWindow = 1;
            } else if (hw.unit === 'per_shutter_or_door') {
                if (config.windowType === WindowType.VENTILATOR) {
                    const doorCells = config.ventilatorGrid.flat().filter(c => c.type === 'door').length;
                    const louverCells = config.ventilatorGrid.flat().filter(c => c.type === 'louvers').length;
                    const name = hw.name.toLowerCase();
                    if (name.includes('louver')) {
                        unitsPerWindow = louverCells;
                    } else {
                        unitsPerWindow = doorCells;
                    }
                } else {
                    switch(config.windowType) {
                        case WindowType.SLIDING: unitsPerWindow = config.shutterConfig === '2G' ? 2 : config.shutterConfig === '4G' ? 4 : 3; break;
                        case WindowType.CASEMENT: unitsPerWindow = config.doorPositions.length; break;
                        case WindowType.GLASS_PARTITION: unitsPerWindow = config.partitionPanels.types.filter(t => t.type !== 'fixed').length; break;
                    }
                }
            }

            const totalQty = qtyPerUnit * unitsPerWindow * quantity;

            if (totalQty > 0) {
                seriesData.hardware.set(hw.name, (seriesData.hardware.get(hw.name) || 0) + totalQty);
            }
        }
    }

    // Process the aggregated data into the final BOM structure
    const bom: BOM = [];
    for (const [seriesId, data] of seriesMap.entries()) {
        const bomSeries: BOMSeries = {
            seriesId,
            seriesName: data.name,
            profiles: [],
            hardware: [],
        };

        for (const [profileKey, pieces] of data.profiles.entries()) {
            const standardLength = Number(data.series.lengths?.[profileKey]) || DEFAULT_STANDARD_LENGTH_MM;
            const requiredBars = packPieces(pieces, standardLength);
            const totalLength = pieces.reduce((sum, p) => sum + p, 0);
            const weightPerMeter = Number(data.series.weights?.[profileKey]) || 0;

            bomSeries.profiles.push({
                profileKey,
                pieces,
                standardLength,
                requiredBars,
                totalLength,
                weightPerMeter,
                totalWeight: totalLength / 1000 * weightPerMeter
            });
        }
        
        for (const [name, totalQuantity] of data.hardware.entries()) {
            bomSeries.hardware.push({ name, totalQuantity });
        }
        
        bomSeries.profiles.sort((a,b) => a.profileKey.localeCompare(b.profileKey));
        bomSeries.hardware.sort((a,b) => a.name.localeCompare(b.name));

        bom.push(bomSeries);
    }
    
    return bom.sort((a, b) => a.seriesName.localeCompare(b.seriesName));
}