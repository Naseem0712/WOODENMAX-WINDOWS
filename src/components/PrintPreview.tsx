
import React, { useMemo, useRef, useState, useEffect, useId, useCallback } from 'react';
import type { QuotationItem, QuotationSettings, SavedColor, WindowConfig, HandleConfig, MaterialRateSettings, PartitionPanelConfig, WindowQuotationItem, WindowPackageQuotationItem, WindowPackageUnitLine } from '../types';
import { resolveProfileColorLabel } from '../utils/profileColorLabel';
import { Button } from './ui/Button';
import { PrinterIcon } from './icons/PrinterIcon';
import { XMarkIcon } from './icons/XMarkIcon';
import { FixedPanelPosition, ShutterConfigType, WindowType, MirrorShape } from '../types';
import { DownloadIcon } from './icons/DownloadIcon';
import { Input } from './ui/Input';
import { WindowHandleVisual } from './WindowHandleVisual';
import {
  slidingMemberSideStandard,
  slidingMemberSide4G2M,
  mirrorHandleForSlidingMember,
  mirrorHandleForPartitionHandleX,
} from '../utils/handleDefaults';
import { PROFILE_TEXTURE_TILE, profileTexturePosition } from '../utils/profileTexture';
import { quotationPdfFilename, printDocumentTitleForQuotation } from '../utils/pdfFilename';
import {
  PARTITION_PANEL_GAP_MM,
  resolvePartitionPanelWidthsMm,
  isOperablePartitionType,
  clampFoldLeafCount,
  getPartitionPanelTopMm,
} from '../utils/partitionPanelGeometry';
import { effectiveFourGlassMeetingMm } from '../utils/slidingGeometry';
import { getFixedPanelVerticalDivisionsMm } from '../utils/fixedPanelDivisions';
import { getElevationDimensionsMm, type ElevationSegment } from '../utils/elevationDimensions';
import { getQuotationHardwareUnitMultiplier } from '../utils/quotationHardwareCost';
import { resolveFoldFrameEdges } from '../utils/foldDoorFrame';
import { FoldDoorOpeningGraphic } from './FoldDoorOpeningVisual';
import { normalizeWebsiteUrl, parseInlineBoldSegments, boldSegmentInner, isDoubleBoldSegment, isSingleBoldSegment, splitQuotationLines, pastePlainTextIntoTextarea } from '../utils/quotationText';
import { calculateMaterialCostSummary, formatItemWeightKg } from '../utils/materialCosting';
import { DEFAULT_MATERIAL_RATES } from '../constants/materialRates';
import { computeQuotationFinancials, quotationItemLineTotal } from '../utils/quotationTotals';
import {
  captureQuotationPdf,
  openPdfBlobPrintDialog,
  preloadHtml2Pdf,
  saveQuotationPdf,
  stampWoodenMaxPageNumbers,
} from '../utils/quotationPdfCapture';
import { getWindowQuotationAreaMm2 } from '../utils/louverBays';
import { isWindowQuotationItem } from '../utils/quotationItemKinds';
import {
  expandPackageToWindowItems,
  isWindowPackageQuotationItem,
  packageCombinedArea,
  packageCombinedSubtitle,
  packageLayoutRowLabel,
} from '../utils/windowPackageQuotation';
import { RailingQuotationLinePrintBlock } from '../railing/components/RailingQuotationLinePrintBlock';
import '../railing/quotation-print-embed.css';
import { OpenViewPrintBlock } from '../windowOpenView/OpenViewPrintBlock';
import { getOpenViewPrintConfigs } from '../windowOpenView/supportsOpenView';
import { ArchHeadLayer } from './casement/ArchHeadLayer';
import { OpeningShapedFrame, OpeningShapedFrameOutlines } from './casement/OpeningShapedFrame';
import { InterlockButtJointLines, MiteredProfileOutlines, MullionJointLines, OpeningInnerOutlineSegments, SlidingTrackOuterOutline } from './profile/ProfileJointLines';
import { archSpringYMmForOpening, isArchTopOutline } from '../utils/casementOutlineGeometry';
import {
  casementCellHideInnerEdges,
  casementDoorVisualBounds,
  casementOpeningInnerLineHideRanges,
  gridMullionJointLineProps,
  isHSegHidden,
  isVSegHidden,
  resolveHiddenMullionSegments,
} from '../utils/casementGridMullions';
import {
  PROFILE_VISUAL_OVERLAP_MM,
  SLIDING_TRACK_BLEED,
  resolveProfileBleed,
  slidingInterlockJointVisible,
  type HideInnerEdges,
} from '../constants/profileVisual';

function profileOverlayTexture(config: WindowConfig): string | undefined {
  return config.profileColor.startsWith('#') ? config.profileTexture || undefined : undefined;
}

interface PrintPreviewProps {
  isOpen: boolean;
  onClose: () => void;
  items: QuotationItem[];
  settings: QuotationSettings;
  setSettings: (settings: QuotationSettings) => void;
  savedColors?: SavedColor[];
}

function loadSavedColorsFromStorage(): SavedColor[] {
  try {
    const raw = window.localStorage.getItem('aluminium-window-colors');
    return raw ? (JSON.parse(raw) as SavedColor[]) : [];
  } catch {
    return [];
  }
}

const mmToPx = (mm: number, scale: number) => Math.round(mm * scale * 100) / 100;

/** Bottom/top track band height in mm (matches WindowCanvas sliding track overlay). */
function slidingTrackBandMm(topTrackDim: number): number {
  return Math.max(8, Math.min(16, (Number(topTrackDim) || 0) * 0.18));
}

/** True lock hardware for quotation (excludes interlock connector/cap profiles). */
function isQuotationLockHardware(name: string): boolean {
  const n = (name || '').toLowerCase();
  if (!n.includes('lock')) return false;
  if (n.includes('interlock')) return false;
  return true;
}

function isShutterElevationColumn(col: ElevationSegment): boolean {
  return col.label === 'S' || col.label === 'M';
}

const numWords = {
    a: ['', 'one ', 'two ', 'three ', 'four ', 'five ', 'six ', 'seven ', 'eight ', 'nine ', 'ten ', 'eleven ', 'twelve ', 'thirteen ', 'fourteen ', 'fifteen ', 'sixteen ', 'seventeen ', 'eighteen ', 'nineteen '],
    b: ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety']
};

function numberToWords(numStr: string): string {
    if (numStr === '0') return '';
    const num = parseInt(numStr, 10);
    if (num > 99) return 'overflow';
    if (num < 20) return numWords.a[num];
    const digit1 = Math.floor(num / 10);
    const digit2 = num % 10;
    return numWords.b[digit1] + numWords.a[digit2];
}

function amountToWords(amount: number): string {
    const num = Math.round(amount);
    if (num === 0) return 'Rupees Zero Only';
    const numStr = num.toString();
    if (numStr.length > 9) return 'Amount too large';

    const crore = numStr.slice(0, -7);
    const lakh = numStr.slice(-7, -5);
    const thousand = numStr.slice(-5, -3);
    const hundred = numStr.slice(-3, -2);
    const rest = numStr.slice(-2);

    let result = '';
    if (crore) result += numberToWords(crore) + 'Crore ';
    if (lakh) result += numberToWords(lakh) + 'Lakh ';
    if (thousand) result += numberToWords(thousand) + 'Thousand ';
    if (hundred && hundred !== '0') result += numberToWords(hundred) + 'Hundred ';
    if (rest) result += (result && rest !== '00' ? 'and ' : '') + numberToWords(rest);

    return `Rupees ${result.trim().charAt(0).toUpperCase() + result.trim().slice(1)} Only`;
}


const PrintDimensionLabel: React.FC<{ value: number; unit?: string, className?: string, style?: React.CSSProperties }> = ({ value, unit = "mm", className, style }) => (
    <span className={`absolute bg-white bg-opacity-80 text-black text-[6pt] font-mono px-1 py-0 rounded z-20 ${className}`} style={{transform: 'translate(var(--tw-translate-x, 0), var(--tw-translate-y, 0)) rotate(var(--tw-rotate, 0)) skewX(var(--tw-skew-x, 0)) skewY(var(--tw-skew-y, 0)) scaleX(var(--tw-scale-x, 1)) scaleY(var(--tw-scale-y, 1))', ...style} as React.CSSProperties}>
        {value.toFixed(0)}{unit}
    </span>
);

const PRINT_SHUTTER_LETTER: Record<'fixed' | 'sliding' | 'hinged' | 'fold' | 'door' | 'louvers' | 'exhaust_fan', string> = {
    fixed: 'F',
    sliding: 'S',
    hinged: 'H',
    fold: 'B',
    door: 'D',
    louvers: 'L',
    exhaust_fan: 'E',
};

const PrintShutterIndicator: React.FC<{
  type: 'fixed' | 'sliding' | 'hinged' | 'fold' | 'door' | 'louvers' | 'exhaust_fan';
  width?: number;
  height?: number;
  foldLeaves?: number;
}> = ({ type, width, height, foldLeaves }) => {
    if (!type) return null;

    const containerSize = Math.min(width || 100, height || 100);
    const baseFontSizePt = 10;
    const scaleFactor = Math.min(1, containerSize / 50);
    const fontSize = baseFontSizePt * scaleFactor;
    const finalFontSize = Math.max(fontSize, 5);

    let text = PRINT_SHUTTER_LETTER[type];
    if (type === 'fold') {
      const n = clampFoldLeafCount(foldLeaves);
      text = n > 1 ? `${PRINT_SHUTTER_LETTER.fold}×${n}` : PRINT_SHUTTER_LETTER.fold;
    }

    const style: React.CSSProperties = {
        fontSize: `${finalFontSize}pt`,
        lineHeight: 1,
    };

    const baseStyle = "absolute inset-0 z-[12] flex items-center justify-center text-black font-bold tracking-wide pointer-events-none opacity-90 p-1 text-center";

    return <div className={baseStyle} style={style}>{text}</div>;
};

const PrintProfilePiece: React.FC<{ style: React.CSSProperties; color: string; texture?: string }> = ({ style, color, texture }) => {
    const isLegacyTextureOnly = Boolean(color && !color.startsWith('#'));
    const texPos = profileTexturePosition(style);

    if (isLegacyTextureOnly) {
        return (
            <div
                style={{
                    position: 'absolute',
                    boxSizing: 'border-box',
                    ...style,
                    backgroundImage: `url(${color})`,
                    backgroundRepeat: 'repeat',
                    backgroundSize: PROFILE_TEXTURE_TILE,
                    backgroundPosition: texPos,
                }}
            />
        );
    }

    const baseColor = color.startsWith('#') ? color : '#8b939e';
    return (
        <div style={{ position: 'absolute', boxSizing: 'border-box', ...style, backgroundColor: baseColor, overflow: 'hidden' }}>
            {texture ? (
                <div
                    style={{
                        position: 'absolute',
                        inset: 0,
                        backgroundImage: `url(${texture})`,
                        backgroundRepeat: 'repeat',
                        backgroundSize: PROFILE_TEXTURE_TILE,
                        backgroundPosition: texPos,
                        mixBlendMode: 'multiply',
                        opacity: 0.82,
                        pointerEvents: 'none',
                    }}
                />
            ) : null}
        </div>
    );
};

const PrintGlassGrid: React.FC<{
    config: WindowConfig;
    panelId: string;
    width: number;
    height: number;
    scale: number;
}> = ({ config, panelId, width, height, scale }) => {
    const { glassGrid, legacyGlassGrid, series } = config;
    const profileColor = config.profileColor;

    // New "patterns" format
    if (glassGrid && glassGrid.patterns) {
        const { barThickness, applyToAll, patterns } = glassGrid;
        if (barThickness <= 0) return null;

        const pattern = (applyToAll || !patterns[panelId]) ? patterns['default'] : patterns[panelId];
        if (!pattern || (pattern.horizontal.count === 0 && pattern.vertical.count === 0)) return null;

        const elements: React.ReactNode[] = [];
        const barThicknessScaled = barThickness * scale;
        const skipVerticalOnSlidingTransomSill =
          config.windowType === WindowType.SLIDING &&
          (panelId === 'fixed-top' || panelId === 'fixed-bottom');

        // Horizontal bars
        for (let i = 0; i < pattern.horizontal.count; i++) {
            const top = (pattern.horizontal.offset + i * pattern.horizontal.gap) * scale - barThicknessScaled / 2;
            if (top > height * scale || top < -barThicknessScaled) continue;
            elements.push(<PrintProfilePiece key={`h-grid-${i}`} color={profileColor} texture={profileOverlayTexture(config)} style={{ top, left: 0, width: width * scale, height: barThicknessScaled }} />);
        }

        // Vertical bars
        const vCount = skipVerticalOnSlidingTransomSill ? 0 : pattern.vertical.count;
        for (let i = 0; i < vCount; i++) {
            const left = (pattern.vertical.offset + i * pattern.vertical.gap) * scale - barThicknessScaled / 2;
            if (left > width * scale || left < -barThicknessScaled) continue;
            elements.push(<PrintProfilePiece key={`v-grid-${i}`} color={profileColor} texture={profileOverlayTexture(config)} style={{ left, top: 0, width: barThicknessScaled, height: height * scale }} />);
        }

        return <>{elements}</>;
    }
    
    // Legacy "rows/cols" format
    const oldGridData = legacyGlassGrid || (glassGrid as any);
    if (oldGridData && typeof oldGridData.rows !== 'undefined') {
        const rows = Number(oldGridData.rows) || 0;
        const cols = Number(oldGridData.cols) || 0;
        const barThickness = Number(series.dimensions.glassGridProfile) || 15;

        if (barThickness <= 0 || (rows === 0 && cols === 0)) return null;

        const elements: React.ReactNode[] = [];
        const barThicknessScaled = barThickness * scale;

        if (rows > 0) {
            const vGap = (height * scale) / (rows + 1);
            for (let i = 1; i <= rows; i++) {
                elements.push(<PrintProfilePiece key={`h-grid-${i}`} color={profileColor} texture={profileOverlayTexture(config)} style={{ top: i * vGap - barThicknessScaled / 2, left: 0, width: width * scale, height: barThicknessScaled }} />);
            }
        }
        const skipLegacyCols =
          config.windowType === WindowType.SLIDING &&
          (panelId === 'fixed-top' || panelId === 'fixed-bottom');
        if (cols > 0 && !skipLegacyCols) {
            const hGap = (width * scale) / (cols + 1);
            for (let i = 1; i <= cols; i++) {
                elements.push(<PrintProfilePiece key={`v-grid-${i}`} color={profileColor} texture={profileOverlayTexture(config)} style={{ left: i * hGap - barThicknessScaled / 2, top: 0, width: barThicknessScaled, height: height * scale }} />);
            }
        }
        return <>{elements}</>;
    }

    return null;
};


/** z-order inside door/shutter cells — profile fill + CAD lines always above glass. */
const DOOR_CELL_Z = { glass: 0, frameFill: 4, frameLines: 8, swingHint: 3, pickOverlay: 45 } as const;

