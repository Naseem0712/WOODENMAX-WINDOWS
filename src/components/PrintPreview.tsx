
import React, { useMemo, useRef, useState, useEffect, useId } from 'react';
import type { QuotationItem, QuotationSettings, WindowConfig, HandleConfig } from '../types';
import { Button } from './ui/Button';
import { PrinterIcon } from './icons/PrinterIcon';
import { XMarkIcon } from './icons/XMarkIcon';
import { FixedPanelPosition, ShutterConfigType, WindowType, MirrorShape } from '../types';
import { DownloadIcon } from './icons/DownloadIcon';
import { Input } from './ui/Input';
import { WindowHandleVisual } from './WindowHandleVisual';
import {
  slidingMemberSideStandard,
  mirrorHandleForSlidingMember,
  mirrorHandleForPartitionHandleX,
} from '../utils/handleDefaults';
import { PROFILE_TEXTURE_TILE, profileTexturePosition } from '../utils/profileTexture';
import { quotationPdfFilename, printDocumentTitleForQuotation } from '../utils/pdfFilename';
import {
  PARTITION_PANEL_GAP_MM,
  getPartitionPanelWidthsMm,
  isOperablePartitionType,
  clampFoldLeafCount,
  getPartitionPanelTopMm,
} from '../utils/partitionPanelGeometry';
import { resolveFoldFrameEdges } from '../utils/foldDoorFrame';
import { FoldDoorOpeningGraphic } from './FoldDoorOpeningVisual';
import { autoContinueTermsSerial, normalizeWebsiteUrl } from '../utils/quotationText';

function profileOverlayTexture(config: WindowConfig): string | undefined {
  return config.profileColor.startsWith('#') ? config.profileTexture || undefined : undefined;
}

interface PrintPreviewProps {
  isOpen: boolean;
  onClose: () => void;
  items: QuotationItem[];
  settings: QuotationSettings;
  setSettings: (settings: QuotationSettings) => void;
}

const mmToPx = (mm: number, scale: number) => Math.round(mm * scale * 100) / 100;

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

        // Horizontal bars
        for (let i = 0; i < pattern.horizontal.count; i++) {
            const top = (pattern.horizontal.offset + i * pattern.horizontal.gap) * scale - barThicknessScaled / 2;
            if (top > height * scale || top < -barThicknessScaled) continue;
            elements.push(<PrintProfilePiece key={`h-grid-${i}`} color={profileColor} texture={profileOverlayTexture(config)} style={{ top, left: 0, width: width * scale, height: barThicknessScaled }} />);
        }

        // Vertical bars
        for (let i = 0; i < pattern.vertical.count; i++) {
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
        if (cols > 0) {
            const hGap = (width * scale) / (cols + 1);
            for (let i = 1; i <= cols; i++) {
                elements.push(<PrintProfilePiece key={`v-grid-${i}`} color={profileColor} texture={profileOverlayTexture(config)} style={{ left: i * hGap - barThicknessScaled / 2, top: 0, width: barThicknessScaled, height: height * scale }} />);
            }
        }
        return <>{elements}</>;
    }

    return null;
};


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
}> = ({ width, height, profileSize = 0, topSize, bottomSize, leftSize, rightSize, scale, color, texture }) => {
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
            boxShadow: 'inset 0 0 0 1px rgba(0,0,0,0.25)',
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
            </div>
        );
    }

    if (hexWithOverlay) {
        const solidBase: React.CSSProperties = {
            position: 'absolute',
            boxSizing: 'border-box',
            boxShadow: 'inset 0 0 0 1px rgba(0,0,0,0.25)',
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
            </div>
        );
    }

    return (
        <div
            style={{
                position: 'absolute',
                width: wPx,
                height: hPx,
                boxSizing: 'border-box',
                borderStyle: 'solid',
                borderColor: baseHex,
                borderRadius: 0,
                borderTopWidth: ts,
                borderBottomWidth: bs,
                borderLeftWidth: ls,
                borderRightWidth: rs,
                backgroundColor: 'transparent',
            }}
        />
    );
};

