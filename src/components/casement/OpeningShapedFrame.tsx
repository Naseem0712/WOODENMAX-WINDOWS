import React from 'react';
import type { WindowConfig } from '../../types';
import {
  buildArchInnerOpeningArcD,
  buildArchOpeningHoleD,
  buildArchOuterFrameInnerBoundaryD,
  buildArchOuterFrameOuterBoundaryD,
  buildArchOuterFrameRingD,
  buildRoundedOuterFrameRingD,
  buildRoundedOuterFrameOuterBoundaryD,
  buildRoundedOuterFrameInnerBoundaryD,
  archSpringYMmForOpening,
  resolveCasementOutline,
} from '../../utils/casementOutlineGeometry';
import type { OpeningInnerLineHideRanges } from '../../utils/casementGridMullions';
import { subtractMmRanges } from '../../utils/casementGridMullions';
import { jointStroke, jointWidth, jointInnerWidth, mmOutlineInnerStrokeWidth, mmOutlineStrokeWidth, outlineSvgProps, type ProfileJointVariant } from '../profile/ProfileJointLines';

type FrameGeom = {
  ringD: string;
  outerBoundary: string;
  innerBoundary: string;
  innerHoleD: string;
};

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
  /** Draw profile fill only (outlines rendered on a higher layer). */
  fillOnly?: boolean;
  variant?: ProfileJointVariant;
  /** Hide inner straight-edge spans under overlapping doors (opening mm coords). */
  hideRanges?: OpeningInnerLineHideRanges;
  /** Outer frame profile thickness — for 45° miter corner seams on straight edges. */
  frameProfileMm?: number;
};

function archInnerStraightSegments(
  holeX: number,
  holeY: number,
  innerW: number,
  innerH: number,
  springY: number,
  hide?: OpeningInnerLineHideRanges,
): Array<{ x1: number; y1: number; x2: number; y2: number }> {
  const bottomY = holeY + innerH;
  const leftX = holeX;
  const rightX = holeX + innerW;
  const lines: Array<{ x1: number; y1: number; x2: number; y2: number }> = [];
  const hideLeft = hide?.left ?? [];
  const hideRight = hide?.right ?? [];
  const hideBottom = hide?.bottom ?? [];
  /** Straight jambs only below the spring line — no vertical shoulders in the arch band. */
  const jambTopY = Math.max(0, Math.min(innerH, springY));

  for (const [y0, y1] of subtractMmRanges(jambTopY, innerH, hideLeft)) {
    lines.push({ x1: leftX, y1: holeY + y0, x2: leftX, y2: holeY + y1 });
  }
  for (const [y0, y1] of subtractMmRanges(jambTopY, innerH, hideRight)) {
    lines.push({ x1: rightX, y1: holeY + y0, x2: rightX, y2: holeY + y1 });
  }
  for (const [x0, x1] of subtractMmRanges(0, innerW, hideBottom)) {
    lines.push({ x1: holeX + x0, y1: bottomY, x2: holeX + x1, y2: bottomY });
  }

  return lines;
}

function archOuterFrameMiterLines(
  windowW: number,
  windowH: number,
  _holeY: number,
  _springY: number,
  frameMm: number,
): Array<{ x1: number; y1: number; x2: number; y2: number }> {
  const f = Math.max(0, frameMm);
  if (f <= 0) return [];
  return [
    { x1: 0, y1: windowH, x2: f, y2: windowH - f },
    { x1: windowW, y1: windowH, x2: windowW - f, y2: windowH - f },
  ];
}

function roundedOuterFrameMiterLines(
  windowW: number,
  windowH: number,
  frameMm: number,
): Array<{ x1: number; y1: number; x2: number; y2: number }> {
  const f = Math.max(0, frameMm);
  if (f <= 0) return [];
  return [
    { x1: 0, y1: windowH, x2: f, y2: windowH - f },
    { x1: windowW, y1: windowH, x2: windowW - f, y2: windowH - f },
    { x1: 0, y1: 0, x2: f, y2: f },
    { x1: windowW, y1: 0, x2: windowW - f, y2: f },
  ];
}

