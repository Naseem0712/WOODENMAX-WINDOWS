import React, { useState, useRef, useEffect, useMemo } from 'react';
import type { WindowConfig, HandleConfig, CornerSideConfig } from '../types';
import { FixedPanelPosition, ShutterConfigType, WindowType, GlassType } from '../types';
import { PlusIcon } from './icons/PlusIcon';
import { MinusIcon } from './icons/MinusIcon';
import { ArrowsPointingInIcon } from './icons/ArrowsPointingInIcon';
import { TrashIcon } from './icons/TrashIcon';


interface WindowCanvasProps {
  config: WindowConfig;
  onRemoveVerticalDivider: (index: number) => void;
  onRemoveHorizontalDivider: (index: number) => void;
}

const DimensionLabel: React.FC<{ value: number; unit?: string, className?: string, style?: React.CSSProperties }> = ({ value, unit = "mm", className, style }) => (
    <span className={`absolute bg-slate-900 bg-opacity-60 text-slate-200 text-base font-mono px-1.5 py-0.5 rounded ${className}`} style={style}>
        {value.toFixed(0)}{unit}
    </span>
);

const ShutterIndicator: React.FC<{ type: 'fixed' | 'sliding' | 'hinged' }> = ({ type }) => {
    if (!type) return null;
    
    const baseStyle = "absolute inset-0 flex items-center justify-center text-white font-bold tracking-widest text-lg pointer-events-none";
    const textShadow = { textShadow: '0 0 5px rgba(0,0,0,0.7)' };

    if (type === 'fixed') {
        return <div className={baseStyle} style={textShadow}>FIXED</div>;
    }

    if (type === 'sliding') {
        return (
            <div className={`${baseStyle} opacity-60`}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="drop-shadow-md">
                    <path d="M11 17L6 12L11 7" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                 <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="drop-shadow-md">
                    <path d="M13 17L18 12L13 7M6 17L11 12L6 7" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
            </div>
        );
    }

    if (type === 'hinged') {
       return <div className="absolute inset-0 flex items-center justify-start opacity-30 pointer-events-none"><svg viewBox="0 0 100 100" preserveAspectRatio="none" className="w-full h-full"><path d="M 90 10 A 80 80 0 0 0 90 90" stroke="white" strokeDasharray="4" strokeWidth="1" fill="none"/></svg></div>
    }
    return null;
}

const Handle: React.FC<{ config: HandleConfig, scale: number, color: string }> = ({ config, scale, color }) => {
    const handleWidth = 25; // mm
    const handleHeight = 150; // mm
    const isVertical = config.orientation === 'vertical';
    const style: React.CSSProperties = {
        position: 'absolute',
        backgroundColor: color,
        border: '1px solid rgba(0,0,0,0.5)',
        boxShadow: '1px 1px 3px rgba(0,0,0,0.3)',
        borderRadius: '3px',
        width: (isVertical ? handleWidth : handleHeight) * scale,
        height: (isVertical ? handleHeight : handleWidth) * scale,
    };
    return <div style={style} />;
};


const ProfilePiece: React.FC<{style: React.CSSProperties, color: string}> = React.memo(({ style, color }) => ( <div style={{ backgroundColor: color, boxShadow: 'inset 0 0 0 1px rgba(0,0,0,0.3)', position: 'absolute', ...style }} /> ));

const GlassGrid: React.FC<{width: number, height: number, rows: number, cols: number, profileSize: number, scale: number, color: string}> = React.memo(({ width, height, rows, cols, profileSize, scale, color }) => {
    if (rows <= 0 && cols <= 0) return null;
    const elements: React.ReactNode[] = [];

    for (let i = 1; i <= rows; i++) {
        const top = (i * height / (rows + 1)) - (profileSize / 2);
        elements.push(<ProfilePiece key={`h-grid-${i}`} color={color} style={{ top: top * scale, left: 0, width: width * scale, height: profileSize * scale }} />);
    }
     for (let i = 1; i <= cols; i++) {
        const left = (i * width / (cols + 1)) - (profileSize / 2);
        elements.push(<ProfilePiece key={`v-grid-${i}`} color={color} style={{ left: left * scale, top: 0, width: profileSize * scale, height: height * scale }} />);
    }

    return <>{elements}</>
});

