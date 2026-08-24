import gsap from 'gsap';
import { createCaption } from '@/components/Caption';
import { createConclusions, type Conclusions } from '@/components/figures/Conclusions';
import { CONCLUSIONS, CONCLUSION_PANELS } from '@/content/act3';
import type { SceneContext, SceneInstance } from '@/engine/scene/types';
import { el } from '@/utilities/dom';

/**
 * Scene 32 — the conclusions, and the last frame of the deck.
 *
 * Four findings, each with the evidence that makes it true drawn beside it. The
 * fifth conclusion is a statement about the other four rather than a fifth
 * finding, so it is set once under the heading and never illustrated.
 *
 * **Four beats, and the title does not move between them.** Every panel stands
 * on the surface from the moment the camera settles, holding the full room it
 * will need and showing its claim, and each beat opens the one it belongs to in
 * place. Nothing outside a panel ever moves, so the frame is never being
 * assembled in front of the committee, and the fourth beat leaves all four
 * findings on screen together, which is what the questions afterwards need.
 *
 * **The pipeline is not on this slide.** It has been the subject of the whole
 * deck and drawing it a sixth time would be the talk repeating itself in its
 * last minute.
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
   * `SceneDirector` calls this for beat 0 as well, on the way back.
   *
   * The figure writes its whole state on every beat rather than the difference
   * from the beat before it, so stepping backwards, jumping in from the deck and
   * walking forwards all land on the same frame.
   */
  beat(index: number, settle: boolean): void {
    const figure = this.figure;
    if (!figure) return;
    // The outgoing timeline is not settled here, and that is deliberate.
    //
    // `reveal` opens with `killTweensOf` over everything it owns and then writes
    // the complete state for the beat, so the previous timeline has nothing left
    // to finish. Calling `progress(1).kill()` on it as well — before or after —
    // put the beat one panel behind: killed mid-flight and then forced to its
    // end, it stamped the previous frame back over the one just written and left
    // the new beat's own tween detached from the clock.
    this.motion = figure.reveal(index, settle);
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
}
