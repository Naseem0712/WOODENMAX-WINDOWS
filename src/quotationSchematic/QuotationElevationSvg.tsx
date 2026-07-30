import React, { useId, useMemo } from 'react';
import type { HandleConfig, WindowConfig } from '../types';
import { FixedPanelPosition, ShutterConfigType, WindowType } from '../types';
import { ExhaustFanMark } from './ExhaustFanMark';
import {
  quotationElevationDims,
  schematicOuterFrameMm,
  schematicSashMm,
  slidingGlassColumnCount,
  slidingHasMesh,
  supportsQuotationSchematic,
} from './schematicDims';
import { DIM_MARGIN, SCH, schematicId } from './schematicStyle';

type Props = {
  config: WindowConfig;
  /** Max CSS pixel width of the SVG (height scales with aspect + dim margins). */
  maxWidthPx?: number;
  className?: string;
};

function num(v: unknown, fallback = 0): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function dimArrowPath(x1: number, y1: number, x2: number, y2: number, head = 3.2): string {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = Math.hypot(dx, dy) || 1;
  const ux = dx / len;
  const uy = dy / len;
  const px = -uy;
  const py = ux;
  const a1x = x1 + ux * head + px * head * 0.45;
  const a1y = y1 + uy * head + py * head * 0.45;
  const a2x = x1 + ux * head - px * head * 0.45;
  const a2y = y1 + uy * head - py * head * 0.45;
  const b1x = x2 - ux * head + px * head * 0.45;
  const b1y = y2 - uy * head + py * head * 0.45;
  const b2x = x2 - ux * head - px * head * 0.45;
  const b2y = y2 - uy * head - py * head * 0.45;
  return `M${x1} ${y1} L${x2} ${y2} M${x1} ${y1} L${a1x} ${a1y} M${x1} ${y1} L${a2x} ${a2y} M${x2} ${y2} L${b1x} ${b1y} M${x2} ${y2} L${b2x} ${b2y}`;
}

function miteredFrame(
  x: number,
  y: number,
  w: number,
  h: number,
  t: number,
): { outer: string; inner: string; miters: string[] } {
  const outer = `M${x} ${y} H${x + w} V${y + h} H${x} Z`;
  const ix = x + t;
  const iy = y + t;
  const iw = Math.max(0, w - 2 * t);
  const ih = Math.max(0, h - 2 * t);
  const inner = `M${ix} ${iy} H${ix + iw} V${iy + ih} H${ix} Z`;
  const miters = [
    `M${x} ${y} L${ix} ${iy}`,
    `M${x + w} ${y} L${ix + iw} ${iy}`,
    `M${x + w} ${y + h} L${ix + iw} ${iy + ih}`,
    `M${x} ${y + h} L${ix} ${iy + ih}`,
  ];
  return { outer, inner, miters };
}

function HandleMark({
  x,
  y,
  orientation,
  label,
}: {
  x: number;
  y: number;
  orientation: HandleConfig['orientation'];
  label?: string;
}) {
  const vertical = orientation !== 'horizontal';
  const hw = vertical ? 3.2 : 10;
  const hh = vertical ? 14 : 3.2;
  return (
    <g>
      <rect
        x={x - hw / 2}
        y={y - hh / 2}
        width={hw}
        height={hh}
        rx={0.6}
        fill={SCH.ink}
        stroke="none"
      />
      {label ? (
        <text
          x={x + (vertical ? 7 : 0)}
          y={y + (vertical ? 3 : -6)}
          fontSize={SCH.labelFontSize}
          fontFamily={SCH.fontFamily}
          fontWeight={600}
          fill={SCH.ink}
          textAnchor={vertical ? 'start' : 'middle'}
        >
          {label}
        </text>
      ) : null}
    </g>
  );
}

function MeshHatch({
  x,
  y,
  w,
  h,
  patternId,
}: {
  x: number;
  y: number;
  w: number;
  h: number;
  patternId: string;
}) {
  return <rect x={x} y={y} width={w} height={h} fill={`url(#${patternId})`} opacity={0.85} />;
}

/**
 * EvA-style B&W CAD elevation for quotation print/PDF.
 * Sliding / Casement / Ventilator only — caller should check supportsQuotationSchematic.
 */
