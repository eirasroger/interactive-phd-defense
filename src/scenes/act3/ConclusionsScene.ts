import gsap from 'gsap';
import { createCaption } from '@/components/Caption';
import { createConclusions, type Conclusions } from '@/components/figures/Conclusions';
import { CONCLUSIONS, CONCLUSION_PANELS } from '@/content/act3';
import type { SceneContext, SceneInstance } from '@/engine/scene/types';
import { el } from '@/utilities/dom';

/**
 * Scene 32: conclusions, the last slide. Four findings, each with its evidence.
 * The fifth conclusion sums up the others and sits under the heading.
 * All four panels are laid out from the start. Each beat opens one in place,
 * and the last beat leaves all four open for questions.
 */
export class ConclusionsScene implements SceneInstance {
  readonly beats = CONCLUSION_PANELS.length;

  private figure: Conclusions | null = null;
  private motion: gsap.core.Timeline | null = null;

  enter(context: SceneContext): void {
    context.root.dataset['align'] = 'theme';

    const caption = createCaption({
      eyebrow: CONCLUSIONS.eyebrow,
      heading: CONCLUSIONS.heading,
      body: [CONCLUSIONS.line],
      accent: 'ai',
    });

    const figure = createConclusions();
    this.figure = figure;

    context.root.appendChild(
      el('div', { className: 'theme', children: [caption.element, figure.element] }),
    );

    const entry = gsap.timeline({ delay: context.entryDelay + 0.15 });
    entry.add(caption.reveal(), 0);
    entry.add(figure.reveal(0, false), 0.35);
    this.motion = entry;
  }

  /**
   * Also called for beat 0 when stepping back. The figure writes its full state
   * each beat, so every navigation path lands on the same frame.
   */
  beat(index: number, settle: boolean): void {
    const figure = this.figure;
    if (!figure) return;
    // Do not settle the previous timeline here. `reveal` already kills its
    // tweens and writes the full state. Forcing the old one to its end would
    // overwrite the new frame.
    this.motion = figure.reveal(index, settle);
  }

  exit(): void {
    this.settle();
    this.figure = null;
  }

  /**
   * Jumps the timeline to its end before killing it. A bare `kill()` would
   * leave unstarted `from` tweens stuck at their start values.
   */
  private settle(): void {
    this.motion?.progress(1).kill();
    this.motion = null;
  }
}
