import type { WindowConfig } from '../types';
import { ShutterConfigType, TrackType, WindowType } from '../types';
import { getElevationDimensionsMm, type ElevationDimensions } from '../utils/elevationDimensions';

/** Glass shutter columns for quote dimensioning (mesh excluded). */
export function slidingGlassColumnCount(shutterConfig: ShutterConfigType | undefined): number {
  switch (shutterConfig) {
    case ShutterConfigType.THREE_GLASS:
      return 3;
    case ShutterConfigType.FOUR_GLASS:
    case ShutterConfigType.FOUR_GLASS_TWO_MESH:
      return 4;
    case ShutterConfigType.TWO_GLASS:
    case ShutterConfigType.TWO_GLASS_ONE_MESH:
    default:
      return 2;
  }
}

export function slidingHasMesh(shutterConfig: ShutterConfigType | undefined): boolean {
  return (
    shutterConfig === ShutterConfigType.TWO_GLASS_ONE_MESH ||
    shutterConfig === ShutterConfigType.FOUR_GLASS_TWO_MESH
  );
}

export function slidingMeshCount(shutterConfig: ShutterConfigType | undefined): number {
  if (shutterConfig === ShutterConfigType.TWO_GLASS_ONE_MESH) return 1;
  if (shutterConfig === ShutterConfigType.FOUR_GLASS_TWO_MESH) return 2;
  return 0;
}

/** Track lanes for plan/section — mesh configs force 3 tracks visually. */
export function slidingTrackLaneCount(config: WindowConfig): number {
  const sc = config.shutterConfig;
  if (
    sc === ShutterConfigType.TWO_GLASS_ONE_MESH ||
    sc === ShutterConfigType.FOUR_GLASS_TWO_MESH ||
    sc === ShutterConfigType.THREE_GLASS
  ) {
    return 3;
  }
  if (config.trackType === TrackType.THREE_TRACK) return 3;
  return 2;
}

export function supportsQuotationSchematic(config: WindowConfig | undefined): boolean {
  if (!config) return false;
  return (
    config.windowType === WindowType.SLIDING ||
    config.windowType === WindowType.CASEMENT ||
    config.windowType === WindowType.VENTILATOR
  );
}

export function quotationElevationDims(config: WindowConfig): ElevationDimensions {
  return getElevationDimensionsMm(config);
}

/** Outer frame depth for schematic (mm), from series or sensible default. */
export function schematicOuterFrameMm(config: WindowConfig): number {
  const d = config.series?.dimensions;
  const raw =
    Number(d?.outerFrame) ||
    Number(d?.track2T) ||
    Number(d?.casementShutter) ||
    45;
  return Math.max(28, Math.min(raw, 60));
}

export function schematicSashMm(config: WindowConfig): number {
  const d = config.series?.dimensions;
  const raw = Number(d?.shutterHandle) || Number(d?.casementShutter) || 35;
  return Math.max(18, Math.min(raw, 45));
}
