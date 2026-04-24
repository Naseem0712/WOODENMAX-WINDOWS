import type { WindowConfig, QuotationItem, ProfileDimensions, BOM, BOMSeries, BOMProfile, GlassType, BOMGlassCutRow, BOMMeshCutRow } from '../types';
import { WindowType, ShutterConfigType, FixedPanelPosition } from '../types';
import { computeSlidingCutLayout, isSlidingSeriesUnifiedOuter } from './slidingCutFormula';
import { hasResolvedSeriesValue, resolveSeriesNumeric } from './profileDimensionKeys';

const FEET_TO_MM = 304.8;
const SQFT_TO_SQMM = 92903.04;
const SQMT_TO_SQMM = 1000000;
const DEFAULT_STANDARD_LENGTH_MM = 16 * FEET_TO_MM; // 4876.8

type GlassCutAcc = {
  description: string;
  widthMm: number;
  heightMm: number;
  panels: number;
  lineTitle?: string;
  windowWidthMm?: number;
  windowHeightMm?: number;
  quotationItemId?: string;
};
type MeshCutAcc = {
  widthMm: number;
  heightMm: number;
  panels: number;
  lineTitle?: string;
  windowWidthMm?: number;
  windowHeightMm?: number;
  quotationItemId?: string;
};

function mergeGlassCutMap(into: Map<string, GlassCutAcc>, from: Map<string, GlassCutAcc>) {
  for (const [k, v] of from) {
    const cur = into.get(k);
    if (cur) cur.panels += v.panels;
    else into.set(k, { ...v });
  }
}

function mergeMeshCutMap(into: Map<string, MeshCutAcc>, from: Map<string, MeshCutAcc>) {
  for (const [k, v] of from) {
    const cur = into.get(k);
    if (cur) cur.panels += v.panels;
    else into.set(k, { ...v });
  }
}

/**
 * First-Fit Decreasing bin packing algorithm.
 * Tries to fit a list of pieces into the minimum number of standard-length bars.
 */