const MiteredFrame: React.FC<{
    width: number;
    height: number;
    profileSize?: number;
    topSize?: number;
    bottomSize?: number;
    leftSize?: number;
    rightSize?: number;
    scale: number;
    color: string;
}> = React.memo(({ width, height, profileSize = 0, topSize, bottomSize, leftSize, rightSize, scale, color }) => {
    const ts = (topSize ?? profileSize) * scale;
    const bs = (bottomSize ?? profileSize) * scale;
    const ls = (leftSize ?? profileSize) * scale;
    const rs = (rightSize ?? profileSize) * scale;

    const baseStyle: React.CSSProperties = {
        backgroundColor: color,
        boxShadow: 'inset 0 0 0 1px rgba(0,0,0,0.3)',
        position: 'absolute',
    };

    const clipTs = Math.max(0, ts);
    const clipBs = Math.max(0, bs);
    const clipLs = Math.max(0, ls);
    const clipRs = Math.max(0, rs);

    return (
        <div className="absolute" style={{ width: width * scale, height: height * scale }}>
            <div style={{...baseStyle, top: 0, left: 0, width: '100%', height: clipTs, clipPath: `polygon(0 0, 100% 0, calc(100% - ${clipRs}px) 100%, ${clipLs}px 100%)` }} />
            <div style={{...baseStyle, bottom: 0, left: 0, width: '100%', height: clipBs, clipPath: `polygon(${clipLs}px 0, calc(100% - ${clipRs}px) 0, 100% 100%, 0 100%)` }} />
            <div style={{...baseStyle, top: 0, left: 0, width: clipLs, height: '100%', clipPath: `polygon(0 0, 100% ${clipTs}px, 100% calc(100% - ${clipBs}px), 0 100%)` }} />
            <div style={{...baseStyle, top: 0, right: 0, width: clipRs, height: '100%', clipPath: `polygon(0 ${clipTs}px, 100% 0, 100% 100%, 0 calc(100% - ${clipBs}px))` }} />
        </div>
    );
});

const ButtJointFrame: React.FC<{ width: number; height: number; top: number; bottom: number; left: number; right: number; scale: number; color: string; }> = React.memo(({ width, height, top, bottom, left, right, scale, color }) => {
    const ts = top * scale; const bs = bottom * scale; const ls = left * scale; const rs = right * scale;
    const h = height * scale;
    return (
        <>
            <ProfilePiece color={color} style={{ top: 0, left: 0, width: width * scale, height: ts }} />
            <ProfilePiece color={color} style={{ bottom: 0, left: 0, width: width * scale, height: bs }} />
            <ProfilePiece color={color} style={{ top: ts, left: 0, width: ls, height: h - ts - bs }} />
            <ProfilePiece color={color} style={{ top: ts, right: 0, width: rs, height: h - ts - bs }} />
        </>
    );
});

const SlidingShutter: React.FC<{
    width: number;
    height: number;
    topProfile: number;
    bottomProfile: number;
    rightProfile: number;
    leftProfile: number;
    color: string;
    scale: number;
    isMesh: boolean;
    glassType: GlassType;
    glassStyles: Record<GlassType, React.CSSProperties>;
    isFixed?: boolean;
    isSliding?: boolean;
}> = React.memo(({ width, height, topProfile, rightProfile, bottomProfile, leftProfile, color, scale, isMesh, glassType, glassStyles, isFixed = false, isSliding = false }) => {
    
    const glassWidth = width - leftProfile - rightProfile;
    const glassHeight = height - topProfile - bottomProfile;

    return (
        <div className="absolute" style={{ width: width * scale, height: height * scale }}>
             <MiteredFrame 
                width={width}
                height={height}
                topSize={topProfile}
                bottomSize={bottomProfile}
                leftSize={leftProfile}
                rightSize={rightProfile}
                scale={scale}
                color={color}
             />
            <div className={`absolute`} style={{ left: leftProfile * scale, top: topProfile * scale, width: glassWidth * scale, height: glassHeight * scale, ...(!isMesh && glassStyles[glassType]) }}>
                {isMesh && <div className="w-full h-full" style={{backgroundColor: '#808080', opacity: 0.5, backgroundImage: `linear-gradient(45deg, #000 25%, transparent 25%), linear-gradient(-45deg, #000 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #000 75%), linear-gradient(-45deg, transparent 75%, #000 75%)`, backgroundSize: '4px 4px' }} />}
                <ShutterIndicator type={isFixed ? 'fixed' : isSliding ? 'sliding' : null} />
            </div>
        </div>
    );
});

