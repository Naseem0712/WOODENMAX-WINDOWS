import type { HandleConfig, WindowConfig } from '../types';
import { GlassSpecialType, GlassType, ShutterConfigType, WindowType } from '../types';
import { getDefaultHandleConfig } from './handleDefaults';

export type HomeownerGlassPreset = 'single' | 'safety' | 'soundproof';
export type HomeownerLockType = 'multipoint' | 'touch' | 'mortice';

export interface HomeownerDefaultsV1 {
  version: 1;
  lockType: HomeownerLockType;
  preset: HomeownerGlassPreset;
  frostedExtra: boolean;
  profileColor: string;
  single: {
    glassType: GlassType;
    thicknessMm: number;
  };
  handle: {
    enabled: boolean;
    config: HandleConfig;
  };
}

const KEY = 'wm-homeowner-defaults-v1';

export function loadHomeownerDefaults(): HomeownerDefaultsV1 | null {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || parsed.version !== 1) return null;
    return parsed as HomeownerDefaultsV1;
  } catch {
    return null;
  }
}

export function saveHomeownerDefaults(next: HomeownerDefaultsV1): void {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // ignore
  }
}

export function applyHomeownerDefaultsToConfig(config: WindowConfig, d: HomeownerDefaultsV1): WindowConfig {
  const next: WindowConfig = { ...config };
  if (d.profileColor) next.profileColor = d.profileColor;

  if (d.preset === 'single') {
    next.glassSpecialType = 'none' as GlassSpecialType;
    next.glassType = d.single.glassType ?? next.glassType ?? GlassType.CLEAR;
    next.glassThickness = (d.single.thicknessMm ?? next.glassThickness ?? 6) as any;
  } else if (d.preset === 'safety') {
    next.glassSpecialType = 'laminated' as GlassSpecialType;
  } else if (d.preset === 'soundproof') {
    next.glassSpecialType = 'dgu' as GlassSpecialType;
  }

  // Handles: apply to sliding shutters or door cells when defaults say enabled.
  if (d.handle?.enabled && d.handle.config) {
    if (next.windowType === WindowType.SLIDING) {
      let n = 0;
      switch (next.shutterConfig) {
        case ShutterConfigType.TWO_GLASS:
          n = 2;
          break;
        case ShutterConfigType.THREE_GLASS:
        case ShutterConfigType.TWO_GLASS_ONE_MESH:
          n = 3;
          break;
        case ShutterConfigType.FOUR_GLASS:
          n = 4;
          break;
        case ShutterConfigType.FOUR_GLASS_TWO_MESH:
          n = 6;
          break;
      }
      const handles = Array(Math.max(n, (next.slidingHandles ?? []).length)).fill(null);
      const stored = d.handle.config;
      for (let i = 0; i < n; i++) {
        handles[i] =
          next.series?.dimensions
            ? getDefaultHandleConfig(`sliding-${i}`, next as WindowConfig)
            : { ...stored };
      }
      next.slidingHandles = handles;
    }
    if (Array.isArray(next.doorPositions) && next.doorPositions.length > 0) {
      next.doorPositions = next.doorPositions.map((p) => ({ ...p, handle: d.handle.config }));
    }
    if (Array.isArray(next.ventilatorGrid) && next.ventilatorGrid.length > 0) {
      next.ventilatorGrid = next.ventilatorGrid.map((row) =>
        row.map((cell) => (cell?.type === 'door' ? { ...cell, handle: d.handle.config } : cell)),
      );
    }
    if (next.partitionPanels?.types?.length) {
      next.partitionPanels = {
        ...next.partitionPanels,
        types: next.partitionPanels.types.map((t) => (t?.type !== 'fixed' ? { ...t, handle: d.handle.config } : t)),
      };
    }
  }

  return next;
}

