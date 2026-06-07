import React, { useId, useMemo } from 'react';
import type { WindowConfig } from '../../types';
import {
  archHeadZoneClipPathD,
  archInnerRingStrokeSegments,
  archRadialMullionMiteredBarPathsAll,
  isArchTopOutline,
  resolveArchInnerRingGapMm,
  resolveCasementOutline,
} from '../../utils/casementOutlineGeometry';
import { archGlassSvgPaint } from '../../utils/glassVisual';
import { jointStroke, mmOutlineInnerStrokeWidth, mmOutlineStrokeWidth, outlineSvgProps } from '../profile/ProfileJointLines';

export type ArchHeadLayerPart = 'glass' | 'profiles' | 'outlines';

type Props = {
  config: WindowConfig;
  innerW: number;
  springYmm: number;
  scale: number;
  mullionMm: number;
  profileColor: string;
  variant?: 'canvas' | 'print';
  part?: ArchHeadLayerPart;
};

const mmToPx = (mm: number, scale: number) => mm * scale;

function useArchHeadData(
  config: WindowConfig,
  innerW: number,
  springYmm: number,
  mullionMm: number,
) {
  return useMemo(() => {
    const outline = resolveCasementOutline(config);
    const glassPath = archHeadZoneClipPathD(innerW, springYmm);
    const barPaths = archRadialMullionMiteredBarPathsAll(innerW, springYmm, outline, mullionMm);
    const ringCount = outline.archInnerRingCount ?? 0;
    const ringGap = resolveArchInnerRingGapMm(outline);
    const innerRingStrokes = archInnerRingStrokeSegments(innerW, springYmm, ringCount, ringGap, mullionMm);
    return { glassPath, barPaths, innerRingStrokes };
  }, [config, innerW, springYmm, mullionMm]);
}

/** Arch fanlight — glass behind constant-width mullion bars with hub miters. */
export const ArchHeadLayer: React.FC<Props> = ({
  config,
  innerW,
  springYmm,
  scale,
  mullionMm,
  profileColor,
  variant = 'canvas',
  part = 'glass',
}) => {
  const uid = useId().replace(/:/g, '');
  const { glassPath, barPaths, innerRingStrokes } = useArchHeadData(config, innerW, springYmm, mullionMm);
  const paint = archGlassSvgPaint(config, uid);
  const profileFill = profileColor.startsWith('#') ? profileColor : '#64748b';
  const outlineStroke = jointStroke(variant);
  const outlineOuterSw = mmOutlineStrokeWidth(variant, scale);
  const outlineInnerSw = mmOutlineInnerStrokeWidth(variant, scale);
  const { glassTexture } = config;

  if (!isArchTopOutline(config) || springYmm <= 0 || innerW <= 0 || !glassPath) return null;

  const wPx = mmToPx(innerW, scale);
  const hPx = mmToPx(springYmm, scale);
  const clipId = `arch-fan-${uid}`;

  if (part === 'glass') {
    return (
      <svg
        className="pointer-events-none absolute left-0 top-0 block"
        width={wPx}
        height={hPx}
        viewBox={`0 0 ${innerW} ${springYmm}`}
        preserveAspectRatio="none"
        aria-hidden
        style={{ overflow: 'hidden' }}
        {...outlineSvgProps}
      >
        <defs>
          <clipPath id={`arch-glass-${uid}`}>
            <path d={glassPath} />
          </clipPath>
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
        <g clipPath={`url(#arch-glass-${uid})`}>
          <path d={glassPath} fill={paint.fill} fillOpacity={paint.fillOpacity} />
          {!glassTexture ? (
            <path d={glassPath} fill={`url(#arch-glass-shine-${uid})`} fillOpacity={0.28} />
          ) : null}
        </g>
      </svg>
    );
  }

  const fanlightClip = (
    <defs>
      <clipPath id={clipId}>
        <path d={glassPath} />
      </clipPath>
    </defs>
  );

  if (part === 'profiles') {
    return (
      <svg
        className="pointer-events-none absolute left-0 top-0 block"
        width={wPx}
        height={hPx}
        viewBox={`0 0 ${innerW} ${springYmm}`}
        preserveAspectRatio="none"
        aria-hidden
        style={{ overflow: 'hidden' }}
        {...outlineSvgProps}
      >
        {fanlightClip}
        <g clipPath={`url(#${clipId})`}>
          {innerRingStrokes.map((seg, i) => (
            <path
              key={`ring-${i}`}
              d={seg.d}
              fill="none"
              stroke={profileFill}
              strokeWidth={seg.strokeWidth}
              strokeLinecap="butt"
            />
          ))}
          {barPaths.map((bar, i) => (
            <path key={`rm-${i}`} d={bar.fillD} fill={profileFill} stroke="none" />
          ))}
        </g>
      </svg>
    );
  }

  return (
    <svg
      className="pointer-events-none absolute left-0 top-0 block"
      width={wPx}
      height={hPx}
      viewBox={`0 0 ${innerW} ${springYmm}`}
      preserveAspectRatio="none"
      aria-hidden
      style={{ overflow: 'hidden' }}
      {...outlineSvgProps}
    >
      {fanlightClip}
      <g clipPath={`url(#${clipId})`}>
        {barPaths.map((bar, i) => (
          <g key={`mo-${i}`}>
            <path d={bar.leftEdgeD} fill="none" stroke={outlineStroke} strokeWidth={outlineOuterSw} strokeLinecap="butt" />
            <path d={bar.rightEdgeD} fill="none" stroke={outlineStroke} strokeWidth={outlineOuterSw} strokeLinecap="butt" />
            {bar.archCapD ? (
              <path d={bar.archCapD} fill="none" stroke={outlineStroke} strokeWidth={outlineOuterSw} strokeLinecap="butt" />
            ) : null}
            {bar.springCapD ? (
              <path d={bar.springCapD} fill="none" stroke={outlineStroke} strokeWidth={outlineOuterSw} strokeLinecap="butt" />
            ) : null}
          </g>
        ))}
        {innerRingStrokes.map((seg, i) => (
          <path
            key={`ring-o-${i}`}
            d={seg.d}
            fill="none"
            stroke={outlineStroke}
            strokeWidth={outlineInnerSw}
            strokeLinecap="butt"
          />
        ))}
      </g>
    </svg>
  );
};
