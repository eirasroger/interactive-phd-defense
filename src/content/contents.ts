import { CONTRIBUTIONS } from '@/content/contributions';

/**
 * Scene 2: the contents slide. Station roles come from the contribution map.
 * `from` is the scene each section opens on. `scenes/index.ts` checks that each
 * one exists and that they are in deck order, and fails the build otherwise.
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
