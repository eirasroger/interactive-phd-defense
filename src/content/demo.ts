import type { CaptionContent } from '@/components/Caption';

/**
 * Placeholder copy for the architecture demo scenes.
 *
 * These exist to exercise the engine, not to present the research. They are
 * replaced wholesale once the narrative is locked.
 */

export const demoCaptions: Record<string, CaptionContent> = {
  origin: {
    eyebrow: 'Engine demo · 01',
    heading: 'A continuous world, not a deck of slides.',
    body: [
      'Every scene shares one persistent 3D environment. Navigation moves the camera through it rather than swapping pages.',
      'Use the arrow keys. Press D for diagnostics, F for fullscreen.',
    ],
    accent: 'circular',
  },
  assembly: {
    eyebrow: 'Engine demo · 02',
    heading: 'Assets authored in Blender, loaded on demand.',
    body: [
      'This assembly is generated procedurally by a bpy script and exported as a Draco-compressed GLB.',
      'Named layers are addressable from the web application, so exploded views are driven at runtime.',
    ],
    accent: 'ai',
  },
  flow: {
    eyebrow: 'Engine demo · 03',
    heading: 'Information flowing through a pipeline.',
    body: [
      'Procedural geometry and a particle stream stand in for the decision-support pipeline: data entering, being transformed, and leaving as structured output.',
    ],
    accent: 'ai',
  },
  field: {
    eyebrow: 'Engine demo · 04',
    heading: 'Uncertainty resolving into structure.',
    body: [
      'A scattered cloud converges into an ordered formation entirely on the GPU — the visual grammar for turning uncertainty into an informed recommendation.',
    ],
    accent: 'emphasis',
  },
};
