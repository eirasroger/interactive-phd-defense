import { Color, Matrix4, type InstancedMesh } from 'three';

/**
 * Material-name keywords that mark foliage. Everything else is graded as wood.
 * `twig` is included because Poly Haven conifers put the needles on it.
 */
const FOLIAGE = [
  'leaf', 'leaves', 'needle', 'foliage', 'canopy', 'frond', 'twig',
  'shrub', 'grass', 'bush', 'hedge', 'fern', 'plant', 'celandine', 'nettle',
  'periwinkle', 'branches',
];

/** Maximum lightness and hue offset either side of the authored colour. */
const FOLIAGE_VALUE = 0.17;
const FOLIAGE_HUE = 0.022;
const WOOD_VALUE = 0.07;

/**
 * Gives each plant instance a small lightness and hue shift so repeated
 * species do not look identical. Uses `instanceColor`, so there is no per-frame
 * cost. Seeded from position, so every run looks the same (as in `horizon.ts`).
 */
export function applyVariance(meshes: readonly InstancedMesh[]): void {
  const matrix = new Matrix4();
  const color = new Color();

  for (const mesh of meshes) {
    const leafy = isFoliage(nameOf(mesh));
    const value = leafy ? FOLIAGE_VALUE : WOOD_VALUE;
    const hue = leafy ? FOLIAGE_HUE : 0;

    for (let index = 0; index < mesh.count; index += 1) {
      mesh.getMatrixAt(index, matrix);
      const noise = hash(matrix.elements[12], matrix.elements[14]);

      // Multiplies the texture (1 = as authored). Skewed slightly dark because
      // sunlit foliage is already near the top of its range.
      const lightness = 1 + (noise.a * 2 - 1) * value - value * 0.25;

      color.setRGB(lightness, lightness, lightness);
      if (hue > 0) {
        // Shifts between yellow-green and blue-green, the natural foliage axis.
        const shift = (noise.b * 2 - 1) * hue;
        color.offsetHSL(shift, 0, 0);
      }

      mesh.setColorAt(index, color);
    }

    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }
}

function nameOf(mesh: InstancedMesh): string {
  const material = Array.isArray(mesh.material) ? mesh.material[0] : mesh.material;
  return (material?.name ?? '').toLowerCase();
}

function isFoliage(name: string): boolean {
  return FOLIAGE.some((hint) => name.includes(hint));
}

/** Two uncorrelated values in 0-1 from a world position. */
function hash(x: number, z: number): { a: number; b: number } {
  const a = Math.sin(x * 12.9898 + z * 78.233) * 43758.5453;
  const b = Math.sin(x * 39.3468 + z * 11.135) * 24634.6345;
  return { a: a - Math.floor(a), b: b - Math.floor(b) };
}
