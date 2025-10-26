import React, { useMemo, useRef, useState, useEffect } from 'react';
import type { QuotationItem, QuotationSettings, WindowConfig, HandleConfig, HardwareItem } from '../types';
import { Button } from './ui/Button';
import { PrinterIcon } from './icons/PrinterIcon';
import { XMarkIcon } from './icons/XMarkIcon';
import { FixedPanelPosition, ShutterConfigType, WindowType } from '../types';
import { DownloadIcon } from './icons/DownloadIcon';
import html2pdf from 'html2pdf.js';

interface PrintPreviewProps {
  isOpen: boolean;
  onClose: () => void;
  items: QuotationItem[];
  settings: QuotationSettings;
  setSettings: (settings: QuotationSettings) => void;
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

const PrintShutterIndicator: React.FC<{ type: 'fixed' | 'sliding' | 'hinged' | 'door' | 'louvers' | 'exhaust_fan', width?: number, height?: number }> = ({ type, width, height }) => {
    if (!type) return null;
    
    const containerSize = Math.min(width || 100, height || 100);
    const baseFontSizePt = 8;
    const scaleFactor = Math.min(1, containerSize / 50); 
    const fontSize = baseFontSizePt * scaleFactor;
    const finalFontSize = Math.max(fontSize, 4); 

    const text = type.replace('_', ' ').toUpperCase();
    
    const style: React.CSSProperties = {
        fontSize: `${finalFontSize}pt`,
        lineHeight: 1,
        wordBreak: 'break-word',
    };

    const baseStyle = "absolute inset-0 flex items-center justify-center text-black font-bold tracking-normal pointer-events-none opacity-80 z-10 p-1 text-center";

    return <div className={baseStyle} style={style}>{text}</div>;
}

const PrintProfilePiece: React.FC<{style: React.CSSProperties, color: string}> = ({ style, color }) => {
    const isTexture = color && !color.startsWith('#');
    const isHorizontal = (style.width as number) > (style.height as number);

    const backgroundStyle = isTexture ? {
        backgroundImage: `url(${color})`,
        backgroundSize: isHorizontal ? 'auto 100%' : '100% auto',
        backgroundRepeat: 'repeat',
    } : { backgroundColor: color };

    return <div style={{ position: 'absolute', boxSizing: 'border-box', ...style, ...backgroundStyle }} />;
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
            elements.push(<PrintProfilePiece key={`h-grid-${i}`} color={profileColor} style={{ top, left: 0, width: width * scale, height: barThicknessScaled }} />);
        }

