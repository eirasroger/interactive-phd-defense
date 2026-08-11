import {
  BoxGeometry,
  Color,
  InstancedMesh,
  Matrix4,
  Mesh,
  MeshStandardMaterial,
  PointLight,
} from 'three';
import { ZONE_ORIGIN } from '@/config/layout';
import type { Atmosphere } from '@/engine/render/atmosphere';
import type { ZoneContext, ZoneDefinition, ZoneInstance } from '@/engine/world/types';

/**
 * Act II's zone, standing in.
 *
 * **This is deliberately not a corridor design.** `PLAN.md` is explicit that
 * nothing in this zone can be laid out until the pipeline diagram exists as an
 * actual drawing, because the plan *is* the corridor (`decisions.md` §19) — so
 * anything authored here now would be a shape invented for its own sake and
 * then defended. What exists is the one thing the transition genuinely needs
 * and the plan cannot change: a volume of the right section, in the right
 * place, dark, with light receding into fog.
 *
 * Its section is the vestibule recess's, because the recess is its mouth. That
 * is the only commitment made here and it is a safe one: whatever plan the
 * corridor ends up with, it is entered through the door the building already
 * has.
 *
 * **It nests inside the recess rather than butting against it**, which is what
 * makes the handover seamless — the two worlds overlap for three metres, so
 * there is no frame in which one has ended and the other has not begun. That
 * means the section has to fit *inside* the recess's clear opening: 6.2 x 3.2
 * externally, less 80 mm of lining and a 140 mm floor, is 6.04 x 2.98.
 */
const SECTION = { width: 5.9, height: 2.9 } as const;

/**
 * The finished floor level, shared with the vestibule's lining.
 *
 * Not zero. The building's interior floor is 80 mm of lining laid on the world
 * plane, and the corridor's first three metres are nested inside the recess —
 * so a corridor floor at zero puts an 80 mm step and three metres of coplanar
 * surfaces exactly where the camera is looking.
 */
const FLOOR = 0.14;

/**
 * Long enough that the far end is lost in fog rather than seen to stop.
 *
 * "Lost in fog" is a measurement, not a hope. The run has to put the cap past
 * `fogFar` *from the camera*, which stands 13 m in — so anything under 59 m
 * leaves the end inside the ramp. At 54 it sat at 41 m, 87% fogged, and the
 * open end read as a pale rectangle hanging at the vanishing point: fog blends
 * geometry toward the fog colour but the background *is* the fog colour, so an
 * opening is always the one part of the frame at full strength while everything
 * around it is at 87%. A 14% step is nothing on paper and a visible panel on
 * screen.
 */
const RUN = 62;

/** Spacing of the ceiling slots. Wide, so the run reads as long. */
const BAY = 6.0;

const SLOT_COLOR = 0xb8ccff;

/**
 * Dim, cool and close. The exterior's fog reaches 1400 m because it is aerial
 * perspective over a landscape; in here it is the end of the light, and it has
 * to close within the run or the placeholder is seen to be a box.
 */
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
  /**
   * **Higher** than the exterior's 1.1, which is the opposite of the obvious
   * answer and is the whole point.
   *
   * Exposure is a property of the observer, not of the room. Walking from a
   * bright forecourt into a lit lobby, the scene genuinely carries less light —
   * so at the exterior's own exposure the interior renders dark, which is
   * exactly what stepping inside looks like for the first second. The eye then
   * adapts, and adapting is exposure going *up*.
   *
   * Setting it lower here, as the first version did, dims an already dim room
   * and produces the one thing this transition must not be: a fade to black
   * with a building around it. Paired with `power2.in` on the crossing, what
   * the audience gets is the interior holding dark as they come through the
   * doors and opening up once they are in.
   */
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

    const axis = FLOOR + SECTION.height / 2;
    surface('floor', [SECTION.width, 0.12, RUN], [0, FLOOR - 0.06, mid], underfoot);
    surface('ceiling', [SECTION.width, 0.12, RUN], [0, FLOOR + SECTION.height + 0.06, mid], surfaces);
    surface('west', [0.12, SECTION.height, RUN], [-half, axis, mid], surfaces);
    surface('east', [0.12, SECTION.height, RUN], [half, axis, mid], surfaces);
    // Capped, and belt-and-braces with the run length above. Geometry at the
    // end fogs identically to the walls around it whatever `fogFar` is later
    // retuned to; an opening never can.
    surface('end', [SECTION.width, SECTION.height, 0.12], [0, axis, -RUN], surfaces);

    const count = Math.floor(RUN / BAY);

    // The fittings are drawn and the light is added separately, which is the
    // same split the corridor bay and the vestibule already make: an emissive
    // surface in three.js is a bright surface and illuminates nothing, so the
    // thing you see and the thing that lights are always two objects.
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
      matrix.makeTranslation(0, FLOOR + SECTION.height - 0.05, -(BAY * (i + 0.5)));
      this.slots.setMatrixAt(i, matrix);
    }
    this.slots.instanceMatrix.needsUpdate = true;
    // Instances span the whole run; culling against the first slot's bounds
    // would drop the lot the moment the camera passed it.
    this.slots.frustumCulled = false;
    stage.add(this.slots);

    // Only the near few are lit for real. Past forty metres the fog has closed
    // and a light there is paying for a pixel nobody resolves.
    for (let i = 0; i < Math.min(count, 5); i += 1) {
      const light = new PointLight(new Color(SLOT_COLOR), 11, BAY * 2.4, 2);
      light.position.set(0, FLOOR + SECTION.height - 0.25, -(BAY * (i + 0.5)));
      stage.add(light);
      this.lights.push(light);
    }
  }

  dispose(): void {
    for (const mesh of this.shell) {
      this.context.stage.remove(mesh);
      mesh.geometry.dispose();
    }
    // One material is shared by three of the four surfaces, so they are
    // disposed from the set rather than per mesh.
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
  // Small, and it barely matters: nothing in here casts a sun shadow. Sized to
  // the section so the map is not spent on empty volume.
  shadow: { radius: SECTION.width, far: 40 },
  create: (context) => new Corridor(context),
};