const PrintableMiteredFrame: React.FC<{
    width: number;
    height: number;
    profileSize?: number;
    topSize?: number;
    bottomSize?: number;
    leftSize?: number;
    rightSize?: number;
    scale: number;
    color: string;
    texture?: string;
    hideInnerEdges?: HideInnerEdges;
    buttEdges?: HideInnerEdges;
    showInner?: boolean;
    showOutlines?: boolean;
}> = ({ width, height, profileSize = 0, topSize, bottomSize, leftSize, rightSize, scale, color, texture, hideInnerEdges, buttEdges, showInner = true, showOutlines = true }) => {
    const ts = mmToPx(topSize ?? profileSize, scale);
    const bs = mmToPx(bottomSize ?? profileSize, scale);
    const ls = mmToPx(leftSize ?? profileSize, scale);
    const rs = mmToPx(rightSize ?? profileSize, scale);
    const wPx = mmToPx(width, scale);
    const hPx = mmToPx(height, scale);
    const isLegacyTexture = Boolean(color && !color.startsWith('#'));
    const baseHex = color.startsWith('#') ? color : '#8b939e';
    const hexWithOverlay = !isLegacyTexture && Boolean(texture) && color.startsWith('#');

    const tileBase: React.CSSProperties = {
        backgroundSize: PROFILE_TEXTURE_TILE,
        backgroundRepeat: 'repeat',
    };

    const clipTs = Math.max(0, ts);
    const clipBs = Math.max(0, bs);
    const clipLs = Math.max(0, ls);
    const clipRs = Math.max(0, rs);

    const clipTop = `polygon(0 0, 100% 0, calc(100% - ${clipRs}px) 100%, ${clipLs}px 100%)`;
    const clipBottom = `polygon(${clipLs}px 0, calc(100% - ${clipRs}px) 0, 100% 100%, 0 100%)`;
    const clipLeft = `polygon(0 0, 100% ${clipTs}px, 100% calc(100% - ${clipBs}px), 0 100%)`;
    const clipRight = `polygon(0 ${clipTs}px, 100% 0, 100% 100%, 0 calc(100% - ${clipBs}px))`;

    if (isLegacyTexture) {
        const backgroundStyle = { backgroundImage: `url(${color})`, backgroundRepeat: 'repeat' as const };
        const baseDivStyle: React.CSSProperties = {
            position: 'absolute',
            boxSizing: 'border-box',
            ...backgroundStyle,
        };
        const posTop = '0px 0px';
        const posBottom = `0px ${-(hPx - clipBs)}px`;
        const posLeft = '0px 0px';
        const posRight = `-${wPx - clipRs}px 0px`;

        return (
            <div className="absolute" style={{ width: wPx, height: hPx, borderRadius: 0 }}>
                <div style={{ ...baseDivStyle, ...tileBase, backgroundPosition: posTop, top: 0, left: 0, width: '100%', height: clipTs, zIndex: 1, clipPath: clipTop }} />
                <div style={{ ...baseDivStyle, ...tileBase, backgroundPosition: posBottom, bottom: 0, left: 0, width: '100%', height: clipBs, zIndex: 1, clipPath: clipBottom }} />
                <div style={{ ...baseDivStyle, ...tileBase, backgroundPosition: posLeft, top: 0, left: 0, width: clipLs, height: '100%', zIndex: 2, clipPath: clipLeft }} />
                <div style={{ ...baseDivStyle, ...tileBase, backgroundPosition: posRight, top: 0, right: 0, width: clipRs, height: '100%', zIndex: 2, clipPath: clipRight }} />
                {showOutlines ? (
                  <MiteredProfileOutlines widthPx={wPx} heightPx={hPx} topPx={clipTs} bottomPx={clipBs} leftPx={clipLs} rightPx={clipRs} variant="print" hideInnerEdges={hideInnerEdges} buttEdges={buttEdges} showInner={showInner} showOuter showMiterCorners />
                ) : null}
            </div>
        );
    }

    if (hexWithOverlay) {
        const solidBase: React.CSSProperties = {
            position: 'absolute',
            boxSizing: 'border-box',
            backgroundColor: baseHex,
        };
        const texOverlay: React.CSSProperties = {
            position: 'absolute',
            boxSizing: 'border-box',
            backgroundImage: `url(${texture})`,
            backgroundRepeat: 'repeat',
            backgroundSize: PROFILE_TEXTURE_TILE,
            mixBlendMode: 'multiply',
            opacity: 0.82,
        };

        const posTop = '0px 0px';
        const posBottom = `0px ${-(hPx - clipBs)}px`;
        const posLeft = '0px 0px';
        const posRight = `-${wPx - clipRs}px 0px`;

        return (
            <div className="absolute" style={{ width: wPx, height: hPx, borderRadius: 0 }}>
                <div style={{ ...solidBase, top: 0, left: 0, width: '100%', height: clipTs, zIndex: 1, clipPath: clipTop }} />
                <div style={{ ...texOverlay, backgroundPosition: posTop, top: 0, left: 0, width: '100%', height: clipTs, zIndex: 3, clipPath: clipTop }} />
                <div style={{ ...solidBase, bottom: 0, left: 0, width: '100%', height: clipBs, zIndex: 1, clipPath: clipBottom }} />
                <div style={{ ...texOverlay, backgroundPosition: posBottom, bottom: 0, left: 0, width: '100%', height: clipBs, zIndex: 3, clipPath: clipBottom }} />
                <div style={{ ...solidBase, top: 0, left: 0, width: clipLs, height: '100%', zIndex: 2, clipPath: clipLeft }} />
                <div style={{ ...texOverlay, backgroundPosition: posLeft, top: 0, left: 0, width: clipLs, height: '100%', zIndex: 4, clipPath: clipLeft }} />
                <div style={{ ...solidBase, top: 0, right: 0, width: clipRs, height: '100%', zIndex: 2, clipPath: clipRight }} />
                <div style={{ ...texOverlay, backgroundPosition: posRight, top: 0, right: 0, width: clipRs, height: '100%', zIndex: 4, clipPath: clipRight }} />
                {showOutlines ? (
                  <MiteredProfileOutlines widthPx={wPx} heightPx={hPx} topPx={clipTs} bottomPx={clipBs} leftPx={clipLs} rightPx={clipRs} variant="print" hideInnerEdges={hideInnerEdges} buttEdges={buttEdges} showInner={showInner} showOuter showMiterCorners />
                ) : null}
            </div>
        );
    }

    const solidBase: React.CSSProperties = {
        position: 'absolute',
        boxSizing: 'border-box',
        backgroundColor: baseHex,
    };

    return (
        <div className="absolute" style={{ width: wPx, height: hPx, borderRadius: 0 }}>
            <div style={{ ...solidBase, top: 0, left: 0, width: '100%', height: clipTs, zIndex: 1, clipPath: clipTop }} />
            <div style={{ ...solidBase, bottom: 0, left: 0, width: '100%', height: clipBs, zIndex: 1, clipPath: clipBottom }} />
            <div style={{ ...solidBase, top: 0, left: 0, width: clipLs, height: '100%', zIndex: 2, clipPath: clipLeft }} />
            <div style={{ ...solidBase, top: 0, right: 0, width: clipRs, height: '100%', zIndex: 2, clipPath: clipRight }} />
            {showOutlines ? (
              <MiteredProfileOutlines widthPx={wPx} heightPx={hPx} topPx={clipTs} bottomPx={clipBs} leftPx={clipLs} rightPx={clipRs} variant="print" hideInnerEdges={hideInnerEdges} buttEdges={buttEdges} showInner={showInner} showOuter showMiterCorners />
            ) : null}
        </div>
    );
};

const PrintableHandle: React.FC<{ config: HandleConfig | null; scale: number; mirrored?: boolean }> = ({ config, scale, mirrored }) => {
    const gid = useId().replace(/:/g, '');
    if (!config) return null;
    const variant = config.variant ?? (config.orientation === 'horizontal' ? 'sliding' : 'casement');
    const raw =
        config.length ??
        (variant === 'sliding' ? 125 : variant === 'mesh_touch' ? 72 : 172);
    const lenMm =
        variant === 'mesh_touch'
            ? Math.min(115, Math.max(46, raw))
            : Math.min(420, Math.max(variant === 'sliding' ? 72 : 100, raw));
    return <WindowHandleVisual variant={variant} lenMm={lenMm} color="#8892a0" gid={gid} scale={scale} print mirrored={mirrored} />;
};

const PrintableMirrorPanel: React.FC<{ style: React.CSSProperties }> = ({ style }) => {
    const mirrorStyle: React.CSSProperties = {
        ...style,
        backgroundColor: '#D1D5DB', // A light grey for print
        border: '0.5px solid #999',
    };
    return <div style={mirrorStyle} />;
};


/** Fixed print slots (mm) — elevation square + size chart + plan/CAD band. */
const PRINT_ELEVATION_SLOT_MM = 52;
const PRINT_PX_PER_MM = 96 / 25.4;

/** Pixels per layout mm so elevation fills the square slot (PrintableWindow uses px/mm scale). */
function fitScalePxPerMm(widthMm: number, heightMm: number, slotMm: number): number {
  const w = Math.max(widthMm, 1);
  const h = Math.max(heightMm, 1);
  const slotPx = slotMm * PRINT_PX_PER_MM;
  return Math.min(slotPx / w, slotPx / h);
}

const PrintElevationSlot: React.FC<{
  widthMm: number;
  heightMm: number;
  photo?: string;
  children: React.ReactNode;
}> = ({ widthMm, heightMm, photo, children }) => {
  const w = Math.max(widthMm, 1);
  const h = Math.max(heightMm, 1);
  const scale = fitScalePxPerMm(w, h, PRINT_ELEVATION_SLOT_MM);
  return (
    <div className="print-slot-elevation">
      {photo ? (
        <img src={photo} alt="Print elevation" className="print-slot-elevation-photo" />
      ) : (
        <div
          className="print-slot-elevation-inner"
          style={{ width: mmToPx(w, scale), height: mmToPx(h, scale) }}
        >
          {children}
        </div>
      )}
    </div>
  );
};

const PrintWindowSizeChart: React.FC<{ config: WindowConfig }> = ({ config }) => {
  const w = Number(config.width) || 0;
  const h = Number(config.height) || 0;
  const { columns, rows } = getElevationDimensionsMm(config);
  const widthSegs = columns
    .filter((c) => (c.sizeMm || 0) > 0)
    .map((c) => Math.round(c.sizeMm || 0));
  const heightSegs = rows
    .filter((r) => (r.sizeMm || 0) > 0)
    .map((r) => Math.round(r.sizeMm || 0));
  const shutterWidths = columns
    .filter(isShutterElevationColumn)
    .map((c) => Math.round(c.sizeMm || 0));

  return (
    <div className="print-size-chart">
      <p className="print-size-chart-title">Sizes (mm)</p>
      <table>
        <tbody>
          <tr>
            <td>Overall</td>
            <td>{w} × {h}</td>
          </tr>
          {widthSegs.length > 1 ? (
            <tr>
              <td>Width</td>
              <td>{widthSegs.join(' + ')}</td>
            </tr>
          ) : null}
          {heightSegs.length > 1 ? (
            <tr>
              <td>Height</td>
              <td>{heightSegs.join(' + ')}</td>
            </tr>
          ) : null}
          {shutterWidths.length > 0 ? (
            <tr>
              <td>Door / shutter</td>
              <td>{shutterWidths.join(', ')}</td>
            </tr>
          ) : null}
        </tbody>
      </table>
    </div>
  );
};

const PrintPackageSizeChart: React.FC<{ item: WindowPackageQuotationItem }> = ({ item }) => (
  <div className="print-size-chart">
    <p className="print-size-chart-title">Sizes (mm)</p>
    <table>
      <tbody>
        {item.units.map((u) => (
          <tr key={u.id}>
            <td>{u.title}</td>
            <td>{u.config.width} × {u.config.height}</td>
          </tr>
        ))}
        <tr>
          <td>{packageLayoutRowLabel(item)}</td>
          <td>{Math.round(item.layoutWidthMm)} × {Math.round(item.layoutHeightMm)}</td>
        </tr>
      </tbody>
    </table>
  </div>
);

const PrintVisualStack: React.FC<{
  elevation: React.ReactNode;
  sizeChart?: React.ReactNode;
  secondary?: React.ReactNode;
  footer?: React.ReactNode;
}> = ({ elevation, sizeChart, secondary, footer }) => (
  <div className="print-visual-stack">
    {elevation}
    {sizeChart ? <div className="print-slot-size-chart">{sizeChart}</div> : null}
    {secondary ? <div className="print-slot-secondary">{secondary}</div> : null}
    {footer}
  </div>
);

const PrintableLayoutPackage: React.FC<{ item: WindowPackageQuotationItem; fitSlotMm?: number }> = ({
  item,
  fitSlotMm,
}) => {
  const scale = fitSlotMm
    ? fitScalePxPerMm(item.layoutWidthMm, item.layoutHeightMm, fitSlotMm)
    : 220 / Math.max(item.layoutWidthMm, 1);
  return (
    <div
      className="relative"
      style={{
        width: mmToPx(item.layoutWidthMm, scale),
        height: mmToPx(item.layoutHeightMm, scale),
        margin: 'auto',
      }}
    >
      {item.units.map((u) => (
        <div
          key={u.id}
          style={{
            position: 'absolute',
            left: mmToPx(u.xMm - item.layoutMinXMm, scale),
            top: mmToPx(u.yMm - item.layoutMinYMm, scale),
          }}
        >
          <PrintableWindow config={u.config} externalScale={scale} printCompact />
        </div>
      ))}
    </div>
  );
};

function unitLineAmount(
  unit: WindowPackageUnitLine,
  areaType: WindowPackageQuotationItem['areaType'],
  quantity: number,
): number {
  const cf = areaType === 'sqmt' ? 1000 : 304.8;
  const area = (getWindowQuotationAreaMm2(unit.config) / (cf * cf)) * quantity;
  return area * unit.rate + unit.hardwareCost * quantity;
}

function unitArea(
  unit: WindowPackageUnitLine,
  areaType: WindowPackageQuotationItem['areaType'],
  quantity: number,
): number {
  const cf = areaType === 'sqmt' ? 1000 : 304.8;
  return (getWindowQuotationAreaMm2(unit.config) / (cf * cf)) * quantity;
}

