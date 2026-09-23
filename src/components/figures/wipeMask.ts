import { svg } from '@/utilities/dom';

let sequence = 0;

export interface Wipe {
  /** Set as `clip-path` on the group of paths the wipe reveals. */
  readonly clip: string;
  /** The rectangle to grow, in the board's own user units. */
  readonly rect: SVGRectElement;
  /** Final size that reveals everything. */
  readonly extent: number;
  /** The attribute that grows. */
  readonly attribute: 'width' | 'height';
}

/**
 * A line reveal done with a growing clip rectangle in the board's user units.
 * On boards with `preserveAspectRatio="none"` and `non-scaling-stroke`, dash
 * offsets use device units while `getTotalLength` uses view-box units, so dash
 * reveals stop short. The whole board wipes as one.
 */
export function createWipe(
  board: SVGSVGElement,
  width: number,
  height: number,
  axis: 'x' | 'y',
): Wipe {
  sequence += 1;
  const id = `wipe-${sequence}`;

  const rect = svg('rect', {
    x: '0',
    y: '0',
    width: axis === 'x' ? '0' : String(width),
    height: axis === 'y' ? '0' : String(height),
  });

  const clip = svg('clipPath', { id, clipPathUnits: 'userSpaceOnUse' });
  clip.appendChild(rect);
  const defs = svg('defs');
  defs.appendChild(clip);
  board.appendChild(defs);

  return {
    rect,
    clip: `url(#${id})`,
    extent: axis === 'x' ? width : height,
    attribute: axis === 'x' ? 'width' : 'height',
  };
}

/** Start state of a wipe. */
export const hidden = (wipe: Wipe): gsap.TweenVars => ({ attr: { [wipe.attribute]: 0 } });

/** End state of a wipe. Also set directly on `settle`. */
export const shown = (wipe: Wipe): gsap.TweenVars => ({
  attr: { [wipe.attribute]: wipe.extent },
});
