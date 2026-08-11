import paper1 from '@/assets/presentation/papers/paper1.png';
import paper2 from '@/assets/presentation/papers/paper2.png';
import paper3 from '@/assets/presentation/papers/paper3.png';
import paper4 from '@/assets/presentation/papers/paper4.png';
import paper5 from '@/assets/presentation/papers/paper5.png';
import type { ContributionMapSpec } from '@/components/figures/ContributionMap';

/**
 * Scene 11 — the four objectives answered, and the shape the answers make.
 *
 * **One paper at a time, at a size where it is actually a paper.** Five headers
 * laid out in a row is five grey smudges: at a fifth of the frame the masthead
 * is unreadable and the title is texture, so the images end up decorating a
 * layout that would have been better without them. Featured one per beat, the
 * sheet is 944 units wide, the journal is legible from the back of the hall and
 * the title is read off the page itself — which is why nothing here repeats it
 * in type.
 *
 * **The sheet carries title and authorship; the column carries meaning.** No
 * element appears in both. The column is what the audience cannot get from
 * looking at the page: which station this is, and which objective it answers.
 *
 * **`role` is the station name from `narrative.md`, not a paraphrase.** It is
 * what survives into the plan, and it is the label the audience meets again on
 * the corridor wall in Act II. The two must not drift.
 *
 * **This is the last scene of Act I.** What follows it is the doors opening, so
 * the frame it leaves on is the pipeline itself — which is the thing the camera
 * is about to walk into.
 */

export const CONTRIBUTIONS = {
  eyebrow: 'Contributions',
  heading: 'How the objectives are answered.',
  /** Held back until the plan forms, so the heading earns a second half. */
  coda: 'And how they connect.',

  map: {
    items: [
      {
        key: 'C1',
        role: 'Decision framework',
        sheet: paper1,
        journal: 'Environmental Impact Assessment Review',
        locator: '121 (2026) 108561',
        answers: 'O1',
        plan: { column: 0, lane: 'axis' },
      },
      {
        key: 'C2',
        role: 'Empirical characterisation',
        sheet: paper2,
        journal: 'Environmental Impact Assessment Review',
        locator: '117 (2026) 108243',
        answers: 'O2',
        plan: { column: 1, lane: 'axis' },
      },
      {
        key: 'C3',
        role: 'Screening agent',
        sheet: paper3,
        journal: 'Automation in Construction',
        locator: '185 (2026) 106876',
        answers: 'O3',
        plan: { column: 2, lane: 'high' },
      },
      {
        key: 'C4',
        role: 'Inference',
        sheet: paper4,
        journal: 'Resources, Conservation & Recycling',
        locator: '224 (2026) 108573',
        answers: 'O4',
        plan: { column: 2, lane: 'low' },
      },
      {
        key: 'C5',
        role: 'Context-adaptive recommender',
        sheet: paper5,
        journal: 'Sustainable Production and Consumption',
        locator: '67 (2026) 119–144',
        // The second asymmetry, and it is left to be noticed rather than
        // announced: O4 is the only line that appears twice, on two consecutive
        // beats. `narrative.md` flags it; a slide that counts it out loud one
        // scene after counting six into four is arithmetic twice running.
        answers: 'O4',
        plan: { column: 3, lane: 'axis' },
      },
    ],

    /*
     * One kind of edge, drawn one way.
     *
     * `decisions.md` §20 distinguishes C2 → C5 as design-time foundation from
     * the inference-time flow of the other two into C5, and in the corridor that
     * distinction is load-bearing — it is why the corpus is the floor rather
     * than a third channel. **On this slide it is not.** Drawn as ground running
     * under the diagram it stopped reading as an edge at all, and a viewer
     * seeing the pipeline for the first time has no way to know that the shape
     * underneath is a relation. The distinction belongs where it can be
     * explained, which is Act II standing on it.
     *
     * Here C2 → C5 runs straight down the axis between the C3 and C4 lanes:
     * same weight, same arrowhead, no special pleading.
     */
    edges: [
      { from: 'C1', to: 'C2' },
      { from: 'C2', to: 'C3' },
      { from: 'C2', to: 'C4' },
      { from: 'C2', to: 'C5' },
      { from: 'C3', to: 'C5' },
      { from: 'C4', to: 'C5' },
    ],
  } satisfies ContributionMapSpec,
} as const;