const createWindowElements = (
    config: WindowConfig, 
    scale: number, 
    dims: any, 
    glassStyles: Record<GlassType, React.CSSProperties>,
    onRemoveHorizontalDivider: (index: number) => void,
    onRemoveVerticalDivider: (index: number) => void
) => {
    const { width, height, series, fixedPanels, glassType, profileColor, windowType } = config;
    const numHeight = Number(height) || 0;

    const geometry = (() => {
        const w = Number(width) || 0;
        const topFix = fixedPanels.find(p => p.position === FixedPanelPosition.TOP);
        const bottomFix = fixedPanels.find(p => p.position === FixedPanelPosition.BOTTOM);
        const leftFix = fixedPanels.find(p => p.position === FixedPanelPosition.LEFT);
        const rightFix = fixedPanels.find(p => p.position === FixedPanelPosition.RIGHT);

        const frameOffset = (windowType !== WindowType.GLASS_PARTITION && windowType !== WindowType.CORNER) ? dims.outerFrame : 0;
        const holeX1 = leftFix ? leftFix.size : frameOffset;
        const holeY1 = topFix ? topFix.size : frameOffset;
        const holeX2 = rightFix ? w - rightFix.size : w - frameOffset;
        const holeY2 = bottomFix ? numHeight - bottomFix.size : numHeight - frameOffset;
        
        return { topFix, bottomFix, leftFix, rightFix, frameOffset, holeX1, holeY1, holeX2, holeY2 };
    })();

    const profileElements: React.ReactNode[] = [];
    const glassElements: React.ReactNode[] = [];
    const handleElements: React.ReactNode[] = [];
    const { topFix, bottomFix, leftFix, rightFix, frameOffset, holeX1, holeY1, holeX2, holeY2 } = geometry;
    const w = Number(width) || 0;
    const innerAreaWidth = holeX2 - holeX1;
    const innerAreaHeight = holeY2 - holeY1;
    
    const GlassPanel: React.FC<{style: React.CSSProperties, children?: React.ReactNode, glassWidth: number, glassHeight: number}> = ({ style, children, glassWidth, glassHeight }) => ( 
      <div className="absolute" style={{...glassStyles[glassType], ...style, boxShadow: 'inset 0 0 1px 1px rgba(0,0,0,0.1)'}}>
        <GlassGrid width={glassWidth} height={glassHeight} rows={config.glassGrid.rows} cols={config.glassGrid.cols} profileSize={dims.glassGridProfile} scale={scale} color={profileColor} />
        {children}
      </div> 
    );
  
    if (windowType !== WindowType.GLASS_PARTITION && windowType !== WindowType.CORNER) {
        const verticalFrame = dims.outerFrameVertical > 0 ? dims.outerFrameVertical : dims.outerFrame;
        profileElements.push(<MiteredFrame key="outer-frame" width={w} height={numHeight} topSize={dims.outerFrame} bottomSize={dims.outerFrame} leftSize={verticalFrame} rightSize={verticalFrame} scale={scale} color={profileColor} />);
    }

    if (leftFix) profileElements.push(<ProfilePiece key="divider-left" color={profileColor} style={{ top: frameOffset * scale, left: (holeX1 - dims.fixedFrame) * scale, width: dims.fixedFrame * scale, height: (numHeight - 2 * frameOffset) * scale }} />);
    if (rightFix) profileElements.push(<ProfilePiece key="divider-right" color={profileColor} style={{ top: frameOffset * scale, left: holeX2 * scale, width: dims.fixedFrame * scale, height: (numHeight - 2 * frameOffset) * scale }} />);
    
    const hDividerX = leftFix ? holeX1 : frameOffset;
    const hDividerWidth = (rightFix ? holeX2 : w - frameOffset) - hDividerX;
  
    if (topFix) {
        profileElements.push(<ProfilePiece key="divider-top" color={profileColor} style={{ top: (holeY1 - dims.fixedFrame) * scale, left: hDividerX * scale, width: hDividerWidth * scale, height: dims.fixedFrame * scale }} />);
        const glassW = hDividerWidth;
        const glassH = holeY1 - frameOffset - dims.fixedFrame;
        glassElements.push(<GlassPanel key="glass-top" style={{ top: frameOffset * scale, left: hDividerX * scale, width: glassW * scale, height: glassH * scale }} glassWidth={glassW} glassHeight={glassH} />);
    }
    if (bottomFix) {
        profileElements.push(<ProfilePiece key="divider-bottom" color={profileColor} style={{ top: holeY2 * scale, left: hDividerX * scale, width: hDividerWidth * scale, height: dims.fixedFrame * scale }} />);
        const glassW = hDividerWidth;
        const glassH = numHeight - holeY2 - frameOffset - dims.fixedFrame;
        glassElements.push(<GlassPanel key="glass-bottom" style={{ top: (holeY2 + dims.fixedFrame) * scale, left: hDividerX * scale, width: glassW * scale, height: glassH * scale }} glassWidth={glassW} glassHeight={glassH}/>);
    }
    const vGlassY = topFix ? holeY1 : frameOffset;
    const vGlassHeight = (bottomFix ? holeY2 : numHeight - frameOffset) - vGlassY;
    if (leftFix) {
        const glassW = holeX1 - frameOffset - dims.fixedFrame;
        const glassH = vGlassHeight;
        glassElements.push(<GlassPanel key="glass-left" style={{ top: vGlassY * scale, left: frameOffset * scale, width: glassW * scale, height: glassH * scale }} glassWidth={glassW} glassHeight={glassH}/>);
    }
    if (rightFix) {
        const glassW = w - holeX2 - frameOffset - dims.fixedFrame;
        const glassH = vGlassHeight;
        glassElements.push(<GlassPanel key="glass-right" style={{ top: vGlassY * scale, left: (holeX2 + dims.fixedFrame) * scale, width: glassW * scale, height: glassH * scale }} glassWidth={glassW} glassHeight={glassH}/>);
    }

    const innerContent: React.ReactNode[] = [];
    if (innerAreaWidth > 0 && innerAreaHeight > 0) {
       switch (windowType) {
            case WindowType.SLIDING: {
                const { shutterConfig, fixedShutters, slidingHandles } = config;
                const is4G = shutterConfig === ShutterConfigType.FOUR_GLASS;
                const numShutters = is4G ? 4 : (shutterConfig === ShutterConfigType.TWO_GLASS ? 2 : 3);
                const hasMesh = shutterConfig === ShutterConfigType.TWO_GLASS_ONE_MESH;

                if (is4G) {
                    const shutterWidth = (innerAreaWidth + (2 * dims.shutterInterlock) + dims.shutterMeeting) / 4;
                    const positions = [ 0, shutterWidth - dims.shutterInterlock, (2*shutterWidth) - dims.shutterInterlock - dims.shutterMeeting, (3*shutterWidth) - (2*dims.shutterInterlock) - dims.shutterMeeting ];
                    const profiles = [
                        { l: dims.shutterHandle, r: dims.shutterInterlock }, { l: dims.shutterInterlock, r: dims.shutterMeeting },
                        { l: dims.shutterMeeting, r: dims.shutterInterlock }, { l: dims.shutterInterlock, r: dims.shutterHandle }
                    ];
                    
                    slidingHandles.forEach((handleConfig, i) => {
                        if (handleConfig) {
                              handleElements.push(<div key={`handle-${i}`} style={{ position: 'absolute', zIndex: 30, left: (positions[i] + shutterWidth * handleConfig.x / 100) * scale, top: (innerAreaHeight * handleConfig.y / 100) * scale, transform: 'translate(-50%, -50%)' }}><Handle config={handleConfig} scale={scale} color={profileColor} /></div>);
                        }
                    });
                    
                    innerContent.push(...profiles.map((p, i) => <div key={i} className="absolute" style={{ left: positions[i] * scale, zIndex: (i === 1 || i === 2) ? 10 : 5 }}><SlidingShutter width={shutterWidth} height={innerAreaHeight} topProfile={dims.shutterTop} bottomProfile={dims.shutterBottom} leftProfile={p.l} rightProfile={p.r} color={profileColor} scale={scale} isMesh={false} glassType={glassType} glassStyles={glassStyles} isFixed={fixedShutters[i]} isSliding={!fixedShutters[i]} /></div>));
                } else {
                    const shutterDivider = hasMesh ? 2 : numShutters;
                    const shutterWidth = (innerAreaWidth + (shutterDivider - 1) * dims.shutterInterlock) / shutterDivider;
                    innerContent.push(...Array.from({ length: numShutters }).map((_, i) => {
                        const isMeshShutter = hasMesh && i === numShutters - 1;
                        let leftPosition = (hasMesh ? Math.min(i, numShutters - 2) : i) * (shutterWidth - dims.shutterInterlock);
                        
                        const handleConfig = slidingHandles[i];
                        if (handleConfig) {
                              handleElements.push(<div key={`handle-${i}`} style={{ position: 'absolute', zIndex: 30, left: (leftPosition + shutterWidth * handleConfig.x / 100) * scale, top: (innerAreaHeight * handleConfig.y / 100) * scale, transform: 'translate(-50%, -50%)' }}><Handle config={handleConfig} scale={scale} color={profileColor} /></div>);
                        }
                        
                        return ( <div key={i} className="absolute" style={{ left: leftPosition * scale, zIndex: i + (isMeshShutter ? 10 : 5) }}><SlidingShutter width={shutterWidth} height={innerAreaHeight} topProfile={dims.shutterTop} bottomProfile={dims.shutterBottom} leftProfile={i === 0 ? dims.shutterHandle : dims.shutterInterlock} rightProfile={i === numShutters - 1 ? dims.shutterHandle : dims.shutterInterlock} color={profileColor} scale={scale} isMesh={isMeshShutter} glassType={glassType} glassStyles={glassStyles} isFixed={fixedShutters[i]} isSliding={!fixedShutters[i]} /></div> );
                    }));
                }
                break;
            }
            case WindowType.CASEMENT:
            case WindowType.VENTILATOR: {
                const { verticalDividers, horizontalDividers } = config;
                const gridCols = verticalDividers.length + 1;
                const gridRows = horizontalDividers.length + 1;
                
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
                            handleElements.push(<div key={`handle-${r}-${c}`} style={{ position: 'absolute', zIndex: 30, left: (cellX + cellW * doorInfo.handle.x / 100) * scale, top: (cellY + cellH * doorInfo.handle.y / 100) * scale, transform: 'translate(-50%, -50%)' }}><Handle config={doorInfo.handle} scale={scale} color={profileColor} /></div>);
                          }

                        if (windowType === WindowType.CASEMENT) {
                            if (doorInfo) {
                                innerContent.push(
                                  <div key={`cell-${r}-${c}`} className="absolute" style={{left: cellX*scale, top: cellY*scale, width: cellW*scale, height: cellH*scale}}>
                                    <MiteredFrame width={cellW} height={cellH} profileSize={dims.casementShutter} scale={scale} color={profileColor} />
                                    <GlassPanel style={{ left: dims.casementShutter*scale, top: dims.casementShutter*scale, width: (cellW - 2 * dims.casementShutter)*scale, height: (cellH - 2 * dims.casementShutter)*scale }} glassWidth={cellW - 2 * dims.casementShutter} glassHeight={cellH - 2 * dims.casementShutter} />
                                    <div className="absolute inset-0 flex items-center justify-center opacity-30 pointer-events-none"><svg viewBox="0 0 100 100" className="w-1/2 h-1/2" style={{transform: c % 2 === 0 ? 'scaleX(1)' : 'scaleX(-1)'}}><path d="M 10 10 L 10 90 L 90 90" stroke="white" strokeDasharray="4" strokeWidth="2" fill="none"/></svg></div>
                                  </div>
                                );
                            } else { innerContent.push(<GlassPanel key={`cell-${r}-${c}`} style={{left: cellX*scale, top: cellY*scale, width: cellW*scale, height: cellH*scale}} glassWidth={cellW} glassHeight={cellH} />); }
                        } else { // Ventilator
                            const cell = config.ventilatorGrid[r]?.[c];
                            const cellType = cell?.type || 'glass';
                            if (cell?.handle) {
                                handleElements.push(<div key={`handle-vent-${r}-${c}`} style={{ position: 'absolute', zIndex: 30, left: (cellX + cellW * cell.handle.x / 100) * scale, top: (cellY + cellH * cell.handle.y / 100) * scale, transform: 'translate(-50%, -50%)' }}><Handle config={cell.handle} scale={scale} color={profileColor} /></div>);
                            }
                            if (cellType === 'door') {
                                innerContent.push(
                                  <div key={`cell-${r}-${c}`} className="absolute" style={{left: cellX*scale, top: cellY*scale, width: cellW*scale, height: cellH*scale}}>
                                    <MiteredFrame width={cellW} height={cellH} profileSize={dims.casementShutter} scale={scale} color={profileColor} />
                                    <GlassPanel style={{ left: dims.casementShutter*scale, top: dims.casementShutter*scale, width: (cellW - 2 * dims.casementShutter)*scale, height: (cellH - 2 * dims.casementShutter)*scale }} glassWidth={cellW - 2*dims.casementShutter} glassHeight={cellH - 2*dims.casementShutter}/>
                                    <div className="absolute inset-0 flex items-center justify-center opacity-30 pointer-events-none"><svg viewBox="0 0 100 100" className="w-1/2 h-1/2" style={{transform: c % 2 === 0 ? 'scaleX(1)' : 'scaleX(-1)'}}><path d="M 10 10 L 10 90 L 90 90" stroke="white" strokeDasharray="4" strokeWidth="2" fill="none"/></svg></div>
                                  </div>
                                );
                            } else if (cellType === 'louvers') {
                                const louvers: React.ReactNode[] = [];
                                if (dims.louverBlade > 0) {
                                    const spacing = dims.louverBlade;
                                    const numLouvers = Math.ceil(cellH / spacing);
                                     for (let i=0; i < numLouvers; i++) {
                                       louvers.push(<ProfilePiece key={`louver-${i}`} color={profileColor} style={{left: 0, top: (i * spacing)*scale, width: cellW*scale, height: dims.louverBlade*scale }}/>)
                                     }
                                }
                                innerContent.push(<div key={`cell-${r}-${c}`} className="absolute" style={{left: cellX*scale, top: cellY*scale, width: cellW*scale, height: cellH*scale}}>{louvers}</div>);
                            } else if (cellType === 'exhaust_fan') {
                                innerContent.push(
                                  <div key={`cell-${r}-${c}`} className="absolute flex items-center justify-center" style={{left: cellX*scale, top: cellY*scale, width: cellW*scale, height: cellH*scale}}>
                                     <svg viewBox="0 0 100 100" className="w-full h-full text-slate-500 opacity-50">
                                          <circle cx="50" cy="50" r="45" fill="none" stroke="currentColor" strokeWidth="2"/>
                                          <circle cx="50" cy="50" r="10" fill="currentColor" />
                                          {[0, 72, 144, 216, 288].map(angle => (
                                            <path key={angle} d="M50 50 L 50 10 A 40 40 0 0 1 84 36 L 50 50 Z" fill="currentColor" transform={`rotate(${angle} 50 50)`}/>
                                          ))}
                                     </svg>
                                  </div>
                                )
                            }
                            else { innerContent.push(<GlassPanel key={`cell-${r}-${c}`} style={{left: cellX*scale, top: cellY*scale, width: cellW*scale, height: cellH*scale}} glassWidth={cellW} glassHeight={cellH} />); }
                        }
                    }
                }

                horizontalDividers.forEach((pos, i) => {
                    innerContent.push(
                      <button key={`hmullion-${i}`} onClick={() => onRemoveHorizontalDivider(i)} className="absolute w-full group" style={{ top: (pos * innerAreaHeight - dims.mullion / 2) * scale, height: dims.mullion * scale, zIndex: 10 }}>
                          <ProfilePiece color={profileColor} style={{left: 0, top: 0, width: '100%', height: '100%'}}/>
                          <div className="absolute inset-0 bg-red-500 bg-opacity-0 group-hover:bg-opacity-50 transition-colors flex items-center justify-center">
                              <TrashIcon className="w-5 h-5 text-white opacity-0 group-hover:opacity-100"/>
                          </div>
                      </button>
                    );
                });
            
                verticalDividers.forEach((pos, i) => {
                    innerContent.push(
                      <button key={`vmullion-${i}`} onClick={() => onRemoveVerticalDivider(i)} className="absolute h-full group" style={{ left: (pos * innerAreaWidth - dims.mullion / 2) * scale, width: dims.mullion * scale, zIndex: 10 }}>
                         <ProfilePiece color={profileColor} style={{left: 0, top: 0, width: '100%', height: '100%'}}/>
                         <div className="absolute inset-0 bg-red-500 bg-opacity-0 group-hover:bg-opacity-50 transition-colors flex items-center justify-center">
                              <TrashIcon className="w-5 h-5 text-white opacity-0 group-hover:opacity-100"/>
                          </div>
                      </button>
                    );
                });
                break;
            }
            case WindowType.GLASS_PARTITION: {
                const { partitionPanels } = config;
                const panelWidth = innerAreaWidth / partitionPanels.count;
                const overlap = 25;
                
                if (partitionPanels.hasTopChannel) {
                  innerContent.push(<ProfilePiece key="track-top" color={profileColor} style={{ top: 0, left: 0, width: innerAreaWidth * scale, height: dims.topTrack * scale }} />);
                  innerContent.push(<ProfilePiece key="track-bottom" color={profileColor} style={{ bottom: 0, left: 0, width: innerAreaWidth * scale, height: dims.bottomTrack * scale }} />);
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
                        handleElements.push(<div key={`handle-part-${i}`} style={{ position: 'absolute', zIndex: 30, left: (panelX + currentPanelWidth * handle.x / 100) * scale, top: (panelAreaY + panelAreaHeight * handle.y / 100) * scale, transform: 'translate(-50%, -50%)' }}><Handle config={handle} scale={scale} color={profileColor} /></div>);
                    }
                    
                    const isFramed = framing === 'full' || type === 'hinged';
                    const frameSize = dims.casementShutter;

                    innerContent.push(
                        <div key={`panel-${i}`} className="absolute" style={{left: panelX*scale, top: panelAreaY*scale, width: currentPanelWidth*scale, height: panelAreaHeight*scale, zIndex}}>
                          {isFramed && <MiteredFrame width={currentPanelWidth} height={panelAreaHeight} profileSize={frameSize} scale={scale} color={profileColor} />}
                          <GlassPanel style={{ left: (isFramed ? frameSize : 0) * scale, top: (isFramed ? frameSize : 0) * scale, width: (currentPanelWidth - (isFramed ? 2 * frameSize : 0)) * scale, height: (panelAreaHeight - (isFramed ? 2 * frameSize : 0)) * scale }} glassWidth={currentPanelWidth - (isFramed ? 2 * frameSize : 0)} glassHeight={panelAreaHeight - (isFramed ? 2 * frameSize : 0)}>
                             <ShutterIndicator type={type} />
                          </GlassPanel>
                        </div>
                    );
                }
                break;
            }
        }
    }

    return { profileElements, glassElements, handleElements, innerContent, innerAreaWidth, innerAreaHeight, holeX1, holeY1, geometry };
};

