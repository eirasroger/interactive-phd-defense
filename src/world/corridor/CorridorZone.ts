import gsap from 'gsap';
import { Color, Group, Mesh, MeshStandardMaterial, Object3D, PointLight } from 'three';
import { RISE, ROOM, SECTION, STATIONS } from '@/config/corridor';
import { ZONE_ORIGIN } from '@/config/layout';
import type { Atmosphere } from '@/engine/render/atmosphere';
import type { ZoneContext, ZoneDefinition, ZoneInstance } from '@/engine/world/types';
import { sharpen } from '@/world/exterior/building';
import { createFlow, type Flow } from './Flow';
import { createPlanDrawing, type PlanDrawing } from './PlanDrawing';
import { createProjection, type Projection } from './Projection';
import { createProjector, type Projector } from './Projector';
import { createDataSea, type DataSea } from './DataSea';

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
 * Ceiling lid timing in seconds. The climb starts at C5, so C5's lid goes first
 * and the rest follow toward the mouth. Lids lift, then fade so they do not
 * block the plan view.
 */
const CEILING = {
  travel: 1.4,
  fade: 0.7,
  step: 0.11,
  hold: 0.2,
} as const;

/**
 * Shell fade to black during the climb, in seconds. Starts late so the lit
 * gallery is visible as the ceiling lifts, and ends before the camera settles.
 */
const DRAIN = { delay: 0.7, seconds: 2.6 } as const;

/**
 * Plan and flow fade-out. Deliberately longer than the 1.9 s camera move so it
 * overlaps the incoming slide. Uses the camera's gentle ease: `power2.inOut` is
 * too fast mid-way on a 75 m front. The sea stays (see `FIELD`).
 */
const CLEARING = { seconds: 2.9, ease: 'sine.inOut' } as const;

/**
 * Data sea fade-in during the climb, in seconds, so Act III already has its
 * setting when the plan appears. Starts after the drain. Fades out faster and
 * with no delay when returning to Act II.
 */
const FIELD = { delay: 1.1, seconds: 3.2, out: 1.2 } as const;

/** Shell colour when fully drained. */
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
 * Atmosphere for the overhead plan view. Fog is pushed out so the full 75 m run
 * is visible from above, and turns a cold dark blue. Key and environment light
 * go up so the lifting lids stay visible during the climb.
 */
export const opened = (base: Atmosphere): Atmosphere => ({
  ...base,
  fogColor: 0x1b242f,
  fogNear: 70,
  fogFar: 280,
  ambientIntensity: base.ambientIntensity * 1.5,
  keyIntensity: base.keyIntensity * 1.4,
  environmentIntensity: base.environmentIntensity * 1.3,
  // The corridor base uses 0, which would make the background pure black
  // whatever its colour.
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
 * Clones every material so fades do not leak into the shared asset cache.
 * See `learnings.md` §7c.
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

/** A shell material and its values before the drain. */
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
  private readonly projection: Projection;
  private readonly projector: Projector;
  private readonly sea: DataSea;
  private readonly shell: Object3D;
  private readonly skins: readonly Skin[];
  private readonly drain = { level: 0 };
  private readonly clearing = { level: 0 };
  private readonly field = { level: 0 };
  private closed = true;
  private dispersed = false;
  private flooded = false;

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
    this.projection = createProjection();
    this.projector = createProjector();
    this.sea = createDataSea(quality.particleBudget);
    this.root.add(
      this.flow.object,
      this.plan.object,
      this.projection.object,
      this.projector.object,
      this.sea.object,
    );

    this.lightEnfilade();
    stage.add(this.root);
  }

  /** Lamps go in the links only. Gallery lighting is baked. */
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
   * Clears the exterior's global sky background and environment map.
   * `ZoneDirector` calls this on handover, after the exterior is out of view.
   * Makes lighting the same whether the corridor is loaded directly or entered
   * from Act I.
   */
  takeSky(): void {
    this.context.world.setBackground(null);
    this.context.world.setEnvironment(null);
  }

  /**
   * Driven by zone progress, so jumping into any scene finds the ceiling, sea
   * and flow in the right state.
   */
  setProgress(progress: number, animate: boolean): void {
    const open = progress >= RISE.opens;
    this.setCeiling(!open, animate);
    this.setField(open, animate);
    this.flow.trace(open, !animate);
    this.setClearing(progress >= RISE.disperses, animate);
    this.projection.setProgress(progress, animate);
    this.projector.setProgress(progress, animate);
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
   * Fades out the plan drawing and flow for Act III's themes, leaving the sea.
   */
  private setClearing(dispersed: boolean, animate: boolean): void {
    if (dispersed === this.dispersed) return;
    this.dispersed = dispersed;

    gsap.killTweensOf(this.clearing);

    const level = dispersed ? 1 : 0;

    if (!animate) {
      this.clearing.level = level;
      this.applyClearing();
      return;
    }

    gsap.to(this.clearing, {
      level,
      duration: CLEARING.seconds,
      ease: CLEARING.ease,
      onUpdate: () => this.applyClearing(),
    });
  }

  private applyClearing(): void {
    this.plan.setCleared(this.clearing.level);
    this.flow.setCleared(this.clearing.level);
  }

  /** Fades the data sea in or out. Uses the same progress gate as the ceiling. */
  private setField(present: boolean, animate: boolean): void {
    if (present === this.flooded) return;
    this.flooded = present;

    gsap.killTweensOf(this.field);

    const level = present ? 1 : 0;

    if (!animate) {
      this.field.level = level;
      this.sea.setLevel(level);
      return;
    }

    gsap.to(this.field, {
      level,
      duration: present ? FIELD.seconds : FIELD.out,
      delay: present ? FIELD.delay : 0,
      ease: present ? 'power2.out' : 'power2.in',
      onUpdate: () => this.sea.setLevel(this.field.level),
    });
  }

  /**
   * Fades the shell to black and draws the plan, both from one 0-1 level.
   * Returning to 0 is instant.
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
    this.projection.setLevel(1 - level);
    this.projector.setLevel(1 - level);
    // Hide the nearly black shell so it does not cover the plan on the floor.
    this.shell.visible = level < 0.97;
    this.plan.setDrawn(level);
  }

  update(dt: number): void {
    this.flow.update(dt);
    this.sea.update(dt);
  }

  suspend(): void {
    this.flow.suspend();
  }

  dispose(): void {
    this.context.stage.remove(this.root);
    gsap.killTweensOf(this.drain);
    gsap.killTweensOf(this.clearing);
    gsap.killTweensOf(this.field);
    this.flow.dispose();
    this.plan.dispose();
    this.projection.dispose();
    this.projector.dispose();
    this.sea.dispose();
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
