import {
  BufferAttribute,
  BufferGeometry,
  Group,
  LineBasicMaterial,
  LineSegments,
  Mesh,
  MeshStandardMaterial,
  PlaneGeometry,
} from 'three';
import { SITE } from './site';

export interface Ground {
  readonly object: Group;
  dispose(): void;
}

/**
 * The site: a dark plane and a survey grid.
 *
 * The grid is not decoration. It establishes, before a word is spoken, that
 * this world is drawn rather than photographed — the same drawn register the
 * corridor's plan view resolves into in Act III. It extends past the fog's
 * reach so its edge is never visible; the grid appears to run to the horizon
 * because nothing ever shows it stopping.
 */
export function createGround(): Ground {
  const object = new Group();

  const planeGeometry = new PlaneGeometry(SITE.groundSize, SITE.groundSize);
  planeGeometry.rotateX(-Math.PI / 2);
  const planeMaterial = new MeshStandardMaterial({
    color: 0x0d1016,
    roughness: 0.96,
    metalness: 0,
  });
  const plane = new Mesh(planeGeometry, planeMaterial);
  plane.receiveShadow = true;
  object.add(plane);

  const gridGeometry = new BufferGeometry();
  gridGeometry.setAttribute('position', new BufferAttribute(gridSegments(), 3));
  const gridMaterial = new LineBasicMaterial({
    color: 0x35485c,
    transparent: true,
    opacity: 0.17,
  });
  const grid = new LineSegments(gridGeometry, gridMaterial);
  // Lifted clear of the plane: coplanar lines z-fight at grazing angles, which
  // is exactly the angle a standing camera sees the ground at.
  grid.position.y = 0.02;
  object.add(grid);

  return {
    object,
    dispose() {
      planeGeometry.dispose();
      planeMaterial.dispose();
      gridGeometry.dispose();
      gridMaterial.dispose();
    },
  };
}

function gridSegments(): Float32Array {
  const { gridSize, gridDivisions } = SITE;
  const half = gridSize / 2;
  const step = gridSize / gridDivisions;
  const out: number[] = [];

  for (let i = 0; i <= gridDivisions; i += 1) {
    const offset = -half + i * step;
    out.push(-half, 0, offset, half, 0, offset);
    out.push(offset, 0, -half, offset, 0, half);
  }

  return new Float32Array(out);
}