const PrintableHandle: React.FC<{ config: HandleConfig | null; scale: number; mirrored?: boolean }> = ({ config, scale, mirrored }) => {
    if (!config) return null;
    const gid = useId().replace(/:/g, '');
    const variant = config.variant ?? (config.orientation === 'horizontal' ? 'sliding' : 'casement');
    const raw = config.length ?? (variant === 'sliding' ? 125 : 158);
    const lenMm = Math.min(420, Math.max(96, raw));
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


const PrintableWindow: React.FC<{ config: WindowConfig, externalScale?: number }> = ({ config, externalScale }) => {
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

    const containerWidthPx = 150; // max width in pixels
    const containerHeightPx = 200; // max height in pixels
    const numWidth = Number(config.width) || 1;
    const numHeight = Number(config.height) || 1;
    
    const effectiveWidth = numWidth;
    const scale = externalScale || Math.min(containerWidthPx / effectiveWidth, containerHeightPx / numHeight);

    const { series, fixedPanels, profileColor, windowType, glassTexture } = config;
    const pt = profileOverlayTexture(config);
    const dims = {
        outerFrame: Number(series.dimensions.outerFrame) || 0,
        outerFrameVertical: Number(series.dimensions.outerFrameVertical) || 0,
        fixedFrame: Number(series.dimensions.fixedFrame) || 0,
        shutterHandle: Number(series.dimensions.shutterHandle) || 0, shutterInterlock: Number(series.dimensions.shutterInterlock) || 0,
        shutterTop: Number(series.dimensions.shutterTop) || 0, shutterBottom: Number(series.dimensions.shutterBottom) || 0,
        shutterMeeting: Number(series.dimensions.shutterMeeting) || 0, casementShutter: Number(series.dimensions.casementShutter) || 0,
        mullion: Number(series.dimensions.mullion) || 0, louverBlade: Number(series.dimensions.louverBlade) || 0,
        topTrack: Number(series.dimensions.topTrack) || 0, bottomTrack: Number(series.dimensions.bottomTrack) || 0, 
        glassGridProfile: Number(config.glassGrid?.barThickness) || Number(series.dimensions.glassGridProfile) || 0,
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
    
    // Outer frame
    if (windowType !== WindowType.GLASS_PARTITION && windowType !== WindowType.CORNER && windowType !== WindowType.MIRROR && windowType !== WindowType.LOUVERS) {
        const verticalFrame = dims.outerFrameVertical > 0 ? dims.outerFrameVertical : dims.outerFrame;
        profileElements.push(<PrintableMiteredFrame key="outer-frame" width={effectiveWidth} height={numHeight} topSize={dims.outerFrame} bottomSize={dims.outerFrame} leftSize={verticalFrame} rightSize={verticalFrame} scale={scale} color={profileColor} texture={pt} />);
    }
    
    const frameOffset = (windowType !== WindowType.GLASS_PARTITION && windowType !== WindowType.CORNER && windowType !== WindowType.MIRROR && windowType !== WindowType.LOUVERS) ? dims.outerFrame : 0;
    const holeX1 = leftFix ? leftFixSize : frameOffset;
    const holeY1 = topFix ? topFixSize : frameOffset;
    const holeX2 = rightFix ? numWidth - rightFixSize : numWidth - frameOffset;
    const holeY2 = bottomFix ? numHeight - bottomFixSize : numHeight - frameOffset;
    
    // Fixed Panel frames and glass
    if (leftFix) {
        profileElements.push(<PrintProfilePiece key="divider-left" color={profileColor} texture={pt} style={{ top: frameOffset * scale, left: (holeX1 - dims.fixedFrame) * scale, width: dims.fixedFrame * scale, height: (numHeight - 2 * frameOffset) * scale }} />);
        labelElements.push(<PrintDimensionLabel key="label-left" value={leftFix.size} className="top-1/2 -translate-y-1/2" style={{left: leftFix.size * scale / 2, transform: 'translateX(-50%)'}}/>)
    }
    if (rightFix) profileElements.push(<PrintProfilePiece key="divider-right" color={profileColor} texture={pt} style={{ top: frameOffset * scale, left: holeX2 * scale, width: dims.fixedFrame * scale, height: (numHeight - 2 * frameOffset) * scale }} />);
    
    const hDividerX = leftFix ? holeX1 : frameOffset;
    const hDividerWidth = (rightFix ? holeX2 : numWidth - frameOffset) - hDividerX;

    if (topFix) {
        profileElements.push(<PrintProfilePiece key="divider-top" color={profileColor} texture={pt} style={{ top: (holeY1 - dims.fixedFrame) * scale, left: hDividerX * scale, width: hDividerWidth * scale, height: dims.fixedFrame * scale }} />);
        const glassW = hDividerWidth;
        const glassH = holeY1 - frameOffset - dims.fixedFrame;
        glassElements.push(<GlassPanel key="glass-top" panelId="fixed-top" style={{ top: frameOffset * scale, left: hDividerX * scale, width: glassW * scale, height: glassH * scale }} glassWidthPx={glassW*scale} glassHeightPx={glassH*scale}><PrintShutterIndicator type="fixed"/></GlassPanel>);
        labelElements.push(<PrintDimensionLabel key="label-top" value={topFix.size} className="left-1/2 -translate-x-1/2" style={{top: topFix.size * scale / 2}}/>)
    }
    if (bottomFix) {
        profileElements.push(<PrintProfilePiece key="divider-bottom" color={profileColor} texture={pt} style={{ top: holeY2 * scale, left: hDividerX * scale, width: hDividerWidth * scale, height: dims.fixedFrame * scale }} />);
        const glassW = hDividerWidth;
        const glassH = numHeight - holeY2 - frameOffset - dims.fixedFrame;
        glassElements.push(<GlassPanel key="glass-bottom" panelId="fixed-bottom" style={{ top: (holeY2 + dims.fixedFrame) * scale, left: hDividerX * scale, width: glassW * scale, height: glassH * scale }} glassWidthPx={glassW*scale} glassHeightPx={glassH*scale}><PrintShutterIndicator type="fixed"/></GlassPanel>);
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
    
    const innerAreaWidth = holeX2 - holeX1;
    const innerAreaHeight = holeY2 - holeY1;

    const PrintSlidingShutter: React.FC<{
        width: number; height: number; topProfile: number; bottomProfile: number; leftProfile: number; rightProfile: number;
        isMesh: boolean; isFixed?: boolean; isSliding?: boolean; panelId: string;
    }> = ({ width, height, topProfile, bottomProfile, leftProfile, rightProfile, isMesh, isFixed = false, isSliding = false, panelId }) => {
        const glassWidth = width - leftProfile - rightProfile;
        const glassHeight = height - topProfile - bottomProfile;
        const meshStyle: React.CSSProperties = isMesh ? {backgroundColor: '#ccc', opacity: 0.6, backgroundImage: `linear-gradient(45deg, #aaa 25%, transparent 25%), linear-gradient(-45deg, #aaa 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #aaa 75%), linear-gradient(-45deg, transparent 75%, #aaa 75%)`, backgroundSize: '3px 3px' } : {};
        const wPx = mmToPx(width, scale);
        const hPx = mmToPx(height, scale);
        const lPx = mmToPx(leftProfile, scale);
        const tPx = mmToPx(topProfile, scale);
        const rPx = mmToPx(rightProfile, scale);
        const bPx = mmToPx(bottomProfile, scale);

        return (
            <div className="absolute" style={{ width: wPx, height: hPx }}>
                <PrintableMiteredFrame 
                    width={width} 
                    height={height} 
                    scale={scale} 
                    color={profileColor} 
                    texture={pt}
                    topSize={topProfile} 
                    bottomSize={bottomProfile} 
                    leftSize={leftProfile} 
                    rightSize={rightProfile} 
                />
                <div className="absolute overflow-hidden" style={{ left: lPx, top: tPx, right: rPx, bottom: bPx }}>
                    <GlassPanel panelId={panelId} style={{ position: 'absolute', left: 0, top: 0, width: '100%', height: '100%', ...meshStyle }} glassWidthPx={glassWidth*scale} glassHeightPx={glassHeight*scale}>
                        <PrintShutterIndicator type={isFixed ? 'fixed' : isSliding ? 'sliding' : 'fixed'} />
                    </GlassPanel>
                </div>
            </div>
        );
    };

    return (
        <div className="relative" style={{ width: mmToPx(effectiveWidth, scale), height: mmToPx(numHeight, scale), margin: 'auto' }}>
            {glassElements}
            {profileElements}
            {innerAreaWidth > 0 && innerAreaHeight > 0 && (
                <div className="absolute overflow-hidden" style={{ top: mmToPx(holeY1, scale), left: mmToPx(holeX1, scale), width: mmToPx(innerAreaWidth, scale), height: mmToPx(innerAreaHeight, scale) }}>
                    {windowType === WindowType.MIRROR ? (() => {
                        const { mirrorConfig } = config;
                        
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
                        const { shutterConfig, fixedShutters, slidingHandles } = config;
                        const is4G = shutterConfig === ShutterConfigType.FOUR_GLASS;
                        const hasMesh = shutterConfig === ShutterConfigType.TWO_GLASS_ONE_MESH;

                        let numShutters: number;
                        switch (shutterConfig) {
                            case ShutterConfigType.FOUR_GLASS: numShutters = 4; break;
                            case ShutterConfigType.TWO_GLASS: numShutters = 2; break;
                            case ShutterConfigType.THREE_GLASS: numShutters = 3; break;
                            case ShutterConfigType.TWO_GLASS_ONE_MESH: numShutters = 3; break;
                            default: numShutters = 0;
                        }

                        if (is4G) {
                            const shutterWidth = (innerAreaWidth + (2 * dims.shutterInterlock) + dims.shutterMeeting) / 4;
                            const positions = [ 0, shutterWidth - dims.shutterInterlock, (2*shutterWidth) - dims.shutterInterlock - dims.shutterMeeting, (3*shutterWidth) - (2*dims.shutterInterlock) - dims.shutterMeeting ];
                             slidingHandles.forEach((handleConfig, i) => {
                                if (handleConfig) {
                                    const side = slidingMemberSideStandard(i, 4);
                                    const mirrored = mirrorHandleForSlidingMember(side);
                                    handleElements.push(<div key={`handle-${i}`} style={{ zIndex: 30, position: 'absolute', left: (positions[i] + shutterWidth * handleConfig.x / 100) * scale, top: (innerAreaHeight * handleConfig.y / 100) * scale, transform: 'translate(-50%, -50%)', transformOrigin: 'center center' }}><PrintableHandle config={handleConfig} scale={scale} mirrored={mirrored} /></div>);
                                }
                            });
                            const profiles = [
                                { l: dims.shutterHandle, r: dims.shutterInterlock }, { l: dims.shutterInterlock, r: dims.shutterMeeting },
                                { l: dims.shutterMeeting, r: dims.shutterInterlock }, { l: dims.shutterInterlock, r: dims.shutterHandle }
                            ];
                            return profiles.map((p, i) => <div key={i} className="absolute" style={{ left: mmToPx(positions[i], scale), zIndex: (i === 1 || i === 2) ? 10 : 5 }}><PrintSlidingShutter panelId={`sliding-${i}`} width={shutterWidth} height={innerAreaHeight} topProfile={dims.shutterTop} bottomProfile={dims.shutterBottom} leftProfile={p.l} rightProfile={p.r} isMesh={false} isFixed={fixedShutters[i]} isSliding={!fixedShutters[i]} /></div>);
                        } else {
                            const shutterDivider = hasMesh ? 2 : numShutters;
                            const shutterWidth = (innerAreaWidth + (shutterDivider - 1) * dims.shutterInterlock) / shutterDivider;
                            slidingHandles.forEach((handleConfig, i) => {
                                if (handleConfig) {
                                    let leftPosition = (hasMesh ? Math.min(i, numShutters - 2) : i) * (shutterWidth - dims.shutterInterlock);
                                    const side = slidingMemberSideStandard(i, numShutters);
                                    const mirrored = mirrorHandleForSlidingMember(side);
                                    handleElements.push(<div key={`handle-${i}`} style={{ zIndex: 30, position: 'absolute', left: (leftPosition + shutterWidth * handleConfig.x / 100) * scale, top: (innerAreaHeight * handleConfig.y / 100) * scale, transform: 'translate(-50%, -50%)', transformOrigin: 'center center' }}><PrintableHandle config={handleConfig} scale={scale} mirrored={mirrored} /></div>);
                                }
                            });
                            return Array.from({ length: numShutters }).map((_, i) => {
                                const isMeshShutter = hasMesh && i === numShutters - 1;
                                let leftPosition = (hasMesh ? Math.min(i, numShutters - 2) : i) * (shutterWidth - dims.shutterInterlock);
                                const leftProfile = i === 0 ? dims.shutterHandle : dims.shutterInterlock;
                                const rightProfile = i === numShutters - 1 ? dims.shutterHandle : dims.shutterInterlock;
                                return ( <div key={i} className="absolute" style={{ left: mmToPx(leftPosition, scale), zIndex: i + (isMeshShutter ? 10 : 5) }}><PrintSlidingShutter panelId={`sliding-${i}`} width={shutterWidth} height={innerAreaHeight} topProfile={dims.shutterTop} bottomProfile={dims.shutterBottom} leftProfile={leftProfile} rightProfile={rightProfile} isMesh={isMeshShutter} isFixed={fixedShutters[i]} isSliding={!fixedShutters[i]}/></div> );
                            });
                        }
                    })() : null}

                    {(windowType === WindowType.CASEMENT || windowType === WindowType.VENTILATOR) && (() => {
                        const { verticalDividers, horizontalDividers } = config;
                        const gridCols = verticalDividers.length + 1;
                        const gridRows = horizontalDividers.length + 1;
                        const elements: React.ReactNode[] = [];
                        
                        for (let r = 0; r < gridRows; r++) {
                            for (let c = 0; c < gridCols; c++) {
                                const x_start_rel = c === 0 ? 0 : verticalDividers[c - 1];
                                const x_end_rel = c === verticalDividers.length ? 1 : verticalDividers[c];
                                const y_start_rel = r === 0 ? 0 : horizontalDividers[r - 1];
                                const y_end_rel = r === horizontalDividers.length ? 1 : horizontalDividers[r];

                                const cellX = x_start_rel * innerAreaWidth;
                                const cellY = y_start_rel * innerAreaHeight;
                                const cellW = (x_end_rel - x_start_rel) * innerAreaWidth;
                                const cellH = (y_end_rel - y_start_rel) * innerAreaHeight;
                                
                                const doorInfo = config.doorPositions.find(p => p.row === r && p.col === c);
                                if (doorInfo?.handle) {
                                    const mirrored = mirrorHandleForPartitionHandleX(doorInfo.handle.x);
                                    handleElements.push(<div key={`handle-casement-${r}-${c}`} style={{ position: 'absolute', zIndex: 30, left: (cellX + cellW * doorInfo.handle.x / 100) * scale, top: (cellY + cellH * doorInfo.handle.y / 100) * scale, transform: 'translate(-50%, -50%)', transformOrigin: 'center center' }}><PrintableHandle config={doorInfo.handle} scale={scale} mirrored={mirrored} /></div>);
                                }
                                const cell = config.ventilatorGrid[r]?.[c];
                                if (cell?.type === 'door' && cell.handle) {
                                     const mirrored = mirrorHandleForPartitionHandleX(cell.handle.x);
                                     handleElements.push(<div key={`handle-vent-${r}-${c}`} style={{ position: 'absolute', zIndex: 30, left: (cellX + cellW * cell.handle.x / 100) * scale, top: (cellY + cellH * cell.handle.y / 100) * scale, transform: 'translate(-50%, -50%)', transformOrigin: 'center center' }}><PrintableHandle config={cell.handle} scale={scale} mirrored={mirrored} /></div>);
                                }
                                
                                const cellType = cell?.type;
                                let content = <GlassPanel key={`cell-${r}-${c}`} panelId={`cell-${r}-${c}`} style={{left: cellX*scale, top: cellY*scale, width: cellW*scale, height: cellH*scale}} glassWidthPx={cellW*scale} glassHeightPx={cellH*scale}><PrintShutterIndicator type="fixed"/></GlassPanel>;

                                if ((windowType === WindowType.CASEMENT && doorInfo) || cellType === 'door') {
                                    content = (<div key={`cell-${r}-${c}`} className="absolute" style={{left: mmToPx(cellX, scale), top: mmToPx(cellY, scale), width: mmToPx(cellW, scale), height: mmToPx(cellH, scale)}}>
                                        <PrintableMiteredFrame width={cellW} height={cellH} profileSize={dims.casementShutter} scale={scale} color={profileColor} texture={pt} />
                                        <div className="absolute overflow-hidden" style={{ left: mmToPx(dims.casementShutter, scale), top: mmToPx(dims.casementShutter, scale), right: mmToPx(dims.casementShutter, scale), bottom: mmToPx(dims.casementShutter, scale) }}>
                                          <GlassPanel panelId={`cell-door-${r}-${c}`} style={{ position: 'absolute', left: 0, top: 0, width: '100%', height: '100%' }} glassWidthPx={(cellW - 2*dims.casementShutter)*scale} glassHeightPx={(cellH - 2*dims.casementShutter)*scale}><PrintShutterIndicator type="door"/></GlassPanel>
                                        </div>
                                      </div>);
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
                                elements.push(content);
                            }
                        }

                        horizontalDividers.forEach((pos) => elements.push(<PrintProfilePiece key={`hmullion-${pos}`} color={profileColor} texture={pt} style={{ left: 0, top: (pos * innerAreaHeight - dims.mullion / 2) * scale, width: innerAreaWidth * scale, height: dims.mullion * scale, zIndex: 10 }}/>));
                        verticalDividers.forEach((pos) => elements.push(<PrintProfilePiece key={`vmullion-${pos}`} color={profileColor} texture={pt} style={{ top: 0, left: (pos * innerAreaWidth - dims.mullion / 2) * scale, width: dims.mullion * scale, height: innerAreaHeight * scale, zIndex: 10 }}/>));
                        return elements;
                    })()}

                    {windowType === WindowType.GLASS_PARTITION && (() => {
                        const { partitionPanels } = config;
                        const gap = PARTITION_PANEL_GAP_MM;
                        const panelWidths = getPartitionPanelWidthsMm(
                          innerAreaWidth,
                          partitionPanels.count,
                          partitionPanels.types,
                          partitionPanels.widthFractions
                        );

                        const panels: React.ReactNode[] = [];
                        
                        if (partitionPanels.hasTopChannel) {
                            panels.push(<PrintProfilePiece key="track-top" color={profileColor} texture={pt} style={{ top: 0, left: 0, width: innerAreaWidth * scale, height: dims.topTrack * scale, zIndex: 4 }} />);
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
                                <PrintProfilePiece
                                  key={`track-bottom-${i}`}
                                  color={profileColor}
                                  texture={pt}
                                  style={{
                                    left: panelX * scale,
                                    top: (py + ph - dims.bottomTrack) * scale,
                                    width: currentPanelWidth * scale,
                                    height: dims.bottomTrack * scale,
                                    zIndex: 4,
                                  }}
                                />
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

                            panels.push(
                                <div key={`panel-${i}`} className="absolute" style={{left: mmToPx(panelX, scale), top: mmToPx(py, scale), width: mmToPx(currentPanelWidth, scale), height: mmToPx(ph, scale), zIndex}}>
                                  {isFramed && type === 'fold' && (
                                    <PrintableMiteredFrame
                                      width={currentPanelWidth}
                                      height={ph}
                                      topSize={ft}
                                      bottomSize={fb}
                                      leftSize={fl}
                                      rightSize={fr}
                                      scale={scale}
                                      color={profileColor}
                                      texture={pt}
                                    />
                                  )}
                                  {isFramed && type !== 'fold' && (
                                    <PrintableMiteredFrame width={currentPanelWidth} height={ph} profileSize={frameSize} scale={scale} color={profileColor} texture={pt} />
                                  )}
                                  <div
                                    className="absolute overflow-hidden"
                                    style={
                                      isFramed
                                        ? { left: mmToPx(fl, scale), top: mmToPx(ft, scale), right: mmToPx(fr, scale), bottom: mmToPx(fb, scale) }
                                        : { top: 0, left: 0, right: 0, bottom: 0 }
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
            {config.windowType !== WindowType.CORNER && (
                <>
                    <PrintDimensionLabel value={effectiveWidth} className="top-0 -translate-y-full left-1/2 -translate-x-1/2 -mt-1" />
                    <PrintDimensionLabel value={numHeight} className="top-1/2 -translate-y-1/2 left-0 -translate-x-full -ml-2 rotate-[-90deg]" />
                </>
            )}
            {labelElements}
        </div>
    );
};


function renderInlineBold(text: string): React.ReactNode[] {
    const parts = text.split(/(\*\*[^*\n]+\*\*|\*[^*\n]+\*)/g);
    return parts.filter(Boolean).map((part, index) => {
        if (/^\*\*[^*\n]+\*\*$/.test(part)) {
            return <strong key={`${part}-${index}`}>{part.slice(2, -2)}</strong>;
        }
        if (/^\*[^*\n]+\*$/.test(part)) {
            return <strong key={`${part}-${index}`}>{part.slice(1, -1)}</strong>;
        }
        return <React.Fragment key={`${part}-${index}`}>{part}</React.Fragment>;
    });
}

function renderFormattedMultiline(value: string, serialAuto: boolean): React.ReactNode {
    const source = serialAuto ? autoContinueTermsSerial(value) : value;
    const lines = source.split('\n');
    return (
        <>
            {lines.map((line, index) => {
                const serialMatch = serialAuto ? line.match(/^\s*((?:[A-Za-z]+|\d+)[.)])\s+(.+)$/) : null;
                if (serialMatch) {
                    return (
                        <p key={`${line}-${index}`} className="whitespace-pre-wrap">
                            <strong>{serialMatch[1]}</strong>{' '}{renderInlineBold(serialMatch[2])}
                        </p>
                    );
                }
                return <p key={`${line}-${index}`} className="whitespace-pre-wrap">{renderInlineBold(line)}</p>;
            })}
        </>
    );
}

const EditableSection: React.FC<{title: string, value: string, onChange: (value: string) => void; serialAuto?: boolean}> = ({ title, value, onChange, serialAuto = false }) => {
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
                    onChange={e => onChange(serialAuto ? autoContinueTermsSerial(e.target.value) : e.target.value)}
                    onBlur={() => setIsEditing(false)}
                    className="w-full text-xs whitespace-pre-wrap bg-transparent border-gray-300 rounded-md p-1 focus:ring-1 focus:ring-blue-500 focus:border-blue-500 print-editable"
                    rows={1}
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
                    {renderFormattedMultiline(value, serialAuto)}
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

const getItemDetails = (item: QuotationItem) => {
    const { config, quantity } = item;
    const { windowType, shutterConfig, doorPositions, ventilatorGrid } = config;

    const panelCounts: { [key: string]: number } = {};

    if (windowType === WindowType.SLIDING) {
        if (shutterConfig === ShutterConfigType.TWO_GLASS) panelCounts['Sliding Shutter'] = 2;
        else if (shutterConfig === ShutterConfigType.THREE_GLASS) panelCounts['Sliding Shutter'] = 3;
        else if (shutterConfig === ShutterConfigType.FOUR_GLASS) panelCounts['Sliding Shutter'] = 4;
        else if (shutterConfig === ShutterConfigType.TWO_GLASS_ONE_MESH) {
            panelCounts['Sliding Shutter'] = 2;
            panelCounts['Mesh Shutter'] = 1;
        }
    } else if (windowType === WindowType.CASEMENT) {
        const gridCells = (config.verticalDividers.length + 1) * (config.horizontalDividers.length + 1);
        panelCounts['Openable Door'] = doorPositions.length;
        panelCounts['Fixed Panel'] = gridCells - doorPositions.length;
    } else if (windowType === WindowType.VENTILATOR) {
        ventilatorGrid.flat().forEach(cell => {
            const typeName = cell.type.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase());
            panelCounts[typeName] = (panelCounts[typeName] || 0) + 1;
        });
    }


    const hardwareDetails: { name: string, qty: number, rate: number, total: number }[] = [];
    for (const hw of item.hardwareItems) {
        const qtyPerUnit = Number(hw.qtyPerShutter) || 0;
        let unitsPerWindow = 0;
        if (hw.unit === 'per_window') {
            unitsPerWindow = 1;
        } else if (hw.unit === 'per_shutter_or_door') {
             if (windowType === WindowType.VENTILATOR) {
                const doorCells = ventilatorGrid.flat().filter(c => c.type === 'door').length;
                const louverCells = ventilatorGrid.flat().filter(c => c.type === 'louvers').length;
                unitsPerWindow = hw.name.toLowerCase().includes('louver') ? louverCells : doorCells;
            } else {
                 switch(windowType) {
                    case WindowType.SLIDING: unitsPerWindow = shutterConfig === '2G' ? 2 : shutterConfig === '4G' ? 4 : 3; break;
                    case WindowType.CASEMENT: unitsPerWindow = doorPositions.length; break;
                    case WindowType.GLASS_PARTITION: unitsPerWindow = config.partitionPanels.types.filter(t => t.type !== 'fixed').length; break;
                }
            }
        }
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

    const relevantHardware = item.hardwareItems.filter(hw => hw.name.toLowerCase().includes('lock'));


    return { panelCounts, hardwareDetails, relevantHardware };
}

const getColorName = (item: QuotationItem) => {
    const quickColorNames: Record<string, string> = {
        '#6b7280': 'Grey',
        '#2f3238': 'Black',
        '#5c4033': 'Brown',
        '#d4a84b': 'Champion gold',
        '#f5f5f0': 'Off white',
    };

    if (item.profileColorName) {
        if (item.profileColorName.startsWith('#')) {
            return quickColorNames[item.profileColorName.toLowerCase()] || 'Custom Color';
        }
        if (item.profileColorName.startsWith('data:image')) {
            return 'Custom Texture';
        }
        return item.profileColorName;
    }
    if (item.config.profileColor && item.config.profileColor.startsWith('data:image')) {
        return "Custom Texture";
    }
    if (item.config.profileColor && item.config.profileColor.startsWith('#')) {
        return quickColorNames[item.config.profileColor.toLowerCase()] || 'Custom Color';
    }
    return item.config.profileColor || 'Custom Color';
};


export const PrintPreview: React.FC<PrintPreviewProps> = ({ isOpen, onClose, items, settings, setSettings }) => {
    
  const printContainerRef = useRef<HTMLDivElement>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [isArchitecturalMode, setIsArchitecturalMode] = useState(false);

  if (!isOpen) return null;

  const quoteDate = useMemo(() => new Date().toLocaleDateString('en-GB'), []);
  const quoteNumber = useMemo(() => `WM-${Date.now().toString().slice(-6)}`, []);
  const pdfDateStamp = useMemo(() => new Date().toISOString().slice(0, 10), []);
  
  const subTotal = items.reduce((total, item) => {
    const conversionFactor = item.areaType === 'sqft' ? 304.8 : 1000;
    const singleArea = (Number(item.config.width) / conversionFactor) * (Number(item.config.height) / conversionFactor);
    const totalArea = singleArea * item.quantity;
    const baseCost = totalArea * item.rate;
    const totalHardwareCost = item.hardwareCost * item.quantity;
    return total + baseCost + totalHardwareCost;
  }, 0);

  const discountAmount = settings.financials.discountType === 'percentage' 
    ? subTotal * (Number(settings.financials.discount) / 100) 
    : Number(settings.financials.discount);
  
  const totalAfterDiscount = subTotal - discountAmount;
  const gstAmount = totalAfterDiscount * (Number(settings.financials.gstPercentage) / 100);
  const grandTotal = totalAfterDiscount + gstAmount;

  const handleExportPdf = () => {
    const element = printContainerRef.current?.querySelector<HTMLElement>('.a4-page');
    if (!element || isExporting) {
        return;
    }

    setIsExporting(true);
    element.classList.add('pdf-export-mode');
    
    const opt = {
        margin: [8, 8, 8, 8] as [number, number, number, number],
        filename: quotationPdfFilename(settings.customer.name, pdfDateStamp),
        image: { type: 'jpeg' as const, quality: 0.95 },
        html2canvas: {
            scale: 2,
            logging: false,
            useCORS: true,
            allowTaint: true,
            backgroundColor: '#ffffff',
            letterRendering: true,
            scrollX: 0,
            scrollY: 0,
        },
        jsPDF: {
            unit: 'mm',
            format: 'a4',
            orientation: 'portrait' as const,
            compress: true,
        },
        pagebreak: { mode: ['avoid-all', 'css', 'legacy'] as ('css' | 'legacy' | 'avoid-all')[] },
    };

    import('html2pdf.js').then(({ default: html2pdf }) => {
        html2pdf()
            .from(element)
            .set(opt)
            .toPdf()
            .get('pdf')
            .then((pdf: any) => {
                const totalPages = pdf.internal.getNumberOfPages();
                const pageWidth = pdf.internal.pageSize.getWidth();
                const pageHeight = pdf.internal.pageSize.getHeight();
                pdf.setFontSize(8);
                pdf.setTextColor(100);
                for (let i = 1; i <= totalPages; i++) {
                    pdf.setPage(i);
                    pdf.text(`Page ${i} of ${totalPages}`, pageWidth - 10, pageHeight - 6, { align: 'right' });
                }
            })
            .save()
            .then(() => {
                setIsExporting(false);
                element.classList.remove('pdf-export-mode');
            })
            .catch((err: any) => {
                console.error("PDF export failed", err);
                setIsExporting(false);
                element.classList.remove('pdf-export-mode');
                alert("Sorry, there was an error exporting the PDF.");
            });
    });
  };
  
  const handlePrint = () => {
    const prevTitle = document.title;
    document.title = printDocumentTitleForQuotation(settings.customer.name);
    let finished = false;
    const finish = () => {
      if (finished) return;
      finished = true;
      document.title = prevTitle;
      window.removeEventListener('afterprint', finish);
      window.clearTimeout(fallbackTimer);
    };
    const fallbackTimer = window.setTimeout(finish, 12000);
    window.addEventListener('afterprint', finish);
    window.print();
  };


  return (
    <div className="fixed inset-0 bg-slate-900 z-50 flex flex-col print-preview-modal">
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
                <Button onClick={handleExportPdf} variant="secondary" disabled={isExporting}>
                    {isExporting ? 'Exporting...' : <><DownloadIcon className="w-5 h-5 mr-2"/> Export PDF</>}
                </Button>
                <Button onClick={handlePrint}><PrinterIcon className="w-5 h-5 mr-2"/> Print</Button>
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
            {isArchitecturalMode && (
                <div className="w-64">
                    <Input
                        id="architect-name"
                        name="architect-name"
                        label="Architect's Name"
                        value={settings.customer.architectName || ''}
                        onChange={e => setSettings({ ...settings, customer: { ...settings.customer, architectName: e.target.value }})}
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
                            <p className="font-semibold">{settings.customer.name}</p>
                            <p className="whitespace-pre-wrap">{settings.customer.address}</p>
                            <p><strong>Attn:</strong> {settings.customer.contactPerson}</p>
                            {settings.customer.email ? (
                                <p>
                                    <strong>Email:</strong>{' '}
                                    <a href={`mailto:${settings.customer.email}`} className="underline">{settings.customer.email}</a>
                                </p>
                            ) : null}
                            {settings.customer.website ? (
                                <p>
                                    <strong>Website:</strong>{' '}
                                    <a href={normalizeWebsiteUrl(settings.customer.website)} target="_blank" rel="noreferrer" className="underline">
                                        {settings.customer.website}
                                    </a>
                                </p>
                            ) : null}
                            {settings.customer.gstNumber ? (
                                <p><strong>GSTIN:</strong> {(settings.customer.gstNumber || '').toUpperCase()}</p>
                            ) : null}
                            <div className="show-for-arch mt-1">
                                <p><strong>Architect:</strong> {settings.customer.architectName || 'N/A'}</p>
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
                                    <th className="p-1 text-center w-[5%]">#</th>
                                    <th className="p-1 text-left w-[65%]" colSpan={2}>Item Description</th>
                                    <th className="p-1 text-center w-[10%]">Qty</th>
                                    <th className="p-1 text-right w-[20%] hide-for-arch" colSpan={2}>Total Amount</th>
                                </tr>
                            </thead>
                            <tbody>
                                {items.map((item, index) => {
                                    const conversionFactor = item.areaType === 'sqft' ? 304.8 : 1000;
                                    const singleArea = (Number(item.config.width) / conversionFactor) * (Number(item.config.height) / conversionFactor);
                                    const totalArea = singleArea * item.quantity;
                                    const baseCost = totalArea * item.rate;
                                    const totalHardwareCost = item.hardwareCost * item.quantity;
                                    const totalCost = baseCost + totalHardwareCost;
                                    
                                    const unitAmount = (singleArea * item.rate) + item.hardwareCost;

                                    const { panelCounts, relevantHardware } = getItemDetails(item);
                                    const glassDescription = getGlassDescription(item.config);
                                    
                                    let isFrameless = false;
                                    if (item.config.windowType === WindowType.MIRROR) {
                                        isFrameless = item.config.mirrorConfig.isFrameless;
                                    } else if (item.config.windowType === WindowType.GLASS_PARTITION) {
                                        const { partitionPanels } = item.config;
                                        // A partition is frameless if it has no top/bottom channels AND no individual panels are framed.
                                        // Hinged panels are always considered framed.
                                        const hasFramedPanels = partitionPanels.types.some(p => p.type === 'hinged' || p.framing === 'full');
                                        if (!partitionPanels.hasTopChannel && !hasFramedPanels) {
                                            isFrameless = true;
                                        }
                                    }

                                    return (
                                        <tr key={item.id} className="border-b border-gray-300 print-item">
                                            <td className="p-2 align-top text-center">{index + 1}</td>
                                            
                                            <td className="p-2 align-top w-[25%]">
                                                <PrintableWindow config={item.config} />
                                            </td>
                                            
                                            <td className="p-2 align-top">
                                                <p className="font-bold print-window-title">{item.title}</p>
                                                <table className="w-full text-[7pt] mt-1 details-table">
                                                    <tbody>
                                                        <tr><td className='pr-2 font-semibold'>Series:</td><td>{item.config.series.name}</td></tr>
                                                        <tr><td className='pr-2 font-semibold'>Size:</td><td>{`${item.config.width} x ${item.config.height}`} mm</td></tr>
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
                                            </td>
                                            <td className="p-2 align-top text-center">{item.quantity}</td>
                                            <td className="p-2 align-top text-right font-bold hide-for-arch" colSpan={2}>₹{Math.round(totalCost).toLocaleString('en-IN')}</td>
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
                                            <td className="py-1 pr-4">Discount ({settings.financials.discountType === 'percentage' ? `${settings.financials.discount}%` : 'Fixed'})</td>
                                            <td className="py-1 text-right font-semibold">(-) ₹{discountAmount.toLocaleString('en-IN', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</td>
                                        </tr>
                                        <tr className="border-b-2 border-black">
                                            <td className="py-1 pr-4 font-bold">Total before Tax</td>
                                            <td className="py-1 text-right font-bold">₹{totalAfterDiscount.toLocaleString('en-IN', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</td>
                                        </tr>
                                        <tr className="border-b border-gray-300">
                                            <td className="py-1 pr-4">GST @ {settings.financials.gstPercentage}%</td>
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
                            <EditableSection title="Terms & Conditions" value={settings.terms} onChange={(val) => setSettings({...settings, terms: val})} serialAuto />
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