function formatWindowTypeLabel(wt: WindowType): string {
  return wt.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

const PrintOpenViewsSecondary: React.FC<{
  configs: WindowConfig[];
  openAmount: number;
  swingSide: 'inside' | 'outside';
}> = ({ configs, openAmount, swingSide }) => {
  const openConfigs = configs.flatMap((cfg) => getOpenViewPrintConfigs(cfg));
  if (openConfigs.length === 0) return null;
  return (
    <div className="print-slot-secondary-grid">
      {openConfigs.map((cfg, idx) => (
        <OpenViewPrintBlock
          key={`plan-${idx}`}
          config={cfg}
          openAmount={openAmount}
          swingSide={swingSide}
          compact
        />
      ))}
    </div>
  );
};

const PrintableWindow: React.FC<{
  config: WindowConfig;
  externalScale?: number;
  weightKg?: number;
  printCompact?: boolean;
}> = ({
  config,
  externalScale,
  weightKg,
  printCompact = false,
}) => {
    if (config.windowType === WindowType.CORNER && config.leftConfig && config.rightConfig) {
        const leftW = Number(config.leftWidth) || 0;
        const rightW = Number(config.rightWidth) || 0;
        const postW = Number(config.cornerPostWidth) || 0;
        const numHeight = Number(config.height) || 1;
        const totalW = leftW + rightW + postW;
        
        const containerWidthPx = 200;
        const scale = externalScale || containerWidthPx / totalW;

        const cornerConfigLeft: WindowConfig = { ...config, ...config.leftConfig, width: leftW, height: numHeight, windowType: config.leftConfig.windowType, fixedPanels: [] };
        const cornerConfigRight: WindowConfig = { ...config, ...config.rightConfig, width: rightW, height: numHeight, windowType: config.rightConfig.windowType, fixedPanels: [] };

        return (
            <div className="flex items-start" style={{ width: totalW * scale, height: numHeight * scale, margin: 'auto' }}>
                <PrintableWindow config={cornerConfigLeft} externalScale={scale} />
                <div className="relative" style={{ width: postW * scale, height: numHeight * scale }}>
                    <PrintProfilePiece color={config.profileColor} texture={profileOverlayTexture(config)} style={{ left: 0, top: 0, width: '100%', height: '100%' }} />
                </div>
                <PrintableWindow config={cornerConfigRight} externalScale={scale} />
            </div>
        );
    }

    // Leaves headroom for the dimension bands rendered below + to the right
    // of the elevation (per-shutter / per-fix mm callouts).
    const containerWidthPx = 130;
    const containerHeightPx = 180;
    const numWidth = Number(config.width) || 1;
    const numHeight = Number(config.height) || 1;
    
    const effectiveWidth = numWidth;
    const scale = externalScale || Math.min(containerWidthPx / effectiveWidth, containerHeightPx / numHeight);

    const series = config.series;
    if (!series || !series.dimensions) {
        return <div style={{ padding: 16, color: '#b91c1c', fontSize: 12 }}>Series data missing for this line — please re-open the item to refresh.</div>;
    }
    const fixedPanels = config.fixedPanels ?? [];
    const profileColor = config.profileColor ?? '#374151';
    const windowType = config.windowType;
    const glassTexture = config.glassTexture;
    const seriesDims: any = series.dimensions ?? {};
    const pt = profileOverlayTexture(config);
    const dims = {
        outerFrame: Number(seriesDims.outerFrame) || 0,
        outerFrameVertical: Number(seriesDims.outerFrameVertical) || 0,
        fixedFrame: Number(seriesDims.fixedFrame) || 0,
        shutterHandle: Number(seriesDims.shutterHandle) || 0, shutterInterlock: Number(seriesDims.shutterInterlock) || 0,
        shutterTop: Number(seriesDims.shutterTop) || 0, shutterBottom: Number(seriesDims.shutterBottom) || 0,
        shutterMeeting: Number(seriesDims.shutterMeeting) || 0, casementShutter: Number(seriesDims.casementShutter) || 0,
        mullion: Number(seriesDims.mullion) || 0, louverBlade: Number(seriesDims.louverBlade) || 0,
        topTrack: Number(seriesDims.topTrack) || 0, bottomTrack: Number(seriesDims.bottomTrack) || 0,
        glassGridProfile: Number(config.glassGrid?.barThickness) || Number(seriesDims.glassGridProfile) || 0,
    };

    const glassStyle = { backgroundColor: '#E2E8F0', boxSizing: 'border-box' as const };

    const topFix = fixedPanels.find(p => p.position === FixedPanelPosition.TOP);
    const bottomFix = fixedPanels.find(p => p.position === FixedPanelPosition.BOTTOM);
    const leftFix = fixedPanels.find(p => p.position === FixedPanelPosition.LEFT);
    const rightFix = fixedPanels.find(p => p.position === FixedPanelPosition.RIGHT);

    const topFixSize = topFix ? topFix.size : 0;
    const bottomFixSize = bottomFix ? bottomFix.size : 0;
    const leftFixSize = leftFix ? leftFix.size : 0;
    const rightFixSize = rightFix ? rightFix.size : 0;
      
    const profileElements: React.ReactNode[] = [];
    const glassElements: React.ReactNode[] = [];
    const labelElements: React.ReactNode[] = [];
    const handleElements: React.ReactNode[] = [];

    const GlassPanel: React.FC<{style: React.CSSProperties, children?: React.ReactNode, glassWidthPx: number, glassHeightPx: number, panelId: string}> = ({ style, children, glassWidthPx, glassHeightPx, panelId }) => {
      const panelStyle: React.CSSProperties = { ...glassStyle, ...style };

      const isMesh = style.backgroundImage && style.backgroundImage.includes('linear-gradient');
    
      if (glassTexture && !isMesh) {
          panelStyle.backgroundImage = `url(${glassTexture})`;
          panelStyle.backgroundSize = 'cover';
          panelStyle.backgroundPosition = 'center';
          delete panelStyle.backgroundColor;
      }
      
      const childrenWithProps = React.Children.map(children, child => {
        if (React.isValidElement(child) && child.type === PrintShutterIndicator) {
            return React.cloneElement(child as React.ReactElement<any>, { width: glassWidthPx, height: glassHeightPx });
        }
        return child;
      });

      return (
        <div className="absolute overflow-hidden" style={panelStyle}>
            <PrintGlassGrid config={config} panelId={panelId} width={glassWidthPx / scale} height={glassHeightPx / scale} scale={scale} />
            {childrenWithProps}
        </div> 
      );
    }
    
    const frameOffset = (windowType !== WindowType.GLASS_PARTITION && windowType !== WindowType.CORNER && windowType !== WindowType.MIRROR && windowType !== WindowType.LOUVERS) ? dims.outerFrame : 0;
    const holeX1 = leftFix ? leftFixSize : frameOffset;
    const holeY1 = topFix ? topFixSize : frameOffset;
    const holeX2 = rightFix ? numWidth - rightFixSize : numWidth - frameOffset;
    const holeY2 = bottomFix ? numHeight - bottomFixSize : numHeight - frameOffset;
    const innerAreaWidth = holeX2 - holeX1;
    const innerAreaHeight = holeY2 - holeY1;
    const archTop = isArchTopOutline(config);
    const archSpringYmm = archTop ? archSpringYMmForOpening(config, innerAreaWidth, innerAreaHeight) : 0;
    const shapedOuterFrame =
      (windowType === WindowType.CASEMENT || windowType === WindowType.VENTILATOR) && archTop;
    const casementGridHideRanges =
      windowType === WindowType.CASEMENT || windowType === WindowType.VENTILATOR
        ? (() => {
            const vDivs = config.verticalDividers ?? [];
            const hDivs = config.horizontalDividers ?? [];
            const springRel = archSpringYmm / Math.max(innerAreaHeight, 1);
            const effectiveHDivs =
              archTop && hDivs.length > 0 ? [springRel, ...hDivs.slice(1)] : hDivs;
            return casementOpeningInnerLineHideRanges(
              config,
              windowType,
              effectiveHDivs.length + 1,
              vDivs.length + 1,
              resolveHiddenMullionSegments(config),
              innerAreaWidth,
              innerAreaHeight,
              vDivs,
              effectiveHDivs,
              dims.mullion,
            );
          })()
        : undefined;
    const shapedOutlineHideRanges = shapedOuterFrame ? casementGridHideRanges : undefined;
    const suppressCasementOpeningInner =
      windowType === WindowType.CASEMENT || windowType === WindowType.VENTILATOR;
    const openingProfileOverlap =
      windowType === WindowType.CASEMENT ||
      windowType === WindowType.VENTILATOR ||
      windowType === WindowType.SLIDING ||
      windowType === WindowType.GLASS_PARTITION;

    // Outer frame (shaped arch uses OpeningShapedFrame instead)
    if (windowType !== WindowType.GLASS_PARTITION && windowType !== WindowType.CORNER && windowType !== WindowType.MIRROR && windowType !== WindowType.LOUVERS) {
        const verticalFrame = dims.outerFrameVertical > 0 ? dims.outerFrameVertical : dims.outerFrame;
        if (!archTop) {
            profileElements.push(
              <PrintableMiteredFrame
                key="outer-frame"
                width={effectiveWidth}
                height={numHeight}
                topSize={dims.outerFrame}
                bottomSize={dims.outerFrame}
                leftSize={verticalFrame}
                rightSize={verticalFrame}
                scale={scale}
                color={profileColor}
                texture={pt}
                showInner={!suppressCasementOpeningInner}
              />,
            );
        }
    }
    
    // Fixed Panel frames and glass
    if (leftFix) {
        profileElements.push(<PrintProfilePiece key="divider-left" color={profileColor} texture={pt} style={{ top: frameOffset * scale, left: (holeX1 - dims.fixedFrame) * scale, width: dims.fixedFrame * scale, height: (numHeight - 2 * frameOffset) * scale }} />);
        labelElements.push(<PrintDimensionLabel key="label-left" value={leftFix.size} className="top-1/2 -translate-y-1/2" style={{left: leftFix.size * scale / 2, transform: 'translateX(-50%)'}}/>)
    }
    if (rightFix) profileElements.push(<PrintProfilePiece key="divider-right" color={profileColor} texture={pt} style={{ top: frameOffset * scale, left: holeX2 * scale, width: dims.fixedFrame * scale, height: (numHeight - 2 * frameOffset) * scale }} />);
    
    const hDividerX = leftFix ? holeX1 : frameOffset;
    const hDividerWidth = (rightFix ? holeX2 : numWidth - frameOffset) - hDividerX;

    const horizontalFixDivisions = getFixedPanelVerticalDivisionsMm(config, hDividerWidth);
    const mullionSize = Math.max(dims.fixedFrame, dims.mullion || dims.fixedFrame);

    const pushHorizontalFixGlass = (
      keyPrefix: string,
      panelId: string,
      topMm: number,
      glassH: number,
    ) => {
      if (glassH <= 0) return;
      const sortedDivs = horizontalFixDivisions
        .filter((d) => d > 0 && d < hDividerWidth)
        .sort((a, b) => a - b);
      const segments: { startMm: number; widthMm: number }[] = [];
      let cursor = 0;
      for (const dPos of sortedDivs) {
        const segStart = cursor;
        const segEnd = dPos - mullionSize / 2;
        if (segEnd > segStart) segments.push({ startMm: segStart, widthMm: segEnd - segStart });
        cursor = dPos + mullionSize / 2;
      }
      if (cursor < hDividerWidth) segments.push({ startMm: cursor, widthMm: hDividerWidth - cursor });
      if (segments.length === 0) {
        glassElements.push(<GlassPanel key={`${keyPrefix}-full`} panelId={panelId} style={{ top: topMm * scale, left: hDividerX * scale, width: hDividerWidth * scale, height: glassH * scale }} glassWidthPx={hDividerWidth * scale} glassHeightPx={glassH * scale}><PrintShutterIndicator type="fixed"/></GlassPanel>);
        return;
      }
      segments.forEach((seg, idx) => {
        glassElements.push(
          <GlassPanel
            key={`${keyPrefix}-${idx}`}
            panelId={`${panelId}-${idx}`}
            style={{ top: topMm * scale, left: (hDividerX + seg.startMm) * scale, width: seg.widthMm * scale, height: glassH * scale }}
            glassWidthPx={seg.widthMm * scale}
            glassHeightPx={glassH * scale}
          ><PrintShutterIndicator type="fixed"/></GlassPanel>
        );
      });
      sortedDivs.forEach((dPos, idx) => {
        profileElements.push(
          <PrintProfilePiece
            key={`${keyPrefix}-mullion-${idx}`}
            color={profileColor}
            texture={pt}
            style={{
              top: topMm * scale,
              left: (hDividerX + dPos - mullionSize / 2) * scale,
              width: mullionSize * scale,
              height: glassH * scale,
              zIndex: 5,
            }}
          />
        );
      });
    };

    if (topFix) {
        profileElements.push(<PrintProfilePiece key="divider-top" color={profileColor} texture={pt} style={{ top: (holeY1 - dims.fixedFrame) * scale, left: hDividerX * scale, width: hDividerWidth * scale, height: dims.fixedFrame * scale }} />);
        const glassH = holeY1 - frameOffset - dims.fixedFrame;
        pushHorizontalFixGlass('glass-top', 'fixed-top', frameOffset, glassH);
        labelElements.push(<PrintDimensionLabel key="label-top" value={topFix.size} className="left-1/2 -translate-x-1/2" style={{top: topFix.size * scale / 2}}/>)
    }
    if (bottomFix) {
        profileElements.push(<PrintProfilePiece key="divider-bottom" color={profileColor} texture={pt} style={{ top: holeY2 * scale, left: hDividerX * scale, width: hDividerWidth * scale, height: dims.fixedFrame * scale }} />);
        const glassH = numHeight - holeY2 - frameOffset - dims.fixedFrame;
        pushHorizontalFixGlass('glass-bottom', 'fixed-bottom', holeY2 + dims.fixedFrame, glassH);
    }
    const vGlassY = topFix ? holeY1 : frameOffset;
    const vGlassHeight = (bottomFix ? holeY2 : numHeight - frameOffset) - vGlassY;
    if (leftFix) {
        const glassW = holeX1 - frameOffset - dims.fixedFrame;
        const glassH = vGlassHeight;
        glassElements.push(<GlassPanel key="glass-left" panelId="fixed-left" style={{ top: vGlassY * scale, left: frameOffset * scale, width: glassW * scale, height: glassH * scale }} glassWidthPx={glassW*scale} glassHeightPx={glassH*scale}><PrintShutterIndicator type="fixed"/></GlassPanel>);
    }
    if (rightFix) {
        const glassW = numWidth - holeX2 - frameOffset - dims.fixedFrame;
        const glassH = vGlassHeight;
        glassElements.push(<GlassPanel key="glass-right" panelId="fixed-right" style={{ top: vGlassY * scale, left: (holeX2 + dims.fixedFrame) * scale, width: glassW * scale, height: glassH * scale }} glassWidthPx={glassW*scale} glassHeightPx={glassH*scale}><PrintShutterIndicator type="fixed"/></GlassPanel>);
    }
    
    const PrintSlidingShutter: React.FC<{
        width: number; height: number; topProfile: number; bottomProfile: number; leftProfile: number; rightProfile: number;
        isMesh: boolean; isFixed?: boolean; isSliding?: boolean; panelId: string;
        interlockMm?: number;
        meetingMm?: number;
        drawLeftJoint?: boolean;
        drawRightJoint?: boolean;
    }> = ({ width, height, topProfile, bottomProfile, leftProfile, rightProfile, isMesh, isFixed = false, isSliding = false, panelId, interlockMm = 0, meetingMm = 0, drawLeftJoint, drawRightJoint }) => {
        const glassWidth = width - leftProfile - rightProfile;
        const glassHeight = height - topProfile - bottomProfile;
        const meshStyle: React.CSSProperties = isMesh ? {backgroundColor: '#ccc', opacity: 0.6, backgroundImage: `linear-gradient(45deg, #aaa 25%, transparent 25%), linear-gradient(-45deg, #aaa 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #aaa 75%), linear-gradient(-45deg, transparent 75%, #aaa 75%)`, backgroundSize: '3px 3px' } : {};
        const { top: bt, bottom: bb, left: bl, right: br } = resolveProfileBleed(SLIDING_TRACK_BLEED, PROFILE_VISUAL_OVERLAP_MM);
        const lPx = mmToPx(leftProfile, scale);
        const tPx = mmToPx(topProfile, scale);
        const rPx = mmToPx(rightProfile, scale);
        const bPx = mmToPx(bottomProfile, scale);
        const wPx = mmToPx(width, scale);
        const hPx = mmToPx(height, scale);
        const frameW = width + bl + br;
        const frameH = height + bt + bb;
        const leftButt = (interlockMm > 0 && leftProfile === interlockMm) || (meetingMm > 0 && leftProfile === meetingMm);
        const rightButt = (interlockMm > 0 && rightProfile === interlockMm) || (meetingMm > 0 && rightProfile === meetingMm);
        const showLeftJoint = leftButt && (drawLeftJoint ?? true);
        const showRightJoint = rightButt && (drawRightJoint ?? true);
        const frameHideInner: HideInnerEdges = {
          top: bt > 0,
          bottom: bb > 0,
          left: showLeftJoint,
          right: showRightJoint,
        };
        const frameButt: HideInnerEdges = { left: showLeftJoint, right: showRightJoint };

        return (
            <div
              className="absolute isolate"
              style={{
                left: mmToPx(-bl, scale),
                top: mmToPx(-bt, scale),
                width: mmToPx(frameW, scale),
                height: mmToPx(frameH, scale),
              }}
            >
                <div
                  className="absolute overflow-hidden"
                  style={{
                    zIndex: DOOR_CELL_Z.glass,
                    left: mmToPx(bl, scale) + lPx,
                    top: mmToPx(bt, scale) + tPx,
                    right: mmToPx(br, scale) + rPx,
                    bottom: mmToPx(bb, scale) + bPx,
                  }}
                >
                    <GlassPanel panelId={panelId} style={{ position: 'absolute', left: 0, top: 0, width: '100%', height: '100%', ...meshStyle }} glassWidthPx={glassWidth*scale} glassHeightPx={glassHeight*scale}>
                        <PrintShutterIndicator type={isFixed ? 'fixed' : isSliding ? 'sliding' : 'fixed'} />
                    </GlassPanel>
                </div>
                <div className="absolute inset-0" style={{ zIndex: DOOR_CELL_Z.frameFill }}>
                <PrintableMiteredFrame 
                    width={frameW} 
                    height={frameH} 
                    scale={scale} 
                    color={profileColor} 
                    texture={pt}
                    topSize={topProfile} 
                    bottomSize={bottomProfile} 
                    leftSize={leftProfile} 
                    rightSize={rightProfile}
                    hideInnerEdges={frameHideInner}
                    buttEdges={frameButt}
                />
                </div>
                {showLeftJoint ? (
                  <div className="pointer-events-none absolute" style={{ left: mmToPx(bl, scale), top: mmToPx(bt, scale), width: wPx, height: hPx, zIndex: DOOR_CELL_Z.frameLines }}>
                    <InterlockButtJointLines widthPx={wPx} heightPx={hPx} topPx={tPx} bottomPx={bPx} sidePx={lPx} side="left" variant="print" />
                  </div>
                ) : null}
                {showRightJoint ? (
                  <div className="pointer-events-none absolute" style={{ left: mmToPx(bl, scale), top: mmToPx(bt, scale), width: wPx, height: hPx, zIndex: DOOR_CELL_Z.frameLines }}>
                    <InterlockButtJointLines widthPx={wPx} heightPx={hPx} topPx={tPx} bottomPx={bPx} sidePx={rPx} side="right" variant="print" />
                  </div>
                ) : null}
            </div>
        );
    };

    const slidingShutterColumnStyle = (leftMm: number, widthMm: number, zIndex: number): React.CSSProperties => ({
        position: 'absolute',
        left: mmToPx(leftMm, scale),
        top: 0,
        bottom: 0,
        width: mmToPx(widthMm, scale),
        zIndex,
    });

    const elevationDimsBelow = config.windowType !== WindowType.CORNER ? (() => {
        const { columns } = getElevationDimensionsMm(config);
        if (columns.length <= 1) return null;
        const colTotal = columns.reduce((s, c) => s + (c.sizeMm || 0), 0) || effectiveWidth;
        const dimTextStyle: React.CSSProperties = {
            fontSize: '5.5pt',
            lineHeight: 1.1,
            color: '#000',
            fontFamily: 'monospace',
            textAlign: 'center',
            whiteSpace: 'nowrap',
        };
        const shutterIndices = columns
            .map((col, i) => (isShutterElevationColumn(col) ? i : -1))
            .filter((i) => i >= 0);
        const hasShutters = shutterIndices.length > 0;
        const firstShutter = shutterIndices[0] ?? 0;
        const gridCols = columns
            .map((c) => `${((c.sizeMm || 0) / colTotal) * 100}fr`)
            .join(' ');
        const labelRow = hasShutters ? 1 : 0;
        const lineRow = hasShutters ? 2 : 1;
        const sizeRow = hasShutters ? 3 : 2;
        return (
            <div
                style={{
                    marginTop: 2,
                    marginBottom: 4,
                    width: '100%',
                    display: 'grid',
                    gridTemplateColumns: gridCols,
                    gridTemplateRows: hasShutters ? 'auto auto auto' : 'auto auto',
                    rowGap: 1,
                    alignItems: 'end',
                }}
            >
                {hasShutters && (
                    <div
                        style={{
                            gridColumn: `${firstShutter + 1} / span ${shutterIndices.length}`,
                            gridRow: labelRow,
                            ...dimTextStyle,
                            fontSize: '5pt',
                        }}
                    >
                        Door size
                    </div>
                )}
                {columns.map((col, i) =>
                    isShutterElevationColumn(col) ? (
                        <div
                            key={`door-line-${i}`}
                            style={{
                                gridColumn: i + 1,
                                gridRow: lineRow,
                                borderBottom: '0.5px solid #333',
                                marginTop: 1,
                                alignSelf: 'end',
                            }}
                        />
                    ) : null,
                )}
                {columns.map((col, i) => (
                    <div
                        key={`door-size-${i}`}
                        style={{ gridColumn: i + 1, gridRow: sizeRow, ...dimTextStyle }}
                    >
                        {isShutterElevationColumn(col) ? Math.round(col.sizeMm || 0) : ''}
                    </div>
                ))}
            </div>
        );
    })() : null;

    const elevationDimsBeside = config.windowType !== WindowType.CORNER ? (() => {
        const { rows } = getElevationDimensionsMm(config);
        if (rows.length <= 1) return null;
        const rowTotal = rows.reduce((s, r) => s + (r.sizeMm || 0), 0) || numHeight;
        const dimTextStyle: React.CSSProperties = {
            fontSize: '5.5pt',
            lineHeight: 1.1,
            color: '#000',
            fontFamily: 'monospace',
            textAlign: 'center',
            whiteSpace: 'nowrap',
        };
        const rowSegStyle: React.CSSProperties = {
            ...dimTextStyle,
            border: '0.5px solid #555',
            boxSizing: 'border-box',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '0 1px',
            overflow: 'hidden',
        };
        return (
            <div
                className="absolute"
                style={{
                    top: 0,
                    left: '100%',
                    height: '100%',
                    width: 18,
                    marginLeft: 2,
                    display: 'flex',
                    flexDirection: 'column',
                }}
            >
                {rows.map((r, i) => (
                    <div
                        key={`row-${i}`}
                        style={{
                            ...rowSegStyle,
                            height: `${((r.sizeMm || 0) / rowTotal) * 100}%`,
                        }}
                    >
                        {Math.round(r.sizeMm || 0)}
                    </div>
                ))}
            </div>
        );
    })() : null;

    return (
        <div style={{ margin: 'auto', display: 'flex', flexDirection: 'column', alignItems: 'stretch' }}>
        <div className="relative" style={{ width: mmToPx(effectiveWidth, scale), height: mmToPx(numHeight, scale) }}>
            {glassElements}
            {profileElements}
            {shapedOuterFrame ? (
              <>
                <OpeningShapedFrame
                  config={config}
                  windowW={effectiveWidth}
                  windowH={numHeight}
                  holeX={holeX1}
                  holeY={holeY1}
                  innerW={innerAreaWidth}
                  innerH={innerAreaHeight}
                  scale={scale}
                  color={profileColor}
                  fillOnly
                  variant="print"
                />
                <div className="pointer-events-none absolute inset-0 z-[22]">
                  <OpeningShapedFrameOutlines
                    config={config}
                    windowW={effectiveWidth}
                    windowH={numHeight}
                    holeX={holeX1}
                    holeY={holeY1}
                    innerW={innerAreaWidth}
                    innerH={innerAreaHeight}
                    scale={scale}
                    variant="print"
                    hideRanges={shapedOutlineHideRanges}
                    frameProfileMm={dims.outerFrame}
                  />
                </div>
              </>
            ) : null}
            {innerAreaWidth > 0 && innerAreaHeight > 0 && (
                <div
                    className="absolute"
                    style={{
                      top: mmToPx(holeY1, scale),
                      left: mmToPx(holeX1, scale),
                      width: mmToPx(innerAreaWidth, scale),
                      height: mmToPx(innerAreaHeight, scale),
                      boxSizing: 'border-box',
                      overflow: openingProfileOverlap ? 'visible' : 'hidden',
                      ...(openingProfileOverlap
                        ? {}
                        : { border: `${Math.max(0.75, scale * 0.85)}px solid #374151` }),
                    }}
                >
                    {windowType === WindowType.MIRROR ? (() => {
                        const mirrorConfig = config.mirrorConfig ?? { shape: MirrorShape.RECTANGLE, isFrameless: false, cornerRadius: 0 };
                        
                        let borderRadius = '0px';
                        switch (mirrorConfig.shape) {
                            case MirrorShape.OVAL: borderRadius = '50%'; break;
                            case MirrorShape.CAPSULE: borderRadius = '9999px'; break;
                            case MirrorShape.ROUNDED_RECTANGLE: borderRadius = `${(Number(mirrorConfig.cornerRadius) || 0) * scale}px`; break;
                            case MirrorShape.RECTANGLE:
                            default:
                                borderRadius = '0px';
                                break;
                        }
                        const fullAreaStyle: React.CSSProperties = {
                            position: 'absolute', width: innerAreaWidth * scale, height: innerAreaHeight * scale,
                            borderRadius: borderRadius, overflow: 'hidden'
                        };

                        if (mirrorConfig.isFrameless) {
                            return <PrintableMirrorPanel key="mirror-surface" style={fullAreaStyle} />;
                        }

                        // Framed version
                        const frameThickness = dims.outerFrame;
                        const mirrorStyle: React.CSSProperties = {
                            position: 'absolute', top: frameThickness * scale, left: frameThickness * scale,
                            width: (innerAreaWidth - frameThickness * 2) * scale, height: (innerAreaHeight - frameThickness * 2) * scale,
                            borderRadius: borderRadius,
                        };
                        
                        return (<>
                                <div key="mirror-frame" style={{ ...fullAreaStyle, backgroundColor: profileColor }} />
                                <PrintableMirrorPanel key="mirror-surface" style={mirrorStyle} />
                            </>);
                    })() : null}
                    {windowType === WindowType.SLIDING ? (() => {
                        const { shutterConfig } = config;
                        const fixedShutters = config.fixedShutters ?? [];
                        const slidingHandles = config.slidingHandles ?? [];
                        const interlock = Number(dims.shutterInterlock) || 0;
                        const meetingRaw = Number(dims.shutterMeeting) || 0;
                        const meeting =
                          shutterConfig === ShutterConfigType.FOUR_GLASS
                            ? effectiveFourGlassMeetingMm(dims.shutterMeeting ?? '', dims.shutterInterlock ?? '')
                            : meetingRaw;
                        const is4G = shutterConfig === ShutterConfigType.FOUR_GLASS;
                        const hasMesh = shutterConfig === ShutterConfigType.TWO_GLASS_ONE_MESH;
                        const trackBandMm = slidingTrackBandMm(dims.topTrack);
                        const trackBandPx = mmToPx(trackBandMm, scale);
                        const laneCount =
                          shutterConfig === ShutterConfigType.TWO_GLASS_ONE_MESH ||
                          shutterConfig === ShutterConfigType.FOUR_GLASS_TWO_MESH
                            ? 3
                            : 2;
                        const laneGapPx = laneCount > 1 ? (innerAreaWidth * scale) / laneCount : 0;

                        const slidingTrackBands = (
                          <>
                            <div
                              key="sliding-track-top"
                              className="absolute"
                              style={{ left: 0, top: 0, width: innerAreaWidth * scale, height: trackBandPx, zIndex: 2 }}
                            >
                              <PrintProfilePiece
                                color={profileColor}
                                texture={pt}
                                style={{ left: 0, top: 0, width: '100%', height: '100%' }}
                              />
                              <SlidingTrackOuterOutline
                                widthPx={innerAreaWidth * scale}
                                heightPx={trackBandPx}
                                edge="top"
                                variant="print"
                              />
                            </div>
                            <div
                              key="sliding-track-bottom"
                              className="absolute"
                              style={{ left: 0, bottom: 0, width: innerAreaWidth * scale, height: trackBandPx, zIndex: 2 }}
                            >
                              <PrintProfilePiece
                                color={profileColor}
                                texture={pt}
                                style={{ left: 0, top: 0, width: '100%', height: '100%' }}
                              />
                              <SlidingTrackOuterOutline
                                widthPx={innerAreaWidth * scale}
                                heightPx={trackBandPx}
                                edge="bottom"
                                variant="print"
                              />
                            </div>
                            {Array.from({ length: laneCount - 1 }, (_, laneIdx) => {
                              const i = laneIdx + 1;
                              const x = laneGapPx * i;
                              return (
                                <React.Fragment key={`sliding-lane-${i}`}>
                                  <PrintProfilePiece
                                    color={profileColor}
                                    texture={pt}
                                    style={{
                                      left: x - 0.5,
                                      top: 0,
                                      width: 1,
                                      height: trackBandPx,
                                      zIndex: 3,
                                    }}
                                  />
                                  <PrintProfilePiece
                                    color={profileColor}
                                    texture={pt}
                                    style={{
                                      left: x - 0.5,
                                      bottom: 0,
                                      width: 1,
                                      height: trackBandPx,
                                      zIndex: 3,
                                    }}
                                  />
                                </React.Fragment>
                              );
                            })}
                          </>
                        );

                        let numShutters: number;
                        switch (shutterConfig) {
                            case ShutterConfigType.FOUR_GLASS: numShutters = 4; break;
                            case ShutterConfigType.TWO_GLASS: numShutters = 2; break;
                            case ShutterConfigType.THREE_GLASS: numShutters = 3; break;
                            case ShutterConfigType.TWO_GLASS_ONE_MESH: numShutters = 3; break;
                            case ShutterConfigType.FOUR_GLASS_TWO_MESH: numShutters = 6; break;
                            default: numShutters = 0;
                        }

                        if (shutterConfig === ShutterConfigType.FOUR_GLASS_TWO_MESH) {
                            const panelWidth = (innerAreaWidth + 3 * interlock) / 4;
                            const panels: { id: number; type: 'glass' | 'mesh'; x: number; z: number }[] = [
                                { id: 0, type: 'glass', x: 0, z: 5 },
                                { id: 5, type: 'glass', x: innerAreaWidth - panelWidth, z: 5 },
                                { id: 1, type: 'glass', x: panelWidth - interlock, z: 10 },
                                { id: 4, type: 'glass', x: 2 * panelWidth - 2 * interlock, z: 10 },
                                { id: 2, type: 'mesh', x: 0, z: 15 },
                                { id: 3, type: 'mesh', x: innerAreaWidth - panelWidth, z: 15 },
                            ];
                            panels.forEach((p) => {
                                const handleConfig = slidingHandles[p.id];
                                if (handleConfig) {
                                    const side = slidingMemberSide4G2M(p.id);
                                    const mirrored = mirrorHandleForSlidingMember(side);
                                    handleElements.push(
                                        <div
                                            key={`handle-${p.id}`}
                                            style={{
                                                zIndex: 30,
                                                position: 'absolute',
                                                left: (p.x + panelWidth * handleConfig.x / 100) * scale,
                                                top: (innerAreaHeight * handleConfig.y / 100) * scale,
                                                transform: 'translate(-50%, -50%)',
                                                transformOrigin: 'center center',
                                            }}
                                        >
                                            <PrintableHandle config={handleConfig} scale={scale} mirrored={mirrored} />
                                        </div>
                                    );
                                }
                            });
                            return (
                              <>
                                {slidingTrackBands}
                                {panels.map((p) => {
                                  let leftProf = interlock;
                                  let rightProf = interlock;
                                  if (p.id === 0 || p.id === 2) leftProf = dims.shutterHandle;
                                  if (p.id === 3 || p.id === 5) rightProf = dims.shutterHandle;
                                  const leftPeerId = p.id === 4 ? 1 : undefined;
                                  const rightPeerId = p.id === 1 ? 4 : undefined;
                                  const leftPeer = leftPeerId != null ? panels.find((q) => q.id === leftPeerId) : undefined;
                                  const rightPeer = rightPeerId != null ? panels.find((q) => q.id === rightPeerId) : undefined;
                                  const leftButtProf = (interlock > 0 && leftProf === interlock) || (meeting > 0 && leftProf === meeting);
                                  const rightButtProf = (interlock > 0 && rightProf === interlock) || (meeting > 0 && rightProf === meeting);
                                  const drawLeftJoint =
                                    leftButtProf &&
                                    (leftPeerId == null || slidingInterlockJointVisible(p.z, leftPeer?.z, p.id, leftPeerId));
                                  const drawRightJoint =
                                    rightButtProf &&
                                    (rightPeerId == null || slidingInterlockJointVisible(p.z, rightPeer?.z, p.id, rightPeerId));
                                  return (
                                    <div key={p.id} style={slidingShutterColumnStyle(p.x, panelWidth, p.z)}>
                                      <PrintSlidingShutter
                                        panelId={`sliding-${p.id}`}
                                        width={panelWidth}
                                        height={innerAreaHeight}
                                        topProfile={dims.shutterTop}
                                        bottomProfile={dims.shutterBottom}
                                        leftProfile={leftProf}
                                        rightProfile={rightProf}
                                        isMesh={p.type === 'mesh'}
                                        isFixed={fixedShutters[p.id]}
                                        isSliding={!fixedShutters[p.id]}
                                        interlockMm={interlock}
                                        meetingMm={meeting}
                                        drawLeftJoint={drawLeftJoint}
                                        drawRightJoint={drawRightJoint}
                                      />
                                    </div>
                                  );
                                })}
                              </>
                            );
                        }

                        if (is4G) {
                            const shutterWidth = (innerAreaWidth + (2 * interlock) + meeting) / 4;
                            const positions = [ 0, shutterWidth - interlock, (2*shutterWidth) - interlock - meeting, (3*shutterWidth) - (2*interlock) - meeting ];
                             slidingHandles.forEach((handleConfig, i) => {
                                if (handleConfig) {
                                    const side = slidingMemberSideStandard(i, 4);
                                    const mirrored = mirrorHandleForSlidingMember(side);
                                    handleElements.push(<div key={`handle-${i}`} style={{ zIndex: 30, position: 'absolute', left: (positions[i] + shutterWidth * handleConfig.x / 100) * scale, top: (innerAreaHeight * handleConfig.y / 100) * scale, transform: 'translate(-50%, -50%)', transformOrigin: 'center center' }}><PrintableHandle config={handleConfig} scale={scale} mirrored={mirrored} /></div>);
                                }
                            });
                            const profiles = [
                                { l: dims.shutterHandle, r: interlock }, { l: interlock, r: meeting },
                                { l: meeting, r: interlock }, { l: interlock, r: dims.shutterHandle }
                            ];
                            return (
                              <>
                                {slidingTrackBands}
                                {profiles.map((p, i) => {
                                  const zFor = (idx: number) => ((idx === 1 || idx === 2) ? 10 : 5);
                                  const myZ = zFor(i);
                                  const leftButtProf = (interlock > 0 && p.l === interlock) || (meeting > 0 && p.l === meeting);
                                  const rightButtProf = (interlock > 0 && p.r === interlock) || (meeting > 0 && p.r === meeting);
                                  const drawLeftJoint = leftButtProf && slidingInterlockJointVisible(myZ, i > 0 ? zFor(i - 1) : undefined, i, i - 1);
                                  const drawRightJoint = rightButtProf && slidingInterlockJointVisible(myZ, i < 3 ? zFor(i + 1) : undefined, i, i + 1);
                                  return (
                                  <div key={i} style={slidingShutterColumnStyle(positions[i], shutterWidth, (i === 1 || i === 2) ? 10 : 5)}>
                                    <PrintSlidingShutter
                                      panelId={`sliding-${i}`}
                                      width={shutterWidth}
                                      height={innerAreaHeight}
                                      topProfile={dims.shutterTop}
                                      bottomProfile={dims.shutterBottom}
                                      leftProfile={p.l}
                                      rightProfile={p.r}
                                      isMesh={false}
                                      isFixed={fixedShutters[i]}
                                      isSliding={!fixedShutters[i]}
                                      interlockMm={interlock}
                                      meetingMm={meeting}
                                      drawLeftJoint={drawLeftJoint}
                                      drawRightJoint={drawRightJoint}
                                    />
                                  </div>
                                );})}
                              </>
                            );
                        } else {
                            const shutterDivider = hasMesh ? 2 : numShutters;
                            const shutterWidth = (innerAreaWidth + (shutterDivider - 1) * interlock) / shutterDivider;
                            slidingHandles.forEach((handleConfig, i) => {
                                if (handleConfig) {
                                    let leftPosition = (hasMesh ? Math.min(i, numShutters - 2) : i) * (shutterWidth - interlock);
                                    const side = slidingMemberSideStandard(i, numShutters);
                                    const mirrored = mirrorHandleForSlidingMember(side);
                                    handleElements.push(<div key={`handle-${i}`} style={{ zIndex: 30, position: 'absolute', left: (leftPosition + shutterWidth * handleConfig.x / 100) * scale, top: (innerAreaHeight * handleConfig.y / 100) * scale, transform: 'translate(-50%, -50%)', transformOrigin: 'center center' }}><PrintableHandle config={handleConfig} scale={scale} mirrored={mirrored} /></div>);
                                }
                            });
                            return (
                              <>
                                {slidingTrackBands}
                                {Array.from({ length: numShutters }).map((_, i) => {
                                  const isMeshShutter = hasMesh && i === numShutters - 1;
                                  const leftPosition = (hasMesh ? Math.min(i, numShutters - 2) : i) * (shutterWidth - interlock);
                                  const leftProfile = i === 0 ? dims.shutterHandle : interlock;
                                  const rightProfile = i === numShutters - 1 ? dims.shutterHandle : interlock;
                                  const zFor = (idx: number) =>
                                    hasMesh ? (idx === numShutters - 1 ? 15 : idx === 1 ? 10 : 5) : (numShutters === 2 ? (idx === 1 ? 10 : 5) : (idx === 1 ? 10 : 5));
                                  const myZ = zFor(i);
                                  const leftButtProf = (interlock > 0 && leftProfile === interlock) || (meeting > 0 && leftProfile === meeting);
                                  const rightButtProf = (interlock > 0 && rightProfile === interlock) || (meeting > 0 && rightProfile === meeting);
                                  const drawLeftJoint = leftButtProf && slidingInterlockJointVisible(myZ, i > 0 ? zFor(i - 1) : undefined, i, i - 1);
                                  const drawRightJoint = rightButtProf && slidingInterlockJointVisible(myZ, i < numShutters - 1 ? zFor(i + 1) : undefined, i, i + 1);
                                  return (
                                    <div key={i} style={slidingShutterColumnStyle(leftPosition, shutterWidth, myZ)}>
                                      <PrintSlidingShutter
                                        panelId={`sliding-${i}`}
                                        width={shutterWidth}
                                        height={innerAreaHeight}
                                        topProfile={dims.shutterTop}
                                        bottomProfile={dims.shutterBottom}
                                        leftProfile={leftProfile}
                                        rightProfile={rightProfile}
                                        isMesh={isMeshShutter}
                                        isFixed={fixedShutters[i]}
                                        isSliding={!fixedShutters[i]}
                                        interlockMm={interlock}
                                        meetingMm={meeting}
                                        drawLeftJoint={drawLeftJoint}
                                        drawRightJoint={drawRightJoint}
                                      />
                                    </div>
                                  );
                                })}
                              </>
                            );
                        }
                    })() : null}

                    {(windowType === WindowType.CASEMENT || windowType === WindowType.VENTILATOR) && (() => {
                        const verticalDividers = config.verticalDividers ?? [];
                        const horizontalDividers = config.horizontalDividers ?? [];
                        const springRel = archSpringYmm / Math.max(innerAreaHeight, 1);
                        const effectiveHDivs =
                          archTop && horizontalDividers.length > 0
                            ? [springRel, ...horizontalDividers.slice(1)]
                            : horizontalDividers;
                        const doorPositionsArr = config.doorPositions ?? [];
                        const ventilatorGridArr = config.ventilatorGrid ?? [];
                        const gridCols = verticalDividers.length + 1;
                        const gridRows = effectiveHDivs.length + 1;
                        const hiddenSegs = resolveHiddenMullionSegments(config);
                        const hMullionElements: React.ReactNode[] = [];
                        const vMullionElements: React.ReactNode[] = [];
                        const mullionOutlinePrintElements: React.ReactNode[] = [];
                        const cellElements: React.ReactNode[] = [];
                        const doorPrintElements: React.ReactNode[] = [];
                        const archMullionPrintElements: React.ReactNode[] = [];

                        if (archTop && archSpringYmm > 0) {
                          const archShellStyle: React.CSSProperties = {
                            position: 'absolute',
                            left: 0,
                            top: 0,
                            width: innerAreaWidth * scale,
                            height: archSpringYmm * scale,
                          };
                          cellElements.push(
                            <div key="arch-head-glass" className="pointer-events-none" style={{ ...archShellStyle, zIndex: 2 }}>
                              <ArchHeadLayer
                                part="glass"
                                config={config}
                                innerW={innerAreaWidth}
                                springYmm={archSpringYmm}
                                scale={scale}
                                mullionMm={dims.mullion}
                                profileColor={profileColor}
                                variant="print"
                              />
                            </div>,
                          );
                          archMullionPrintElements.push(
                            <div key="arch-head-profiles" className="pointer-events-none" style={{ ...archShellStyle, zIndex: 6 }}>
                              <ArchHeadLayer
                                part="profiles"
                                config={config}
                                innerW={innerAreaWidth}
                                springYmm={archSpringYmm}
                                scale={scale}
                                mullionMm={dims.mullion}
                                profileColor={profileColor}
                                variant="print"
                              />
                            </div>,
                          );
                          mullionOutlinePrintElements.push(
                            <div key="arch-head-outlines" className="pointer-events-none" style={archShellStyle}>
                              <ArchHeadLayer
                                part="outlines"
                                config={config}
                                innerW={innerAreaWidth}
                                springYmm={archSpringYmm}
                                scale={scale}
                                mullionMm={dims.mullion}
                                profileColor={profileColor}
                                variant="print"
                              />
                            </div>,
                          );
                        }
                        
                        for (let r = 0; r < gridRows; r++) {
                            if (archTop && r === 0) continue;
                            for (let c = 0; c < gridCols; c++) {
                                const x_start_rel = c === 0 ? 0 : verticalDividers[c - 1];
                                const x_end_rel = c === verticalDividers.length ? 1 : verticalDividers[c];
                                const y_start_rel = r === 0 ? 0 : effectiveHDivs[r - 1];
                                const y_end_rel = r === effectiveHDivs.length ? 1 : effectiveHDivs[r];

                                const cellX = x_start_rel * innerAreaWidth;
                                const cellY = y_start_rel * innerAreaHeight;
                                const cellW = (x_end_rel - x_start_rel) * innerAreaWidth;
                                const cellH = (y_end_rel - y_start_rel) * innerAreaHeight;
                                
                                const doorInfo = doorPositionsArr.find((p) => p.row === r && p.col === c);
                                if (doorInfo?.handle) {
                                    const mirrored = mirrorHandleForPartitionHandleX(doorInfo.handle.x);
                                    handleElements.push(<div key={`handle-casement-${r}-${c}`} style={{ position: 'absolute', zIndex: 30, left: (cellX + cellW * doorInfo.handle.x / 100) * scale, top: (cellY + cellH * doorInfo.handle.y / 100) * scale, transform: 'translate(-50%, -50%)', transformOrigin: 'center center' }}><PrintableHandle config={doorInfo.handle} scale={scale} mirrored={mirrored} /></div>);
                                }
                                const cell = ventilatorGridArr[r]?.[c];
                                if (cell?.type === 'door' && cell.handle) {
                                     const mirrored = mirrorHandleForPartitionHandleX(cell.handle.x);
                                     handleElements.push(<div key={`handle-vent-${r}-${c}`} style={{ position: 'absolute', zIndex: 30, left: (cellX + cellW * cell.handle.x / 100) * scale, top: (cellY + cellH * cell.handle.y / 100) * scale, transform: 'translate(-50%, -50%)', transformOrigin: 'center center' }}><PrintableHandle config={cell.handle} scale={scale} mirrored={mirrored} /></div>);
                                }
                                
                                const cellType = cell?.type;
                                let content = <GlassPanel key={`cell-${r}-${c}`} panelId={`cell-${r}-${c}`} style={{left: cellX*scale, top: cellY*scale, width: cellW*scale, height: cellH*scale}} glassWidthPx={cellW*scale} glassHeightPx={cellH*scale}><PrintShutterIndicator type="fixed"/></GlassPanel>;

                                if ((windowType === WindowType.CASEMENT && doorInfo) || cellType === 'door') {
                                    const hideInnerEdges = casementCellHideInnerEdges(r, c, gridRows, gridCols, hiddenSegs);
                                    const visual = casementDoorVisualBounds(cellX, cellY, cellW, cellH, r, c, gridRows, gridCols, hiddenSegs, PROFILE_VISUAL_OVERLAP_MM, dims.mullion);
                                    const doorWPx = mmToPx(visual.cellW, scale);
                                    const doorHPx = mmToPx(visual.cellH, scale);
                                    const doorProfPx = mmToPx(dims.casementShutter, scale);
                                    content = (<div key={`cell-${r}-${c}`} className="absolute isolate" style={{left: mmToPx(visual.cellX, scale), top: mmToPx(visual.cellY, scale), width: doorWPx, height: doorHPx, zIndex: 24}}>
                                        <div className="absolute overflow-hidden" style={{ zIndex: DOOR_CELL_Z.glass, left: doorProfPx, top: doorProfPx, right: doorProfPx, bottom: doorProfPx }}>
                                          <GlassPanel panelId={`cell-door-${r}-${c}`} style={{ position: 'absolute', left: 0, top: 0, width: '100%', height: '100%' }} glassWidthPx={(visual.cellW - 2*dims.casementShutter)*scale} glassHeightPx={(visual.cellH - 2*dims.casementShutter)*scale}><PrintShutterIndicator type="door"/></GlassPanel>
                                        </div>
                                        <div className="absolute inset-0" style={{ zIndex: DOOR_CELL_Z.frameFill }}>
                                          <PrintableMiteredFrame width={visual.cellW} height={visual.cellH} profileSize={dims.casementShutter} scale={scale} color={profileColor} texture={pt} hideInnerEdges={hideInnerEdges} showOutlines={false} />
                                        </div>
                                        <div className="pointer-events-none absolute inset-0" style={{ zIndex: DOOR_CELL_Z.frameLines }}>
                                          <MiteredProfileOutlines widthPx={doorWPx} heightPx={doorHPx} topPx={doorProfPx} bottomPx={doorProfPx} leftPx={doorProfPx} rightPx={doorProfPx} variant="print" hideInnerEdges={hideInnerEdges} showOuter showMiterCorners outlineZIndex={30} />
                                        </div>
                                      </div>);
                                    doorPrintElements.push(content);
                                    continue;
                                } else if (cellType === 'louvers') {
                                    const louvers: React.ReactNode[] = [];
                                    if (dims.louverBlade > 0) {
                                        const numLouvers = Math.floor(cellH / dims.louverBlade);
                                        for (let i=0; i < numLouvers; i++) louvers.push(<PrintProfilePiece key={`louver-${i}`} color={profileColor} texture={pt} style={{left: 0, top: (i * dims.louverBlade)*scale, width: cellW*scale, height: dims.louverBlade*scale }}/>)
                                    }
                                    content = <div key={`cell-${r}-${c}`} className="absolute" style={{left: cellX*scale, top: cellY*scale, width: cellW*scale, height: cellH*scale}}>{louvers}<PrintShutterIndicator type="louvers" width={cellW*scale} height={cellH*scale}/></div>;
                                } else if (cellType === 'exhaust_fan') {
                                    content = <GlassPanel key={`cell-${r}-${c}`} panelId={`cell-${r}-${c}`} style={{left: cellX*scale, top: cellY*scale, width: cellW*scale, height: cellH*scale}} glassWidthPx={cellW*scale} glassHeightPx={cellH*scale}><PrintShutterIndicator type="exhaust_fan"/></GlassPanel>;
                                }
                                cellElements.push(content);
                            }
                        }

                        effectiveHDivs.forEach((pos, hi) => {
                          for (let c = 0; c < gridCols; c++) {
                            if (isHSegHidden(hiddenSegs, hi, c)) continue;
                            const xStart = c === 0 ? 0 : verticalDividers[c - 1];
                            const xEnd = c === verticalDividers.length ? 1 : verticalDividers[c];
                            const segLeft = xStart * innerAreaWidth;
                            const segWidth = (xEnd - xStart) * innerAreaWidth;
                            const mTop = (pos * innerAreaHeight - dims.mullion / 2) * scale;
                            const mH = dims.mullion * scale;
                            const isSpring = archTop && hi === 0;
                            hMullionElements.push(
                              <div key={`hmullion-${hi}-${c}`} className="absolute" style={{ left: segLeft * scale, top: mTop, width: segWidth * scale, height: mH, zIndex: 4 }}>
                                <PrintProfilePiece color={profileColor} texture={pt} style={{ left: 0, top: 0, width: '100%', height: '100%' }} />
                              </div>,
                            );
                            mullionOutlinePrintElements.push(
                              <div
                                key={`hmullion-outline-${hi}-${c}`}
                                className="pointer-events-none absolute"
                                style={{ left: segLeft * scale, top: mTop, width: segWidth * scale, height: mH }}
                              >
                                <MullionJointLines
                                  widthPx={segWidth * scale}
                                  heightPx={mH}
                                  orientation="horizontal"
                                  variant="print"
                                  hideTopEdge={isSpring}
                                  {...gridMullionJointLineProps('horizontal', c, 0, gridCols, gridRows, scale)}
                                />
                              </div>,
                            );
                          }
                        });
                        verticalDividers.forEach((pos, vi) => {
                          for (let r = 0; r < gridRows; r++) {
                            if (archTop && r === 0) continue;
                            if (isVSegHidden(hiddenSegs, vi, r)) continue;
                            const yStart = r === 0 ? 0 : effectiveHDivs[r - 1];
                            const yEnd = r === effectiveHDivs.length ? 1 : effectiveHDivs[r];
                            const segTop = yStart * innerAreaHeight;
                            const segHeight = (yEnd - yStart) * innerAreaHeight;
                            const mLeft = (pos * innerAreaWidth - dims.mullion / 2) * scale;
                            const mW = dims.mullion * scale;
                            const segmentTopAtSpring = archTop && r > 0 && Math.abs(yStart - springRel) < 1e-6;
                            vMullionElements.push(
                              <div key={`vmullion-${vi}-${r}`} className="absolute" style={{ left: mLeft, top: segTop * scale, width: mW, height: segHeight * scale, zIndex: 4 }}>
                                <PrintProfilePiece color={profileColor} texture={pt} style={{ left: 0, top: 0, width: '100%', height: '100%' }} />
                              </div>,
                            );
                            mullionOutlinePrintElements.push(
                              <div
                                key={`vmullion-outline-${vi}-${r}`}
                                className="pointer-events-none absolute"
                                style={{ left: mLeft, top: segTop * scale, width: mW, height: segHeight * scale }}
                              >
                                <MullionJointLines
                                  widthPx={mW}
                                  heightPx={segHeight * scale}
                                  orientation="vertical"
                                  variant="print"
                                  {...gridMullionJointLineProps('vertical', 0, r, gridCols, gridRows, scale, PROFILE_VISUAL_OVERLAP_MM, {
                                    segmentTopAtSpring,
                                  })}
                                />
                              </div>,
                            );
                          }
                        });
                        return (
                          <>
                            {hMullionElements}
                            {vMullionElements}
                            {cellElements}
                            {archMullionPrintElements}
                            <div className="pointer-events-none absolute inset-0" style={{ zIndex: 8 }}>
                              {mullionOutlinePrintElements}
                              {!shapedOuterFrame && casementGridHideRanges ? (
                                <OpeningInnerOutlineSegments
                                  innerW={innerAreaWidth}
                                  innerH={innerAreaHeight}
                                  hideRanges={casementGridHideRanges}
                                  scale={scale}
                                  variant="print"
                                />
                              ) : null}
                            </div>
                            {doorPrintElements}
                          </>
                        );
                    })()}

                    {windowType === WindowType.GLASS_PARTITION && (() => {
                        const partitionPanels = config.partitionPanels ?? {
                          count: 0,
                          types: [] as PartitionPanelConfig[],
                          hasTopChannel: false,
                        };
                        const gap = PARTITION_PANEL_GAP_MM;
                        const panelWidths = resolvePartitionPanelWidthsMm(
                          innerAreaWidth,
                          partitionPanels.count,
                          partitionPanels.types,
                          partitionPanels.widthFractions
                        );

                        const panels: React.ReactNode[] = [];
                        
                        if (partitionPanels.hasTopChannel) {
                            panels.push(
                              <div key="track-top" className="absolute" style={{ top: 0, left: 0, width: innerAreaWidth * scale, height: dims.topTrack * scale, zIndex: 4, backgroundColor: profileColor.startsWith('#') ? profileColor : undefined }}>
                                <SlidingTrackOuterOutline widthPx={innerAreaWidth * scale} heightPx={dims.topTrack * scale} edge="top" variant="print" />
                              </div>,
                            );
                        }
                        const panelAreaY = partitionPanels.hasTopChannel ? dims.topTrack : 0;
                        const panelAreaHeight = innerAreaHeight - (partitionPanels.hasTopChannel ? dims.topTrack + dims.bottomTrack : 0);
                        
                        let currentX = 0;
                        for (let i=0; i < partitionPanels.count; i++) {
                            const panelConfig = partitionPanels.types[i];
                            if (!panelConfig) continue;
                            const { type, handle, framing } = panelConfig;
                            
                            const panelX = currentX;
                            const currentPanelWidth = panelWidths[i] ?? 0;
                            const zIndex = type === 'sliding' || type === 'fold' ? 10 + i : 5;

                            let ph = panelAreaHeight;
                            const rawHm = panelConfig.heightMm;
                            if (rawHm !== '' && rawHm !== undefined && rawHm !== null) {
                              const nh = Number(rawHm);
                              if (Number.isFinite(nh) && nh > 0) {
                                ph = Math.min(nh, panelAreaHeight);
                              }
                            }
                            const py = getPartitionPanelTopMm(panelAreaY, panelAreaHeight, ph, panelConfig.heightAlign);
                            const foldLeaves = type === 'fold' ? clampFoldLeafCount(panelConfig.foldLeafCount) : undefined;

                            if (partitionPanels.hasTopChannel) {
                              panels.push(
                                <div
                                  key={`track-bottom-${i}`}
                                  className="absolute"
                                  style={{
                                    left: panelX * scale,
                                    top: (py + ph - dims.bottomTrack) * scale,
                                    width: currentPanelWidth * scale,
                                    height: dims.bottomTrack * scale,
                                    zIndex: 4,
                                    backgroundColor: profileColor.startsWith('#') ? profileColor : undefined,
                                  }}
                                >
                                  <SlidingTrackOuterOutline widthPx={currentPanelWidth * scale} heightPx={dims.bottomTrack * scale} edge="bottom" variant="print" />
                                </div>,
                              );
                            }

                             if (handle) {
                                const mirrored = mirrorHandleForPartitionHandleX(handle.x);
                                handleElements.push(<div key={`handle-part-${i}`} style={{ position: 'absolute', zIndex: 30, left: (panelX + currentPanelWidth * handle.x / 100) * scale, top: (py + ph * handle.y / 100) * scale, transform: 'translate(-50%, -50%)', transformOrigin: 'center center' }}><PrintableHandle config={handle} scale={scale} mirrored={mirrored} /></div>);
                            }
                            
                             const isFramed = framing === 'full' || type === 'hinged';
                             const frameSize = dims.casementShutter;
                            let ft = frameSize;
                            let fb = frameSize;
                            let fl = frameSize;
                            let fr = frameSize;
                            if (isFramed && type === 'fold') {
                              const e = resolveFoldFrameEdges(panelConfig, frameSize);
                              ft = e.top;
                              fb = e.bottom;
                              fl = e.left;
                              fr = e.right;
                            }
                            const innerGlassW = (currentPanelWidth - (isFramed ? fl + fr : 0)) * scale;
                            const innerGlassH = (ph - (isFramed ? ft + fb : 0)) * scale;
                            const isSlidingLike = type === 'sliding' || type === 'fold';
                            const bleedLeft = isFramed && i === 0 ? PROFILE_VISUAL_OVERLAP_MM : 0;
                            const bleedRight = isFramed && i === partitionPanels.count - 1 ? PROFILE_VISUAL_OVERLAP_MM : 0;
                            const bleedTop = isFramed && isSlidingLike && partitionPanels.hasTopChannel ? PROFILE_VISUAL_OVERLAP_MM : 0;
                            const bleedBottom = isFramed && isSlidingLike && partitionPanels.hasTopChannel ? PROFILE_VISUAL_OVERLAP_MM : 0;
                            const panelHideInner: HideInnerEdges = {
                              left: bleedLeft > 0,
                              right: bleedRight > 0,
                              top: bleedTop > 0,
                              bottom: bleedBottom > 0,
                            };
                            const frameW = currentPanelWidth + bleedLeft + bleedRight;
                            const frameH = ph + bleedTop + bleedBottom;

                            panels.push(
                                <div key={`panel-${i}`} className="absolute isolate" style={{left: mmToPx(panelX, scale), top: mmToPx(py, scale), width: mmToPx(currentPanelWidth, scale), height: mmToPx(ph, scale), zIndex}}>
                                  <div
                                    className="absolute overflow-hidden"
                                    style={
                                      isFramed
                                        ? { zIndex: DOOR_CELL_Z.glass, left: mmToPx(fl, scale), top: mmToPx(ft, scale), right: mmToPx(fr, scale), bottom: mmToPx(fb, scale) }
                                        : { zIndex: DOOR_CELL_Z.glass, top: 0, left: 0, right: 0, bottom: 0 }
                                    }
                                  >
                                    <GlassPanel 
                                      panelId={`partition-${i}`}
                                      style={{ position: 'absolute', left: 0, top: 0, width: '100%', height: '100%' }}
                                      glassWidthPx={innerGlassW}
                                      glassHeightPx={innerGlassH}
                                    >
                                       {type === 'fold' && (
                                         <FoldDoorOpeningGraphic leaves={foldLeaves ?? 2} variant="print" profileColor={profileColor} />
                                       )}
                                       <PrintShutterIndicator type={type} width={innerGlassW} height={innerGlassH} foldLeaves={foldLeaves} />
                                    </GlassPanel>
                                  </div>
                                  {isFramed && type === 'fold' && (
                                    <div className="absolute" style={{ zIndex: DOOR_CELL_Z.frameFill, left: mmToPx(-bleedLeft, scale), top: mmToPx(-bleedTop, scale), width: mmToPx(frameW, scale), height: mmToPx(frameH, scale) }}>
                                      <PrintableMiteredFrame
                                        width={frameW}
                                        height={frameH}
                                        topSize={ft}
                                        bottomSize={fb}
                                        leftSize={fl}
                                        rightSize={fr}
                                        scale={scale}
                                        color={profileColor}
                                        texture={pt}
                                        hideInnerEdges={panelHideInner}
                                      />
                                    </div>
                                  )}
                                  {isFramed && type !== 'fold' && (
                                    <div className="absolute" style={{ zIndex: DOOR_CELL_Z.frameFill, left: mmToPx(-bleedLeft, scale), top: mmToPx(-bleedTop, scale), width: mmToPx(frameW, scale), height: mmToPx(frameH, scale) }}>
                                      <PrintableMiteredFrame width={frameW} height={frameH} profileSize={frameSize} scale={scale} color={profileColor} texture={pt} hideInnerEdges={panelHideInner} />
                                    </div>
                                  )}
                                </div>
                            );

                            currentX += currentPanelWidth;
                            if (i < partitionPanels.count - 1) {
                                const nextPanelConfig = partitionPanels.types[i+1];
                                if (
                                  nextPanelConfig &&
                                  isOperablePartitionType(type) &&
                                  isOperablePartitionType(nextPanelConfig.type)
                                ) {
                                    currentX += gap;
                                }
                            }
                        }
                        return <>{panels}</>;
                    })()}
                    {handleElements}
                </div>
            )}
            {!printCompact && config.windowType !== WindowType.CORNER && (
                <>
                    <PrintDimensionLabel value={effectiveWidth} className="top-0 -translate-y-full left-1/2 -translate-x-1/2 -mt-1" />
                    <PrintDimensionLabel value={numHeight} className="top-1/2 -translate-y-1/2 left-0 -translate-x-full -ml-2 rotate-[-90deg]" />
                </>
            )}
            {!printCompact ? labelElements : null}
            {!printCompact ? elevationDimsBeside : null}
        </div>
        {!printCompact ? elevationDimsBelow : null}
        {!printCompact && weightKg != null && weightKg > 0 && (
            <p
                style={{
                    fontSize: '7pt',
                    textAlign: 'center',
                    marginTop: 6,
                    marginBottom: 0,
                    fontWeight: 600,
                    color: '#374151',
                }}
            >
                Weight: {formatItemWeightKg(weightKg)} kg
            </p>
        )}
        </div>
    );
};


function renderInlineBold(text: string): React.ReactNode[] {
    return parseInlineBoldSegments(text).map((part, index) => {
        if (isDoubleBoldSegment(part) || isSingleBoldSegment(part)) {
            return <strong key={`${part}-${index}`}>{boldSegmentInner(part)}</strong>;
        }
        return <React.Fragment key={`${part}-${index}`}>{part}</React.Fragment>;
    });
}

function renderFormattedMultiline(value: string): React.ReactNode {
    const lines = splitQuotationLines(value);
    return (
        <>
            {lines.map((line, index) => (
                <p key={`line-${index}`} className="whitespace-pre-wrap">
                    {line === '' ? '\u00A0' : renderInlineBold(line)}
                </p>
            ))}
        </>
    );
}

const EditableSection: React.FC<{title: string, value: string, onChange: (value: string) => void}> = ({ title, value, onChange }) => {
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const id = useMemo(() => `editable-section-${title.toLowerCase().replace(/[\s&]+/g, '-').replace(/[^a-z0-9-]/g, 'x')}`, [title]);
    const [isEditing, setIsEditing] = useState(false);

    useEffect(() => {
        if (textareaRef.current) {
            textareaRef.current.style.height = 'auto';
            textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
        }
    }, [value, isEditing]);

    return (
        <div className="print-final-details mt-4" style={{breakInside: 'avoid'}}>
            <h3 id={id} className="font-bold text-sm mb-1 border-b border-gray-300 pb-1">{title}</h3>
            {isEditing ? (
                <textarea
                    ref={textareaRef}
                    id={id}
                    name={id}
                    value={value}
                    onChange={e => onChange(e.target.value)}
                    onPaste={(e) => pastePlainTextIntoTextarea(e, onChange)}
                    onBlur={() => setIsEditing(false)}
                    className="w-full text-xs whitespace-pre-wrap bg-transparent border-gray-300 rounded-md p-1 focus:ring-1 focus:ring-blue-500 focus:border-blue-500 print-editable"
                    style={{overflow: 'hidden'}}
                    aria-labelledby={id}
                    autoFocus
                />
            ) : (
                <div
                    className="w-full text-xs whitespace-pre-wrap bg-transparent border border-gray-300 rounded-md p-1 cursor-text min-h-[28px]"
                    onClick={() => setIsEditing(true)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(event) => {
                        if (event.key === 'Enter' || event.key === ' ') {
                            event.preventDefault();
                            setIsEditing(true);
                        }
                    }}
                >
                    {renderFormattedMultiline(value)}
                </div>
            )}
        </div>
    );
};

const getGlassDescription = (config: WindowConfig): string => {
    const formatType = (type: string) => type.replace(/_/g, ' ').replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());

    // Special handling for Mirrors
    if (config.windowType === WindowType.MIRROR) {
        if (config.customGlassName) {
            // If custom name seems to include thickness already, use it as is.
            if (/\d+\s*mm/i.test(config.customGlassName)) {
                return config.customGlassName;
            }
            // Otherwise, prepend thickness to the custom name.
            return `${config.glassThickness || '?'}mm ${config.customGlassName}`;
        }
        // Default description if no custom name
        return `${config.glassThickness || '?'}mm Mirror`;
    }

    if (config.glassSpecialType === 'laminated' && config.laminatedGlassConfig) {
        const { glass1Thickness, glass1Type, pvbThickness, glass2Thickness, glass2Type, isToughened } = config.laminatedGlassConfig;
        return `${glass1Thickness || '?'}mm ${formatType(glass1Type)} + ${pvbThickness || '?'}mm PVB + ${glass2Thickness || '?'}mm ${formatType(glass2Type)}${isToughened ? ' (Toughened)' : ''}`;
    }
    if (config.glassSpecialType === 'dgu' && config.dguGlassConfig) {
        const { glass1Thickness, glass1Type, airGap, glass2Thickness, glass2Type, isToughened } = config.dguGlassConfig;
        return `${glass1Thickness || '?'}mm ${formatType(glass1Type)} + ${airGap || '?'}mm Air Gap + ${glass2Thickness || '?'}mm ${formatType(glass2Type)}${isToughened ? ' (Toughened)' : ''}`;
    }
    
    // Fallback for simple glass
    let desc = `${config.glassThickness}mm ${formatType(config.glassType)}`;
    if (config.glassSpecialType !== 'none' && config.glassSpecialType) {
        desc += ` (${formatType(config.glassSpecialType)})`;
    }
    if (config.customGlassName) {
        desc += ` - ${config.customGlassName}`;
    }
    return desc;
}

