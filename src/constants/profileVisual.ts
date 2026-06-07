/** Visual-only overlap so shutters/doors sit into frame, mullion, or track and hide inner lines. */
export const PROFILE_VISUAL_OVERLAP_MM = 8;

export type ProfileBleedMm = {
  top?: number;
  bottom?: number;
  left?: number;
  right?: number;
};

export type HideInnerEdges = { top?: boolean; bottom?: boolean; left?: boolean; right?: boolean };

export function resolveProfileBleed(
  bleed?: number | ProfileBleedMm,
  fallback = PROFILE_VISUAL_OVERLAP_MM,
): { top: number; bottom: number; left: number; right: number } {
  if (typeof bleed === 'number') {
    const v = Math.max(0, bleed);
    return { top: v, bottom: v, left: v, right: v };
  }
  const b = bleed ?? {};
  return {
    top: Math.max(0, b.top ?? fallback),
    bottom: Math.max(0, b.bottom ?? fallback),
    left: Math.max(0, b.left ?? 0),
    right: Math.max(0, b.right ?? 0),
  };
}

/** Sliding shutters overlap top/bottom track only — not interlock sides. */
export const SLIDING_TRACK_BLEED: ProfileBleedMm = {
  top: PROFILE_VISUAL_OVERLAP_MM,
  bottom: PROFILE_VISUAL_OVERLAP_MM,
  left: 0,
  right: 0,
};

/** Only the front (higher-z) shutter draws interlock lines at a meeting overlap. */
export function slidingInterlockJointVisible(
  myZ: number,
  peerZ: number | undefined,
  myIndex = 0,
  peerIndex = -1,
): boolean {
  if (peerZ == null) return true;
  if (myZ > peerZ) return true;
  if (myZ < peerZ) return false;
  return myIndex > peerIndex;
}
