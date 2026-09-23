import type { AssetEntry } from '@/engine/assets/AssetLoader';
import corridorShellUrl from './models/corridor-shell.glb?url';
import corridorCeilingUrl from './models/corridor-ceiling.glb?url';
import exteriorBuildingUrl from './models/exterior-building.glb?url';
import exteriorConstructionUrl from './models/exterior-construction.glb?url';
import exteriorDoorsUrl from './models/exterior-doors.glb?url';
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
import riverbedTextureUrl from './textures/riverbed.jpg?url';
import gravelTextureUrl from './textures/gravel.jpg?url';

/**
 * Every loadable asset, by stable id. URLs come from Vite `?url` imports so the
 * build handles hashing and the GitHub Pages base path.
 */
export const manifest: readonly AssetEntry[] = [
  { id: 'corridorShell', url: corridorShellUrl, kind: 'model' },
  // Separate from the shell because its panels animate during the rise.
  { id: 'corridorCeiling', url: corridorCeilingUrl, kind: 'model' },
  { id: 'exteriorBuilding', url: exteriorBuildingUrl, kind: 'model' },
  { id: 'exteriorConstruction', url: exteriorConstructionUrl, kind: 'model' },
  // The two sliding door leaves, separate because they move. 142 KB.
  { id: 'exteriorDoors', url: exteriorDoorsUrl, kind: 'model' },
  { id: 'facadeCandidates', url: facadeCandidatesUrl, kind: 'model' },
  { id: 'facadeSlotFill', url: facadeSlotFillUrl, kind: 'model' },
  { id: 'exteriorPlanting', url: exteriorPlantingUrl, kind: 'model' },
  { id: 'parkAssets', url: parkAssetsUrl, kind: 'model' },
  { id: 'grassTexture', url: grassTextureUrl, kind: 'texture' },
  { id: 'meadowTexture', url: meadowTextureUrl, kind: 'texture' },
  { id: 'soilTexture', url: soilTextureUrl, kind: 'texture' },
  // Stream bed ground layer, visible through the depth-absorbing water.
  { id: 'riverbedTexture', url: riverbedTextureUrl, kind: 'texture' },
  // Paving per `world_design.md` §2.2: clay in the park, granite at the
  // building, cobble gutters along planting edges.
  { id: 'clayTexture', url: clayTextureUrl, kind: 'texture' },
  { id: 'graniteTexture', url: graniteTextureUrl, kind: 'texture' },
  { id: 'cobbleTexture', url: cobbleTextureUrl, kind: 'texture' },
  // Surface for the entrance planting beds.
  { id: 'gravelTexture', url: gravelTextureUrl, kind: 'texture' },
  // Paving normal maps. Required so the joints catch the light.
  { id: 'clayNormal', url: clayNormalUrl, kind: 'texture' },
  { id: 'graniteNormal', url: graniteNormalUrl, kind: 'texture' },
  { id: 'cobbleNormal', url: cobbleNormalUrl, kind: 'texture' },
];
