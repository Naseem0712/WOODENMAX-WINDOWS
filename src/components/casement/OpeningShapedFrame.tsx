import React from 'react';
import type { WindowConfig } from '../../types';
import {
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

  if (outline.shape === 'arch_top') {
    const springY = archSpringYMmForOpening(config, innerW, innerH);
    ringD = buildArchOuterFrameRingD(windowW, windowH, holeX, holeY, innerW, innerH, springY);
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

  return (
    <svg
      className="absolute left-0 top-0 z-[10] pointer-events-none"
      width={mmToPx(windowW, scale)}
      height={mmToPx(windowH, scale)}
      viewBox={`0 0 ${windowW} ${windowH}`}
      preserveAspectRatio="none"
      aria-hidden
    >
      <path d={ringD} fill={fill} fillRule="evenodd" />
    </svg>
  );
};