export function packPieces(pieces: number[], standardLength: number): number {
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

export interface CalculateUsageOptions {
    /** When true, mesh top/bottom/handle go under `shutterBottom` and mesh
     *  interlock goes under `shutterMeeting` — bin-packed separately from glass.
     *  When false (default), everything shares shutterTop + shutterInterlock. */
    separateMeshShutterSections?: boolean;
}

/**
 * Calculates profile, glass, mesh, and Georgian bar usage for a single window configuration.
 * This function recursively calls itself for corner window sides.
 */
function calculateUsage(config: WindowConfig, options?: CalculateUsageOptions): {
    profiles: Map<keyof ProfileDimensions, number[]>, 
    glass: Map<string, number>, 
    mesh: number;
    glassCutsMap: Map<string, GlassCutAcc>;
    meshCutsMap: Map<string, MeshCutAcc>;
} {
    const profileUsage = new Map<keyof ProfileDimensions, number[]>();
    const glassUsage = new Map<string, number>();
    let meshArea = 0;
    const glassCutsMap = new Map<string, GlassCutAcc>();
    const meshCutsMap = new Map<string, MeshCutAcc>();

    const { series, fixedPanels } = config;
    const dims = series.dimensions;

    const addProfile = (key: keyof ProfileDimensions, ...lengths: number[]) => {
        if (!dims[key] || Number(dims[key]) === 0) return;
        const validLengths = lengths.filter(l => l > 0);
        if (validLengths.length === 0) return;
        if (!profileUsage.has(key)) profileUsage.set(key, []);
        profileUsage.get(key)!.push(...validLengths);
    };

    /** Route pieces to the PRIMARY profile key (track2T / track3T / jamb)
     *  regardless of whether that dimension has been set on the series — as
     *  long as at least one key in the fallback chain has a real value. This
     *  makes the BOM list 2-track vs 3-track stock requirements as distinct
     *  rows even when the underlying series only defines the generic
     *  `outerFrame`. Weights / stock lengths are resolved via
     *  {@link resolveSeriesNumeric} at render time. */
    const addProfilePrimary = (primaryKey: keyof ProfileDimensions, ...lengths: number[]) => {
        if (!hasResolvedSeriesValue(dims, primaryKey)) return;
        const validLengths = lengths.filter((l) => l > 0);
        if (validLengths.length === 0) return;
        if (!profileUsage.has(primaryKey)) profileUsage.set(primaryKey, []);
        profileUsage.get(primaryKey)!.push(...validLengths);
    };

    const addGlass = (panelId: string, width: number, height: number) => {
        if (width <= 0 || height <= 0) return;
        const area = width * height;
        const desc = getGlassDescription(config);
        glassUsage.set(desc, (glassUsage.get(desc) || 0) + area);
        const wk = Math.round(width * 100) / 100;
        const hk = Math.round(height * 100) / 100;
        const ck = `${desc}|||${wk}|||${hk}`;
        const g = glassCutsMap.get(ck);
        if (g) g.panels += 1;
        else glassCutsMap.set(ck, { description: desc, widthMm: wk, heightMm: hk, panels: 1 });
        
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
         const wk = Math.round(width * 100) / 100;
         const hk = Math.round(height * 100) / 100;
         const mk = `${wk}|||${hk}`;
         const m = meshCutsMap.get(mk);
         if (m) m.panels += 1;
         else meshCutsMap.set(mk, { widthMm: wk, heightMm: hk, panels: 1 });
         // Georgian bars on mesh are not standard, but check just in case
         const { glassGrid } = config;
         const pattern = glassGrid.applyToAll ? glassGrid.patterns['default'] : (glassGrid.patterns[panelId] || glassGrid.patterns['default']);
         if (pattern) {
             if (pattern.horizontal.count > 0) addProfile('glassGridProfile', ...Array(pattern.horizontal.count).fill(width));
             if (pattern.vertical.count > 0) addProfile('glassGridProfile', ...Array(pattern.vertical.count).fill(height));
         }
    }

    const getSegmentSizes = (total: number, dividers: number[]): number[] => {
        if (total <= 0) return [];
        if (!dividers || dividers.length === 0) return [total];
        const sorted = [...dividers]
            .map(v => Number(v))
            .filter(v => Number.isFinite(v))
            .sort((a, b) => a - b);
        let prev = 0;
        const out: number[] = [];
        for (const d of sorted) {
            const pos = d > 0 && d < 1 ? d * total : d;
            const clamped = Math.max(0, Math.min(total, pos));
            out.push(Math.max(0, clamped - prev));
            prev = clamped;
        }
        out.push(Math.max(0, total - prev));
        return out;
    };

    if (config.windowType === WindowType.CORNER && config.leftConfig && config.rightConfig) {
        const leftConfig: WindowConfig = { ...config, ...config.leftConfig, width: config.leftWidth ?? 0, height: config.height ?? 0, windowType: config.leftConfig.windowType, fixedPanels: [] };
        const rightConfig: WindowConfig = { ...config, ...config.rightConfig, width: config.rightWidth ?? 0, height: config.height ?? 0, windowType: config.rightConfig.windowType, fixedPanels: [] };
        
        const leftUsage = calculateUsage(leftConfig, options);
        const rightUsage = calculateUsage(rightConfig, options);
        
        const mergedUsage = { profiles: leftUsage.profiles, glass: leftUsage.glass, mesh: leftUsage.mesh };

        for (const [key, pieces] of rightUsage.profiles.entries()) {
            if (mergedUsage.profiles.has(key)) mergedUsage.profiles.get(key)!.push(...pieces);
            else mergedUsage.profiles.set(key, pieces);
        }
        for (const [desc, area] of rightUsage.glass.entries()) {
            mergedUsage.glass.set(desc, (mergedUsage.glass.get(desc) || 0) + area);
        }
        mergedUsage.mesh += rightUsage.mesh;

        const mergedGlassCuts = new Map(leftUsage.glassCutsMap);
        mergeGlassCutMap(mergedGlassCuts, rightUsage.glassCutsMap);
        const mergedMeshCuts = new Map(leftUsage.meshCutsMap);
        mergeMeshCutMap(mergedMeshCuts, rightUsage.meshCutsMap);

        addProfile('outerFrame', Number(config.height) || 0, Number(config.height) || 0);
        return {
            profiles: mergedUsage.profiles,
            glass: mergedUsage.glass,
            mesh: mergedUsage.mesh,
            glassCutsMap: mergedGlassCuts,
            meshCutsMap: mergedMeshCuts,
        };
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
        if (config.windowType === WindowType.SLIDING) {
            // Outer: 2T vs 3T never mix. Unified series (25–29mm): same section on
            // H+V — both map to `track2T`/`track3T` for costing/BOM. Split series
            // (e.g. 35mm): horizontal = track, vertical = jamb* keys.
            const trackKey: keyof ProfileDimensions =
                Number(config.trackType) === 3 ? 'track3T' : 'track2T';
            const jambKey: keyof ProfileDimensions =
                Number(config.trackType) === 3 ? 'jamb3T' : 'jamb2T';
            const unifiedOuter = isSlidingSeriesUnifiedOuter(config.series);
            addProfilePrimary(trackKey, w, w);
            addProfilePrimary(unifiedOuter ? trackKey : jambKey, h, h);
        } else if (verticalFrame !== frame) {
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
            // Drive every sliding cut (profile lengths + glass/mesh panel sizes) from the
            // canonical fabrication formula so the BOM matches the cutting plan 1:1.
            // Top + bottom + handle-side vertical all share the same stock profile in every
            // series, so we pool them under `shutterTop` for bin packing. All interlocks
            // (slim + reinforcement) pool under `shutterInterlock`. When the quotation
            // setting enables separate mesh sections, mesh pieces are routed to
            // `shutterBottom` / `shutterMeeting` so their stock bars stay separate.
            const interlockThicknessMm = Number(dims.shutterInterlock) || 0;
            const separateMeshSections = !!options?.separateMeshShutterSections;
            const layout = computeSlidingCutLayout({
                apertureWidthMm: innerW,
                apertureHeightMm: innerH,
                shutterConfig: config.shutterConfig,
                trackType: config.trackType,
                interlockThicknessMm,
                separateMeshSections,
                unifiedOuterPerimeter: isSlidingSeriesUnifiedOuter(config.series),
            });
            const fixedBoundaryCount = Math.max(0, layout.counts.total - 1);

            for (const piece of layout.pieces) {
                if (piece.pieces <= 0 || piece.lengthMm <= 0) continue;
                const lengths = Array<number>(piece.pieces).fill(piece.lengthMm);
                switch (piece.pool) {
                    case 'outerPerimeter2T':
                    case 'outerPerimeter3T':
                    case 'outerTrack2T':
                    case 'outerTrack3T':
                    case 'outerJamb2T':
                    case 'outerJamb3T':
                    case 'trackClip':
                        // Outer (unified or split) + track clip: primaries above. Track
                        // clip is costed in materialCosting.
                        break;
                    case 'shutterFrame':
                        addProfile('shutterTop', ...lengths);
                        break;
                    case 'shutterInterlock':
                        addProfile('shutterInterlock', ...lengths);
                        break;
                    case 'meshShutterFrame':
                        addProfile('shutterBottom', ...lengths);
                        break;
                    case 'meshShutterInterlock':
                        addProfile('shutterMeeting', ...lengths);
                        break;
                }
            }

            for (let i = 0; i < layout.counts.total; i++) {
                const isMesh = i >= layout.counts.glass;
                if (isMesh) addMesh(`sliding-${i}`, layout.glassWidthMm, layout.glassHeightMm);
                else addGlass(`sliding-${i}`, layout.glassWidthMm, layout.glassHeightMm);
            }

            // When top/bottom fixed panel exists in sliding, align mullions with shutter interlock boundaries.
            const topFixMullionLen = topFix ? (topFix.size - frame - Number(dims.fixedFrame || 0)) : 0;
            const bottomFixMullionLen = bottomFix ? (bottomFix.size - frame - Number(dims.fixedFrame || 0)) : 0;
            if (topFix && topFixMullionLen > 0 && fixedBoundaryCount > 0) {
                addProfile('mullion', ...Array(fixedBoundaryCount).fill(topFixMullionLen));
            }
            if (bottomFix && bottomFixMullionLen > 0 && fixedBoundaryCount > 0) {
                addProfile('mullion', ...Array(fixedBoundaryCount).fill(bottomFixMullionLen));
            }
            break;
        }
        case WindowType.CASEMENT: {
            const colWidths = getSegmentSizes(innerW, config.verticalDividers || []);
            const rowHeights = getSegmentSizes(innerH, config.horizontalDividers || []);

            // Mullion on all internal dividers (vertical + horizontal)
            if ((config.verticalDividers || []).length > 0) {
                addProfile('mullion', ...Array(config.verticalDividers.length).fill(innerH));
            }
            if ((config.horizontalDividers || []).length > 0) {
                addProfile('mullion', ...Array(config.horizontalDividers.length).fill(innerW));
            }

            const doorSet = new Set((config.doorPositions || []).map(p => `${p.row}-${p.col}`));
            for (let r = 0; r < rowHeights.length; r++) {
                for (let c = 0; c < colWidths.length; c++) {
                    const cw = colWidths[c];
                    const ch = rowHeights[r];
                    if (cw <= 0 || ch <= 0) continue;
                    const key = `${r}-${c}`;
                    const isDoor = doorSet.has(key);
                    if (isDoor) {
                        // Door all side
                        addProfile('casementShutter', cw, cw, ch, ch);
                        addGlass(`casement-door-${r}-${c}`, cw - (2 * Number(dims.casementShutter || 0)), ch - (2 * Number(dims.casementShutter || 0)));
                    } else {
                        addGlass(`casement-fixed-${r}-${c}`, cw, ch);
                    }
                }
            }
            break;
        }
        case WindowType.VENTILATOR: {
            const colWidths = getSegmentSizes(innerW, config.verticalDividers || []);
            const rowHeights = getSegmentSizes(innerH, config.horizontalDividers || []);

            // Mullion on all internal dividers
            if ((config.verticalDividers || []).length > 0) {
                addProfile('mullion', ...Array(config.verticalDividers.length).fill(innerH));
            }
            if ((config.horizontalDividers || []).length > 0) {
                addProfile('mullion', ...Array(config.horizontalDividers.length).fill(innerW));
            }

            for (let r = 0; r < rowHeights.length; r++) {
                for (let c = 0; c < colWidths.length; c++) {
                    const cw = colWidths[c];
                    const ch = rowHeights[r];
                    if (cw <= 0 || ch <= 0) continue;
                    const cell = config.ventilatorGrid?.[r]?.[c];
                    const cellType = cell?.type || 'glass';
                    if (cellType === 'door') {
                        addProfile('casementShutter', cw, cw, ch, ch);
                        addGlass(`vent-door-${r}-${c}`, cw - (2 * Number(dims.casementShutter || 0)), ch - (2 * Number(dims.casementShutter || 0)));
                    } else if (cellType === 'louvers') {
                        // Z-louvers: horizontal at every 70mm, profile 75x4 style weight from louverBlade
                        const louverPitch = 70;
                        const count = Math.max(1, Math.floor(ch / louverPitch));
                        addProfile('louverBlade', ...Array(count).fill(cw));
                    } else {
                        addGlass(`vent-glass-${r}-${c}`, cw, ch);
                    }
                }
            }
            break;
        }
        case WindowType.GLASS_PARTITION: {
            const panelCount = Math.max(1, config.partitionPanels?.count || 1);
            const widths = (() => {
                const explicit = (config.partitionPanels?.types || []).map((t) => Number(t.widthMm) || 0);
                const sumExplicit = explicit.reduce((s, v) => s + (v > 0 ? v : 0), 0);
                const flexCount = explicit.filter(v => v <= 0).length;
                const rem = Math.max(0, innerW - sumExplicit);
                const flexW = flexCount > 0 ? rem / flexCount : 0;
                return Array.from({ length: panelCount }).map((_, i) => explicit[i] > 0 ? explicit[i] : flexW);
            })();

            // Vertical dividers/mullions between panels
            if (panelCount > 1) {
                addProfile('mullion', ...Array(panelCount - 1).fill(innerH));
            }

            addProfile('topTrack', innerW);
            addProfile('bottomTrack', innerW);

            for (let i = 0; i < panelCount; i++) {
                const p = config.partitionPanels.types?.[i];
                const type = p?.type || 'fixed';
                const pw = widths[i] || 0;
                if (pw <= 0 || innerH <= 0) continue;
                if (type === 'fixed') {
                    addGlass(`partition-fixed-${i}`, pw, innerH);
                } else {
                    // Door/openable/slider/fold panel outer all side
                    addProfile('casementShutter', pw, pw, innerH, innerH);
                    addGlass(`partition-open-${i}`, pw - (2 * Number(dims.casementShutter || 0)), innerH - (2 * Number(dims.casementShutter || 0)));
                }
            }
            break;
        }
    }
    
    return { profiles: profileUsage, glass: glassUsage, mesh: meshArea, glassCutsMap, meshCutsMap };
}

export function calculateUsageForConfig(
    config: WindowConfig,
    options?: CalculateUsageOptions
): {
    profiles: Map<keyof ProfileDimensions, number[]>,
    glass: Map<string, number>,
    mesh: number,
    glassCutsMap: Map<string, GlassCutAcc>,
    meshCutsMap: Map<string, MeshCutAcc>,
} {
    return calculateUsage(config, options);
}


/**
 * Generates a complete Bill of Materials from a list of quotation items.
 */
export function generateBillOfMaterials(items: QuotationItem[], options?: CalculateUsageOptions): BOM {
    const seriesMap = new Map<string, { 
        name: string; 
        profiles: Map<keyof ProfileDimensions, number[]>; 
        hardware: Map<string, number>; 
        series: QuotationItem['config']['series'];
        glass: Map<string, number>; // area in mm^2
        meshArea: number; // area in mm^2
        glassCutTotals: Map<string, GlassCutAcc>;
        meshCutTotals: Map<string, MeshCutAcc>;
    }>();

    for (const item of items) {
        const { config, quantity } = item;
        const { series } = config;
        const qty = Math.max(0, Number(quantity) || 0);

        if (!seriesMap.has(series.id)) {
            seriesMap.set(series.id, {
                name: series.name,
                profiles: new Map(),
                hardware: new Map(),
                series: series,
                glass: new Map(),
                meshArea: 0,
                glassCutTotals: new Map(),
                meshCutTotals: new Map(),
            });
        }
        const seriesData = seriesMap.get(series.id)!;

        // Calculate usage for one item
        const singleUsage = calculateUsage(config, options);
        
        // Add usage for all quantities of the item
        for (let i = 0; i < qty; i++) {
            for (const [key, pieces] of singleUsage.profiles.entries()) {
                if (!seriesData.profiles.has(key)) seriesData.profiles.set(key, []);
                seriesData.profiles.get(key)!.push(...pieces);
            }
            for (const [desc, area] of singleUsage.glass.entries()) {
                seriesData.glass.set(desc, (seriesData.glass.get(desc) || 0) + area);
            }
            seriesData.meshArea += singleUsage.mesh;
        }

        for (const cut of singleUsage.glassCutsMap.values()) {
            const ck = `${item.id}|${cut.description}|${cut.widthMm}|${cut.heightMm}`;
            const addPanels = cut.panels * qty;
            const prev = seriesData.glassCutTotals.get(ck);
            if (prev) prev.panels += addPanels;
            else
              seriesData.glassCutTotals.set(ck, {
                ...cut,
                panels: addPanels,
                lineTitle: item.title,
                windowWidthMm: Number(item.config.width) || 0,
                windowHeightMm: Number(item.config.height) || 0,
                quotationItemId: item.id,
              });
        }
        for (const cut of singleUsage.meshCutsMap.values()) {
            const mk = `${item.id}|${cut.widthMm}|${cut.heightMm}`;
            const addPanels = cut.panels * qty;
            const prev = seriesData.meshCutTotals.get(mk);
            if (prev) prev.panels += addPanels;
            else
              seriesData.meshCutTotals.set(mk, {
                ...cut,
                panels: addPanels,
                lineTitle: item.title,
                windowWidthMm: Number(item.config.width) || 0,
                windowHeightMm: Number(item.config.height) || 0,
                quotationItemId: item.id,
              });
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
            const totalQty = qtyPerUnit * unitsPerWindow * qty;
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
            // For modern keys like `track2T` / `track3T` / `outerFrameVertical`
            // that weren't explicitly defined in the series, `resolveSeriesNumeric`
            // transparently returns the `outerFrame` fallback so legacy series
            // still compute correct bars / weight — while the BOM still lists
            // the specific key as its own row.
            const resolvedLength = resolveSeriesNumeric(data.series.lengths, profileKey);
            const standardLength = resolvedLength > 0 ? resolvedLength : DEFAULT_STANDARD_LENGTH_MM;
            const requiredBars = packPieces(pieces, standardLength);
            const totalLength = pieces.reduce((sum, p) => sum + p, 0);
            const weightPerMeter = resolveSeriesNumeric(data.series.weights, profileKey);

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

        const glassCutsFlat: BOMGlassCutRow[] = Array.from(data.glassCutTotals.values()).map((v) => ({
            description: v.description,
            widthMm: v.widthMm,
            heightMm: v.heightMm,
            totalPanels: v.panels,
            areaSqFt: (v.widthMm * v.heightMm * v.panels) / SQFT_TO_SQMM,
            lineTitle: v.lineTitle,
            windowWidthMm: v.windowWidthMm,
            windowHeightMm: v.windowHeightMm,
            quotationItemId: v.quotationItemId,
        }));
        if (glassCutsFlat.length > 0) {
            bomSeries.glassCutsFlat = glassCutsFlat.sort((a, b) => b.areaSqFt - a.areaSqFt);
        }

        if (data.meshArea > 0) {
            bomSeries.mesh = {
                totalAreaSqFt: data.meshArea / SQFT_TO_SQMM,
                totalAreaSqMt: data.meshArea / SQMT_TO_SQMM,
            };
        }

        const meshCutsFlat: BOMMeshCutRow[] = Array.from(data.meshCutTotals.values()).map((v) => ({
            widthMm: v.widthMm,
            heightMm: v.heightMm,
            totalPanels: v.panels,
            areaSqFt: (v.widthMm * v.heightMm * v.panels) / SQFT_TO_SQMM,
            lineTitle: v.lineTitle,
            windowWidthMm: v.windowWidthMm,
            windowHeightMm: v.windowHeightMm,
            quotationItemId: v.quotationItemId,
        }));
        if (meshCutsFlat.length > 0) {
            bomSeries.meshCutsFlat = meshCutsFlat.sort((a, b) => b.areaSqFt - a.areaSqFt);
        }
        
        bom.push(bomSeries);
    }

    return bom;
}