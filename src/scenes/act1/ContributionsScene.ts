import gsap from 'gsap';
import { DURATION, EASE, STAGGER, seconds } from '@/animations/timing';
import {
  createContributionMap,
  PAPERS,
  PLAN,
  type ContributionMap,
} from '@/components/figures/ContributionMap';
import { CONTRIBUTIONS } from '@/content/contributions';
import type { SceneContext, SceneInstance } from '@/engine/scene/types';
import { el } from '@/utilities/dom';

/**
 * Scene 11 — the four objectives answered, and the shape the answers make.
 *
 * Two beats. The five papers as published, then the pipeline they are.
 *
 * **They are shown together, not one at a time.** A defence by compendium is
 * five papers that add up to one argument, and revealing them serially makes
 * five announcements out of a single claim. Together they can be counted at a
 * glance, and the frame that follows is the same five objects rearranged — which
 * is the whole point, and is invisible if the audience never saw them as a set.
 *
 * **The plan beat must not be merged into the first.** The papers and the shape
 * they make are two thoughts, and the second is the one the next scene walks
 * into — the same reason `world_design.md` §4 keeps the Overlook's rise and
 * unfold on separate triggers.
 */
const BEATS = 2;

const stateOf = (beat: number): number => (beat >= 1 ? PLAN : PAPERS);

export class ContributionsScene implements SceneInstance {
  readonly beats = BEATS;

  private map: ContributionMap | null = null;
  private coda: HTMLElement | null = null;
  /**
   * The head block only.
   *
   * **The cards are deliberately not in here.** Their `y` is their position in
   * the field, not an entrance offset, so a settle that writes `y: 0` across
   * everything the entry touched would drop all five onto the field's ceiling —
   * and in the plan state, on top of each other. They settle on their own
   * properties, below.
   */
  private head: HTMLElement[] = [];

  private motion: gsap.core.Timeline | null = null;

  enter(context: SceneContext): void {
    context.root.dataset['align'] = 'wide';

    const eyebrow = el('p', { className: 'contributions-eyebrow', text: CONTRIBUTIONS.eyebrow });
    const headline = el('span', { text: CONTRIBUTIONS.heading });
    const coda = el('span', { className: 'contributions-coda', text: CONTRIBUTIONS.coda });
    this.coda = coda;

    const heading = el('h2', {
      className: 'contributions-headline',
      children: [headline, coda],
    });
    const headBlock = el('div', { className: 'contributions-head', children: [eyebrow, heading] });

    const map = createContributionMap(CONTRIBUTIONS.map);
    this.map = map;
    this.head = [eyebrow, heading];

    context.root.appendChild(
      el('div', { className: 'contributions-composition', children: [headBlock, map.element] }),
    );

    // No line measuring here, unlike the compositions either side of it: the
    // page carries every long string on this scene, so nothing in the DOM needs
    // splitting into rendered lines and nothing rewraps when the webfont lands.
    map.show(PAPERS, true);
    gsap.set(coda, { opacity: 0 });

    // Opacity and scale only. Anything positional would fight the layout the
    // figure just wrote.
    const entry = gsap.timeline({ delay: context.entryDelay + 0.15 });
    entry
      .from([eyebrow, heading], {
        y: 26,
        opacity: 0,
        duration: seconds(DURATION.slow),
        ease: EASE.enter,
        stagger: seconds(STAGGER),
      })
      .from(
        map.frames,
        {
          opacity: 0,
          scale: 0.965,
          duration: seconds(DURATION.slow),
          ease: EASE.enter,
          stagger: seconds(0.06),
        },
        0.2,
      );
    this.motion = entry;
  }

  beat(index: number, settle: boolean): void {
    const map = this.map;
    if (!map) return;

    // The deck calls this for beat 0 immediately after `enter`, which kills the
    // entry timeline while its `from` tweens are still at their start values —
    // an invisible composition. Settling is what puts them back, and each group
    // is settled on the properties its own entrance used.
    this.motion?.kill();
    gsap.set(this.head, { opacity: 1, y: 0 });
    gsap.set(map.frames, { opacity: 1, scale: 1 });

    const timeline = gsap.timeline().add(map.show(stateOf(index), settle), 0);

    // The heading's second half arrives with the plan it describes, and leaves
    // again on the way back — the sentence has to match the frame in both
    // directions.
    if (this.coda) {
      const shown = stateOf(index) === PLAN;
      if (settle) gsap.set(this.coda, { opacity: shown ? 1 : 0 });
      else {
        timeline.to(
          this.coda,
          {
            opacity: shown ? 1 : 0,
            duration: seconds(shown ? DURATION.slow : DURATION.normal),
            ease: EASE.enter,
            overwrite: 'auto',
          },
          shown ? 0.55 : 0,
        );
      }
    }

    this.motion = timeline;
  }
}
