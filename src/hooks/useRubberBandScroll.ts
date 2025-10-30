// FIX: Import React to provide the React namespace for types like React.CSSProperties.
import React, { useState, useRef, useEffect, RefObject } from 'react';

// The resistance factor determines how much the panel moves in relation to the finger drag.
// A higher number means more resistance (less movement).
const RESISTANCE_FACTOR = 2.5;

export const useRubberBandScroll = (
  panelRef: RefObject<HTMLElement>,
  isActive: boolean
) => {
  const [style, setStyle] = useState<React.CSSProperties>({});
  
  const touchStartY = useRef(0);
  const isDragging = useRef(false);
  const scrollableElRef = useRef<HTMLElement | null>(null);
  
  useEffect(() => {
    const panel = panelRef.current;
    if (!panel || !isActive) {
      // Reset style if panel becomes inactive
      setStyle({});
      return;
    }

    const handleTouchStart = (e: TouchEvent) => {
      // Find the scrollable container within the panel
      const target = e.target as HTMLElement;
      const scrollable = target.closest('.custom-scrollbar') as HTMLElement;
      
      if (scrollable) {
        scrollableElRef.current = scrollable;
        touchStartY.current = e.touches[0].clientY;
        isDragging.current = true;
        // Remove transition during drag for instant feedback
        panel.style.transition = 'none';
      } else {
        scrollableElRef.current = null;
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (!isDragging.current || !scrollableElRef.current) return;
      
      const scrollableEl = scrollableElRef.current;
      const currentY = e.touches[0].clientY;
      const deltaY = currentY - touchStartY.current;

      const isAtTop = scrollableEl.scrollTop === 0;
      const isAtBottom = scrollableEl.scrollHeight - scrollableEl.scrollTop <= scrollableEl.clientHeight + 1;

      // Check for over-scrolling at the top (pulling down)
      if (isAtTop && deltaY > 0) {
        e.preventDefault();
        const pullDistance = Math.pow(deltaY, 0.85); // Apply a non-linear resistance for a better feel
        setStyle({ transform: `translateY(${pullDistance}px)` });
      }
      // Check for over-scrolling at the bottom (pulling up)
      else if (isAtBottom && deltaY < 0) {
        e.preventDefault();
        const pullDistance = -Math.pow(Math.abs(deltaY), 0.85);
        setStyle({ transform: `translateY(${pullDistance}px)` });
      } else {
        // If we are not at a boundary, don't interfere with normal scrolling.
        // But if a drag was initiated, we need to reset the start position
        // to prevent a sudden jump if the user then scrolls to a boundary.
        touchStartY.current = currentY;
      }
    };

    const handleTouchEnd = () => {
      if (!isDragging.current) return;
      isDragging.current = false;

      // Re-enable transition for the snap-back animation
      panel.style.transition = 'transform 300ms ease-out';
      setStyle({ transform: 'translateY(0px)' });
    };

    panel.addEventListener('touchstart', handleTouchStart, { passive: true });
    // `passive: false` for touchmove is necessary to allow `e.preventDefault()`
    window.addEventListener('touchmove', handleTouchMove, { passive: false });
    window.addEventListener('touchend', handleTouchEnd);
    window.addEventListener('touchcancel', handleTouchEnd);

    return () => {
      panel.removeEventListener('touchstart', handleTouchStart);
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', handleTouchEnd);
      window.removeEventListener('touchcancel', handleTouchEnd);
      // Clean up inline style to avoid conflicts
      if (panel) {
          panel.style.transition = '';
      }
    };

  }, [panelRef, isActive]);

  return style;
};
