/** Convert wheel delta to pixels (touchpads use pixels; some mice use lines/pages). */
function normalizeWheelDeltaY(e: WheelEvent): number {
  if (e.deltaMode === WheelEvent.DOM_DELTA_LINE) return e.deltaY * 16;
  if (e.deltaMode === WheelEvent.DOM_DELTA_PAGE) return e.deltaY * 0.9 * window.innerHeight;
  return e.deltaY;
}

/**
 * Apply vertical wheel delta to the nearest ancestor that can scroll on the Y axis.
 * Used so wheel over number inputs / native selects scrolls the panel instead of changing values.
 */
export function scrollNearestVerticalOverflowAncestor(el: HTMLElement, e: WheelEvent): void {
  const deltaY = normalizeWheelDeltaY(e);
  let p: HTMLElement | null = el.parentElement;
  while (p) {
    const { overflowY } = window.getComputedStyle(p);
    if ((overflowY === 'auto' || overflowY === 'scroll') && p.scrollHeight > p.clientHeight + 1) {
      p.scrollTop += deltaY;
      return;
    }
    p = p.parentElement;
  }
}
