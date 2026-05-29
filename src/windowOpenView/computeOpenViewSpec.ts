import type { WindowConfig } from '../types';
import { FixedPanelPosition, TrackType, WindowType } from '../types';
import { computeInnerHoleDims } from '../utils/handleDefaults';
import {
  clampFoldLeafCount,
  getPartitionPanelTopMm,
  isOperablePartitionType,
  PARTITION_PANEL_GAP_MM,
  resolvePartitionPanelWidthsMm,
} from '../utils/partitionPanelGeometry';
import { buildSlidingPanels3D, slideOffsetMm } from '../window3d/slidingLayout3d';
import {
  casementSwingSpec,
  computeBifoldElevationLeaves,
  computeBifoldPlan,
  computeCasementPlanSegment,
  describeFoldPartitionLayout,
  type FoldOpenSide,
} from './foldOpenLayout';
import type { DoorSwingSide } from './doorHingeLayout';
import type { OpenViewKind, OpenViewOptions, OpenViewPanelSpec, OpenViewSpec } from './types';

function panelLabelSliding(id: number): string {
  const letters = 'ABCDEFGH';
  return `A${id + 1}`;
}

function panelLabelIndex(i: number): string {
  const circled = ['①', '②', '③', '④', '⑤', '⑥', '⑦', '⑧'];
  return circled[i] ?? String(i + 1);
}

/** Map shutter z-layer to physical track (1 = rear/upper, 2 = front/lower, 3 = mesh). */
function trackLaneFromZ(z: number, trackCount: number): 1 | 2 | 3 {
  if (trackCount >= 3) {
    if (z <= 6) return 1;
    if (z <= 12) return 2;
    return 3;
  }
  // 2-track: z 5 = rear (upper), z 6+ = front (lower) — must not share one lane
  return z <= 5 ? 1 : 2;
}

function buildSlidingSpec(config: WindowConfig, openAmount: number): OpenViewSpec | null {
  const w = Number(config.width) || 0;
  const h = Number(config.height) || 0;
  if (w <= 0 || h <= 0) return null;

  const dims = config.series?.dimensions;
  if (!dims) return null;

  const outerFrame = Number(dims.outerFrame) || 0;
  const inner = computeInnerHoleDims(config);
  const topFix = config.fixedPanels?.find((p) => p.position === FixedPanelPosition.TOP);
  const bottomFix = config.fixedPanels?.find((p) => p.position === FixedPanelPosition.BOTTOM);
  const leftFix = config.fixedPanels?.find((p) => p.position === FixedPanelPosition.LEFT);
  const rightFix = config.fixedPanels?.find((p) => p.position === FixedPanelPosition.RIGHT);

  const innerOriginX = leftFix ? leftFix.size : outerFrame;
  const innerOriginY = topFix ? topFix.size : outerFrame;

  const shutterTop = Number(dims.shutterTop) || 0;
  const shutterBottom = Number(dims.shutterBottom) || 0;
  const panelY = innerOriginY + shutterTop;
  const panelH = Math.max(0, inner.innerH - shutterTop - shutterBottom);

  const sliding3d = buildSlidingPanels3D(config, inner.innerW);
  const handles = config.slidingHandles ?? [];
  const trackCount = Number(config.trackType) === TrackType.THREE_TRACK ? 3 : 2;

  const panels: OpenViewPanelSpec[] = sliding3d
    .filter((p) => p.widthMm > 0 && panelH > 0)
    .sort((a, b) => a.id - b.id)
    .map((p) => {
      const offset = slideOffsetMm(p, inner.innerW, openAmount);
      const hCfg = handles[p.id];
      return {
        id: `sliding-${p.id}`,
        label: panelLabelSliding(p.id),
        xMm: innerOriginX + p.xMm + offset,
        yMm: panelY,
        widthMm: p.widthMm,
        heightMm: panelH,
        zIndex: p.zLayer,
        slideOffsetXMm: offset,
        slideDirection: p.slideSign === -1 ? 'left' : p.slideSign === 1 ? 'right' : 'none',
        trackLane: trackLaneFromZ(p.zLayer, trackCount),
        isMesh: p.isMesh,
        isFixed: !p.animates,
        handle: hCfg ?? null,
      };
    });

  return {
    kind: 'sliding',
    config,
    totalWidthMm: w,
    totalHeightMm: h,
    outerFrameMm: outerFrame,
    innerOriginMm: { x: innerOriginX, y: innerOriginY },
    innerWidthMm: inner.innerW,
    innerHeightMm: inner.innerH,
    profileColor: config.profileColor?.startsWith('#') ? config.profileColor : '#64748b',
    trackCount,
    panels,
    operationLabel: `${trackCount}-track sliding — open position`,
  };
}