const getItemDetails = (item: WindowQuotationItem) => {
    const { config, quantity } = item;
    const { windowType, shutterConfig } = config;
    const doorPositions = config.doorPositions ?? [];
    const ventilatorGrid = config.ventilatorGrid ?? [];

    const panelCounts: { [key: string]: number } = {};

    if (windowType === WindowType.SLIDING) {
        if (shutterConfig === ShutterConfigType.TWO_GLASS) panelCounts['Sliding Shutter'] = 2;
        else if (shutterConfig === ShutterConfigType.THREE_GLASS) panelCounts['Sliding Shutter'] = 3;
        else if (shutterConfig === ShutterConfigType.FOUR_GLASS) panelCounts['Sliding Shutter'] = 4;
        else if (shutterConfig === ShutterConfigType.FOUR_GLASS_TWO_MESH) {
            panelCounts['Sliding Shutter'] = 4;
            panelCounts['Mesh Shutter'] = 2;
        }
        else if (shutterConfig === ShutterConfigType.TWO_GLASS_ONE_MESH) {
            panelCounts['Sliding Shutter'] = 2;
            panelCounts['Mesh Shutter'] = 1;
        }
    } else if (windowType === WindowType.CASEMENT) {
        const vDiv = config.verticalDividers ?? [];
        const hDiv = config.horizontalDividers ?? [];
        const gridCells = (vDiv.length + 1) * (hDiv.length + 1);
        panelCounts['Openable Door'] = doorPositions.length;
        panelCounts['Fixed Panel'] = gridCells - doorPositions.length;
    } else if (windowType === WindowType.VENTILATOR) {
        ventilatorGrid.flat().forEach((cell) => {
            const cellType = cell?.type;
            if (!cellType) return;
            const typeName = cellType.replace('_', ' ').replace(/\b\w/g, (l) => l.toUpperCase());
            panelCounts[typeName] = (panelCounts[typeName] || 0) + 1;
        });
    }


    const hardwareDetails: { name: string, qty: number, rate: number, total: number }[] = [];
    for (const hw of item.hardwareItems ?? []) {
        const qtyPerUnit = Number(hw.qtyPerShutter) || 0;
        const unitsPerWindow = getQuotationHardwareUnitMultiplier(config, item.hardwareItems ?? [], hw);
        const totalQtyForItem = qtyPerUnit * unitsPerWindow * quantity;
        if (totalQtyForItem > 0) {
            hardwareDetails.push({
                name: hw.name,
                qty: totalQtyForItem,
                rate: Number(hw.rate) || 0,
                total: totalQtyForItem * (Number(hw.rate) || 0)
            });
        }
    }

    // Locks shown next to the elevation. Skip any item whose quantity ends up
    // zero for this window (handles mesh-lock on non-mesh sliding, friction-
    // stay-suppressed door holders/butt hinges, etc.).
    const hasMeshShutters =
      config.windowType === WindowType.SLIDING &&
      (config.shutterConfig === ShutterConfigType.TWO_GLASS_ONE_MESH ||
        config.shutterConfig === ShutterConfigType.FOUR_GLASS_TWO_MESH);

    const relevantHardware = (item.hardwareItems ?? []).filter((hw) => {
      const name = hw?.name || '';
      if (!isQuotationLockHardware(name)) return false;
      if (name.toLowerCase().includes('mesh') && !hasMeshShutters) return false;
      const multiplier = getQuotationHardwareUnitMultiplier(config, item.hardwareItems ?? [], hw);
      const qtyPerUnit = Number(hw.qtyPerShutter) || 0;
      return qtyPerUnit > 0 && multiplier > 0;
    });

    return { panelCounts, hardwareDetails, relevantHardware };
}

