import type { DesignLayoutUnit, WindowConfig } from '../types';
import { v4 as uuidv4 } from 'uuid';

export interface LayoutUnitPlacement {
  id: string;
  title: string;
  config: WindowConfig;
  xMm: number;
  yMm: number;
  widthMm: number;
  heightMm: number;
}

export function cloneWindowConfigForLayout(config: WindowConfig): WindowConfig {
  return structuredClone(config);
}

export function computeLayoutPlacements(
  primary: WindowConfig,
  primaryTitle: string,
  companions: DesignLayoutUnit[],
): LayoutUnitPlacement[] {
  const primaryW = Number(primary.width) || 0;
  const primaryH = Number(primary.height) || 0;
  const units: LayoutUnitPlacement[] = [
    {
      id: 'primary',
      title: primaryTitle || 'Window 1',
      config: primary,
      xMm: 0,
      yMm: 0,
      widthMm: primaryW,
      heightMm: primaryH,
    },
  ];

  let prevRight = primaryW;
  for (const c of companions) {
    const w = Number(c.config.width) || 0;
    const h = Number(c.config.height) || 0;
    const x = prevRight + (Number(c.gapFromPrevMm) || 0);
    units.push({
      id: c.id,
      title: c.title,
      config: c.config,
      xMm: x,
      yMm: Number(c.offsetTopFromPrimaryMm) || 0,
      widthMm: w,
      heightMm: h,
    });
    prevRight = x + w;
  }
  return units;
}

export function layoutBounds(units: LayoutUnitPlacement[]) {
  let maxX = 0;
  let maxY = 0;
  for (const u of units) {
    maxX = Math.max(maxX, u.xMm + u.widthMm);
    maxY = Math.max(maxY, u.yMm + u.heightMm);
  }
  return { widthMm: maxX, heightMm: maxY };
}

export function newLayoutUnitFromConfig(config: WindowConfig, index: number): DesignLayoutUnit {
  return {
    id: uuidv4(),
    title: `Window ${index + 1}`,
    config: cloneWindowConfigForLayout(config),
    gapFromPrevMm: 50,
    offsetTopFromPrimaryMm: 0,
  };
}
