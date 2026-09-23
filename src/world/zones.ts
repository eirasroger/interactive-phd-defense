import type { ZoneDefinition } from '@/engine/world/types';
import { corridorZone } from './corridor/CorridorZone';
import { exteriorZone } from './exterior/ExteriorZone';

/** Zone registry. A scene names a zone by id and the engine resolves it here. */
const registry: Record<string, ZoneDefinition> = {
  [exteriorZone.id]: exteriorZone,
  [corridorZone.id]: corridorZone,
};

export function zoneFor(id: string): ZoneDefinition {
  const zone = registry[id];
  if (!zone) throw new Error(`Unknown zone: ${id}`);
  return zone;
}
