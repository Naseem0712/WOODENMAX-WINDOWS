import type { ProfileSeries, QuotationItem, SavedColor, WindowConfig } from '../types';
import { WindowType } from '../types';
import { computeHardwareCostForQuotation } from './quotationHardwareCost';

/**
 * Applies Configure-panel corrections (series, glass, colour, hardware) from the designer onto a quotation line.
 * Does not change per-line size, layout, positions, quantity, rate, or area unit — only material/spec fields.
 */
export function applyDesignerCorrectionToQuotationItem(
  item: QuotationItem,
  params: {
    designerConfig: WindowConfig;
    designerSeries: ProfileSeries;
    savedColors: SavedColor[];
  }
): QuotationItem | null {
  if (item.config.windowType !== params.designerConfig.windowType) return null;

  const next = JSON.parse(JSON.stringify(item)) as QuotationItem;
  const d = params.designerConfig;

  next.config.series = JSON.parse(JSON.stringify(params.designerSeries));
  next.config.glassType = d.glassType;
  next.config.glassTexture = d.glassTexture;
  next.config.glassThickness = d.glassThickness;
  next.config.customGlassName = d.customGlassName;
  next.config.glassSpecialType = d.glassSpecialType;
  next.config.laminatedGlassConfig = JSON.parse(JSON.stringify(d.laminatedGlassConfig));
  next.config.dguGlassConfig = JSON.parse(JSON.stringify(d.dguGlassConfig));
  next.config.profileColor = d.profileColor;
  next.config.profileTexture = d.profileTexture;

  if (d.windowType === WindowType.GLASS_PARTITION) {
    next.config.partitionPanels = JSON.parse(JSON.stringify(d.partitionPanels));
  }

  next.hardwareItems = JSON.parse(JSON.stringify(params.designerSeries.hardwareItems));
  next.hardwareCost = computeHardwareCostForQuotation(next.config, next.hardwareItems);

  const colorName = params.savedColors.find((c) => c.value === d.profileColor)?.name;
  next.profileColorName =
    colorName || (d.profileColor.startsWith('data:') ? 'Custom Texture' : d.profileColor);

  return next;
}
