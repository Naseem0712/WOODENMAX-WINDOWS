/** Print-safe B&W CAD schematic strokes (EvA-style). */
export const SCH = {
  ink: '#111111',
  dim: '#222222',
  glassFill: '#f3f6f8',
  meshStroke: '#333333',
  sashFill: '#ffffff',
  frameFill: '#ffffff',
  outerStroke: 1.35,
  sashStroke: 0.85,
  beadStroke: 0.45,
  dimStroke: 0.4,
  trackStroke: 0.7,
  fontFamily: 'ui-sans-serif, system-ui, sans-serif',
  dimFontSize: 9,
  labelFontSize: 8,
} as const;

export const DIM_MARGIN = {
  left: 36,
  right: 28,
  top: 8,
  bottom: 42,
} as const;

export function schematicId(prefix: string, seed: string): string {
  const safe = seed.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 24) || 'w';
  return `${prefix}-${safe}`;
}
