import { CATEGORIES, CORPUS } from '@/content/c2';
import { el } from '@/utilities/dom';

/**
 * The corpus drawn on a canvas, one cell per product (about 8,000 cells).
 * Cells fill category by category, largest first. Each category starts on a
 * new row, with a blank row between categories so boundaries are visible.
 */

export const COLS = 145;
const STEP = 5.5;
const CELL = 4.2;

/** Blank rows between one category's block and the next. */
const GUTTER = 1;

interface Band {
  /** First product index in this category. */
  readonly start: number;
  readonly rows: number;
  /** First row slot the band occupies. */
  readonly slot: number;
}

export const BANDS: readonly Band[] = (() => {
  const bands: Band[] = [];
  let start = 0;
  let slot = 0;
  for (const category of CATEGORIES) {
    const rows = Math.ceil(category.count / COLS);
    bands.push({ start, rows, slot });
    start += category.count;
    slot += rows + GUTTER;
  }
  return bands;
})();

const SLOTS = BANDS.reduce((total, band) => Math.max(total, band.slot + band.rows), 0);

export const FIELD_WIDTH = COLS * STEP;
export const FIELD_HEIGHT = SLOTS * STEP;

/** Where each category's block ends, in cell index. */
const BOUNDARIES: readonly number[] = BANDS.map(
  (band, rank) => band.start + (CATEGORIES[rank]?.count ?? 0),
);

/**
 * Single-hue ramp, dark to light by rank. Eased so the first three ranks
 * separate clearly. Lightness stops at 68% so the lightest band stays visible
 * on a projector.
 */
const tint = (rank: number): string => {
  const span = CATEGORIES.length - 1;
  return `hsl(206 46% ${29 + (rank / span) ** 0.62 * 39}%)`;
};

/**
 * Colour of verified cells. Amber stands out from every step of the blue ramp,
 * including under colour-vision-deficiency simulation, and matches the verified
 * readout.
 */
export const VERIFIED = '#c07a12';

/** Cell positions, precomputed once. */
const POS_X = new Uint16Array(CORPUS.products);
const POS_Y = new Uint16Array(CORPUS.products);

for (const [rank, band] of BANDS.entries()) {
  const count = CATEGORIES[rank]?.count ?? 0;
  for (let local = 0; local < count; local += 1) {
    POS_X[band.start + local] = (local % COLS) * STEP;
    POS_Y[band.start + local] = (band.slot + Math.floor(local / COLS)) * STEP;
  }
}

/**
 * Deterministic sample of verified cells, drawn once. Uses `splitmix32` so the
 * sample spreads evenly across the field.
 */
const sample = (): readonly number[] => {
  const taken = new Set<number>();
  let seed = 20250623;

  while (taken.size < CORPUS.verified) {
    seed = (seed + 0x9e3779b9) | 0;
    let mixed = seed;
    mixed = Math.imul(mixed ^ (mixed >>> 16), 0x21f0aaad);
    mixed = Math.imul(mixed ^ (mixed >>> 15), 0x735a2d97);
    mixed = (mixed ^ (mixed >>> 15)) >>> 0;
    taken.add(mixed % CORPUS.products);
  }

  return [...taken].sort((a, b) => a - b);
};

const VERIFIED_CELLS = sample();

export interface CorpusField {
  readonly element: HTMLCanvasElement;
  /** `filled` and `checked` are both 0 to 1. */
  paint(filled: number, checked: number): void;
}

export function createCorpusField(): CorpusField {
  const element = el('canvas', {
    className: 'cp-canvas',
    attrs: { width: '0', height: '0', 'aria-hidden': 'true' },
  });

  let ratio = 0;
  let painted = -1;
  let verified = -1;

  const size = (): CanvasRenderingContext2D | null => {
    const wanted = Math.min(2, window.devicePixelRatio || 1);
    const context = element.getContext('2d');
    if (!context) return null;
    if (wanted !== ratio) {
      ratio = wanted;
      element.width = Math.round(FIELD_WIDTH * ratio);
      element.height = Math.round(FIELD_HEIGHT * ratio);
      painted = -1;
    }
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    return context;
  };

  return {
    element,

    paint(filled, checked) {
      if (filled === painted && checked === verified) return;
      const context = size();
      if (!context) return;
      painted = filled;
      verified = checked;

      context.clearRect(0, 0, FIELD_WIDTH, FIELD_HEIGHT);

      const shown = Math.round(Math.min(1, Math.max(0, filled)) * CORPUS.products);
      let rank = 0;
      let inked = -1;

      for (let index = 0; index < shown; index += 1) {
        while (index >= (BOUNDARIES[rank] ?? CORPUS.products)) rank += 1;
        if (rank !== inked) {
          context.fillStyle = tint(rank);
          inked = rank;
        }
        context.fillRect(POS_X[index] as number, POS_Y[index] as number, CELL, CELL);
      }

      const marked = Math.round(Math.min(1, Math.max(0, checked)) * VERIFIED_CELLS.length);
      context.fillStyle = VERIFIED;
      for (let index = 0; index < marked; index += 1) {
        const cell = VERIFIED_CELLS[index] as number;
        if (cell >= shown) continue;
        context.fillRect(
          (POS_X[cell] as number) - 0.4,
          (POS_Y[cell] as number) - 0.4,
          CELL + 0.8,
          CELL + 0.8,
        );
      }
    },
  };
}

/** Legend swatch colour. Shares `tint` with the field. */
export const categoryTint = (rank: number): string => tint(rank);

/** Fill fraction (0 to 1) at the end of this category's band. */
export const completionAt = (rank: number): number =>
  (BOUNDARIES[rank] ?? CORPUS.products) / CORPUS.products;
