import React from 'react';
import type { WindowConfig } from '../../types';
import {
  archHeadZoneClipPathD,
  archMullionSegments,
  isArchTopOutline,
  resolveCasementOutline,
} from '../../utils/casementOutlineGeometry';

type Props = {
  config: WindowConfig;
  innerW: number;
  innerH: number;
  mullionMm: number;
  scale: number;
  profileColor: string;
  springYmm: number;
};

const mmToPx = (mm: number, scale: number) => mm * scale;

/** Radial fanlight mullions above the spring transom only (135°, 90°, 45°, etc.). */
export const ArchInnerMullions: React.FC<Props> = ({
  config,
  innerW,
  innerH,
  mullionMm,
  scale,
  profileColor,
  springYmm,
}) => {
  if (!isArchTopOutline(config) || springYmm <= 0) return null;

  const outline = resolveCasementOutline(config);
  const wPx = mmToPx(innerW, scale);
  const hPx = mmToPx(springYmm, scale);
  const stroke = profileColor.startsWith('#') ? profileColor : '#64748b';
  const mullions = archMullionSegments(innerW, springYmm, outline);
  const mullionW = Math.max(mullionMm, 4);
  const clipId = React.useId().replace(/:/g, '');

  if (mullions.length === 0) return null;

  return (
    <svg
      className="pointer-events-none absolute left-0 top-0 z-[3]"
      width={wPx}
      height={hPx}
      viewBox={`0 0 ${innerW} ${springYmm}`}
      preserveAspectRatio="none"
      aria-hidden
    >
      <defs>
        <clipPath id={`arch-head-${clipId}`}>
          <path d={archHeadZoneClipPathD(innerW, springYmm)} />
        </clipPath>
      </defs>
      <g clipPath={`url(#arch-head-${clipId})`}>
        {mullions.map((seg, i) => (
          <line
            key={`rm-${i}`}
            x1={seg.x1}
            y1={seg.y1}
            x2={seg.x2}
            y2={seg.y2}
            stroke={stroke}
            strokeWidth={mullionW}
            strokeLinecap="round"
          />
        ))}
      </g>
    </svg>
  );
};

export function openingInnerClipStyle(
  config: WindowConfig,
  _innerW: number,
  _innerH: number,
  _scale: number,
): React.CSSProperties {
  // Arch head uses SVG paths (ArchHeadGlass / ArchInnerMullions). CSS path() clip often
  // drops the fanlight zone in Chromium — keep the inner hole un-clipped for arch_top.
  if (isArchTopOutline(config)) {
    return { overflow: 'visible' };
  }
  return { overflow: 'hidden' };
}
