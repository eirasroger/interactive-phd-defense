import gsap from 'gsap';
import { DURATION, EASE, STAGGER, seconds } from '@/animations/timing';
import { createObjectiveMap, type ObjectiveMap } from '@/components/figures/ObjectiveMap';
import { OBJECTIVES } from '@/content/objectives';
import type { SceneContext, SceneInstance } from '@/engine/scene/types';
import { el } from '@/utilities/dom';

/**
 * Scene 10 — the six gaps regrouped into four objectives.
 *
 * Four beats, one per objective, and none spent on anything but a fold. The six
 * gaps stand along the top throughout; each beat lights the ones its objective
 * is motivated by.
 */
const BEATS = OBJECTIVES.map.items.length;

export class ObjectivesScene implements SceneInstance {
  readonly beats = BEATS;

  private map: ObjectiveMap | null = null;
  /** Everything the entry timeline animates, so a killed entry can be settled. */
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

    // Only now is there a layout to read line breaks off. If the webfont has not
    // resolved the text will rewrap when it does, so measure again on that —
    // guarded by the scene's signal, because a scene that has already exited must
    // not be writing to its own dead DOM.
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

    // The deck calls this for beat 0 immediately after `enter`, which kills the
    // entry timeline while its `from` tweens are still at their start values —
    // an invisible composition. Settling the head is what puts them back.
    this.motion?.kill();
    gsap.set(this.head, { opacity: 1, y: 0 });

    this.motion = gsap.timeline().add(map.show(index, settle), 0);
  }
}
