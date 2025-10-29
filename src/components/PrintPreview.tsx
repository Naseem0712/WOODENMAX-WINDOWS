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
        backgroundSize: isHorizontal ? 'auto 100