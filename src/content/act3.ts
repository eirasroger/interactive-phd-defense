import type { CaptionContent } from '@/components/Caption';

/**
 * Act III copy.
 *
 * The heading is `narrative.md`'s claim column verbatim, as everywhere else.
 * The station labels are the roles the papers were introduced under in Act I
 * and walked through in Act II — the plan view names them again because from
 * sixty metres up a room is a rectangle, and the whole beat is recognition.
 */
export const act3Captions = {
  whole: {
    eyebrow: 'Act III · The Overlook',
    heading:
      'Extraction quality, compliance outcomes and inferred attributes propagate coherently to the recommendation.',
  },
} satisfies Record<string, CaptionContent>;

export const STATION_ROLES: Record<string, string> = {
  C1: 'Decision framework',
  C2: 'Empirical characterisation',
  C3: 'Screening agent',
  C4: 'Inference',
  C5: 'Context-adaptive recommender',
};
