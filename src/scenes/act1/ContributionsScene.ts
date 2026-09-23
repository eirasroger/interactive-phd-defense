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
 * Scene 11: the five papers, then the same five rearranged as a pipeline.
 * The papers appear together as one set. The plan is a separate beat because
 * the next scene continues from it (see `world_design.md` §4).
 */
const BEATS = 2;

const stateOf = (beat: number): number => (beat >= 1 ? PLAN : PAPERS);

export class ContributionsScene implements SceneInstance {
  readonly beats = BEATS;

  private map: ContributionMap | null = null;
  private coda: HTMLElement | null = null;
  /**
   * Head block only. The cards use `y` for layout, so settling them with
   * `y: 0` would stack them. They settle separately in `beat`.
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

    // No line measuring needed: the long strings live on the page.
    map.show(PAPERS, true);
    gsap.set(coda, { opacity: 0 });

    // Frames animate opacity and scale only, to keep the figure's layout.
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

    // Beat 0 runs right after `enter` and kills the entry mid-tween, so each
    // group is reset on the properties its entrance animated.
    this.motion?.kill();
    gsap.set(this.head, { opacity: 1, y: 0 });
    gsap.set(map.frames, { opacity: 1, scale: 1 });

    const timeline = gsap.timeline().add(map.show(stateOf(index), settle), 0);

    // The coda shows with the plan and hides when stepping back.
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