        // Vertical bars
        for (let i = 0; i < pattern.vertical.count; i++) {
            const left = (pattern.vertical.offset + i * pattern.vertical.gap) * scale - barThicknessScaled / 2;
            if (left > width * scale || left < -barThicknessScaled) continue;
            elements.push(<PrintProfilePiece key={`v-grid-${i}`} color={profileColor} style={{ left, top: 0, width: barThicknessScaled, height: height * scale }} />);
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
                elements.push(<PrintProfilePiece key={`h-grid-${i}`} color={profileColor} style={{ top: i * vGap - barThicknessScaled / 2, left: 0, width: width * scale, height: barThicknessScaled }} />);
            }
        }
        if (cols > 0) {
            const hGap = (width * scale) / (cols + 1);
            for (let i = 1; i <= cols; i++) {
                elements.push(<PrintProfilePiece key={`v-grid-${i}`} color={profileColor} style={{ left: i * hGap - barThicknessScaled / 2, top: 0, width: barThicknessScaled, height: height * scale }} />);
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
}> = ({ width, height, profileSize = 0, topSize, bottomSize, leftSize, rightSize, scale, color }) => {
    const ts = (topSize ?? profileSize) * scale;
    const bs = (bottomSize ?? profileSize) * scale;
    const ls = (leftSize ?? profileSize) * scale;
    const rs = (rightSize ?? profileSize) * scale;

    const isTexture = color && !color.startsWith('#');
    const backgroundStyle = isTexture ? { backgroundImage: `url(${color})`, backgroundRepeat: 'repeat' } : { backgroundColor: color };
    const horizontalBgStyle = { backgroundSize: 'auto 100%' };
    const verticalBgStyle = { backgroundSize: '100% auto' };

    const baseStyle: React.CSSProperties = {
        position: 'absolute',
        boxSizing: 'border-box',
        ...backgroundStyle
    };

    const clipTs = Math.max(0, ts);
    const clipBs = Math.max(0, bs);
    const clipLs = Math.max(0, ls);
    const clipRs = Math.max(0, rs);

    return (
        <div className="absolute" style={{ width: width * scale, height: height * scale }}>
            {/* Top */}
            <div style={{...baseStyle, ...(isTexture && horizontalBgStyle), top: 0, left: 0, width: '100%', height: clipTs, clipPath: `polygon(0 0, 100% 0, calc(100% - ${clipRs}px) 100%, ${clipLs}px 100%)` }} />
            {/* Bottom */}
            <div style={{...baseStyle, ...(isTexture && horizontalBgStyle), bottom: 0, left: 0, width: '100%', height: clipBs, clipPath: `polygon(${clipLs}px 0, calc(100% - ${clipRs}px) 0, 100% 100%, 0 100%)` }} />
            {/* Left */}
            <div style={{...baseStyle, ...(isTexture && verticalBgStyle), top: 0, left: 0, width: clipLs, height: '100%', clipPath: `polygon(0 0, 100% ${clipTs}px, 100% calc(100% - ${clipBs}px), 0 100%)` }} />
            {/* Right */}
            <div style={{...baseStyle, ...(isTexture && verticalBgStyle), top: 0, right: 0, width: clipRs, height: '100%', clipPath: `polygon(0 ${clipTs}px, 100% 0, 100% 100%, 0 calc(100% - ${clipBs}px))` }} />
        </div>
    );
};

const PrintableHandle: React.FC<{ config: HandleConfig | null, scale: number }> = ({ config, scale }) => {
    if (!config) return null;
    const handleWidth = 25; // mm
    const handleHeight = 150; // mm
    const isVertical = config.orientation === 'vertical';
    const style: React.CSSProperties = {
        position: 'absolute',
        backgroundColor: '#333', // Dark grey for print
        width: (isVertical ? handleWidth : handleHeight) * scale,
        height: (isVertical ? handleHeight : handleWidth) * scale,
    };
    return <div style={style} />;
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
                <div style={{ width: postW * scale, height: numHeight * scale, backgroundColor: config.profileColor }} />
                <PrintableWindow config={cornerConfigRight} externalScale={scale} />
            </div>
        );
    }

    const containerWidthPx = 150; // max width in pixels
    const containerHeightPx = 200; // max height in pixels
    const numWidth = Number(config.width) || 1;
    let numHeight = Number(config.height) || 1;
    
    let effectiveWidth = numWidth;
    if (config.windowType === WindowType.ELEVATION_GLAZING && config.elevationGrid) {
        effectiveWidth = config.elevationGrid.colPattern.map(Number).filter(v => v > 0).reduce((s, v) => s + v, 0) || 1;
        numHeight = config.elevationGrid.rowPattern.map(Number).filter(v => v > 0).reduce((s, v) => s + v, 0) || 1;
    }
    const scale = externalScale || Math.min(containerWidthPx / effectiveWidth, containerHeightPx / numHeight);

    const { series, fixedPanels, profileColor, windowType, glassTexture } = config;
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

    const glassStyle = { backgroundColor: '#E2E8F0', boxSizing: 'border-box' as const, border: '0.5px solid #999' };

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
        <div className="absolute" style={panelStyle}>
            <PrintGlassGrid config={config} panelId={panelId} width={glassWidthPx / scale} height={glassHeightPx / scale} scale={scale} />
            {childrenWithProps}
        </div> 
      );
    }
    
    // Outer frame
    if (windowType !== WindowType.GLASS_PARTITION && windowType !== WindowType.CORNER && windowType !== WindowType.ELEVATION_GLAZING) {
        const verticalFrame = dims.outerFrameVertical > 0 ? dims.outerFrameVertical : dims.outerFrame;
        profileElements.push(<PrintableMiteredFrame key="outer-frame" width={numWidth} height={numHeight} topSize={dims.outerFrame} bottomSize={dims.outerFrame} leftSize={verticalFrame} rightSize={verticalFrame} scale={scale} color={profileColor} />);
    }
    
    const frameOffset = (windowType !== WindowType.GLASS_PARTITION && windowType !== WindowType.CORNER && windowType !== WindowType.ELEVATION_GLAZING) ? dims.outerFrame : 0;
    const holeX1 = leftFix ? leftFixSize : frameOffset;
    const holeY1 = topFix ? topFixSize : frameOffset;
    const holeX2 = rightFix ? numWidth - rightFixSize : numWidth - frameOffset;
    const holeY2 = bottomFix ? numHeight - bottomFixSize : numHeight - frameOffset;
    
    // Fixed Panel frames and glass
    if (leftFix) {
        profileElements.push(<PrintProfilePiece key="divider-left" color={profileColor} style={{ top: frameOffset * scale, left: (holeX1 - dims.fixedFrame) * scale, width: dims.fixedFrame * scale, height: (numHeight - 2 * frameOffset) * scale }} />);
        labelElements.push(<PrintDimensionLabel key="label-left" value={leftFix.size} className="top-1/2 -translate-y-1/2" style={{left: leftFix.size * scale / 2, transform: 'translateX(-50%)'}}/>)
    }
    if (rightFix) profileElements.push(<PrintProfilePiece key="divider-right" color={profileColor} style={{ top: frameOffset * scale, left: holeX2 * scale, width: dims.fixedFrame * scale, height: (numHeight - 2 * frameOffset) * scale }} />);
    
    const hDividerX = leftFix ? holeX1 : frameOffset;
    const hDividerWidth = (rightFix ? holeX2 : numWidth - frameOffset) - hDividerX;

    if (topFix) {
        profileElements.push(<PrintProfilePiece key="divider-top" color={profileColor} style={{ top: (holeY1 - dims.fixedFrame) * scale, left: hDividerX * scale, width: hDividerWidth * scale, height: dims.fixedFrame * scale }} />);
        const glassW = hDividerWidth;
        const glassH = holeY1 - frameOffset - dims.fixedFrame;
        glassElements.push(<GlassPanel key="glass-top" panelId="fixed-top" style={{ top: frameOffset * scale, left: hDividerX * scale, width: glassW * scale, height: glassH * scale }} glassWidthPx={glassW*scale} glassHeightPx={glassH*scale}><PrintShutterIndicator type="fixed"/></GlassPanel>);
        labelElements.push(<PrintDimensionLabel key="label-top" value={topFix.size} className="left-1/2 -translate-x-1/2" style={{top: topFix.size * scale / 2}}/>)
    }
    if (bottomFix) {
        profileElements.push(<PrintProfilePiece key="divider-bottom" color={profileColor} style={{ top: holeY2 * scale, left: hDividerX * scale, width: hDividerWidth * scale, height: dims.fixedFrame * scale }} />);
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
        
        return (
            <div className="absolute" style={{ width: width * scale, height: height * scale }}>
                <PrintableMiteredFrame 
                    width={width} 
                    height={height} 
                    scale={scale} 
                    color={profileColor} 
                    topSize={topProfile} 
                    bottomSize={bottomProfile} 
                    leftSize={leftProfile} 
                    rightSize={rightProfile} 
                />
                <GlassPanel panelId={panelId} style={{ left: leftProfile * scale, top: topProfile * scale, width: glassWidth * scale, height: glassHeight * scale, ...meshStyle }} glassWidthPx={glassWidth*scale} glassHeightPx={glassHeight*scale}>
                    <PrintShutterIndicator type={isFixed ? 'fixed' : isSliding ? 'sliding' : null} />
                </GlassPanel>
            </div>
        );
    };

    return (
        <div className="relative" style={{ width: effectiveWidth * scale, height: numHeight * scale, margin: 'auto' }}>
            {glassElements}
            {profileElements}
            {innerAreaWidth > 0 && innerAreaHeight > 0 && (
                <div className="absolute" style={{ top: holeY1 * scale, left: holeX1 * scale, width: innerAreaWidth * scale, height: innerAreaHeight * scale }}>
                    {windowType === WindowType.SLIDING && (() => {
                        const { shutterConfig, fixedShutters, slidingHandles } = config;
                        const is4G = shutterConfig === ShutterConfigType.FOUR_GLASS;
                        const numShutters = is4G ? 4 : (shutterConfig === ShutterConfigType.TWO_GLASS ? 2 : 3);
                        const hasMesh = shutterConfig === ShutterConfigType.TWO_GLASS_ONE_MESH;

                        if (is4G) {
                            const shutterWidth = (innerAreaWidth + (2 * dims.shutterInterlock) + dims.shutterMeeting) / 4;
                            const positions = [ 0, shutterWidth - dims.shutterInterlock, (2*shutterWidth) - dims.shutterInterlock - dims.shutterMeeting, (3*shutterWidth) - (2*dims.shutterInterlock) - dims.shutterMeeting ];
                             slidingHandles.forEach((handleConfig, i) => {
                                if (handleConfig) {
                                    handleElements.push(<div key={`handle-${i}`} style={{ zIndex: 30, position: 'absolute', left: (positions[i] + shutterWidth * handleConfig.x / 100) * scale, top: (innerAreaHeight * handleConfig.y / 100) * scale, transform: 'translate(-50%, -50%)' }}><PrintableHandle config={handleConfig} scale={scale} /></div>);
                                }
                            });
                            const profiles = [
                                { l: dims.shutterHandle, r: dims.shutterInterlock }, { l: dims.shutterInterlock, r: dims.shutterMeeting },
                                { l: dims.shutterMeeting, r: dims.shutterInterlock }, { l: dims.shutterInterlock, r: dims.shutterHandle }
                            ];
                            return profiles.map((p, i) => <div key={i} className="absolute" style={{ left: positions[i] * scale, zIndex: (i === 1 || i === 2) ? 10 : 5 }}><PrintSlidingShutter panelId={`sliding-${i}`} width={shutterWidth} height={innerAreaHeight} topProfile={dims.shutterTop} bottomProfile={dims.shutterBottom} leftProfile={p.l} rightProfile={p.r} isMesh={false} isFixed={fixedShutters[i]} isSliding={!fixedShutters[i]} /></div>);
                        } else {
                            const shutterDivider = hasMesh ? 2 : numShutters;
                            const shutterWidth = (innerAreaWidth + (shutterDivider - 1) * dims.shutterInterlock) / shutterDivider;
                            slidingHandles.forEach((handleConfig, i) => {
                                if (handleConfig) {
                                    let leftPosition = (hasMesh ? Math.min(i, numShutters - 2) : i) * (shutterWidth - dims.shutterInterlock);
                                    handleElements.push(<div key={`handle-${i}`} style={{ zIndex: 30, position: 'absolute', left: (leftPosition + shutterWidth * handleConfig.x / 100) * scale, top: (innerAreaHeight * handleConfig.y / 100) * scale, transform: 'translate(-50%, -50%)' }}><PrintableHandle config={handleConfig} scale={scale} /></div>);
                                }
                            });
                            return Array.from({ length: numShutters }).map((_, i) => {
                                const isMeshShutter = hasMesh && i === numShutters - 1;
                                let leftPosition = (hasMesh ? Math.min(i, numShutters - 2) : i) * (shutterWidth - dims.shutterInterlock);
                                const leftProfile = i === 0 ? dims.shutterHandle : dims.shutterInterlock;
                                const rightProfile = i === numShutters - 1 ? dims.shutterHandle : dims.shutterInterlock;
                                return ( <div key={i} className="absolute" style={{ left: leftPosition * scale, zIndex: i + (isMeshShutter ? 10 : 5) }}><PrintSlidingShutter panelId={`sliding-${i}`} width={shutterWidth} height={innerAreaHeight} topProfile={dims.shutterTop} bottomProfile={dims.shutterBottom} leftProfile={leftProfile} rightProfile={rightProfile} isMesh={isMeshShutter} isFixed={fixedShutters[i]} isSliding={!fixedShutters[i]}/></div> );
                            });
                        }
                    })()}
                    
                    {windowType === WindowType.ELEVATION_GLAZING && (() => {
                        if (!config.elevationGrid) return null;

                        const { rowPattern, colPattern, doorPositions, verticalMullionSize, horizontalTransomSize } = config.elevationGrid;
                        const vMullion = Number(verticalMullionSize) || 0;
                        const hTransom = Number(horizontalTransomSize) || 0;

                        const validColPattern = colPattern.map(Number).filter(v => v > 0);
                        const validRowPattern = rowPattern.map(Number).filter(v => v > 0);

                        const elements: React.ReactNode[] = [];
                        
                        const uniqueColWidthsLabeled = new Set<number>();
                        let currentX_label = 0;
                        validColPattern.forEach((colWidth) => {
                            if (!uniqueColWidthsLabeled.has(colWidth)) {
                                labelElements.push( <PrintDimensionLabel key={`h-label-${colWidth}`} value={colWidth} className="-top-4 text-[5pt]" style={{ left: (currentX_label + colWidth / 2) * scale, transform: 'translateX(-50%)' }} /> );
                                uniqueColWidthsLabeled.add(colWidth);
                            }
                            currentX_label += colWidth;
                        });

                        const uniqueRowHeightsLabeled = new Set<number>();
                        let currentY_label = 0;
                        validRowPattern.forEach((rowHeight) => {
                             if (!uniqueRowHeightsLabeled.has(rowHeight)) {
                                labelElements.push( <PrintDimensionLabel key={`v-label-${rowHeight}`} value={rowHeight} className="-left-1 text-[5pt] rotate-[-90deg]" style={{ top: (currentY_label + rowHeight / 2) * scale, transform: 'translateY(-50%) translateX(-100%)', transformOrigin: 'left center' }} /> );
                                uniqueRowHeightsLabeled.add(rowHeight);
                            }
                            currentY_label += rowHeight;
                        });

                        let currentY_cell = 0;
                        validRowPattern.forEach((rowHeight, r) => {
                            let currentX_cell = 0;
                            validColPattern.forEach((colWidth, c) => {
                                elements.push( <GlassPanel key={`cell-glass-${r}-${c}`} panelId={`elevation-${r}-${c}`} style={{left: currentX_cell * scale, top: currentY_cell * scale, width: colWidth*scale, height: rowHeight*scale}} glassWidthPx={colWidth*scale} glassHeightPx={rowHeight*scale}/>);
                                currentX_cell += colWidth;
                            });
                            currentY_cell += rowHeight;
                        });

                        let accumulatedX = 0;
                        for (let c = 0; c < validColPattern.length - 1; c++) {
                            accumulatedX += validColPattern[c];
                            elements.push(<PrintProfilePiece key={`vmullion-${c}`} color={profileColor} style={{ left: (accumulatedX - vMullion / 2) * scale, top: 0, width: vMullion * scale, height: numHeight * scale }} />);
                        }
                        let accumulatedY = 0;
                        for (let r = 0; r < validRowPattern.length - 1; r++) {
                            accumulatedY += validRowPattern[r];
                            elements.push(<PrintProfilePiece key={`hmullion-${r}`} color={profileColor} style={{ left: 0, top: (accumulatedY - hTransom / 2) * scale, width: effectiveWidth * scale, height: hTransom * scale }} />);
                        }
                        
                        currentY_cell = 0;
                        validRowPattern.forEach((rowHeight, r) => {
                            let currentX_cell = 0;
                            validColPattern.forEach((colWidth, c) => {
                                const isDoor = doorPositions.some(p => p.row === r && p.col === c);
                                if (isDoor) {
                                    const doorFrameSize = Number(dims.casementShutter) || 0;
                                    elements.push(
                                        <div key={`door-${r}-${c}`} className="absolute" style={{ left: currentX_cell * scale, top: currentY_cell * scale, width: colWidth * scale, height: rowHeight * scale, zIndex: 15 }}>
                                            <PrintableMiteredFrame width={colWidth} height={rowHeight} profileSize={doorFrameSize} scale={scale} color={profileColor} />
                                            <GlassPanel panelId={`elevation-door-${r}-${c}`} style={{ left: doorFrameSize * scale, top: doorFrameSize * scale, width: (colWidth - 2 * doorFrameSize) * scale, height: (rowHeight - 2 * doorFrameSize) * scale }} glassWidthPx={(colWidth - 2 * doorFrameSize) * scale} glassHeightPx={(rowHeight - 2 * doorFrameSize) * scale}>
                                                <PrintShutterIndicator type="door" />
                                            </GlassPanel>
                                        </div>
                                    );
                                }
                                currentX_cell += colWidth;
                            });
                            currentY_cell += rowHeight;
                        });

                        return <>{elements}</>;
                    })()}

                    {(windowType === WindowType.CASEMENT || windowType === WindowType.VENTILATOR) && (() => {
                        const { verticalDividers, horizontalDividers, doorPositions, ventilatorGrid } = config;
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
                                    handleElements.push(<div key={`handle-casement-${r}-${c}`} style={{ position: 'absolute', zIndex: 30, left: (cellX + cellW * doorInfo.handle.x / 100) * scale, top: (cellY + cellH * doorInfo.handle.y / 100) * scale, transform: 'translate(-50%, -50%)' }}><PrintableHandle config={doorInfo.handle} scale={scale} /></div>);
                                }
                                const cell = config.ventilatorGrid[r]?.[c];
                                if (cell?.type === 'door' && cell.handle) {
                                     handleElements.push(<div key={`handle-vent-${r}-${c}`} style={{ position: 'absolute', zIndex: 30, left: (cellX + cellW * cell.handle.x / 100) * scale, top: (cellY + cellH * cell.handle.y / 100) * scale, transform: 'translate(-50%, -50%)' }}><PrintableHandle config={cell.handle} scale={scale} /></div>);
                                }
                                
                                const cellType = cell?.type;
                                let content = <GlassPanel key={`cell-${r}-${c}`} panelId={`cell-${r}-${c}`} style={{left: cellX*scale, top: cellY*scale, width: cellW*scale, height: cellH*scale}} glassWidthPx={cellW*scale} glassHeightPx={cellH*scale}><PrintShutterIndicator type="fixed"/></GlassPanel>;

                                if ((windowType === WindowType.CASEMENT && doorInfo) || cellType === 'door') {
                                    content = (<div key={`cell-${r}-${c}`} className="absolute" style={{left: cellX*scale, top: cellY*scale, width: cellW*scale, height: cellH*scale}}>
                                        <PrintableMiteredFrame width={cellW} height={cellH} profileSize={dims.casementShutter} scale={scale} color={profileColor} />
                                        <GlassPanel panelId={`cell-door-${r}-${c}`} style={{ left: dims.casementShutter*scale, top: dims.casementShutter*scale, width: (cellW - 2 * dims.casementShutter)*scale, height: (cellH - 2 * dims.casementShutter)*scale }} glassWidthPx={(cellW - 2*dims.casementShutter)*scale} glassHeightPx={(cellH - 2*dims.casementShutter)*scale}><PrintShutterIndicator type="door"/></GlassPanel>
                                      </div>);
                                } else if (cellType === 'louvers') {
                                    const louvers: React.ReactNode[] = [];
                                    if (dims.louverBlade > 0) {
                                        const numLouvers = Math.floor(cellH / dims.louverBlade);
                                        for (let i=0; i < numLouvers; i++) louvers.push(<PrintProfilePiece key={`louver-${i}`} color={profileColor} style={{left: 0, top: (i * dims.louverBlade)*scale, width: cellW*scale, height: dims.louverBlade*scale }}/>)
                                    }
                                    content = <div key={`cell-${r}-${c}`} className="absolute" style={{left: cellX*scale, top: cellY*scale, width: cellW*scale, height: cellH*scale}}>{louvers}<PrintShutterIndicator type="louvers" width={cellW*scale} height={cellH*scale}/></div>;
                                } else if (cellType === 'exhaust_fan') {
                                    content = <GlassPanel key={`cell-${r}-${c}`} panelId={`cell-${r}-${c}`} style={{left: cellX*scale, top: cellY*scale, width: cellW*scale, height: cellH*scale}} glassWidthPx={cellW*scale} glassHeightPx={cellH*scale}><PrintShutterIndicator type="exhaust_fan"/></GlassPanel>;
                                }
                                elements.push(content);
                            }
                        }

                        horizontalDividers.forEach((pos) => elements.push(<PrintProfilePiece key={`hmullion-${pos}`} color={profileColor} style={{ left: 0, top: (pos * innerAreaHeight - dims.mullion / 2) * scale, width: innerAreaWidth * scale, height: dims.mullion * scale, zIndex: 10 }}/>));
                        verticalDividers.forEach((pos) => elements.push(<PrintProfilePiece key={`vmullion-${pos}`} color={profileColor} style={{ top: 0, left: (pos * innerAreaWidth - dims.mullion / 2) * scale, width: dims.mullion * scale, height: innerAreaHeight * scale, zIndex: 10 }}/>));
                        return elements;
                    })()}

                    {windowType === WindowType.GLASS_PARTITION && (() => {
                        const { partitionPanels } = config;
                        const panelWidth = innerAreaWidth / partitionPanels.count;
                        const overlap = 25; 
                        const panels: React.ReactNode[] = [];
                        
                        if (partitionPanels.hasTopChannel) {
                            panels.push(<PrintProfilePiece key="track-top" color={profileColor} style={{ top: 0, left: 0, width: innerAreaWidth * scale, height: dims.topTrack * scale }} />);
                            panels.push(<PrintProfilePiece key="track-bottom" color={profileColor} style={{ bottom: 0, left: 0, width: innerAreaWidth * scale, height: dims.bottomTrack * scale }} />);
                        }
                        const panelAreaY = partitionPanels.hasTopChannel ? dims.topTrack : 0;
                        const panelAreaHeight = innerAreaHeight - (partitionPanels.hasTopChannel ? dims.topTrack + dims.bottomTrack : 0);

                        for (let i=0; i < partitionPanels.count; i++) {
                            const panelConfig = partitionPanels.types[i];
                            if (!panelConfig) continue;
                            const { type, handle, framing } = panelConfig;
                            
                            const zIndex = type === 'sliding' ? 10 + i : 5;
                            let panelX = i * (panelWidth);
                            let currentPanelWidth = panelWidth;
                            if (type === 'sliding') {
                                panelX = i * (panelWidth - overlap);
                                currentPanelWidth += overlap;
                            }
                             if (handle) {
                                handleElements.push(<div key={`handle-part-${i}`} style={{ position: 'absolute', zIndex: 30, left: (panelX + currentPanelWidth * handle.x / 100) * scale, top: (panelAreaY + panelAreaHeight * handle.y / 100) * scale, transform: 'translate(-50%, -50%)' }}><PrintableHandle config={handle} scale={scale} /></div>);
                            }
                            
                             const isFramed = framing === 'full' || type === 'hinged';
                             const frameSize = dims.casementShutter;

                            panels.push(
                                <div key={`panel-${i}`} className="absolute" style={{left: panelX*scale, top: panelAreaY*scale, width: currentPanelWidth*scale, height: panelAreaHeight*scale, zIndex}}>
                                  {isFramed && <PrintableMiteredFrame width={currentPanelWidth} height={panelAreaHeight} profileSize={frameSize} scale={scale} color={profileColor} />}
                                  <GlassPanel 
                                    panelId={`partition-${i}`}
                                    style={{
                                      left: (isFramed ? frameSize : 0) * scale, 
                                      top: (isFramed ? frameSize : 0) * scale, 
                                      width: (currentPanelWidth - (isFramed ? 2 * frameSize : 0)) * scale, 
                                      height: (panelAreaHeight - (isFramed ? 2 * frameSize : 0)) * scale
                                    }} 
                                    glassWidthPx={(currentPanelWidth - (isFramed ? 2 * frameSize : 0))*scale}
                                    glassHeightPx={(panelAreaHeight - (isFramed ? 2 * frameSize : 0))*scale}
                                  >
                                     <PrintShutterIndicator type={type} />
                                  </GlassPanel>
                                </div>
                            );
                        }
                        return <>{panels}</>;
                    })()}
                    {handleElements}
                </div>
            )}
            {config.windowType !== WindowType.CORNER && config.windowType !== WindowType.ELEVATION_GLAZING && (
                <>
                    <PrintDimensionLabel value={effectiveWidth} className="top-0 -translate-y-full left-1/2 -translate-x-1/2 -mt-1" />
                    <PrintDimensionLabel value={numHeight} className="top-1/2 -translate-y-1/2 left-0 -translate-x-full -ml-2 rotate-[-90deg]" />
                </>
            )}
            {labelElements}
        </div>
    );
};