const RenderedWindow: React.FC<{
    config: WindowConfig;
    elements: ReturnType<typeof createWindowElements>;
    scale: number;
    showLabels?: boolean;
}> = ({ config, elements, scale, showLabels = true }) => {
    const { width, height } = config;
    const numHeight = Number(height) || 0;

    return (
        <div className="relative shadow-lg" style={{ width: (Number(width) || 0) * scale, height: numHeight * scale }}>
          {elements.glassElements}
          {elements.profileElements}
          
          {elements.innerAreaWidth > 0 && elements.innerAreaHeight > 0 && (
            <div className="absolute" style={{ top: elements.holeY1 * scale, left: elements.holeX1 * scale, width: elements.innerAreaWidth * scale, height: elements.innerAreaHeight * scale }}>
                {elements.innerContent}
                {elements.handleElements}
            </div>
          )}
          
          {showLabels && <>
            <DimensionLabel value={Number(width) || 0} className="-top-8 left-1/2 -translate-x-1/2" />
            <DimensionLabel value={numHeight} className="top-1/2 -translate-y-1/2 -left-16 rotate-[-90deg]" />
            
            {elements.geometry.topFix && <DimensionLabel value={elements.geometry.topFix.size} className="top-1/2 -translate-y-1/2 left-1/2 -translate-x-1/2 text-cyan-200" style={{top: elements.geometry.topFix.size * scale / 2}}/>}
            {elements.geometry.leftFix && <DimensionLabel value={elements.geometry.leftFix.size} className="top-1/2 -translate-y-1/2 left-1/2 -translate-x-1/2 text-cyan-200" style={{top: (elements.geometry.holeY1 + ((numHeight - elements.geometry.holeY1 - elements.geometry.holeY2)/2)) * scale, left: elements.geometry.leftFix.size * scale / 2}}/>}
          </>}
        </div>
    );
};

