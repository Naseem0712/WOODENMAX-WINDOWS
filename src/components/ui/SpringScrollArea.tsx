import React, { forwardRef, useCallback, useRef } from 'react';
import { useRubberBandScroll } from '../../hooks/useRubberBandScroll';

type SpringScrollAreaProps = React.HTMLAttributes<HTMLDivElement>;

function assignRef<T>(ref: React.Ref<T> | undefined, value: T | null) {
  if (typeof ref === 'function') ref(value);
  else if (ref && 'current' in ref) (ref as React.MutableRefObject<T | null>).current = value;
}

/**
 * Scrollable region with touch rubber-band + spring snap-back (see useRubberBandScroll).
 * Ref attaches to the scrollport element (use for fit-to-viewport / ResizeObserver).
 */
export const SpringScrollArea = forwardRef<HTMLDivElement, React.PropsWithChildren<SpringScrollAreaProps>>(
  function SpringScrollArea({ className = '', children, ...rest }, forwardedRef) {
    const rubberRef = useRef<HTMLDivElement | null>(null);
    useRubberBandScroll(rubberRef);
    const setRef = useCallback(
      (el: HTMLDivElement | null) => {
        rubberRef.current = el;
        assignRef(forwardedRef, el);
      },
      [forwardedRef]
    );
    return (
      <div ref={setRef} className={`spring-scroll-region ${className}`.trim()} {...rest}>
        {children}
      </div>
    );
  }
);
