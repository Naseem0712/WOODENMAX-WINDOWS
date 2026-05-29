import type { WindowConfig } from '../types';
import { ShutterConfigType, WindowType } from '../types';

function getSlidingShutterCount(config: WindowConfig): number {
  switch (config.shutterConfig) {
    case ShutterConfigType.TWO_GLASS:
      return 2;
    case ShutterConfigType.THREE_GLASS:
    case ShutterConfigType.TWO_GLASS_ONE_MESH:
      return 3;
    case ShutterConfigType.FOUR_GLASS:
      return 4;
    case ShutterConfigType.FOUR_GLASS_TWO_MESH:
      return 6;
    default:
      return 0;
  }
}

/** All panels that can take a handle (doors + sliding shutters). */
export function listOperablePanelIds(config: WindowConfig): string[] {
  switch (config.windowType) {
    case WindowType.SLIDING: {
      const n = Math.max((config.slidingHandles ?? []).length, getSlidingShutterCount(config));
      return Array.from({ length: n }, (_, i) => `sliding-${i}`);
    }
    case WindowType.CASEMENT:
      return (config.doorPositions ?? []).map((p) => `casement-${p.row}-${p.col}`);
    case WindowType.VENTILATOR: {
      const out: string[] = [];
      (config.ventilatorGrid ?? []).forEach((row, r) =>
        row.forEach((cell, c) => {
          if (cell?.type === 'door') out.push(`ventilator-${r}-${c}`);
        }),
      );
      return out;
    }
    case WindowType.GLASS_PARTITION: {
      const out: string[] = [];
      (config.partitionPanels?.types ?? []).forEach((t, idx) => {
        if (t?.type !== 'fixed') out.push(`partition-${idx}`);
      });
      return out;
    }
    default:
      return [];
  }
}
