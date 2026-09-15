import { CONTRIBUTIONS } from '@/content/contributions';

/**
 * Scene 2 — the contents.
 *
 * Six sections, numbered, in order. Nothing is explained here: a contents page
 * that annotates itself is being read out instead of referred to.
 *
 * The five stations are the contribution map's own, so the roles on this slide
 * and the roles on the corridor wall are one string.
 *
 * `from` is the scene each section opens on. `scenes/index.ts` asserts every one
 * of them exists and that they run in the deck's own order, so reordering the
 * talk fails the build rather than leaving the contents quietly wrong.
 */

export interface ContentsPart {
  readonly from: string;
  readonly title: string;
  /** Whether the five contributions are listed under it. */
  readonly expands?: boolean;
}

export const CONTENTS = {
  heading: 'Contents',

  parts: [
    { from: 'lake', title: 'Motivation and research context' },
    { from: 'river', title: 'State of the art' },
    { from: 'gaps', title: 'Research gaps and objectives' },
    { from: 'contributions', title: 'Contributions', expands: true },
    { from: 'whole', title: 'Discussion' },
    { from: 'conclusions', title: 'Conclusions' },
  ] satisfies readonly ContentsPart[],

  stations: CONTRIBUTIONS.map.items.map(({ key, role }) => ({ key, role })),
} as const;