function buildCasementSpec(
  config: WindowConfig,
  openAmount: number,
  kind: OpenViewKind,
  swingSide: DoorSwingSide,
): OpenViewSpec | null {
  const w = Number(config.width) || 0;
  const h = Number(config.height) || 0;
  if (w <= 0 || h <= 0) return null;
  const dims = config.series?.dimensions;
  if (!dims) return null;

  const outerFrame = Number(dims.outerFrame) || 0;
  const inner = computeInnerHoleDims(config);
  const innerOriginX = config.fixedPanels?.find((p) => p.position === FixedPanelPosition.LEFT)?.size ?? outerFrame;
  const innerOriginY = config.fixedPanels?.find((p) => p.position === FixedPanelPosition.TOP)?.size ?? outerFrame;

  const vDivs = config.verticalDividers ?? [];
  const hDivs = config.horizontalDividers ?? [];
  const rows = hDivs.length + 1;
  const cols = vDivs.length + 1;

  const panels: OpenViewPanelSpec[] = [];
  let doorIdx = 0;
  const foldOpenSide: FoldOpenSide = swingSide === 'inside' ? 'internal' : 'external';

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const x0 = c === 0 ? 0 : vDivs[c - 1];
      const x1 = c === vDivs.length ? 1 : vDivs[c];
      const y0 = r === 0 ? 0 : hDivs[r - 1];
      const y1 = r === hDivs.length ? 1 : hDivs[r];

      const cellW = (x1 - x0) * inner.innerW;
      const cellH = (y1 - y0) * inner.innerH;
      const cellX = innerOriginX + x0 * inner.innerW;
      const cellY = innerOriginY + y0 * inner.innerH;

      let isDoor = false;
      let handle = null as import('../types').HandleConfig | null | undefined;

      if (kind === 'casement') {
        const door = config.doorPositions?.find((p) => p.row === r && p.col === c);
        isDoor = Boolean(door);
        handle = door?.handle;
      } else {
        const cell = config.ventilatorGrid?.[r]?.[c];
        isDoor = cell?.type === 'door';
        handle = cell?.handle;
      }

      if (!isDoor) {
        if (kind === 'casement') {
          panels.push({
            id: `fixed-${r}-${c}`,
            label: 'F',
            xMm: cellX,
            yMm: cellY,
            widthMm: cellW,
            heightMm: cellH,
            zIndex: 2,
            isFixed: true,
          });
        } else {
          const cell = config.ventilatorGrid?.[r]?.[c];
          if (cell?.type === 'fixed') {
            panels.push({
              id: `vent-fixed-${r}-${c}`,
              label: 'F',
              xMm: cellX,
              yMm: cellY,
              widthMm: cellW,
              heightMm: cellH,
              zIndex: 2,
              isFixed: true,
            });
          }
        }
        continue;
      }

      const hingeLeft = doorIdx % 2 === 0;
      const swing = casementSwingSpec(
        cellX,
        cellY,
        cellW,
        cellH,
        hingeLeft,
        openAmount,
        kind === 'casement' ? `casement-${r}-${c}` : `ventilator-${r}-${c}`,
        panelLabelSliding(doorIdx),
        10 + doorIdx,
        handle ?? null,
        swingSide,
      );
      const planSeg = computeCasementPlanSegment(
        cellX,
        cellW,
        openAmount,
        swing.doorSwing.hungType,
        foldOpenSide,
        panelLabelIndex(doorIdx),
      );
      panels.push({
        ...swing,
        doorSwing: swing.doorSwing,
        planSegment: {
          x1: planSeg.x1,
          y1: planSeg.y1,
          x2: planSeg.x2,
          y2: planSeg.y2,
          pivot: planSeg.pivot,
        },
      });
      doorIdx++;
    }
  }

  if (panels.length === 0) return null;

  const mullionMm = Number(dims.mullion) || Number(dims.fixedFrame) || 0;
  const shutterProfile = Number(dims.casementShutter) || outerFrame;
  const mullions: { xMm: number; yMm: number; heightMm: number; widthMm: number }[] = [];
  for (const pos of vDivs) {
    mullions.push({
      xMm: innerOriginX + pos * inner.innerW - mullionMm / 2,
      yMm: innerOriginY,
      heightMm: inner.innerH,
      widthMm: mullionMm,
    });
  }
  for (const pos of hDivs) {
    mullions.push({
      xMm: innerOriginX,
      yMm: innerOriginY + pos * inner.innerH - mullionMm / 2,
      widthMm: inner.innerW,
      heightMm: mullionMm,
    });
  }

  return {
    kind,
    config,
    totalWidthMm: w,
    totalHeightMm: h,
    outerFrameMm: outerFrame,
    innerOriginMm: { x: innerOriginX, y: innerOriginY },
    innerWidthMm: inner.innerW,
    innerHeightMm: inner.innerH,
    profileColor: config.profileColor?.startsWith('#') ? config.profileColor : '#64748b',
    panels,
    partitionChrome: {
      hasTopChannel: false,
      topTrackMm: 0,
      bottomTrackMm: 0,
      shutterProfileMm: shutterProfile,
      mullions,
    },
    operationLabel: kind === 'casement' ? 'Casement — C,D −20° top/bottom' : 'Ventilator — C,D −20° top/bottom',
  };
}