export const QuotationElevationSvg: React.FC<Props> = ({
  config,
  maxWidthPx = 220,
  className,
}) => {
  const reactId = useId().replace(/:/g, '');
  const hatchId = schematicId('mesh', reactId);
  const clipId = schematicId('clip', reactId);

  const model = useMemo(() => {
    if (!supportsQuotationSchematic(config)) return null;

    const W = num(config.width);
    const H = num(config.height);
    if (W <= 0 || H <= 0) return null;

    const fixedPanels = config.fixedPanels ?? [];
    const topFix = fixedPanels.find((p) => p.position === FixedPanelPosition.TOP);
    const bottomFix = fixedPanels.find((p) => p.position === FixedPanelPosition.BOTTOM);
    const leftFix = fixedPanels.find((p) => p.position === FixedPanelPosition.LEFT);
    const rightFix = fixedPanels.find((p) => p.position === FixedPanelPosition.RIGHT);
    const topFixSize = topFix ? num(topFix.size) : 0;
    const bottomFixSize = bottomFix ? num(bottomFix.size) : 0;
    const leftFixSize = leftFix ? num(leftFix.size) : 0;
    const rightFixSize = rightFix ? num(rightFix.size) : 0;

    const frameT = schematicOuterFrameMm(config) * 0.55;
    const sashT = schematicSashMm(config) * 0.45;
    const dims = quotationElevationDims(config);

    const ox = DIM_MARGIN.left;
    const oy = DIM_MARGIN.top;
    const vbW = W + DIM_MARGIN.left + DIM_MARGIN.right;
    const vbH = H + DIM_MARGIN.top + DIM_MARGIN.bottom;

    return {
      W,
      H,
      ox,
      oy,
      vbW,
      vbH,
      frameT,
      sashT,
      dims,
      topFixSize,
      bottomFixSize,
      leftFixSize,
      rightFixSize,
      innerX: ox + leftFixSize,
      innerY: oy + topFixSize,
      innerW: Math.max(0, W - leftFixSize - rightFixSize),
      innerH: Math.max(0, H - topFixSize - bottomFixSize),
    };
  }, [config]);

  if (!model) return null;

  const {
    W,
    H,
    ox,
    oy,
    vbW,
    vbH,
    frameT,
    sashT,
    dims,
    topFixSize,
    bottomFixSize,
    leftFixSize,
    rightFixSize,
    innerX,
    innerY,
    innerW,
    innerH,
  } = model;

  const cssW = maxWidthPx;
  const cssH = (maxWidthPx * vbH) / vbW;

  const frame = miteredFrame(ox, oy, W, H, frameT);

  const panels: React.ReactNode[] = [];
  const labels: React.ReactNode[] = [];
  const handles: React.ReactNode[] = [];

  if (config.windowType === WindowType.SLIDING) {
    const glassN = slidingGlassColumnCount(config.shutterConfig);
    const colW = glassN > 0 ? innerW / glassN : innerW;
    const hasMesh = slidingHasMesh(config.shutterConfig);

    for (let i = 0; i < glassN; i++) {
      // Equal panes for quote clarity — EvA shows equal glass divisions
      const px = innerX + i * colW;
      const panelW = colW;
      const sy = innerY;
      const sh = innerH;
      const sash = miteredFrame(px + 1, sy + 1, panelW - 2, sh - 2, sashT);
      panels.push(
        <g key={`sash-${i}`}>
          <path d={sash.outer} fill={SCH.sashFill} stroke={SCH.ink} strokeWidth={SCH.sashStroke} />
          <path d={sash.inner} fill={SCH.glassFill} stroke={SCH.ink} strokeWidth={SCH.beadStroke} />
          {sash.miters.map((d, mi) => (
            <path key={mi} d={d} fill="none" stroke={SCH.ink} strokeWidth={SCH.beadStroke} />
          ))}
        </g>,
      );
      labels.push(
        <g key={`tag-${i}`}>
          <circle
            cx={px + panelW / 2}
            cy={sy + sh * 0.22}
            r={7}
            fill="#fff"
            stroke={SCH.ink}
            strokeWidth={0.7}
          />
          <text
            x={px + panelW / 2}
            y={sy + sh * 0.22 + 3}
            textAnchor="middle"
            fontSize={9}
            fontFamily={SCH.fontFamily}
            fontWeight={700}
            fill={SCH.ink}
          >
            {i + 1}
          </text>
        </g>,
      );

      const hc = config.slidingHandles?.[i];
      if (hc) {
        handles.push(
          <HandleMark
            key={`h-${i}`}
            x={px + (panelW * num(hc.x, 50)) / 100}
            y={sy + (sh * num(hc.y, 50)) / 100}
            orientation={hc.orientation}
            label={`S${i + 1}`}
          />,
        );
      }
    }

    // Mesh hatch overlays for 2G1M (right) / 4G2M (ends)
    if (hasMesh && config.shutterConfig === ShutterConfigType.TWO_GLASS_ONE_MESH) {
      const mx = innerX + colW * 0.55;
      const mw = colW * 0.45;
      panels.push(
        <g key="mesh">
          <MeshHatch x={mx} y={innerY + 2} w={mw} h={innerH - 4} patternId={hatchId} />
          <text
            x={mx + mw / 2}
            y={innerY + innerH * 0.55}
            textAnchor="middle"
            fontSize={8}
            fontFamily={SCH.fontFamily}
            fontWeight={700}
            fill={SCH.ink}
          >
            M1
          </text>
        </g>,
      );
    }
    if (hasMesh && config.shutterConfig === ShutterConfigType.FOUR_GLASS_TWO_MESH) {
      const mw = colW * 0.4;
      panels.push(
        <g key="mesh-l">
          <MeshHatch x={innerX + 2} y={innerY + 2} w={mw} h={innerH - 4} patternId={hatchId} />
          <text
            x={innerX + mw / 2}
            y={innerY + innerH * 0.55}
            textAnchor="middle"
            fontSize={7}
            fontFamily={SCH.fontFamily}
            fontWeight={700}
            fill={SCH.ink}
          >
            M1
          </text>
        </g>,
      );
      panels.push(
        <g key="mesh-r">
          <MeshHatch
            x={innerX + innerW - mw - 2}
            y={innerY + 2}
            w={mw}
            h={innerH - 4}
            patternId={hatchId}
          />
          <text
            x={innerX + innerW - mw / 2}
            y={innerY + innerH * 0.55}
            textAnchor="middle"
            fontSize={7}
            fontFamily={SCH.fontFamily}
            fontWeight={700}
            fill={SCH.ink}
          >
            M2
          </text>
        </g>,
      );
    }
  } else {
    // Casement / ventilator grid
    const vDiv = (config.verticalDividers ?? [])
      .map((d) => num(d))
      .filter((d) => d > 0 && d < 1)
      .sort((a, b) => a - b);
    const hDiv = (config.horizontalDividers ?? [])
      .map((d) => num(d))
      .filter((d) => d > 0 && d < 1)
      .sort((a, b) => a - b);

    const xCuts = [0, ...vDiv, 1];
    const yCuts = [0, ...hDiv, 1];
    const mullion = Math.max(4, frameT * 0.55);
    const rows = yCuts.length - 1;
    const cols = xCuts.length - 1;
    const grid = config.ventilatorGrid;
    const doors = config.doorPositions ?? [];

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const x0 = innerX + xCuts[c]! * innerW;
        const x1 = innerX + xCuts[c + 1]! * innerW;
        const y0 = innerY + yCuts[r]! * innerH;
        const y1 = innerY + yCuts[r + 1]! * innerH;
        const inset = mullion / 2;
        const cx = x0 + inset;
        const cy = y0 + inset;
        const cw = Math.max(0, x1 - x0 - mullion);
        const ch = Math.max(0, y1 - y0 - mullion);

        let cellType: 'glass' | 'louvers' | 'door' | 'exhaust_fan' = 'glass';
        if (config.windowType === WindowType.VENTILATOR && grid?.[r]?.[c]) {
          cellType = grid[r]![c]!.type;
        } else if (config.windowType === WindowType.CASEMENT) {
          if (doors.some((d) => d.row === r && d.col === c)) cellType = 'door';
        }

        const isDoor = cellType === 'door';
        const cellFrame = isDoor
          ? miteredFrame(cx, cy, cw, ch, sashT)
          : null;

        panels.push(
          <g key={`cell-${r}-${c}`}>
            {cellFrame ? (
              <>
                <path
                  d={cellFrame.outer}
                  fill={SCH.sashFill}
                  stroke={SCH.ink}
                  strokeWidth={SCH.sashStroke}
                />
                <path
                  d={cellFrame.inner}
                  fill={SCH.glassFill}
                  stroke={SCH.ink}
                  strokeWidth={SCH.beadStroke}
                />
                {cellFrame.miters.map((d, mi) => (
                  <path key={mi} d={d} fill="none" stroke={SCH.ink} strokeWidth={SCH.beadStroke} />
                ))}
              </>
            ) : (
              <rect
                x={cx}
                y={cy}
                width={cw}
                height={ch}
                fill={SCH.glassFill}
                stroke={SCH.ink}
                strokeWidth={SCH.beadStroke}
              />
            )}
            {cellType === 'louvers'
              ? Array.from({ length: Math.max(3, Math.floor(ch / 8)) }).map((_, i) => {
                  const ly = cy + 4 + i * 8;
                  if (ly > cy + ch - 4) return null;
                  return (
                    <line
                      key={i}
                      x1={cx + 2}
                      y1={ly}
                      x2={cx + cw - 2}
                      y2={ly}
                      stroke={SCH.ink}
                      strokeWidth={1.1}
                    />
                  );
                })
              : null}
            {cellType === 'exhaust_fan' ? (
              <ExhaustFanMark
                cx={cx + cw / 2}
                cy={cy + ch * 0.42}
                r={Math.min(cw, ch) * 0.28}
                showLabel
              />
            ) : null}
          </g>,
        );

        if (cellType !== 'exhaust_fan') {
          const tag =
            cellType === 'louvers' ? 'L' : cellType === 'door' ? 'D' : 'F';
          const idx = r * cols + c + 1;
          labels.push(
            <text
              key={`lt-${r}-${c}`}
              x={cx + cw / 2}
              y={cy + ch * 0.72}
              textAnchor="middle"
              fontSize={8}
              fontFamily={SCH.fontFamily}
              fontWeight={700}
              fill={SCH.ink}
            >
              {tag}
              {idx}
            </text>,
          );
        }

        const doorInfo = doors.find((d) => d.row === r && d.col === c);
        const ventHandle =
          config.windowType === WindowType.VENTILATOR ? grid?.[r]?.[c]?.handle : undefined;
        const hc = doorInfo?.handle ?? ventHandle;
        if (hc && (cellType === 'door' || ventHandle)) {
          handles.push(
            <HandleMark
              key={`ch-${r}-${c}`}
              x={cx + (cw * num(hc.x, 85)) / 100}
              y={cy + (ch * num(hc.y, 50)) / 100}
              orientation={hc.orientation}
            />,
          );
        }
      }
    }

    // Mullion lines (center lines between cells)
    for (const d of vDiv) {
      const mx = innerX + d * innerW;
      panels.push(
        <rect
          key={`vm-${d}`}
          x={mx - mullion / 2}
          y={innerY}
          width={mullion}
          height={innerH}
          fill={SCH.frameFill}
          stroke={SCH.ink}
          strokeWidth={SCH.sashStroke}
        />,
      );
    }
    for (const d of hDiv) {
      const my = innerY + d * innerH;
      panels.push(
        <rect
          key={`hm-${d}`}
          x={innerX}
          y={my - mullion / 2}
          width={innerW}
          height={mullion}
          fill={SCH.frameFill}
          stroke={SCH.ink}
          strokeWidth={SCH.sashStroke}
        />,
      );
    }
  }

  // Fixed lite strips (simple fill)
  if (topFixSize > 0) {
    panels.unshift(
      <rect
        key="fix-top"
        x={ox + frameT}
        y={oy + frameT}
        width={W - 2 * frameT}
        height={Math.max(0, topFixSize - frameT * 0.3)}
        fill={SCH.glassFill}
        stroke={SCH.ink}
        strokeWidth={SCH.beadStroke}
      />,
    );
  }
  if (bottomFixSize > 0) {
    panels.unshift(
      <rect
        key="fix-bot"
        x={ox + frameT}
        y={oy + H - bottomFixSize}
        width={W - 2 * frameT}
        height={Math.max(0, bottomFixSize - frameT * 0.3)}
        fill={SCH.glassFill}
        stroke={SCH.ink}
        strokeWidth={SCH.beadStroke}
      />,
    );
  }
  if (leftFixSize > 0) {
    panels.unshift(
      <rect
        key="fix-left"
        x={ox + frameT}
        y={oy + frameT + topFixSize}
        width={Math.max(0, leftFixSize - frameT * 0.3)}
        height={Math.max(0, H - topFixSize - bottomFixSize - 2 * frameT)}
        fill={SCH.glassFill}
        stroke={SCH.ink}
        strokeWidth={SCH.beadStroke}
      />,
    );
  }
  if (rightFixSize > 0) {
    panels.unshift(
      <rect
        key="fix-right"
        x={ox + W - rightFixSize}
        y={oy + frameT + topFixSize}
        width={Math.max(0, rightFixSize - frameT * 0.3)}
        height={Math.max(0, H - topFixSize - bottomFixSize - 2 * frameT)}
        fill={SCH.glassFill}
        stroke={SCH.ink}
        strokeWidth={SCH.beadStroke}
      />,
    );
  }

  // Dimension bands
  const dimNodes: React.ReactNode[] = [];
  // Overall height left
  const hx = ox - 18;
  dimNodes.push(
    <g key="dim-h">
      <path
        d={dimArrowPath(hx, oy, hx, oy + H)}
        fill="none"
        stroke={SCH.dim}
        strokeWidth={SCH.dimStroke}
      />
      <text
        x={hx - 6}
        y={oy + H / 2}
        textAnchor="middle"
        fontSize={SCH.dimFontSize}
        fontFamily={SCH.fontFamily}
        fill={SCH.dim}
        transform={`rotate(-90 ${hx - 6} ${oy + H / 2})`}
      >
        {Math.round(H)}
      </text>
    </g>,
  );

  // Overall width bottom
  const wy = oy + H + 28;
  dimNodes.push(
    <g key="dim-w">
      <path
        d={dimArrowPath(ox, wy, ox + W, wy)}
        fill="none"
        stroke={SCH.dim}
        strokeWidth={SCH.dimStroke}
      />
      <text
        x={ox + W / 2}
        y={wy + 11}
        textAnchor="middle"
        fontSize={SCH.dimFontSize}
        fontFamily={SCH.fontFamily}
        fill={SCH.dim}
      >
        {Math.round(W)}
      </text>
    </g>,
  );

  // Column segments (door sizes)
  const cols = dims.columns.filter((c) => (c.sizeMm || 0) > 0);
  if (cols.length > 1) {
    let acc = 0;
    const segY = oy + H + 12;
    cols.forEach((col, i) => {
      const x0 = ox + acc;
      const x1 = ox + acc + col.sizeMm;
      dimNodes.push(
        <g key={`dim-col-${i}`}>
          <path
            d={dimArrowPath(x0, segY, x1, segY, 2.6)}
            fill="none"
            stroke={SCH.dim}
            strokeWidth={SCH.dimStroke}
          />
          <text
            x={(x0 + x1) / 2}
            y={segY - 3}
            textAnchor="middle"
            fontSize={7.5}
            fontFamily={SCH.fontFamily}
            fill={SCH.dim}
          >
            {Math.round(col.sizeMm)}
          </text>
        </g>,
      );
      acc += col.sizeMm;
    });
  }

  // Row segments (right side for multi-row)
  const rows = dims.rows.filter((r) => (r.sizeMm || 0) > 0);
  if (rows.length > 1) {
    let acc = 0;
    const segX = ox + W + 10;
    rows.forEach((row, i) => {
      const y0 = oy + acc;
      const y1 = oy + acc + row.sizeMm;
      dimNodes.push(
        <g key={`dim-row-${i}`}>
          <path
            d={dimArrowPath(segX, y0, segX, y1, 2.6)}
            fill="none"
            stroke={SCH.dim}
            strokeWidth={SCH.dimStroke}
          />
          <text
            x={segX + 8}
            y={(y0 + y1) / 2 + 3}
            textAnchor="start"
            fontSize={7.5}
            fontFamily={SCH.fontFamily}
            fill={SCH.dim}
          >
            {Math.round(row.sizeMm)}
          </text>
        </g>,
      );
      acc += row.sizeMm;
    });
  }

  return (
    <svg
      className={`qs-elevation ${className ?? ''}`.trim()}
      width={cssW}
      height={cssH}
      viewBox={`0 0 ${vbW} ${vbH}`}
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label="Window elevation schematic"
    >
      <defs>
        <pattern id={hatchId} width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <line x1="0" y1="0" x2="0" y2="6" stroke={SCH.meshStroke} strokeWidth="0.7" />
        </pattern>
        <clipPath id={clipId}>
          <rect x={ox} y={oy} width={W} height={H} />
        </clipPath>
      </defs>
      <rect x={0} y={0} width={vbW} height={vbH} fill="#ffffff" />
      <g clipPath={`url(#${clipId})`}>
        {/* Track bands hint for sliding */}
        {config.windowType === WindowType.SLIDING ? (
          <>
            <rect
              x={ox + frameT}
              y={oy + frameT}
              width={W - 2 * frameT}
              height={Math.min(6, frameT)}
              fill="none"
              stroke={SCH.ink}
              strokeWidth={0.4}
            />
            <rect
              x={ox + frameT}
              y={oy + H - frameT - Math.min(6, frameT)}
              width={W - 2 * frameT}
              height={Math.min(6, frameT)}
              fill="none"
              stroke={SCH.ink}
              strokeWidth={0.4}
            />
          </>
        ) : null}
        {panels}
        {labels}
        {handles}
      </g>
      <path d={frame.outer} fill="none" stroke={SCH.ink} strokeWidth={SCH.outerStroke} />
      <path d={frame.inner} fill="none" stroke={SCH.ink} strokeWidth={SCH.sashStroke} />
      {frame.miters.map((d, i) => (
        <path key={`fm-${i}`} d={d} fill="none" stroke={SCH.ink} strokeWidth={SCH.beadStroke} />
      ))}
      {dimNodes}
    </svg>
  );
};
