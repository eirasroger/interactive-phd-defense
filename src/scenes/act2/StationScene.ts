import gsap from 'gsap';
import { DURATION, EASE, seconds } from '@/animations/timing';
import { createCaption, type CaptionContent } from '@/components/Caption';
import { createSlideFigure, type FigureContent } from '@/components/SlideFigure';
import { SLIDE_RECT } from '@/config/corridor';
import type { SceneContext, SceneInstance } from '@/engine/scene/types';
import { el } from '@/utilities/dom';

/**
 * Anything a station can put on its wall.
 *
 * A panel owning more than one beat is the point: a device that re-forms
 * across three clicks is one object being driven, and it can animate between
 * its own states. Swapping two finished pictures cannot.
 */
export interface SlidePanel {
  readonly element: HTMLElement;
  readonly beats: number;
  play(step: number, settle: boolean): gsap.core.Timeline | null;
}

export interface StationContent {
  readonly caption: CaptionContent;
  /** Indexed by beat; falls back to `caption` where a beat names none. */
  readonly captions?: readonly CaptionContent[];
  readonly panels?: readonly SlidePanel[];
  readonly figures?: readonly FigureContent[];
}

interface Slot {
  readonly panel: SlidePanel;
  readonly step: number;
}

const percent = (fraction: number): string => `${(fraction * 100).toFixed(4)}%`;

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
    // SceneDirector replays beats 1..n only; beat 0 is this scene to raise.
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

    for (const [position, node] of this.captions.entries()) {
      if (position === wanted) continue;
      gsap.to(node, {
        opacity: 0,
        duration: settle ? 0 : seconds(DURATION.quick),
        ease: EASE.exit,
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
        delay,
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
      gsap.set(panel.element, { opacity: 0, zIndex: 0 });
    }

    // The panel being raised may still be running the fade-out from the last
    // time it left, and a `set` inside `play` does not beat a tween that is
    // still in flight. Stepping back onto a panel a click after leaving it left
    // the wall blank for that reason. The scene started the fade, so the scene
    // stops it.
    gsap.killTweensOf(slot.panel.element);
    gsap.set(slot.panel.element, { zIndex: 1 });

    // Run the outgoing timeline to its end before dropping it. A bare `kill()`
    // abandons every `from` tween wherever it happened to be, which strands
    // whatever it was fading at whatever opacity it had reached.
    this.build?.progress(1).kill();

    // A panel handing over to another panel crossfades under it. Cutting the
    // outgoing one to zero in the same frame is what made every change of
    // panel read as a jump, however carefully the incoming one was staged.
    if (outgoing && outgoing !== slot.panel) {
      gsap.set(outgoing.element, { zIndex: 0 });
      if (settle) {
        gsap.set(outgoing.element, { opacity: 0 });
      } else {
        gsap.to(outgoing.element, {
          opacity: 0,
          duration: seconds(DURATION.slow),
          ease: EASE.standard,
          overwrite: true,
        });
        handover = seconds(DURATION.normal * 0.4);
      }
    }

    // Two compositions dissolving through each other reads as a glitch, so the
    // incoming one waits until the outgoing has mostly cleared. Steps inside a
    // panel are a continuous move and take no handover at all.
    this.build = slot.panel.play(slot.step, settle);
    if (handover > 0) this.build?.delay(handover);
    return this.build;
  }
}
