
import React, { useState, useRef, useEffect, useLayoutEffect, useMemo, useId } from 'react';
import { createPortal } from 'react-dom';
import type { WindowConfig, HandleConfig } from '../types';
import { FixedPanelPosition, ShutterConfigType, WindowType, GlassType, MirrorShape } from '../types';
import { PlusIcon } from './icons/PlusIcon';
import { MinusIcon } from './icons/MinusIcon';
import { ArrowsPointingInIcon } from './icons/ArrowsPointingInIcon';
import { TrashIcon } from './icons/TrashIcon';
import { PhotoIcon } from './icons/PhotoIcon';
import { WindowHandleVisual } from './WindowHandleVisual';
import {
  slidingMemberSideStandard,
  slidingMemberSide4G2M,
  mirrorHandleForSlidingMember,
  mirrorHandleForPartitionHandleX,
  buildHandleConfigForMember,
  type HandleMemberPlacement,
  type HandlePanelFrameMetrics,
} from '../utils/handleDefaults';
import { useHomeownerHandlePlacement } from './homeowner/HomeownerHandlePlacementContext';
import { PROFILE_TEXTURE_TILE, profileTexturePosition } from '../utils/profileTexture';
import {
  PARTITION_PANEL_GAP_MM,
  resolvePartitionPanelWidthsMm,
  isOperablePartitionType,
  clampFoldLeafCount,
  getPartitionPanelTopMm,
} from '../utils/partitionPanelGeometry';
import { effectiveFourGlassMeetingMm } from '../utils/slidingGeometry';
import { getFixedPanelVerticalDivisionsMm } from '../utils/fixedPanelDivisions';
import { openingInnerClipStyle } from './casement/CasementOutlineOverlay';
import { OpeningShapedFrame } from './casement/OpeningShapedFrame';
import { ArchHeadLayer } from './casement/ArchHeadLayer';
import { GridMullionHandle } from './casement/GridMullionHandle';
import { InterlockButtJointLines, MiterJointLines, mullionEdgeStyle } from './profile/ProfileJointLines';
import {
  resolveHiddenMullionSegments,
  resolveCasementMergedCells,
  isHSegHidden,
  isVSegHidden,
  type MergedCasementCell,
} from '../utils/casementGridMullions';
import {
  archSpringYMmForOpening,
  isArchTopOutline,
  isOutlineBandCell,
  needsShapedOuterFrame,
  resolveCasementOutline,
} from '../utils/casementOutlineGeometry';
import { resolveFoldFrameEdges } from '../utils/foldDoorFrame';
import {
  getEffectiveLouverBays,
  getLouverBaySeparatorMm,
  layoutLouverBayRects,
} from '../utils/louverBays';
import { FoldDoorOpeningGraphic } from './FoldDoorOpeningVisual';

function profileOverlayTexture(config: WindowConfig): string | undefined {
  return config.profileColor.startsWith('#') ? config.profileTexture || undefined : undefined;
}

interface WindowCanvasProps {
  config: WindowConfig;
  onRemoveVerticalDivider: (index: number) => void;
  onRemoveHorizontalDivider: (index: number) => void;
  onRemoveHMullionSegment?: (dividerIndex: number, col: number) => void;
  onRemoveVMullionSegment?: (dividerIndex: number, row: number) => void;
  onMoveHorizontalDivider?: (index: number, ratio: number) => void;
  onMoveVerticalDivider?: (index: number, ratio: number) => void;
  onToggleElevationDoor: (row: number, col: number) => void;
  /** Visible scrollport (e.g. designer middle column). If omitted, scale uses this component’s box, which grows with content and over-zooms. */
  fitViewportRef?: React.RefObject<HTMLElement | null>;
  /** Optional: enable interactive door-handle dragging (Homeowner mode). */
  onUpdateHandle?: (panelId: string, newConfig: HandleConfig | null) => void;
  enableDoorHandleDrag?: boolean;
}

/** Convert mm at current canvas scale to CSS px; rounded so frame borders and glass insets stay aligned. */
const mmToPx = (mm: number, scale: number) => Math.round(mm * scale * 100) / 100;
const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

const ZOOM_MIN = 0.2;
const ZOOM_MAX = 5;

