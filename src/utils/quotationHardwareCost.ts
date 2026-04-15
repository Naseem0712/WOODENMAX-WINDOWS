import type { CornerSideConfig, HardwareItem, WindowConfig } from '../types';
import { ShutterConfigType, WindowType } from '../types';

function calculateSideCost(
  config: WindowConfig | CornerSideConfig | undefined,
  hardwareItems: HardwareItem[]
): number {
  if (!config) return 0;
  const hasFrictionStay = hardwareItems.some((item) => {
    const name = item.name.toLowerCase();
    return name.includes('friction stay') && (Number(item.qtyPerShutter) || 0) > 0;
  });

  return hardwareItems.reduce((total, item) => {
    const qty = Number(item.qtyPerShutter) || 0;
    const itemRate = Number(item.rate) || 0;
    const itemName = item.name.toLowerCase();
    if (hasFrictionStay && (itemName.includes('butt hinge') || itemName.includes('door holder'))) {
      return total;
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
        const doorCells = config.ventilatorGrid.flat().filter((c) => c.type === 'door').length;
        const louverCells = config.ventilatorGrid.flat().filter((c) => c.type === 'louvers').length;
        const name = itemName;
        if (name.includes('louver')) {
          panelCount = louverCells;
        } else {
          panelCount = doorCells;
        }
      } else {
        switch (config.windowType) {
          case WindowType.SLIDING:
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
            if (item.name.toLowerCase().includes('mesh lock')) {
              panelCount =
                config.shutterConfig === ShutterConfigType.FOUR_GLASS_TWO_MESH
                  ? 2
                  : config.shutterConfig === ShutterConfigType.TWO_GLASS_ONE_MESH
                    ? 1
                    : 0;
            }
            break;
          case WindowType.CASEMENT:
            panelCount = config.doorPositions.length;
            break;
          case WindowType.GLASS_PARTITION:
            panelCount = (config as WindowConfig).partitionPanels.types.filter((t) => t.type !== 'fixed').length;
            break;
        }
      }
    }
    return total + qty * itemRate * panelCount;
  }, 0);
}

/** Per-window hardware cost for a saved quotation config (matches designer quotation logic). */
export function computeHardwareCostForQuotation(config: WindowConfig, hardwareItems: HardwareItem[]): number {
  if (config.windowType === WindowType.CORNER) {
    return calculateSideCost(config.leftConfig, hardwareItems) + calculateSideCost(config.rightConfig, hardwareItems);
  }
  return calculateSideCost(config, hardwareItems);
}
