import type { HandleConfig, WindowConfig } from '../types';
import { FixedPanelPosition, ShutterConfigType, WindowType } from '../types';

/** Default inset from meeting stile / opening edge (mm). User can fine-tune in Handle Configuration. */
export const HANDLE_EDGE_INSET_MM = 5;

function clampPct(n: number): number {
  return Math.min(98, Math.max(2, Math.round(n * 10) / 10));
}

/** Inner opening (glass hole) in mm — matches WindowCanvas geometry. */
export function computeInnerHoleDims(config: {
  width: number | string | '';
  height: number | string | '';
  fixedPanels: { position: FixedPanelPosition; size: number }[];
  windowType: WindowType;
  series: { dimensions: { outerFrame?: number | '' } };
}): { innerW: number; innerH: number } {
  const w = Number(config.width) || 0;
  const h = Number(config.height) || 0;
  const { fixedPanels, windowType } = config;
  const outerFrame = Number(config.series.dimensions.outerFrame) || 0;
  const frameOffset =
    windowType !== WindowType.GLASS_PARTITION &&
    windowType !== WindowType.CORNER &&
    windowType !== WindowType.MIRROR &&
    windowType !== WindowType.LOUVERS
      ? outerFrame
      : 0;

  const topFix = fixedPanels.find((p) => p.position === FixedPanelPosition.TOP);
  const bottomFix = fixedPanels.find((p) => p.position === FixedPanelPosition.BOTTOM);
  const leftFix = fixedPanels.find((p) => p.position === FixedPanelPosition.LEFT);
  const rightFix = fixedPanels.find((p) => p.position === FixedPanelPosition.RIGHT);

  const holeX1 = leftFix ? leftFix.size : frameOffset;
  const holeY1 = topFix ? topFix.size : frameOffset;
  const holeX2 = rightFix ? w - rightFix.size : w - frameOffset;
  const holeY2 = bottomFix ? h - bottomFix.size : h - frameOffset;

  return { innerW: Math.max(0, holeX2 - holeX1), innerH: Math.max(0, holeY2 - holeY1) };
}

/** Which vertical frame member the handle sits on (centered in that profile). */
export type SlidingMemberSide = 'left' | 'right';

/** Left/right stile choice for standard multi-track layouts (not 4G2M). */
export function slidingMemberSideStandard(panelIndex: number, numPanels: number): SlidingMemberSide {
  if (numPanels <= 1) return 'left';
  if (panelIndex === 0) return 'left';
  if (panelIndex === numPanels - 1) return 'right';
  return panelIndex % 2 === 1 ? 'right' : 'left';
}

/** 4G2M panel ids: outer left stack → left member; outer right → right member; mid glass/mesh → meeting side. */
export function slidingMemberSide4G2M(panelId: number): SlidingMemberSide {
  if (panelId === 0 || panelId === 2) return 'left';
  if (panelId === 5 || panelId === 3) return 'right';
  if (panelId === 1) return 'right';
  if (panelId === 4) return 'left';
  return 'right';
}

/** Mirror handle artwork when the hardware sits on the right-hand stile so the lever faces inward. */
export function mirrorHandleForSlidingMember(side: SlidingMemberSide): boolean {
  return side === 'right';
}

export function mirrorHandleForPartitionHandleX(handleXPct: number): boolean {
  return handleXPct > 50;
}

/**
 * Horizontal position (% from left of panel) so the handle sits on the left or right vertical frame member
 * (centered in shutterHandle / interlock strip), not on the glass or center mullion.
 */
export function slidingHandleXPctOnFrameMember(
  shutterWidthMm: number,
  leftProfMm: number,
  rightProfMm: number,
  side: SlidingMemberSide
): number {
  const W = Math.max(shutterWidthMm, 20);
  const L = Math.max(0, leftProfMm);
  const R = Math.max(0, rightProfMm);
  if (side === 'left') {
    const cx = L > 0 ? L / 2 : Math.min(HANDLE_EDGE_INSET_MM, W / 4);
    return clampPct((cx / W) * 100);
  }
  const cx = R > 0 ? W - R / 2 : W - Math.min(HANDLE_EDGE_INSET_MM, W / 4);
  return clampPct((cx / W) * 100);
}

/** Casement / ventilator door: left-side columns → 5mm from left stile; right-side columns → 5mm from right stile. Single column: 5mm from right (typical opening edge). */
export function defaultCasementHandleXPct(col: number, gridCols: number, cellWidthMm: number): number {
  const w = Math.max(cellWidthMm, 15);
  const inset = Math.min(HANDLE_EDGE_INSET_MM, w / 2 - 2);
  const fromRight = ((w - inset) / w) * 100;
  const fromLeft = (inset / w) * 100;
  if (gridCols <= 1) return clampPct(fromRight);
  const isRightHalf = col >= Math.ceil(gridCols / 2);
  return clampPct(isRightHalf ? fromRight : fromLeft);
}

