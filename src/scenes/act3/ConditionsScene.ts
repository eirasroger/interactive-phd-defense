import gsap from 'gsap';
import { createCaption } from '@/components/Caption';
import { createConditions, type Conditions } from '@/components/figures/Conditions';
import { CONDITIONS } from '@/content/act3';
import type { SceneContext, SceneInstance } from '@/engine/scene/types';
import { el } from '@/utilities/dom';

/**
 * Scene 30 — the two conditions the architecture is designed around.
 *
 * Act III's second cross-cutting theme, and the last composition before the
 * close. Missing evidence and context sensitivity are argued on one slide
 * because they are the same kind of claim: neither belongs to a stage, both were
 * taken as properties of the problem, and the architecture answers each of them
 * the whole way down. Argued apart they are two more slides about the pipeline.
 *
 * **Two beats, and only the second card moves between them.** The weave is a
 * standing picture the presenter talks over; the registers are drawn beside it
 * from the first frame and answer on the click. Nothing else on the slide
 * changes, including the title, so the beat reads as the argument advancing
 * rather than as the slide being rebuilt.
 */
export class ConditionsScene implements SceneInstance {
  readonly beats = 2;

  private figure: Conditions | null = null;
  private motion: gsap.core.Timeline | null = null;

  enter(context: SceneContext): void {
    context.root.dataset['align'] = 'theme';

    const caption = createCaption({
      eyebrow: CONDITIONS.eyebrow,
      heading: CONDITIONS.heading,
      body: [CONDITIONS.line],
      accent: 'ai',
    });

    const figure = createConditions();
    this.figure = figure;

    context.root.appendChild(
      el('div', { className: 'theme', children: [caption.element, figure.element] }),
    );

    const entry = gsap.timeline({ delay: context.entryDelay + 0.15 });
    entry.add(caption.reveal(), 0);
    entry.add(figure.open(false), 0.35);
    this.motion = entry;
  }

  /**
   * `SceneDirector` calls this for beat 0 as well, on the way back.
   *
   * So beat 0 has to rebuild the opening state rather than assume it survived,
   * and both branches write everything they depend on. A defence is not walked
   * in a straight line.
   */
  beat(index: number, settle: boolean): void {
    const figure = this.figure;
    if (!figure) return;
    this.swap(index >= 1 ? figure.apply(settle) : figure.open(settle));
  }

  exit(): void {
    this.settle();
    this.figure = null;
  }

  /**
   * The outgoing timeline is finished, never abandoned.
   *
   * `kill()` drops every tween where it stands and leaves its target at that
   * value, so a `from` that had not run yet strands its element at the start
   * value it was never meant to rest on. `progress(1)` writes the end state
   * first and the kill is then only releasing the tween.
   */
  private settle(): void {
    this.motion?.progress(1).kill();
    this.motion = null;
  }

  private swap(next: gsap.core.Timeline): void {
    this.settle();
    this.motion = next;
  }
}
