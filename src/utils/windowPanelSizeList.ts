import type { PartitionPanelConfig, ProfileDimensions, WindowConfig } from '../types';
import { FixedPanelPosition, ShutterConfigType, WindowType } from '../types';
import { getPartitionPanelWidthsMm, getPartitionPanelTopMm } from './partitionPanelGeometry';
import { resolveFoldFrameEdges } from './foldDoorFrame';

export interface PanelSizeRow {
  label: string;
  widthMm: number;
  heightMm: number;
}

const rz = (n: number) => Math.round(Math.max(0, n));

function netGlassRect(
  outerW: number,
  outerH: number,
  top: number,
  bottom: number,
  left: number,
  right: number
): { w: number; h: number } {
  return {
    w: rz(outerW - left - right),
    h: rz(outerH - top - bottom),
  };
}

function partitionLabel(t: PartitionPanelConfig['type']): string {
  switch (t) {
    case 'fixed':
      return 'Fixed';
    case 'sliding':
      return 'Sliding';
    case 'hinged':
      return 'Hinged';
    case 'fold':
      return 'Fold';
    default:
      return String(t);
  }
}

function openingGeometry(config: WindowConfig, dims: ProfileDimensions) {
  const w = Number(config.width) || 0;
  const h = Number(config.height) || 0;
  const { windowType, fixedPanels } = config;
  const topFix = fixedPanels.find((p) => p.position === FixedPanelPosition.TOP);
  const bottomFix = fixedPanels.find((p) => p.position === FixedPanelPosition.BOTTOM);
  const leftFix = fixedPanels.find((p) => p.position === FixedPanelPosition.LEFT);
  const rightFix = fixedPanels.find((p) => p.position === FixedPanelPosition.RIGHT);

  const frameOffset =
    windowType !== WindowType.GLASS_PARTITION &&
    windowType !== WindowType.CORNER &&
    windowType !== WindowType.MIRROR &&
    windowType !== WindowType.LOUVERS
      ? Number(dims.outerFrame) || 0
      : 0;

  const holeX1 = leftFix ? leftFix.size : frameOffset;
  const holeY1 = topFix ? topFix.size : frameOffset;
  const holeX2 = rightFix ? w - rightFix.size : w - frameOffset;
  const holeY2 = bottomFix ? h - bottomFix.size : h - frameOffset;

  const ff = Number(dims.fixedFrame) || 0;
  const hDividerX = leftFix ? holeX1 : frameOffset;
  const hDividerWidth = (rightFix ? holeX2 : w - frameOffset) - hDividerX;
  const vGlassY = topFix ? holeY1 : frameOffset;
  const vGlassHeight = (bottomFix ? holeY2 : h - frameOffset) - vGlassY;

  return {
    w,
    h,
    topFix,
    bottomFix,
    leftFix,
    rightFix,
    frameOffset,
    holeX1,
    holeY1,
    holeX2,
    holeY2,
    ff,
    hDividerX,
    hDividerWidth,
    vGlassY,
    vGlassHeight,
    innerW: holeX2 - holeX1,
    innerH: holeY2 - holeY1,
  };
}

function fixedPanelRows(config: WindowConfig, g: ReturnType<typeof openingGeometry>): PanelSizeRow[] {
  const rows: PanelSizeRow[] = [];
  const { w, h, topFix, bottomFix, leftFix, rightFix, frameOffset, holeX1, holeY1, holeX2, holeY2, ff, hDividerWidth, vGlassY, vGlassHeight } = g;

  if (topFix) {
    const glassW = hDividerWidth;
    const glassH = holeY1 - frameOffset - ff;
    rows.push({ label: 'Fixed panel (top) — glass', widthMm: rz(glassW), heightMm: rz(glassH) });
  }
  if (bottomFix) {
    const glassW = hDividerWidth;
    const glassH = h - holeY2 - frameOffset - ff;
    rows.push({ label: 'Fixed panel (bottom) — glass', widthMm: rz(glassW), heightMm: rz(glassH) });
  }
  if (leftFix) {
    const glassW = holeX1 - frameOffset - ff;
    rows.push({ label: 'Fixed panel (left) — glass', widthMm: rz(glassW), heightMm: rz(vGlassHeight) });
  }
  if (rightFix) {
    const glassW = w - holeX2 - frameOffset - ff;
    rows.push({ label: 'Fixed panel (right) — glass', widthMm: rz(glassW), heightMm: rz(vGlassHeight) });
  }
  return rows;
}

