import gsap from 'gsap';
import { Color, Group, Mesh, MeshStandardMaterial, Object3D, PointLight } from 'three';
import { RISE, ROOM, SECTION, STATIONS } from '@/config/corridor';
import { ZONE_ORIGIN } from '@/config/layout';
import type { Atmosphere } from '@/engine/render/atmosphere';
import type { ZoneContext, ZoneDefinition, ZoneInstance } from '@/engine/world/types';
import { sharpen } from '@/world/exterior/building';
import { createFlow, type Flow } from './Flow';
import { createPlanDrawing, type PlanDrawing } from './PlanDrawing';

export const SHELL_ASSET = 'corridorShell';
export const CEILING_ASSET = 'corridorCeiling';

export const CORRIDOR_ASSETS = [SHELL_ASSET, CEILING_ASSET] as const;

/** The bake travels in glTF's occlusion slot; `mount` rebinds it to `lightMap`. */
const LIGHTMAP = 0.85;

const COVE_GLOW = 0.45;

const COVE = {
  color: 0xffdcb4,
  intensity: 2.2,
  distance: 14,
  offset: SECTION.linkWidth / 2 - 0.3,
  height: SECTION.floor + 1.95,
};

/**
 * The ceiling coming off, in the order the camera needs it gone.
 *
 * The rise leaves from C5, so C5's lid goes first and the sequence runs back
 * toward the mouth ahead of the camera. It is the only rigged geometry in the
 * zone and the only thing that happens during the climb, which is what makes
 * the climb a beat rather than dead travel.
 *
 * They lift and then fade. Eleven slabs left hovering would be between the
 * camera and the plan at exactly the moment the figure has to be read.
 */
const CEILING = {
  travel: 1.4,
  fade: 0.7,
  step: 0.11,
  hold: 0.2,
} as const;

/**
 * The building draining to nothing, in the climb it happens inside.
 *
 * It starts late and finishes early. The first seconds are still a room being
 * left — the ceiling lifting off a lit gallery is the shot, and it needs the
 * gallery — and the last are the plan being read, which wants the change over
 * before the camera settles rather than resolving under the audience's eyes.
 */
const DRAIN = { delay: 0.7, seconds: 2.6 } as const;

/** What the shell is worth once the drawing is carrying the information. */
const VOID = new Color(0x05070a);

const CORRIDOR_ATMOSPHERE: Atmosphere = {
  fogColor: 0x1a1512,
  fogNear: 14,
  fogFar: 52,
  skyColor: 0xcbc3b4,
  groundColor: 0x241a12,
  ambientIntensity: 0.10,
  keyColor: 0xffeacb,
  keyIntensity: 0.7,
  keyOffset: [-14, 40, 34],
  environmentIntensity: 0.18,
  backgroundIntensity: 0,
  exposure: 0.72,
};

/**
 * The air the plan is read through.
 *
 * Fog sized for a corridor hides two thirds of a 75 m run seen from sixty
 * metres up, so it opens with the camera, and its colour goes from the warm
 * near-black of an interior to a cold one: what the camera climbs out into is
 * not a bigger room.
 *
 * Key and environment go **up**, which is counterintuitive for a shot that ends
 * on a drawing in the dark. They are paying for the middle of the climb, not
 * the end of it: the roof is eleven lids with nothing on them but sky, and
 * unlit they are black slabs against a black ground — the one event in the
 * whole move, invisible. By the time the camera arrives they are gone and the
 * shell is hidden, so what they cost there is nothing.
 */
export const opened = (base: Atmosphere): Atmosphere => ({
  ...base,
  fogColor: 0x1b242f,
  fogNear: 70,
  fogFar: 280,
  ambientIntensity: base.ambientIntensity * 1.5,
  keyIntensity: base.keyIntensity * 1.4,
  environmentIntensity: base.environmentIntensity * 1.3,
  // **The corridor draws its background at zero intensity**, because a museum
  // with no apertures never shows one, and the colour set above is multiplied
  // by it. Left at zero the whole of Act III sits on pure black however the fog
  // is coloured — the setting to change is not the one that names a colour.
  backgroundIntensity: 1,
});

function mount(source: Object3D): Object3D {
  const object = source.clone(true);
  object.traverse((child) => {
    const mesh = child as Mesh;
    if (!mesh.isMesh) return;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    for (const entry of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) {
      if (!(entry instanceof MeshStandardMaterial)) continue;
      if (entry.aoMap) {
        entry.lightMap = entry.aoMap;
        entry.lightMapIntensity = LIGHTMAP;
        entry.aoMap = null;
      }
      entry.envMapIntensity = 1;
      if (entry.name.startsWith('cove') || entry.name.startsWith('wash')) {
        entry.emissiveIntensity = COVE_GLOW;
      }
    }
  });
  return object;
}

