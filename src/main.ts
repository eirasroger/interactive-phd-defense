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

// Added to the stage so the UI scales and letterboxes with the slide.
stage.append(progress.element, loading.element, diagnostics.element, contextNotice.element);

// Added to the viewport so it stays readable when the stage is scaled down.
viewport.append(createOrientationNotice());

if (!supportsWebGL) {
  // Degrade quietly: text scenes still work without WebGL.
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
  // Dev-only handles. `__engine` exposes the engine for inspection. `__time`
  // scales GSAP's global timeline to slow transitions down for review. The
  // render loop runs on GSAP's ticker, so frame rate is unaffected.
  (globalThis as { __engine?: Engine }).__engine = engine;
  (globalThis as { __time?: (scale: number) => void }).__time = (scale: number) => {
    gsap.globalTimeline.timeScale(scale);
  };
}
