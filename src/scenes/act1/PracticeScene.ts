import gsap from 'gsap';
import { createAnchorField, type AnchorField } from '@/components/Anchor';
import { createCandidateSet, SET, type CandidateSet } from '@/components/figures/CandidateSet';
import { createSlide, type Slide, type Statement } from '@/components/Slide';
import { PRACTICE } from '@/content/practice';
import type { SceneContext, SceneInstance } from '@/engine/scene/types';

const BEAT = { criteria: 0, evidence: 1 } as const;

/**
 * Scene 8 — what decides in practice.
 *
 * **The four panels are named in the world, not only in the matrix.** They are
 * standing thirty metres in front of the audience for this beat, and a table
 * that discusses four objects while pointing at none of them is a slide with a
 * render behind it. The anchored labels are what make the columns be *about*
 * something, and they track per frame because the camera is still easing into
 * its pose for most of the time the scene is legible.
 */
export class PracticeScene implements SceneInstance {
  readonly beats = 2;

  private slide: Slide | null = null;
  private criteria: Statement | null = null;
  private evidence: Statement | null = null;
  private set: CandidateSet | null = null;
  private anchors: AnchorField | null = null;
  private setSlot = -1;

  private motion: gsap.core.Timeline | null = null;

  enter(context: SceneContext): void {
    context.root.dataset['align'] = 'wide';

    const slide = createSlide({
      eyebrow: PRACTICE.eyebrow,
      heading: PRACTICE.heading,
      accent: 'emphasis',
    });

    this.criteria = slide.addStatement(PRACTICE.criteria, 'circular');
    this.evidence = slide.addStatement(PRACTICE.evidence, 'emphasis');

    const set = createCandidateSet(PRACTICE.set);
    this.setSlot = slide.evidence.add(set.element);
    this.set = set;
    this.slide = slide;

    const anchors = createAnchorField(context.camera, PRACTICE.anchors);
    this.anchors = anchors;
    anchors.track();
    context.onFrame(() => anchors.track());

    context.root.appendChild(anchors.element);
    context.root.appendChild(slide.element);
    set.show(SET.void, true);
    anchors.show(false, true);

    const entry = gsap.timeline({ delay: context.entryDelay + 0.15 });
    entry
      .add(slide.revealHead(), 0)
      .add(slide.evidence.show(this.setSlot), 0.35)
      .add(this.criteria.play(), 0.5)
      .add(set.show(SET.criteria), 0.5)
      // After the matrix, so the eye is taken from the columns out to the
      // objects they name rather than the other way round.
      .add(anchors.show(true), 1.1);
    this.motion = entry;
  }

  beat(index: number, settle: boolean): void {
    const slide = this.slide;
    const set = this.set;
    const anchors = this.anchors;
    if (!slide || !set || !anchors || !this.criteria || !this.evidence) return;

    this.motion?.kill();
    this.motion = null;

    slide.revealHead(true);
    slide.evidence.show(this.setSlot, true);
    this.criteria.play(true);
    anchors.show(true, true);

    switch (index) {
      case BEAT.criteria:
        this.evidence.hide();
        this.motion = set.show(SET.criteria, settle);
        break;

      case BEAT.evidence: {
        const timeline = gsap.timeline();
        timeline.add(this.evidence.play(settle), 0).add(set.show(SET.evidence, settle), 0);
        this.motion = timeline;
        break;
      }

      default:
        break;
    }
  }
}
