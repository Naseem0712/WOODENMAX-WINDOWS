import type { WindowConfig } from '../types';
import { WindowType } from '../types';
import { isOperablePartitionType } from '../utils/partitionPanelGeometry';

/** Whether this design supports the customer open-view module (read-only). */
export function supportsOpenView(config: WindowConfig): boolean {
  if (!config.series?.dimensions) return false;

  switch (config.windowType) {
    case WindowType.SLIDING:
      return true;
    case WindowType.CASEMENT:
      return (config.doorPositions?.length ?? 0) > 0;
    case WindowType.VENTILATOR:
      return (config.ventilatorGrid ?? []).some((row) => row?.some((c) => c?.type === 'door'));
    case WindowType.GLASS_PARTITION:
      return (config.partitionPanels?.types ?? []).some((t) => isOperablePartitionType(t?.type));
    default:
      return false;
  }
}

/** One or more configs to render in print open-view (corner legs split). */
export function getOpenViewPrintConfigs(config: WindowConfig | null | undefined): WindowConfig[] {
  if (!config?.windowType) return [];

  if (config.windowType === WindowType.CORNER && config.leftConfig && config.rightConfig) {
    const leftW = Number(config.leftWidth) || 0;
    const rightW = Number(config.rightWidth) || 0;
    const numHeight = Number(config.height) || 1;
    const legs: WindowConfig[] = [
      {
        ...config,
        ...config.leftConfig,
        width: leftW,
        height: numHeight,
        windowType: config.leftConfig.windowType,
        fixedPanels: [],
      },
      {
        ...config,
        ...config.rightConfig,
        width: rightW,
        height: numHeight,
        windowType: config.rightConfig.windowType,
        fixedPanels: [],
      },
    ];
    return legs.filter(supportsOpenView);
  }
  return supportsOpenView(config) ? [config] : [];
}

export function planKindShortLabel(kind: string): string {
  switch (kind) {
    case 'sliding':
    case 'partition_sliding':
      return 'sliding';
    case 'partition_fold':
      return 'bi-fold';
    case 'casement':
    case 'ventilator':
      return 'casement';
    case 'partition_hinged':
      return 'hinged';
    default:
      return 'open view';
  }
}

export function openViewKindLabel(kind: string): string {
  switch (kind) {
    case 'sliding':
      return 'Sliding';
    case 'casement':
      return 'Openable / Casement';
    case 'ventilator':
      return 'Ventilator door';
    case 'partition_sliding':
      return 'Sliding partition';
    case 'partition_fold':
      return 'Bi-fold';
    case 'partition_hinged':
      return 'Hinged partition';
    default:
      return 'Open view';
  }
}