function slidingShutterRows(
  config: WindowConfig,
  dims: ProfileDimensions,
  innerW: number,
  innerH: number
): PanelSizeRow[] {
  const { shutterConfig, fixedShutters } = config;
  const interlock = Number(dims.shutterInterlock) || 0;
  const meeting = Number(dims.shutterMeeting) || 0;
  const st = Number(dims.shutterTop) || 0;
  const sb = Number(dims.shutterBottom) || 0;
  const sh = Number(dims.shutterHandle) || 0;

  const rows: PanelSizeRow[] = [];

  if (shutterConfig === ShutterConfigType.FOUR_GLASS_TWO_MESH) {
    const panelWidth = (innerW + 3 * interlock) / 4;
    /** Matches WindowCanvas outer/mesh handle vs interlock assignment. */
    const panels: { id: number; label: string; leftP: number; rightP: number; mesh: boolean }[] = [
      { id: 0, label: 'Outer fixed (left)', leftP: sh, rightP: interlock, mesh: false },
      { id: 1, label: 'Sliding glass (left)', leftP: interlock, rightP: interlock, mesh: false },
      { id: 2, label: 'Sliding mesh (left)', leftP: sh, rightP: interlock, mesh: true },
      { id: 3, label: 'Sliding mesh (right)', leftP: interlock, rightP: sh, mesh: true },
      { id: 4, label: 'Sliding glass (right)', leftP: interlock, rightP: interlock, mesh: false },
      { id: 5, label: 'Outer fixed (right)', leftP: interlock, rightP: sh, mesh: false },
    ];
    for (const p of panels) {
      const fixed = fixedShutters[p.id] ? ' (fixed)' : ' (sliding)';
      const suffix = p.mesh ? ' — mesh opening' : ' — glass';
      const { w: gw, h: gh } = netGlassRect(panelWidth, innerH, st, sb, p.leftP, p.rightP);
      rows.push({ label: `${p.label}${suffix}${fixed}`, widthMm: gw, heightMm: gh });
    }
    return rows;
  }

  if (shutterConfig === ShutterConfigType.FOUR_GLASS) {
    const shutterWidth = (innerW + 2 * interlock + meeting) / 4;
    const profs = [
      { l: sh, r: interlock },
      { l: interlock, r: meeting },
      { l: meeting, r: interlock },
      { l: interlock, r: sh },
    ];
    for (let i = 0; i < 4; i++) {
      const p = profs[i];
      const fix = fixedShutters[i] ? ' (fixed)' : ' (sliding)';
      const { w: gw, h: gh } = netGlassRect(shutterWidth, innerH, st, sb, p.l, p.r);
      rows.push({ label: `Shutter ${i + 1} (glass)${fix}`, widthMm: gw, heightMm: gh });
    }
    return rows;
  }

  const hasMesh = shutterConfig === ShutterConfigType.TWO_GLASS_ONE_MESH;
  const numShutters = hasMesh ? 3 : shutterConfig === ShutterConfigType.TWO_GLASS ? 2 : 3;
  const shutterDivider = hasMesh ? 2 : numShutters;
  const shutterWidth = (innerW + (shutterDivider - 1) * interlock) / shutterDivider;

  for (let i = 0; i < numShutters; i++) {
    const isMeshShutter = hasMesh && i === numShutters - 1;
    const leftP = i === 0 ? sh : interlock;
    const rightP = i === numShutters - 1 ? sh : interlock;
    const fix = fixedShutters[i] ? ' (fixed)' : ' (sliding)';
    if (isMeshShutter) {
      const { w: gw, h: gh } = netGlassRect(shutterWidth, innerH, st, sb, leftP, rightP);
      rows.push({ label: `Shutter ${i + 1} (mesh)${fix}`, widthMm: gw, heightMm: gh });
    } else {
      const { w: gw, h: gh } = netGlassRect(shutterWidth, innerH, st, sb, leftP, rightP);
      rows.push({ label: `Shutter ${i + 1} (glass)${fix}`, widthMm: gw, heightMm: gh });
    }
  }

  return rows;
}

