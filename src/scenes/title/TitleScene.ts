import gsap from 'gsap';
import { DURATION, EASE, STAGGER, seconds } from '@/animations/timing';
import { meta } from '@/content/presentation';
import type { Scene, SceneContext } from '@/engine/types';
import { el } from '@/utilities/dom';
import './title.css';

export class TitleScene implements Scene {
  enter(context: SceneContext): void {
    const institution = el('p', { className: 'title-institution', text: meta.institution });
    const heading = el('h1', { className: 'title-heading', text: meta.title });
    const author = el('p', { className: 'title-author', text: meta.author });
    const hint = el('p', { className: 'title-hint', text: 'Press → to begin' });

    context.root.appendChild(
      el('div', {
        className: 'title-block',
        children: [institution, heading, author, hint],
      }),
    );

    gsap.from([institution, heading, author, hint], {
      y: 32,
      opacity: 0,
      duration: seconds(DURATION.slow),
      ease: EASE.enter,
      stagger: seconds(STAGGER),
    });
  }
}
