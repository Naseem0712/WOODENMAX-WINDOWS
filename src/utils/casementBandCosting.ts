import type { WindowConfig } from '../types';
import { WindowType } from '../types';
import { isArchTopOutline, resolveCasementOutline } from './casementOutlineGeometry';

/** Profile bands for fabrication charge (₹/band): arch band, inner rings, door sides. */
export function countCasementProfileBands(config: WindowConfig): number {
  if (config.windowType !== WindowType.CASEMENT && config.windowType !== WindowType.VENTILATOR) {
    return 0;
  }
  let bands = 0;
  const outline = resolveCasementOutline(config);
  if (isArchTopOutline(config)) {
    bands += 1;
    bands += Math.max(0, Math.min(2, outline.archInnerRingCount ?? 0));
  }
  const doorCount =
    config.windowType === WindowType.CASEMENT
      ? (config.doorPositions ?? []).length
      : (config.ventilatorGrid ?? []).flat().filter((c) => c?.type === 'door').length;
  bands += doorCount * 4;
  return bands;
}