export function getDefaultHandleConfig(panelId: string, config: WindowConfig): HandleConfig {
  const parts = panelId.split('-');
  const kind = parts[0];
  const inner = computeInnerHoleDims(config);
  const interlock = Number(config.series.dimensions.shutterInterlock) || 0;
  const meeting = Number(config.series.dimensions.shutterMeeting) || 0;
  const shutterHandle = Number(config.series.dimensions.shutterHandle) || 0;

  if (kind === 'sliding') {
    const idx = parseInt(parts[1], 10);
    const { shutterConfig } = config;

    const slidingLeverDefaults = {
      y: 50,
      orientation: 'vertical' as const,
      length: 158,
      variant: 'casement' as const,
    };

    if (shutterConfig === ShutterConfigType.FOUR_GLASS_TWO_MESH) {
      const panelW = (inner.innerW + 3 * interlock) / 4;
      const side = slidingMemberSide4G2M(idx);
      let leftP = interlock;
      let rightP = interlock;
      if (idx === 0 || idx === 2) leftP = shutterHandle;
      if (idx === 3 || idx === 5) rightP = shutterHandle;
      const x = slidingHandleXPctOnFrameMember(panelW, leftP, rightP, side);
      return { x, ...slidingLeverDefaults };
    }

    if (shutterConfig === ShutterConfigType.FOUR_GLASS) {
      const shutterWidth = (inner.innerW + 2 * interlock + meeting) / 4;
      const profiles = [
        { l: shutterHandle, r: interlock },
        { l: interlock, r: meeting },
        { l: meeting, r: interlock },
        { l: interlock, r: shutterHandle },
      ];
      const p = profiles[idx] ?? profiles[0];
      const side = slidingMemberSideStandard(idx, 4);
      const x = slidingHandleXPctOnFrameMember(shutterWidth, p.l, p.r, side);
      return { x, ...slidingLeverDefaults };
    }

    const hasMesh = shutterConfig === ShutterConfigType.TWO_GLASS_ONE_MESH;
    const numShutters = hasMesh ? 3 : shutterConfig === ShutterConfigType.TWO_GLASS ? 2 : 3;
    const shutterDivider = hasMesh ? 2 : numShutters;
    const shutterWidth = (inner.innerW + (shutterDivider - 1) * interlock) / shutterDivider;
    const side = slidingMemberSideStandard(idx, numShutters);
    const leftP = idx === 0 ? shutterHandle : interlock;
    const rightP = idx === numShutters - 1 ? shutterHandle : interlock;
    const x = slidingHandleXPctOnFrameMember(shutterWidth, leftP, rightP, side);
    return { x, ...slidingLeverDefaults };
  }

  if (kind === 'casement') {
    const col = parseInt(parts[2], 10);
    const { verticalDividers } = config;
    const gridCols = verticalDividers.length + 1;
    const x_start_rel = col === 0 ? 0 : verticalDividers[col - 1];
    const x_end_rel = col === verticalDividers.length ? 1 : verticalDividers[col];
    const cellW = (x_end_rel - x_start_rel) * inner.innerW;
    const x = defaultCasementHandleXPct(col, gridCols, cellW);
    return { x, y: 50, orientation: 'vertical', length: 158, variant: 'casement' };
  }

  if (kind === 'ventilator') {
    const col = parseInt(parts[2], 10);
    const { verticalDividers } = config;
    const gridCols = verticalDividers.length + 1;
    const x_start_rel = col === 0 ? 0 : verticalDividers[col - 1];
    const x_end_rel = col === verticalDividers.length ? 1 : verticalDividers[col];
    const cellW = (x_end_rel - x_start_rel) * inner.innerW;
    const x = defaultCasementHandleXPct(col, gridCols, cellW);
    return { x, y: 50, orientation: 'vertical', length: 158, variant: 'casement' };
  }

  if (kind === 'partition') {
    if (config.windowType !== WindowType.GLASS_PARTITION || !config.partitionPanels) {
      return { x: 50, y: 50, orientation: 'vertical', length: 158, variant: 'casement' };
    }
    const i = parseInt(parts[1], 10);
    const { partitionPanels } = config;
    const gap = 5;
    const numGaps = partitionPanels.types.slice(0, -1).reduce((acc, _cur, index) => {
      const current = partitionPanels.types[index];
      const next = partitionPanels.types[index + 1];
      if ((current.type === 'sliding' || current.type === 'hinged') && (next.type === 'sliding' || next.type === 'hinged')) {
        return acc + 1;
      }
      return acc;
    }, 0);
    const totalContentWidth = inner.innerW - numGaps * gap;
    const panelWidth = totalContentWidth / partitionPanels.count;
    const panelType = partitionPanels.types[i]?.type ?? 'fixed';
    if (panelType === 'sliding') {
      const side = slidingMemberSideStandard(i, partitionPanels.count);
      const leftP = i === 0 ? shutterHandle : interlock;
      const rightP = i === partitionPanels.count - 1 ? shutterHandle : interlock;
      const x = slidingHandleXPctOnFrameMember(panelWidth, leftP, rightP, side);
      return { x, y: 50, orientation: 'vertical', length: 158, variant: 'casement' };
    }
    if (panelType === 'hinged') {
      const x = defaultCasementHandleXPct(i, partitionPanels.count, panelWidth);
      return { x, y: 50, orientation: 'vertical', length: 158, variant: 'casement' };
    }
  }

  return { x: 50, y: 50, orientation: 'vertical', length: 158, variant: 'casement' };
}
