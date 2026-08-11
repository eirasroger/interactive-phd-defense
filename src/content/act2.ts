import type { CaptionContent } from '@/components/Caption';

/**
 * Act II — The Corridor.
 *
 * One caption, because there is one scene: the place the Act I → Act II
 * transition lands. The zone it lands in is a placeholder and says so
 * (`world/corridor/CorridorZone.ts`) — `PLAN.md` gates every corridor layout on
 * the pipeline plan drawing, because the plan *is* the corridor.
 *
 * The words are deliberately the fewest that will do. `narrative.md` has scene
 * 12 `c1-problem` opening the act at 0:30, and writing it now would be writing
 * copy against a composition that does not exist. What is here is a chapter
 * marker, which is the one thing about this beat that will survive the plan.
 */
export const act2Captions = {
  /** 12 · Connective — inside, and the first thing the corridor is for. */
  threshold: {
    eyebrow: 'Act II · The pipeline',
    heading: 'Five contributions, walked end to end.',
    body: [
      'Placeholder. The corridor is laid out from the pipeline plan drawing, which does not exist yet — see docs/PLAN.md.',
    ],
  } satisfies CaptionContent,
};