function adjustHexColor(hex: string, delta: number): string {
    if (!hex || !hex.startsWith('#')) return hex;
    const raw = hex.slice(1);
    const normalized = raw.length === 3 ? raw.split('').map((c) => c + c).join('') : raw;
    if (normalized.length !== 6) return hex;
    const n = Number.parseInt(normalized, 16);
    if (!Number.isFinite(n)) return hex;
    const shift = Math.round(255 * clamp(delta, -1, 1));
    const r = clamp(((n >> 16) & 0xff) + shift, 0, 255);
    const g = clamp(((n >> 8) & 0xff) + shift, 0, 255);
    const b = clamp((n & 0xff) + shift, 0, 255);
    const toHex = (v: number) => v.toString(16).padStart(2, '0');
    return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

const DimensionLabel: React.FC<{ value: number; unit?: string, className?: string, style?: React.CSSProperties }> = ({ value, unit = "mm", className, style }) => (
    <span className={`absolute bg-slate-900 bg-opacity-60 text-slate-200 text-base font-mono px-1.5 py-0.5 rounded ${className}`} style={style}>
        {value.toFixed(0)}{unit}
    </span>
);

const ShutterIndicator: React.FC<{ type: 'fixed' | 'sliding' | 'hinged' | 'fold' | null; foldLeaves?: number }> = ({ type, foldLeaves }) => {
    if (!type) return null;
    
    const baseStyle = "absolute inset-0 z-[9] flex items-center justify-center text-white font-bold tracking-widest text-lg pointer-events-none";
    const textShadow = { textShadow: '0 0 5px rgba(0,0,0,0.7)' };

    if (type === 'fixed') {
        return <div className={baseStyle} style={textShadow}>FIXED</div>;
    }

    if (type === 'sliding') {
        return (
            <div className={`${baseStyle} opacity-60`}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="drop-shadow-md">
                    <path d="M11 17L6 12L11 7" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                 <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="drop-shadow-md">
                    <path d="M13 17L18 12L13 7M6 17L11 12L6 7" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
            </div>
        );
    }

    if (type === 'hinged') {
       return <div className="absolute inset-0 flex items-center justify-start opacity-30 pointer-events-none"><svg viewBox="0 0 100 100" preserveAspectRatio="none" className="w-full h-full"><path d="M 90 10 A 80 80 0 0 0 90 90" stroke="white" strokeDasharray="4" strokeWidth="1" fill="none"/></svg></div>
    }

    if (type === 'fold') {
        const n = clampFoldLeafCount(foldLeaves);
        return (
            <div className={`${baseStyle} opacity-75`} style={textShadow}>
                <span className="text-sm tracking-tight">FOLD{n > 1 ? ` ×${n}` : ''}</span>
            </div>
        );
    }
    return null;
}

const Handle: React.FC<{ config: HandleConfig; scale: number; color: string; mirrored?: boolean }> = ({ config, scale, color, mirrored }) => {
    const gid = useId().replace(/:/g, '');
    const variant = config.variant ?? (config.orientation === 'horizontal' ? 'sliding' : 'casement');
    const raw =
        config.length ??
        (variant === 'sliding' ? 125 : variant === 'mesh_touch' ? 72 : 172);
    const lenMm =
        variant === 'mesh_touch'
            ? Math.min(115, Math.max(46, raw))
            : Math.min(420, Math.max(variant === 'sliding' ? 72 : 100, raw));
    const metalTint = color.startsWith('#') ? color : '#8b939e';
    return <WindowHandleVisual variant={variant} lenMm={lenMm} color={metalTint} gid={gid} scale={scale} mirrored={mirrored} />;
};

function listDoorPanelIdsForConfig(config: WindowConfig): string[] {
  switch (config.windowType) {
    case WindowType.SLIDING: {
      let n = 0;
      switch (config.shutterConfig) {
        case ShutterConfigType.TWO_GLASS:
          n = 2;
          break;
        case ShutterConfigType.THREE_GLASS:
        case ShutterConfigType.TWO_GLASS_ONE_MESH:
          n = 3;
          break;
        case ShutterConfigType.FOUR_GLASS:
          n = 4;
          break;
        case ShutterConfigType.FOUR_GLASS_TWO_MESH:
          n = 6;
          break;
      }
      return Array.from({ length: Math.max(n, (config.slidingHandles ?? []).length) }, (_, i) => `sliding-${i}`);
    }
    case WindowType.CASEMENT:
      return (config.doorPositions ?? []).map((p) => `casement-${p.row}-${p.col}`);
    case WindowType.VENTILATOR: {
      const out: string[] = [];
      (config.ventilatorGrid ?? []).forEach((row, r) =>
        row.forEach((cell, c) => {
          if (cell?.type === 'door') out.push(`ventilator-${r}-${c}`);
        }),
      );
      return out;
    }
    case WindowType.GLASS_PARTITION: {
      const out: string[] = [];
      (config.partitionPanels?.types ?? []).forEach((t, idx) => {
        if (t?.type !== 'fixed') out.push(`partition-${idx}`);
      });
      return out;
    }
    default:
      return [];
  }
}

function getHandleConfigForPanelId(config: WindowConfig, panelId: string): HandleConfig | null {
  const parts = panelId.split('-');
  const type = parts[0];
  if (type === 'sliding') {
    const idx = Number(parts[1]);
    return (config.slidingHandles ?? [])[idx] ?? null;
  }
  if (type === 'casement') {
    const row = Number(parts[1]);
    const col = Number(parts[2]);
    const p = (config.doorPositions ?? []).find((d) => d.row === row && d.col === col);
    return (p?.handle as HandleConfig) ?? null;
  }
  if (type === 'ventilator') {
    const row = Number(parts[1]);
    const col = Number(parts[2]);
    const cell = (config.ventilatorGrid ?? [])?.[row]?.[col];
    return (cell?.handle as HandleConfig) ?? null;
  }
  if (type === 'partition') {
    const idx = Number(parts[1]);
    const t = (config.partitionPanels?.types ?? [])?.[idx];
    return (t?.handle as HandleConfig) ?? null;
  }
  return null;
}

const DraggableHandleWrap: React.FC<{
  config: WindowConfig;
  panelId: string;
  handle: HandleConfig;
  scale: number;
  color: string;
  mirrored?: boolean;
  panelWidthMm: number;
  panelHeightMm: number;
  enableDrag: boolean;
  onUpdateHandle?: (panelId: string, newConfig: HandleConfig | null) => void;
}> = React.memo(
  ({ config, panelId, handle, scale, color, mirrored, panelWidthMm, panelHeightMm, enableDrag, onUpdateHandle }) => {
    const { setDragMeasure } = useHomeownerHandlePlacement();
    const dragRef = useRef<{
      active: boolean;
      startX: number;
      startY: number;
      startHandle: HandleConfig;
      mode: 'pending' | 'vertical' | 'free';
    }>({ active: false, startX: 0, startY: 0, startHandle: handle, mode: 'pending' });

    const onPointerDown = (e: React.PointerEvent) => {
      if (!enableDrag || !onUpdateHandle) return;
      e.stopPropagation();
      (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
      dragRef.current = { active: true, startX: e.clientX, startY: e.clientY, startHandle: handle, mode: 'pending' };
    };

    const onPointerMove = (e: React.PointerEvent) => {
      if (!enableDrag || !onUpdateHandle) return;
      const st = dragRef.current;
      if (!st.active) return;
      e.preventDefault();
      const dxPx = e.clientX - st.startX;
      const dyPx = e.clientY - st.startY;

      const wPx = panelWidthMm * scale;
      const hPx = panelHeightMm * scale;
      if (wPx <= 0 || hPx <= 0) return;

      const dXpct = (dxPx / wPx) * 100;
      const dYpct = (dyPx / hPx) * 100;

      if (st.mode === 'pending') {
        const adx = Math.abs(dxPx);
        const ady = Math.abs(dyPx);
        if (adx + ady > 6) {
          st.mode = ady > adx * 1.2 ? 'vertical' : 'free';
        }
      }

      const nextX = clamp(st.startHandle.x + dXpct, 5, 95);
      const nextY = clamp(st.startHandle.y + dYpct, 5, 95);

      if (st.mode === 'vertical') {
        const mmFromTop = Math.round((nextY / 100) * panelHeightMm);
        const mmFromBottom = Math.round(Math.max(0, panelHeightMm - mmFromTop));
        setDragMeasure({ mmFromTop, mmFromBottom });
        const ids = listDoorPanelIdsForConfig(config);
        ids.forEach((id) => {
          const existing = getHandleConfigForPanelId(config, id) ?? st.startHandle;
          onUpdateHandle(id, { ...existing, y: nextY });
        });
        return;
      }

      onUpdateHandle(panelId, { ...st.startHandle, x: nextX, y: nextY });
    };

    const onPointerUp = (e: React.PointerEvent) => {
      if (!enableDrag || !onUpdateHandle) return;
      const st = dragRef.current;
      if (!st.active) return;
      st.active = false;
      setDragMeasure(null);
      try {
        (e.currentTarget as HTMLElement).releasePointerCapture?.(e.pointerId);
      } catch {
        // ignore
      }
    };

    return (
      <div
        className={enableDrag ? 'cursor-grab active:cursor-grabbing' : undefined}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        style={{ touchAction: 'none' }}
      >
        <Handle config={handle} scale={scale} color={color} mirrored={mirrored} />
      </div>
    );
  },
);


const ProfilePiece: React.FC<{ style: React.CSSProperties; color: string; texture?: string }> = React.memo(({ style, color, texture }) => {
    const isLegacyTextureOnly = Boolean(color && !color.startsWith('#'));
    const texPos = profileTexturePosition(style);

    if (isLegacyTextureOnly) {
        return (
            <div
                style={{
                    boxShadow: 'inset 0 0 0 1px rgba(0,0,0,0.3)',
                    position: 'absolute',
                    ...style,
                    backgroundImage: `url(${color})`,
                    backgroundRepeat: 'repeat',
                    backgroundSize: PROFILE_TEXTURE_TILE,
                    backgroundPosition: texPos,
                }}
            />
        );
    }

    const baseColor = color.startsWith('#') ? color : '#8b939e';
    const z = typeof style.zIndex === 'number' ? style.zIndex : 0;
    const shadow = z >= 10 ? 0.28 : 0.18;
    return (
        <div
          style={{
            boxShadow: `inset 0 0 0 1px rgba(0,0,0,0.32), 0 2px 10px rgba(0,0,0,${shadow})`,
            position: 'absolute',
            ...style,
            backgroundColor: baseColor,
            overflow: 'hidden',
          }}
        >
            <div
                style={{
                    position: 'absolute',
                    inset: 0,
                    background:
                      'linear-gradient(145deg, rgba(255,255,255,0.26) 0%, rgba(255,255,255,0.07) 38%, rgba(0,0,0,0.20) 100%)',
                    pointerEvents: 'none',
                }}
            />
            <div
              style={{
                position: 'absolute',
                inset: 0,
                background:
                  'radial-gradient(120% 90% at 12% 8%, rgba(255,255,255,0.22) 0%, rgba(255,255,255,0.00) 58%)',
                pointerEvents: 'none',
                mixBlendMode: 'screen',
                opacity: 0.65,
              }}
            />
            {texture ? (
                <div
                    style={{
                        position: 'absolute',
                        inset: 0,
                        backgroundImage: `url(${texture})`,
                        backgroundRepeat: 'repeat',
                        backgroundSize: PROFILE_TEXTURE_TILE,
                        backgroundPosition: texPos,
                        mixBlendMode: 'multiply',
                        opacity: 0.82,
                        pointerEvents: 'none',
                    }}
                />
            ) : null}
        </div>
    );
});

const GlassGrid: React.FC<{
    config: WindowConfig;
    panelId: string;
    width: number;
    height: number;
    scale: number;
}> = React.memo(({ config, panelId, width, height, scale }) => {
    const { glassGrid } = config;
    const { barThickness, applyToAll, patterns } = glassGrid;
    if (barThickness <= 0) return null;

    const pattern = (applyToAll || !patterns[panelId]) ? patterns['default'] : patterns[panelId];
    if (!pattern || (pattern.horizontal.count === 0 && pattern.vertical.count === 0)) return null;

    const elements: React.ReactNode[] = [];
    const barThicknessScaled = barThickness * scale;
    const skipVerticalOnSlidingTransomSill =
      config.windowType === WindowType.SLIDING &&
      (panelId === 'fixed-top' || panelId === 'fixed-bottom');

    // Horizontal bars
    for (let i = 0; i < pattern.horizontal.count; i++) {
        const top = (pattern.horizontal.offset + i * pattern.horizontal.gap) * scale - barThicknessScaled / 2;
        if (top > height * scale || top < -barThicknessScaled) continue;
        elements.push(<ProfilePiece key={`h-grid-${i}`} color={config.profileColor} texture={profileOverlayTexture(config)} style={{ top, left: 0, width: width * scale, height: barThicknessScaled }} />);
    }

    // Vertical bars (skip on sliding top/bottom fixed — one lite; avoids false shutter-column lines)
    const vCount = skipVerticalOnSlidingTransomSill ? 0 : pattern.vertical.count;
    for (let i = 0; i < vCount; i++) {
        const left = (pattern.vertical.offset + i * pattern.vertical.gap) * scale - barThicknessScaled / 2;
        if (left > width * scale || left < -barThicknessScaled) continue;
        elements.push(<ProfilePiece key={`v-grid-${i}`} color={config.profileColor} texture={profileOverlayTexture(config)} style={{ left, top: 0, width: barThicknessScaled, height: height * scale }} />);
    }

    return <>{elements}</>;
});

const MiteredFrame: React.FC<{
    width: number;
    height: number;
    profileSize?: number;
    topSize?: number;
    bottomSize?: number;
    leftSize?: number;
    rightSize?: number;
    scale: number;
    color: string;
    texture?: string;
}> = React.memo(({ width, height, profileSize = 0, topSize, bottomSize, leftSize, rightSize, scale, color, texture }) => {
    const ts = mmToPx(topSize ?? profileSize, scale);
    const bs = mmToPx(bottomSize ?? profileSize, scale);
    const ls = mmToPx(leftSize ?? profileSize, scale);
    const rs = mmToPx(rightSize ?? profileSize, scale);
    const wPx = mmToPx(width, scale);
    const hPx = mmToPx(height, scale);
    const isLegacyTexture = Boolean(color && !color.startsWith('#'));
    const baseHex = color.startsWith('#') ? color : '#8b939e';
    const hexWithOverlay = !isLegacyTexture && Boolean(texture) && color.startsWith('#');

    const tileBase: React.CSSProperties = {
        backgroundSize: PROFILE_TEXTURE_TILE,
        backgroundRepeat: 'repeat',
    };

    const clipTs = Math.max(0, ts);
    const clipBs = Math.max(0, bs);
    const clipLs = Math.max(0, ls);
    const clipRs = Math.max(0, rs);

    const clipTop = `polygon(0 0, 100% 0, calc(100% - ${clipRs}px) 100%, ${clipLs}px 100%)`;
    const clipBottom = `polygon(${clipLs}px 0, calc(100% - ${clipRs}px) 0, 100% 100%, 0 100%)`;
    const clipLeft = `polygon(0 0, 100% ${clipTs}px, 100% calc(100% - ${clipBs}px), 0 100%)`;
    const clipRight = `polygon(0 ${clipTs}px, 100% 0, 100% 100%, 0 calc(100% - ${clipBs}px))`;

    if (isLegacyTexture) {
        const backgroundStyle = { backgroundImage: `url(${color})`, backgroundRepeat: 'repeat' as const };
        const baseDivStyle: React.CSSProperties = {
            position: 'absolute',
            boxSizing: 'border-box',
            boxShadow: 'inset 0 0 0 1px rgba(0,0,0,0.25)',
            ...backgroundStyle,
        };

        const posTop = '0px 0px';
        const posBottom = `0px ${-(hPx - clipBs)}px`;
        const posLeft = '0px 0px';
        const posRight = `-${wPx - clipRs}px 0px`;

        return (
            <div className="absolute" style={{ width: wPx, height: hPx, borderRadius: 0 }}>
                <div
                    style={{
                        ...baseDivStyle,
                        ...tileBase,
                        backgroundPosition: posTop,
                        top: 0,
                        left: 0,
                        width: '100%',
                        height: clipTs,
                        zIndex: 1,
                        clipPath: clipTop,
                    }}
                />
                <div
                    style={{
                        ...baseDivStyle,
                        ...tileBase,
                        backgroundPosition: posBottom,
                        bottom: 0,
                        left: 0,
                        width: '100%',
                        height: clipBs,
                        zIndex: 1,
                        clipPath: clipBottom,
                    }}
                />
                <div
                    style={{
                        ...baseDivStyle,
                        ...tileBase,
                        backgroundPosition: posLeft,
                        top: 0,
                        left: 0,
                        width: clipLs,
                        height: '100%',
                        zIndex: 2,
                        clipPath: clipLeft,
                    }}
                />
                <div
                    style={{
                        ...baseDivStyle,
                        ...tileBase,
                        backgroundPosition: posRight,
                        top: 0,
                        right: 0,
                        width: clipRs,
                        height: '100%',
                        zIndex: 2,
                        clipPath: clipRight,
                    }}
                />
                <MiterJointLines widthPx={wPx} heightPx={hPx} topPx={clipTs} bottomPx={clipBs} leftPx={clipLs} rightPx={clipRs} />
            </div>
        );
    }

    if (hexWithOverlay) {
        const solidBase: React.CSSProperties = {
            position: 'absolute',
            boxSizing: 'border-box',
            boxShadow: 'inset 0 0 0 1px rgba(0,0,0,0.25)',
            backgroundColor: baseHex,
        };
        const texOverlay: React.CSSProperties = {
            position: 'absolute',
            boxSizing: 'border-box',
            backgroundImage: `url(${texture})`,
            backgroundRepeat: 'repeat',
            backgroundSize: PROFILE_TEXTURE_TILE,
            mixBlendMode: 'multiply',
            opacity: 0.82,
        };

        const posTop = '0px 0px';
        const posBottom = `0px ${-(hPx - clipBs)}px`;
        const posLeft = '0px 0px';
        const posRight = `-${wPx - clipRs}px 0px`;

        return (
            <div className="absolute" style={{ width: wPx, height: hPx, borderRadius: 0 }}>
                <div style={{ ...solidBase, top: 0, left: 0, width: '100%', height: clipTs, zIndex: 1, clipPath: clipTop }} />
                <div style={{ ...texOverlay, backgroundPosition: posTop, top: 0, left: 0, width: '100%', height: clipTs, zIndex: 3, clipPath: clipTop }} />
                <div style={{ ...solidBase, bottom: 0, left: 0, width: '100%', height: clipBs, zIndex: 1, clipPath: clipBottom }} />
                <div style={{ ...texOverlay, backgroundPosition: posBottom, bottom: 0, left: 0, width: '100%', height: clipBs, zIndex: 3, clipPath: clipBottom }} />
                <div style={{ ...solidBase, top: 0, left: 0, width: clipLs, height: '100%', zIndex: 2, clipPath: clipLeft }} />
                <div style={{ ...texOverlay, backgroundPosition: posLeft, top: 0, left: 0, width: clipLs, height: '100%', zIndex: 4, clipPath: clipLeft }} />
                <div style={{ ...solidBase, top: 0, right: 0, width: clipRs, height: '100%', zIndex: 2, clipPath: clipRight }} />
                <div style={{ ...texOverlay, backgroundPosition: posRight, top: 0, right: 0, width: clipRs, height: '100%', zIndex: 4, clipPath: clipRight }} />
                <MiterJointLines widthPx={wPx} heightPx={hPx} topPx={clipTs} bottomPx={clipBs} leftPx={clipLs} rightPx={clipRs} />
            </div>
        );
    }

    // Solid: CSS borders give clean 45° mitred corners at joints (border-radius 0).
    return (
        <div className="absolute" style={{ width: wPx, height: hPx, borderRadius: 0 }}>
            <div
                style={{
                    position: 'absolute',
                    inset: 0,
                    boxSizing: 'border-box',
                    borderStyle: 'solid',
                    borderColor: baseHex,
                    borderRadius: 0,
                    borderTopWidth: ts,
                    borderBottomWidth: bs,
                    borderLeftWidth: ls,
                    borderRightWidth: rs,
                    backgroundColor: 'transparent',
                    boxShadow: 'inset 0 2px 5px rgba(255,255,255,0.12), inset 0 -3px 8px rgba(0,0,0,0.15)',
                }}
            />
            <MiterJointLines widthPx={wPx} heightPx={hPx} topPx={clipTs} bottomPx={clipBs} leftPx={clipLs} rightPx={clipRs} />
        </div>
    );
});

const SlidingShutter: React.FC<{
    config: WindowConfig;
    panelId: string;
    width: number;
    height: number;
    topProfile: number;
    bottomProfile: number;
    rightProfile: number;
    leftProfile: number;
    scale: number;
    isMesh: boolean;
    isFixed?: boolean;
    isSliding?: boolean;
    cadLabel?: string;
    laneLabel?: string;
    zLayer?: number;
    /** Visual-only overlap so shutters sit “into” frame/mullions. */
    bleedMm?: number;
    interlockMm?: number;
    meetingMm?: number;
    placementPickActive?: boolean;
    onPickPlacement?: () => void;
}> = React.memo(({
    config,
    panelId,
    width,
    height,
    topProfile,
    rightProfile,
    bottomProfile,
    leftProfile,
    scale,
    isMesh,
    isFixed = false,
    isSliding = false,
    cadLabel,
    laneLabel,
    zLayer: _zLayer,
    bleedMm = 0,
    interlockMm = 0,
    meetingMm = 0,
    placementPickActive = false,
    onPickPlacement,
}) => {
    
    const glassWidth = width - leftProfile - rightProfile;
    const glassHeight = height - topProfile - bottomProfile;
    const bleed = Math.max(0, Number(bleedMm) || 0);
    const wPx = mmToPx(width + 2 * bleed, scale);
    const hPx = mmToPx(height + 2 * bleed, scale);
    const lPx = mmToPx(leftProfile, scale);
    const tPx = mmToPx(topProfile, scale);
    const rPx = mmToPx(rightProfile, scale);
    const bPx = mmToPx(bottomProfile, scale);
    const shutterColor = config.profileColor.startsWith('#') ? adjustHexColor(config.profileColor, 0.08) : config.profileColor;
    const outline = config.profileColor.startsWith('#') ? adjustHexColor(config.profileColor, -0.28) : '#0f172a';
    const leftButt = (interlockMm > 0 && leftProfile === interlockMm) || (meetingMm > 0 && leftProfile === meetingMm);
    const rightButt = (interlockMm > 0 && rightProfile === interlockMm) || (meetingMm > 0 && rightProfile === meetingMm);

    return (
        <div
          className="absolute left-0 top-0"
          style={{
            // visual-only bleed so shutter overlaps mullion/frame and hides tiny gaps
            left: mmToPx(-bleed, scale),
            top: mmToPx(-bleed, scale),
            width: wPx,
            height: hPx,
          }}
        >
             <div
                className="absolute inset-0 pointer-events-none"
                style={{
                  boxShadow: `inset 0 0 0 2px ${outline}, inset 0 0 0 1px rgba(255,255,255,0.08)`,
                  opacity: isMesh ? 0.95 : 1,
                }}
             />
             <MiteredFrame 
                width={width + 2 * bleed}
                height={height + 2 * bleed}
                topSize={topProfile}
                bottomSize={bottomProfile}
                leftSize={leftProfile}
                rightSize={rightProfile}
                scale={scale}
                color={shutterColor}
                texture={profileOverlayTexture(config)}
             />
             {leftButt ? (
               <InterlockButtJointLines
                 widthPx={wPx}
                 heightPx={hPx}
                 topPx={tPx}
                 bottomPx={bPx}
                 sidePx={lPx}
                 side="left"
               />
             ) : null}
             {rightButt ? (
               <InterlockButtJointLines
                 widthPx={wPx}
                 heightPx={hPx}
                 topPx={tPx}
                 bottomPx={bPx}
                 sidePx={rPx}
                 side="right"
               />
             ) : null}
            <div
              className="absolute pointer-events-none"
              style={{
                left: 6,
                top: 6,
                zIndex: 50,
                display: 'flex',
                flexDirection: 'column',
                gap: 4,
              }}
            >
              <div
                style={{
                  padding: '2px 6px',
                  borderRadius: 6,
                  background: 'rgba(15,23,42,0.78)',
                  border: '1px solid rgba(148,163,184,0.35)',
                  color: '#e2e8f0',
                  fontSize: 11,
                  fontWeight: 800,
                  letterSpacing: '0.02em',
                  lineHeight: 1.2,
                  textTransform: 'uppercase',
                  width: 'fit-content',
                }}
              >
                {isMesh ? 'Mesh' : 'Glass'} {cadLabel ? `· ${cadLabel}` : ''}
              </div>
              {laneLabel ? (
                <div
                  style={{
                    padding: '2px 6px',
                    borderRadius: 999,
                    background: 'rgba(2,6,23,0.55)',
                    border: '1px dashed rgba(148,163,184,0.45)',
                    color: '#cbd5e1',
                    fontSize: 10,
                    fontWeight: 700,
                    width: 'fit-content',
                  }}
                >
                  {laneLabel}
                </div>
              ) : null}
            </div>
            <div
                className="absolute overflow-hidden"
                style={{ left: lPx, top: tPx, right: rPx, bottom: bPx }}
            >
                <GlassPanel
                    config={config}
                    panelId={panelId}
                    style={{ position: 'absolute', left: 0, top: 0, width: '100%', height: '100%' }}
                    glassWidth={glassWidth}
                    glassHeight={glassHeight}
                    scale={scale}
                >
                    {isMesh && (
                        <div
                            className="w-full h-full"
                            style={{
                                backgroundColor: 'rgba(92, 101, 112, 0.35)',
                                backgroundImage:
                                    'repeating-linear-gradient(0deg, rgba(24,24,24,0.30) 0px, rgba(24,24,24,0.30) 1px, transparent 1px, transparent 3px), repeating-linear-gradient(90deg, rgba(24,24,24,0.30) 0px, rgba(24,24,24,0.30) 1px, transparent 1px, transparent 3px)',
                            }}
                        />
                    )}
                    <ShutterIndicator type={isFixed ? 'fixed' : isSliding ? 'sliding' : null} />
                </GlassPanel>
            </div>
            {placementPickActive && onPickPlacement ? (
              <button
                type="button"
                className="absolute inset-0 z-[45] cursor-pointer rounded-sm bg-indigo-500/15 ring-2 ring-inset ring-indigo-400/70 hover:bg-indigo-500/25"
                aria-label="Place handle on this shutter"
                onClick={(e) => {
                  e.stopPropagation();
                  onPickPlacement();
                }}
              />
            ) : null}
        </div>
    );
});

const GlassPanel: React.FC<{
    config: WindowConfig;
    panelId: string;
    style: React.CSSProperties;
    children?: React.ReactNode;
    glassWidth: number;
    glassHeight: number;
    scale: number;
}> = ({ config, panelId, style, children, glassWidth, glassHeight, scale }) => {
    const { glassType, glassTexture } = config;
    
    const glassStyles: Record<GlassType, React.CSSProperties> = {
        [GlassType.CLEAR]: {
            background:
                'linear-gradient(165deg, hsl(200, 45%, 94%) 0%, hsl(210, 55%, 78%) 45%, hsl(205, 48%, 72%) 100%)',
            opacity: 0.82,
        },
        [GlassType.FROSTED]: { backgroundColor: 'hsl(200, 100%, 95%)', opacity: 0.9, backdropFilter: 'blur(2px)' },
        [GlassType.TINTED_BLUE]: { backgroundColor: 'hsl(205, 90%, 60%)', opacity: 0.6 },
        [GlassType.TINTED_GREY]: { backgroundColor: 'hsl(210, 10%, 40%)', opacity: 0.6 },
        [GlassType.VERTICAL_FLUTED]: { 
            backgroundColor: 'hsl(190, 80%, 85%)', 
            opacity: 0.8, 
            backgroundImage: 'repeating-linear-gradient(90deg, transparent, transparent 8px, rgba(255,255,255,0.4) 8px, rgba(255,255,255,0.4) 10px, transparent 10px, transparent 18px, rgba(0,0,0,0.05) 18px, rgba(0,0,0,0.05) 20px)'
        },
        [GlassType.CLEAR_SAPPHIRE]: { backgroundColor: 'hsl(210, 80%, 70%)', opacity: 0.65 },
        [GlassType.BROWN_TINTED]: { backgroundColor: 'hsl(30, 30%, 30%)', opacity: 0.6 },
        [GlassType.BLACK_TINTED]: { backgroundColor: 'hsl(0, 0%, 20%)', opacity: 0.7 },
    };

    const panelStyle: React.CSSProperties = {
        ...glassStyles[glassType],
        ...style,
        // Photoreal-ish depth without heavy effects (PDF-safe; no blur filters here)
        boxShadow:
          'inset 0 2px 14px rgba(255,255,255,0.30), inset 0 -10px 20px rgba(0,0,0,0.06), 0 2px 12px rgba(0,0,0,0.12)',
    };
    if (glassTexture) {
        panelStyle.backgroundImage = `url(${glassTexture})`;
        panelStyle.backgroundSize = 'cover';
        panelStyle.backgroundPosition = 'center';
        delete panelStyle.backgroundColor;
        delete panelStyle.opacity;
    }
    
    const reflectionElement = (
      <div 
        className="absolute inset-0 w-full h-full pointer-events-none" 
        style={{
          background:
            'linear-gradient(125deg, rgba(255,255,255,0.4) 0%, rgba(255,255,255,0.12) 38%, rgba(255,255,255,0) 55%), linear-gradient(to bottom, rgba(0,0,0,0.04) 0%, transparent 35%)',
        }}
      />
    );
    const edgeTint = (
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          boxShadow:
            'inset 0 0 0 1px rgba(15,23,42,0.18), inset 0 0 0 3px rgba(255,255,255,0.06)',
        }}
      />
    );

    return ( 
      <div className="absolute overflow-hidden" style={panelStyle}>
        {!glassTexture && reflectionElement}
        {edgeTint}
        <GlassGrid config={config} panelId={panelId} width={glassWidth} height={glassHeight} scale={scale} />
        {children}
      </div> 
    );
};

