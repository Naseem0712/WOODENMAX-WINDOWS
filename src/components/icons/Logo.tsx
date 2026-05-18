import React from 'react';

/** Full WoodenMax logo from `public/logo.jpg` (horizontal lockup). */
export const Logo: React.FC<React.ImgHTMLAttributes<HTMLImageElement>> = ({
  className = '',
  width = 200,
  height = 48,
  alt = 'WoodenMax',
  decoding = 'async',
  ...rest
}) => (
  <img
    {...rest}
    src="/logo.jpg"
    alt={alt}
    width={width}
    height={height}
    decoding={decoding}
    className={`object-contain ${className}`.trim()}
  />
);
