import gsap from 'gsap';
import { DURATION, EASE, seconds } from '@/animations/timing';
import { createAnchorField, type AnchorField } from '@/components/Anchor';
import { createCandidateSet, SET, type CandidateSet } from '@/components/figures/CandidateSet';
import { createSlide, type Slide, type Statement } from '@/components/Slide';
import { PRACTICE } from '@/content/practice';
import type { SceneContext, SceneInstance } from '@/engine/scene/types';

const BEAT = { candidates: 0, criteria: 1, evidence: 2 } as const;

/**
 * Scene 8: what decides in practice.
 *
 * Beat 0 shows the four panels in the world with anchored labels, no veil and
 * no heading. Labels track every frame because the camera is still easing in.
 * Moving to beat 1 is staged over about 1.5 s: labels fade, the veil comes
 * down, the heading rises, then the matrix builds.
 */
export class PracticeScene implements SceneInstance {
  readonly beats = 3;

  private slide: Slide | null = null;
  private criteria: Statement | null = null;
  private evidence: Statement | null = null;
  private set: CandidateSet | null = null;
  private anchors: AnchorField | null = null;
  private setSlot = -1;
  private layer: HTMLElement | null = null;
  /** Eyebrow and heading block, hidden during the first beat. */
  private head: HTMLElement | null = null;

  private motion: gsap.core.Timeline | null = null;

  enter(context: SceneContext): void {
    context.root.dataset['align'] = 'wide';
    context.root.dataset['veil'] = 'off';
    this.layer = context.root;

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

    this.head = slide.element.querySelector<HTMLElement>('.slide-head');

    context.root.appendChild(anchors.element);
    context.root.appendChild(slide.element);
    set.show(SET.void, true);
    anchors.show(false, true);

    // Settle the head's parts, then hide the block so it can fade in later with
    // one `fromTo`. A `from` on parts already at zero animates nothing
    // (`learnings.md` §31c).
    slide.revealHead(true);
    if (this.head) gsap.set(this.head, { opacity: 0, y: 18 });

    const entry = gsap.timeline({ delay: context.entryDelay + 0.15 });
    entry.add(anchors.show(true), 0);
    this.motion = entry;
  }

  beat(index: number, settle: boolean): void {
    const slide = this.slide;
    const set = this.set;
    const anchors = this.anchors;
    const head = this.head;
    if (!slide || !set || !anchors || !this.criteria || !this.evidence) return;

    this.motion?.kill();
    this.motion = null;

    // Head parts stay at their end state. The head block carries the reveal.
    slide.revealHead(true);

    const timeline = gsap.timeline();

    if (index <= BEAT.candidates) {
      // Reverse order: heading, matrix, veil, then labels.
      this.criteria.hide();
      this.evidence.hide();
      set.show(SET.void, true);

      if (settle) {
        if (head) gsap.set(head, { opacity: 0, y: 18 });
        if (this.layer) this.layer.dataset['veil'] = 'off';
        slide.evidence.show(-1, true);
        anchors.show(true, true);
        return;
      }

      if (head) {
        timeline.to(
          head,
          { opacity: 0, y: 18, duration: seconds(DURATION.normal), ease: EASE.exit },
          0,
        );
      }
      timeline
        .add(slide.evidence.show(-1), 0.1)
        .call(() => {
          if (this.layer) this.layer.dataset['veil'] = 'off';
        }, undefined, 0.25)
        .add(anchors.show(true), 0.75);

      this.motion = timeline;
      return;
    }

    const lit = index >= BEAT.evidence;

    if (settle) {
      if (this.layer) delete this.layer.dataset['veil'];
      if (head) gsap.set(head, { opacity: 1, y: 0 });
      anchors.show(false, true);
      slide.evidence.show(this.setSlot, true);
      this.criteria.play(true);
      if (lit) this.evidence.play(true);
      else this.evidence.hide();
      set.show(lit ? SET.evidence : SET.criteria, true);
      return;
    }

    // From beat 0 the full handover runs. From beat 2 only the last row changes.
    const arriving = this.layer?.dataset['veil'] === 'off';

    if (arriving) {
      timeline
        // 1. Labels fade out.
        .add(anchors.show(false), 0)
        // 2. Veil comes down (CSS transition).
        .call(() => {
          if (this.layer) delete this.layer.dataset['veil'];
        }, undefined, 0.18)
        // 3. Heading rises in.
        .fromTo(
          head as HTMLElement,
          { opacity: 0, y: 18 },
          { opacity: 1, y: 0, duration: seconds(DURATION.slow), ease: EASE.enter },
          0.45,
        )
        // 4. Matrix builds.
        .add(slide.evidence.show(this.setSlot), 0.72)
        .add(set.show(SET.criteria), 0.9)
        .add(this.criteria.play(), 1.05);
    } else {
      if (head) gsap.set(head, { opacity: 1, y: 0 });
      slide.evidence.show(this.setSlot, true);
      this.criteria.play(true);
      timeline.add(set.show(lit ? SET.evidence : SET.criteria), 0);
    }

    if (lit) {
      timeline
        .add(this.evidence.play(), arriving ? 1.25 : 0)
        .add(set.show(SET.evidence), arriving ? 1.25 : 0);
    } else if (!arriving) {
      this.evidence.hide();
    }

    this.motion = timeline;
  }

  exit(): void {
    this.motion?.kill();
    this.motion = null;
    if (this.layer) delete this.layer.dataset['veil'];
    this.layer = null;
    this.head = null;
  }
}