const mmToPx = (mm: number, scale: number) => mm * scale;

function resolveShapedFrameGeom(
  config: WindowConfig,
  windowW: number,
  windowH: number,
  holeX: number,
  holeY: number,
  innerW: number,
  innerH: number,
): FrameGeom {
  const outline = resolveCasementOutline(config);
  let ringD = '';
  let outerBoundary = '';
  let innerBoundary = '';
  let innerHoleD = '';

  if (outline.shape === 'arch_top') {
    const springY = archSpringYMmForOpening(config, innerW, innerH);
    ringD = buildArchOuterFrameRingD(windowW, windowH, holeX, holeY, innerW, innerH, springY);
    outerBoundary = buildArchOuterFrameOuterBoundaryD(windowW, windowH, holeY, springY);
    innerBoundary = buildArchOuterFrameInnerBoundaryD(holeX, holeY, innerW, innerH, springY);
    innerHoleD = buildArchOpeningHoleD(holeX, holeY, innerW, innerH, springY);
  } else if (
    outline.shape === 'rounded_rect' ||
    outline.shape === 'rounded_top' ||
    outline.shape === 'rounded_bottom'
  ) {
    const cornerMm = Number(outline.cornerRadiusMm) || 40;
    ringD = buildRoundedOuterFrameRingD(
      windowW,
      windowH,
      holeX,
      holeY,
      innerW,
      innerH,
      cornerMm,
      outline.shape,
    );
    outerBoundary = buildRoundedOuterFrameOuterBoundaryD(
      windowW,
      windowH,
      holeX,
      holeY,
      innerW,
      innerH,
      cornerMm,
      outline.shape,
    );
    innerBoundary = buildRoundedOuterFrameInnerBoundaryD(
      windowW,
      windowH,
      holeX,
      holeY,
      innerW,
      innerH,
      cornerMm,
      outline.shape,
    );
    innerHoleD = innerBoundary;
  }

  return { ringD, outerBoundary, innerBoundary, innerHoleD };
}

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
  fillOnly = false,
  variant = 'canvas',
}) => {
  const uid = React.useId().replace(/:/g, '');
  const { ringD, outerBoundary, innerBoundary, innerHoleD } = resolveShapedFrameGeom(
    config,
    windowW,
    windowH,
    holeX,
    holeY,
    innerW,
    innerH,
  );
  if (!ringD && !innerHoleD) return null;

  const fill = color.startsWith('#') ? color : '#64748b';
  const wPx = mmToPx(windowW, scale);
  const hPx = mmToPx(windowH, scale);
  const stroke = jointStroke(variant);
  const outerSw = jointWidth(variant);
  const innerSw = jointInnerWidth(variant);

  return (
    <svg
      className="absolute left-0 top-0 pointer-events-none"
      width={wPx}
      height={hPx}
      viewBox={`0 0 ${windowW} ${windowH}`}
      preserveAspectRatio="none"
      aria-hidden
      {...outlineSvgProps}
    >
      {ringD ? (
        <path d={ringD} fill={fill} fillRule="evenodd" />
      ) : innerHoleD ? (
        <>
          <defs>
            <mask id={`shaped-hole-${uid}`}>
              <rect x={0} y={0} width={windowW} height={windowH} fill="white" />
              <path d={innerHoleD} fill="black" />
            </mask>
          </defs>
          <rect x={0} y={0} width={windowW} height={windowH} fill={fill} mask={`url(#shaped-hole-${uid})`} />
        </>
      ) : null}
      {!fillOnly && outerBoundary ? (
        <path d={outerBoundary} fill="none" stroke={stroke} strokeWidth={outerSw} strokeLinecap="butt" strokeLinejoin="miter" vectorEffect="non-scaling-stroke" />
      ) : null}
      {!fillOnly && innerBoundary ? (
        <path d={innerBoundary} fill="none" stroke={stroke} strokeWidth={innerSw} strokeLinecap="butt" strokeLinejoin="miter" vectorEffect="non-scaling-stroke" />
      ) : null}
    </svg>
  );
};

