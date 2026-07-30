import React, { useMemo } from 'react';
import type { WindowConfig } from '../types';
import { ShutterConfigType, WindowType } from '../types';
import {
  slidingGlassColumnCount,
  slidingTrackLaneCount,
} from './schematicDims';
import { SCH } from './schematicStyle';

type Props = {
  config: WindowConfig;
  maxWidthPx?: number;
  className?: string;
};

/**
 * EvA-style horizontal track/sash cross-section under the elevation.
 * Closed position — shows 2T/3T lanes and glass/mesh sash blocks.
 */
export const SlidingTrackSectionSvg: React.FC<Props> = ({
  config,
  maxWidthPx = 220,
  className,
}) => {
  const model = useMemo(() => {
    if (config.windowType !== WindowType.SLIDING) return null;
    const W = Number(config.width) || 0;
    if (W <= 0) return null;

    const tracks = slidingTrackLaneCount(config);
    const glassN = slidingGlassColumnCount(config.shutterConfig);
    const sc = config.shutterConfig;

    const padX = 8;
    const padY = 6;
    const frameD = 10;
    const laneH = 7;
    const laneGap = 2.5;
    const sashH = 5.5;
    const bodyH = frameD * 2 + tracks * laneH + (tracks - 1) * laneGap + 4;
    const vbW = W + padX * 2;
    const vbH = bodyH + padY * 2 + 14;
    const ox = padX;
    const oy = padY;
    const innerW = W - frameD * 2;
    const innerX = ox + frameD;

    type Sash = { x: number; w: number; lane: number; mesh?: boolean; label: string };
    const sashes: Sash[] = [];
    const colW = innerW / glassN;

    if (sc === ShutterConfigType.TWO_GLASS) {
      sashes.push({ x: 0, w: colW + 8, lane: 0, label: 'S1' });
      sashes.push({ x: colW - 8, w: colW + 8, lane: 1, label: 'S2' });
    } else if (sc === ShutterConfigType.THREE_GLASS) {
      for (let i = 0; i < 3; i++) {
        sashes.push({
          x: i * (colW - 6),
          w: colW + 10,
          lane: Math.min(i, tracks - 1),
          label: `S${i + 1}`,
        });
      }
    } else if (sc === ShutterConfigType.TWO_GLASS_ONE_MESH) {
      sashes.push({ x: 0, w: colW + 8, lane: 0, label: 'S1' });
      sashes.push({ x: colW - 8, w: colW + 8, lane: 1, label: 'S2' });
      sashes.push({ x: colW - 8, w: colW + 8, lane: 2, mesh: true, label: 'M1' });
    } else if (sc === ShutterConfigType.FOUR_GLASS) {
      for (let i = 0; i < 4; i++) {
        sashes.push({
          x: i * (colW - 4),
          w: colW + 8,
          lane: i < 2 ? 0 : 1,
          label: `S${i + 1}`,
        });
      }
    } else if (sc === ShutterConfigType.FOUR_GLASS_TWO_MESH) {
      for (let i = 0; i < 4; i++) {
        sashes.push({
          x: i * (colW - 4),
          w: colW + 8,
          lane: i < 2 ? 0 : 1,
          label: `S${i + 1}`,
        });
      }
      sashes.push({ x: 0, w: colW + 6, lane: 2, mesh: true, label: 'M1' });
      sashes.push({
        x: innerW - colW - 6,
        w: colW + 6,
        lane: 2,
        mesh: true,
        label: 'M2',
      });
    }

    return { W, vbW, vbH, ox, oy, frameD, laneH, laneGap, sashH, tracks, sashes, innerX, innerW };
  }, [config]);

  if (!model) return null;

  const {
    W,
    vbW,
    vbH,
    ox,
    oy,
    frameD,
    laneH,
    laneGap,
    sashH,
    tracks,
    sashes,
    innerX,
    innerW,
  } = model;

  const cssW = maxWidthPx;
  const cssH = (maxWidthPx * vbH) / vbW;
  const trackTop = oy + frameD;

  const laneY = (lane: number) => trackTop + lane * (laneH + laneGap) + laneH / 2;

  return (
    <svg
      className={`qs-track-section ${className ?? ''}`.trim()}
      width={cssW}
      height={cssH}
      viewBox={`0 0 ${vbW} ${vbH}`}
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label={`${tracks}-track sliding section`}
    >
      <rect x={0} y={0} width={vbW} height={vbH} fill="#ffffff" />
      {/* Outer frame rails */}
      <rect
        x={ox}
        y={oy}
        width={frameD}
        height={frameD * 2 + tracks * laneH + (tracks - 1) * laneGap}
        fill="#fff"
        stroke={SCH.ink}
        strokeWidth={SCH.trackStroke}
      />
      <rect
        x={ox + W - frameD}
        y={oy}
        width={frameD}
        height={frameD * 2 + tracks * laneH + (tracks - 1) * laneGap}
        fill="#fff"
        stroke={SCH.ink}
        strokeWidth={SCH.trackStroke}
      />
      {/* Track lanes */}
      {Array.from({ length: tracks }).map((_, i) => {
        const y = trackTop + i * (laneH + laneGap);
        return (
          <g key={`lane-${i}`}>
            <rect
              x={innerX}
              y={y}
              width={innerW}
              height={laneH}
              fill="none"
              stroke={SCH.ink}
              strokeWidth={0.55}
            />
            <line
              x1={innerX}
              y1={y + laneH * 0.55}
              x2={innerX + innerW}
              y2={y + laneH * 0.55}
              stroke={SCH.ink}
              strokeWidth={0.35}
              strokeDasharray="2 2"
            />
          </g>
        );
      })}
      {/* Sashes */}
      {sashes.map((s, i) => {
        const y = laneY(s.lane) - sashH / 2;
        const x = innerX + s.x;
        const w = Math.min(s.w, innerW - s.x);
        return (
          <g key={`sash-${i}`}>
            <rect
              x={x}
              y={y}
              width={Math.max(4, w)}
              height={sashH}
              fill={s.mesh ? '#e8e8e8' : '#fff'}
              stroke={SCH.ink}
              strokeWidth={0.85}
            />
            {s.mesh ? (
              <line
                x1={x + 1}
                y1={y + sashH - 1}
                x2={x + w - 1}
                y2={y + 1}
                stroke={SCH.ink}
                strokeWidth={0.45}
              />
            ) : null}
            <text
              x={x + Math.max(4, w) / 2}
              y={y - 1.5}
              textAnchor="middle"
              fontSize={6.5}
              fontFamily={SCH.fontFamily}
              fontWeight={600}
              fill={SCH.ink}
            >
              {s.label}
            </text>
          </g>
        );
      })}
      <text
        x={ox + W / 2}
        y={vbH - 3}
        textAnchor="middle"
        fontSize={7}
        fontFamily={SCH.fontFamily}
        fill={SCH.dim}
      >
        {tracks}T plan · closed
      </text>
    </svg>
  );
};
