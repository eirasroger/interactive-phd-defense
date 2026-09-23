import gsap from 'gsap';
import { DURATION, EASE, seconds } from '@/animations/timing';
import { createCaption, type CaptionContent } from '@/components/Caption';
import { createSlideFigure, type FigureContent } from '@/components/SlideFigure';
import { SLIDE_RECT } from '@/config/corridor';
import type { SceneContext, SceneInstance } from '@/engine/scene/types';
import { el } from '@/utilities/dom';

/**
 * A figure shown on a station wall. One panel can span several beats and
 * animate between its own states.
 *
 * During a swap the scene owns `opacity`, `y` and `zIndex` on `element`. A
 * panel may tween its own opacity but must not tween `y` on its root.
 */
export interface SlidePanel {
  readonly element: HTMLElement;
  readonly beats: number;
  play(step: number, settle: boolean): gsap.core.Timeline | null;
}

export interface StationContent {
  readonly caption: CaptionContent;
  /** Indexed by beat. Beats past the end reuse the last caption. */
  readonly captions?: readonly CaptionContent[];
  readonly panels?: readonly SlidePanel[];
  readonly figures?: readonly FigureContent[];
}

interface Slot {
  readonly panel: SlidePanel;
  readonly step: number;
}

const percent = (fraction: number): string => `${(fraction * 100).toFixed(4)}%`;

/**
 * Panel swap timing. The outgoing panel fades and lifts up, the incoming one
 * rises from below. `handover` must fall where the outgoing panel is below 10%
 * opacity, and most of `lift` must happen within `fade`.
 */
const SWAP = {
  fade: DURATION.normal * 0.9,
  lift: DURATION.slow * 0.56,
  liftBy: 30,
  handover: DURATION.quick * 1.1,
  rise: DURATION.slow * 0.7,
  riseBy: 12,
} as const;

const asPanel = (figure: FigureContent): SlidePanel => {
  const built = createSlideFigure(figure);
  return {
    element: built.element,
    beats: 1,
    play: (_step, settle) => built.play(settle),
  };
};

export class StationScene implements SceneInstance {
  readonly beats: number;

  private readonly panels: readonly SlidePanel[];
  private readonly slots: readonly Slot[];
  private readonly captions: HTMLElement[] = [];
  private current: SlidePanel | null = null;
  private caption = -1;
  private build: gsap.core.Timeline | null = null;

  constructor(private readonly content: StationContent) {
    this.panels = [...(content.panels ?? []), ...(content.figures ?? []).map(asPanel)];

    const slots: Slot[] = [];
    for (const panel of this.panels) {
      for (let step = 0; step < Math.max(1, panel.beats); step += 1) {
        slots.push({ panel, step });
      }
    }
    this.slots = slots;
    this.beats = Math.max(1, slots.length);
  }

  enter(context: SceneContext): void {
    context.root.dataset['align'] = 'slide';

    const stack = el('div', { className: 'slide-stack' });
    for (const panel of this.panels) {
      stack.appendChild(panel.element);
    }

    const captionSlot = el('div', { className: 'slide-captions' });
    const sources = this.content.captions ?? [this.content.caption];
    for (const source of sources) {
      const caption = createCaption(source);
      this.captions.push(caption.element);
      captionSlot.appendChild(caption.element);
    }
    gsap.set(this.captions, { opacity: 0 });

    const frame = el('div', {
      className: 'slide-frame',
      children: [captionSlot, stack],
    });
    if (this.panels.length > 0) frame.dataset['figures'] = String(this.panels.length);

    frame.style.left = percent(SLIDE_RECT.left);
    frame.style.top = percent(SLIDE_RECT.top);
    frame.style.width = percent(SLIDE_RECT.width);
    frame.style.height = percent(SLIDE_RECT.height);

    context.root.appendChild(frame);

    this.showCaption(0, false, context.entryDelay + 0.15);
    // SceneDirector only replays beats 1..n, so beat 0 is shown here.
    this.show(0, false)?.delay(context.entryDelay + 0.35);
  }

  beat(index: number, settle: boolean): void {
    this.showCaption(index, settle, 0);
    this.show(index, settle);
  }

  private showCaption(index: number, settle: boolean, delay: number): void {
    const sources = this.content.captions ?? [this.content.caption];
    const wanted = Math.min(index, sources.length - 1);
    const shown = this.captions[wanted];
    if (!shown) return;

    // Keep the caption still when consecutive beats share it.
    if (this.caption === wanted) return;
    this.caption = wanted;

    // `power2.out` fades early so old and new captions never overlap visibly.
    for (const [position, node] of this.captions.entries()) {
      if (position === wanted) continue;
      if (settle) {
        gsap.set(node, { opacity: 0, y: 0 });
        continue;
      }
      gsap.to(node, {
        opacity: 0,
        y: -14,
        duration: seconds(DURATION.quick),
        ease: 'power2.out',
        overwrite: true,
      });
    }

    if (settle) {
      gsap.set(shown, { opacity: 1, y: 0 });
      return;
    }

    gsap.fromTo(
      shown,
      { opacity: 0, y: 14 },
      {
        opacity: 1,
        y: 0,
        duration: seconds(DURATION.slow),
        ease: EASE.enter,
        overwrite: true,
        delay: delay + seconds(DURATION.quick * 0.72),
      },
    );
  }

  private show(index: number, settle: boolean): gsap.core.Timeline | null {
    const slot = this.slots[index];
    if (!slot) return null;

    const outgoing = this.current;
    this.current = slot.panel;
    let handover = 0;

    for (const panel of this.panels) {
      if (panel === slot.panel || panel === outgoing) continue;
      gsap.killTweensOf(panel.element);
      gsap.set(panel.element, { opacity: 0, y: 0, zIndex: 0 });
    }

    // The incoming panel may still be running its exit tween. Kill it and reset
    // the properties it touched, or a `set` in `play` gets overridden.
    gsap.killTweensOf(slot.panel.element);
    gsap.set(slot.panel.element, { zIndex: 1, y: 0 });

    // Finish the previous build before killing it, so no `from` tween is left
    // stuck at partial opacity.
    this.build?.progress(1).kill();

    if (outgoing && outgoing !== slot.panel) {
      gsap.set(outgoing.element, { zIndex: 0 });
      gsap.killTweensOf(outgoing.element);

      if (settle) {
        gsap.set(outgoing.element, { opacity: 0, y: 0 });
      } else {
        // Two tweens on one target, so no `overwrite`. The kill above clears old tweens.
        gsap.to(outgoing.element, {
          opacity: 0,
          duration: seconds(SWAP.fade),
          ease: 'power2.out',
        });
        gsap.to(outgoing.element, {
          y: -SWAP.liftBy,
          duration: seconds(SWAP.lift),
          ease: 'power3.out',
        });
        handover = seconds(SWAP.handover);
      }
    }

    this.build = slot.panel.play(slot.step, settle);

    // On a swap, delay the build and add a rise. Scene entry skips this because
    // it is timed to the camera.
    if (handover > 0) {
      this.build?.delay(handover);
      gsap.fromTo(
        slot.panel.element,
        { y: SWAP.riseBy },
        { y: 0, duration: seconds(SWAP.rise), ease: EASE.enter, delay: handover },
      );
    }

    return this.build;
  }
}
