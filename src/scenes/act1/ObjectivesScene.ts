import gsap from 'gsap';
import { DURATION, EASE, STAGGER, seconds } from '@/animations/timing';
import { createObjectiveMap, type ObjectiveMap } from '@/components/figures/ObjectiveMap';
import { OBJECTIVES } from '@/content/objectives';
import type { SceneContext, SceneInstance } from '@/engine/scene/types';
import { el } from '@/utilities/dom';

/**
 * Scene 10: the six gaps regrouped into four objectives. One beat per
 * objective; each beat highlights the gaps that motivate it.
 */
const BEATS = OBJECTIVES.map.items.length;

export class ObjectivesScene implements SceneInstance {
  readonly beats = BEATS;

  private map: ObjectiveMap | null = null;
  /** Elements the entry timeline animates, reset if the entry is killed. */
  private head: HTMLElement[] = [];

  private motion: gsap.core.Timeline | null = null;

  enter(context: SceneContext): void {
    context.root.dataset['align'] = 'wide';

    const eyebrow = el('p', { className: 'objectives-eyebrow', text: OBJECTIVES.eyebrow });
    const heading = el('h2', { className: 'objectives-heading', text: OBJECTIVES.heading });
    const headBlock = el('div', { className: 'objectives-head', children: [eyebrow, heading] });

    const map = createObjectiveMap(OBJECTIVES.map);
    this.map = map;
    this.head = [eyebrow, heading, ...map.frames];

    context.root.appendChild(
      el('div', { className: 'objectives-composition', children: [headBlock, map.element] }),
    );

    // Measure after layout, and again once webfonts load since text may rewrap.
    // The abort check skips the remeasure if the scene has already exited.
    map.measure();
    if (document.fonts.status !== 'loaded') {
      void document.fonts.ready.then(() => {
        if (!context.signal.aborted) map.measure();
      });
    }

    map.show(-1, true);

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
          y: 26,
          opacity: 0,
          duration: seconds(DURATION.slow),
          ease: EASE.enter,
          stagger: seconds(0.04),
        },
        0.25,
      )
      .add(map.show(0), 0.65);
    this.motion = entry;
  }

  beat(index: number, settle: boolean): void {
    const map = this.map;
    if (!map) return;

    // Beat 0 runs right after `enter` and kills the entry timeline while its
    // `from` tweens are still hidden, so reset the head to visible.
    this.motion?.kill();
    gsap.set(this.head, { opacity: 1, y: 0 });

    this.motion = gsap.timeline().add(map.show(index, settle), 0);
  }
}
