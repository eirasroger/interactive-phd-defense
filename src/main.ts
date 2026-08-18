import '@/styles/base.css';
import '@/styles/stage.css';

import gsap from 'gsap';
import { manifest } from '@/assets/manifest';
import { createProgressIndicator } from '@/components/ProgressIndicator';
import {
  createContextNotice,
  createDiagnosticsOverlay,
  createLoadingScreen,
  createOrientationNotice,
} from '@/components/SystemOverlays';
import { Engine } from '@/engine/Engine';
import { qualityTier, supportsWebGL } from '@/engine/env';
import { scenes } from '@/scenes';

if (import.meta.env.DEV) {
  Object.assign(window as unknown as Record<string, unknown>, { __gsap: gsap });
}

const viewport = document.querySelector<HTMLElement>('#viewport');
const stage = document.querySelector<HTMLElement>('#stage');
const canvasLayer = document.querySelector<HTMLElement>('#canvas-layer');
const overlayLayer = document.querySelector<HTMLElement>('#overlay-layer');

if (!viewport || !stage || !canvasLayer || !overlayLayer) {
  throw new Error('Stage markup is missing #viewport, #stage, #canvas-layer or #overlay-layer.');
}

document.documentElement.dataset['quality'] = qualityTier;

const progress = createProgressIndicator();
const loading = createLoadingScreen();
const diagnostics = createDiagnosticsOverlay();
const contextNotice = createContextNotice();

// Inside the stage, not on the body: the chrome belongs to the composition and
// has to scale and letterbox with it rather than clinging to the window edges.
stage.append(progress.element, loading.element, diagnostics.element, contextNotice.element);

// On the viewport, not the stage: it reports that the stage is scaled too far
// down to read, so it cannot be subject to that scale itself.
viewport.append(createOrientationNotice());

if (!supportsWebGL) {
  // The talk still has to happen. Text scenes render without a renderer, so
  // failing loudly here would be worse than degrading quietly.
  document.documentElement.dataset['webgl'] = 'unavailable';
}

const engine = new Engine({
  container: canvasLayer,
  overlay: overlayLayer,
  scenes,
  manifest,
  onState: (state) => progress.update(state),
  onLoadingChange: (isLoading, value) => loading.set(isLoading, value),
  onDiagnostics: (fps, visible) => diagnostics.set(fps, visible),
  onContextLost: (lost) => contextNotice.set(lost),
});

engine.start();

if (import.meta.env.DEV) {
  // Dev-only handles, stripped from production builds.
  //
  // `__engine` inspects the scene graph and renderer counters. `__time` scales
  // GSAP's global timeline, which is how a transition gets *authored* rather
  // than guessed at: the entry into Act II is nine seconds of continuously
  // changing camera, doors and light, and at 1x the only way to look at any
  // given moment of it is to catch one. At 0.1 it can be watched.
  //
  // The render loop is GSAP's ticker and is not on the global timeline, so
  // slowing this slows the animation and leaves the frame rate alone.
  (globalThis as { __engine?: Engine }).__engine = engine;
  (globalThis as { __time?: (scale: number) => void }).__time = (scale: number) => {
    gsap.globalTimeline.timeScale(scale);
  };
}
