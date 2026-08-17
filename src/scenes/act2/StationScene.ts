import gsap from 'gsap';
import { createCaption, type CaptionContent } from '@/components/Caption';
import { createSlideFigure, type FigureContent, type SlideFigure } from '@/components/SlideFigure';
import { SLIDE_RECT } from '@/config/corridor';
import type { SceneContext, SceneInstance } from '@/engine/scene/types';
import { el } from '@/utilities/dom';

export interface StationContent {
  readonly caption: CaptionContent;
  readonly figures?: readonly FigureContent[];
}

const percent = (fraction: number): string => `${(fraction * 100).toFixed(4)}%`;

export class StationScene implements SceneInstance {
  readonly beats: number;

  private readonly figures: SlideFigure[] = [];
  private readonly built = new Set<number>();
  private build: gsap.core.Timeline | null = null;

  constructor(private readonly content: StationContent) {
    this.beats = Math.max(1, content.figures?.length ?? 0);
  }

  enter(context: SceneContext): void {
    context.root.dataset['align'] = 'slide';

    const caption = createCaption(this.content.caption);
    const stack = el('div', { className: 'slide-stack' });

    for (const figure of this.content.figures ?? []) {
      const built = createSlideFigure(figure);
      this.figures.push(built);
      stack.appendChild(built.element);
    }

    const frame = el('div', { className: 'slide-frame', children: [stack, caption.element] });
    if (this.figures.length > 0) frame.dataset['figures'] = String(this.figures.length);

    frame.style.left = percent(SLIDE_RECT.left);
    frame.style.top = percent(SLIDE_RECT.top);
    frame.style.width = percent(SLIDE_RECT.width);
    frame.style.height = percent(SLIDE_RECT.height);

    context.root.appendChild(frame);
    caption.reveal(context.entryDelay + 0.15);

    // SceneDirector replays beats 1..n only; beat 0 is this scene to raise.
    this.show(0, false)?.delay(context.entryDelay + 0.35);
  }

  beat(index: number, settle: boolean): void {
    this.show(index, settle);
  }

  private show(index: number, settle: boolean): gsap.core.Timeline | null {
    const shown = this.figures[index];
    if (!shown) return null;

    for (const [position, figure] of this.figures.entries()) {
      if (position === index) continue;
      gsap.set(figure.element, { opacity: 0, zIndex: 0 });
    }
    gsap.set(shown.element, { zIndex: 1 });

    this.build?.kill();
    this.build = shown.play(settle || this.built.has(index));
    this.built.add(index);
    return this.build;
  }
}
