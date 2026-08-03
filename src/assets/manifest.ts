import type { AssetEntry } from '@/engine/assets/AssetLoader';
import assemblyUrl from './models/assembly.glb?url';
import corridorBayUrl from './models/corridor-bay.glb?url';
import exteriorBuildingUrl from './models/exterior-building.glb?url';
import exteriorConstructionUrl from './models/exterior-construction.glb?url';
import facadeCandidatesUrl from './models/facade-candidates.glb?url';
import exteriorPlantingUrl from './models/exterior-planting.glb?url';
import facadeSlotFillUrl from './models/facade-slot-fill.glb?url';
import grassTextureUrl from './textures/grass.jpg?url';
import pavingTextureUrl from './textures/paving.jpg?url';
import soilTextureUrl from './textures/soil.jpg?url';

/**
 * Every loadable asset, addressed by a stable id.
 *
 * URLs come from Vite asset imports rather than string paths so hashing and
 * base-path rewriting are handled at build time — which is what keeps the same
 * build working on a GitHub Pages subpath and from a local directory.
 */
export const manifest: readonly AssetEntry[] = [
  { id: 'assembly', url: assemblyUrl, kind: 'model' },
  { id: 'corridorBay', url: corridorBayUrl, kind: 'model' },
  { id: 'exteriorBuilding', url: exteriorBuildingUrl, kind: 'model' },
  { id: 'exteriorConstruction', url: exteriorConstructionUrl, kind: 'model' },
  { id: 'facadeCandidates', url: facadeCandidatesUrl, kind: 'model' },
  { id: 'facadeSlotFill', url: facadeSlotFillUrl, kind: 'model' },
  { id: 'exteriorPlanting', url: exteriorPlantingUrl, kind: 'model' },
  { id: 'grassTexture', url: grassTextureUrl, kind: 'texture' },
  { id: 'pavingTexture', url: pavingTextureUrl, kind: 'texture' },
  { id: 'soilTexture', url: soilTextureUrl, kind: 'texture' },
];
