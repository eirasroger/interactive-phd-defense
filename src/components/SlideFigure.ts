import gsap from 'gsap';
import { DURATION, EASE, seconds } from '@/animations/timing';
import { el } from '@/utilities/dom';
import './slideFigure.css';

export interface FigureContent {
  readonly src: string;
  readonly alt: string;
}

export interface SlideFigure {
  readonly element: HTMLElement;
  play(settle?: boolean): gsap.core.Timeline;
}

export function createSlideFigure(content: FigureContent): SlideFigure {
  const image = el('img', {
    className: 'slide-figure-image',
    attrs: { src: content.src, alt: content.alt, decoding: 'async', draggable: 'false' },
  });

  const element = el('figure', { className: 'slide-figure', children: [image] });

  return {
    element,

    play(settle = false) {
      const timeline = gsap.timeline();

      if (settle) {
        gsap.set(element, { opacity: 1, y: 0 });
        return timeline;
      }

      timeline.fromTo(
        element,
        { opacity: 0, y: 32 },
        { opacity: 1, y: 0, duration: seconds(DURATION.slow), ease: EASE.enter },
      );
      return timeline;
    },
  };
}
