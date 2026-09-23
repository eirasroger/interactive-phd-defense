import gsap from 'gsap';
import { createBrief, type Card } from '@/components/Brief';
import { createMagnitude, type Magnitude } from '@/components/figures/Magnitude';
import { createRateTrack, type RateTrack } from '@/components/figures/RateTrack';
import { MOTIVATION } from '@/content/motivation';
import type { SceneContext, SceneInstance } from '@/engine/scene/types';
import { el } from '@/utilities/dom';

const BEAT = { sector: 0, response: 1 } as const;

/**
 * Scene 2: motivation and research context.
 *
 * One card with two sections. Beat 0 shows the sector's weight: all three
 * magnitude fields fill at the same rate, so the smaller ones finish first.
 * Beat 1 lights the response section, which is laid out from the start.
 */
export class MotivationScene implements SceneInstance {
  readonly beats = 2;

  private magnitude: Magnitude | null = null;
  private track: RateTrack | null = null;
  private card: Card | null = null;
  private response: HTMLElement | null = null;
  private head: HTMLElement[] = [];

  /**
   * Set once the first real beat runs. `SceneDirector` calls `beat(0)` one frame
   * after `enter`, and that call must leave the entry animation playing.
   * Timeline progress cannot tell a delayed entry from an interrupted one.
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

    // The response section enters with its scale drawn and its marks held back.
    const entry = gsap.timeline({ delay: context.entryDelay + 0.15 });
    entry
      .add(brief.revealHead(), 0)
      .add(card.reveal(), 0.28)
      .add(magnitude.play(), 0.5)
      .add(track.prime(), 0.75);
    this.motion = entry;
  }

  /**
   * Also called for beat 0 right after `enter`. The previous timeline is
   * completed before it is killed because `RateTrack.play` uses `from` tweens,
   * which break if started mid-flight (`learnings.md` §31c).
   */
  beat(index: number, settle: boolean): void {
    const magnitude = this.magnitude;
    const track = this.track;
    const card = this.card;
    const response = this.response;
    if (!magnitude || !track || !card || !response) return;

    // The initial beat(0) after `enter`: let the entry animation play.
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
