import type { SceneState } from '@/engine/scene/SceneDirector';
import { el } from '@/utilities/dom';
import './progress-indicator.css';

export interface ProgressIndicator {
  readonly element: HTMLElement;
  update(state: SceneState): void;
}

/**
 * Minimal orientation cue: which chapter, how far through. Deliberately quiet
 * so it never competes with the content.
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
      const ratio = state.total > 1 ? state.index / (state.total - 1) : 1;
      fill.style.transform = `scaleX(${ratio})`;
    },
  };
}
