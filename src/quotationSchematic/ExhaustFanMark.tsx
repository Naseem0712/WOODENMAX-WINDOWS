import React from 'react';
import { SCH } from './schematicStyle';

/** EvA-style circular exhaust fan mark for B&W schematics / print. */
export const ExhaustFanMark: React.FC<{
  cx: number;
  cy: number;
  r: number;
  showLabel?: boolean;
}> = ({ cx, cy, r, showLabel = true }) => {
  const bladeR = r * 0.82;
  const hubR = Math.max(1.5, r * 0.14);
  const blades = [0, 72, 144, 216, 288];
  return (
    <g className="qs-fan" aria-label="Exhaust fan">
      <circle cx={cx} cy={cy} r={r} fill="none" stroke={SCH.ink} strokeWidth={1.1} />
      <circle cx={cx} cy={cy} r={r * 0.72} fill="none" stroke={SCH.ink} strokeWidth={0.55} />
      {blades.map((deg) => {
        const rad = (deg * Math.PI) / 180;
        const x2 = cx + Math.sin(rad) * bladeR;
        const y2 = cy - Math.cos(rad) * bladeR;
        return (
          <line
            key={deg}
            x1={cx}
            y1={cy}
            x2={x2}
            y2={y2}
            stroke={SCH.ink}
            strokeWidth={1.4}
            strokeLinecap="round"
          />
        );
      })}
      <circle cx={cx} cy={cy} r={hubR} fill={SCH.ink} />
      {showLabel ? (
        <text
          x={cx}
          y={cy + r + Math.max(8, r * 0.35)}
          textAnchor="middle"
          fontSize={Math.max(7, r * 0.28)}
          fontFamily={SCH.fontFamily}
          fontWeight={700}
          fill={SCH.ink}
        >
          FAN
        </text>
      ) : null}
    </g>
  );
};