const MirrorPanel: React.FC<{ style: React.CSSProperties }> = ({ style }) => {
    const mirrorStyle: React.CSSProperties = {
        ...style,
        background: 'linear-gradient(135deg, hsl(210, 15%, 85%) 0%, hsl(210, 15%, 95%) 50%, hsl(210, 15%, 80%) 100%)',
        boxShadow: 'inset 0 0 10px rgba(0,0,0,0.1)',
        position: 'relative',
        overflow: 'hidden',
    };

    return (
        <div style={mirrorStyle}>
            <div 
              className="absolute inset-0 w-full h-full pointer-events-none" 
              style={{
                background: 'linear-gradient(to top left, rgba(255, 255, 255, 0.25) 0%, rgba(255, 255, 255, 0.15) 40%, rgba(255, 255, 255, 0) 60%)'
              }}
            />
        </div>
    );
};

const createWindowElements = (
    config: WindowConfig, 
    scale: number, 
    dims: any, 
    callbacks: {
      onRemoveHorizontalDivider: (index: number) => void,
      onRemoveVerticalDivider: (index: number) => void,
      onRemoveHMullionSegment?: (dividerIndex: number, col: number) => void,
      onRemoveVMullionSegment?: (dividerIndex: number, row: number) => void,
      onMoveHorizontalDivider?: (index: number, ratio: number) => void,
      onMoveVerticalDivider?: (index: number, ratio: number) => void,
      onToggleElevationDoor: (row: number, col: number) => void,
      onUpdateHandle?: (panelId: string, newConfig: HandleConfig | null) => void,
      enableDoorHandleDrag?: boolean,
      handlePlacement?: HandleMemberPlacement | null,
      onPlaceHandleOnPanel?: (panelId: string, metrics: HandlePanelFrameMetrics) => void,
    }
) => {
    const { width, height, fixedPanels, profileColor, windowType } = config;
    const pt = profileOverlayTexture(config);
    const w = Number(width) || 0;
    const numHeight = Number(height) || 0;

    const geometry = (() => {
        const topFix = fixedPanels.find(p => p.position === FixedPanelPosition.TOP);
        const bottomFix = fixedPanels.find(p => p.position === FixedPanelPosition.BOTTOM);
        const leftFix = fixedPanels.find(p => p.position === FixedPanelPosition.LEFT);
        const rightFix = fixedPanels.find(p => p.position === FixedPanelPosition.RIGHT);

        // Important: outer frame thickness may differ for vertical sides vs top/bottom.
        // Using a single offset causes sliding shutters/tracks to drift relative to the outer frame.
        const isFramed =
          windowType !== WindowType.GLASS_PARTITION &&
          windowType !== WindowType.CORNER &&
          windowType !== WindowType.MIRROR &&
          windowType !== WindowType.LOUVERS;

        const frameOffsetY = isFramed ? (Number(dims.outerFrame) || 0) : 0;
        const frameOffsetX = isFramed
          ? ((Number(dims.outerFrameVertical) > 0 ? Number(dims.outerFrameVertical) : Number(dims.outerFrame)) || 0)
          : 0;

        const holeX1 = leftFix ? leftFix.size : frameOffsetX;
        const holeY1 = topFix ? topFix.size : frameOffsetY;
        const holeX2 = rightFix ? w - rightFix.size : w - frameOffsetX;
        const holeY2 = bottomFix ? numHeight - bottomFix.size : numHeight - frameOffsetY;
        
        return { topFix, bottomFix, leftFix, rightFix, frameOffsetX, frameOffsetY, holeX1, holeY1, holeX2, holeY2 };
    })();

    const profileElements: React.ReactNode[] = [];
    const glassElements: React.ReactNode[] = [];
    const handleElements: React.ReactNode[] = [];
    const placementPickActive = Boolean(callbacks.handlePlacement && callbacks.onPlaceHandleOnPanel);
    const pickPlacement = (panelId: string, metrics: HandlePanelFrameMetrics) => {
      callbacks.onPlaceHandleOnPanel?.(panelId, metrics);
    };
    const appendOperableHandle = (
      panelId: string,
      handleConfig: HandleConfig,
      centerLeftMm: number,
      centerTopMm: number,
      panelWidthMm: number,
      panelHeightMm: number,
      mirrored?: boolean,
    ) => {
      handleElements.push(
        <div
          key={`handle-${panelId}`}
          style={{
            position: 'absolute',
            zIndex: 55,
            left: centerLeftMm * scale,
            top: centerTopMm * scale,
            transform: 'translate(-50%, -50%)',
            transformOrigin: 'center center',
          }}
        >
          <DraggableHandleWrap
            config={config}
            panelId={panelId}
            handle={handleConfig}
            scale={scale}
            color={profileColor}
            mirrored={mirrored}
            panelWidthMm={panelWidthMm}
            panelHeightMm={panelHeightMm}
            enableDrag={Boolean(callbacks.enableDoorHandleDrag && callbacks.onUpdateHandle)}
            onUpdateHandle={callbacks.onUpdateHandle}
          />
        </div>,
      );
    };
    const { topFix, bottomFix, leftFix, rightFix, frameOffsetX, frameOffsetY, holeX1, holeY1, holeX2, holeY2 } = geometry;
    const innerAreaWidth = holeX2 - holeX1;
    const innerAreaHeight = holeY2 - holeY1;
    
    const shapedOuterFrame =
      (windowType === WindowType.CASEMENT || windowType === WindowType.VENTILATOR) &&
      needsShapedOuterFrame(config);

    if (windowType !== WindowType.GLASS_PARTITION && windowType !== WindowType.CORNER && windowType !== WindowType.MIRROR && windowType !== WindowType.LOUVERS) {
        const verticalFrame = dims.outerFrameVertical > 0 ? dims.outerFrameVertical : dims.outerFrame;
        if (shapedOuterFrame) {
          profileElements.push(
            <OpeningShapedFrame
              key="outer-frame-shaped"
              config={config}
              windowW={w}
              windowH={numHeight}
              holeX={holeX1}
              holeY={holeY1}
              innerW={innerAreaWidth}
              innerH={innerAreaHeight}
              scale={scale}
              color={profileColor}
            />,
          );
        } else {
          profileElements.push(<MiteredFrame key="outer-frame" width={w} height={numHeight} topSize={dims.outerFrame} bottomSize={dims.outerFrame} leftSize={verticalFrame} rightSize={verticalFrame} scale={scale} color={profileColor} texture={pt} />);
        }
    }

    if (leftFix) profileElements.push(<ProfilePiece key="divider-left" color={profileColor} texture={pt} style={{ top: frameOffsetY * scale, left: (holeX1 - dims.fixedFrame) * scale, width: dims.fixedFrame * scale, height: (numHeight - 2 * frameOffsetY) * scale }} />);
    if (rightFix) profileElements.push(<ProfilePiece key="divider-right" color={profileColor} texture={pt} style={{ top: frameOffsetY * scale, left: holeX2 * scale, width: dims.fixedFrame * scale, height: (numHeight - 2 * frameOffsetY) * scale }} />);
    
    const hDividerX = leftFix ? holeX1 : frameOffsetX;
    const hDividerWidth = (rightFix ? holeX2 : w - frameOffsetX) - hDividerX;
  
    const horizontalFixDivisions = getFixedPanelVerticalDivisionsMm(config, hDividerWidth);
    const mullionSize = Math.max(dims.fixedFrame, dims.mullion || dims.fixedFrame);

    const pushHorizontalFixGlass = (
      keyPrefix: string,
      panelId: string,
      topMm: number,
      glassH: number,
    ) => {
      if (glassH <= 0) return;
      const segments: { startMm: number; widthMm: number }[] = [];
      const sortedDivs = horizontalFixDivisions
        .filter((d) => d > 0 && d < hDividerWidth)
        .sort((a, b) => a - b);
      let cursor = 0;
      for (const dPos of sortedDivs) {
        const segStart = cursor;
        const segEnd = dPos - mullionSize / 2;
        if (segEnd > segStart) {
          segments.push({ startMm: segStart, widthMm: segEnd - segStart });
        }
        cursor = dPos + mullionSize / 2;
      }
      if (cursor < hDividerWidth) {
        segments.push({ startMm: cursor, widthMm: hDividerWidth - cursor });
      }
      if (segments.length === 0) {
        glassElements.push(<GlassPanel key={`${keyPrefix}-full`} panelId={panelId} config={config} style={{ top: topMm * scale, left: hDividerX * scale, width: hDividerWidth * scale, height: glassH * scale }} glassWidth={hDividerWidth} glassHeight={glassH} scale={scale} />);
        return;
      }
      segments.forEach((seg, idx) => {
        glassElements.push(
          <GlassPanel
            key={`${keyPrefix}-${idx}`}
            panelId={`${panelId}-${idx}`}
            config={config}
            style={{ top: topMm * scale, left: (hDividerX + seg.startMm) * scale, width: seg.widthMm * scale, height: glassH * scale }}
            glassWidth={seg.widthMm}
            glassHeight={glassH}
            scale={scale}
          />
        );
      });
      // Mullions between segments
      sortedDivs.forEach((dPos, idx) => {
        profileElements.push(
          <ProfilePiece
            key={`${keyPrefix}-mullion-${idx}`}
            color={profileColor.startsWith('#') ? adjustHexColor(profileColor, -0.10) : profileColor}
            texture={pt}
            style={{
              top: topMm * scale,
              left: (hDividerX + dPos - mullionSize / 2) * scale,
              width: mullionSize * scale,
              height: glassH * scale,
              // Above glass/shutters so mullion edge reads clearly
              zIndex: 12,
            }}
          />
        );
      });
    };

    if (topFix) {
        profileElements.push(<ProfilePiece key="divider-top" color={profileColor} texture={pt} style={{ top: (holeY1 - dims.fixedFrame) * scale, left: hDividerX * scale, width: hDividerWidth * scale, height: dims.fixedFrame * scale }} />);
        const glassH = holeY1 - frameOffsetY - dims.fixedFrame;
        pushHorizontalFixGlass('glass-top', 'fixed-top', frameOffsetY, glassH);
    }
    if (bottomFix) {
        profileElements.push(<ProfilePiece key="divider-bottom" color={profileColor} texture={pt} style={{ top: holeY2 * scale, left: hDividerX * scale, width: hDividerWidth * scale, height: dims.fixedFrame * scale }} />);
        const glassH = numHeight - holeY2 - frameOffsetY - dims.fixedFrame;
        pushHorizontalFixGlass('glass-bottom', 'fixed-bottom', holeY2 + dims.fixedFrame, glassH);
    }
    const vGlassY = topFix ? holeY1 : frameOffsetY;
    const vGlassHeight = (bottomFix ? holeY2 : numHeight - frameOffsetY) - vGlassY;
    if (leftFix) {
        const glassW = holeX1 - frameOffsetX - dims.fixedFrame;
        const glassH = vGlassHeight;
        glassElements.push(<GlassPanel key="glass-left" panelId="fixed-left" config={config} style={{ top: vGlassY * scale, left: frameOffsetX * scale, width: glassW * scale, height: glassH * scale }} glassWidth={glassW} glassHeight={glassH} scale={scale}/>);
    }
    if (rightFix) {
        const glassW = w - holeX2 - frameOffsetX - dims.fixedFrame;
        const glassH = vGlassHeight;
        glassElements.push(<GlassPanel key="glass-right" panelId="fixed-right" config={config} style={{ top: vGlassY * scale, left: (holeX2 + dims.fixedFrame) * scale, width: glassW * scale, height: glassH * scale }} glassWidth={glassW} glassHeight={glassH} scale={scale}/>);
    }

    const innerContent: React.ReactNode[] = [];
    const archHeadOverlay: React.ReactNode[] = [];
    let archSpringYmm = 0;
    if (innerAreaWidth > 0 && innerAreaHeight > 0) {
       switch (windowType) {
            case WindowType.LOUVERS: {
                const { louverPattern, orientation } = config;
                const sep = getLouverBaySeparatorMm(config.series.dimensions);
                const baysEff = getEffectiveLouverBays(config);
                const layoutDir = config.louverBayLayout || 'vertical';
                const rects =
                    baysEff.length <= 1
                        ? [{ x: 0, y: 0, width: innerAreaWidth, height: innerAreaHeight }]
                        : layoutLouverBayRects(innerAreaWidth, innerAreaHeight, baysEff, layoutDir, sep);

                const renderLouverProfilesInRect = (
                    rect: { x: number; y: number; width: number; height: number },
                    keyPrefix: string,
                ): void => {
                    if (orientation === 'vertical') {
                        const patternHeight = louverPattern.reduce((sum, item) => sum + (Number(item.size) || 0), 0);
                        if (patternHeight <= 0) return;
                        let currentY = rect.y;
                        while (currentY < rect.y + rect.height) {
                            for (const item of louverPattern) {
                                const itemSize = Number(item.size) || 0;
                                if (currentY >= rect.y + rect.height) break;
                                const remainingHeight = rect.y + rect.height - currentY;
                                const h = Math.min(itemSize, remainingHeight);

                                if (item.type === 'profile') {
                                    innerContent.push(
                                        <ProfilePiece
                                            key={`${keyPrefix}-louver-v-${currentY}`}
                                            color={profileColor}
                                            texture={pt}
                                            style={{
                                                top: currentY * scale,
                                                left: rect.x * scale,
                                                width: rect.width * scale,
                                                height: h * scale,
                                            }}
                                        />,
                                    );
                                }
                                currentY += itemSize;
                            }
                        }
                    } else {
                        const patternWidth = louverPattern.reduce((sum, item) => sum + (Number(item.size) || 0), 0);
                        if (patternWidth <= 0) return;
                        let currentX = rect.x;
                        while (currentX < rect.x + rect.width) {
                            for (const item of louverPattern) {
                                const itemSize = Number(item.size) || 0;
                                if (currentX >= rect.x + rect.width) break;

                                const remainingWidth = rect.x + rect.width - currentX;
                                const w = Math.min(itemSize, remainingWidth);

                                if (item.type === 'profile') {
                                    innerContent.push(
                                        <ProfilePiece
                                            key={`${keyPrefix}-louver-h-${currentX}`}
                                            color={profileColor}
                                            texture={pt}
                                            style={{
                                                top: rect.y * scale,
                                                left: currentX * scale,
                                                width: w * scale,
                                                height: rect.height * scale,
                                            }}
                                        />,
                                    );
                                }
                                currentX += itemSize;
                            }
                        }
                    }
                };

                rects.forEach((rect, idx) => renderLouverProfilesInRect(rect, `bay-${idx}`));

                if (baysEff.length > 1 && sep > 0) {
                    for (let i = 0; i < rects.length - 1; i++) {
                        const r = rects[i];
                        if (layoutDir === 'vertical') {
                            const ySep = r.y + r.height;
                            innerContent.push(
                                <ProfilePiece
                                    key={`louver-sep-${i}`}
                                    color={profileColor}
                                    texture={pt}
                                    style={{
                                        left: 0,
                                        top: ySep * scale,
                                        width: innerAreaWidth * scale,
                                        height: sep * scale,
                                        zIndex: 4,
                                    }}
                                />,
                            );
                        } else {
                            const xSep = r.x + r.width;
                            innerContent.push(
                                <ProfilePiece
                                    key={`louver-sep-${i}`}
                                    color={profileColor}
                                    texture={pt}
                                    style={{
                                        left: xSep * scale,
                                        top: 0,
                                        width: sep * scale,
                                        height: innerAreaHeight * scale,
                                        zIndex: 4,
                                    }}
                                />,
                            );
                        }
                    }
                }
                break;
            }
            case WindowType.MIRROR: {
                const { mirrorConfig } = config;
                const frameThickness = mirrorConfig.isFrameless ? 0 : dims.outerFrame;

                let borderRadius = '0px';
                switch (mirrorConfig.shape) {
                    case MirrorShape.OVAL: borderRadius = '50%'; break;
                    case MirrorShape.CAPSULE: borderRadius = '9999px'; break;
                    case MirrorShape.ROUNDED_RECTANGLE:
                        const radius = Number(mirrorConfig.cornerRadius) || 0;
                        borderRadius = `${radius}px`;
                        break;
                    case MirrorShape.RECTANGLE:
                    default:
                        borderRadius = '0px';
                        break;
                }

                const commonStyle: React.CSSProperties = {
                    position: 'absolute',
                    width: innerAreaWidth * scale,
                    height: innerAreaHeight * scale,
                    borderRadius: borderRadius,
                    overflow: 'hidden'
                };

                if (!mirrorConfig.isFrameless) {
                    innerContent.push(<div key="mirror-frame" style={{ ...commonStyle, backgroundColor: profileColor }} />);
                }
                
                const parseRadius = (br: string): number => parseFloat(br.replace('px', ''));
                const outerRadiusVal = parseRadius(borderRadius);
                const innerRadiusVal = Math.max(0, outerRadiusVal - frameThickness); 
                let innerBorderRadius = `${innerRadiusVal}px`;
                if(borderRadius === '50%' || borderRadius === '9999px') {
                    innerBorderRadius = borderRadius;
                }

                const mirrorStyle: React.CSSProperties = {
                    position: 'absolute',
                    top: frameThickness * scale,
                    left: frameThickness * scale,
                    width: (innerAreaWidth - frameThickness * 2) * scale,
                    height: (innerAreaHeight - frameThickness * 2) * scale,
                    borderRadius: innerBorderRadius,
                };
                innerContent.push(<MirrorPanel key="mirror-surface" style={mirrorStyle} />);

                break;
            }
            case WindowType.SLIDING: {
                const { shutterConfig, fixedShutters, slidingHandles } = config;
                const interlock = Number(dims.shutterInterlock) || 0;
                const meetingRaw = Number(dims.shutterMeeting) || 0;
                const meeting =
                  shutterConfig === ShutterConfigType.FOUR_GLASS
                    ? effectiveFourGlassMeetingMm(dims.shutterMeeting ?? '', dims.shutterInterlock ?? '')
                    : meetingRaw;
                const laneCount = (shutterConfig === ShutterConfigType.TWO_GLASS_ONE_MESH || shutterConfig === ShutterConfigType.FOUR_GLASS_TWO_MESH) ? 3 : 2;
                const trackBandMm = Math.max(8, Math.min(16, Number(dims.topTrack) * 0.18));
                const trackBandPx = mmToPx(trackBandMm, scale);
                const laneGapPx = laneCount > 1 ? (innerAreaWidth * scale) / laneCount : 0;

                innerContent.push(
                    <div
                        key="sliding-track-top"
                        className="absolute"
                        style={{
                            left: 0,
                            top: 0,
                            width: innerAreaWidth * scale,
                            height: trackBandPx,
                            zIndex: 2,
                            background: 'linear-gradient(180deg, rgba(255,255,255,0.22) 0%, rgba(0,0,0,0.15) 100%)',
                            boxShadow: 'inset 0 -1px 0 rgba(0,0,0,0.22)',
                        }}
                    />
                );
                innerContent.push(
                    <div
                        key="sliding-track-bottom"
                        className="absolute"
                        style={{
                            left: 0,
                            bottom: 0,
                            width: innerAreaWidth * scale,
                            height: trackBandPx,
                            zIndex: 2,
                            background: 'linear-gradient(0deg, rgba(255,255,255,0.22) 0%, rgba(0,0,0,0.15) 100%)',
                            boxShadow: 'inset 0 1px 0 rgba(0,0,0,0.22)',
                        }}
                    />
                );
                for (let i = 1; i < laneCount; i++) {
                    const x = laneGapPx * i;
                    innerContent.push(
                        <div
                            key={`sliding-track-lane-${i}`}
                            className="absolute"
                            style={{
                                left: x - 0.5,
                                top: 0,
                                width: 1,
                                height: trackBandPx,
                                zIndex: 3,
                                backgroundColor: 'rgba(255,255,255,0.45)',
                            }}
                        />
                    );
                    innerContent.push(
                        <div
                            key={`sliding-track-lane-bottom-${i}`}
                            className="absolute"
                            style={{
                                left: x - 0.5,
                                bottom: 0,
                                width: 1,
                                height: trackBandPx,
                                zIndex: 3,
                                backgroundColor: 'rgba(255,255,255,0.45)',
                            }}
                        />
                    );
                }
                
                if (shutterConfig === ShutterConfigType.FOUR_GLASS_TWO_MESH) {
                    const bleedMm = 8;
                    const panelWidth = (innerAreaWidth + 3 * interlock) / 4;
                    const panels = [
                        { id: 0, type: 'glass', x: 0, z: 5 }, // Fixed Left (Outer Track)
                        { id: 5, type: 'glass', x: innerAreaWidth - panelWidth, z: 5 }, // Fixed Right (Outer Track)
                        { id: 1, type: 'glass', x: panelWidth - interlock, z: 10 }, // Sliding Glass Left (Mid Track)
                        { id: 4, type: 'glass', x: 2 * panelWidth - 2 * interlock, z: 10 }, // Sliding Glass Right (Mid Track)
                        { id: 2, type: 'mesh',  x: 0, z: 15 }, // Sliding Mesh Left (Inner Track, Parked)
                        { id: 3, type: 'mesh',  x: innerAreaWidth - panelWidth, z: 15 }, // Sliding Mesh Right (Inner Track, Parked)
                    ];

                    panels.forEach(p => {
                        let leftProf = dims.shutterInterlock;
                        let rightProf = dims.shutterInterlock;
                        if (p.id === 0 || p.id === 2) leftProf = dims.shutterHandle;
                        if (p.id === 3 || p.id === 5) rightProf = dims.shutterHandle;
                        const panelId = `sliding-${p.id}`;
                        const frameMetrics: HandlePanelFrameMetrics = {
                          widthMm: panelWidth,
                          heightMm: innerAreaHeight,
                          leftProf,
                          rightProf,
                          topProf: dims.shutterTop,
                          bottomProf: dims.shutterBottom,
                        };
                        const handleConfig = slidingHandles[p.id];
                        if (handleConfig) {
                          const side = slidingMemberSide4G2M(p.id);
                          const mirrored = mirrorHandleForSlidingMember(side);
                          appendOperableHandle(
                            panelId,
                            handleConfig,
                            p.x + (panelWidth * handleConfig.x) / 100,
                            (innerAreaHeight * handleConfig.y) / 100,
                            panelWidth,
                            innerAreaHeight,
                            mirrored,
                          );
                        }

                        innerContent.push(
                            <div key={p.id} className="absolute" style={{ left: mmToPx(p.x, scale), top: 0, zIndex: p.z }}>
                                <SlidingShutter
                                    panelId={panelId}
                                    config={config}
                                    width={panelWidth} height={innerAreaHeight}
                                    topProfile={dims.shutterTop} bottomProfile={dims.shutterBottom}
                                    leftProfile={leftProf} rightProfile={rightProf}
                                    scale={scale}
                                    isMesh={p.type === 'mesh'}
                                    isFixed={fixedShutters[p.id]} isSliding={!fixedShutters[p.id]}
                                    cadLabel={`S${p.id + 1}`}
                                    laneLabel={p.z >= 15 ? 'Track 3 (inner)' : p.z >= 10 ? 'Track 2 (mid)' : 'Track 1 (outer)'}
                                    zLayer={p.z}
                                    bleedMm={bleedMm}
                                    interlockMm={interlock}
                                    meetingMm={meeting}
                                    placementPickActive={placementPickActive}
                                    onPickPlacement={() => pickPlacement(panelId, frameMetrics)}
                                />
                            </div>
                        );
                    });

                } else if (shutterConfig === ShutterConfigType.FOUR_GLASS) {
                    const bleedMm = 8;
                    const shutterWidth = (innerAreaWidth + (2 * interlock) + meeting) / 4;
                    const positions = [ 0, shutterWidth - interlock, (2*shutterWidth) - interlock - meeting, (3*shutterWidth) - (2*interlock) - meeting ];
                    const profiles = [ { l: dims.shutterHandle, r: interlock }, { l: interlock, r: meeting }, { l: meeting, r: interlock }, { l: interlock, r: dims.shutterHandle } ];
                    
                    slidingHandles.forEach((handleConfig, i) => {
                      if (!handleConfig) return;
                      const side = slidingMemberSideStandard(i, 4);
                      const mirrored = mirrorHandleForSlidingMember(side);
                      appendOperableHandle(
                        `sliding-${i}`,
                        handleConfig,
                        positions[i] + (shutterWidth * handleConfig.x) / 100,
                        (innerAreaHeight * handleConfig.y) / 100,
                        shutterWidth,
                        innerAreaHeight,
                        mirrored,
                      );
                    });

                    innerContent.push(...profiles.map((p, i) => {
                      const panelId = `sliding-${i}`;
                      const frameMetrics: HandlePanelFrameMetrics = {
                        widthMm: shutterWidth,
                        heightMm: innerAreaHeight,
                        leftProf: p.l,
                        rightProf: p.r,
                        topProf: dims.shutterTop,
                        bottomProf: dims.shutterBottom,
                      };
                      return (
                      <div
                        key={i}
                        className="absolute"
                        style={{ left: mmToPx(positions[i], scale), top: 0, zIndex: (i === 1 || i === 2) ? 10 : 5 }}
                      >
                        <SlidingShutter
                          panelId={panelId}
                          config={config}
                          width={shutterWidth}
                          height={innerAreaHeight}
                          topProfile={dims.shutterTop}
                          bottomProfile={dims.shutterBottom}
                          leftProfile={p.l}
                          rightProfile={p.r}
                          scale={scale}
                          isMesh={false}
                          isFixed={fixedShutters[i]}
                          isSliding={!fixedShutters[i]}
                          cadLabel={`S${i + 1}`}
                          laneLabel={(i === 1 || i === 2) ? 'Track 2 (front)' : 'Track 1 (back)'}
                          zLayer={(i === 1 || i === 2) ? 10 : 5}
                          bleedMm={bleedMm}
                          interlockMm={interlock}
                          meetingMm={meeting}
                          placementPickActive={placementPickActive}
                          onPickPlacement={() => pickPlacement(panelId, frameMetrics)}
                        />
                      </div>
                    ); }));
                } else {
                    const bleedMm = 8;
                    const hasMesh = shutterConfig === ShutterConfigType.TWO_GLASS_ONE_MESH;
                    const numShutters = hasMesh ? 3 : (shutterConfig === ShutterConfigType.TWO_GLASS ? 2 : 3);
                    const shutterDivider = hasMesh ? 2 : numShutters;
                    const shutterWidth = (innerAreaWidth + (shutterDivider - 1) * interlock) / shutterDivider;
                    innerContent.push(...Array.from({ length: numShutters }).map((_, i) => {
                        const isMeshShutter = hasMesh && i === numShutters - 1;
                        let leftPosition = (hasMesh ? Math.min(i, numShutters - 2) : i) * (shutterWidth - interlock);
                        
                        const panelId = `sliding-${i}`;
                        const leftProf = i === 0 ? dims.shutterHandle : interlock;
                        const rightProf = i === numShutters - 1 ? dims.shutterHandle : interlock;
                        const frameMetrics: HandlePanelFrameMetrics = {
                          widthMm: shutterWidth,
                          heightMm: innerAreaHeight,
                          leftProf,
                          rightProf,
                          topProf: dims.shutterTop,
                          bottomProf: dims.shutterBottom,
                        };
                        const handleConfig = slidingHandles[i];
                        if (handleConfig) {
                          const side = slidingMemberSideStandard(i, numShutters);
                          const mirrored = mirrorHandleForSlidingMember(side);
                          appendOperableHandle(
                            panelId,
                            handleConfig,
                            leftPosition + (shutterWidth * handleConfig.x) / 100,
                            (innerAreaHeight * handleConfig.y) / 100,
                            shutterWidth,
                            innerAreaHeight,
                            mirrored,
                          );
                        }

                        const z = hasMesh
                          ? (isMeshShutter ? 15 : (i === 1 ? 10 : 5))
                          : (numShutters === 2 ? (i === 1 ? 10 : 5) : (i === 1 ? 10 : 5));
                        const laneLabel = z >= 15 ? 'Track 3 (inner)' : z >= 10 ? 'Track 2 (front)' : 'Track 1 (back)';
                        return (
                          <div key={i} className="absolute" style={{ left: mmToPx(leftPosition, scale), top: 0, zIndex: z }}>
                            <SlidingShutter
                              panelId={panelId}
                              config={config}
                              width={shutterWidth}
                              height={innerAreaHeight}
                              topProfile={dims.shutterTop}
                              bottomProfile={dims.shutterBottom}
                              leftProfile={leftProf}
                              rightProfile={rightProf}
                              scale={scale}
                              isMesh={isMeshShutter}
                              isFixed={fixedShutters[i]}
                              isSliding={!fixedShutters[i]}
                              cadLabel={`S${i + 1}`}
                              laneLabel={laneLabel}
                              zLayer={z}
                              bleedMm={bleedMm}
                              interlockMm={interlock}
                              meetingMm={meeting}
                              placementPickActive={placementPickActive}
                              onPickPlacement={() => pickPlacement(panelId, frameMetrics)}
                            />
                          </div>
                        );
                    }));
                }
                break;
            }
            case WindowType.CASEMENT:
            case WindowType.VENTILATOR: {
                const { verticalDividers, horizontalDividers } = config;
                const gridCols = verticalDividers.length + 1;
                const gridRows = horizontalDividers.length + 1;
                const archTop = isArchTopOutline(config);
                const springYmm = archTop ? archSpringYMmForOpening(config, innerAreaWidth, innerAreaHeight) : 0;
                if (archTop) archSpringYmm = springYmm;
                const springRel = springYmm / Math.max(innerAreaHeight, 1);
                const effectiveHDivs =
                  archTop && horizontalDividers.length > 0
                    ? [springRel, ...horizontalDividers.slice(1)]
                    : horizontalDividers;
                const gridRowsEffective = effectiveHDivs.length + 1;
                const hiddenSegs = resolveHiddenMullionSegments(config);
                const mergedCells = resolveCasementMergedCells(gridRowsEffective, gridCols, hiddenSegs);
                const cellMergeMap = new Map<string, MergedCasementCell>();
                for (const m of mergedCells) {
                  for (let mr = m.minRow; mr <= m.maxRow; mr++) {
                    for (let mc = m.minCol; mc <= m.maxCol; mc++) {
                      cellMergeMap.set(`${mr},${mc}`, m);
                    }
                  }
                }
                const cellBoundsFromGrid = (r: number, c: number) => {
                  const x_start_rel = c === 0 ? 0 : verticalDividers[c - 1];
                  const x_end_rel = c === verticalDividers.length ? 1 : verticalDividers[c];
                  const y_start_rel = r === 0 ? 0 : effectiveHDivs[r - 1];
                  const y_end_rel = r === effectiveHDivs.length ? 1 : effectiveHDivs[r];
                  return {
                    cellX: x_start_rel * innerAreaWidth,
                    cellY: y_start_rel * innerAreaHeight,
                    cellW: (x_end_rel - x_start_rel) * innerAreaWidth,
                    cellH: (y_end_rel - y_start_rel) * innerAreaHeight,
                  };
                };
                const mergeBounds = (m: MergedCasementCell) => {
                  const tl = cellBoundsFromGrid(m.minRow, m.minCol);
                  const br = cellBoundsFromGrid(m.maxRow, m.maxCol);
                  return {
                    cellX: tl.cellX,
                    cellY: tl.cellY,
                    cellW: br.cellX + br.cellW - tl.cellX,
                    cellH: br.cellY + br.cellH - tl.cellY,
                  };
                };
                const glassBoundsForCell = (r: number, c: number) => {
                  const m = cellMergeMap.get(`${r},${c}`);
                  if (!m) return { render: true, ...cellBoundsFromGrid(r, c) };
                  if (m.minRow === r && m.minCol === c) return { render: true, ...mergeBounds(m) };
                  return { render: false, ...cellBoundsFromGrid(r, c) };
                };
                const glassLayer: React.ReactNode[] = [];
                const doorLayer: React.ReactNode[] = [];

                if (archTop && springYmm > 0) {
                  archHeadOverlay.push(
                    <ArchHeadLayer
                      key="arch-head-layer"
                      config={config}
                      innerW={innerAreaWidth}
                      springYmm={springYmm}
                      scale={scale}
                      mullionMm={dims.mullion}
                      profileColor={profileColor}
                    />,
                  );
                }

                for (let r = 0; r < gridRowsEffective; r++) {
                    if (archTop && r === 0) continue;
                    for (let c = 0; c < gridCols; c++) {
                        const panelId = `cell-${r}-${c}`;
                        const { cellX, cellY, cellW, cellH } = cellBoundsFromGrid(r, c);
                        const bandCell = isOutlineBandCell(config, r, c, gridRowsEffective, gridCols);

                        if (bandCell) {
                          const gb = glassBoundsForCell(r, c);
                          if (!gb.render) continue;
                          glassLayer.push(
                            <GlassPanel
                              key={`cell-${r}-${c}`}
                              panelId={panelId}
                              config={config}
                              style={{
                                position: 'absolute',
                                zIndex: 2,
                                left: gb.cellX * scale,
                                top: gb.cellY * scale,
                                width: gb.cellW * scale,
                                height: gb.cellH * scale,
                              }}
                              glassWidth={gb.cellW}
                              glassHeight={gb.cellH}
                              scale={scale}
                            />,
                          );
                          continue;
                        }

                        const doorInfo = config.doorPositions.find(p => p.row === r && p.col === c);
                          if (doorInfo?.handle) {
                            const mirrored = mirrorHandleForPartitionHandleX(doorInfo.handle.x);
                            handleElements.push(
                              <div
                                key={`handle-${r}-${c}`}
                                style={{
                                  position: 'absolute',
                                  zIndex: 55,
                                  left: (cellX + (cellW * doorInfo.handle.x) / 100) * scale,
                                  top: (cellY + (cellH * doorInfo.handle.y) / 100) * scale,
                                  transform: 'translate(-50%, -50%)',
                                  transformOrigin: 'center center',
                                }}
                              >
                                <DraggableHandleWrap
                                  config={config}
                                  panelId={`casement-${r}-${c}`}
                                  handle={doorInfo.handle}
                                  scale={scale}
                                  color={profileColor}
                                  mirrored={mirrored}
                                  panelWidthMm={cellW}
                                  panelHeightMm={cellH}
                                  enableDrag={Boolean(callbacks.enableDoorHandleDrag && callbacks.onUpdateHandle)}
                                  onUpdateHandle={callbacks.onUpdateHandle}
                                />
                              </div>,
                            );
                          }

                        if (windowType === WindowType.CASEMENT) {
                            if (doorInfo && !(archTop && r === 0)) {
                                const casementProf = dims.casementShutter;
                                const casementPanelId = `casement-${r}-${c}`;
                                const casementMetrics: HandlePanelFrameMetrics = {
                                  widthMm: cellW,
                                  heightMm: cellH,
                                  leftProf: casementProf,
                                  rightProf: casementProf,
                                  topProf: casementProf,
                                  bottomProf: casementProf,
                                };
                                doorLayer.push(
                                  <div key={`cell-${r}-${c}`} className="absolute z-[6]" style={{left: mmToPx(cellX, scale), top: mmToPx(cellY, scale), width: mmToPx(cellW, scale), height: mmToPx(cellH, scale)}}>
                                    <MiteredFrame width={cellW} height={cellH} profileSize={dims.casementShutter} scale={scale} color={profileColor} texture={pt} />
                                    <div className="absolute overflow-hidden" style={{ left: mmToPx(dims.casementShutter, scale), top: mmToPx(dims.casementShutter, scale), right: mmToPx(dims.casementShutter, scale), bottom: mmToPx(dims.casementShutter, scale) }}>
                                      <GlassPanel panelId={`cell-door-${r}-${c}`} config={config} style={{ position: 'absolute', left: 0, top: 0, width: '100%', height: '100%' }} glassWidth={cellW - 2 * dims.casementShutter} glassHeight={cellH - 2 * dims.casementShutter} scale={scale} />
                                    </div>
                                    <div className="absolute inset-0 flex items-center justify-center opacity-30 pointer-events-none"><svg viewBox="0 0 100 100" className="w-1/2 h-1/2" style={{transform: c % 2 === 0 ? 'scaleX(1)' : 'scaleX(-1)'}}><path d="M 10 10 L 10 90 L 90 90" stroke="white" strokeDasharray="4" strokeWidth="2" fill="none"/></svg></div>
                                    {placementPickActive ? (
                                      <button
                                        type="button"
                                        className="absolute inset-0 z-[45] cursor-pointer bg-indigo-500/15 ring-2 ring-inset ring-indigo-400/70 hover:bg-indigo-500/25"
                                        aria-label="Place handle on this door"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          pickPlacement(casementPanelId, casementMetrics);
                                        }}
                                      />
                                    ) : null}
                                  </div>
                                );
                            } else {
                              const gb = glassBoundsForCell(r, c);
                              if (!gb.render) continue;
                              glassLayer.push(
                                <GlassPanel
                                  key={`cell-${r}-${c}`}
                                  panelId={panelId}
                                  config={config}
                                  style={{ position: 'absolute', zIndex: 2, left: gb.cellX * scale, top: gb.cellY * scale, width: gb.cellW * scale, height: gb.cellH * scale }}
                                  glassWidth={gb.cellW}
                                  glassHeight={gb.cellH}
                                  scale={scale}
                                />,
                              );
                            }
                        } else { // Ventilator
                            const cell = config.ventilatorGrid[r]?.[c];
                            const cellType = cell?.type || 'glass';
                            if (cell?.handle) {
                            const mirrored = mirrorHandleForPartitionHandleX(cell.handle.x);
                                handleElements.push(
                                  <div
                                    key={`handle-vent-${r}-${c}`}
                                    style={{
                                      position: 'absolute',
                                      zIndex: 55,
                                      left: (cellX + (cellW * cell.handle.x) / 100) * scale,
                                      top: (cellY + (cellH * cell.handle.y) / 100) * scale,
                                      transform: 'translate(-50%, -50%)',
                                      transformOrigin: 'center center',
                                    }}
                                  >
                                    <DraggableHandleWrap
                                      config={config}
                                      panelId={`ventilator-${r}-${c}`}
                                      handle={cell.handle}
                                      scale={scale}
                                      color={profileColor}
                                      mirrored={mirrored}
                                      panelWidthMm={cellW}
                                      panelHeightMm={cellH}
                                      enableDrag={Boolean(callbacks.enableDoorHandleDrag && callbacks.onUpdateHandle)}
                                      onUpdateHandle={callbacks.onUpdateHandle}
                                    />
                                  </div>,
                                );
                            }
                            if (cellType === 'door') {
                                const casementProf = dims.casementShutter;
                                const ventPanelId = `ventilator-${r}-${c}`;
                                const ventMetrics: HandlePanelFrameMetrics = {
                                  widthMm: cellW,
                                  heightMm: cellH,
                                  leftProf: casementProf,
                                  rightProf: casementProf,
                                  topProf: casementProf,
                                  bottomProf: casementProf,
                                };
                                doorLayer.push(
                                  <div key={`cell-${r}-${c}`} className="absolute z-[6]" style={{left: mmToPx(cellX, scale), top: mmToPx(cellY, scale), width: mmToPx(cellW, scale), height: mmToPx(cellH, scale)}}>
                                    <MiteredFrame width={cellW} height={cellH} profileSize={dims.casementShutter} scale={scale} color={profileColor} texture={pt} />
                                    <div className="absolute overflow-hidden" style={{ left: mmToPx(dims.casementShutter, scale), top: mmToPx(dims.casementShutter, scale), right: mmToPx(dims.casementShutter, scale), bottom: mmToPx(dims.casementShutter, scale) }}>
                                      <GlassPanel panelId={`cell-door-${r}-${c}`} config={config} style={{ position: 'absolute', left: 0, top: 0, width: '100%', height: '100%' }} glassWidth={cellW - 2*dims.casementShutter} glassHeight={cellH - 2*dims.casementShutter} scale={scale}/>
                                    </div>
                                    <div className="absolute inset-0 flex items-center justify-center opacity-30 pointer-events-none"><svg viewBox="0 0 100 100" className="w-1/2 h-1/2" style={{transform: c % 2 === 0 ? 'scaleX(1)' : 'scaleX(-1)'}}><path d="M 10 10 L 10 90 L 90 90" stroke="white" strokeDasharray="4" strokeWidth="2" fill="none"/></svg></div>
                                    {placementPickActive ? (
                                      <button
                                        type="button"
                                        className="absolute inset-0 z-[45] cursor-pointer bg-indigo-500/15 ring-2 ring-inset ring-indigo-400/70 hover:bg-indigo-500/25"
                                        aria-label="Place handle on this door"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          pickPlacement(ventPanelId, ventMetrics);
                                        }}
                                      />
                                    ) : null}
                                  </div>
                                );
                            } else if (cellType === 'louvers') {
                                const louvers: React.ReactNode[] = [];
                                if (dims.louverBlade > 0) {
                                    const spacing = dims.louverBlade;
                                    const numLouvers = Math.ceil(cellH / spacing);
                                     for (let i=0; i < numLouvers; i++) {
                                       louvers.push(<ProfilePiece key={`louver-${i}`} color={profileColor} texture={pt} style={{left: 0, top: (i * spacing)*scale, width: cellW*scale, height: dims.louverBlade*scale }}/>)
                                     }
                                }
                                doorLayer.push(<div key={`cell-${r}-${c}`} className="absolute z-[6]" style={{left: cellX*scale, top: cellY*scale, width: cellW*scale, height: cellH*scale}}>{louvers}</div>);
                            } else if (cellType === 'exhaust_fan') {
                                doorLayer.push(
                                  <div key={`cell-${r}-${c}`} className="absolute z-[6] flex items-center justify-center" style={{left: cellX*scale, top: cellY*scale, width: cellW*scale, height: cellH*scale}}>
                                     <svg viewBox="0 0 100 100" className="w-full h-full text-slate-500 opacity-50">
                                          <circle cx="50" cy="50" r="45" fill="none" stroke="currentColor" strokeWidth="2"/>
                                          <circle cx="50" cy="50" r="10" fill="currentColor" />
                                          {[0, 72, 144, 216, 288].map(angle => (
                                            <path key={angle} d="M50 50 L 50 10 A 40 40 0 0 1 84 36 L 50 50 Z" fill="currentColor" transform={`rotate(${angle} 50 50)`}/>
                                          ))}
                                     </svg>
                                  </div>
                                )
                            }
                            else {
                              const gb = glassBoundsForCell(r, c);
                              if (!gb.render) continue;
                              glassLayer.push(
                                <GlassPanel
                                  key={`cell-${r}-${c}`}
                                  panelId={panelId}
                                  config={config}
                                  style={{ position: 'absolute', zIndex: 2, left: gb.cellX * scale, top: gb.cellY * scale, width: gb.cellW * scale, height: gb.cellH * scale }}
                                  glassWidth={gb.cellW}
                                  glassHeight={gb.cellH}
                                  scale={scale}
                                />,
                              );
                            }
                        }
                    }
                }

                innerContent.push(...glassLayer, ...doorLayer);

                const onMoveH = callbacks.onMoveHorizontalDivider;
                const onMoveV = callbacks.onMoveVerticalDivider;
                const onDelHSeg = callbacks.onRemoveHMullionSegment ?? ((hi: number, col: number) => callbacks.onRemoveHorizontalDivider(hi));
                const onDelVSeg = callbacks.onRemoveVMullionSegment ?? ((vi: number, row: number) => callbacks.onRemoveVerticalDivider(vi));

                effectiveHDivs.forEach((pos, hi) => {
                  for (let c = 0; c < gridCols; c++) {
                    if (isHSegHidden(hiddenSegs, hi, c)) continue;
                    const xStart = c === 0 ? 0 : verticalDividers[c - 1];
                    const xEnd = c === verticalDividers.length ? 1 : verticalDividers[c];
                    const segLeft = xStart * innerAreaWidth;
                    const segWidth = (xEnd - xStart) * innerAreaWidth;
                    const yMm = pos * innerAreaHeight;
                    const isSpring = archTop && hi === 0;
                    innerContent.push(
                      <GridMullionHandle
                        key={`hseg-${hi}-${c}`}
                        orientation="horizontal"
                        leftPx={segLeft * scale}
                        topPx={(yMm - dims.mullion / 2) * scale}
                        widthPx={segWidth * scale}
                        heightPx={dims.mullion * scale}
                        positionMm={yMm}
                        scale={scale}
                        profileColor={profileColor}
                        texture={pt}
                        draggable={Boolean(onMoveH)}
                        measureFromBottom={isSpring}
                        totalHeightMm={isSpring ? innerAreaHeight : undefined}
                        hideDelete={isSpring}
                        onDragEnd={
                          onMoveH
                            ? (mm) => {
                                const ratio = Math.max(0.05, Math.min(0.95, mm / innerAreaHeight));
                                onMoveH(hi, ratio);
                              }
                            : undefined
                        }
                        onDelete={() => onDelHSeg(hi, c)}
                        deleteTitle={isSpring ? 'Spring line — drag to adjust height' : 'Remove this horizontal segment'}
                      />,
                    );
                  }
                });

                verticalDividers.forEach((pos, vi) => {
                  for (let r = 0; r < gridRowsEffective; r++) {
                    if (archTop && r === 0) continue;
                    if (isVSegHidden(hiddenSegs, vi, r)) continue;
                    const yStart = r === 0 ? 0 : effectiveHDivs[r - 1];
                    const yEnd = r === effectiveHDivs.length ? 1 : effectiveHDivs[r];
                    const segTop = yStart * innerAreaHeight;
                    const segHeight = (yEnd - yStart) * innerAreaHeight;
                    const xMm = pos * innerAreaWidth;
                    innerContent.push(
                      <GridMullionHandle
                        key={`vseg-${vi}-${r}`}
                        orientation="vertical"
                        leftPx={(xMm - dims.mullion / 2) * scale}
                        topPx={segTop * scale}
                        widthPx={dims.mullion * scale}
                        heightPx={segHeight * scale}
                        positionMm={xMm}
                        scale={scale}
                        profileColor={profileColor}
                        texture={pt}
                        draggable={Boolean(onMoveV)}
                        onDragEnd={
                          onMoveV
                            ? (mm) => {
                                const ratio = Math.max(0.05, Math.min(0.95, mm / innerAreaWidth));
                                onMoveV(vi, ratio);
                              }
                            : undefined
                        }
                        onDelete={() => onDelVSeg(vi, r)}
                        deleteTitle="Remove this vertical segment"
                      />,
                    );
                  }
                });

                break;
            }
            case WindowType.GLASS_PARTITION: {
                const { partitionPanels } = config;
                const gap = PARTITION_PANEL_GAP_MM;
                const panelWidths = resolvePartitionPanelWidthsMm(
                  innerAreaWidth,
                  partitionPanels.count,
                  partitionPanels.types,
                  partitionPanels.widthFractions
                );

                if (partitionPanels.hasTopChannel) {
                  innerContent.push(<ProfilePiece key="track-top" color={profileColor} texture={pt} style={{ top: 0, left: 0, width: innerAreaWidth * scale, height: dims.topTrack * scale, zIndex: 4 }} />);
                }
                
                const panelAreaY = partitionPanels.hasTopChannel ? dims.topTrack : 0;
                const panelAreaHeight = innerAreaHeight - (partitionPanels.hasTopChannel ? dims.topTrack + dims.bottomTrack : 0);
                
                let currentX = 0;
                for (let i=0; i < partitionPanels.count; i++) {
                    const panelId = `partition-${i}`;
                    const panelConfig = partitionPanels.types[i];
                    if (!panelConfig) continue;
                    const { type, handle, framing } = panelConfig;

                    const panelX = currentX;
                    const currentPanelWidth = panelWidths[i] ?? 0;
                    const zIndex = type === 'sliding' || type === 'fold' ? 10 + i : 5;

                    let ph = panelAreaHeight;
                    const rawHm = panelConfig.heightMm;
                    if (rawHm !== '' && rawHm !== undefined && rawHm !== null) {
                      const nh = Number(rawHm);
                      if (Number.isFinite(nh) && nh > 0) {
                        ph = Math.min(nh, panelAreaHeight);
                      }
                    }
                    const py = getPartitionPanelTopMm(panelAreaY, panelAreaHeight, ph, panelConfig.heightAlign);
                    const foldLeaves = type === 'fold' ? clampFoldLeafCount(panelConfig.foldLeafCount) : undefined;

                    if (partitionPanels.hasTopChannel) {
                      innerContent.push(
                        <ProfilePiece
                          key={`track-bottom-${i}`}
                          color={profileColor}
                          texture={pt}
                          style={{
                            left: panelX * scale,
                            top: (py + ph - dims.bottomTrack) * scale,
                            width: currentPanelWidth * scale,
                            height: dims.bottomTrack * scale,
                            zIndex: 4,
                          }}
                        />
                      );
                    }

                    if (handle) {
                        const mirrored = mirrorHandleForPartitionHandleX(handle.x);
                        handleElements.push(
                          <div
                            key={`handle-part-${i}`}
                            style={{
                              position: 'absolute',
                              zIndex: 55,
                              left: (panelX + (currentPanelWidth * handle.x) / 100) * scale,
                              top: (py + (ph * handle.y) / 100) * scale,
                              transform: 'translate(-50%, -50%)',
                              transformOrigin: 'center center',
                            }}
                          >
                            <DraggableHandleWrap
                              config={config}
                              panelId={panelId}
                              handle={handle}
                              scale={scale}
                              color={profileColor}
                              mirrored={mirrored}
                              panelWidthMm={currentPanelWidth}
                              panelHeightMm={ph}
                              enableDrag={Boolean(callbacks.enableDoorHandleDrag && callbacks.onUpdateHandle)}
                              onUpdateHandle={callbacks.onUpdateHandle}
                            />
                          </div>,
                        );
                    }
                    
                    const isFramed = framing === 'full' || type === 'hinged';
                    const frameSize = dims.casementShutter;
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

                    innerContent.push(
                        <div key={`panel-${i}`} className="absolute" style={{left: mmToPx(panelX, scale), top: mmToPx(py, scale), width: mmToPx(currentPanelWidth, scale), height: mmToPx(ph, scale), zIndex}}>
                          {isFramed && type === 'fold' && (
                            <MiteredFrame
                              width={currentPanelWidth}
                              height={ph}
                              topSize={ft}
                              bottomSize={fb}
                              leftSize={fl}
                              rightSize={fr}
                              scale={scale}
                              color={profileColor}
                              texture={pt}
                            />
                          )}
                          {isFramed && type !== 'fold' && (
                            <MiteredFrame width={currentPanelWidth} height={ph} profileSize={frameSize} scale={scale} color={profileColor} texture={pt} />
                          )}
                          <div
                            className="absolute overflow-hidden"
                            style={
                              isFramed
                                ? { left: mmToPx(fl, scale), top: mmToPx(ft, scale), right: mmToPx(fr, scale), bottom: mmToPx(fb, scale) }
                                : { top: 0, left: 0, right: 0, bottom: 0 }
                            }
                          >
                            <GlassPanel panelId={panelId} config={config} style={{ position: 'absolute', left: 0, top: 0, width: '100%', height: '100%' }} glassWidth={currentPanelWidth - (isFramed ? fl + fr : 0)} glassHeight={ph - (isFramed ? ft + fb : 0)} scale={scale}>
                               {type === 'fold' && (
                                 <FoldDoorOpeningGraphic leaves={foldLeaves ?? 2} variant="canvas" profileColor={profileColor} />
                               )}
                               <ShutterIndicator type={type} foldLeaves={foldLeaves} />
                            </GlassPanel>
                          </div>
                        </div>
                    );

                    currentX += currentPanelWidth;
                    if (i < partitionPanels.count - 1) {
                        const nextPanelConfig = partitionPanels.types[i+1];
                        if (
                          isOperablePartitionType(type) &&
                          nextPanelConfig &&
                          isOperablePartitionType(nextPanelConfig.type)
                        ) {
                            currentX += gap;
                        }
                    }
                }
                break;
            }
        }
    }

    return { profileElements, glassElements, handleElements, innerContent, archHeadOverlay, archSpringYmm, innerAreaWidth, innerAreaHeight, holeX1, holeY1, geometry };
};