const EditableSection: React.FC<{title: string, value: string, onChange: (value: string) => void}> = ({ title, value, onChange }) => {
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    useEffect(() => {
        if (textareaRef.current) {
            textareaRef.current.style.height = 'auto';
            textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
        }
    }, [value]);

    return (
        <div className="print-final-details mt-4" style={{breakInside: 'avoid'}}>
            <h3 className="font-bold text-sm mb-1 border-b border-gray-300 pb-1">{title}</h3>
            <textarea 
                ref={textareaRef}
                value={value}
                onChange={e => onChange(e.target.value)}
                className="w-full text-xs whitespace-pre-wrap bg-transparent border-gray-300 rounded-md p-1 focus:ring-1 focus:ring-blue-500 focus:border-blue-500 print-editable"
                rows={1}
                style={{overflow: 'hidden'}}
            />
        </div>
    );
};

const getGlassDescription = (config: WindowConfig): string => {
    const formatType = (type: string) => type.replace(/_/g, ' ').replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());

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
    } else if (windowType === WindowType.ELEVATION_GLAZING && config.elevationGrid) {
        panelCounts['Operable Door'] = config.elevationGrid.doorPositions.length;
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
                    case WindowType.ELEVATION_GLAZING: unitsPerWindow = config.elevationGrid?.doorPositions.length || 0; break;
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

    const relevantHardware = item.hardwareItems.filter(hw => {
        const nameLower = hw.name.toLowerCase();
        return nameLower.includes('handle') || nameLower.includes('lock');
    });


    return { panelCounts, hardwareDetails, relevantHardware };
}