/**
 * Materials arrive shared with the asset cache, and a lid has to be faded.
 *
 * Tweening opacity through a shared datablock would take the fade to whatever
 * else the cache hands out later — the same trap as baking several assets
 * against one material name (`learnings.md` §7c), one layer further down.
 */
function unshare(object: Object3D): MeshStandardMaterial[] {
  const owned: MeshStandardMaterial[] = [];
  object.traverse((child) => {
    const mesh = child as Mesh;
    if (!mesh.isMesh) return;
    const source = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    const copies = source.map((entry) => {
      if (!(entry instanceof MeshStandardMaterial)) return entry;
      const copy = entry.clone();
      owned.push(copy);
      return copy;
    });
    mesh.material = Array.isArray(mesh.material) ? copies : (copies[0] as MeshStandardMaterial);
  });
  return owned;
}

/** A shell material, and what it was before the drain took it. */
interface Skin {
  readonly material: MeshStandardMaterial;
  readonly color: Color;
  readonly lightMap: number;
  readonly emissive: number;
}

interface Lid {
  readonly object: Object3D;
  readonly rest: number;
  readonly materials: readonly MeshStandardMaterial[];
}

class Corridor implements ZoneInstance {
  private readonly root = new Group();
  private readonly lids: Lid[];
  private readonly lights: PointLight[] = [];
  private readonly flow: Flow;
  private readonly plan: PlanDrawing;
  private readonly shell: Object3D;
  private readonly skins: readonly Skin[];
  private readonly drain = { level: 0 };
  private closed = true;

  constructor(private readonly context: ZoneContext) {
    const { assets, quality, stage } = context;

    const shell = assets.model(SHELL_ASSET);
    const ceiling = assets.model(CEILING_ASSET);
    sharpen(shell, quality.anisotropy);
    sharpen(ceiling, quality.anisotropy);

    this.root.name = 'corridor';
    this.shell = mount(shell.scene);
    this.skins = unshare(this.shell).map((material) => ({
      material,
      color: material.color.clone(),
      lightMap: material.lightMapIntensity,
      emissive: material.emissiveIntensity,
    }));
    this.root.add(this.shell);

    this.lids = [...ceiling.scene.children]
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((panel) => {
        const object = mount(panel);
        return { object, rest: object.position.y, materials: unshare(object) };
      });
    if (this.lids.length === 0) throw new Error('corridor ceiling contains no panels.');
    for (const lid of this.lids) this.root.add(lid.object);

    this.flow = createFlow();
    this.plan = createPlanDrawing();
    this.root.add(this.flow.object, this.plan.object);

    this.lightEnfilade();
    stage.add(this.root);
  }

  /** Only the links carry lamps; every gallery's light is in the bake. */
  private lightEnfilade(): void {
    const half = ROOM.length / 2;
    const axis = [0, 1, 2, 4].map((index) => STATIONS[index]?.z ?? 0);
    const links: number[] = [(SECTION.nest + axis[0]! - half) / 2, axis[2]!];
    for (let index = 0; index + 1 < axis.length; index += 1) {
      links.push((axis[index]! + half + axis[index + 1]! - half) / 2);
    }

    for (const z of links) {
      this.lamp(COVE, 0, COVE.height, -z);
    }
  }

  private lamp(spec: { color: number; intensity: number; distance: number },
               x: number, y: number, z: number): void {
    const light = new PointLight(new Color(spec.color), spec.intensity, spec.distance, 2);
    light.position.set(x, y, z);
    this.root.add(light);
    this.lights.push(light);
  }

  /**
   * The open ceiling is the cue for everything the plan view shows.
   *
   * The pulse used to wait for a beat of its own and does not any more: the
   * overlook is one state, reached by one click and left by one click. Driving
   * it from progress rather than from a beat also means a jump into the scene,
   * or back to it from later in the deck, finds the pipeline running — the flow
   * has no idea it was ever navigated away from.
   */
  /**
   * A museum has no sky, and until now it borrowed the one outside.
   *
   * Background and environment are global and were installed by the exterior at
   * build time with nothing ever taking them down, so the corridor ran on a
   * dusk sky texture and an outdoor PMREM for the whole of Acts II and III. It
   * went unseen only because the corridor draws its background at zero
   * intensity — so the moment the overlook needed a background colour, Act III
   * came up behind a photograph of the sky.
   *
   * **On the handover, not on mount.** Cleared when the corridor became active
   * it fired at the *start* of the crossing, and the crossing begins with the
   * camera on the avenue looking at the whole building: the sky went flat and
   * every surface outside lost the light it was lit by, nine seconds before
   * anyone was indoors. `ZoneDirector` defers this to the release for exactly
   * the reason it defers the shadow rig.
   *
   * Clearing also makes the zone *path-independent*: loading straight into a
   * corridor scene and walking into one from Act I now light the same.
   */
  takeSky(): void {
    this.context.world.setBackground(null);
    this.context.world.setEnvironment(null);
  }

