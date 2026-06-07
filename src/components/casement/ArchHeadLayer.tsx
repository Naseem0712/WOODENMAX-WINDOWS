import React, { useId } from 'react';
import type { WindowConfig } from '../../types';
import {
  archHeadZoneClipPathD,
  archInnerRingStrokeSegments,
  archMullionSegments,
  isArchTopOutline,
  resolveArchInnerRingGapMm,
  resolveCasementOutline,
} from '../../utils/casementOutlineGeometry';
import { archGlassSvgPaint } from '../../utils/glassVisual';

type Props = {
  config: WindowConfig;
  innerW: number;
  springYmm: number;
  scale: number;
  mullionMm: number;
  profileColor: string;
};

const mmToPx = (mm: number, scale: number) => mm * scale;

/** Arch fanlight: glass (bottom) → inner ring strokes → radial mullions (top). */
export const ArchHeadLayer: React.FC<Props> = ({
  config,
  innerW,
  springYmm,
  scale,
  mullionMm,
  profileColor,
}) => {
  if (!isArchTopOutline(config) || springYmm <= 0 || innerW <= 0) return null;

  const wPx = mmToPx(innerW, scale);
  const hPx = mmToPx(springYmm, scale);
  const uid = useId().replace(/:/g, '');
  const outline = resolveCasementOutline(config);
  const glassPath = archHeadZoneClipPathD(innerW, springYmm);
  const mullions = archMullionSegments(innerW, springYmm, outline);
  const ringCount = outline.archInnerRingCount ?? 0;
  const ringGap = resolveArchInnerRingGapMm(outline);
  const innerRingStrokes = archInnerRingStrokeSegments(innerW, springYmm, ringCount, ringGap, mullionMm);
  const paint = archGlassSvgPaint(config, uid);
  const profileFill = profileColor.startsWith('#') ? profileColor : '#64748b';
  const mullionW = Math.max(mullionMm, 4);
  const { glassTexture } = config;

  if (!glassPath) return null;

  return (
    <svg
      className="pointer-events-none absolute left-0 top-0 block"
      width={wPx}
      height={hPx}
      viewBox={`0 0 ${innerW} ${springYmm}`}
      preserveAspectRatio="none"
      aria-hidden
    >
      <defs>
        <linearGradient id={`arch-glass-grad-${uid}`} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="hsl(200, 45%, 94%)" />
          <stop offset="45%" stopColor="hsl(210, 55%, 78%)" />
          <stop offset="100%" stopColor="hsl(205, 48%, 72%)" />
        </linearGradient>
        <linearGradient id={`arch-glass-shine-${uid}`} x1="0%" y1="0%" x2="80%" y2="100%">
          <stop offset="0%" stopColor="white" stopOpacity="0.45" />
          <stop offset="55%" stopColor="white" stopOpacity="0" />
        </linearGradient>
        {glassTexture ? (
          <pattern id={`arch-glass-tex-${uid}`} patternUnits="objectBoundingBox" width="1" height="1">
            <image href={glassTexture} width={innerW} height={springYmm} preserveAspectRatio="xMidYMid slice" />
          </pattern>
        ) : null}
      </defs>
      <path d={glassPath} fill={paint.fill} fillOpacity={paint.fillOpacity} />
      {!glassTexture ? (
        <path d={glassPath} fill={`url(#arch-glass-shine-${uid})`} fillOpacity={0.3} />
      ) : null}
      {innerRingStrokes.map((seg, i) => (
        <path
          key={`ring-${i}`}
          d={seg.d}
          fill="none"
          stroke={profileFill}
          strokeWidth={seg.strokeWidth}
          strokeLinecap="round"
        />
      ))}
      {mullions.map((seg, i) => (
        <line
          key={`rm-${i}`}
          x1={seg.x1}
          y1={seg.y1}
          x2={seg.x2}
          y2={seg.y2}
          stroke={profileFill}
          strokeWidth={mullionW}
          strokeLinecap="round"
        />
      ))}
    </svg>
  );
};
