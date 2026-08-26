import gsap from 'gsap';
import { createBrief, type Card } from '@/components/Brief';
import { createMagnitude, type Magnitude } from '@/components/figures/Magnitude';
import { createRateTrack, type RateTrack } from '@/components/figures/RateTrack';
import { MOTIVATION } from '@/content/motivation';
import type { SceneContext, SceneInstance } from '@/engine/scene/types';
import { el } from '@/utilities/dom';

const BEAT = { sector: 0, response: 1 } as const;

/**
 * Scene 2 — motivation and research context.
 *
 * **One card, two sections, and the second is the click.** The sector's weight
 * and the response to it are read against each other, so they share a surface
 * and are divided by a rule rather than standing on two cards with two shadows.
 * The frame is composed whole: the response section holds its place from the
 * moment the camera settles, so the click lights it instead of rebuilding the
 * slide underneath the presenter.
 *
 * **The first beat carries the entire contradiction.** Economic weight and
 * environmental burden only mean anything against one another; landing them on
 * separate clicks made a beat out of a comparison and left the frame carrying
 * one lonely number for a sentence and a half. All three fields now start
 * filling on the same frame at the same rate, and the nine finishes while the
 * fifty is still running. The disproportion is a duration as well as an area.
 */
export class MotivationScene implements SceneInstance {
  readonly beats = 2;

  private magnitude: Magnitude | null = null;
  private track: RateTrack | null = null;
  private card: Card | null = null;
  private response: HTMLElement | null = null;
  private head: HTMLElement[] = [];

  /**
   * Whether the arrival has been handed over to the beats.
   *
   * `SceneDirector` calls `beat(0)` one frame after `enter`, and completing the
   * entry timeline there would skip the arrival the scene was just given —
   * heading, card and a two-second race, all snapped to their end state before
   * anyone saw them. A flag rather than reading the timeline's progress, which
   * is zero both before a delayed timeline starts and while it is still in its
   * delay, and cannot tell those apart from an entry that was interrupted.
   */
  private arrived = false;

  private motion: gsap.core.Timeline | null = null;

  enter(context: SceneContext): void {
    context.root.dataset['align'] = 'brief';

    const brief = createBrief({
      eyebrow: MOTIVATION.eyebrow,
      heading: MOTIVATION.heading,
      accent: 'emphasis',
      source: MOTIVATION.source,
    });
    this.head = [...brief.head];

    const card = brief.addCard({ accent: 'emphasis' });
    this.card = card;

    const magnitude = createMagnitude(MOTIVATION.magnitude);
    this.magnitude = magnitude;

    const track = createRateTrack(MOTIVATION.target);
    this.track = track;

    const response = el('section', {
      className: 'brief-section',
      children: [
        el('p', { className: 'brief-section-label', text: MOTIVATION.targetLabel }),
        track.element,
      ],
    });
    this.response = response;

    card.body.appendChild(
      el('div', { className: 'brief-stack', children: [magnitude.element, response] }),
    );

    context.root.appendChild(brief.element);

    magnitude.play(true);
    track.prime(true);
    response.dataset['state'] = 'pending';
    this.arrived = false;

    // The response section is drawn with the card, empty. Reserving its height
    // and leaving it blank is a hole; drawing its scale and holding the marks
    // back is a figure waiting to be filled, and the click fills it.
    const entry = gsap.timeline({ delay: context.entryDelay + 0.15 });
    entry
      .add(brief.revealHead(), 0)
      .add(card.reveal(), 0.28)
      .add(magnitude.play(), 0.5)
      .add(track.prime(), 0.75);
    this.motion = entry;
  }

  /**
   * The deck calls this for beat 0 as well, immediately after `enter`.
   *
   * The outgoing timeline is finished rather than dropped: `RateTrack.play` is
   * built from `from` tweens, and a second `from` created while the first is
   * still in flight resolves its destination to whatever the kill stranded —
   * `learnings.md` §31c.
   */
  beat(index: number, settle: boolean): void {
    const magnitude = this.magnitude;
    const track = this.track;
    const card = this.card;
    const response = this.response;
    if (!magnitude || !track || !card || !response) return;

    // The call that lands one frame after `enter`, on the beat the entry is
    // already playing. Nothing to do, and finishing the entry would throw it
    // away.
    if (!this.arrived && index === BEAT.sector && !settle) return;
    this.arrived = true;

    this.motion?.progress(1).kill();
    gsap.set(this.head, { opacity: 1, y: 0 });
    card.reveal(true);
    magnitude.play(true);

    const live = index >= BEAT.response;
    response.dataset['state'] = live ? 'live' : 'pending';

    const timeline = gsap.timeline();
    timeline.add(live ? track.play(settle) : track.prime(true), 0);
    this.motion = timeline;
  }

  exit(): void {
    this.motion?.progress(1).kill();
    this.motion = null;
    this.magnitude = null;
    this.track = null;
    this.card = null;
    this.response = null;
    this.arrived = false;
  }
}
