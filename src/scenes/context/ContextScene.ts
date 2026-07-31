import gsap from 'gsap';
import { DURATION, EASE, STAGGER, seconds } from '@/animations/timing';
import { context as content } from '@/content/presentation';
import type { Scene, SceneContext } from '@/engine/types';
import { el } from '@/utilities/dom';
import './context.css';

export class ContextScene implements Scene {
  enter(context: SceneContext): void {
    const eyebrow = el('p', { className: 'context-eyebrow', text: content.eyebrow });
    const heading = el('h2', { className: 'context-heading', text: content.heading });
    const paragraphs = content.body.map((text) => el('p', { text }));
    const body = el('div', { className: 'context-body', children: paragraphs });

    context.root.appendChild(
      el('div', { className: 'context-block', children: [eyebrow, heading, body] }),
    );

    gsap.from([eyebrow, heading, ...paragraphs], {
      y: 24,
      opacity: 0,
      duration: seconds(DURATION.slow),
      ease: EASE.enter,
      stagger: seconds(STAGGER),
    });
  }
}