export const PrintPreview: React.FC<PrintPreviewProps> = ({
  isOpen,
  onClose,
  items,
  settings,
  setSettings,
  savedColors,
}) => {
  const colorPresets = useMemo(
    () => (savedColors?.length ? savedColors : loadSavedColorsFromStorage()),
    [savedColors],
  );

  const getColorName = (item: QuotationItem) => {
    if (item.kind === 'railing' || item.kind === 'window_package') return '—';
    return resolveProfileColorLabel(
      item.config.profileColor,
      item.profileColorName,
      colorPresets,
    );
  };
  const customer = settings.customer ?? {
    name: '',
    address: '',
    contactPerson: '',
    email: '',
    website: '',
    gstNumber: '',
    architectName: '',
  };

  const printContainerRef = useRef<HTMLDivElement>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [isPrinting, setIsPrinting] = useState(false);
  const [isArchitecturalMode, setIsArchitecturalMode] = useState(false);
  const [includeOpenViewDiagram, setIncludeOpenViewDiagram] = useState(true);
  const [openViewPrintAmount, setOpenViewPrintAmount] = useState(50);
  const [openViewPrintSwing, setOpenViewPrintSwing] = useState<'inside' | 'outside'>('outside');
  const isLikelyMobile = useMemo(() => {
    try {
      const ua = typeof navigator !== 'undefined' ? (navigator.userAgent || '') : '';
      const coarsePointer =
        typeof window !== 'undefined' &&
        typeof window.matchMedia === 'function' &&
        window.matchMedia('(pointer: coarse)').matches;
      return /android|iphone|ipad|ipod|mobile/i.test(ua) || coarsePointer;
    } catch {
      return false;
    }
  }, []);

  const quoteDate = useMemo(() => new Date().toLocaleDateString('en-GB'), []);
  const quoteNumber = useMemo(() => `WM-${Date.now().toString().slice(-6)}`, []);
  const pdfDateStamp = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const makingChargePerSqFt = Number(settings.materialRates?.makingChargePerSqFt) || 120;
  const resolvedMaterialRates = useMemo((): MaterialRateSettings => {
    const r = settings.materialRates;
    return {
      ...DEFAULT_MATERIAL_RATES,
      ...(r || {}),
      meshShutterOptions: {
        ...DEFAULT_MATERIAL_RATES.meshShutterOptions,
        ...(r?.meshShutterOptions || {}),
      },
      powderCoatingPerRft: {
        ...DEFAULT_MATERIAL_RATES.powderCoatingPerRft,
        ...(r?.powderCoatingPerRft || {}),
      },
      glassPerSqFt: {
        clear: { ...DEFAULT_MATERIAL_RATES.glassPerSqFt.clear, ...(r?.glassPerSqFt?.clear || {}) },
        laminated: { ...DEFAULT_MATERIAL_RATES.glassPerSqFt.laminated, ...(r?.glassPerSqFt?.laminated || {}) },
        dgu: { ...DEFAULT_MATERIAL_RATES.glassPerSqFt.dgu, ...(r?.glassPerSqFt?.dgu || {}) },
      },
      profit: { ...DEFAULT_MATERIAL_RATES.profit, ...(r?.profit || {}) },
    };
  }, [settings.materialRates]);
  const materialCostSummary = useMemo(
    () => calculateMaterialCostSummary(items, resolvedMaterialRates, makingChargePerSqFt),
    [items, resolvedMaterialRates, makingChargePerSqFt]
  );
  const hasOpenViewQuotationItems = useMemo(
    () =>
      items.some((item) => {
        if (isWindowQuotationItem(item)) {
          return getOpenViewPrintConfigs(item.config).length > 0;
        }
        if (isWindowPackageQuotationItem(item)) {
          return item.units.some((u) => getOpenViewPrintConfigs(u.config).length > 0);
        }
        return false;
      }),
    [items],
  );

  const { subTotal, discountAmount, totalAfterDiscount, gstAmount, grandTotal } = useMemo(
    () => computeQuotationFinancials(items, settings, materialCostSummary.totals.profitCost),
    [items, settings, materialCostSummary.totals.profitCost],
  );

  const formatLineMoney = (n: number) =>
    n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  useEffect(() => {
    if (isOpen) preloadHtml2Pdf();
  }, [isOpen]);

  const pdfCaptureOpts = useCallback(
    (element: HTMLElement) => {
      const captureW = element.scrollWidth || element.offsetWidth || 800;
      const captureH = element.scrollHeight || element.offsetHeight || 1100;
      return {
        filename: quotationPdfFilename(customer.name, pdfDateStamp),
        captureW,
        captureH,
        canvasScale: isLikelyMobile ? 1.5 : 2,
        stampPageNumbers: stampWoodenMaxPageNumbers,
      };
    },
    [customer.name, pdfDateStamp, isLikelyMobile],
  );

  const handleExportPdf = async () => {
    const element = printContainerRef.current?.querySelector<HTMLElement>('.a4-page');
    if (!element || isExporting || isPrinting) return;

    setIsExporting(true);
    element.classList.add('pdf-export-mode');
    try {
      await saveQuotationPdf(element, pdfCaptureOpts(element));
    } catch (err) {
      console.error('PDF export failed', err);
      alert('Sorry, there was an error exporting the PDF.');
    } finally {
      setIsExporting(false);
      element.classList.remove('pdf-export-mode');
    }
  };

  const handlePrint = async () => {
    if (isExporting || isPrinting) return;
    const element = printContainerRef.current?.querySelector<HTMLElement>('.a4-page');
    if (!element) return;

    if (typeof window.print !== 'function') {
      await handleExportPdf();
      return;
    }

    setIsPrinting(true);
    element.classList.add('pdf-export-mode');
    try {
      const pdf = await captureQuotationPdf(element, pdfCaptureOpts(element));
      await openPdfBlobPrintDialog(pdf.output('blob'));
    } catch (err) {
      console.error('Print via PDF failed', err);
      try {
        const prevTitle = document.title;
        document.title = printDocumentTitleForQuotation(customer.name);
        printContainerRef.current?.scrollTo(0, 0);
        window.scrollTo(0, 0);
        window.print();
        document.title = prevTitle;
      } catch {
        await handleExportPdf();
      }
    } finally {
      setIsPrinting(false);
      element.classList.remove('pdf-export-mode');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-slate-900 z-[70] flex flex-col print-preview-modal">
        {isExporting && (
          <div className="absolute inset-0 bg-black bg-opacity-75 flex flex-col items-center justify-center z-[100] no-print">
            <svg className="animate-spin h-10 w-10 text-white mb-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            <h3 className="text-white text-xl font-bold">Generating PDF...</h3>
            <p className="text-slate-300">This may take a moment. Please wait.</p>
          </div>
        )}
        <div className="flex-shrink-0 bg-slate-800 p-3 flex justify-between items-center no-print">
            <div>
                <h2 className="text-xl font-bold text-white">Print Preview</h2>
                <p className="text-xs text-slate-400">Review your quotation below before printing or exporting.</p>
            </div>
            <div className="flex gap-2">
                <Button onClick={handleExportPdf} variant="secondary" disabled={isExporting || isPrinting}>
                    {isExporting ? 'Exporting...' : <><DownloadIcon className="w-5 h-5 mr-2"/> Export PDF</>}
                </Button>
                <Button onClick={handlePrint} disabled={isExporting || isPrinting}>
                  <PrinterIcon className="w-5 h-5 mr-2"/> {isPrinting ? 'Printing...' : 'Print'}
                </Button>
                <Button onClick={onClose} variant="secondary"><XMarkIcon className="w-5 h-5 mr-2"/> Close</Button>
            </div>
        </div>
        <div className="flex-shrink-0 bg-slate-800 p-3 flex-wrap flex justify-start items-center gap-4 no-print border-t border-slate-700">
             <label className="flex items-center space-x-2 cursor-pointer text-white">
                <input
                    type="checkbox"
                    checked={isArchitecturalMode}
                    onChange={e => setIsArchitecturalMode(e.target.checked)}
                    className="w-4 h-4 rounded bg-slate-700 border-slate-500 text-indigo-600 focus:ring-indigo-500"
                />
                <span>Architectural Version</span>
            </label>
            <label
              className={`flex items-center space-x-2 cursor-pointer text-white ${hasOpenViewQuotationItems ? '' : 'opacity-50'}`}
              title={
                hasOpenViewQuotationItems
                  ? 'Main canvas elevation + plan at 50% — label shows sliding / casement / bi-fold per line'
                  : 'No operable windows in this quotation'
              }
            >
                <input
                    type="checkbox"
                    checked={includeOpenViewDiagram && hasOpenViewQuotationItems}
                    disabled={!hasOpenViewQuotationItems}
                    onChange={e => setIncludeOpenViewDiagram(e.target.checked)}
                    className="w-4 h-4 rounded bg-slate-700 border-slate-500 text-indigo-600 focus:ring-indigo-500 disabled:opacity-40"
                />
                <span>Canvas design + plan view</span>
            </label>
            {includeOpenViewDiagram && hasOpenViewQuotationItems ? (
              <div className="flex flex-wrap items-end gap-3 text-white text-xs">
                <label className="flex min-w-[140px] flex-col gap-1">
                  <span>Open amount ({openViewPrintAmount}%)</span>
                  <input
                    type="range"
                    min={0}
                    max={100}
                    value={openViewPrintAmount}
                    onChange={(e) => setOpenViewPrintAmount(Number(e.target.value))}
                    className="w-full accent-indigo-500"
                  />
                </label>
                <label className="flex flex-col gap-1">
                  <span>Swing</span>
                  <select
                    value={openViewPrintSwing}
                    onChange={(e) => setOpenViewPrintSwing(e.target.value as 'inside' | 'outside')}
                    className="rounded bg-slate-700 px-2 py-1 text-xs"
                  >
                    <option value="outside">Outside open</option>
                    <option value="inside">Inside open</option>
                  </select>
                </label>
              </div>
            ) : null}
            {isArchitecturalMode && (
                <div className="w-64">
                    <Input
                        id="architect-name"
                        name="architect-name"
                        label="Architect's Name"
                        value={customer.architectName || ''}
                        onChange={e => setSettings({ ...settings, customer: { ...customer, architectName: e.target.value }})}
                        placeholder="Enter Architect's Name"
                        className="!py-1"
                    />
                </div>
            )}
        </div>
        <div ref={printContainerRef} className="flex-grow overflow-y-auto bg-slate-900 print-preview-container custom-scrollbar">
            <div className={`a4-page single-scroll-preview text-black ${isArchitecturalMode ? 'architectural-mode' : ''}`}>
                {/* --- Start of Printable Content --- */}
                <div className="print-header" style={{height: 'auto'}}>
                    <div className="flex justify-between items-start">
                        <div className="flex items-start gap-4">
                            <img src={settings.company.logo || '/logo.jpg'} alt="Company Logo" className="w-20 h-20 object-contain" />
                            <div>
                                <h2 className="text-2xl font-bold text-black">{settings.company.name}</h2>
                                <p className="text-xs whitespace-pre-wrap">{settings.company.address}</p>
                                <p className="text-xs">
                                    {settings.company.email ? (
                                        <a href={`mailto:${settings.company.email}`} className="underline">
                                            {settings.company.email}
                                        </a>
                                    ) : null}
                                    {settings.company.email && settings.company.website ? ' | ' : ''}
                                    {settings.company.website ? (
                                        <a href={normalizeWebsiteUrl(settings.company.website)} target="_blank" rel="noreferrer" className="underline">
                                            {settings.company.website}
                                        </a>
                                    ) : null}
                                </p>
                                {settings.company.gstNumber ? (
                                    <p className="text-xs"><strong>GSTIN:</strong> {(settings.company.gstNumber || '').toUpperCase()}</p>
                                ) : null}
                            </div>
                        </div>
                        <div className="text-right text-xs">
                            <p><strong>Date:</strong> {quoteDate}</p>
                            <p><strong>Quote #:</strong> {quoteNumber}</p>
                        </div>
                    </div>
                    <div className="flex justify-between text-xs mt-4">
                        <div className="bg-gray-100 p-2 rounded w-full">
                            <h3 className="font-bold mb-1">To:</h3>
                            <p className="font-semibold">{customer.name}</p>
                            <p className="whitespace-pre-wrap">{customer.address}</p>
                            <p><strong>Attn:</strong> {customer.contactPerson}</p>
                            {customer.email ? (
                                <p>
                                    <strong>Email:</strong>{' '}
                                    <a href={`mailto:${customer.email}`} className="underline">{customer.email}</a>
                                </p>
                            ) : null}
                            {customer.website ? (
                                <p>
                                    <strong>Website:</strong>{' '}
                                    <a href={normalizeWebsiteUrl(customer.website)} target="_blank" rel="noreferrer" className="underline">
                                        {customer.website}
                                    </a>
                                </p>
                            ) : null}
                            {customer.gstNumber ? (
                                <p><strong>GSTIN:</strong> {(customer.gstNumber || '').toUpperCase()}</p>
                            ) : null}
                            <div className="show-for-arch mt-1">
                                <p><strong>Architect:</strong> {customer.architectName || 'N/A'}</p>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="print-content" style={{display: 'block'}}>
                    <h3 className="text-xl font-bold text-black text-center my-4">{settings.title}</h3>
                    <div className="w-full text-[8pt]">
                        <table className="w-full" style={{borderCollapse: 'collapse'}}>
                            <thead className="bg-gray-200">
                                <tr className="border-b-2 border-t-2 border-black">
                                    <th className="p-1 text-center w-[4%]">#</th>
                                    <th className="p-1 text-left" colSpan={2}>Item Description</th>
                                    <th className="p-1 text-right print-qty-amount-col" colSpan={3}>
                                      <span className="show-for-arch">Qty</span>
                                      <span className="hide-for-arch">Qty · Amount</span>
                                    </th>
                                </tr>
                            </thead>
                            <tbody>
                                {items.map((item, index) => {
                                    if (item.kind === 'railing') {
                                      const rl = item.railingLine;
                                      return (
                                        <tr
                                          key={item.id}
                                          className="border-b border-gray-300 print-item"
                                          style={{ breakInside: 'avoid', pageBreakInside: 'avoid' }}
                                        >
                                          <td className="p-2 align-top text-center">{index + 1}</td>
                                          <td className="p-2 align-top" colSpan={5}>
                                            <div className="wm-railing-quote-print text-[8pt] text-slate-900">
                                              <RailingQuotationLinePrintBlock
                                                line={rl}
                                                index={index}
                                                listRowTitle={item.title}
                                                hidePricesForArchitect={isArchitecturalMode}
                                              />
                                            </div>
                                          </td>
                                        </tr>
                                      );
                                    }

                                    if (isWindowPackageQuotationItem(item)) {
                                      const totalCost = quotationItemLineTotal(item);
                                      const combinedArea = packageCombinedArea(item);
                                      const packageWeightKg = expandPackageToWindowItems(item).reduce(
                                        (s, u) => s + (materialCostSummary.byItemId[u.id]?.totalWeightKg ?? 0),
                                        0,
                                      );

                                      const openAmountFrac = openViewPrintAmount / 100;
                                      const unitConfigs = item.units.map((u) => u.config);

                                      return (
                                        <tr
                                          key={item.id}
                                          className="border-b border-gray-300 print-item print-item-package"
                                        >
                                          <td className="p-2 align-top text-center">{index + 1}</td>
                                          <td className="p-2 align-top" colSpan={2}>
                                            <div className="print-item-layout">
                                              <PrintVisualStack
                                                elevation={
                                                  <PrintElevationSlot
                                                    widthMm={item.layoutWidthMm}
                                                    heightMm={item.layoutHeightMm}
                                                    photo={item.printElevationPhoto}
                                                  >
                                                    <PrintableLayoutPackage
                                                      item={item}
                                                      fitSlotMm={PRINT_ELEVATION_SLOT_MM}
                                                    />
                                                  </PrintElevationSlot>
                                                }
                                                sizeChart={<PrintPackageSizeChart item={item} />}
                                                secondary={
                                                  includeOpenViewDiagram ? (
                                                    <PrintOpenViewsSecondary
                                                      configs={unitConfigs}
                                                      openAmount={openAmountFrac}
                                                      swingSide={openViewPrintSwing}
                                                    />
                                                  ) : null
                                                }
                                                footer={
                                                  packageWeightKg > 0 ? (
                                                    <p className="print-visual-footer text-[6.5pt] text-gray-600">
                                                      Est. weight: {formatItemWeightKg(packageWeightKg)}
                                                    </p>
                                                  ) : null
                                                }
                                              />
                                              <div className="print-item-main min-w-0">
                                                <p className="font-bold print-window-title">{item.title}</p>
                                                <p className="text-[7pt] text-gray-600 mt-0.5">
                                                  {packageCombinedSubtitle(item)}
                                                </p>
                                                <div className="print-package-units-grid">
                                                  {item.units.map((unit) => {
                                                    const fauxItem: WindowQuotationItem = {
                                                      kind: 'window',
                                                      id: unit.id,
                                                      title: unit.title,
                                                      config: unit.config,
                                                      quantity: item.quantity,
                                                      areaType: item.areaType,
                                                      rate: unit.rate,
                                                      hardwareCost: unit.hardwareCost,
                                                      hardwareItems: unit.hardwareItems,
                                                      profileColorName: unit.profileColorName,
                                                    };
                                                    const { panelCounts, relevantHardware } = getItemDetails(fauxItem);
                                                    const glassDescription = getGlassDescription(unit.config);
                                                    const area = unitArea(unit, item.areaType, item.quantity);
                                                    const amount = unitLineAmount(unit, item.areaType, item.quantity);
                                                    const colorLabel = resolveProfileColorLabel(
                                                      unit.config.profileColor,
                                                      unit.profileColorName,
                                                      colorPresets,
                                                    );

                                                    return (
                                                      <div key={unit.id} className="print-package-unit-card">
                                                        <p className="font-bold text-[7pt] leading-tight">
                                                          {unit.title} — {formatWindowTypeLabel(unit.config.windowType)}
                                                        </p>
                                                        <table className="print-package-unit-table">
                                                          <tbody>
                                                            <tr>
                                                              <td>Area</td>
                                                              <td>{area.toFixed(2)} {item.areaType}</td>
                                                            </tr>
                                                            <tr className="hide-for-arch">
                                                              <td>Amount</td>
                                                              <td className="font-semibold">₹{Math.round(amount).toLocaleString('en-IN')}</td>
                                                            </tr>
                                                            <tr>
                                                              <td>Series</td>
                                                              <td>{unit.config.series?.name ?? '—'}</td>
                                                            </tr>
                                                            <tr>
                                                              <td>Color</td>
                                                              <td>{colorLabel}</td>
                                                            </tr>
                                                            <tr>
                                                              <td>Glass</td>
                                                              <td>{glassDescription}</td>
                                                            </tr>
                                                            {Object.entries(panelCounts).map(
                                                              ([name, count]) =>
                                                                count > 0 ? (
                                                                  <tr key={name}>
                                                                    <td>{name}</td>
                                                                    <td>{count} Nos.</td>
                                                                  </tr>
                                                                ) : null,
                                                            )}
                                                            {relevantHardware.length > 0 ? (
                                                              <tr>
                                                                <td>Lock</td>
                                                                <td>{relevantHardware.map((hw) => hw.name).join(', ')}</td>
                                                              </tr>
                                                            ) : null}
                                                          </tbody>
                                                        </table>
                                                      </div>
                                                    );
                                                  })}
                                                  <div className="print-package-total hide-for-arch">
                                                    <span>Package total</span>
                                                    <span>{combinedArea.toFixed(2)} {item.areaType}</span>
                                                    <span className="font-bold">₹{formatLineMoney(totalCost)}</span>
                                                  </div>
                                                </div>
                                              </div>
                                            </div>
                                          </td>
                                          <td className="p-1 align-top print-qty-amount-cell" colSpan={3}>
                                            <div className="print-qty-amount">
                                              <span className="print-qty">Qty: {item.quantity}</span>
                                              <span className="print-line-total hide-for-arch">
                                                ₹{formatLineMoney(totalCost)}
                                              </span>
                                            </div>
                                          </td>
                                        </tr>
                                      );
                                    }

                                    const conversionFactor = item.areaType === 'sqft' ? 304.8 : 1000;
                                    const singleArea =
                                      getWindowQuotationAreaMm2(item.config) /
                                      (conversionFactor * conversionFactor);
                                    const totalArea = singleArea * item.quantity;
                                    const totalCost = quotationItemLineTotal(item);
                                    const unitAmount = (singleArea * (Number(item.rate) || 0)) + (Number(item.hardwareCost) || 0);

                                    const { panelCounts, relevantHardware } = getItemDetails(item);
                                    const glassDescription = getGlassDescription(item.config);
                                    const itemWeight = materialCostSummary.byItemId[item.id];
                                    
                                    let isFrameless = false;
                                    if (item.config.windowType === WindowType.MIRROR) {
                                        isFrameless = Boolean(item.config.mirrorConfig?.isFrameless);
                                    } else if (item.config.windowType === WindowType.GLASS_PARTITION) {
                                        const partitionPanels = item.config.partitionPanels;
                                        const types = partitionPanels?.types ?? [];
                                        const hasFramedPanels = types.some(p => p.type === 'hinged' || p.framing === 'full');
                                        if (partitionPanels && !partitionPanels.hasTopChannel && !hasFramedPanels) {
                                            isFrameless = true;
                                        }
                                    }

                                    const winW = Number(item.config.width) || 1;
                                    const winH = Number(item.config.height) || 1;
                                    const compactScale = fitScalePxPerMm(winW, winH, PRINT_ELEVATION_SLOT_MM);

                                    return (
                                        <tr key={item.id} className="border-b border-gray-300 print-item print-item-window">
                                            <td className="p-2 align-top text-center">{index + 1}</td>
                                            <td className="p-2 align-top" colSpan={2}>
                                              <div className="print-item-layout">
                                                <PrintVisualStack
                                                  elevation={
                                                    <PrintElevationSlot
                                                      widthMm={winW}
                                                      heightMm={winH}
                                                      photo={item.printElevationPhoto}
                                                    >
                                                      <PrintableWindow
                                                        config={item.config}
                                                        externalScale={compactScale}
                                                        printCompact
                                                      />
                                                    </PrintElevationSlot>
                                                  }
                                                  sizeChart={<PrintWindowSizeChart config={item.config} />}
                                                  secondary={
                                                    includeOpenViewDiagram ? (
                                                      <PrintOpenViewsSecondary
                                                        configs={[item.config]}
                                                        openAmount={openViewPrintAmount / 100}
                                                        swingSide={openViewPrintSwing}
                                                      />
                                                    ) : null
                                                  }
                                                  footer={
                                                    itemWeight && itemWeight.totalWeightKg > 0 ? (
                                                      <p className="print-visual-footer text-[6.5pt] text-gray-600">
                                                        Est. weight: {formatItemWeightKg(itemWeight.totalWeightKg)}
                                                      </p>
                                                    ) : null
                                                  }
                                                />
                                                <div className="print-item-main min-w-0">
                                                <p className="font-bold print-window-title">{item.title}</p>
                                                <table className="w-full text-[7pt] mt-1 details-table">
                                                    <tbody>
                                                        <tr><td className='pr-2 font-semibold'>Series:</td><td>{item.config.series.name}</td></tr>
                                                        <tr><td className='pr-2 font-semibold'>Area:</td><td>{totalArea.toFixed(2)} {item.areaType}</td></tr>
                                                        <tr className="hide-for-arch"><td className='pr-2 font-semibold'>Unit Amount:</td><td>₹{Math.round(unitAmount).toLocaleString('en-IN')}</td></tr>
                                                        {!isFrameless && (
                                                            <tr><td className='pr-2 font-semibold'>Profile Color:</td><td>{getColorName(item)}</td></tr>
                                                        )}
                                                        <tr><td className='pr-2 font-semibold'>Glass:</td><td>{glassDescription}</td></tr>
                                                        {Object.entries(panelCounts).map(([name, count]) => count > 0 && (<tr key={name}><td className='pr-2 font-semibold'>{name}:</td><td>{count} Nos.</td></tr>))}
                                                        {relevantHardware.length > 0 && (
                                                            <tr>
                                                                <td className='pr-2 font-semibold pt-1 align-top'>Lock:</td>
                                                                <td className='pt-1'>
                                                                    {relevantHardware.map((hw, i) => (
                                                                        <span key={i} className="block">{hw.name}</span>
                                                                    ))}
                                                                </td>
                                                            </tr>
                                                        )}
                                                    </tbody>
                                                </table>
                                                </div>
                                              </div>
                                            </td>
                                            <td className="p-1 align-top print-qty-amount-cell" colSpan={3}>
                                              <div className="print-qty-amount">
                                                <span className="print-qty">Qty: {item.quantity}</span>
                                                <span className="print-line-total hide-for-arch">
                                                  ₹{formatLineMoney(totalCost)}
                                                </span>
                                              </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>

                    <div className="print-summary final-summary-page" style={{breakInside: 'avoid'}}>
                        <div className="flex justify-end mt-4 hide-for-arch">
                            <div className="w-2/5 text-xs">
                                <table className="w-full">
                                    <tbody>
                                        <tr className="border-b border-gray-300">
                                            <td className="py-1 pr-4">Sub-Total</td>
                                            <td className="py-1 text-right font-semibold">₹{subTotal.toLocaleString('en-IN', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</td>
                                        </tr>
                                        <tr className="border-b border-gray-300">
                                            <td className="py-1 pr-4">Discount ({settings.financials?.discountType === 'percentage' ? `${settings.financials?.discount ?? 0}%` : 'Fixed'})</td>
                                            <td className="py-1 text-right font-semibold">(-) ₹{discountAmount.toLocaleString('en-IN', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</td>
                                        </tr>
                                        <tr className="border-b-2 border-black">
                                            <td className="py-1 pr-4 font-bold">Total before Tax</td>
                                            <td className="py-1 text-right font-bold">₹{totalAfterDiscount.toLocaleString('en-IN', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</td>
                                        </tr>
                                        <tr className="border-b border-gray-300">
                                            <td className="py-1 pr-4">GST @ {settings.financials?.gstPercentage ?? 0}%</td>
                                            <td className="py-1 text-right font-semibold">(+) ₹{gstAmount.toLocaleString('en-IN', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</td>
                                        </tr>
                                        <tr className="border-t-2 border-black bg-gray-200">
                                            <td className="p-2 pr-4 font-bold text-sm">Grand Total</td>
                                            <td className="p-2 text-right font-bold text-sm">₹{grandTotal.toLocaleString('en-IN', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>
                        </div>
                        <div className="text-xs mt-2 text-right font-bold hide-for-arch">
                            <p>Amount in Words: {amountToWords(grandTotal)}</p>
                        </div>
                        
                        <EditableSection title="Description" value={settings.description} onChange={(val) => setSettings({...settings, description: val})} />
                        <div className="hide-for-arch">
                            <EditableSection title="Terms & Conditions" value={settings.terms} onChange={(val) => setSettings({...settings, terms: val})} />
                        </div>
                        
                        <div className="flex justify-between items-start mt-12 pt-4 border-t-2 border-gray-400 text-xs hide-for-arch" style={{breakBefore: 'avoid'}}>
                            <div className="flex-grow">
                                <h3 className="font-bold text-sm mb-1">Bank Details</h3>
                                <p><strong>A/C Name:</strong> {settings.bankDetails.name}</p>
                                <p><strong>A/C No:</strong> {settings.bankDetails.accountNumber}</p>
                                <p><strong>IFSC:</strong> {settings.bankDetails.ifsc}</p>
                                <p><strong>Branch:</strong> {settings.bankDetails.branch}</p>
                                <p><strong>A/C Type:</strong> {settings.bankDetails.accountType}</p>
                            </div>
                            <div className="w-1/3 text-center self-end">
                                <div className="border-t-2 border-black pt-2 mt-16">
                                    Authorised Signature
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="print-footer-container">
                        <div className="print-footer">
                            <div className="text-right text-[7pt] self-end">
                                Page <span className="page-counter"></span>
                            </div>
                        </div>
                    </div>
                </div>
                {/* --- End of Printable Content --- */}
            </div>
        </div>
    </div>
  );
};
