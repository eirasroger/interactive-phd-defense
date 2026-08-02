import '@/styles/base.css';
import '@/styles/stage.css';

import { manifest } from '@/assets/manifest';
import { createProgressIndicator } from '@/components/ProgressIndicator';
import {
  createContextNotice,
  createDiagnosticsOverlay,
  createLoadingScreen,
} from '@/components/SystemOverlays';
import { Engine } from '@/engine/Engine';
import { qualityTier, supportsWebGL } from '@/engine/env';
import { scenes } from '@/scenes';

const canvasLayer = document.querySelector<HTMLElement>('#canvas-layer');
const overlayLayer = document.querySelector<HTMLElement>('#overlay-layer');

if (!canvasLayer || !overlayLayer) {
  throw new Error('Stage markup is missing #canvas-layer or #overlay-layer.');
}

document.documentElement.dataset['quality'] = qualityTier;

const progress = createProgressIndicator();
const loading = createLoadingScreen();
const diagnostics = createDiagnosticsOverlay();
const contextNotice = createContextNotice();

document.body.append(
  progress.element,
  loading.element,
  diagnostics.element,
  contextNotice.element,
);

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
  // Dev-only handle for inspecting the scene graph and renderer counters
  // from the console. Stripped from production builds.
  (globalThis as { __engine?: Engine }).__engine = engine;
}