const RenderedWindow: React.FC<{
    config: WindowConfig;
    elements: ReturnType<typeof createWindowElements>;
    scale: number;
    showLabels?: boolean;
    dims?: { outerFrame: number; mullion: number };
}> = ({ config, elements, scale, showLabels = true, dims }) => {
    const { width, height, windowType } = config;
    const numWidth = Number(width) || 0;
    const numHeight = Number(height) || 0;
    const innerStyle =
      windowType === WindowType.CASEMENT || windowType === WindowType.VENTILATOR
        ? openingInnerClipStyle(config, elements.innerAreaWidth, elements.innerAreaHeight, scale)
        : {};

    return (
        <div className="relative shadow-lg" style={{ width: mmToPx(numWidth, scale), height: mmToPx(numHeight, scale) }}>
          {elements.glassElements}
          {elements.innerAreaWidth > 0 && elements.innerAreaHeight > 0 && (
            <div
              className="absolute z-[5]"
              style={{
                top: mmToPx(elements.holeY1, scale),
                left: mmToPx(elements.holeX1, scale),
                width: mmToPx(elements.innerAreaWidth, scale),
                height: mmToPx(elements.innerAreaHeight, scale),
                ...innerStyle,
              }}
            >
                {elements.innerContent}
                {elements.handleElements}
            </div>
          )}
          {elements.profileElements}
          {elements.archHeadOverlay.length > 0 && elements.archSpringYmm > 0 && (
            <div
              className="pointer-events-none absolute z-[15]"
              style={{
                top: mmToPx(elements.holeY1, scale),
                left: mmToPx(elements.holeX1, scale),
                width: mmToPx(elements.innerAreaWidth, scale),
                height: mmToPx(elements.archSpringYmm, scale),
              }}
            >
              {elements.archHeadOverlay}
            </div>
          )}
          
          {showLabels && <>
            <DimensionLabel value={numWidth} className="-top-8 left-1/2 -translate-x-1/2" />
            <DimensionLabel value={numHeight} className="top-1/2 -translate-y-1/2 -left-16 rotate-[-90deg]" />
            
            {elements.geometry.topFix && <DimensionLabel value={elements.geometry.topFix.size} className="top-1/2 -translate-y-1/2 left-1/2 -translate-x-1/2 text-cyan-200" style={{top: elements.geometry.topFix.size * scale / 2}}/>}
            {elements.geometry.leftFix && <DimensionLabel value={elements.geometry.leftFix.size} className="top-1/2 -translate-y-1/2 left-1/2 -translate-x-1/2 text-cyan-200" style={{top: (elements.geometry.holeY1 + ((numHeight - elements.geometry.holeY1 - elements.geometry.holeY2)/2)) * scale, left: elements.geometry.leftFix.size * scale / 2}}/>}
          </>}
        </div>
    );
};

