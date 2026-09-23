/**
 * Stage scale factor (painted width / layout width). Divide
 * `getBoundingClientRect` deltas by it to get local transform pixels.
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
