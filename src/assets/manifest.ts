import type { AssetEntry } from '@/engine/assets/AssetLoader';
import assemblyUrl from './models/assembly.glb?url';
import corridorBayUrl from './models/corridor-bay.glb?url';
import exteriorBuildingUrl from './models/exterior-building.glb?url';

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
];
