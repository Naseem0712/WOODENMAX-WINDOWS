import { RefObject, useEffect, useRef } from 'react';

/** Ease-out-back style curve — slight overshoot then settle (springy snap). */
const SPRING_TRANSITION = 'transform 0.55s cubic-bezier(0.175, 0.885, 0.32, 1.12)';

export function useRubberBandScroll(targetRef: RefObject<HTMLElement | null>) {
    const startY = useRef(0);
    const isOverscrolling = useRef(false);

    useEffect(() => {
        const element = targetRef.current;
        if (!element) return;

        element.style.overscrollBehavior = 'contain';

        const clearTransitionAfterSnap = (ev: TransitionEvent) => {
            if (ev.propertyName !== 'transform') return;
            element.style.transition = '';
            element.removeEventListener('transitionend', clearTransitionAfterSnap);
        };

        const handleTouchStart = (e: TouchEvent) => {
            if (e.touches.length === 1) {
                startY.current = e.touches[0].clientY;
                element.style.transition = 'transform 0s';
            }
        };

        const handleTouchMove = (e: TouchEvent) => {
            if (e.touches.length !== 1) return;

            const currentY = e.touches[0].clientY;
            const deltaY = currentY - startY.current;

            const isAtTop = element.scrollTop <= 0;
            const isAtBottom = element.scrollHeight - element.scrollTop - element.clientHeight <= 1;

            if ((isAtTop && deltaY > 0) || (isAtBottom && deltaY < 0)) {
                e.preventDefault();
                isOverscrolling.current = true;

                const resistedDelta = Math.sign(deltaY) * Math.pow(Math.abs(deltaY), 0.72);
                element.style.transform = `translateY(${resistedDelta}px)`;
            } else {
                isOverscrolling.current = false;
                element.style.transform = 'translateY(0px)';
            }
        };

        const handleTouchEnd = () => {
            if (!isOverscrolling.current) return;
            element.style.transition = SPRING_TRANSITION;
            element.style.transform = 'translateY(0px)';
            element.addEventListener('transitionend', clearTransitionAfterSnap);
            isOverscrolling.current = false;
        };

        element.addEventListener('touchstart', handleTouchStart, { passive: true });
        element.addEventListener('touchmove', handleTouchMove, { passive: false });
        element.addEventListener('touchend', handleTouchEnd);
        element.addEventListener('touchcancel', handleTouchEnd);

        return () => {
            element.removeEventListener('transitionend', clearTransitionAfterSnap);
            element.removeEventListener('touchstart', handleTouchStart);
            element.removeEventListener('touchmove', handleTouchMove);
            element.removeEventListener('touchend', handleTouchEnd);
            element.removeEventListener('touchcancel', handleTouchEnd);
        };
    }, [targetRef]);
}