/** Shaped outer frame CAD outlines — rendered above mullions, below doors. */
export const OpeningShapedFrameOutlines: React.FC<Omit<Props, 'fillOnly' | 'color'>> = (props) => {
  const {
    config,
    windowW,
    windowH,
    holeX,
    holeY,
    innerW,
    innerH,
    scale,
    variant = 'canvas',
    hideRanges,
    frameProfileMm = 0,
  } = props;
  const outline = resolveCasementOutline(config);
  const useArchSegments = outline.shape === 'arch_top';
  const { outerBoundary, innerBoundary } = resolveShapedFrameGeom(
    config,
    windowW,
    windowH,
    holeX,
    holeY,
    innerW,
    innerH,
  );
  if (!outerBoundary && !innerBoundary && !useArchSegments) return null;

  const pad = mmOutlineStrokeWidth(variant, scale);
  const wPx = mmToPx(windowW, scale);
  const hPx = mmToPx(windowH, scale);
  const stroke = jointStroke(variant);
  const outerSw = mmOutlineStrokeWidth(variant, scale);
  const innerSw = mmOutlineInnerStrokeWidth(variant, scale);
  const springY = useArchSegments ? archSpringYMmForOpening(config, innerW, innerH) : 0;
  const innerArchArcD = useArchSegments
    ? buildArchInnerOpeningArcD(holeX, holeY, innerW, springY)
    : '';
  const innerSegments = useArchSegments
    ? archInnerStraightSegments(holeX, holeY, innerW, innerH, springY, hideRanges)
    : [];
  const miterLines = useArchSegments
    ? archOuterFrameMiterLines(windowW, windowH, holeY, springY, frameProfileMm)
    : roundedOuterFrameMiterLines(windowW, windowH, frameProfileMm);

  return (
    <svg
      className="absolute left-0 top-0 pointer-events-none"
      style={{ zIndex: 1, overflow: 'visible' }}
      width={wPx}
      height={hPx}
      viewBox={`${-pad} ${-pad} ${windowW + pad * 2} ${windowH + pad * 2}`}
      preserveAspectRatio="none"
      aria-hidden
      {...outlineSvgProps}
    >
      {outerBoundary ? (
        <path
          d={outerBoundary}
          fill="none"
          stroke={stroke}
          strokeWidth={outerSw}
          strokeLinecap="butt"
          strokeLinejoin="miter"
        />
      ) : null}
      {useArchSegments ? (
        <>
          {innerArchArcD ? (
            <path
              d={innerArchArcD}
              fill="none"
              stroke={stroke}
              strokeWidth={innerSw}
              strokeLinecap="butt"
              strokeLinejoin="miter"
            />
          ) : null}
          {innerSegments.map((seg, i) => (
            <line
              key={`in-${i}`}
              x1={seg.x1}
              y1={seg.y1}
              x2={seg.x2}
              y2={seg.y2}
              stroke={stroke}
              strokeWidth={innerSw}
              strokeLinecap="butt"
            />
          ))}
        </>
      ) : innerBoundary ? (
        <path
          d={innerBoundary}
          fill="none"
          stroke={stroke}
          strokeWidth={innerSw}
          strokeLinecap="butt"
          strokeLinejoin="miter"
        />
      ) : null}
      {miterLines.map((seg, i) => (
        <line
          key={`m-${i}`}
          x1={seg.x1}
          y1={seg.y1}
          x2={seg.x2}
          y2={seg.y2}
          stroke={stroke}
          strokeWidth={outerSw}
          strokeLinecap="butt"
        />
      ))}
    </svg>
  );
};
