import React, { useRef, useState } from 'react';
import { TrashIcon } from '../icons/TrashIcon';
import { mullionEdgeStyle, MullionJointLines } from '../profile/ProfileJointLines';
import { PROFILE_TEXTURE_TILE, profileTexturePosition } from '../../utils/profileTexture';

type Props = {
  orientation: 'horizontal' | 'vertical';
  leftPx: number;
  topPx: number;
  widthPx: number;
  heightPx: number;
  positionMm: number;
  scale: number;
  profileColor: string;
  texture?: string;
  draggable: boolean;
  onDragEnd?: (positionMm: number) => void;
  onDelete: () => void;
  deleteTitle?: string;
  /** When set, label shows distance from bottom instead of positionMm (spring transom). */
  measureFromBottom?: boolean;
  totalHeightMm?: number;
  /** Hide delete control (e.g. arch spring transom). */
  hideDelete?: boolean;
  zIndex?: number;
  /** When false, joint lines are drawn on a higher canvas layer instead. */
  showJointLines?: boolean;
};

export const GridMullionHandle: React.FC<Props> = ({
  orientation,
  leftPx,
  topPx,
  widthPx,
  heightPx,
  positionMm,
  scale,
  profileColor,
  texture,
  draggable,
  onDragEnd,
  onDelete,
  deleteTitle = 'Remove this mullion segment',
  measureFromBottom = false,
  totalHeightMm,
  hideDelete = false,
  zIndex = 4,
  showJointLines = true,
}) => {
  const [liveMm, setLiveMm] = useState<number | null>(null);
  const dragRef = useRef<{ startPos: number; startMm: number; axis: 'x' | 'y' } | null>(null);

  const onPointerDown = (e: React.PointerEvent) => {
    if (!draggable || !onDragEnd || scale <= 0) return;
    e.preventDefault();
    e.stopPropagation();
    const axis = orientation === 'horizontal' ? 'y' : 'x';
    dragRef.current = {
      startPos: axis === 'y' ? e.clientY : e.clientX,
      startMm: positionMm,
      axis,
    };
    setLiveMm(positionMm);

    const onMove = (ev: PointerEvent) => {
      const d = dragRef.current;
      if (!d) return;
      const deltaPx = (d.axis === 'y' ? ev.clientY : ev.clientX) - d.startPos;
      setLiveMm(Math.max(0, d.startMm + deltaPx / scale));
    };
    const onUp = (ev: PointerEvent) => {
      const d = dragRef.current;
      if (d) {
        const deltaPx = (d.axis === 'y' ? ev.clientY : ev.clientX) - d.startPos;
        onDragEnd(Math.max(0, d.startMm + deltaPx / scale));
      }
      dragRef.current = null;
      setLiveMm(null);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  };

  const rawMm = liveMm ?? positionMm;
  const showMm =
    measureFromBottom && totalHeightMm != null
      ? Math.round(totalHeightMm - rawMm)
      : Math.round(rawMm);
  const fill = profileColor.startsWith('#') ? profileColor : '#64748b';
  const tileStyle: React.CSSProperties = texture
    ? {
        backgroundImage: `url(${texture})`,
        backgroundSize: PROFILE_TEXTURE_TILE,
        backgroundRepeat: 'repeat',
        backgroundPosition: profileTexturePosition(texture, 0, 0),
      }
    : { backgroundColor: fill };

  const labelStyle: React.CSSProperties = {
    textShadow: '0 0 6px rgba(0,0,0,0.95), 0 1px 3px rgba(0,0,0,0.85)',
  };

  return (
    <div
      className={`absolute group touch-none ${draggable ? 'cursor-grab active:cursor-grabbing' : ''}`}
      style={{ left: leftPx, top: topPx, width: widthPx, height: heightPx, zIndex }}
      onPointerDown={onPointerDown}
    >
      <div className="absolute inset-0" style={{ ...tileStyle, ...mullionEdgeStyle('canvas') }} />
      {showJointLines ? (
        <MullionJointLines widthPx={widthPx} heightPx={heightPx} orientation={orientation} />
      ) : null}
      <div className="pointer-events-none absolute inset-0 bg-indigo-500/0 group-hover:bg-indigo-500/15 transition-colors" />
      <span
        className={`pointer-events-none absolute z-[2] whitespace-nowrap font-mono text-[10px] font-semibold text-cyan-100 opacity-0 transition-opacity group-hover:opacity-100 ${liveMm != null ? '!opacity-100' : ''} ${
          orientation === 'vertical'
            ? 'left-1/2 top-1 -translate-x-1/2'
            : 'left-1 top-1/2 -translate-y-1/2'
        }`}
        style={labelStyle}
      >
        {showMm} mm
      </span>
      {!hideDelete ? (
        <button
          type="button"
          title={deleteTitle}
          className="absolute right-0.5 top-1/2 z-[3] flex h-5 w-5 -translate-y-1/2 items-center justify-center rounded bg-red-600/90 text-white opacity-0 shadow group-hover:opacity-100 hover:bg-red-500"
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
        >
          <TrashIcon className="h-3 w-3" />
        </button>
      ) : null}
    </div>
  );
};
