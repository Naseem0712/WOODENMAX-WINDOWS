import React, { useMemo, useRef, useState } from 'react';
import type { QuotationItem, QuotationSettings, WindowConfig } from '../types';
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
    <span className={`absolute bg-white bg-opacity-80 text-black text-[6pt] font-mono px-1 py-0 rounded z-20 ${className}`} style={{'--tw-rotate': '-90deg', transform: 'translate(var(--tw-translate-x, 0), var(--tw-translate-y, 0)) rotate(var(--tw-rotate, 0)) skewX(var(--tw-skew-x, 0)) skewY(var(--tw-skew-y, 0)) scaleX(var(--tw-scale-x, 1)) scaleY(var(--tw-scale-y, 1))', ...style} as React.CSSProperties}>
        {value.toFixed(0)}{unit}
    </span>
);

const PrintShutterIndicator: React.FC<{ type: 'fixed' | 'sliding' | 'hinged' | 'door' | 'louvers' | 'exhaust_fan' }> = ({ type }) => {
    if (!type) return null;
    const baseStyle = "absolute inset-0 flex items-center justify-center text-black font-bold tracking-widest text-[8pt] pointer-events-none opacity-80 z-10";
    const text = type.replace('_', ' ').toUpperCase();
    return <div className={baseStyle}>{text}</div>;
}

const PrintProfilePiece: React.FC<{style: React.CSSProperties, color: string}> = ({ style, color }) => ( <div style={{ backgroundColor: color, border: '0.5px solid #555', position: 'absolute', ...style, boxSizing: 'border-box' }} /> );

const PrintGlassGrid: React.FC<{width: number, height: number, rows: number, cols: number, profileSize: number, scale: number, color: string}> = ({ width, height, rows, cols, profileSize, scale, color }) => {
    if ((rows <= 0 && cols <= 0) || profileSize <= 0) return null;
    const elements: React.ReactNode[] = [];
    for (let i = 1; i <= rows; i++) {
        const top = (i * height / (rows + 1)) - (profileSize / 2);
        elements.push(<PrintProfilePiece key={`h-grid-${i}`} color={color} style={{ top: top * scale, left: 0, width: width * scale, height: profileSize * scale }} />);
    }
     for (let i = 1; i <= cols; i++) {
        const left = (i * width / (cols + 1)) - (profileSize / 2);
        elements.push(<PrintProfilePiece key={`v-grid-${i}`} color={color} style={{ left: left * scale, top: 0, width: profileSize * scale, height: height * scale }} />);
    }
    return <>{elements}</>
}

const getInnerArea = (config: WindowConfig) => {
    const numWidth = Number(config.width) || 1;
    const numHeight = Number(config.height) || 1;
    const frameOffset = (config.windowType !== WindowType.GLASS_PARTITION) ? (Number(config.series.dimensions.outerFrame) || 0) : 0;
    
    const topFix = config.fixedPanels.find(p => p.position === FixedPanelPosition.TOP);
    const bottomFix = config.fixedPanels.find(p => p.position === FixedPanelPosition.BOTTOM);
    const leftFix = config.fixedPanels.find(p => p.position === FixedPanelPosition.LEFT);
    const rightFix = config.fixedPanels.find(p => p.position === FixedPanelPosition.RIGHT);

    const holeX1 = leftFix ? leftFix.size : frameOffset;
    const holeY1 = topFix ? topFix.size : frameOffset;
    const holeX2 = rightFix ? numWidth - rightFix.size : numWidth - frameOffset;
    const holeY2 = bottomFix ? numHeight - bottomFix.size : numHeight - frameOffset;

    return { innerAreaWidth: holeX2 - holeX1, innerAreaHeight: holeY2 - holeY1 };
}

