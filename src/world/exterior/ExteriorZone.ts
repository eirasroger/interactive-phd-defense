import gsap from 'gsap';
import { PMREMGenerator, type Texture } from 'three';
import { DURATION, EASE, seconds } from '@/animations/timing';
import { ZONE_ORIGIN } from '@/config/layout';
import type { Atmosphere } from '@/engine/render/atmosphere';
import type { ZoneContext, ZoneDefinition, ZoneInstance } from '@/engine/world/types';
import { createBuilding, type Building } from './building';
import { createGround, type Ground } from './ground';
import { BUILDING_HEIGHT } from './site';
import { createSkyTexture } from './sky';

/** Asset id every Act I scene declares, so it is resolved before the zone mounts. */
export const EXTERIOR_ASSET = 'exteriorBuilding';

/**
 * Blue hour.
 *
 * A low, warm key rakes the faces the camera approaches from, so the massing is
 * read by shadow rather than by outline. Fog is set to the sky's horizon value:
 * ground and sky then meet at the same colour and the site appears to run to a
 * horizon it does not actually reach.
 */
const EXTERIOR_ATMOSPHERE: Atmosphere = {
  fogColor: 0x232e3a,
  fogNear: 30,
  fogFar: 300,
  skyColor: 0x2c3f57,
  groundColor: 0x0a0c10,
  ambientIntensity: 0.5,
  keyColor: 0xffd6ac,
  keyIntensity: 2.2,
  // Must match SUN_VECTOR in tools/blender/exterior_building.py — Blender
  // (-55, -21, 26) maps to web (x, z, -y). The building's shading is baked from
  // that sun, so the real-time shadow it casts on the ground has to agree with
  // it or the two light the scene from different directions.
  keyOffset: [-55, 26, 21],
  environmentIntensity: 0.9,
  // The bake lands at p99 ≈ 0.8 with no clipping, so it needs no correction
  // here. Exposure stays a per-zone control rather than a constant, which is
  // what lets the interior be graded independently later.
  backgroundIntensity: 1,
  exposure: 0.95,
};

/**
 * Specification does not rise linearly with the talk.
 *
 * The claim Act I is making is that the decisions with the most leverage are
 * taken while almost nothing has been decided, so the building must still be
 * barely defined well into the act. An eased curve keeps it there; a linear ramp
 * would have it a quarter specified by the time that claim is made, quietly
 * contradicting it.
 */
const specificationFor = (progress: number): number => progress ** 1.7;

class Exterior implements ZoneInstance {
  private readonly ground: Ground = createGround();
  private readonly building: Building;
  private readonly sky: Texture = createSkyTexture();
  private readonly environment: Texture;
  private readonly specification = { value: 0 };

  private tween: gsap.core.Tween | null = null;

  constructor(private readonly context: ZoneContext) {
    this.building = createBuilding(context.assets.model(EXTERIOR_ASSET));
    context.stage.add(this.ground.object, this.building.object);

    const pmrem = new PMREMGenerator(context.renderer);
    this.environment = pmrem.fromEquirectangular(this.sky).texture;
    pmrem.dispose();

    context.world.setBackground(this.sky);
    context.world.setEnvironment(this.environment);
    this.building.setSpecification(0);
  }

  setProgress(progress: number, animate: boolean): void {
    const target = specificationFor(progress);
    this.tween?.kill();

    if (!animate) {
      this.specification.value = target;
      this.building.setSpecification(target);
      this.tween = null;
      return;
    }

    this.tween = gsap.to(this.specification, {
      value: target,
      duration: seconds(DURATION.cinematic),
      ease: EASE.standard,
      onUpdate: () => this.building.setSpecification(this.specification.value),
    });
  }

  dispose(): void {
    this.tween?.kill();
    this.context.world.setBackground(null);
    this.context.world.setEnvironment(null);
    this.ground.dispose();
    this.building.dispose();
    this.environment.dispose();
    this.sky.dispose();
  }
}

export const exteriorZone: ZoneDefinition = {
  id: 'exterior',
  origin: ZONE_ORIGIN.exterior,
  atmosphere: EXTERIOR_ATMOSPHERE,
  // Wide enough to hold the building's long dusk shadow, which is most of what
  // sells the ground plane as ground.
  shadow: { radius: BUILDING_HEIGHT * 3.4, far: BUILDING_HEIGHT * 11 },
  create: (context) => new Exterior(context),
};
