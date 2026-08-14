import { Color, Group, Mesh, MeshStandardMaterial, Object3D, PointLight } from 'three';
import { ROOM, SECTION, STATIONS } from '@/config/corridor';
import { ZONE_ORIGIN } from '@/config/layout';
import type { Atmosphere } from '@/engine/render/atmosphere';
import type { ZoneContext, ZoneDefinition, ZoneInstance } from '@/engine/world/types';
import { sharpen } from '@/world/exterior/building';

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