const WindowAnnotations: React.FC<{ config: WindowConfig }> = ({ config }) => {
    const { innerAreaWidth, innerAreaHeight } = getInnerArea(config);
    const { series, windowType, shutterConfig, doorPositions, ventilatorGrid, partitionPanels } = config;
    const dims = { shutterInterlock: Number(series.dimensions.shutterInterlock) || 0 };
    
    let annotations: string[] = [];

    switch(windowType) {
        case WindowType.SLIDING:
            const is4G = shutterConfig === ShutterConfigType.FOUR_GLASS;
            const numShutters = is4G ? 4 : (shutterConfig === ShutterConfigType.TWO_GLASS ? 2 : 3);
            const hasMesh = shutterConfig === ShutterConfigType.TWO_GLASS_ONE_MESH;
            const shutterDivider = hasMesh ? 2 : numShutters;
            const shutterWidth = (innerAreaWidth + (shutterDivider - 1) * dims.shutterInterlock) / shutterDivider;
            annotations.push(`${numShutters}-Panel: ${shutterWidth.toFixed(0)}mm (W)`);
            break;
        case WindowType.CASEMENT:
        case WindowType.VENTILATOR:
            const doorCount = doorPositions.length + ventilatorGrid.flat().filter(c => c.type === 'door').length;
            if (doorCount > 0) {
                 const gridCols = config.verticalDividers.length + 1;
                 const gridRows = config.horizontalDividers.length + 1;
                 const panelWidth = innerAreaWidth / gridCols;
                 const panelHeight = innerAreaHeight / gridRows;
                 annotations.push(`Door Panel: ${panelWidth.toFixed(0)}x${panelHeight.toFixed(0)}mm`);
            }
             if (ventilatorGrid.flat().some(c => c.type === 'louvers')) {
                annotations.push('Louvers Panel');
            }
            break;
        case WindowType.GLASS_PARTITION:
            const panelWidth = innerAreaWidth / partitionPanels.count;
            annotations.push(`Panel Width: ${panelWidth.toFixed(0)}mm`);
            break;
    }

    if (annotations.length === 0) return null;

    return (
        <div className="text-center text-[7pt] text-gray-800 mt-1">
            {annotations.join(' | ')}
        </div>
    );
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

    const baseStyle: React.CSSProperties = {
        backgroundColor: color,
        border: '0.5px solid #555',
        position: 'absolute',
        boxSizing: 'border-box',
    };

    const clipTs = Math.max(0, ts);
    const clipBs = Math.max(0, bs);
    const clipLs = Math.max(0, ls);
    const clipRs = Math.max(0, rs);

    return (
        <div className="absolute" style={{ width: width * scale, height: height * scale }}>
            {/* Top */}
            <div style={{...baseStyle, top: 0, left: 0, width: '100%', height: clipTs, clipPath: `polygon(0 0, 100% 0, calc(100% - ${clipRs}px) 100%, ${clipLs}px 100%)` }} />
            {/* Bottom */}
            <div style={{...baseStyle, bottom: 0, left: 0, width: '100%', height: clipBs, clipPath: `polygon(${clipLs}px 0, calc(100% - ${clipRs}px) 0, 100% 100%, 0 100%)` }} />
            {/* Left */}
            <div style={{...baseStyle, top: 0, left: 0, width: clipLs, height: '100%', clipPath: `polygon(0 0, 100% ${clipTs}px, 100% calc(100% - ${clipBs}px), 0 100%)` }} />
            {/* Right */}
            <div style={{...baseStyle, top: 0, right: 0, width: clipRs, height: '100%', clipPath: `polygon(0 ${clipTs}px, 100% 0, 100% 100%, 0 calc(100% - ${clipBs}px))` }} />
        </div>
    );
};

const PrintableHandle: React.FC<{ config: WindowConfig['slidingHandles'][0], scale: number }> = ({ config, scale }) => {
    if (!config) return null;
    const handleWidth = 25; // mm
    const handleHeight = 150; // mm
    const isVertical = config.orientation === 'vertical';
    const style: React.CSSProperties = {
        position: 'absolute',
        backgroundColor: '#333', // Dark grey for print
        border: '0.5px solid #000',
        width: (isVertical ? handleWidth : handleHeight) * scale,
        height: (isVertical ? handleHeight : handleWidth) * scale,
    };
    return <div style={style} />;
};