  setProgress(progress: number, animate: boolean): void {
    const open = progress >= RISE.opens;
    this.setCeiling(!open, animate);
    this.flow.trace(open, !animate);
  }

  private setCeiling(closed: boolean, animate: boolean): void {
    if (closed === this.closed) return;
    this.closed = closed;

    this.setDrain(closed ? 0 : 1, animate);

    const last = this.lids.length - 1;

    this.lids.forEach((lid, index) => {
      const rank = last - index;
      gsap.killTweensOf(lid.object.position);
      for (const material of lid.materials) gsap.killTweensOf(material);

      if (!animate) {
        lid.object.position.y = closed ? lid.rest : lid.rest + RISE.lift;
        lid.object.visible = closed;
        for (const material of lid.materials) {
          material.opacity = 1;
          material.transparent = false;
        }
        return;
      }

      if (closed) {
        lid.object.visible = true;
        for (const material of lid.materials) {
          material.opacity = 1;
          material.transparent = false;
        }
        lid.object.position.y = lid.rest;
        return;
      }

      const delay = rank * CEILING.step;
      gsap.to(lid.object.position, {
        y: lid.rest + RISE.lift,
        duration: CEILING.travel + CEILING.fade,
        delay,
        ease: 'power2.in',
      });
      for (const material of lid.materials) {
        material.transparent = true;
        gsap.to(material, {
          opacity: 0,
          duration: CEILING.fade,
          delay: delay + CEILING.hold,
          ease: 'power1.in',
          onComplete: () => {
            lid.object.visible = false;
          },
        });
      }
    });
  }

  /**
   * The building becoming its own plan.
   *
   * One scalar drives every material, so there is no state to get out of step:
   * the shell keeps its geometry and loses its surfaces, and the drawing arrives
   * in the same stroke. Going back is instant and complete, which is what a jump
   * back into Act II is entitled to.
   */
  private setDrain(level: number, animate: boolean): void {
    gsap.killTweensOf(this.drain);

    if (!animate || level === 0) {
      this.drain.level = level;
      this.applyDrain();
      return;
    }

    gsap.to(this.drain, {
      level,
      duration: DRAIN.seconds,
      delay: DRAIN.delay,
      ease: 'power2.inOut',
      onUpdate: () => this.applyDrain(),
    });
  }

  private applyDrain(): void {
    const level = this.drain.level;
    for (const skin of this.skins) {
      skin.material.color.copy(skin.color).lerp(VOID, level);
      skin.material.lightMapIntensity = skin.lightMap * (1 - level * 0.95);
      skin.material.emissiveIntensity = skin.emissive * (1 - level);
    }
    for (const light of this.lights) light.intensity = COVE.intensity * (1 - level);
    // A drained shell is a black solid standing over a drawing lying on the
    // floor, and it hides most of it. Once it is carrying no information it
    // stops being drawn at all — at 0.97 of the way to black there is nothing
    // left to see leave.
    this.shell.visible = level < 0.97;
    this.plan.setDrawn(level);
  }

  update(dt: number): void {
    this.flow.update(dt);
  }

  suspend(): void {
    this.flow.suspend();
  }

  dispose(): void {
    this.context.stage.remove(this.root);
    gsap.killTweensOf(this.drain);
    this.flow.dispose();
    this.plan.dispose();
    this.root.traverse((child) => {
      const mesh = child as Mesh;
      if (mesh.isMesh) mesh.geometry.dispose();
    });
    for (const lid of this.lids) {
      for (const material of lid.materials) material.dispose();
    }
    for (const skin of this.skins) skin.material.dispose();
    for (const light of this.lights) light.dispose();
  }
}

export const corridorZone: ZoneDefinition = {
  id: 'corridor',
  origin: ZONE_ORIGIN.corridor,
  atmosphere: CORRIDOR_ATMOSPHERE,
  shadow: { radius: 34, far: 140 },
  create: (context) => new Corridor(context),
};
