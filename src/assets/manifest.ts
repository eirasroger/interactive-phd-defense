import type { AssetEntry } from '@/engine/assets/AssetLoader';
import assemblyUrl from './models/assembly.glb?url';
import corridorBayUrl from './models/corridor-bay.glb?url';
import exteriorBuildingUrl from './models/exterior-building.glb?url';
import exteriorConstructionUrl from './models/exterior-construction.glb?url';
import facadeCandidatesUrl from './models/facade-candidates.glb?url';
import exteriorPlantingUrl from './models/exterior-planting.glb?url';
import parkAssetsUrl from './models/park-assets.glb?url';
import facadeSlotFillUrl from './models/facade-slot-fill.glb?url';
import clayTextureUrl from './textures/clay.jpg?url';
import clayNormalUrl from './textures/clay-normal.jpg?url';
import cobbleTextureUrl from './textures/cobble.jpg?url';
import cobbleNormalUrl from './textures/cobble-normal.jpg?url';
import graniteTextureUrl from './textures/granite.jpg?url';
import graniteNormalUrl from './textures/granite-normal.jpg?url';
import grassTextureUrl from './textures/grass.jpg?url';
import meadowTextureUrl from './textures/meadow.jpg?url';
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
  { id: 'parkAssets', url: parkAssetsUrl, kind: 'model' },
  { id: 'grassTexture', url: grassTextureUrl, kind: 'texture' },
  { id: 'meadowTexture', url: meadowTextureUrl, kind: 'texture' },
  { id: 'soilTexture', url: soilTextureUrl, kind: 'texture' },
  // The paving split from `world_design.md` §2.2: red clay in the park, grey
  // granite at the building, a cobble gutter against the planting at every edge.
  { id: 'clayTexture', url: clayTextureUrl, kind: 'texture' },
  { id: 'graniteTexture', url: graniteTextureUrl, kind: 'texture' },
  { id: 'cobbleTexture', url: cobbleTextureUrl, kind: 'texture' },
  // Normals for the three, and they are not optional dressing. Paving whose
  // joints live only in the albedo is a photograph of paving: nothing on it
  // ever catches the light, so the avenue read as a sheet of flat red whatever
  // the tiling or the resolution.
  { id: 'clayNormal', url: clayNormalUrl, kind: 'texture' },
  { id: 'graniteNormal', url: graniteNormalUrl, kind: 'texture' },
  { id: 'cobbleNormal', url: cobbleNormalUrl, kind: 'texture' },
];
