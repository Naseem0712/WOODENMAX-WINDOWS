import React, { useMemo, useRef, useState, useEffect } from 'react';
import type { QuotationItem, QuotationSettings, WindowConfig, HandleConfig, HardwareItem } from '../types';
import { Button } from './ui/Button';
import { PrinterIcon } from './icons/PrinterIcon';
import { XMarkIcon } from './icons/XMarkIcon';
import { FixedPanelPosition, ShutterConfigType, WindowType, MirrorShape } from '../types';
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

    if (!isTexture) {
        return (
            <div style={{
                position: 'absolute',
                width: width * scale,
                height: height * scale,
                boxSizing: 'border-box',
                borderStyle: 'solid',
                borderColor: color,
                borderTopWidth: ts,
                borderBottomWidth: bs,
                borderLeftWidth: ls,
                borderRightWidth: rs,
            }} />
        );
    }
    
    const backgroundStyle = { backgroundImage: `url(${color})`, backgroundRepeat: 'repeat' };
    const horizontalBgStyle = { backgroundSize: 'auto 100%' };
    const verticalBgStyle = { backgroundSize: '100% auto' };

    const baseDivStyle: React.CSSProperties = {
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
            <div style={{...baseDivStyle, ...horizontalBgStyle, top: 0, left: 0, width: '100%', height: clipTs, clipPath: `polygon(0 0, 100% 0, calc(100% - ${clipRs}px) 100%, ${clipLs}px 100%)` }} />
            {/* Bottom */}
            <div style={{...baseDivStyle, ...horizontalBgStyle, bottom: 0, left: 0, width: '100%', height: clipBs, clipPath: `polygon(${clipLs}px 0, calc(100% - ${clipRs}px) 0, 100% 100%, 0 100%)` }} />
            {/* Left */}
            <div style={{...baseDivStyle, ...verticalBgStyle, top: 0, left: 0, width: clipLs, height: '100%', clipPath: `polygon(0 0, 100% ${clipTs}px, 100% calc(100% - ${clipBs}px), 0 100%)` }} />
            {/* Right */}
            <div style={{...baseDivStyle, ...verticalBgStyle, top: 0, right: 0, width: clipRs, height: '100%', clipPath: `polygon(0 ${clipTs}px, 100% 0, 100% 100%, 0 calc(100% - ${clipBs}px))` }} />
        </div>
    );
};

const PrintableHandle: React.FC<{ config: HandleConfig | null, scale: number }> = ({ config, scale }) => {
    if (!config) return null;
    const handleWidth = 25; // mm
    const handleHeight = config.length || 150; // mm
    const isVertical = config.orientation === 'vertical';
    const style: React.CSSProperties = {
        position: 'absolute',
        backgroundColor: '#333', // Dark grey for print
        width: (isVertical ? handleWidth : handleHeight) * scale,
        height: (isVertical ? handleHeight : handleWidth) * scale,
    };
    return <div style={style} />;
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
                <div style={{ width: postW * scale, height: numHeight * scale, backgroundColor: config.profileColor }} />
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
          