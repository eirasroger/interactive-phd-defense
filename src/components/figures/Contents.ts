import gsap from 'gsap';
import { DURATION, EASE, seconds } from '@/animations/timing';
import { CONTENTS } from '@/content/contents';
import { el } from '@/utilities/dom';
import './contents.css';

export interface Contents {
  readonly element: HTMLElement;
  reveal(settle?: boolean): gsap.core.Timeline;
  /** Hides the list at its start state until `reveal` runs. */
  prime(): void;
}

const stationRow = (station: { readonly key: string; readonly role: string }): HTMLElement =>
  el('li', {
    className: 'contents-station',
    children: [
      el('span', { className: 'contents-station-key', text: station.key }),
      el('span', { className: 'contents-station-role', text: station.role }),
    ],
  });

const itemAt = (part: (typeof CONTENTS.parts)[number], index: number): HTMLElement => {
  const children: HTMLElement[] = [
    el('span', { className: 'contents-key', text: String(index + 1).padStart(2, '0') }),
    el('span', { className: 'contents-title', text: part.title }),
  ];

  if (part.expands) {
    children.push(
      el('ol', { className: 'contents-stations', children: CONTENTS.stations.map(stationRow) }),
    );
  }

  const element = el('li', { className: 'contents-item', children });
  if (part.expands) element.dataset['expands'] = '';
  return element;
};

/** The six sections, numbered and in order. */
export function createContents(): Contents {
  const items = CONTENTS.parts.map(itemAt);
  const element = el('ol', { className: 'contents-list', children: items });

  return {
    element,

    prime() {
      gsap.set(items, { opacity: 0, y: 14 });
    },

    reveal(settle = false) {
      const timeline = gsap.timeline();

      if (settle) {
        gsap.set(items, { opacity: 1, y: 0 });
        return timeline;
      }

      return timeline.fromTo(
        items,
        { opacity: 0, y: 14 },
        {
          opacity: 1,
          y: 0,
          duration: seconds(DURATION.slow),
          ease: EASE.enter,
          stagger: seconds(0.08),
        },
      );
    },
  };
}
