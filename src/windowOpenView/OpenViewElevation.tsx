import React, { useId, useMemo } from 'react';
import type { OpenViewPanelSpec, OpenViewSpec, OpenViewVariant } from './types';
import { ProfileSectionInset, EnhancedProfileFrame } from './EnhancedProfileFrame';
import { WindowHandleVisual } from '../components/WindowHandleVisual';
import { hungTypeShortLabel, freeStileMidpoint, swingRoleLabel } from './doorHingeLayout';
import { DoorAbcdPanel, isAbcdSwing } from './DoorAbcdPanel';

type Props = {
  spec: OpenViewSpec;
  openAmount?: number;
  variant?: OpenViewVariant;
  maxWidthPx?: number;
  showDimensions?: boolean;
  showSectionInset?: boolean;
};

export const OpenViewElevation: React.FC<Props> = ({
  spec,
  openAmount = 1,
  variant = 'canvas',
  maxWidthPx = 420,
  showDimensions = true,
  showSectionInset = true,
}) => {
  const gid = useId();
  const scale = maxWidthPx / Math.max(spec.totalWidthMm, 1);
  const heightPx = spec.totalHeightMm * scale + (showDimensions ? 28 : 8);

  const dims = spec.config.series?.dimensions;
  const profileMm =
    spec.kind === 'sliding'
      ? Math.max(Number(dims?.shutterTop) || 0, Number(dims?.outerFrame) || 40)
      : (spec.partitionChrome?.shutterProfileMm ??
          (Number(dims?.casementShutter) || Number(dims?.outerFrame) || 40));

  const isPartition = spec.kind.startsWith('partition');

  const sortedPanels = useMemo(
    () => [...spec.panels].sort((a, b) => a.zIndex - b.zIndex),
    [spec.panels],
  );

  const partitionBays = useMemo(
    () => (isPartition ? groupPartitionBays(spec.panels) : []),
    [isPartition, spec.panels],
  );

  const bg = variant === 'print' ? '#ffffff' : '#0f172a';
  const dimColor = variant === 'print' ? '#64748b' : '#60a5fa';
  const isPrint = variant === 'print';

  return (
    <svg
      width={maxWidthPx}
      height={heightPx}
      viewBox={`0 0 ${maxWidthPx} ${heightPx}`}
      className={`wov-elevation ${variant}`}
      aria-label="Open view elevation"
    >
      <rect x={0} y={0} width={maxWidthPx} height={heightPx} fill={bg} rx={variant === 'canvas' ? 4 : 0} />

      {isPartition && spec.outerFrameMm > 0 ? (
        <EnhancedProfileFrame
          x={0}
          y={0}
          width={spec.totalWidthMm * scale}
          height={spec.totalHeightMm * scale}
          profileMm={spec.outerFrameMm}
          scale={scale}
          color={spec.profileColor}
          variant={variant}
          showGlass={false}
        />
      ) : spec.outerFrameMm > 0 ? (
        <rect
          x={0}
          y={0}
          width={spec.totalWidthMm * scale}
          height={spec.totalHeightMm * scale}
          fill="none"
          stroke={variant === 'print' ? '#374151' : spec.profileColor}
          strokeWidth={Math.max(1.5, spec.outerFrameMm * scale * 0.4)}
        />
      ) : null}

      {spec.partitionChrome?.hasTopChannel ? (
        <>
          <rect
            x={spec.innerOriginMm.x * scale}
            y={spec.outerFrameMm * scale}
            width={spec.innerWidthMm * scale}
            height={spec.partitionChrome.topTrackMm * scale}
            fill="none"
            stroke={variant === 'print' ? '#374151' : spec.profileColor}
            strokeWidth={Math.max(1, profileMm * scale * 0.3)}
          />
          {partitionBays.map(([bayId, bayPanels]) => {
            const b = bayDoorBounds(bayPanels);
            const trackH = spec.partitionChrome!.bottomTrackMm * scale;
            const trackY = (b.maxY - spec.partitionChrome!.bottomTrackMm) * scale;
            return (
              <rect
                key={`bt-${bayId}`}
                x={b.minX * scale}
                y={trackY}
                width={Math.max(1, (b.maxX - b.minX) * scale)}
                height={trackH}
                fill="none"
                stroke={variant === 'print' ? '#475569' : spec.profileColor}
                strokeWidth={Math.max(0.8, profileMm * scale * 0.25)}
                opacity={0.85}
              />
            );
          })}
        </>
      ) : null}

      <InnerOpeningFrame spec={spec} scale={scale} variant={variant} profileMm={profileMm} />

      {(spec.kind === 'casement' ||
        spec.kind === 'ventilator' ||
        openAmount < 0.05) &&
        spec.partitionChrome?.mullions.map((m, i) => (
          <rect
            key={`mullion-${i}`}
            x={m.xMm * scale}
            y={m.yMm * scale}
            width={Math.max(1, m.widthMm * scale)}
            height={m.heightMm * scale}
            fill={variant === 'print' ? '#cbd5e1' : 'rgba(100,116,139,0.55)'}
            stroke={variant === 'print' ? '#64748b' : spec.profileColor}
            strokeWidth={0.5}
          />
        ))}

      {sortedPanels.map((panel) => (
        <PanelDraw
          key={panel.id}
          panel={panel}
          spec={spec}
          scale={scale}
          profileMm={profileMm}
          variant={variant}
          gid={gid}
          openAmount={openAmount}
        />
      ))}

      {showSectionInset && !isPrint ? (
        <ProfileSectionInset x={maxWidthPx - 36} y={8} color={spec.profileColor} variant={variant} />
      ) : null}

      {showDimensions ? (
        <>
          {!isPrint ? (
            <text
              x={4}
              y={(spec.totalHeightMm * scale) / 2}
              fontSize={9}
              fill={dimColor}
              transform={`rotate(-90 4 ${(spec.totalHeightMm * scale) / 2})`}
            >
              {Math.round(spec.totalHeightMm)}
            </text>
          ) : null}
          <text
            x={(spec.totalWidthMm * scale) / 2}
            y={spec.totalHeightMm * scale + 16}
            textAnchor="middle"
            fontSize={8}
            fill={dimColor}
          >
            {Math.round(spec.totalWidthMm)}
          </text>
        </>
      ) : null}
    </svg>
  );
};

