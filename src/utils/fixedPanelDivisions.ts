import type { WindowConfig, CornerSideConfig } from '../types';
import { ShutterConfigType, WindowType } from '../types';

/**
 * Returns vertical division positions (mm, relative to the inner glass width)
 * to draw inside a top/bottom fixed lite so its panes line up with the
 * shutter columns of the operable area below/above.
 *
 * Result excludes the bounding 0 and `innerWidth` — only intermediate mullion
 * positions are returned. An empty array means a single continuous pane.
 */
export function getFixedPanelVerticalDivisionsMm(
  config: WindowConfig | CornerSideConfig | undefined,
  innerWidthMm: number,
): number[] {
  if (!config || !Number.isFinite(innerWidthMm) || innerWidthMm <= 0) return [];

  switch (config.windowType) {
    case WindowType.SLIDING: {
      const cols = (() => {
        switch (config.shutterConfig) {
          case ShutterConfigType.TWO_GLASS:
          case ShutterConfigType.TWO_GLASS_ONE_MESH:
            return 2;
          case ShutterConfigType.THREE_GLASS:
            return 3;
          case ShutterConfigType.FOUR_GLASS:
          case ShutterConfigType.FOUR_GLASS_TWO_MESH:
            return 4;
          default:
            return 0;
        }
      })();
      if (cols <= 1) return [];
      const step = innerWidthMm / cols;
      const out: number[] = [];
      for (let i = 1; i < cols; i++) out.push(step * i);
      return out;
    }
    case WindowType.CASEMENT:
    case WindowType.VENTILATOR: {
      const dividers = config.verticalDividers ?? [];
      if (dividers.length === 0) return [];
      return dividers
        .map((d) => Number(d))
        .filter((d) => Number.isFinite(d) && d > 0 && d < 1)
        .sort((a, b) => a - b)
        .map((d) => d * innerWidthMm);
    }
    default:
      return [];
  }
}
