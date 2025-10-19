

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
    profileSize: number;
    scale: number;
    color: string;
}> = ({ width, height, profileSize, scale, color }) => {
    const s = profileSize * scale;

    const baseStyle: React.CSSProperties = {
        backgroundColor: color,
        border: '0.5px solid #555',
        position: 'absolute',
        boxSizing: 'border-box',
    };

    const clipS = Math.max(0, s);

    return (
        <div className="absolute" style={{ width: width * scale, height: height * scale }}>
            {/* Top */}
            <div style={{...baseStyle, top: 0, left: 0, width: '100%', height: s, clipPath: `polygon(0 0, 100% 0, calc(100% - ${clipS}px) 100%, ${clipS}px 100%)` }} />
            {/* Bottom */}
            <div style={{...baseStyle, bottom: 0, left: 0, width: '100%', height: s, clipPath: `polygon(${clipS}px 0, calc(100% - ${clipS}px) 0, 100% 100%, 0 100%)` }} />
            {/* Left */}
            <div style={{...baseStyle, top: 0, left: 0, width: s, height: '100%', clipPath: `polygon(0 0, 100% ${clipS}px, 100% calc(100% - ${clipS}px), 0 100%)` }} />
            {/* Right */}
            <div style={{...baseStyle, top: 0, right: 0, width: s, height: '100%', clipPath: `polygon(0 ${clipS}px, 100% 0, 100% 100%, 0 calc(100% - ${clipS}px))` }} />
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
        profileElements.push(<PrintProfilePiece key="frame-left" color={profileColor} style={{ top: 0, left: 0, width: dims.outerFrame * scale, height: numHeight * scale }} />);
        profileElements.push(<PrintProfilePiece key="frame-right" color={profileColor} style={{ top: 0, right: 0, width: dims.outerFrame * scale, height: numHeight * scale }} />);
        profileElements.push(<PrintProfilePiece key="frame-top" color={profileColor} style={{ top: 0, left: dims.outerFrame * scale, width: (numWidth - 2 * dims.outerFrame) * scale, height: dims.outerFrame * scale }} />);
        profileElements.push(<PrintProfilePiece key="frame-bottom" color={profileColor} style={{ bottom: 0, left: dims.outerFrame * scale, width: (numWidth - 2 * dims.outerFrame) * scale, height: dims.outerFrame * scale }} />);
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
                <PrintProfilePiece color={profileColor} style={{ top: 0, left: 0, width: leftProfile * scale, height: height * scale}} />
                <PrintProfilePiece color={profileColor} style={{ top: 0, right: 0, width: rightProfile * scale, height: height * scale}} />
                <PrintProfilePiece color={profileColor} style={{ top: 0, left: leftProfile * scale, width: glassWidth * scale, height: topProfile * scale}} />
                <PrintProfilePiece color={profileColor} style={{ bottom: 0, left: leftProfile * scale, width: glassWidth * scale, height: bottomProfile * scale}} />
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
                        const hasSliding = partitionPanels.types.some(p => p.type === 'sliding');
                        if (hasSliding) {
                            panels.push(<PrintProfilePiece key="track-top" color={profileColor} style={{ top: 0, left: 0, width: innerAreaWidth * scale, height: dims.topTrack * scale }} />);
                            panels.push(<PrintProfilePiece key="track-bottom" color={profileColor} style={{ bottom: 0, left: 0, width: innerAreaWidth * scale, height: dims.bottomTrack * scale }} />);
                        }
                        const panelAreaY = hasSliding ? dims.topTrack : 0;
                        const panelAreaHeight = innerAreaHeight - (hasSliding ? dims.topTrack + dims.bottomTrack : 0);

                        for (let i=0; i < partitionPanels.count; i++) {
                            const panelConfig = partitionPanels.types[i];
                            const type = panelConfig?.type;
                            const zIndex = type === 'sliding' ? 10 + i : 5;
                            let panelX = i * (panelWidth);
                            let currentPanelWidth = panelWidth;
                            if (type === 'sliding') {
                                panelX = i * (panelWidth - overlap);
                                currentPanelWidth += overlap;
                            }
                             if (panelConfig?.handle) {
                                handleElements.push(<div key={`handle-part-${i}`} style={{ position: 'absolute', zIndex: 30, left: (panelX + currentPanelWidth * panelConfig.handle.x / 100) * scale, top: (panelAreaY + panelAreaHeight * panelConfig.handle.y / 100) * scale, transform: 'translate(-50%, -50%)' }}><PrintableHandle config={panelConfig.handle} scale={scale} /></div>);
                            }
                            
                            if (type === 'fixed') {
                                panels.push(<div key={`panel-${i}`} className="absolute" style={{left: panelX*scale, top: panelAreaY*scale, width: panelWidth*scale, height: panelAreaHeight*scale}}><GlassPanel style={{left: 0, top: 0, width: '100%', height: '100%'}} glassWidth={panelWidth} glassHeight={panelAreaHeight}><PrintShutterIndicator type="fixed" /></GlassPanel></div>);
                            } else if (type === 'sliding') {
                                panels.push(<div key={`panel-${i}`} className="absolute" style={{left: panelX*scale, top: panelAreaY*scale, width: currentPanelWidth*scale, height: panelAreaHeight*scale, zIndex}}><GlassPanel style={{left: 0, top: 0, width: '100%', height: '100%'}} glassWidth={currentPanelWidth} glassHeight={panelAreaHeight}><PrintShutterIndicator type="sliding" /></GlassPanel></div>);
                            } else if (type === 'hinged') {
                                panels.push(<div key={`panel-${i}`} className="absolute" style={{left: panelX*scale, top: panelAreaY*scale, width: panelWidth*scale, height: panelAreaHeight*scale}}>
                                  <PrintableMiteredFrame width={panelWidth} height={panelAreaHeight} profileSize={dims.casementShutter} scale={scale} color={profileColor} />
                                  <GlassPanel style={{left: dims.casementShutter*scale, top:dims.casementShutter*scale, width: (panelWidth - 2*dims.casementShutter)*scale, height: (panelAreaHeight - 2*dims.casementShutter)*scale}} glassWidth={panelWidth - 2*dims.casementShutter} glassHeight={panelAreaHeight - 2*dims.casementShutter}><PrintShutterIndicator type="hinged" /></GlassPanel>
                                </div>);
                            }
                        }
                        return <>{panels}</>;
                    })()}
                    {handleElements}
                </div>
            )}
            <PrintDimensionLabel value={numWidth} className="-top-5 left-1/2 -translate-x-1/2" style={{transform: 'translateX(-50%)'}}/>
            <PrintDimensionLabel value={numHeight} className="top-1/2 -translate-y-1/2 -left-10 rotate-[-90deg]" />
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

  const itemPages = useMemo(() => {
    const ITEMS_PER_FIRST_PAGE = 2;
    const ITEMS_PER_SUBSEQUENT_PAGES = 4;
    
    if (items.length === 0) {
        return [];
    }

    const result: QuotationItem[][] = [];
    const remainingItems = [...items];
    
    result.push(remainingItems.splice(0, ITEMS_PER_FIRST_PAGE));
    
    while (remainingItems.length > 0) {
        result.push(remainingItems.splice(0, ITEMS_PER_SUBSEQUENT_PAGES));
    }
    return result;
  }, [items]);
  
  const totalPages = (itemPages.length > 0 ? itemPages.length : 0) + 1;

  const handleExportPdf = () => {
    const element = printContainerRef.current;
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
        pagebreak: { mode: 'css', after: '.a4-page' }
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
            {itemPages.map((pageItems, pageIndex) => (
                <div 
                    key={pageIndex} 
                    className="a4-page text-black"
                >
                    {pageIndex === 0 && (
                        <div className="print-header">
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
                                    <h1 className="text-3xl font-light text-gray-600">QUOTATION</h1>
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
                    )}
                    
                    <div className="print-content">
                        {pageIndex === 0 && (
                          <h2 className="text-xl font-bold text-center mb-2 text-black">{settings.title}</h2>
                        )}
                        
                        <div className="w-full text-xs mt-4 space-y-2">
                            {pageItems.map((item, index) => {
                                const globalIndex = itemPages.slice(0, pageIndex).reduce((acc, curr) => acc + curr.length, 0) + index;
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

                                let panelSummary = '';
                                if (item.config.windowType === WindowType.GLASS_PARTITION) {
                                    const typeCounts = item.config.partitionPanels.types.reduce((acc, panelConfig) => {
                                        acc[panelConfig.type] = (acc[panelConfig.type] || 0) + 1;
                                        return acc;
                                    }, {} as Record<string, number>);
                                    panelSummary = Object.entries(typeCounts).map(([type, count]) => `${count} ${type}`).join(', ');
                                }

                                return (
                                    <div key={item.id} className="border-b border-gray-300 print-item pt-4 pb-4" style={{breakInside: 'avoid'}}>
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
                                                    <p><strong>Glass:</strong> {glassThicknessText}mm {specialTypeText} {item.config.glassType}</p>
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
                    </div>

                    <div className="print-footer">
                         <span className="page-number float-right">Page {pageIndex + 1} of {totalPages}</span>
                    </div>
                </div>
            ))}

            <div className="a4-page text-black">
                {items.length === 0 && (
                     <div className="print-header">
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
                                <h1 className="text-3xl font-light text-gray-600">QUOTATION</h1>
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
                )}
                 <div className="print-content !block">
                    {items.length === 0 && (
                        <p className="text-slate-500 text-center py-20">Quotation is empty. Add items from the main screen.</p>
                    )}
                    <div className="flex justify-end mt-4 print-summary">
                        <div className="w-2/5 text-black text-[9pt]">
                            <div className="flex justify-between p-1">
                                <span>Sub Total</span>
                                <span>₹ {Math.round(subTotal).toLocaleString('en-IN')}</span>
                            </div>
                            <div className="flex justify-between p-1">
                                <span>Discount ({settings.financials.discountType === 'percentage' ? `${settings.financials.discount || 0}%` : 'Fixed'})</span>
                                <span>- ₹ {Math.round(discountAmount).toLocaleString('en-IN')}</span>
                            </div>
                            <div className="flex justify-between p-1">
                                <span>Taxable Value</span>
                                <span>₹ {Math.round(totalAfterDiscount).toLocaleString('en-IN')}</span>
                            </div>
                            <div className="flex justify-between p-1">
                                <span>GST ({settings.financials.gstPercentage || 0}%)</span>
                                <span>+ ₹ {Math.round(gstAmount).toLocaleString('en-IN')}</span>
                            </div>
                            <div className="flex justify-between font-bold text-lg p-2 border-t-2 border-black mt-1">
                                <span>Grand Total</span>
                                <span>₹ {Math.round(grandTotal).toLocaleString('en-IN')}</span>
                            </div>
                        </div>
                    </div>
                    
                    <EditableSection 
                        title="Project Description" 
                        value={settings.description} 
                        onChange={val => setSettings({...settings, description: val})}
                    />

                    <div className="grid grid-cols-2 gap-8 mt-6">
                        <div>
                            <EditableSection title="Terms & Conditions" value={settings.terms} onChange={val => setSettings({...settings, terms: val})}/>
                        </div>
                        <div>
                            <div className="print-final-details" style={{breakInside: 'avoid'}}>
                                <h3 className="font-bold text-sm mb-1 border-b border-gray-300 pb-1">Bank Details for Payment</h3>
                                <div className="text-xs grid grid-cols-2 gap-x-4">
                                    <strong>A/C Name:</strong> <span>{settings.bankDetails.name}</span>
                                    <strong>A/C Number:</strong> <span>{settings.bankDetails.accountNumber}</span>
                                    <strong>IFSC Code:</strong> <span>{settings.bankDetails.ifsc}</span>
                                    <strong>Branch:</strong> <span>{settings.bankDetails.branch}</span>
                                    <strong>A/C Type:</strong> <span className="capitalize">{settings.bankDetails.accountType}</span>
                                </div>
                            </div>
                            <div className="print-final-details mt-8" style={{breakInside: 'avoid'}}>
                                <div className="h-24"></div>
                                <h3 className="font-bold text-sm text-center border-t border-gray-400 pt-1">Authorised Signature</h3>
                            </div>
                        </div>
                    </div>
                 </div>
                 <div className="print-footer">
                    <span>Thank you for your business!</span>
                    <span className="page-number float-right">Page {itemPages.length + 1} of {totalPages}</span>
                </div>
            </div>

        </div>
    </div>
  );
}