const PanelDraw: React.FC<{
  panel: OpenViewPanelSpec;
  spec: OpenViewSpec;
  scale: number;
  profileMm: number;
  variant: OpenViewVariant;
  gid: string;
  openAmount: number;
}> = ({ panel, spec, scale, profileMm, variant, gid, openAmount }) => {
  const swing = panel.doorSwing;

  if (panel.isFixed && !swing && panel.slideOffsetXMm === undefined) {
    return (
      <FixedLiteDraw
        panel={panel}
        spec={spec}
        scale={scale}
        profileMm={profileMm}
        variant={variant}
      />
    );
  }

  if (swing) {
    const mid = freeStileMidpoint(swing.corners);
    const isOpen = isAbcdSwing(swing, openAmount);
    const handlePx = (panel.xMm + mid.x) * scale;
    const handlePy = (panel.yMm + mid.y) * scale;
    return (
      <g>
        <DoorAbcdPanel
          originXMm={panel.xMm}
          originYMm={panel.yMm}
          swing={swing}
          scale={scale}
          profileMm={profileMm}
          color={spec.profileColor}
          variant={variant}
          showCornerLabels={variant === 'canvas' && isOpen}
        />
        <HandleOnPanel
          panel={panel}
          px={isOpen ? handlePx : panel.xMm * scale + (panel.widthMm * scale) / 2}
          py={isOpen ? handlePy - 12 : panel.yMm * scale + 10}
          pw={panel.widthMm * scale}
          ph={panel.heightMm * scale}
          gid={gid}
          scale={scale}
          variant={variant}
          hungLabel={swingRoleLabel(swing)}
          useFreeStile={isOpen}
        />
      </g>
    );
  }

  const slideOffset = (panel.slideOffsetXMm ?? 0) * scale;
  const px = panel.xMm * scale + slideOffset;
  const py = panel.yMm * scale;
  const pw = panel.widthMm * scale;
  const ph = panel.heightMm * scale;
  return (
    <SlidingPanelDraw panel={panel} spec={spec} px={px} py={py} pw={pw} ph={ph} profileMm={profileMm} scale={scale} variant={variant} gid={gid} />
  );
};

const HandleOnPanel: React.FC<{
  panel: OpenViewPanelSpec;
  px: number;
  py: number;
  pw: number;
  ph: number;
  gid: string;
  scale: number;
  variant: OpenViewVariant;
  hungLabel?: string;
  useFreeStile?: boolean;
}> = ({ panel, px, py, pw, ph, gid, scale, variant, hungLabel, useFreeStile }) => {
  const isPrint = variant === 'print';
  return (
  <>
    {!isPrint ? (
      <text
        x={px}
        y={py}
        textAnchor="middle"
        fontSize={7}
        fill="#cbd5e1"
        fontWeight={700}
      >
        {panel.label}
        {hungLabel ? ` · ${hungLabel}` : ''}
      </text>
    ) : null}
    {panel.handle ? (
      <foreignObject
        x={useFreeStile ? px - 20 : px}
        y={useFreeStile ? py - 40 : py}
        width={useFreeStile ? 40 : pw}
        height={useFreeStile ? 80 : ph}
        style={{ overflow: 'visible' }}
      >
        <div style={{ position: 'relative', width: '100%', height: '100%', pointerEvents: 'none' }}>
          <div
            style={{
              position: 'absolute',
              left: useFreeStile ? '50%' : `${panel.handle.x}%`,
              top: useFreeStile ? '50%' : `${panel.handle.y}%`,
              transform: 'translate(-50%, -50%)',
            }}
          >
            <WindowHandleVisual
              variant={panel.handle.variant ?? 'casement'}
              lenMm={panel.handle.length ?? 120}
              color="#8892a0"
              gid={gid}
              scale={scale * 0.9}
              print={variant === 'print'}
              mirrored={(panel.handle.x ?? 50) > 50}
            />
          </div>
        </div>
      </foreignObject>
    ) : null}
  </>
  );
};

