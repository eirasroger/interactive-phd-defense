/**
 * Measured geometry, in the units a transform actually applies in.
 *
 * `getBoundingClientRect` reports viewport pixels, and the stage is scaled to
 * fit the window, so a delta taken from two rects is 1/scale of the translate
 * that would move one onto the other. Dividing by the scale is what makes a
 * measured flight land where it was measured to land.
 */
export const stageScale = (node: Element): number => {
  const painted = node.getBoundingClientRect().width;
  const local = (node as HTMLElement).offsetWidth;
  return local === 0 || painted === 0 ? 1 : painted / local;
};

export interface Offset {
  readonly x: number;
  readonly y: number;
}

/** How far `from` must travel to sit on `to`, in local pixels. */
export const offsetBetween = (from: DOMRect, to: DOMRect, scale: number): Offset => ({
  x: (to.left - from.left) / scale,
  y: (to.top - from.top) / scale,
});
