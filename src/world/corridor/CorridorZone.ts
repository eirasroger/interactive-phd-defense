import {
  BoxGeometry,
  Color,
  InstancedMesh,
  Matrix4,
  Mesh,
  MeshStandardMaterial,
  PointLight,
} from 'three';
import { RUN, SECTION } from '@/config/corridor';
import { ZONE_ORIGIN } from '@/config/layout';
import type { Atmosphere } from '@/engine/render/atmosphere';
import type { ZoneContext, ZoneDefinition, ZoneInstance } from '@/engine/world/types';

const HEIGHT = SECTION.mouthHeight;
const FLOOR = SECTION.floor;
const NEST = SECTION.nest;

const BAY = 6.0;

const SLOT_COLOR = 0xb8ccff;

const CORRIDOR_ATMOSPHERE: Atmosphere = {
  fogColor: 0x090b10,
  fogNear: 6,
  fogFar: 46,
  skyColor: 0x2c3646,
  groundColor: 0x090b10,
  ambientIntensity: 0.35,
  keyColor: 0xc8d6ff,
  keyIntensity: 0.25,
  keyOffset: [0, 20, 10],
  environmentIntensity: 0.08,
  backgroundIntensity: 0,
  exposure: 1.28,
};

class Corridor implements ZoneInstance {
  private readonly shell: Mesh[] = [];
  private readonly slots: InstancedMesh;
  private readonly lights: PointLight[] = [];

  constructor(private readonly context: ZoneContext) {
    const { stage } = context;

    const surfaces = new MeshStandardMaterial({ color: 0x14171d, roughness: 0.88 });
    const underfoot = new MeshStandardMaterial({ color: 0x0d0f13, roughness: 0.55 });

    const half = SECTION.width / 2;
    const mid = -RUN / 2;

    const surface = (
      name: string,
      size: readonly [number, number, number],
      at: readonly [number, number, number],
      material: MeshStandardMaterial,
    ): void => {
      const mesh = new Mesh(new BoxGeometry(size[0], size[1], size[2]), material);
      mesh.position.set(at[0], at[1], at[2]);
      mesh.name = `corridor:${name}`;
      stage.add(mesh);
      this.shell.push(mesh);
    };

    const axis = FLOOR + HEIGHT / 2;
    const deck = RUN - NEST;
    surface('floor', [SECTION.width, 0.12, deck], [0, FLOOR - 0.06, -(NEST + deck / 2)], underfoot);
    surface('ceiling', [SECTION.width, 0.12, RUN], [0, FLOOR + HEIGHT + 0.06, mid], surfaces);
    surface('west', [0.12, HEIGHT, RUN], [-half, axis, mid], surfaces);
    surface('east', [0.12, HEIGHT, RUN], [half, axis, mid], surfaces);
    surface('end', [SECTION.width, HEIGHT, 0.12], [0, axis, -RUN], surfaces);

    const count = Math.floor(RUN / BAY);

    this.slots = new InstancedMesh(
      new BoxGeometry(SECTION.width - 2.2, 0.06, 0.34),
      new MeshStandardMaterial({
        color: 0x05070a,
        emissive: new Color(SLOT_COLOR),
        emissiveIntensity: 2.4,
      }),
      count,
    );
    const matrix = new Matrix4();
    for (let i = 0; i < count; i += 1) {
      matrix.makeTranslation(0, FLOOR + HEIGHT - 0.05, -(BAY * (i + 0.5)));
      this.slots.setMatrixAt(i, matrix);
    }
    this.slots.instanceMatrix.needsUpdate = true;
    this.slots.frustumCulled = false;
    stage.add(this.slots);

    for (let i = 0; i < Math.min(count, 5); i += 1) {
      const light = new PointLight(new Color(SLOT_COLOR), 11, BAY * 2.4, 2);
      light.position.set(0, FLOOR + HEIGHT - 0.25, -(BAY * (i + 0.5)));
      stage.add(light);
      this.lights.push(light);
    }
  }

  dispose(): void {
    for (const mesh of this.shell) {
      this.context.stage.remove(mesh);
      mesh.geometry.dispose();
    }
    for (const material of new Set(this.shell.map((mesh) => mesh.material))) {
      (material as MeshStandardMaterial).dispose();
    }
    this.context.stage.remove(this.slots);
    this.slots.geometry.dispose();
    (this.slots.material as MeshStandardMaterial).dispose();
    for (const light of this.lights) {
      this.context.stage.remove(light);
      light.dispose();
    }
  }
}

export const corridorZone: ZoneDefinition = {
  id: 'corridor',
  origin: ZONE_ORIGIN.corridor,
  atmosphere: CORRIDOR_ATMOSPHERE,
  shadow: { radius: SECTION.width, far: 40 },
  create: (context) => new Corridor(context),
};
