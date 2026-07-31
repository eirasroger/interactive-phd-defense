export type NavDirection = 'forward' | 'backward' | 'jump';

export type FrameHandler = (dt: number, elapsed: number) => void;

/**
 * Handed to a scene on entry. Everything registered through it is torn down
 * automatically when the scene exits, so scenes cannot leak listeners.
 */
export interface SceneContext {
  /** The scene's own DOM layer. Removed after exit. */
  readonly root: HTMLElement;
  /** Aborted when the scene exits. Pass to addEventListener, fetch, etc. */
  readonly signal: AbortSignal;
  /** Per-frame callback, unsubscribed on exit. */
  onFrame(handler: FrameHandler): void;
}

export interface Scene {
  enter(context: SceneContext, direction: NavDirection): void;
  exit?(direction: NavDirection): void;
}

export interface SceneDefinition {
  /** URL slug. Stable: it is the shareable address of this scene. */
  readonly id: string;
  readonly title: string;
  /** Narrative section, used for orientation in the progress indicator. */
  readonly chapter: string;
  create(): Scene;
}
