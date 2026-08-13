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
 * How long the leaves take to clear the opening.
 *
 * Slower than the move that carries the camera through them, deliberately. A
 * public entrance takes about this long and the ear knows it; a door that
 * snaps open reads as a lid, and one that takes four seconds reads as a set
 * piece. The travel is only 2.1 m, so the *duration* is doing all the work of
 * making it look powered rather than thrown.
 */
const TRAVEL_SECONDS = 2.0;

/**
 * Which leaf leads.
 *
 * Nothing mechanical requires the pair to be asynchronous and real doors are
 * not. This is 90 ms, which is under the threshold at which the two read as
 * separate events and over the one at which they read as a single mirrored
 * object — and a perfect mirror is the tell that turns a door into an
 * animation.
 */
const LEAF_STAGGER = 0.09;

/** Warm, and matched to `WASH_COLOR` in the Blender script. */
const WASH_COLOR = 0xffe0b8;

/** Cool, matched to `GLOW_COLOR`. Two temperatures in one frame say two spaces. */
const GLOW_COLOR = 0xb8ccff;

export interface Entrance {
  readonly object: Object3D;
  /** 0 shut, 1 parked over the sidelights. */
  open(fraction: number, seconds: number): void;
  seal(sealed: boolean): void;
  dispose(): void;
}

/**
 * The sliding leaves, and the light in the room behind them.
 *
 * **The leaves are their own asset because the building is one joined mesh.**
 * `join_all` welds every part of an export into a single object, so a door left
 * in the building's own geometry is unreachable however carefully it was named
 * — which is what `docs/blender/exterior_building.md` claimed the runtime could
 * do for as long as it was not true.
 *
 * **The lights are here because emissive geometry is not a light.** The wash
 * slots and the recess strip are modelled and exported, and they illuminate
 * nothing in three.js; in Cycles they are what lights the whole room. Without
 * these three the vestibule is hemisphere ambient times a near-black occlusion
 * bake, which is a flat grey box — and the flatness would be most visible in
 * exactly the frame the rebuild exists for.
 *
 * Three point lights rather than two area lights, and that is a frame-budget
 * call rather than a quality one. A `RectAreaLight` is the right instrument for
 * a 7.8 m ceiling slot, but three.js compiles its LTC path into *every*
 * standard material in the scene — the terrain, the water, four hundred
 * woodland impostors — to light one room that is off screen for most of the
 * act. Points are local, and their falloff is most of what the wash is for.
 */
export function createEntrance(gltf: GLTF): Entrance {
  const object = new Group();
  object.name = 'entrance';

  // Sorted by name rather than trusting export order: `door_left` and
  // `door_right` have to be told apart, and which way each slides is the whole
  // behaviour. `findParts` asserts the count, so a leaf lost in a re-export is
  // a message rather than a door that opens one way.
  const parts = findParts(gltf, 2).sort((a, b) => a.name.localeCompare(b.name));
  const leaves = parts.map((part) => createBakedPart(part));
  for (const leaf of leaves) object.add(leaf.object);

  // Sorted, so index 0 is `door_left` and travels −x.
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

      // Scaled, so a viewer who has asked for reduced motion gets doors that
      // are simply open rather than doors that slide at the same speed while
      // everything around them has stopped.
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
          // Powered, not thrown: a slider accelerates hard, runs, and is
          // brought up short against its stop by the operator rather than by
          // easing out of its own accord.
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
 * Two warm sources under the ceiling slots, and one cool one deep in the recess.
 *
 * Placed at the slots rather than at the room's centre, because what has to
 * read is light *coming from somewhere* — a lamp in the middle of a box lights
 * every wall equally, which is the same flatness as no lamp at all.
 */
function createVestibuleLights(): Group {
  const group = new Group();
  group.name = 'vestibule:lights';

  const centre = VESTIBULE.front - VESTIBULE.depth / 2;
  const ceiling = VESTIBULE.height - 0.15;
  const inset = VESTIBULE.width / 2 - VESTIBULE.washInset;

  // Read against the exterior's own exposure, not against a dark room: for the
  // whole approach and most of the way through the doors the atmosphere is
  // still the forecourt's, so a level set to look right in isolation blows out
  // in the frame that actually matters.
  for (const side of [-1, 1]) {
    const wash = new PointLight(new Color(WASH_COLOR), 22, 15, 2);
    wash.position.set(side * inset, ceiling, centre);
    group.add(wash);
  }

  // Under the concealed strip at the far end, not at the recess mouth. It is
  // the gradient down the recess's own walls that reads as distance; a light at
  // the mouth would light the near end and flatten the very thing it is for.
  const glow = new PointLight(new Color(GLOW_COLOR), 5, 9, 2);
  glow.position.set(
    0,
    VESTIBULE.recess.height - 0.2,
    VESTIBULE_BACK - VESTIBULE.recess.depth + 0.55,
  );
  group.add(glow);

  return group;
}