/** Solid inner opening edge of outer frame — not a dashed guide. */
const InnerOpeningFrame: React.FC<{
  spec: OpenViewSpec;
  scale: number;
  variant: OpenViewVariant;
  profileMm: number;
}> = ({ spec, scale, variant, profileMm }) => {
  const x = spec.innerOriginMm.x * scale;
  const y = spec.innerOriginMm.y * scale;
  const w = spec.innerWidthMm * scale;
  const h = spec.innerHeightMm * scale;
  const stroke = variant === 'print' ? '#374151' : spec.profileColor;
  const outerW = Math.max(1, profileMm * scale * 0.35);
  const inset = Math.max(0.8, profileMm * scale * 0.12);
  return (
    <g>
      <rect x={x} y={y} width={w} height={h} fill="none" stroke={stroke} strokeWidth={outerW} />
      <rect
        x={x + inset}
        y={y + inset}
        width={Math.max(0, w - 2 * inset)}
        height={Math.max(0, h - 2 * inset)}
        fill="none"
        stroke={variant === 'print' ? '#6b7280' : stroke}
        strokeWidth={Math.max(0.5, outerW * 0.45)}
        opacity={0.85}
      />
    </g>
  );
};

const FixedLiteDraw: React.FC<{
  panel: OpenViewPanelSpec;
  spec: OpenViewSpec;
  scale: number;
  profileMm: number;
  variant: OpenViewVariant;
}> = ({ panel, spec, scale, profileMm, variant }) => (
  <EnhancedProfileFrame
    x={panel.xMm * scale}
    y={panel.yMm * scale}
    width={panel.widthMm * scale}
    height={panel.heightMm * scale}
    profileMm={profileMm}
    scale={scale}
    color={spec.profileColor}
    variant={variant}
    showGlass
  />
);

const SlidingPanelDraw: React.FC<{
  panel: OpenViewPanelSpec;
  spec: OpenViewSpec;
  px: number;
  py: number;
  pw: number;
  ph: number;
  profileMm: number;
  scale: number;
  variant: OpenViewVariant;
  gid: string;
}> = ({ panel, spec, px, py, pw, ph, profileMm, scale, variant, gid }) => {
  const stroke = variant === 'print' ? '#374151' : spec.profileColor;
  const inset = Math.max(2, profileMm * scale * 0.85);
  return (
    <g>
      <rect x={px} y={py} width={pw} height={ph} fill="none" stroke={stroke} strokeWidth={inset * 0.4} />
      <rect
        x={px + inset}
        y={py + inset}
        width={Math.max(0, pw - 2 * inset)}
        height={Math.max(0, ph - 2 * inset)}
        fill={variant === 'print' ? '#e2e8f0' : 'rgba(191,219,254,0.35)'}
        stroke={variant === 'print' ? '#94a3b8' : 'rgba(148,163,184,0.45)'}
        strokeWidth={0.5}
      />
      {panel.slideDirection && panel.slideDirection !== 'none' ? (
        <text x={px + pw / 2} y={py + ph / 2} textAnchor="middle" fontSize={Math.min(14, pw * 0.2)} fill={variant === 'print' ? '#1e293b' : '#e2e8f0'} opacity={0.7}>
          {panel.slideDirection === 'left' ? '←' : '→'}
        </text>
      ) : null}
      <HandleOnPanel panel={panel} px={px} py={py} pw={pw} ph={ph} gid={gid} scale={scale} variant={variant} />
    </g>
  );
};

function groupPartitionBays(panels: OpenViewPanelSpec[]): [string, OpenViewPanelSpec[]][] {
  const map = new Map<string, OpenViewPanelSpec[]>();
  for (const p of panels) {
    const bayId = p.id.replace(/-leaf-\d+$/, '');
    const list = map.get(bayId) ?? [];
    list.push(p);
    map.set(bayId, list);
  }
  return [...map.entries()];
}

/** Door footprint in mm — A,B stiles align with bay outer frame edges. */
function bayDoorBounds(panels: OpenViewPanelSpec[]): { minX: number; maxX: number; minY: number; maxY: number } {
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;

  for (const p of panels) {
    if (p.doorSwing) {
      for (const c of p.doorSwing.corners) {
        minX = Math.min(minX, p.xMm + c.x);
        maxX = Math.max(maxX, p.xMm + c.x);
        minY = Math.min(minY, p.yMm + c.y);
        maxY = Math.max(maxY, p.yMm + c.y);
      }
    } else {
      const slide = p.slideOffsetXMm ?? 0;
      minX = Math.min(minX, p.xMm + slide);
      maxX = Math.max(maxX, p.xMm + slide + p.widthMm);
      minY = Math.min(minY, p.yMm);
      maxY = Math.max(maxY, p.yMm + p.heightMm);
    }
  }

  if (!Number.isFinite(minX)) {
    const p = panels[0];
    return { minX: p.xMm, maxX: p.xMm + p.widthMm, minY: p.yMm, maxY: p.yMm + p.heightMm };
  }
  return { minX, maxX, minY, maxY };
}
