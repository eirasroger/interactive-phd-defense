import type { SceneDefinition } from '@/engine/types';
import { ContextScene } from './context/ContextScene';
import { TitleScene } from './title/TitleScene';

/**
 * Ordered scene registry. Order here is the order of the talk; `id` is the
 * scene's permanent URL and should not change once shared.
 */
export const scenes: readonly SceneDefinition[] = [
  {
    id: 'title',
    title: 'Title',
    chapter: 'Opening',
    create: () => new TitleScene(),
  },
  {
    id: 'context',
    title: 'Research Context',
    chapter: 'Motivation',
    create: () => new ContextScene(),
  },
];