export const WindowCanvas: React.FC<WindowCanvasProps> = React.memo((props) => {
  const { config, onRemoveHorizontalDivider, onRemoveVerticalDivider } = props;
  const { width, height, series, profileColor, windowType } = config;

  const containerRef = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState(1);
  
  const numWidth = windowType === WindowType.CORNER 
    ? (Number(config.leftWidth) || 0) + (Number(config.rightWidth) || 0) + (Number(config.cornerPostWidth) || 0)
    : Number(width) || 0;
  const numHeight = Number(height) || 0;

  const dims = useMemo(() => ({
    outerFrame: Number(series.dimensions.outerFrame) || 0, outerFrameVertical: Number(series.dimensions.outerFrameVertical) || 0, fixedFrame: Number(series.dimensions.fixedFrame) || 0, shutterHandle: Number(series.dimensions.shutterHandle) || 0, shutterInterlock: Number(series.dimensions.shutterInterlock) || 0, shutterTop: Number(series.dimensions.shutterTop) || 0, shutterBottom: Number(series.dimensions.shutterBottom) || 0, shutterMeeting: Number(series.dimensions.shutterMeeting) || 0, casementShutter: Number(series.dimensions.casementShutter) || 0, mullion: Number(series.dimensions.mullion) || 0, louverBlade: Number(series.dimensions.louverBlade) || 0, topTrack: Number(series.dimensions.topTrack) || 0, bottomTrack: Number(series.dimensions.bottomTrack) || 0, glassGridProfile: Number(series.dimensions.glassGridProfile) || 0,
  }), [series.dimensions]);

  useEffect(() => {
    const handleWheel = (e: WheelEvent) => {
        if (e.ctrlKey) {
            e.preventDefault();
            setZoom(prev => Math.max(0.2, Math.min(prev - e.deltaY * 0.001, 5)));
        }
    };
    const currentRef = containerRef.current;
    currentRef?.addEventListener('wheel', handleWheel, { passive: false });
    return () => currentRef?.removeEventListener('wheel', handleWheel);
  }, []);

  const scale = useMemo(() => {
    if (numWidth <= 0 || numHeight <= 0) return 1;
    const containerWidth = containerRef.current?.clientWidth || window.innerWidth;
    const containerHeight = containerRef.current?.clientHeight || window.innerHeight;
    const fitScale = Math.min((containerWidth * 0.9) / numWidth, (containerHeight * 0.9) / numHeight, 10);
    return fitScale * zoom;
  }, [numWidth, numHeight, zoom]);

  const glassStyles = useMemo((): Record<GlassType, React.CSSProperties> => ({
    [GlassType.CLEAR]: { backgroundColor: 'hsl(190, 80%, 85%)', opacity: 0.7 },
    [GlassType.FROSTED]: { backgroundColor: 'hsl(200, 100%, 95%)', opacity: 0.9, backdropFilter: 'blur(2px)' },
    [GlassType.TINTED_BLUE]: { backgroundColor: 'hsl(205, 90%, 60%)', opacity: 0.6 },
    [GlassType.CLEAR_SAPPHIRE]: { backgroundColor: 'hsl(210, 80%, 70%)', opacity: 0.65 },
    [GlassType.BROWN_TINTED]: { backgroundColor: 'hsl(30, 30%, 30%)', opacity: 0.6 },
    [GlassType.BLACK_TINTED]: { backgroundColor: 'hsl(0, 0%, 20%)', opacity: 0.7 },
  }), []);

  if (numWidth <= 0 || numHeight <= 0) {
    return ( <div className="w-full h-full flex items-center justify-center bg-transparent"> <p className="text-slate-500">Please enter valid dimensions to begin.</p> </div> );
  }

  return (
    <div ref={containerRef} className="absolute inset-0 p-6 flex items-center justify-center bg-transparent overflow-auto">
      <div className="absolute bottom-4 left-4 text-white text-3xl font-black opacity-10 pointer-events-none"> WoodenMax </div>
       <div style={{ margin: 'auto' }}>
            {windowType === WindowType.CORNER && config.leftConfig && config.rightConfig ? (
                (() => {
                    const leftW = Number(config.leftWidth) || 0;
                    const rightW = Number(config.rightWidth) || 0;
                    const postW = Number(config.cornerPostWidth) || 0;
                    const totalW = leftW + rightW + postW;

                    const cornerConfigLeft: WindowConfig = { ...config, ...config.leftConfig, width: leftW, windowType: config.leftConfig.windowType, fixedPanels: [] };
                    const cornerConfigRight: WindowConfig = { ...config, ...config.rightConfig, width: rightW, windowType: config.rightConfig.windowType, fixedPanels: [] };
                    
                    const leftElements = createWindowElements(cornerConfigLeft, scale, dims, glassStyles, () => {}, () => {});
                    const rightElements = createWindowElements(cornerConfigRight, scale, dims, glassStyles, () => {}, () => {});

                    return (
                        <div className="relative shadow-lg flex items-start" style={{ width: totalW * scale, height: numHeight * scale }}>
                            <div className="relative flex-shrink-0">
                                <RenderedWindow config={cornerConfigLeft} elements={leftElements} scale={scale} showLabels={false} />
                                <DimensionLabel value={leftW} className="-top-8 left-1/2 -translate-x-1/2" />
                            </div>
                            <div className="relative flex-shrink-0" style={{width: postW * scale, height: numHeight * scale}}>
                                <ProfilePiece color={profileColor} style={{ left: 0, top: 0, width: '100%', height: '100%' }} />
                                <DimensionLabel value={postW} className="-top-8 left-1/2 -translate-x-1/2" />
                            </div>
                            <div className="relative flex-shrink-0">
                                <RenderedWindow config={cornerConfigRight} elements={rightElements} scale={scale} showLabels={false} />
                                <DimensionLabel value={rightW} className="-top-8 left-1/2 -translate-x-1/2" />
                            </div>
                            <DimensionLabel value={numHeight} className="top-1/2 -translate-y-1/2 -left-16 rotate-[-90deg]" />
                        </div>
                    )
                })()
            ) : (
                <RenderedWindow config={config} elements={createWindowElements(config, scale, dims, glassStyles, onRemoveHorizontalDivider, onRemoveVerticalDivider)} scale={scale} />
            )}
        </div>
      
      <div className="absolute bottom-4 right-4 z-10 flex flex-col gap-2 no-print">
         <button onClick={() => setZoom(z => z * 1.2)} className="w-10 h-10 bg-slate-700 hover:bg-indigo-600 rounded-full flex items-center justify-center text-white shadow-lg"><PlusIcon className="w-6 h-6"/></button>
         <button onClick={() => setZoom(1)} className="w-10 h-10 bg-slate-700 hover:bg-indigo-600 rounded-full flex items-center justify-center text-white shadow-lg"><ArrowsPointingInIcon className="w-5 h-5"/></button>
         <button onClick={() => setZoom(z => z / 1.2)} className="w-10 h-10 bg-slate-700 hover:bg-indigo-600 rounded-full flex items-center justify-center text-white shadow-lg"><MinusIcon className="w-6 h-6"/></button>
      </div>
    </div>
  );
});