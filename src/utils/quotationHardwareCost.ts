import type { CornerSideConfig, HardwareItem, WindowConfig } from '../types';
import { ShutterConfigType, WindowType } from '../types';

/**
 * Hardware unit multiplier for quotation PDF rows and designer pricing — matches sliding /
 * casement / ventilator rules used in aggregate hardware cost.
 */
export function getQuotationHardwareUnitMultiplier(
  config: WindowConfig,
  allHardwareItems: HardwareItem[],
  item: HardwareItem
): number {
  if (config.windowType === WindowType.CORNER) {
    return (
      getQuotationHardwareUnitMultiplierForSlice(config.leftConfig, allHardwareItems, item) +
      getQuotationHardwareUnitMultiplierForSlice(config.rightConfig, allHardwareItems, item)
    );
  }
  return getQuotationHardwareUnitMultiplierForSlice(config, allHardwareItems, item);
}

function getQuotationHardwareUnitMultiplierForSlice(
  config: WindowConfig | CornerSideConfig | undefined,
  allHardwareItems: HardwareItem[],
  item: HardwareItem
): number {
  if (!config) return 0;

  const lineQty = Number(item.qtyPerShutter) || 0;
  if (lineQty <= 0) return 0;

  const itemName = (item.name ?? '').toLowerCase();
  const hasFrictionStay = allHardwareItems.some((hi) => {
    const name = (hi.name ?? '').toLowerCase();
    return name.includes('friction stay') && (Number(hi.qtyPerShutter) || 0) > 0;
  });
  if (hasFrictionStay && (itemName.includes('butt hinge') || itemName.includes('door holder'))) {
    return 0;
  }

  let panelCount = 0;

  if (item.unit === 'per_window') {
    panelCount = 1;
  } else if (item.unit === 'per_shutter_or_door') {
    if (config.windowType === WindowType.LOUVERS) {
      const { louverPattern, height, width, orientation } = config as WindowConfig;
      const pattern = louverPattern;
      const patternUnitSize = pattern.reduce((sum, p) => sum + (Number(p.size) || 0), 0);

      if (patternUnitSize > 0) {
        const totalDimension = orientation === 'vertical' ? (Number(height) || 0) : (Number(width) || 0);
        const numProfilesInPattern = pattern.filter((p) => p.type === 'profile').length;
        if (numProfilesInPattern > 0) {
          const numCompletePatterns = Math.floor(totalDimension / patternUnitSize);
          panelCount = numCompletePatterns * numProfilesInPattern;
          const remainingDimension = totalDimension % patternUnitSize;
          let currentSize = 0;
          for (const p of pattern) {
            if (currentSize < remainingDimension) {
              if (p.type === 'profile') panelCount++;
              currentSize += Number(p.size) || 0;
            } else break;
          }
        }
      }
    } else if (config.windowType === WindowType.VENTILATOR) {
      const grid = config.ventilatorGrid ?? [];
      const doorCells = grid.flat().filter((c) => c.type === 'door').length;
      const louverCells = grid.flat().filter((c) => c.type === 'louvers').length;
      if (itemName.includes('louver')) {
        panelCount = louverCells;
      } else {
        panelCount = doorCells;
      }
    } else {
      switch (config.windowType) {
        case WindowType.SLIDING: {
          const hasMeshShutters =
            config.shutterConfig === ShutterConfigType.TWO_GLASS_ONE_MESH ||
            config.shutterConfig === ShutterConfigType.FOUR_GLASS_TWO_MESH;
          const isMeshHardware =
            itemName.includes('mesh') ||
            itemName.includes('mosquito') ||
            itemName.includes('net ');
          // Mesh-specific hardware never applies to non-mesh sliding (2-track 2G/4G, 3-track 3G).
          if (isMeshHardware && !hasMeshShutters) {
            panelCount = 0;
            break;
          }
          switch (config.shutterConfig) {
            case ShutterConfigType.TWO_GLASS:
              panelCount = 2;
              break;
            case ShutterConfigType.THREE_GLASS:
            case ShutterConfigType.TWO_GLASS_ONE_MESH:
              panelCount = 3;
              break;
            case ShutterConfigType.FOUR_GLASS:
              panelCount = 4;
              break;
            case ShutterConfigType.FOUR_GLASS_TWO_MESH:
              panelCount = 6;
              break;
          }
          if (itemName.includes('mesh lock')) {
            panelCount =
              config.shutterConfig === ShutterConfigType.FOUR_GLASS_TWO_MESH
                ? 2
                : config.shutterConfig === ShutterConfigType.TWO_GLASS_ONE_MESH
                  ? 1
                  : 0;
          } else if (isMeshHardware && hasMeshShutters) {
            // Other generic mesh hardware (e.g. mesh roller, mesh wheel) scales
            // per mesh shutter only.
            panelCount =
              config.shutterConfig === ShutterConfigType.FOUR_GLASS_TWO_MESH
                ? 2
                : config.shutterConfig === ShutterConfigType.TWO_GLASS_ONE_MESH
                  ? 1
                  : 0;
          }
          break;
        }
        case WindowType.CASEMENT:
          panelCount = config.doorPositions?.length ?? 0;
          break;
        case WindowType.GLASS_PARTITION:
          panelCount = ((config as WindowConfig).partitionPanels?.types ?? []).filter((t) => t.type !== 'fixed').length;
          break;
        default:
          panelCount = 0;
      }
    }
  }

  return panelCount;
}

function calculateSideCost(
  config: WindowConfig | CornerSideConfig | undefined,
  hardwareItems: HardwareItem[]
): number {
  if (!config) return 0;
  return hardwareItems.reduce((total, item) => {
    const qty = Number(item.qtyPerShutter) || 0;
    const itemRate = Number(item.rate) || 0;
    const units = getQuotationHardwareUnitMultiplierForSlice(config, hardwareItems, item);
    return total + qty * itemRate * units;
  }, 0);
}

/** Per-window hardware cost for a saved quotation config (matches designer quotation logic). */
export function computeHardwareCostForQuotation(config: WindowConfig, hardwareItems: HardwareItem[]): number {
  if (config.windowType === WindowType.CORNER) {
    return calculateSideCost(config.leftConfig, hardwareItems) + calculateSideCost(config.rightConfig, hardwareItems);
  }
  return calculateSideCost(config, hardwareItems);
}
