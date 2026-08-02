import { ZONE_ORIGIN } from '@/config/layout';
import type { ZoneDefinition } from '@/engine/world/types';
import { exteriorZone } from './exterior/ExteriorZone';

/**
 * The zone registry.
 *
 * A scene names a zone; the engine resolves it here. Zones with no built
 * content declare an atmosphere and nothing else — which is all the engine
 * demos need, and is how they keep the lighting they were tuned against now
 * that lighting is per-zone rather than global.
 */
const demoZone: ZoneDefinition = {
  id: 'demo',
  origin: ZONE_ORIGIN.demo,
  atmosphere: {
    fogColor: 0x0a0c10,
    fogNear: 18,
    fogFar: 120,
    skyColor: 0xdfe8ff,
    groundColor: 0x0a0c10,
    ambientIntensity: 0.45,
    keyColor: 0xffffff,
    keyIntensity: 1.5,
    keyOffset: [6, 12, 8],
    environmentIntensity: 0.35,
    backgroundIntensity: 1,
    exposure: 0.95,
  },
  shadow: { radius: 5, far: 60 },
};

const registry: Record<string, ZoneDefinition> = {
  [exteriorZone.id]: exteriorZone,
  [demoZone.id]: demoZone,
};

export function zoneFor(id: string): ZoneDefinition {
  const zone = registry[id];
  if (!zone) throw new Error(`Unknown zone: ${id}`);
  return zone;
}