export const PrintPreview: React.FC<PrintPreviewProps> = ({ isOpen, onClose, items, settings, setSettings }) => {
    
  const printContainerRef = useRef<HTMLDivElement>(null);
  const [isExporting, setIsExporting] = useState(false);

  if (!isOpen) return null;

  const quoteDate = useMemo(() => new Date().toLocaleDateString('en-GB'), []);
  const quoteNumber = useMemo(() => `WM-${Date.now().toString().slice(-6)}`, []);
  
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
        margin: 0,
        filename: `Quotation-${settings.customer.name || 'WoodenMax'}-${quoteNumber}.pdf`,
        image: { type: 'jpeg' as const, quality: 0.98 },
        html2canvas: {
            scale: 2,
            logging: false,
            useCORS: true,
            backgroundColor: '#ffffff',
        },
        jsPDF: {
            unit: 'mm',
            format: 'a4',
            orientation: 'portrait' as const,
        },
        pagebreak: { mode: ['css', 'legacy'] }
    };

    html2pdf().from(element).set(opt).save().then(() => {
        setIsExporting(false);
        element.classList.remove('pdf-export-mode');
    }).catch((err: any) => {
        console.error("PDF export failed", err);
        setIsExporting(false);
        element.classList.remove('pdf-export-mode');
        alert("Sorry, there was an error exporting the PDF.");
    });
  };
  
  const handlePrint = () => {
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
        <div ref={printContainerRef} className="flex-grow overflow-y-auto bg-slate-900 print-preview-container custom-scrollbar">
            <div className="a4-page single-scroll-preview text-black">
                {/* --- Start of Printable Content --- */}
                <div className="print-header" style={{height: 'auto'}}>
                    <div className="flex justify-between items-start">
                        <div className="flex items-start gap-4">
                            <img src={settings.company.logo || 'https://via.placeholder.com/80'} alt="Company Logo" className="w-20 h-20 object-contain"/>
                            <div>
                                <h2 className="text-2xl font-bold text-black">{settings.company.name}</h2>
                                <p className="text-xs whitespace-pre-wrap">{settings.company.address}</p>
                                <p className="text-xs">{settings.company.email} | {settings.company.website}</p>
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
                                    <th className="p-1 text-right w-[20%]" colSpan={2}>Total Amount</th>
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

                                    const { panelCounts, hardwareDetails, relevantHardware } = getItemDetails(item);
                                    const glassDescription = getGlassDescription(item.config);

                                    return (
                                        <tr key={item.id} className="border-b border-gray-300 print-item">
                                            <td className="p-2 align-top text-center">{index + 1}</td>
                                            
                                            {item.config.windowType !== WindowType.ELEVATION_GLAZING ? (
                                                <td className="p-2 align-top w-[25%]" style={{ width: '150px' }}>
                                                    <PrintableWindow config={item.config} />
                                                </td>
                                            ) : null}
                                            
                                            <td 
                                                className="p-2 align-top"
                                                colSpan={item.config.windowType === WindowType.ELEVATION_GLAZING ? 2 : 1}
                                            >
                                                <p className="font-bold print-window-title">{item.title}</p>
                                                <table className="w-full text-[7pt] mt-1 details-table">
                                                    <tbody>
                                                        <tr><td className='pr-2 font-semibold'>Series:</td><td>{item.config.series.name}</td></tr>
                                                        <tr><td className='pr-2 font-semibold'>Size:</td><td>{item.config.windowType === 'elevation_glazing' && item.config.elevationGrid ? `${item.config.elevationGrid.colPattern.map(Number).filter(v=>v>0).reduce((s,v)=>s+v, 0)} x ${item.config.elevationGrid.rowPattern.map(Number).filter(v=>v>0).reduce((s,v)=>s+v, 0)}` : `${item.config.width} x ${item.config.height}`} mm</td></tr>
                                                        <tr><td className='pr-2 font-semibold'>Area:</td><td>{totalArea.toFixed(2)} {item.areaType}</td></tr>
                                                        <tr><td className='pr-2 font-semibold'>Unit Amount:</td><td>₹{Math.round(unitAmount).toLocaleString('en-IN')}</td></tr>
                                                        <tr><td className='pr-2 font-semibold'>Color:</td><td>{item.profileColorName || item.config.profileColor}</td></tr>
                                                        <tr><td className='pr-2 font-semibold'>Glass:</td><td>{glassDescription}</td></tr>
                                                        {Object.entries(panelCounts).map(([name, count]) => count > 0 && (<tr key={name}><td className='pr-2 font-semibold'>{name}:</td><td>{count} Nos.</td></tr>))}
                                                        {relevantHardware.length > 0 && (
                                                            <tr>
                                                                <td className='pr-2 font-semibold pt-1 align-top'>Hardware:</td>
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
                                            <td className="p-2 align-top text-right font-bold" colSpan={2}>₹{Math.round(totalCost).toLocaleString('en-IN')}</td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>

                    <div className="print-summary final-summary-page" style={{breakInside: 'avoid'}}>
                        <div className="flex justify-end mt-4">
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
                        <div className="text-xs mt-2 text-right font-bold">
                            <p>Amount in Words: {amountToWords(grandTotal)}</p>
                        </div>
                        
                        <EditableSection title="Description" value={settings.description} onChange={(val) => setSettings({...settings, description: val})} />
                        <EditableSection title="Terms & Conditions" value={settings.terms} onChange={(val) => setSettings({...settings, terms: val})} />
                        
                        <div className="flex justify-between items-start mt-12 pt-4 border-t-2 border-gray-400 text-xs" style={{breakBefore: 'avoid'}}>
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