function buildPartitionSpec(config: WindowConfig, openAmount: number, swingSide: DoorSwingSide): OpenViewSpec | null {
  const w = Number(config.width) || 0;
  const h = Number(config.height) || 0;
  if (w <= 0 || h <= 0) return null;
  const dims = config.series?.dimensions;
  if (!dims) return null;

  const { partitionPanels } = config;
  const outerFrame = Number(dims.outerFrame) || Number(dims.casementShutter) || 35;
  const shutterProfile = Number(dims.casementShutter) || outerFrame;
  const topTrack = partitionPanels.hasTopChannel ? Number(dims.topTrack) || 0 : 0;
  const bottomTrack = partitionPanels.hasTopChannel ? Number(dims.bottomTrack) || 0 : 0;

  const innerOriginX = outerFrame;
  const innerOriginY = outerFrame + topTrack;
  const innerW = Math.max(0, w - 2 * outerFrame);
  const innerH = Math.max(0, h - 2 * outerFrame - topTrack - bottomTrack);
  const panelAreaH = innerH;

  const widths = resolvePartitionPanelWidthsMm(
    innerW,
    partitionPanels.count,
    partitionPanels.types,
    partitionPanels.widthFractions,
  );

  let kind: OpenViewKind = 'partition_hinged';
  const hasFold = partitionPanels.types.some((t) => t?.type === 'fold');
  const hasSlide = partitionPanels.types.some((t) => t?.type === 'sliding');
  const isFoldSlideCombo = hasFold && hasSlide;
  if (isFoldSlideCombo) kind = 'partition_fold';
  else if (hasFold) kind = 'partition_fold';
  else if (hasSlide) kind = 'partition_sliding';

  const panels: OpenViewPanelSpec[] = [];
  const mullions: { xMm: number; yMm: number; heightMm: number; widthMm: number }[] = [];
  let x = innerOriginX;
  let idx = 0;

  const foldPanelIndices = partitionPanels.types
    .map((t, i) => (t?.type === 'fold' ? i : -1))
    .filter((i) => i >= 0);
  const isCenterOpening =
    foldPanelIndices.length === 2 && !partitionPanels.types.some((t) => t?.type === 'sliding');
  const layoutLabel = describeFoldPartitionLayout(partitionPanels.types);
  let foldLeafLabelOffset = 0;
  const foldOpenSide: FoldOpenSide = swingSide === 'inside' ? 'internal' : 'external';

  for (let i = 0; i < partitionPanels.count; i++) {
    const t = partitionPanels.types[i];
    if (!t) {
      x += widths[i] ?? 0;
      continue;
    }

    if (t.type === 'fixed') {
      x += widths[i] ?? 0;
      if (i < partitionPanels.count - 1) {
        const next = partitionPanels.types[i + 1];
        if (next && isOperablePartitionType(next.type)) {
          mullions.push({
            xMm: x,
            yMm: innerOriginY,
            heightMm: panelAreaH,
            widthMm: PARTITION_PANEL_GAP_MM,
          });
          x += PARTITION_PANEL_GAP_MM;
        }
      }
      continue;
    }

    const pw = widths[i] ?? 0;
    let ph = panelAreaH;
    const rawHm = t.heightMm;
    if (rawHm !== '' && rawHm !== undefined && rawHm !== null) {
      const nh = Number(rawHm);
      if (Number.isFinite(nh) && nh > 0) ph = Math.min(nh, panelAreaH);
    }
    const panelY = innerOriginY + getPartitionPanelTopMm(0, panelAreaH, ph, t.heightAlign);

    if (t.type === 'sliding') {
      if (isFoldSlideCombo) {
        /** +1 panel in 3+1, 4+1… — frame-hung door (A,B fixed), C,D −20° (not track slide). */
        const hingeLeft = foldPanelIndices.every((fi) => fi > i);
        const swing = casementSwingSpec(
          x,
          panelY,
          pw,
          ph,
          hingeLeft,
          openAmount,
          `partition-${i}`,
          panelLabelIndex(idx),
          10 + i,
          t.handle ?? null,
          swingSide,
        );
        const planSeg = computeCasementPlanSegment(
          x,
          pw,
          openAmount,
          swing.doorSwing.hungType,
          foldOpenSide,
          panelLabelIndex(idx),
        );
        panels.push({
          ...swing,
          doorSwing: swing.doorSwing,
          planSegment: {
            x1: planSeg.x1,
            y1: planSeg.y1,
            x2: planSeg.x2,
            y2: planSeg.y2,
            pivot: planSeg.pivot,
          },
        });
      } else {
        const travel = Math.min(innerW * 0.35, pw * 0.8) * openAmount;
        const dir = i === 0 ? -1 : 1;
        panels.push({
          id: `partition-${i}`,
          label: panelLabelSliding(idx),
          xMm: x + dir * travel,
          yMm: panelY,
          widthMm: pw,
          heightMm: ph,
          zIndex: 10 + i,
          slideOffsetXMm: dir * travel,
          slideDirection: dir < 0 ? 'left' : 'right',
          trackLane: (i % 2 === 0 ? 1 : 2) as 1 | 2,
          handle: t.handle ?? null,
        });
      }
    } else if (t.type === 'fold') {
      const leaves = clampFoldLeafCount(t.foldLeafCount);
      const stackSide =
        isCenterOpening && i === foldPanelIndices[1] ? ('right' as const) : ('left' as const);
      const bifoldLeaves = computeBifoldElevationLeaves(
        x,
        panelY,
        pw,
        ph,
        leaves,
        openAmount,
        10 + i,
        `partition-${i}`,
        t.handle ?? null,
        swingSide,
        stackSide,
        foldLeafLabelOffset,
      );
      const plan = computeBifoldPlan(x, pw, leaves, openAmount, foldOpenSide, stackSide, foldLeafLabelOffset);
      foldLeafLabelOffset += leaves;
      bifoldLeaves.forEach((leaf, k) => {
        panels.push({
          id: leaf.id,
          label: leaf.label,
          xMm: leaf.xMm,
          yMm: leaf.yMm,
          widthMm: leaf.widthMm,
          heightMm: leaf.heightMm,
          zIndex: leaf.zIndex,
          doorSwing: leaf.doorSwing,
          handle: leaf.handle,
          ...(k === 0
            ? {
                bifoldPlan: {
                  path: plan.path,
                  pivots: plan.pivots,
                  segments: plan.segments,
                },
              }
            : {}),
        });
      });
      idx += leaves - 1;
    } else {
      const hingeLeft = i % 2 === 0;
      const swing = casementSwingSpec(
        x,
        panelY,
        pw,
        ph,
        hingeLeft,
        openAmount,
        `partition-${i}`,
        panelLabelSliding(idx),
        10 + i,
        t.handle ?? null,
        swingSide,
      );
      const planSeg = computeCasementPlanSegment(
        x,
        pw,
        openAmount,
        swing.doorSwing.hungType,
        foldOpenSide,
        panelLabelIndex(idx),
      );
      panels.push({
        ...swing,
        doorSwing: swing.doorSwing,
        planSegment: {
          x1: planSeg.x1,
          y1: planSeg.y1,
          x2: planSeg.x2,
          y2: planSeg.y2,
          pivot: planSeg.pivot,
        },
      });
    }
    idx++;
    x += pw;
    if (i < partitionPanels.count - 1) {
      const next = partitionPanels.types[i + 1];
      if (next && isOperablePartitionType(t.type) && isOperablePartitionType(next.type)) {
        mullions.push({
          xMm: x,
          yMm: innerOriginY,
          heightMm: panelAreaH,
          widthMm: PARTITION_PANEL_GAP_MM,
        });
        x += PARTITION_PANEL_GAP_MM;
      }
    }
  }

  if (panels.length === 0) return null;

  const foldSlideNote = isFoldSlideCombo ? ' · +1 frame-hung open' : '';
  const centerNote = isCenterOpening ? ' · centre open both sides · AB slide' : '';

  return {
    kind,
    config,
    totalWidthMm: w,
    totalHeightMm: h,
    outerFrameMm: outerFrame,
    innerOriginMm: { x: innerOriginX, y: innerOriginY },
    innerWidthMm: innerW,
    innerHeightMm: innerH,
    profileColor: config.profileColor?.startsWith('#') ? config.profileColor : '#64748b',
    panels,
    partitionChrome: {
      hasTopChannel: partitionPanels.hasTopChannel,
      topTrackMm: topTrack,
      bottomTrackMm: bottomTrack,
      shutterProfileMm: shutterProfile,
      mullions,
    },
    operationLabel:
      kind === 'partition_fold'
        ? layoutLabel
          ? `${layoutLabel}${foldSlideNote}${centerNote} · C,D −20° · AB slide`
          : `Bi-fold${foldSlideNote}${centerNote} · C,D −20° · AB slide`
        : kind === 'partition_sliding'
          ? 'Sliding partition — open'
          : 'Hinged partition — A,B fixed · C,D −20° cut',
  };
}

/** Build read-only open-view geometry. Does not mutate config. */
export function computeOpenViewSpec(
  config: WindowConfig,
  openAmount = 1,
  options?: OpenViewOptions,
): OpenViewSpec | null {
  const amt = Math.min(1, Math.max(0, openAmount));
  const swingSide = options?.swingSide ?? 'outside';
  if (!config.series?.dimensions) return null;

  switch (config.windowType) {
    case WindowType.SLIDING:
      return buildSlidingSpec(config, amt);
    case WindowType.CASEMENT:
      return buildCasementSpec(config, amt, 'casement', swingSide);
    case WindowType.VENTILATOR:
      return buildCasementSpec(config, amt, 'ventilator', swingSide);
    case WindowType.GLASS_PARTITION:
      return buildPartitionSpec(config, amt, swingSide);
    default:
      return null;
  }
}
