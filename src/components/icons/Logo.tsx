import React from 'react';

/** Full WoodenMax logo from `public/logo.jpg` (horizontal lockup). */
export const Logo: React.FC<React.ImgHTMLAttributes<HTMLImageElement>> = (props) => (
  <img src="/logo.jpg" alt="WoodenMax" className="object-contain" {...props} />
);
