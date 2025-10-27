
import React, { useState, useRef, useEffect, useMemo } from 'react';
import type { WindowConfig, HandleConfig, CornerSideConfig } from './types';
import { FixedPanelPosition, ShutterConfigType, WindowType, GlassType } from './types';
import { PlusIcon } from './icons/PlusIcon';
import { MinusIcon } from './icons/MinusIcon';
import { ArrowsPointingInIcon } from './icons/ArrowsPointingInIcon';
import { TrashIcon } from './icons/TrashIcon';
import { PhotoIcon } from './icons/PhotoIcon';
import html2pdf from 'html2pdf.js';
import { v4 as uuidv4 } from 'uuid';

interface WindowCanvasProps {
  config: WindowConfig;
  onRemoveVerticalDivider: (index: number) => void;
  onRemoveHorizontalDivider: (index: number) => void;
  onToggleElevationDoor: (row: number, col: number) => void;
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
    const handleHeight = config.length || 150; // mm
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


const ProfilePiece: React.FC<{style: React.CSSProperties, color: string}> = React.memo(({ style, color }) => {
    const isTexture = color && !color.startsWith('#');
    const isHorizontal = (style.width as number) > (style.height as number);

    const backgroundStyle = isTexture ? {
        backgroundImage: `url(${color})`,
        backgroundSize: isHorizontal ? 'auto 100%' : '100% auto',
        backgroundRepeat: 'repeat',
    } : { backgroundColor: color };
    
    return <div style={{ boxShadow: 'inset 0 0 0 1px rgba(0,0,0,0.3)', position: 'absolute', ...style, ...backgroundStyle }} />;
});

const GlassGrid: React.FC<{
    config: WindowConfig;
    panelId: string;
    width: number;
    height: number;
    scale: number;
}> = React.memo(({ config, panelId, width, height, scale }) => {
    const { glassGrid } = config;
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
        elements.push(<ProfilePiece key={`h-grid-${i}`} color={config.profileColor} style={{ top, left: 0, width: width * scale, height: barThicknessScaled }} />);
    }

    // Vertical bars
    for (let i = 0; i < pattern.vertical.count; i++) {
        const left = (pattern.vertical.offset + i * pattern.vertical.gap) * scale - barThicknessScaled / 2;
        if (left > width * scale || left < -barThicknessScaled) continue;
        elements.push(<ProfilePiece key={`v-grid-${i}`} color={config.profileColor} style={{ left, top: 0, width: barThicknessScaled, height: height * scale }} />);
    }

    return <>{elements}</>;
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

    const isTexture = color && !color.startsWith('#');
    const backgroundStyle = isTexture ? { backgroundImage: `url(${color})`, backgroundRepeat: 'repeat' } : { backgroundColor: color };
    const horizontalBgStyle = { backgroundSize: 'auto 100%' };
    const verticalBgStyle = { backgroundSize: '100% auto' };

    const baseStyle: React.CSSProperties = {
        position: 'absolute',
        boxSizing: 'border-box',
        boxShadow: 'inset 0 0 0 1px rgba(0,0,0,0.3)',
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
    config: WindowConfig;
    panelId: string;
    width: number;
    height: number;
    topProfile: number;
    bottomProfile: number;
    rightProfile: number;
    leftProfile: number;
    scale: number;
    isMesh: boolean;
    isFixed?: boolean;
    isSliding?: boolean;
}> = React.memo(({ config, panelId, width, height, topProfile, rightProfile, bottomProfile, leftProfile, scale, isMesh, isFixed = false, isSliding = false }) => {
    
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
                color={config.profileColor}
             />
            <div className="absolute" style={{ left: leftProfile * scale, top: topProfile * scale }}>
                <GlassPanel
                    config={config}
                    panelId={panelId}
                    style={{ width: glassWidth * scale, height: glassHeight * scale }}
                    glassWidth={glassWidth}
                    glassHeight={glassHeight}
                    scale={scale}
                >
                    {isMesh && <div className="w-full h-full" style={{backgroundColor: '#808080', opacity: 0.5, backgroundImage: `linear-gradient(45deg, #000 25%, transparent 25%), linear-gradient(-45deg, #000 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #000 75%), linear-gradient(-45deg, transparent 75%, #000 75%)`, backgroundSize: '4px 4px' }} />}
                    <ShutterIndicator type={isFixed ? 'fixed' : isSliding ? 'sliding' : null} />
                </GlassPanel>
            </div>
        </div>
    );
});

const GlassPanel: React.FC<{
    config: WindowConfig;
    panelId: string;
    style: React.CSSProperties;
    children?: React.ReactNode;
    glassWidth: number;
    glassHeight: number;
    scale: number;
}> = ({ config, panelId, style, children, glassWidth, glassHeight, scale }) => {
    const { glassType, glassTexture } = config;
    
    const glassStyles: Record<GlassType, React.CSSProperties> = {
        [GlassType.CLEAR]: { backgroundColor: 'hsl(190, 80%, 85%)', opacity: 0.7 },
        [GlassType.FROSTED]: { backgroundColor: 'hsl(200, 100%, 95%)', opacity: 0.9, backdropFilter: 'blur(2px)' },
        [GlassType.TINTED_BLUE]: { backgroundColor: 'hsl(205, 90%, 60%)', opacity: 0.6 },
        [GlassType.TINTED_GREY]: { backgroundColor: 'hsl(210, 10%, 40%)', opacity: 0.6 },
        [GlassType.VERTICAL_FLUTED]: { 
            backgroundColor: 'hsl(190, 80%, 85%)', 
            opacity: 0.8, 
            backgroundImage: 'repeating-linear-gradient(90deg, transparent, transparent 8px, rgba(255,255,255,0.4) 8px, rgba(255,255,255,0.4) 10px, transparent 10px, transparent 18px, rgba(0,0,0,0.05) 18px, rgba(0,0,0,0.05) 20px)'
        },
        [GlassType.CLEAR_SAPPHIRE]: { backgroundColor: 'hsl(210, 80%, 70%)', opacity: 0.65 },
        [GlassType.BROWN_TINTED]: { backgroundColor: 'hsl(30, 30%, 30%)', opacity: 0.6 },
        [GlassType.BLACK_TINTED]: { backgroundColor: 'hsl(0, 0%, 20%)', opacity: 0.7 },
    };

    const panelStyle: React.CSSProperties = { ...glassStyles[glassType], ...style, boxShadow: 'inset 0 0 1px 1px rgba(0,0,0,0.1)' };
    if (glassTexture) {
        panelStyle.backgroundImage = `url(${glassTexture})`;
        panelStyle.backgroundSize = 'cover';
        panelStyle.backgroundPosition = 'center';
        delete panelStyle.backgroundColor;
        delete panelStyle.opacity;
    }

    return ( 
      <div className="absolute" style={panelStyle}>
        <GlassGrid config={config} panelId={panelId} width={glassWidth} height={glassHeight} scale={scale} />
        {children}
      </div> 
    );
};

const createWindowElements = (
    config: WindowConfig, 
    scale: number, 
    dims: any, 
    callbacks: {
      onRemoveHorizontalDivider: (index: number) => void,
      onRemoveVerticalDivider: (index: number) => void,
      onToggleElevationDoor: (row: number, col: number) => void,
    }
) => {
    const { width, height, series, fixedPanels, profileColor, windowType } = config;
    let w = Number(config.width) || 0;
    let numHeight = Number(height) || 0;

    if (windowType === WindowType.ELEVATION_GLAZING && config.elevationGrid) {
        w = config.elevationGrid.colPattern.map(Number).filter(v => v > 0).reduce((s, v) => s + v, 0);
        numHeight = config.elevationGrid.rowPattern.map(Number).filter(v => v > 0).reduce((s, v) => s + v, 0);
    }

    const geometry = (() => {
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
    const innerAreaWidth = holeX2 - holeX1;
    const innerAreaHeight = holeY2 - holeY1;
    
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
        glassElements.push(<GlassPanel key="glass-top" panelId="fixed-top" config={config} style={{ top: frameOffset * scale, left: hDividerX * scale, width: glassW * scale, height: glassH * scale }} glassWidth={glassW} glassHeight={glassH} scale={scale} />);
    }
    if (bottomFix) {
        profileElements.push(<ProfilePiece key="divider-bottom" color={profileColor} style={{ top: holeY2 * scale, left: hDividerX * scale, width: hDividerWidth * scale, height: dims.fixedFrame * scale }} />);
        const glassW = hDividerWidth;
        const glassH = numHeight - holeY2 - frameOffset - dims.fixedFrame;
        glassElements.push(<GlassPanel key="glass-bottom" panelId="fixed-bottom" config={config} style={{ top: (holeY2 + dims.fixedFrame) * scale, left: hDividerX * scale, width: glassW * scale, height: glassH * scale }} glassWidth={glassW} glassHeight={glassH} scale={scale}/>);
    }
    const vGlassY = topFix ? holeY1 : frameOffset;
    const vGlassHeight = (bottomFix ? holeY2 : numHeight - frameOffset) - vGlassY;
    if (leftFix) {
        const glassW = holeX1 - frameOffset - dims.fixedFrame;
        const glassH = vGlassHeight;
        glassElements.push(<GlassPanel key="glass-left" panelId="fixed-left" config={config} style={{ top: vGlassY * scale, left: frameOffset * scale, width: glassW * scale, height: glassH * scale }} glassWidth={glassW} glassHeight={glassH} scale={scale}/>);
    }
    if (rightFix) {
        const glassW = w - holeX2 - frameOffset - dims.fixedFrame;
        const glassH = vGlassHeight;
        glassElements.push(<GlassPanel key="glass-right" panelId="fixed-right" config={config} style={{ top: vGlassY * scale, left: (holeX2 + dims.fixedFrame) * scale, width: glassW * scale, height: glassH * scale }} glassWidth={glassW} glassHeight={glassH} scale={scale}/>);
    }

    const innerContent: React.ReactNode[] = [];
    if (innerAreaWidth > 0 && innerAreaHeight > 0) {
       switch (windowType) {
            case WindowType.ELEVATION_GLAZING: {
                if (config.elevationGrid) {
                    const { rowPattern, colPattern, verticalMullionSize, horizontalTransomSize, pressurePlateSize, doorPositions } = config.elevationGrid;
                    const vMullion = Number(verticalMullionSize) || 0;
                    const hTransom = Number(horizontalTransomSize) || 0;
                    const pressurePlate = Number(pressurePlateSize) || 0;

                    const validColPattern = colPattern.map(Number).filter(v => v > 0);
                    const validRowPattern = rowPattern.map(Number).filter(v => v > 0);
                    
                    const totalGridWidth = validColPattern.reduce((a, b) => a + b, 0);
                    const totalGridHeight = validRowPattern.reduce((a, b) => a + b, 0);

                    const profilesAndPlates: React.ReactNode[] = [];

                    // 1. Render glass panels first, only for non-door cells
                    let currentY_cell = 0;
                    for (let r = 0; r < validRowPattern.length; r++) {
                        let currentX_cell = 0;
                        for (let c = 0; c < validColPattern.length; c++) {
                            const isDoor = doorPositions.some(p => p.row === r &&