const PrintableWindow: React.FC<{ config: WindowConfig }> = ({ config }) => {
    const containerWidthPx = 200; // Reduced from 240
    const numWidth = Number(config.width) || 1;
    const numHeight = Number(config.height) || 1;
    const scale = containerWidthPx / numWidth;

    const { series, fixedPanels, profileColor, windowType } = config;
    const dims = {
        outerFrame: Number(series.dimensions.outerFrame) || 0, fixedFrame: Number(series.dimensions.fixedFrame) || 0,
        shutterHandle: Number(series.dimensions.shutterHandle) || 0, shutterInterlock: Number(series.dimensions.shutterInterlock) || 0,
        shutterTop: Number(series.dimensions.shutterTop) || 0, shutterBottom: Number(series.dimensions.shutterBottom) || 0,
        shutterMeeting: Number(series.dimensions.shutterMeeting) || 0, casementShutter: Number(series.dimensions.casementShutter) || 0,
        mullion: Number(series.dimensions.mullion) || 0, louverBlade: Number(series.dimensions.louverBlade) || 0,
        topTrack: Number(series.dimensions.topTrack) || 0, bottomTrack: Number(series.dimensions.bottomTrack) || 0, glassGridProfile: Number(series.dimensions.glassGridProfile) || 0,
    };

    const glassStyle = { backgroundColor: '#E2E8F0', border: '0.5px solid #999', boxSizing: 'border-box' as const };

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

    const GlassPanel: React.FC<{style: React.CSSProperties, children?: React.ReactNode, glassWidth: number, glassHeight: number}> = ({ style, children, glassWidth, glassHeight }) => ( 
      <div className="absolute" style={{...glassStyle, ...style}}>
        <PrintGlassGrid width={glassWidth} height={glassHeight} rows={config.glassGrid.rows} cols={config.glassGrid.cols} profileSize={dims.glassGridProfile} scale={scale} color={profileColor} />
        {children}
      </div> 
    );
    
    // Outer frame
    if (windowType !== WindowType.GLASS_PARTITION) {
        profileElements.push(<PrintableMiteredFrame key="outer-frame" width={numWidth} height={numHeight} profileSize={dims.outerFrame} scale={scale} color={profileColor} />);
    }
    
    const frameOffset = (windowType !== WindowType.GLASS_PARTITION) ? dims.outerFrame : 0;
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
        glassElements.push(<GlassPanel key="glass-top" style={{ top: frameOffset * scale, left: hDividerX * scale, width: hDividerWidth * scale, height: (holeY1 - frameOffset - dims.fixedFrame) * scale }} glassWidth={hDividerWidth} glassHeight={holeY1 - frameOffset - dims.fixedFrame}><PrintShutterIndicator type="fixed"/></GlassPanel>);
        labelElements.push(<PrintDimensionLabel key="label-top" value={topFix.size} className="left-1/2 -translate-x-1/2" style={{top: topFix.size * scale / 2}}/>)
    }
    if (bottomFix) {
        profileElements.push(<PrintProfilePiece key="divider-bottom" color={profileColor} style={{ top: holeY2 * scale, left: hDividerX * scale, width: hDividerWidth * scale, height: dims.fixedFrame * scale }} />);
        glassElements.push(<GlassPanel key="glass-bottom" style={{ top: (holeY2 + dims.fixedFrame) * scale, left: hDividerX * scale, width: hDividerWidth * scale, height: (numHeight - holeY2 - frameOffset - dims.fixedFrame) * scale }} glassWidth={hDividerWidth} glassHeight={numHeight - holeY2 - frameOffset - dims.fixedFrame}><PrintShutterIndicator type="fixed"/></GlassPanel>);
    }
    const vGlassY = topFix ? holeY1 : frameOffset;
    const vGlassHeight = (bottomFix ? holeY2 : numHeight - frameOffset) - vGlassY;
    if (leftFix) glassElements.push(<GlassPanel key="glass-left" style={{ top: vGlassY * scale, left: frameOffset * scale, width: (holeX1 - frameOffset - dims.fixedFrame) * scale, height: vGlassHeight * scale }} glassWidth={holeX1 - frameOffset - dims.fixedFrame} glassHeight={vGlassHeight}><PrintShutterIndicator type="fixed"/></GlassPanel>);
    if (rightFix) glassElements.push(<GlassPanel key="glass-right" style={{ top: vGlassY * scale, left: (holeX2 + dims.fixedFrame) * scale, width: (numWidth - holeX2 - frameOffset - dims.fixedFrame) * scale, height: vGlassHeight * scale }} glassWidth={numWidth - holeX2 - frameOffset - dims.fixedFrame} glassHeight={vGlassHeight}><PrintShutterIndicator type="fixed"/></GlassPanel>);
    
    const innerAreaWidth = holeX2 - holeX1;
    const innerAreaHeight = holeY2 - holeY1;

    const PrintSlidingShutter: React.FC<{ width: number; height: number; topProfile: number; bottomProfile: number; rightProfile: number; leftProfile: number; isMesh: boolean; isFixed?: boolean; isSliding?: boolean; }> = ({ width, height, topProfile, rightProfile, bottomProfile, leftProfile, isMesh, isFixed = false, isSliding = false }) => {
        const glassWidth = width - leftProfile - rightProfile;
        const glassHeight = height - topProfile - bottomProfile;
        return (
            <div className="absolute" style={{ width: width * scale, height: height * scale }}>
                <PrintableMiteredFrame
                    width={width}
                    height={height}
                    topSize={topProfile}
                    bottomSize={bottomProfile}
                    leftSize={leftProfile}
                    rightSize={rightProfile}
                    scale={scale}
                    color={profileColor}
                />
                <GlassPanel style={{ left: leftProfile * scale, top: topProfile * scale, width: glassWidth * scale, height: glassHeight * scale }} glassWidth={glassWidth} glassHeight={glassHeight}>
                    <PrintShutterIndicator type={isFixed ? 'fixed' : isSliding ? 'sliding' : null} />
                </GlassPanel>
            </div>
        );
    };

    return (
        <div className="relative border border-black" style={{ width: numWidth * scale, height: numHeight * scale, margin: 'auto' }}>
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
                            return profiles.map((p, i) => <div key={i} className="absolute" style={{ left: positions[i] * scale, zIndex: (i === 1 || i === 2) ? 10 : 5 }}><PrintSlidingShutter width={shutterWidth} height={innerAreaHeight} topProfile={dims.shutterTop} bottomProfile={dims.shutterBottom} leftProfile={p.l} rightProfile={p.r} isMesh={false} isFixed={fixedShutters[i]} isSliding={!fixedShutters[i]} /></div>);
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
                                return ( <div key={i} className="absolute" style={{ left: leftPosition * scale, zIndex: i + (isMeshShutter ? 10 : 5) }}><PrintSlidingShutter width={shutterWidth} height={innerAreaHeight} topProfile={dims.shutterTop} bottomProfile={dims.shutterBottom} leftProfile={i === 0 ? dims.shutterHandle : dims.shutterInterlock} rightProfile={i === numShutters - 1 ? dims.shutterHandle : dims.shutterInterlock} isMesh={isMeshShutter} isFixed={fixedShutters[i]} isSliding={!fixedShutters[i]} /></div> );
                            });
                        }
                    })()}

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
                                    handleElements.push(<div key={`handle-casement-${r}-${c}`} style={{ position: 'absolute', zIndex: 30, left: (cellX + cellW * doorInfo.handle.x / 100) * scale, top: (cellY + cellH * doorInfo.handle.y / 100) * scale, transform: 'translate(-50%, -50%)' }}><PrintableHandle config={doorInfo.handle} scale={scale} /></div>);
                                }
                                const cell = config.ventilatorGrid[r]?.[c];
                                if (cell?.type === 'door' && cell.handle) {
                                     handleElements.push(<div key={`handle-vent-${r}-${c}`} style={{ position: 'absolute', zIndex: 30, left: (cellX + cellW * cell.handle.x / 100) * scale, top: (cellY + cellH * cell.handle.y / 100) * scale, transform: 'translate(-50%, -50%)' }}><PrintableHandle config={cell.handle} scale={scale} /></div>);
                                }
                                
                                const cellType = cell?.type;
                                let content = <GlassPanel key={`cell-${r}-${c}`} style={{left: cellX*scale, top: cellY*scale, width: cellW*scale, height: cellH*scale}} glassWidth={cellW} glassHeight={cellH}><PrintShutterIndicator type="fixed" /></GlassPanel>;

                                if ((windowType === WindowType.CASEMENT && doorInfo) || cellType === 'door') {
                                    content = (<div key={`cell-${r}-${c}`} className="absolute" style={{left: cellX*scale, top: cellY*scale, width: cellW*scale, height: cellH*scale}}>
                                        <PrintableMiteredFrame width={cellW} height={cellH} profileSize={dims.casementShutter} scale={scale} color={profileColor} />
                                        <GlassPanel style={{ left: dims.casementShutter*scale, top: dims.casementShutter*scale, width: (cellW - 2 * dims.casementShutter)*scale, height: (cellH - 2 * dims.casementShutter)*scale }} glassWidth={cellW - 2*dims.casementShutter} glassHeight={cellH - 2*dims.casementShutter}><PrintShutterIndicator type="door"/></GlassPanel>
                                      </div>);
                                } else if (cellType === 'louvers') {
                                    const louvers: React.ReactNode[] = [];
                                    if (dims.louverBlade > 0) {
                                        const numLouvers = Math.floor(cellH / dims.louverBlade);
                                        for (let i=0; i < numLouvers; i++) louvers.push(<PrintProfilePiece key={`louver-${i}`} color={profileColor} style={{left: 0, top: (i * dims.louverBlade)*scale, width: cellW*scale, height: dims.louverBlade*scale }}/>)
                                    }
                                    content = <div key={`cell-${r}-${c}`} className="absolute" style={{left: cellX*scale, top: cellY*scale, width: cellW*scale, height: cellH*scale}}>{louvers}<PrintShutterIndicator type="louvers"/></div>;
                                } else if (cellType === 'exhaust_fan') {
                                    content = <GlassPanel key={`cell-${r}-${c}`} style={{left: cellX*scale, top: cellY*scale, width: cellW*scale, height: cellH*scale}} glassWidth={cellW} glassHeight={cellH}><PrintShutterIndicator type="exhaust_fan"/></GlassPanel>;
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
                                    style={{
                                      left: (isFramed ? frameSize : 0) * scale, 
                                      top: (isFramed ? frameSize : 0) * scale, 
                                      width: (currentPanelWidth - (isFramed ? 2 * frameSize : 0)) * scale, 
                                      height: (panelAreaHeight - (isFramed ? 2 * frameSize : 0)) * scale
                                    }} 
                                    glassWidth={currentPanelWidth - (isFramed ? 2 * frameSize : 0)} 
                                    glassHeight={panelAreaHeight - (isFramed ? 2 * frameSize : 0)}
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
            <PrintDimensionLabel value={numWidth} className="top-0 -translate-y-full left-1/2 -translate-x-1/2 -mt-1" />
            <PrintDimensionLabel value={numHeight} className="top-1/2 -translate-y-1/2 left-0 -translate-x-full -ml-2 rotate-[-90deg]" style={{ top: `${numHeight * scale / 2}px`}} />
            {labelElements}
        </div>
    );
};


