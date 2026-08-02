import { Mesh, MeshBasicMaterial, type MeshStandardMaterial, type Object3D, type Texture } from 'three';
import type { GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';

export interface Building {
  readonly object: Object3D;
  /**
   * How specified the design is, 0 to 1.
   *
   * 0 is the study model: the same forms in white card, lit but unspecified.
   * 1 is the built building — concrete, glazing, warm interiors. The distance
   * between them is the Act I argument, that a building's material trajectory
   * is fixed while almost nothing about it has been decided.
   */
  setSpecification(value: number): void;
  dispose(): void;
}

const clamp01 = (value: number): number => Math.min(Math.max(value, 0), 1);

/**
 * The exterior, as two baked lighting states over one geometry.
 *
 * Both bakes come from `tools/blender/exterior_building.py` and ride in a
 * single GLB — the specified state in the base colour slot, the card state in
 * the emissive slot, which is the only way glTF carries two maps for one mesh.
 * Neither is used as lighting here: the material is unlit and mixes the two by
 * a uniform, so the whole transition costs one texture fetch and no second mesh.
 *
 * An unlit material is not a compromise. The bake holds bounce light, contact
 * shadow and ambient occlusion that no real-time light can reproduce; relighting
 * it would wash out exactly what it was run for. The building still casts a
 * real-time shadow onto the ground, because shadow casting reads depth and does
 * not care what the surface material is.
 */
export function createBuilding(gltf: GLTF): Building {
  const source = findMesh(gltf);
  const baked = source.material as MeshStandardMaterial;

  const specified = baked.map;
  const card = baked.emissiveMap;
  if (!specified || !card) {
    throw new Error('exteriorBuilding is missing one of its two baked maps.');
  }

  const specification = { value: 0 };
  const material = mixedMaterial(specified, card, specification);

  // Geometry belongs to the asset cache and is shared with every later visit,
  // so it is reused rather than cloned, and never disposed here.
  const object = new Mesh(source.geometry, material);
  object.castShadow = true;
  object.receiveShadow = false;

  return {
    object,
    setSpecification(value: number) {
      specification.value = clamp01(value);
    },
    dispose() {
      material.dispose();
    },
  };
}

function findMesh(gltf: GLTF): Mesh {
  let found: Mesh | null = null;
  gltf.scene.traverse((child) => {
    if (!found && (child as Mesh).isMesh) found = child as Mesh;
  });
  if (!found) throw new Error('exteriorBuilding contains no mesh.');
  return found;
}

/**
 * Unlit, fogged, and crossfading between the two bakes.
 *
 * `MeshBasicMaterial` is patched rather than replaced by a `ShaderMaterial` so
 * fog, tone mapping and colour management keep working exactly as they do
 * everywhere else in the world.
 */
function mixedMaterial(
  specified: Texture,
  card: Texture,
  specification: { value: number },
): MeshBasicMaterial {
  const material = new MeshBasicMaterial({ map: specified, fog: true });

  material.onBeforeCompile = (shader) => {
    shader.uniforms['uCard'] = { value: card };
    shader.uniforms['uSpecification'] = specification;

    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
        uniform sampler2D uCard;
        uniform float uSpecification;`,
      )
      .replace(
        '#include <map_fragment>',
        `vec4 specifiedTexel = texture2D( map, vMapUv );
        vec4 cardTexel = texture2D( uCard, vMapUv );
        diffuseColor *= mix( cardTexel, specifiedTexel, uSpecification );`,
      );
  };

  return material;
}