export const WindowCanvas: React.FC<WindowCanvasProps> = React.memo((props) => {
  const {
    config,
    onRemoveHorizontalDivider,
    onRemoveVerticalDivider,
    onRemoveHMullionSegment,
    onRemoveVMullionSegment,
    onMoveHorizontalDivider,
    onMoveVerticalDivider,
    onToggleElevationDoor,
    fitViewportRef,
    onUpdateHandle,
    enableDoorHandleDrag,
  } = props;
  const { width, height, series, profileColor, windowType } = config;

  const containerRef = useRef<HTMLDivElement>(null);
  const renderedWindowRef = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState(1);
  const [viewportSize, setViewportSize] = useState({ w: 0, h: 0 });
  const [isExporting, setIsExporting] = useState(false);
  const [viewportEl, setViewportEl] = useState<HTMLElement | null>(null);

  const numWidth = windowType === WindowType.CORNER 
    ? (Number(config.leftWidth) || 0) + (Number(config.rightWidth) || 0) + (Number(config.cornerPostWidth) || 0)
    : Number(width) || 0;
  const numHeight = Number(height) || 0;

  /** px reserved for dimension labels drawn outside the frame bbox */
  const LABEL_LEFT_PX = 72;
  const LABEL_TOP_PX = 40;
  const CANVAS_PAD_PX = 24;

  const dims = useMemo(() => ({
    outerFrame: Number(series.dimensions.outerFrame) || 0, outerFrameVertical: Number(series.dimensions.outerFrameVertical) || 0, fixedFrame: Number(series.dimensions.fixedFrame) || 0, shutterHandle: Number(series.dimensions.shutterHandle) || 0, shutterInterlock: Number(series.dimensions.shutterInterlock) || 0, shutterTop: Number(series.dimensions.shutterTop) || 0, shutterBottom: Number(series.dimensions.shutterBottom) || 0, shutterMeeting: Number(series.dimensions.shutterMeeting) || 0, casementShutter: Number(series.dimensions.casementShutter) || 0, mullion: Number(series.dimensions.mullion) || 0, louverBlade: Number(series.dimensions.louverBlade) || 0, topTrack: Number(series.dimensions.topTrack) || 0, bottomTrack: Number(series.dimensions.bottomTrack) || 0
  }), [series.dimensions]);

  useLayoutEffect(() => {
    const pickTarget = () => fitViewportRef?.current ?? containerRef.current;
    const measure = () => {
      const el = pickTarget();
      if (!el) return;
      const w = el.clientWidth;
      const h = el.clientHeight;
      if (w <= 0 || h <= 0) return;
      setViewportSize({ w, h });
    };
    setViewportEl(fitViewportRef?.current ?? null);
    measure();
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(measure) : null;
    const attach = () => {
      const el = pickTarget();
      if (el) ro?.observe(el);
      measure();
    };
    attach();
    const raf = requestAnimationFrame(attach);
    window.addEventListener('resize', measure);
    return () => {
      cancelAnimationFrame(raf);
      ro?.disconnect();
      window.removeEventListener('resize', measure);
    };
  }, [fitViewportRef]);

  useEffect(() => {
    setZoom(1);
  }, [numWidth, numHeight, windowType]);

  useEffect(() => {
    const handleWheel = (e: WheelEvent) => {
        if (e.ctrlKey) {
            e.preventDefault();
            setZoom((prev) => clamp(prev - e.deltaY * 0.001, ZOOM_MIN, ZOOM_MAX));
        }
    };
    const currentRef = fitViewportRef?.current ?? containerRef.current;
    currentRef?.addEventListener('wheel', handleWheel, { passive: false });
    return () => currentRef?.removeEventListener('wheel', handleWheel);
  }, [fitViewportRef]);

  const fitScale = useMemo(() => {
    if (numWidth <= 0 || numHeight <= 0) return 1;
    const vpH = window.visualViewport?.height ?? window.innerHeight;
    const cw = Math.max(
      160,
      viewportSize.w ||
        fitViewportRef?.current?.clientWidth ||
        Math.min(window.innerWidth, 1400) * 0.45,
    );
    const ch = Math.max(
      180,
      viewportSize.h ||
        fitViewportRef?.current?.clientHeight ||
        vpH * 0.52,
    );
    const drawW = Math.max(80, cw - CANVAS_PAD_PX * 2 - LABEL_LEFT_PX);
    const drawH = Math.max(80, ch - CANVAS_PAD_PX * 2 - LABEL_TOP_PX);
    return Math.min(drawW / numWidth, drawH / numHeight);
  }, [numWidth, numHeight, viewportSize.w, viewportSize.h, fitViewportRef]);

  const scale = fitScale * zoom;

  const { placement, dragMeasure } = useHomeownerHandlePlacement();

  const canvasCallbacks = useMemo(() => ({
    onRemoveHorizontalDivider,
    onRemoveVerticalDivider,
    onRemoveHMullionSegment,
    onRemoveVMullionSegment,
    onMoveHorizontalDivider,
    onMoveVerticalDivider,
    onToggleElevationDoor,
    onUpdateHandle,
    enableDoorHandleDrag,
    handlePlacement: enableDoorHandleDrag ? placement : null,
    onPlaceHandleOnPanel:
      enableDoorHandleDrag && onUpdateHandle && placement
        ? (panelId: string, metrics: HandlePanelFrameMetrics) => {
            const cfg = buildHandleConfigForMember(panelId, config, placement, metrics);
            if (cfg) onUpdateHandle(panelId, cfg);
          }
        : undefined,
  }), [
    enableDoorHandleDrag,
    onRemoveHorizontalDivider,
    onRemoveVerticalDivider,
    onRemoveHMullionSegment,
    onRemoveVMullionSegment,
    onMoveHorizontalDivider,
    onMoveVerticalDivider,
    onToggleElevationDoor,
    onUpdateHandle,
    placement,
    config,
  ]);

    const handleExportPng = () => {
        const element = renderedWindowRef.current;
        if (!element || isExporting) return;

        setIsExporting(true);

        const bounds = element.getBoundingClientRect();
        const baseW = Math.max(1, Math.round(bounds.width));
        const baseH = Math.max(1, Math.round(bounds.height));
        const longest = Math.max(baseW, baseH);
        const captureScale = clamp(2400 / longest, 2, 5);

        import('html2canvas').then(({ default: html2canvas }) => {
            html2canvas(element, {
                scale: captureScale,
                backgroundColor: '#ffffff',
                logging: false,
                useCORS: true,
                width: baseW,
                height: baseH,
                windowWidth: baseW,
                windowHeight: baseH,
                scrollX: 0,
                scrollY: 0,
            }).then((productCanvas: HTMLCanvasElement) => {
                const padding = clamp(Math.round(Math.min(productCanvas.width, productCanvas.height) * 0.08), 48, 140);
                const outCanvas = document.createElement('canvas');
                outCanvas.width = productCanvas.width + padding * 2;
                outCanvas.height = productCanvas.height + padding * 2;

                const ctx = outCanvas.getContext('2d');
                if (!ctx) {
                    setIsExporting(false);
                    return;
                }

                ctx.fillStyle = 'white';
                ctx.fillRect(0, 0, outCanvas.width, outCanvas.height);
                ctx.drawImage(productCanvas, padding, padding);

                ctx.save();
                ctx.translate(outCanvas.width / 2, outCanvas.height / 2);
                ctx.rotate(-Math.PI / 4);
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.font = `bold ${Math.min(outCanvas.width, outCanvas.height) / 8}px Arial`;
                ctx.fillStyle = 'rgba(0, 0, 0, 0.10)';
                ctx.fillText('WoodenMax', 0, 0);
                ctx.restore();

                const link = document.createElement('a');
                link.download = `woodenmax-design-${Date.now()}.png`;
                link.href = outCanvas.toDataURL('image/png');
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                setIsExporting(false);
            }).catch((err: any) => {
                console.error('Failed to export PNG:', err);
                alert('Could not export image.');
                setIsExporting(false);
            });
        }).catch((err: any) => {
            console.error('Failed to load html2canvas:', err);
            alert('Could not export image.');
            setIsExporting(false);
        });
    };

  const zoomControls = (
    <div
      className="pointer-events-none absolute inset-0 z-10 overflow-hidden no-print"
      aria-hidden={false}
    >
      <div
        className="pointer-events-auto absolute right-4 flex flex-col gap-2 touch-manipulation"
        style={{ bottom: 'max(1rem, env(safe-area-inset-bottom, 0px))' }}
      >
        <button type="button" title="Zoom in" aria-label="Zoom in" onClick={() => setZoom((z) => clamp(z * 1.2, ZOOM_MIN, ZOOM_MAX))} className="w-11 h-11 sm:w-10 sm:h-10 bg-slate-700 hover:bg-indigo-600 rounded-full flex items-center justify-center text-white shadow-lg"><PlusIcon className="w-6 h-6"/></button>
        <button type="button" title="Fit view (reset zoom)" aria-label="Fit view" onClick={() => setZoom(1)} className="w-11 h-11 sm:w-10 sm:h-10 bg-slate-700 hover:bg-indigo-600 rounded-full flex items-center justify-center text-white shadow-lg"><ArrowsPointingInIcon className="w-5 h-5"/></button>
        <button type="button" title="Zoom out" aria-label="Zoom out" onClick={() => setZoom((z) => clamp(z / 1.2, ZOOM_MIN, ZOOM_MAX))} className="w-11 h-11 sm:w-10 sm:h-10 bg-slate-700 hover:bg-indigo-600 rounded-full flex items-center justify-center text-white shadow-lg"><MinusIcon className="w-6 h-6"/></button>
      </div>
    </div>
  );

  if (numWidth <= 0 || numHeight <= 0) {
    return (
      <div className="flex min-h-[200px] w-full items-center justify-center bg-transparent py-10">
        <p className="text-slate-500">Please enter valid dimensions to begin.</p>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="relative flex w-full min-w-0 shrink-0 flex-col items-center justify-center overflow-visible bg-transparent"
    >
      <div className="absolute bottom-4 left-4 text-white text-3xl font-black opacity-10 pointer-events-none no-print"> WoodenMax </div>
       <div ref={renderedWindowRef} className="flex shrink-0 flex-col items-center justify-center">
            {windowType === WindowType.CORNER && config.leftConfig && config.rightConfig ? (
                (() => {
                    const leftW = Number(config.leftWidth) || 0;
                    const rightW = Number(config.rightWidth) || 0;
                    const postW = Number(config.cornerPostWidth) || 0;
                    const totalW = leftW + rightW + postW;

                    const cornerConfigLeft: WindowConfig = { ...config, ...config.leftConfig, width: leftW, windowType: config.leftConfig.windowType, fixedPanels: [] };
                    const cornerConfigRight: WindowConfig = { ...config, ...config.rightConfig, width: rightW, windowType: config.rightConfig.windowType, fixedPanels: [] };
                    
                    const leftElements = createWindowElements(cornerConfigLeft, scale, dims, canvasCallbacks);
                    const rightElements = createWindowElements(cornerConfigRight, scale, dims, canvasCallbacks);

                    return (
                        <div className="relative shadow-lg flex items-start" style={{ width: mmToPx(totalW, scale), height: mmToPx(numHeight, scale) }}>
                            <div className="relative flex-shrink-0">
                                <RenderedWindow config={cornerConfigLeft} elements={leftElements} scale={scale} showLabels={false} />
                                <DimensionLabel value={leftW} className="-top-8 left-1/2 -translate-x-1/2" />
                            </div>
                            <div className="relative flex-shrink-0" style={{width: mmToPx(postW, scale), height: mmToPx(numHeight, scale)}}>
                                <ProfilePiece color={profileColor} texture={profileOverlayTexture(config)} style={{ left: 0, top: 0, width: '100%', height: '100%' }} />
                                <DimensionLabel value={postW} className="-top-8 left-1/2 -translate-x-1/2" />
                            </div>
                            <div className="relative flex-shrink-0">
                                <RenderedWindow config={cornerConfigRight} elements={rightElements} scale={scale} showLabels={false} />
                                <DimensionLabel value={rightW} className="-top-8 left-1/2 -translate-x-1/2" />
                            </div>
                            <DimensionLabel value={numHeight} className="top-1/2 -translate-y-1/2 -left-16 rotate-[-90deg]" />
                        </div>
                    )
                })()
            ) : (
                <RenderedWindow config={config} elements={createWindowElements(config, scale, dims, canvasCallbacks)} scale={scale} dims={dims} />
            )}
        </div>
      
      <div className="absolute top-4 right-4 z-10 flex flex-col gap-2 no-print">
        <button onClick={handleExportPng} title="Export as PNG" disabled={isExporting} className="w-10 h-10 bg-slate-700 hover:bg-indigo-600 rounded-full flex items-center justify-center text-white shadow-lg disabled:opacity-50 disabled:cursor-wait">
            {isExporting ? <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg> : <PhotoIcon className="w-6 h-6"/>}
        </button>
      </div>
      {enableDoorHandleDrag && dragMeasure ? (
        <div className="pointer-events-none absolute bottom-20 left-1/2 z-30 -translate-x-1/2 rounded-lg bg-slate-900/90 px-4 py-2 text-center text-sm font-mono text-white shadow-lg ring-1 ring-slate-600 no-print">
          <span className="text-emerald-300">{dragMeasure.mmFromTop} mm</span> from top
          <span className="mx-2 text-slate-500">·</span>
          <span className="text-sky-300">{dragMeasure.mmFromBottom} mm</span> from bottom
        </div>
      ) : null}
      {enableDoorHandleDrag && placement && !dragMeasure ? (
        <div className="pointer-events-none absolute top-3 left-1/2 z-30 max-w-[90%] -translate-x-1/2 rounded-md bg-indigo-600/90 px-3 py-1.5 text-center text-xs text-white shadow-lg no-print">
          Click a panel — handle on <strong className="uppercase">{placement}</strong> frame member
        </div>
      ) : null}
      {viewportEl ? createPortal(zoomControls, viewportEl) : zoomControls}
    </div>
  );
});
