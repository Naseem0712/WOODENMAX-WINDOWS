import type { WindowConfig } from '../types';
import { GlassType } from '../types';

/** Matches {@link GlassPanel} CSS gradient / tint for SVG arch glass. */
export function archGlassSvgPaint(
  config: WindowConfig,
  uid: string,
): { fill: string; fillOpacity: number; useTexture: boolean } {
  const { glassType, glassTexture } = config;
  if (glassTexture) {
    return { fill: `url(#arch-glass-tex-${uid})`, fillOpacity: 1, useTexture: true };
  }
  switch (glassType) {
    case GlassType.TINTED_BLUE:
      return { fill: 'hsl(205, 90%, 60%)', fillOpacity: 0.6, useTexture: false };
    case GlassType.TINTED_GREY:
      return { fill: 'hsl(210, 10%, 40%)', fillOpacity: 0.6, useTexture: false };
    case GlassType.FROSTED:
      return { fill: 'hsl(200, 100%, 95%)', fillOpacity: 0.9, useTexture: false };
    case GlassType.VERTICAL_FLUTED:
      return { fill: 'hsl(190, 80%, 85%)', fillOpacity: 0.8, useTexture: false };
    case GlassType.CLEAR_SAPPHIRE:
      return { fill: 'hsl(210, 80%, 70%)', fillOpacity: 0.65, useTexture: false };
    case GlassType.BROWN_TINTED:
      return { fill: 'hsl(30, 30%, 30%)', fillOpacity: 0.6, useTexture: false };
    case GlassType.BLACK_TINTED:
      return { fill: 'hsl(0, 0%, 20%)', fillOpacity: 0.7, useTexture: false };
    default:
      return { fill: `url(#arch-glass-grad-${uid})`, fillOpacity: 0.82, useTexture: false };
  }
}
