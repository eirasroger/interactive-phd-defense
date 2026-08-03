import { Color, Matrix4, type InstancedMesh } from 'three';

/**
 * Words that mark a material as leaf rather than as wood.
 *
 * `twig` belongs here despite the name: on Poly Haven's conifers the twig
 * material carries the needles, and it is the largest foliage surface on the
 * tree. Bark, trunk and dead branches are wood and are graded far less — a
 * trunk that varies as much as a canopy stops reading as timber.
 */
const FOLIAGE = [
  'leaf', 'leaves', 'needle', 'foliage', 'canopy', 'frond', 'twig',
  'shrub', 'grass', 'bush', 'hedge', 'fern', 'plant', 'celandine', 'nettle',
  'periwinkle', 'branches',
];

/** How far foliage lightness and hue are allowed to wander, either side. */
const FOLIAGE_VALUE = 0.17;
const FOLIAGE_HUE = 0.022;
const WOOD_VALUE = 0.07;

/**
 * Breaks the uniform green, which is the second-loudest tell after stillness.
 *
 * Every instance of a species currently draws the identical texture at the
 * identical tint, so a bed of forty ferns is one fern reprinted forty times.
 * The eye does not read that as forty plants; it reads it as a repeated
 * texture, and it finds the repeat immediately at any distance.
 *
 * Real planting varies because individual plants differ in age, aspect and how
 * much sun they get. A per-instance shift in lightness and a much smaller one
 * in hue reproduces that for the cost of one colour buffer, and it costs
 * nothing per frame — `instanceColor` multiplies into the diffuse term in the
 * shader three.js already compiled.
 *
 * **Deterministic, seeded from the instance's own position.** A defence is
 * rehearsed, and anything that differs between run-throughs is something the
 * speaker has to absorb mid-sentence. Same reasoning as the far field in
 * `horizon.ts`.
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
      // Seeded from where the plant stands, so the same plant is the same
      // colour on every run and neighbours are uncorrelated.
      const noise = hash(matrix.elements[12], matrix.elements[14]);

      // Multiplied into the texture, so 1 is the material as authored. Skewed
      // slightly dark: sunlit foliage is already at the top of its range and
      // brightening it further flattens the canopy into a single pale mass.
      const lightness = 1 + (noise.a * 2 - 1) * value - value * 0.25;

      color.setRGB(lightness, lightness, lightness);
      if (hue > 0) {
        // Toward yellow-green one way and blue-green the other, which is the
        // axis real foliage varies along. Shifting saturation instead would
        // make individual plants look diseased rather than merely different.
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

/** Two uncorrelated values in 0..1 from a world position. */
function hash(x: number, z: number): { a: number; b: number } {
  const a = Math.sin(x * 12.9898 + z * 78.233) * 43758.5453;
  const b = Math.sin(x * 39.3468 + z * 11.135) * 24634.6345;
  return { a: a - Math.floor(a), b: b - Math.floor(b) };
}
