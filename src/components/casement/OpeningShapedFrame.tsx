import React from 'react';
import type { WindowConfig } from '../../types';
import {
  buildArchOuterFrameInnerBoundaryD,
  buildArchOuterFrameOuterBoundaryD,
  buildArchOuterFrameRingD,
  buildRoundedOuterFrameRingD,
  archSpringYMmForOpening,
  resolveCasementOutline,
} from '../../utils/casementOutlineGeometry';

type Props = {
  config: WindowConfig;
  windowW: number;
  windowH: number;
  holeX: number;
  holeY: number;
  innerW: number;
  innerH: number;
  scale: number;
  color: string;
};

const mmToPx = (mm: number, scale: number) => mm * scale;
const outlineStroke = 'rgba(15,23,42,0.48)';

/** Shaped outer profile ring — closes before inner glass/mullions (like standard MiteredFrame). */
export const OpeningShapedFrame: React.FC<Props> = ({
  config,
  windowW,
  windowH,
  holeX,
  holeY,
  innerW,
  innerH,
  scale,
  color,
}) => {
  const outline = resolveCasementOutline(config);
  const fill = color.startsWith('#') ? color : '#64748b';
  let ringD = '';
  let outerBoundary = '';
  let innerBoundary = '';

  if (outline.shape === 'arch_top') {
    const springY = archSpringYMmForOpening(config, innerW, innerH);
    ringD = buildArchOuterFrameRingD(windowW, windowH, holeX, holeY, innerW, innerH, springY);
    outerBoundary = buildArchOuterFrameOuterBoundaryD(windowW, windowH, holeY, springY);
    innerBoundary = buildArchOuterFrameInnerBoundaryD(holeX, holeY, innerW, innerH, springY);
  } else if (
    outline.shape === 'rounded_rect' ||
    outline.shape === 'rounded_top' ||
    outline.shape === 'rounded_bottom'
  ) {
    ringD = buildRoundedOuterFrameRingD(
      windowW,
      windowH,
      holeX,
      holeY,
      innerW,
      innerH,
      Number(outline.cornerRadiusMm) || 40,
      outline.shape,
    );
  }

  if (!ringD) return null;

  const wPx = mmToPx(windowW, scale);
  const hPx = mmToPx(windowH, scale);

  return (
    <svg
      className="absolute left-0 top-0 z-[10] pointer-events-none"
      width={wPx}
      height={hPx}
      viewBox={`0 0 ${windowW} ${windowH}`}
      preserveAspectRatio="none"
      aria-hidden
    >
      <path d={ringD} fill={fill} fillRule="evenodd" />
      {outerBoundary ? (
        <path d={outerBoundary} fill="none" stroke={outlineStroke} strokeWidth={0.9} vectorEffect="non-scaling-stroke" />
      ) : null}
      {innerBoundary ? (
        <path d={innerBoundary} fill="none" stroke={outlineStroke} strokeWidth={0.85} vectorEffect="non-scaling-stroke" />
      ) : null}
    </svg>
  );
};
