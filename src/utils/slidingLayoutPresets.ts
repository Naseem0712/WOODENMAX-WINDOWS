import { FixedPanelPosition, ShutterConfigType, TrackType } from '../types';

export interface SlidingLayoutPreset {
  id: string;
  label: string;
  hint: string;
  trackType: TrackType;
  shutterConfig: ShutterConfigType;
  fixedPositions: FixedPanelPosition[];
}

/** One-click sliding layouts: track + shutter combo + optional fixed lite (user adjusts size after). */
export const SLIDING_LAYOUT_PRESETS: SlidingLayoutPreset[] = [
  {
    id: '2t-2g',
    label: '2-Track · 2 Glass',
    hint: 'Twin sliding shutters',
    trackType: TrackType.TWO_TRACK,
    shutterConfig: ShutterConfigType.TWO_GLASS,
    fixedPositions: [],
  },
  {
    id: '2t-4g',
    label: '2-Track · 4 Glass',
    hint: 'Four sliding panels',
    trackType: TrackType.TWO_TRACK,
    shutterConfig: ShutterConfigType.FOUR_GLASS,
    fixedPositions: [],
  },
  {
    id: '2t-4g-top',
    label: '2-Track · 4 Glass + Top fixed',
    hint: 'Transom above',
    trackType: TrackType.TWO_TRACK,
    shutterConfig: ShutterConfigType.FOUR_GLASS,
    fixedPositions: [FixedPanelPosition.TOP],
  },
  {
    id: '2t-4g-bottom',
    label: '2-Track · 4 Glass + Bottom fixed',
    hint: 'Fixed sill zone',
    trackType: TrackType.TWO_TRACK,
    shutterConfig: ShutterConfigType.FOUR_GLASS,
    fixedPositions: [FixedPanelPosition.BOTTOM],
  },
  {
    id: '2t-4g-side',
    label: '2-Track · 4 Glass + Side fixed',
    hint: 'Single sidelight (left)',
    trackType: TrackType.TWO_TRACK,
    shutterConfig: ShutterConfigType.FOUR_GLASS,
    fixedPositions: [FixedPanelPosition.LEFT],
  },
  {
    id: '3t-3g',
    label: '3-Track · 3 Glass',
    hint: 'Triple track, all glass',
    trackType: TrackType.THREE_TRACK,
    shutterConfig: ShutterConfigType.THREE_GLASS,
    fixedPositions: [],
  },
  {
    id: '3t-2g1m',
    label: '3-Track · 2 Glass + 1 Mesh',
    hint: 'Mesh on inner track',
    trackType: TrackType.THREE_TRACK,
    shutterConfig: ShutterConfigType.TWO_GLASS_ONE_MESH,
    fixedPositions: [],
  },
  {
    id: '3t-4g2m',
    label: '3-Track · 4 Glass + 2 Mesh',
    hint: 'Outer panels fixed glass typical layout',
    trackType: TrackType.THREE_TRACK,
    shutterConfig: ShutterConfigType.FOUR_GLASS_TWO_MESH,
    fixedPositions: [],
  },
  {
    id: '3t-4g2m-top',
    label: '3-Track · 4 Glass + 2 Mesh + Top fixed',
    hint: 'Transom + 6-panel mesh system',
    trackType: TrackType.THREE_TRACK,
    shutterConfig: ShutterConfigType.FOUR_GLASS_TWO_MESH,
    fixedPositions: [FixedPanelPosition.TOP],
  },
  {
    id: '3t-4g2m-bottom',
    label: '3-Track · 4 Glass + 2 Mesh + Bottom fixed',
    hint: 'Fixed lower zone',
    trackType: TrackType.THREE_TRACK,
    shutterConfig: ShutterConfigType.FOUR_GLASS_TWO_MESH,
    fixedPositions: [FixedPanelPosition.BOTTOM],
  },
  {
    id: '3t-4g2m-side',
    label: '3-Track · 4 Glass + 2 Mesh + Side fixed',
    hint: 'Side lite + mesh combo',
    trackType: TrackType.THREE_TRACK,
    shutterConfig: ShutterConfigType.FOUR_GLASS_TWO_MESH,
    fixedPositions: [FixedPanelPosition.RIGHT],
  },
];