const EditableSection: React.FC<{title: string, value: string, onChange: (value: string) => void}> = ({ title, value, onChange }) => (
    <div className="print-final-details mt-4" style={{breakInside: 'avoid'}}>
        <h3 className="font-bold text-sm mb-1 border-b border-gray-300 pb-1">{title}</h3>
        <textarea 
            value={value}
            onChange={e => onChange(e.target.value)}
            className="w-full text-xs whitespace-pre-wrap bg-transparent border-gray-300 rounded-md p-1 focus:ring-1 focus:ring-blue-500 focus:border-blue-500 print-editable"
            rows={value.split('\n').length + 1}
        />
    </div>
);

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

                {/* Page 1 Header */}
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

                {/* Main Content (Items + Summary) */}
                <div className="print-content" style={{display: 'block'}}>
                    <h2 className="text-xl font-bold text-center my-2 text-black">{settings.title}</h2>
                    
                    {/* All Items in a continuous flow */}
                    <div className="w-full text-xs mt-4 space-y-2">
                        {items.map((item, globalIndex) => {
                            const conversionFactor = item.areaType === 'sqft' ? 304.8 : 1000;
                            const singleArea = (Number(item.config.width) / conversionFactor) * (Number(item.config.height) / conversionFactor);
                            const totalArea = singleArea * item.quantity;
                            const baseCost = totalArea * item.rate;
                            const totalHardwareCost = item.hardwareCost * item.quantity;
                            const totalCost = baseCost + totalHardwareCost;
                            const unitRate = item.quantity > 0 ? totalCost / item.quantity : 0;
                            const hasMesh = item.config.windowType === WindowType.SLIDING && item.config.shutterConfig === ShutterConfigType.TWO_GLASS_ONE_MESH;
                            const keyHardware = item.hardwareItems.filter(h => h.name.toLowerCase().includes('handle') || h.name.toLowerCase().includes('lock')).map(h => h.name).join(', ');
                            
                            const glassThicknessText = (item.config.glassThickness || 'Std.');
                            const specialTypeText = (item.config.glassSpecialType !== 'none' ? item.config.glassSpecialType.toUpperCase() : '');
                            const customGlassName = item.config.customGlassName ? `(${item.config.customGlassName})` : '';

                            let panelSummary = '';
                            if (item.config.windowType === WindowType.GLASS_PARTITION) {
                                const typeCounts = item.config.partitionPanels.types.reduce((acc, panelConfig) => {
                                    acc[panelConfig.type] = (acc[panelConfig.type] || 0) + 1;
                                    return acc;
                                }, {} as Record<string, number>);
                                panelSummary = Object.entries(typeCounts).map(([type, count]) => `${count} ${type}`).join(', ');
                            }

                            return (
                                <div key={item.id} className="border-b border-gray-300 print-item pt-4 pb-4">
                                    <div className="flex gap-4 items-start">
                                        <div className="w-1/3">
                                            <PrintableWindow config={item.config} />
                                            <WindowAnnotations config={item.config} />
                                        </div>
                                        <div className="w-2/3">
                                            <p className="print-window-title">
                                                {globalIndex + 1}. {item.title}
                                            </p>
                                            
                                            <div className="text-black text-[9pt] mt-2 grid grid-cols-2 gap-x-4 gap-y-1">
                                                <p><strong>Size (WxH):</strong> {item.config.width} x {item.config.height} mm</p>
                                                <p><strong>Series:</strong> {item.config.series.name}</p>
                                                <p><strong>Glass:</strong> {glassThicknessText}mm {specialTypeText} {item.config.glassType} {customGlassName}</p>
                                                <p><strong>Color:</strong> {item.profileColorName || item.config.profileColor}</p>
                                                <p><strong>Mesh:</strong> {hasMesh ? 'Yes' : 'No'}</p>
                                                {keyHardware && <p><strong>Hardware:</strong> {keyHardware}</p>}
                                                {panelSummary && <p><strong>Panels:</strong> {panelSummary}</p>}
                                            </div>

                                            <table className="w-full text-left mt-3 print-item-details text-[9pt] text-black">
                                                <tbody>
                                                    <tr className="border-t border-b border-gray-200">
                                                        <th className="py-1 font-semibold">Area</th>
                                                        <td>{totalArea.toFixed(2)} {item.areaType}</td>
                                                    </tr>
                                                    <tr className="border-b border-gray-200">
                                                        <th className="py-1 font-semibold">Quantity</th>
                                                        <td>{item.quantity} Nos.</td>
                                                    </tr>
                                                    <tr className="border-b border-gray-200">
                                                        <th className="py-1 font-semibold">Rate</th>
                                                        <td>₹ {Math.round(unitRate).toLocaleString('en-IN')} / unit</td>
                                                    </tr>
                                                    <tr className="font-bold border-b-2 border-black">
                                                        <th className="py-1">Total Amount</th>
                                                        <td className="text-base">₹ {Math.round(totalCost).toLocaleString('en-IN')}</td>
                                                    </tr>
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                </div>
                            )
                        })}
                    </div>

                    {/* Final Summary Section */}
                    <div className="final-summary-page">
                        <h2 className="text-xl font-bold text-center my-4 text-black">Final Summary</h2>
                        <table className="w-full text-left text-sm print-summary mb-4" style={{breakInside: 'avoid'}}>
                            <tbody>
                                <tr className="border-b border-gray-300">
                                    <th className="py-1">Sub Total</th>
                                    <td className="text-right">₹ {Math.round(subTotal).toLocaleString('en-IN')}</td>
                                </tr>
                                <tr className="border-b border-gray-300">
                                    <th className="py-1">Discount ({settings.financials.discountType === 'percentage' ? `${settings.financials.discount}%` : 'Fixed'})</th>
                                    <td className="text-right">- ₹ {Math.round(discountAmount).toLocaleString('en-IN')}</td>
                                </tr>
                                <tr className="border-b-2 border-black font-semibold">
                                    <th className="py-1">Total after Discount</th>
                                    <td className="text-right">₹ {Math.round(totalAfterDiscount).toLocaleString('en-IN')}</td>
                                </tr>
                                <tr className="border-b border-gray-300">
                                    <th className="py-1">GST ({settings.financials.gstPercentage}%)</th>
                                    <td className="text-right">+ ₹ {Math.round(gstAmount).toLocaleString('en-IN')}</td>
                                </tr>
                                <tr className="font-bold text-lg bg-gray-100">
                                    <th className="py-2 px-1">Grand Total</th>
                                    <td className="text-right px-1">₹ {Math.round(grandTotal).toLocaleString('en-IN')}</td>
                                </tr>
                            </tbody>
                        </table>
                        <div className="text-right mt-2">
                            <p className="text-xs">Amount in Words:</p>
                            <p className="font-bold text-xs">{amountToWords(grandTotal)}</p>
                        </div>

                        <EditableSection
                            title="Description"
                            value={settings.description}
                            onChange={value => setSettings({ ...settings, description: value })}
                        />

                        <EditableSection
                            title="Terms & Conditions"
                            value={settings.terms}
                            onChange={value => setSettings({ ...settings, terms: value })}
                        />
                        
                        <div className="grid grid-cols-2 gap-8 print-final-details mt-4" style={{breakInside: 'avoid'}}>
                            <div className="text-xs">
                                <h3 className="font-bold text-sm mb-1 border-b border-gray-300 pb-1">Bank Details</h3>
                                <p><strong>A/C Name:</strong> {settings.bankDetails.name}</p>
                                <p><strong>A/C No:</strong> {settings.bankDetails.accountNumber}</p>
                                <p><strong>IFSC:</strong> {settings.bankDetails.ifsc}</p>
                                <p><strong>Branch:</strong> {settings.bankDetails.branch}</p>
                                <p><strong>A/C Type:</strong> {settings.bankDetails.accountType.charAt(0).toUpperCase() + settings.bankDetails.accountType.slice(1)}</p>
                            </div>
                            <div>
                                <h3 className="font-bold text-sm mb-1 border-b border-gray-300 pb-1">For {settings.company.name}</h3>
                                <div className="h-24"></div>
                                <p className="border-t border-black pt-1 text-center text-xs">Authorised Signature</p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* This footer is only for print, positioned by CSS */}
                <div className="print-footer-container">
                    <div className="print-footer">
                        Page <span className="page-counter"></span>
                    </div>
                </div>

                {/* --- End of Printable Content --- */}
            </div>
        </div>
    </div>
  );
};