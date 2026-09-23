import gsap from 'gsap';
import { createCaption } from '@/components/Caption';
import { createContents } from '@/components/figures/Contents';
import { CONTENTS } from '@/content/contents';
import type { SceneContext, SceneInstance } from '@/engine/scene/types';
import { el } from '@/utilities/dom';

/** Scene 2: contents. A single frame with no beats. */
export class ContentsScene implements SceneInstance {
  private motion: gsap.core.Timeline | null = null;

  enter(context: SceneContext): void {
    const caption = createCaption({ heading: CONTENTS.heading, accent: 'neutral' });

    const figure = createContents();
    figure.prime();

    context.root.appendChild(
      el('div', {
        className: 'contents-composition',
        children: [caption.element, figure.element],
      }),
    );

    const entry = gsap.timeline({ delay: context.entryDelay + 0.15 });
    entry.add(caption.reveal(), 0).add(figure.reveal(), 0.2);
    this.motion = entry;
  }

  exit(): void {
    this.motion?.progress(1).kill();
    this.motion = null;
  }
}
