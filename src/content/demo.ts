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
  c1: {
    eyebrow: 'Corridor · C1',
    heading: 'Arriving at the corridor.',
    body: [
      'The geometry and the lighting both come from Blender: ribs and chamfers are modifier output, and every shadow you can see was baked in Cycles.',
      'The web material is unlit. This corridor costs one texture and zero lights per frame.',
    ],
    accent: 'ai',
  },
  c2: {
    eyebrow: 'Corridor · C2',
    heading: 'Inside the first bay.',
    body: [
      'Bounce light off the walls, contact shadow under every rib, and blue spill from the accent strips — none of which a real-time light can produce.',
    ],
    accent: 'ai',
  },
  c3: {
    eyebrow: 'Corridor · C3',
    heading: 'One bay, instanced.',
    body: [
      'The same 1 350 polygons are drawn five times in a single draw call. Length is free; only the walk through it costs anything.',
    ],
    accent: 'ai',
  },
  c4: {
    eyebrow: 'Corridor · C4',
    heading: 'Camera poses follow the geometry.',
    body: [
      'Station positions and camera poses are generated from one set of constants, so moving a station moves the walk with it.',
    ],
    accent: 'emphasis',
  },
  c5: {
    eyebrow: 'Corridor · C5',
    heading: 'The far end.',
    body: [
      'Fog closes behind and ahead. The corridor is a place the talk moves through rather than a picture of one.',
    ],
    accent: 'emphasis',
  },
};
