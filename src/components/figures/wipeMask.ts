import { svg } from '@/utilities/dom';

let sequence = 0;

export interface Wipe {
  /** Set as `clip-path` on the group of paths the wipe reveals. */
  readonly clip: string;
  /** The rectangle to grow, in the board's own user units. */
  readonly rect: SVGRectElement;
  /** How far it has to grow to reveal everything. */
  readonly extent: number;
  /** The attribute that carries the growth. */
  readonly attribute: 'width' | 'height';
}

/**
 * A reveal measured in the board's own user units.
 *
 * `stroke-dasharray` cannot do this job on a board stretched by
 * `preserveAspectRatio="none"`. With `vector-effect: non-scaling-stroke` the
 * dash pattern is laid out in a device space while `getTotalLength` reports
 * view-box units, and the two disagree by a factor that depends on the display.
 * The symptom is a line that draws most of the way and stops, with no error and
 * a `stroke-dashoffset` of zero sitting on it.
 *
 * A clip rectangle in `userSpaceOnUse` carries no such ambiguity: it is written
 * in the same units the path is, so the reveal is exact by construction. The
 * cost is that a board wipes as one gesture instead of line by line, which is
 * the right reading anyway for a set of lines that are formed together.
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

/** The state a wipe starts a build from. */
export const hidden = (wipe: Wipe): gsap.TweenVars => ({ attr: { [wipe.attribute]: 0 } });

/** The state a wipe ends on, and the one `settle` writes directly. */
export const shown = (wipe: Wipe): gsap.TweenVars => ({
  attr: { [wipe.attribute]: wipe.extent },
});
