import gsap from 'gsap';
import {
  BoxGeometry,
  Color,
  Group,
  LinearSRGBColorSpace,
  Mesh,
  MeshStandardMaterial,
  PointLight,
  type Object3D,
} from 'three';
import type { GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { seconds as scaled } from '@/animations/timing';
import { createBakedPart, findParts } from './building';
import { ENTRANCE, VESTIBULE, VESTIBULE_BACK } from './site';

/**
 * Seconds for the leaves to open. Slower than the camera move through them, to
 * match a real powered door over the 2.1 m travel.
 */
const TRAVEL_SECONDS = 2.0;

/**
 * Delay in seconds before the second leaf moves. Small enough to look like one
 * event, large enough to avoid a perfectly mirrored motion.
 */
const LEAF_STAGGER = 0.09;

/** Must match `WASH_COLOR` in the Blender script. */
const WASH_COLOR = 0xffe0b8;

/** Must match `GLOW_COLOR` in the Blender script. */
const GLOW_COLOR = 0xb8ccff;

export interface Entrance {
  readonly object: Object3D;
  /** 0 shut, 1 parked over the sidelights. */
  open(fraction: number, seconds: number): void;
  seal(sealed: boolean): void;
  dispose(): void;
}

/**
 * The sliding door leaves and the vestibule lights.
 *
 * The leaves are a separate asset because `join_all` merges the building into
 * one mesh. The point lights stand in for the emissive slots, which light the
 * room in Cycles but emit nothing in three.js. Point lights are used because a
 * `RectAreaLight` adds its LTC code to every standard material in the scene.
 */
export function createEntrance(gltf: GLTF): Entrance {
  const object = new Group();
  object.name = 'entrance';

  // Sorted by name so `door_left` comes first; export order is unreliable.
  // `findParts` throws if a leaf is missing.
  const parts = findParts(gltf, 2).sort((a, b) => a.name.localeCompare(b.name));
  const leaves = parts.map((part) => createBakedPart(part));
  for (const leaf of leaves) object.add(leaf.object);

  // Index 0 is `door_left` and travels -x.
  const travel = [-ENTRANCE.sidelight, ENTRANCE.sidelight];

  const lights = createVestibuleLights();
  object.add(lights);

  const plug = createRecessPlug();
  object.add(plug);

  let fraction = 0;

  return {
    object,

    seal(sealed: boolean): void {
      plug.visible = sealed;
    },

    open(target: number, travelSeconds: number): void {
      if (target === fraction) return;
      fraction = target;

      // Scaled so reduced motion opens the doors instantly.
      const duration = scaled(travelSeconds);

      leaves.forEach((leaf, index) => {
        const x = (travel[index] ?? 0) * target;
        gsap.killTweensOf(leaf.object.position);

        if (duration <= 0) {
          leaf.object.position.x = x;
          return;
        }

        gsap.to(leaf.object.position, {
          x,
          duration,
          ease: 'power2.inOut',
          delay: scaled(index * LEAF_STAGGER),
        });
      });
    },

    dispose(): void {
      for (const leaf of leaves) {
        gsap.killTweensOf(leaf.object.position);
        leaf.dispose();
      }
      lights.traverse((child) => {
        if (child instanceof PointLight) child.dispose();
      });
      plug.geometry.dispose();
      (plug.material as MeshStandardMaterial).dispose();
    },
  };
}

export const ENTRANCE_TRAVEL_SECONDS = TRAVEL_SECONDS;
export const ENTRANCE_LEAF_STAGGER = LEAF_STAGGER;

/** Closes the bore through the building while the corridor is not there. */
function createRecessPlug(): Mesh {
  const { recess } = VESTIBULE;
  const plug = new Mesh(
    new BoxGeometry(recess.width + 0.1, recess.height + 0.1, 0.08),
    new MeshStandardMaterial({
      color: new Color().setRGB(0.085, 0.088, 0.098, LinearSRGBColorSpace),
      roughness: 0.9,
    }),
  );
  plug.name = 'vestibule:recess-plug';
  plug.position.set(0, recess.height / 2, VESTIBULE_BACK - recess.depth);
  return plug;
}

/**
 * Two warm lights under the ceiling slots and one cool light deep in the recess.
 * Placed at the slots so the walls light unevenly.
 */
function createVestibuleLights(): Group {
  const group = new Group();
  group.name = 'vestibule:lights';

  const centre = VESTIBULE.front - VESTIBULE.depth / 2;
  const ceiling = VESTIBULE.height - 0.15;
  const inset = VESTIBULE.width / 2 - VESTIBULE.washInset;

  // Intensity tuned under the exterior exposure, which stays active until the
  // camera is through the doors.
  for (const side of [-1, 1]) {
    const wash = new PointLight(new Color(WASH_COLOR), 22, 15, 2);
    wash.position.set(side * inset, ceiling, centre);
    group.add(wash);
  }

  // At the far end of the recess, so the walls brighten with depth.
  const glow = new PointLight(new Color(GLOW_COLOR), 5, 9, 2);
  glow.position.set(
    0,
    VESTIBULE.recess.height - 0.2,
    VESTIBULE_BACK - VESTIBULE.recess.depth + 0.55,
  );
  group.add(glow);

  return group;
}
