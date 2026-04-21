/**
 * Fixed tile size so horizontal and vertical profile strips use the same grain scale
 * (avoids stretched-vs-squashed mismatch). Combine with backgroundPosition offsets for alignment.
 */
export const PROFILE_TEXTURE_TILE = '64px 64px';

function pxFromStyle(v: number | string | undefined): number {
  if (typeof v === 'number') return v;
  if (typeof v === 'string' && v.endsWith('px')) return parseFloat(v) || 0;
  return 0;
}

/** Align repeating texture to parent box so bars meet with continuous grain at corners. */
export function profileTexturePosition(style: { left?: number | string; top?: number | string }): string {
  const x = pxFromStyle(style.left);
  const y = pxFromStyle(style.top);
  return `${-x}px ${-y}px`;
}
