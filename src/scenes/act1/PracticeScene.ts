import gsap from 'gsap';
import { DURATION, EASE, seconds } from '@/animations/timing';
import { createAnchorField, type AnchorField } from '@/components/Anchor';
import { createCandidateSet, SET, type CandidateSet } from '@/components/figures/CandidateSet';
import { createSlide, type Slide, type Statement } from '@/components/Slide';
import { PRACTICE } from '@/content/practice';
import type { SceneContext, SceneInstance } from '@/engine/scene/types';

const BEAT = { candidates: 0, criteria: 1, evidence: 2 } as const;

/**
 * Scene 8 — what decides in practice.
 *
 * **The four panels are named in the world, not only in the matrix.** They are
 * standing thirty metres in front of the audience for this beat, and a table
 * that discusses four objects while pointing at none of them is a slide with a
 * render behind it. The anchored labels are what make the columns be *about*
 * something, and they track per frame because the camera is still easing into
 * its pose for most of the time the scene is legible.
 *
 * **The first beat is the objects alone, undimmed and untitled.** The matrix
 * covers the row it is about, so the labels are read against the panels
 * themselves before anything is laid over them: no scrim, no heading, four
 * things and their names. The keys 01 to 04 carry those names into the columns
 * once the matrix arrives.
 *
 * **The handover is staged, not switched.** Everything used to change on the
 * same frame, which is what made the click read as a cut: the veil appeared
 * instantly because a gradient cannot be interpolated, and the labels, the
 * heading and the matrix all crossed each other. The order is now the order the
 * eye needs — the labels release the objects, the light comes down over the
 * park, the claim rises into it, and only then is the matrix built. Just over a
 * second and a half end to end, and no two things arrive together.
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
  /** The eyebrow and heading block, held back through the first beat. */
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

    // The head is settled to its end state and then hidden as a block, so the
    // fade that brings it in later is a `fromTo` on one element. A second `from`
    // on parts already sitting at zero would resolve its destination to zero and
    // animate nothing — `learnings.md` §31c.
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

    // The parts inside the head are always at their end state; the block above
    // them is what carries the reveal.
    slide.revealHead(true);

    const timeline = gsap.timeline();

    if (index <= BEAT.candidates) {
      // Back to the objects, in the reverse order: the claim goes first, the
      // matrix follows it out, the light lifts, and the labels come back last.
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

    // Coming from the objects the whole handover has to be built; coming from
    // the beat after it, only the last row changes.
    const arriving = this.layer?.dataset['veil'] === 'off';

    if (arriving) {
      timeline
        // 1. The labels release the objects they were naming.
        .add(anchors.show(false), 0)
        // 2. The light comes down over the park, on its own CSS transition.
        .call(() => {
          if (this.layer) delete this.layer.dataset['veil'];
        }, undefined, 0.18)
        // 3. The claim rises into it.
        .fromTo(
          head as HTMLElement,
          { opacity: 0, y: 18 },
          { opacity: 1, y: 0, duration: seconds(DURATION.slow), ease: EASE.enter },
          0.45,
        )
        // 4. And the matrix is built into the half of the frame it left clear.
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
