import type { SceneState } from '@/engine/scene/SceneDirector';
import { el } from '@/utilities/dom';
import './progress-indicator.css';

export interface ProgressIndicator {
  readonly element: HTMLElement;
  update(state: SceneState): void;
}

/**
 * Orientation cue: which section of the thesis, how far through. It names the
 * argument rather than the staging, so `chapter` carries the section the
 * audience is being walked through and never the act it is staged in.
 */
export function createProgressIndicator(): ProgressIndicator {
  const chapter = el('span', { className: 'progress-chapter' });
  const position = el('span', { className: 'progress-position' });
  const fill = el('span', { className: 'progress-fill' });
  const track = el('div', { className: 'progress-track', children: [fill] });

  const element = el('div', {
    className: 'progress-indicator',
    attrs: { role: 'status', 'aria-live': 'polite' },
    children: [chapter, track, position],
  });

  return {
    element,
    update(state) {
      chapter.textContent = state.definition.chapter;
      position.textContent = `${state.index + 1} / ${state.total}`;

      // Beats advance the bar within the scene's own span.
      const within = state.beats > 1 ? state.beat / state.beats : 0;
      const ratio = state.total > 1 ? (state.index + within) / (state.total - 1) : 1;
      fill.style.transform = `scaleX(${Math.min(ratio, 1)})`;
    },
  };
}
