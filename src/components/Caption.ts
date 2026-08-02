import gsap from 'gsap';
import { DURATION, EASE, STAGGER, seconds } from '@/animations/timing';
import { el } from '@/utilities/dom';
import './caption.css';

export interface CaptionContent {
  readonly eyebrow?: string;
  readonly heading: string;
  readonly body?: readonly string[];
  /** Semantic accent for the eyebrow rule. */
  readonly accent?: 'circular' | 'ai' | 'emphasis';
  readonly align?: 'start' | 'center';
}

export interface Caption {
  readonly element: HTMLElement;
  reveal(delay?: number): gsap.core.Timeline;
}

/**
 * The standard text block.
 *
 * Scenes compose this rather than writing their own markup, which is what
 * keeps typography, rhythm and reveal timing identical everywhere. Text is
 * DOM rather than 3D: it stays crisp at any projector resolution, remains
 * selectable and accessible, and costs nothing to render.
 */
export function createCaption(content: CaptionContent): Caption {
  const parts: HTMLElement[] = [];

  const eyebrow = content.eyebrow
    ? el('p', { className: 'caption-eyebrow', text: content.eyebrow })
    : null;
  if (eyebrow) parts.push(eyebrow);

  const heading = el('h2', { className: 'caption-heading', text: content.heading });
  parts.push(heading);

  const paragraphs = (content.body ?? []).map((text) => el('p', { text }));
  const body = paragraphs.length
    ? el('div', { className: 'caption-body', children: paragraphs })
    : null;
  if (body) parts.push(body);

  const element = el('div', {
    className: 'caption',
    attrs: {
      'data-accent': content.accent ?? 'circular',
      'data-align': content.align ?? 'start',
    },
    children: parts,
  });

  return {
    element,
    reveal(delay = 0) {
      return gsap.timeline().from(
        [...(eyebrow ? [eyebrow] : []), heading, ...paragraphs],
        {
          y: 26,
          opacity: 0,
          duration: seconds(DURATION.slow),
          ease: EASE.enter,
          stagger: seconds(STAGGER),
        },
        delay,
      );
    },
  };
}
