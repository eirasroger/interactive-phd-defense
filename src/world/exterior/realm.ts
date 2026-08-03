import {
  BoxGeometry,
  Group,
  Mesh,
  MeshStandardMaterial,
  RepeatWrapping,
  SRGBColorSpace,
  type Texture,
} from 'three';
import { REALM } from './site';

export interface Realm {
  readonly object: Group;
  dispose(): void;
}

export interface RealmTextures {
  readonly paving: Texture;
  readonly soil: Texture;
}

interface Band {
  readonly name: string;
  readonly texture: 'paving' | 'soil';
  /** Half-width in X, and the near and far +Z edges of the band. */
  readonly halfWidth: number;
  readonly near: number;
  readonly far: number;
  readonly offsetX?: number;
  readonly height: number;
}

/** How many metres of ground one tile of each texture covers. */
const TILE = { paving: 2.4, soil: 2.0 } as const;

const BED_WIDTH = REALM.halfWidth - REALM.pathHalfWidth;

/**
 * The paved public realm the building stands in.
 *
 * Bands rather than a single slab, because the materials change across them and
 * because the promenade has to be a nameable thing — nothing is allowed to be
 * planted in it, and that rule is only enforceable if the band exists.
 *
 * Each band is a thin box rather than a plane so its edge reads at grazing
 * angles, which is the angle every Act I camera sees the ground at. Adjacent
 * bands abut rather than overlap: coplanar faces z-fight, and at this scale the
 * artefact reads as a hole in the ground rather than as flicker.
 */
const BANDS: readonly Band[] = [
  {
    name: 'forecourt',
    texture: 'paving',
    halfWidth: REALM.halfWidth,
    near: -8,
    far: REALM.forecourtFar,
    height: 0.12,
  },
  {
    name: 'bed_west',
    texture: 'soil',
    halfWidth: BED_WIDTH / 2,
    offsetX: -(REALM.pathHalfWidth + BED_WIDTH / 2),
    near: REALM.bedNear,
    far: REALM.forecourtFar,
    height: 0.16,
  },
  {
    name: 'bed_east',
    texture: 'soil',
    halfWidth: BED_WIDTH / 2,
    offsetX: REALM.pathHalfWidth + BED_WIDTH / 2,
    near: REALM.bedNear,
    far: REALM.forecourtFar,
    height: 0.16,
  },
  {
    name: 'promenade',
    texture: 'paving',
    halfWidth: REALM.run / 2,
    near: REALM.forecourtFar,
    far: REALM.promenadeFar,
    height: 0.12,
  },
  {
    name: 'verge_west',
    texture: 'soil',
    halfWidth: 43,
    offsetX: -62,
    near: REALM.promenadeFar,
    far: REALM.vergeFar,
    height: 0.14,
  },
  {
    name: 'verge_east',
    texture: 'soil',
    halfWidth: 43,
    offsetX: 62,
    near: REALM.promenadeFar,
    far: REALM.vergeFar,
    height: 0.14,
  },
];

/** Every band sits on the same finished level, whatever its own thickness. */
const SURFACE = 0.08;

export function createRealm(textures: RealmTextures): Realm {
  const object = new Group();
  const materials: MeshStandardMaterial[] = [];
  const geometries: BoxGeometry[] = [];

  for (const band of BANDS) {
    const width = band.halfWidth * 2;
    const depth = band.far - band.near;

    const geometry = new BoxGeometry(width, band.height, depth);
    geometries.push(geometry);

    const material = standard(textures[band.texture], TILE[band.texture], width, depth, band.name);
    materials.push(material);

    const mesh = new Mesh(geometry, material);
    mesh.name = band.name;
    mesh.position.set(band.offsetX ?? 0, SURFACE - band.height / 2, (band.near + band.far) / 2);
    mesh.receiveShadow = true;
    mesh.castShadow = false;
    object.add(mesh);
  }

  return {
    object,
    dispose() {
      for (const geometry of geometries) geometry.dispose();
      for (const material of materials) {
        material.map?.dispose();
        material.dispose();
      }
    },
  };
}

/**
 * Tiled in world metres.
 *
 * A box's UVs run 0 to 1 across each face whatever the face measures, so the
 * repeat has to be derived from the band's own dimensions — one material per
 * band. Sharing a material between bands of different sizes would tile the
 * 50 m forecourt and the 600 m promenade at the same rate, which reads as two
 * different pavings. Cloning the texture shares the decoded image, so the extra
 * materials cost almost nothing.
 */
function standard(
  source: Texture,
  tile: number,
  width: number,
  depth: number,
  name: string,
): MeshStandardMaterial {
  const texture = source.clone();
  texture.name = name;
  texture.wrapS = RepeatWrapping;
  texture.wrapT = RepeatWrapping;
  texture.colorSpace = SRGBColorSpace;
  texture.repeat.set(width / tile, depth / tile);
  texture.needsUpdate = true;

  return new MeshStandardMaterial({ map: texture, roughness: 0.94, metalness: 0 });
}