function casementVentRows(config: WindowConfig, dims: ProfileDimensions, innerW: number, innerH: number): PanelSizeRow[] {
  const { verticalDividers, horizontalDividers, windowType } = config;
  const gridCols = verticalDividers.length + 1;
  const gridRows = horizontalDividers.length + 1;
  const cs = Number(dims.casementShutter) || 0;
  const rows: PanelSizeRow[] = [];

  for (let c = 0; c < gridCols; c++) {
    for (let r = 0; r < gridRows; r++) {
      const x0 = c === 0 ? 0 : verticalDividers[c - 1];
      const x1 = c === verticalDividers.length ? 1 : verticalDividers[c];
      const y0 = r === 0 ? 0 : horizontalDividers[r - 1];
      const y1 = r === horizontalDividers.length ? 1 : horizontalDividers[r];
      const cellW = (x1 - x0) * innerW;
      const cellH = (y1 - y0) * innerH;

      if (windowType === WindowType.CASEMENT) {
        const door = config.doorPositions.find((p) => p.row === r && p.col === c);
        if (door) {
          const { w: gw, h: gh } = netGlassRect(cellW, cellH, cs, cs, cs, cs);
          rows.push({
            label: `Col ${c + 1} · Row ${r + 1} — casement door (glass)`,
            widthMm: gw,
            heightMm: gh,
          });
        } else {
          rows.push({
            label: `Col ${c + 1} · Row ${r + 1} — fixed glass`,
            widthMm: rz(cellW),
            heightMm: rz(cellH),
          });
        }
      } else {
        const cell = config.ventilatorGrid[r]?.[c];
        const t = cell?.type || 'glass';
        if (t === 'door') {
          const { w: gw, h: gh } = netGlassRect(cellW, cellH, cs, cs, cs, cs);
          rows.push({
            label: `Col ${c + 1} · Row ${r + 1} — door (glass)`,
            widthMm: gw,
            heightMm: gh,
          });
        } else if (t === 'louvers') {
          rows.push({
            label: `Col ${c + 1} · Row ${r + 1} — louvers (opening)`,
            widthMm: rz(cellW),
            heightMm: rz(cellH),
          });
        } else if (t === 'exhaust_fan') {
          rows.push({
            label: `Col ${c + 1} · Row ${r + 1} — exhaust opening`,
            widthMm: rz(cellW),
            heightMm: rz(cellH),
          });
        } else {
          rows.push({
            label: `Col ${c + 1} · Row ${r + 1} — fixed glass`,
            widthMm: rz(cellW),
            heightMm: rz(cellH),
          });
        }
      }
    }
  }
  return rows;
}

function louverBandRows(config: WindowConfig, innerW: number, innerH: number): PanelSizeRow[] {
  const { louverPattern, orientation } = config;
  const rows: PanelSizeRow[] = [];
  const maxBands = 48;
  let band = 0;

  if (orientation === 'vertical') {
    const patternHeight = louverPattern.reduce((sum, item) => sum + (Number(item.size) || 0), 0);
    if (patternHeight <= 0) return rows;
    let currentY = 0;
    outer: while (currentY < innerH && band < maxBands) {
      for (const item of louverPattern) {
        if (currentY >= innerH || band >= maxBands) break outer;
        const itemSize = Number(item.size) || 0;
        const remaining = innerH - currentY;
        const h = Math.min(itemSize, remaining);
        const label = item.type === 'profile' ? `Louver band ${band + 1} (blade)` : `Louver band ${band + 1} (gap)`;
        rows.push({ label, widthMm: rz(innerW), heightMm: rz(h) });
        band++;
        currentY += itemSize;
      }
    }
  } else {
    const patternWidth = louverPattern.reduce((sum, item) => sum + (Number(item.size) || 0), 0);
    if (patternWidth <= 0) return rows;
    let currentX = 0;
    outer: while (currentX < innerW && band < maxBands) {
      for (const item of louverPattern) {
        if (currentX >= innerW || band >= maxBands) break outer;
        const itemSize = Number(item.size) || 0;
        const remaining = innerW - currentX;
        const w = Math.min(itemSize, remaining);
        const label = item.type === 'profile' ? `Louver band ${band + 1} (blade)` : `Louver band ${band + 1} (gap)`;
        rows.push({ label, widthMm: rz(w), heightMm: rz(innerH) });
        band++;
        currentX += itemSize;
      }
    }
  }

  if (band >= maxBands) {
    rows.push({ label: '… (more bands — pattern repeats)', widthMm: 0, heightMm: 0 });
  }
  return rows;
}

