import {
  Group,
  Mesh,
  MeshStandardMaterial,
  PlaneGeometry,
  RepeatWrapping,
  SRGBColorSpace,
  type Texture,
} from 'three';
import { SITE } from './site';

export interface Ground {
  readonly object: Group;
  dispose(): void;
}

/**
 * The parkland the building stands in.
 *
 * A survey grid used to be drawn over this, to say before a word was spoken
 * that the world is drawn rather than photographed. It is gone: at the grazing
 * angles a standing camera reads the ground at, a regular line grid over a
 * tiled texture reads as a wireframe mesh showing through the grass, which is
 * the opposite of what it was for. If the drawn register is wanted back it
 * belongs somewhere it cannot be mistaken for a rendering fault.
 *
 * Two tiles at different scales, rotated against each other. One tiled texture
 * over a 900 m plane repeats often enough to beat against the pixel grid and
 * produce exactly the regular squares the grid was blamed for; a second, larger
 * and turned off-axis, breaks that period without a second texture download.
 */
export function createGround(grass: Texture): Ground {
  const object = new Group();

  const base = layer(grass, SITE.groundSize / 2.5, 0, 1, 0);
  object.add(base.mesh);

  // Lifted a hair and multiplied over the base, so it modulates rather than
  // replaces. Coplanar would z-fight at exactly the angles this is here to fix.
  const breakup = layer(grass, SITE.groundSize / 17, Math.PI / 5, 0.35, 0.03);
  object.add(breakup.mesh);

  return {
    object,
    dispose() {
      base.dispose();
      breakup.dispose();
    },
  };
}

function layer(grass: Texture, repeat: number, rotation: number, opacity: number, lift: number) {
  const geometry = new PlaneGeometry(SITE.groundSize, SITE.groundSize);
  geometry.rotateX(-Math.PI / 2);

  const texture = grass.clone();
  texture.wrapS = RepeatWrapping;
  texture.wrapT = RepeatWrapping;
  texture.colorSpace = SRGBColorSpace;
  texture.repeat.set(repeat, repeat);
  texture.center.set(0.5, 0.5);
  texture.rotation = rotation;
  texture.needsUpdate = true;

  const material = new MeshStandardMaterial({
    map: texture,
    roughness: 0.97,
    metalness: 0,
    transparent: opacity < 1,
    opacity,
    depthWrite: opacity >= 1,
  });

  const mesh = new Mesh(geometry, material);
  mesh.position.y = lift;
  mesh.receiveShadow = opacity >= 1;

  return {
    mesh,
    dispose() {
      geometry.dispose();
      texture.dispose();
      material.dispose();
    },
  };
}
