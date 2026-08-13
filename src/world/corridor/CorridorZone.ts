import { Color, Group, Mesh, MeshStandardMaterial, Object3D, PointLight } from 'three';
import { GARDEN, ROOM, SECTION, STATIONS } from '@/config/corridor';
import { ZONE_ORIGIN } from '@/config/layout';
import type { Atmosphere } from '@/engine/render/atmosphere';
import type { ZoneContext, ZoneDefinition, ZoneInstance } from '@/engine/world/types';
import { sharpen } from '@/world/exterior/building';

export const SHELL_ASSET = 'corridorShell';
export const CEILING_ASSET = 'corridorCeiling';

export const CORRIDOR_ASSETS = [SHELL_ASSET, CEILING_ASSET] as const;

/**
 * How hard the shell's baked occlusion bites.
 *
 * Lower than the exterior's, because an enclosed section bakes far more
 * occlusion than an elevation does — every surface in here can see the one
 * opposite it — and the bounce that fills those corners in Cycles has no
 * counterpart in a rasteriser.
 */
const OCCLUSION = 0.55;

/**
 * How hard the exported cove strips glow.
 *
 * Blender writes the emissive strength its Cycles preview was lit by, and a
 * value tuned as a *source* in a path tracer is a blown white bar in a
 * rasteriser — you see the fitting instead of the wash it makes. The lamps
 * below are the other half of `learnings.md` §33: emissive geometry illuminates
 * nothing here, so every strip is paired with a point light. Points, never
 * `RectAreaLight`, which compiles its LTC path into every standard material in
 * the scene to light one corridor.
 */
const COVE_GLOW = 0.45;

const COVE = {
  color: 0xffdcb4,
  intensity: 4.5,
  distance: 14,
  offset: SECTION.linkWidth / 2 - 0.3,
  // Below the downstand, not level with it. A lamp beside the lip it hides
  // behind lights the lip, which is the one surface that must stay unlit.
  height: SECTION.floor + 1.95,
};

/**
 * Daylight, and it is the whole reason the rooms stopped being a cave.
 *
 * Each room opens onto a garden, and in Cycles that opening is what lights the
 * room — bounce off the garden wall, in through the glass. A rasteriser has no
 * bounce, so the opening lights nothing and the room goes black however bright
 * the garden is. One lamp sitting *in* each garden, aimed in through its own
 * opening, is that transport put back by hand.
 */
const DAYLIGHT = {
  color: 0xf4efe4,
  intensity: 46,
  distance: 40,
  height: SECTION.floor + 2.2,
  reach: GARDEN.depth * 0.45,
};

const CORRIDOR_ATMOSPHERE: Atmosphere = {
  fogColor: 0x1a1512,
  fogNear: 14,
  fogFar: 52,
  skyColor: 0xcbc3b4,
  groundColor: 0x241a12,
  ambientIntensity: 0.34,
  keyColor: 0xffeacb,
  keyIntensity: 0.7,
  keyOffset: [-14, 40, 34],
  environmentIntensity: 0.26,
  backgroundIntensity: 0,
  exposure: 0.86,
};

function mount(source: Object3D): Object3D {
  const object = source.clone(true);
  object.traverse((child) => {
    const mesh = child as Mesh;
    if (!mesh.isMesh) return;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    for (const entry of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) {
      if (!(entry instanceof MeshStandardMaterial)) continue;
      entry.aoMapIntensity = OCCLUSION;
      entry.envMapIntensity = 1;
      if (entry.name.startsWith('cove')) entry.emissiveIntensity = COVE_GLOW;
    }
  });
  return object;
}

class Corridor implements ZoneInstance {
  private readonly root = new Group();
  private readonly panels: Object3D[];
  private readonly lights: PointLight[] = [];

  constructor(private readonly context: ZoneContext) {
    const { assets, quality, stage } = context;

    const shell = assets.model(SHELL_ASSET);
    const ceiling = assets.model(CEILING_ASSET);
    sharpen(shell, quality.anisotropy);
    sharpen(ceiling, quality.anisotropy);

    this.root.name = 'corridor';
    this.root.add(mount(shell.scene));

    this.panels = [...ceiling.scene.children]
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((panel) => mount(panel));
    if (this.panels.length === 0) throw new Error('corridor ceiling contains no panels.');
    for (const panel of this.panels) this.root.add(panel);

    this.lightEnfilade();
    stage.add(this.root);
  }

  /**
   * The coves are emissive geometry and light nothing, so the links are lit
   * from where their coves are and the rooms from where their daylight is.
   */
  private lightEnfilade(): void {
    const half = ROOM.length / 2;
    const axis = [0, 1, 2, 4].map((index) => STATIONS[index]?.z ?? 0);
    const links: number[] = [(SECTION.nest + axis[0]! - half) / 2, axis[2]!];
    for (let index = 0; index + 1 < axis.length; index += 1) {
      links.push((axis[index]! + half + axis[index + 1]! - half) / 2);
    }

    // One lamp per member, not two. Every light in a scene is compiled into
    // every material in it and costs a term per fragment forever, so the count
    // is a budget rather than a placement question — thirty was three times
    // what this zone can see the benefit of.
    for (const z of links) {
      this.lamp(COVE, 0, COVE.height, -z);
    }

    for (const [index, station] of STATIONS.entries()) {
      // Gardens alternate sides, matching the shell: C1 west, C2 east, C3 west,
      // C4 east, C5 west.
      const side = index === 1 || index === 3 ? 1 : -1;
      const outside = station.x + side * (ROOM.width / 2 + DAYLIGHT.reach);
      this.lamp(DAYLIGHT, outside, DAYLIGHT.height, -station.z);
    }
  }

  private lamp(spec: { color: number; intensity: number; distance: number },
               x: number, y: number, z: number): void {
    const light = new PointLight(new Color(spec.color), spec.intensity, spec.distance, 2);
    light.position.set(x, y, z);
    this.root.add(light);
    this.lights.push(light);
  }

  dispose(): void {
    this.context.stage.remove(this.root);
    this.root.traverse((child) => {
      const mesh = child as Mesh;
      if (mesh.isMesh) mesh.geometry.dispose();
    });
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
