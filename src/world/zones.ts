import type { ZoneDefinition } from '@/engine/world/types';
import { corridorZone } from './corridor/CorridorZone';
import { exteriorZone } from './exterior/ExteriorZone';

/**
 * The zone registry.
 *
 * A scene names a zone; the engine resolves it here. Every zone in the deck now
 * carries built content: the demo zone that held an atmosphere and nothing else
 * went with the engine demos it was lighting.
 */
const registry: Record<string, ZoneDefinition> = {
  [exteriorZone.id]: exteriorZone,
  [corridorZone.id]: corridorZone,
};

export function zoneFor(id: string): ZoneDefinition {
  const zone = registry[id];
  if (!zone) throw new Error(`Unknown zone: ${id}`);
  return zone;
}