function partitionRows(config: WindowConfig, dims: ProfileDimensions, innerW: number, innerH: number): PanelSizeRow[] {
  const { partitionPanels } = config;
  const panelWidths = getPartitionPanelWidthsMm(
    innerW,
    partitionPanels.count,
    partitionPanels.types,
    partitionPanels.widthFractions
  );
  const panelAreaY = partitionPanels.hasTopChannel ? Number(dims.topTrack) || 0 : 0;
  const panelAreaHeight =
    innerH - (partitionPanels.hasTopChannel ? (Number(dims.topTrack) || 0) + (Number(dims.bottomTrack) || 0) : 0);

  const rows: PanelSizeRow[] = [];
  const frameSize = Number(dims.casementShutter) || 0;

  for (let i = 0; i < partitionPanels.count; i++) {
    const panelConfig = partitionPanels.types[i];
    if (!panelConfig) continue;
    const { type, framing } = panelConfig;
    const currentPanelWidth = panelWidths[i] ?? 0;

    let ph = panelAreaHeight;
    const rawHm = panelConfig.heightMm;
    if (rawHm !== '' && rawHm !== undefined && rawHm !== null) {
      const nh = Number(rawHm);
      if (Number.isFinite(nh) && nh > 0) ph = Math.min(nh, panelAreaHeight);
    }
    const py = getPartitionPanelTopMm(panelAreaY, panelAreaHeight, ph, panelConfig.heightAlign);

    const isFramed = framing === 'full' || type === 'hinged';
    let ft = frameSize;
    let fb = frameSize;
    let fl = frameSize;
    let fr = frameSize;
    if (isFramed && type === 'fold') {
      const e = resolveFoldFrameEdges(panelConfig, frameSize);
      ft = e.top;
      fb = e.bottom;
      fl = e.left;
      fr = e.right;
    }

    if (isFramed) {
      const { w: gw, h: gh } = netGlassRect(currentPanelWidth, ph, ft, fb, fl, fr);
      rows.push({
        label: `Panel ${i + 1} — ${partitionLabel(type)} (glass)`,
        widthMm: gw,
        heightMm: gh,
      });
    } else {
      rows.push({
        label: `Panel ${i + 1} — ${partitionLabel(type)} (glass)`,
        widthMm: rz(currentPanelWidth),
        heightMm: rz(ph),
      });
    }
  }

  return rows;
}

function mirrorRows(config: WindowConfig, dims: ProfileDimensions, innerW: number, innerH: number): PanelSizeRow[] {
  const ft = config.mirrorConfig.isFrameless ? 0 : Number(dims.outerFrame) || 0;
  const mw = rz(innerW - 2 * ft);
  const mh = rz(innerH - 2 * ft);
  return [{ label: config.mirrorConfig.isFrameless ? 'Mirror (glass)' : 'Mirror — glass (inside frame)', widthMm: mw, heightMm: mh }];
}

/** Per-panel / per-cell sizes (mm), left-to-right and top-to-bottom where applicable. */
export function getWindowPanelSizeRows(config: WindowConfig, dims: ProfileDimensions): PanelSizeRow[] {
  if (config.windowType === WindowType.CORNER && config.leftConfig && config.rightConfig) {
    const leftW = Number(config.leftWidth) || 0;
    const rightW = Number(config.rightWidth) || 0;
    const postW = Number(config.cornerPostWidth) || 0;
    const h = Number(config.height) || 0;

    const leftCfg: WindowConfig = {
      ...config,
      ...config.leftConfig,
      width: leftW,
      windowType: config.leftConfig.windowType,
      fixedPanels: [],
    };
    const rightCfg: WindowConfig = {
      ...config,
      ...config.rightConfig,
      width: rightW,
      windowType: config.rightConfig.windowType,
      fixedPanels: [],
    };

    const out: PanelSizeRow[] = [];
    getWindowPanelSizeRows(leftCfg, dims).forEach((r) =>
      out.push({ ...r, label: `Left leg · ${r.label}` })
    );
    out.push({ label: 'Corner post (opening)', widthMm: rz(postW), heightMm: rz(h) });
    getWindowPanelSizeRows(rightCfg, dims).forEach((r) =>
      out.push({ ...r, label: `Right leg · ${r.label}` })
    );
    return out;
  }

  const g = openingGeometry(config, dims);
  if (g.innerW <= 0 || g.innerH <= 0) {
    return fixedPanelRows(config, g);
  }

  const rows: PanelSizeRow[] = [...fixedPanelRows(config, g)];

  switch (config.windowType) {
    case WindowType.SLIDING:
      rows.push(...slidingShutterRows(config, dims, g.innerW, g.innerH));
      break;
    case WindowType.CASEMENT:
    case WindowType.VENTILATOR:
      rows.push(...casementVentRows(config, dims, g.innerW, g.innerH));
      break;
    case WindowType.GLASS_PARTITION:
      rows.push(...partitionRows(config, dims, g.innerW, g.innerH));
      break;
    case WindowType.MIRROR:
      rows.push(...mirrorRows(config, dims, g.innerW, g.innerH));
      break;
    case WindowType.LOUVERS:
      rows.push(...louverBandRows(config, g.innerW, g.innerH));
      break;
    default:
      break;
  }

  return rows;
}
