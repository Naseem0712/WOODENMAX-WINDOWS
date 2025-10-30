import React, { RefObject, useEffect, useRef } from 'react';

export function useRubberBandScroll(targetRef: RefObject<HTMLElement>) {
    const startY = useRef(0);
    const isOverscrolling = useRef(false);

    useEffect(() => {
        const element = targetRef.current;
        if (!element) return;

        // Base protection for modern browsers that prevents scroll chaining
        element.style.overscrollBehavior = 'contain';

        const handleTouchStart = (e: TouchEvent) => {
            if (e.touches.length === 1) {
                startY.current = e.touches[0].clientY;
                // Remove any existing transition to allow for direct manipulation via transform
                element.style.transition = 'transform 0s';
            }
        };

        const handleTouchMove = (e: TouchEvent) => {
            if (e.touches.length !== 1) return;

            const currentY = e.touches[0].clientY;
            const deltaY = currentY - startY.current;

            const isAtTop = element.scrollTop === 0;
            // Use a small buffer to account for fractional pixel values
            const isAtBottom = element.scrollHeight - element.scrollTop - element.clientHeight < 1;
            
            // If at the top and pulling down, OR at the bottom and pulling up
            if ((isAtTop && deltaY > 0) || (isAtBottom && deltaY < 0)) {
                // Prevent native scroll (and thus scroll chaining)
                e.preventDefault();
                isOverscrolling.current = true;
                
                // Apply resistance. The exponent makes the pull feel less linear and more natural.
                const resistedDelta = Math.sign(deltaY) * Math.pow(Math.abs(deltaY), 0.8);
                element.style.transform = `translateY(${resistedDelta}px)`;
            } else {
                // If we were overscrolling, stop immediately to allow normal scrolling.
                // This causes a snap but is the simplest way to hand control back to the native scroll.
                isOverscrolling.current = false;
                element.style.transform = 'translateY(0px)';
            }
        };

        const handleTouchEnd = () => {
            if (isOverscrolling.current) {
                // If we were overscrolling, bounce back smoothly
                element.style.transition = 'transform 0.3s ease-out';
                element.style.transform = 'translateY(0px)';
                isOverscrolling.current = false;
            }
        };

        // We need passive: false on touchmove to be able to call preventDefault
        element.addEventListener('touchstart', handleTouchStart, { passive: true });
        element.addEventListener('touchmove', handleTouchMove, { passive: false });
        element.addEventListener('touchend', handleTouchEnd);
        element.addEventListener('touchcancel', handleTouchEnd);

        return () => {
            element.removeEventListener('touchstart', handleTouchStart);
            element.removeEventListener('touchmove', handleTouchMove);
            element.removeEventListener('touchend', handleTouchEnd);
            element.removeEventListener('touchcancel', handleTouchEnd);
        };
    }, [targetRef]);
}
