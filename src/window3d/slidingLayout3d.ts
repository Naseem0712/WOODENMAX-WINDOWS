import type { WindowConfig } from '../types';
import { ShutterConfigType } from '../types';
import { effectiveFourGlassMeetingMm } from '../utils/slidingGeometry';

export type SlidingPanel3D = {
  id: number;
  /** Left edge of shutter (mm) from inner opening left */
  xMm: number;
  widthMm: number;
  zLayer: number;
  isMesh: boolean;
  /** Moves when user slides open */
  animates: boolean;
  /** -1 = toward left, +1 = toward right, 0 = use pair logic */
  slideSign: -1 | 0 | 1;
  handleX?: number;
  handleY?: number;
};

function dimsOf(config: WindowConfig) {
  return config.series.dimensions;
}

/** Mirror 2D `WindowCanvas` sliding positions (mm). */
export function buildSlidingPanels3D(config: WindowConfig, innerW: number): SlidingPanel3D[] {
  const dims = dimsOf(config);
  const interlock = Number(dims.shutterInterlock) || 0;
  const meetingRaw = Number(dims.shutterMeeting) || 0;
  const meeting =
    config.shutterConfig === ShutterConfigType.FOUR_GLASS
      ? effectiveFourGlassMeetingMm(dims.shutterMeeting ?? '', dims.shutterInterlock ?? '')
      : meetingRaw;
  const fixed = config.fixedShutters ?? [];
  const handles = config.slidingHandles ?? [];

  const animates = (id: number, defaultAnimates: boolean) =>
    fixed[id] === true ? false : defaultAnimates;

  const withHandle = (p: SlidingPanel3D): SlidingPanel3D => {
    const h = handles[p.id];
    if (!h) return p;
    return { ...p, handleX: Number(h.x) || 50, handleY: Number(h.y) || 50 };
  };

  if (config.shutterConfig === ShutterConfigType.FOUR_GLASS_TWO_MESH) {
    const panelWidth = (innerW + 3 * interlock) / 4;
    const defs = [
      { id: 0, x: 0, z: 5, mesh: false, slide: false, sign: 0 as const },
      { id: 5, x: innerW - panelWidth, z: 5, mesh: false, slide: false, sign: 0 as const },
      { id: 1, x: panelWidth - interlock, z: 10, mesh: false, slide: true, sign: -1 as const },
      { id: 4, x: 2 * panelWidth - 2 * interlock, z: 10, mesh: false, slide: true, sign: 1 as const },
      { id: 2, x: 0, z: 15, mesh: true, slide: true, sign: -1 as const },
      { id: 3, x: innerW - panelWidth, z: 15, mesh: true, slide: true, sign: 1 as const },
    ];
    return defs.map((d) =>
      withHandle({
        id: d.id,
        xMm: d.x,
        widthMm: panelWidth,
        zLayer: d.z,
        isMesh: d.mesh,
        animates: animates(d.id, d.slide),
        slideSign: d.sign,
      }),
    );
  }

  if (config.shutterConfig === ShutterConfigType.FOUR_GLASS) {
    const shutterWidth = (innerW + 2 * interlock + meeting) / 4;
    const positions = [
      0,
      shutterWidth - interlock,
      2 * shutterWidth - interlock - meeting,
      3 * shutterWidth - 2 * interlock - meeting,
    ];
    return positions.map((x, i) =>
      withHandle({
        id: i,
        xMm: x,
        widthMm: shutterWidth,
        zLayer: i === 1 || i === 2 ? 10 : 5,
        isMesh: false,
        animates: animates(i, i === 1 || i === 2),
        slideSign: i === 1 ? -1 : i === 2 ? 1 : 0,
      }),
    );
  }

  if (config.shutterConfig === ShutterConfigType.TWO_GLASS) {
    const shutterWidth = (innerW + interlock) / 2;
    return [
      withHandle({
        id: 0,
        xMm: 0,
        widthMm: shutterWidth,
        zLayer: 5,
        isMesh: false,
        animates: animates(0, true),
        slideSign: -1,
      }),
      withHandle({
        id: 1,
        xMm: shutterWidth - interlock,
        widthMm: shutterWidth,
        zLayer: 6,
        isMesh: false,
        animates: animates(1, true),
        slideSign: 1,
      }),
    ];
  }

  if (config.shutterConfig === ShutterConfigType.TWO_GLASS_ONE_MESH) {
    const shutterWidth = (innerW + interlock) / 2;
    const xMid = shutterWidth - interlock;
    return [
      withHandle({
        id: 0,
        xMm: 0,
        widthMm: shutterWidth,
        zLayer: 5,
        isMesh: false,
        animates: animates(0, false),
        slideSign: 0,
      }),
      withHandle({
        id: 1,
        xMm: xMid,
        widthMm: shutterWidth,
        zLayer: 10,
        isMesh: false,
        animates: animates(1, true),
        slideSign: -1,
      }),
      withHandle({
        id: 2,
        xMm: xMid,
        widthMm: shutterWidth,
        zLayer: 15,
        isMesh: true,
        animates: animates(2, true),
        slideSign: 1,
      }),
    ];
  }

  if (config.shutterConfig === ShutterConfigType.THREE_GLASS) {
    const shutterWidth = (innerW + 2 * interlock) / 3;
    return Array.from({ length: 3 }, (_, i) => {
      const x = i * (shutterWidth - interlock);
      const isSide = i === 0;
      return withHandle({
        id: i,
        xMm: x,
        widthMm: shutterWidth,
        zLayer: isSide ? 5 : 10,
        isMesh: false,
        animates: animates(i, !isSide),
        slideSign: isSide ? 0 : i === 1 ? -1 : 1,
      });
    });
  }

  return [];
}

/** Slide offset (mm) for animated panel at slideOpen 0..1 — stays inside outer frame */
export function slideOffsetMm(panel: SlidingPanel3D, innerW: number, slideOpen: number): number {
  if (!panel.animates || slideOpen <= 0) return 0;
  const travel = Math.min(innerW * 0.4, panel.widthMm * 0.85) * slideOpen;
  if (panel.slideSign === -1) return -travel;
  if (panel.slideSign === 1) return travel;
  return 0;
}
