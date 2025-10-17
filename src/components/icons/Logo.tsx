import React from 'react';

export const Logo: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <svg width="40" height="40" viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
    <rect width="40" height="40" rx="8" fill="#4338CA"/>
    <path d="M8 12L14 28L20 16L26 28L32 12" stroke="#D6A158" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);