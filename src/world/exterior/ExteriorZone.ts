import gsap from 'gsap';
import { PMREMGenerator, type Texture } from 'three';
import { ZONE_ORIGIN } from '@/config/layout';
import { TRANSITION } from '@/config/presentation';
import type { Atmosphere } from '@/engine/render/atmosphere';
import type { ZoneContext, ZoneDefinition, ZoneInstance } from '@/engine/world/types';
import { createBakedPart, createBuilding, findParts, sharpen, type Building } from './building';
import { createGround, type Ground } from './ground';
import { createHorizon, type Horizon } from './horizon';
import { createPlanting, type Planting } from './planting';
import { createRealm, type Realm } from './realm';
import { BUILDING_HEIGHT, REVIEW } from './site';
import { createSkyTexture } from './sky';

/** Asset ids every Act I scene declares, so they resolve before the zone mounts. */
export const EXTERIOR_ASSET = 'exteriorBuilding';
export const CONSTRUCTION_ASSET = 'exteriorConstruction';
export const CANDIDATES_ASSET = 'facadeCandidates';
export const SLOT_FILL_ASSET = 'facadeSlotFill';
export const PLANTING_ASSET = 'exteriorPlanting';

export const EXTERIOR_ASSETS = [
  EXTERIOR_ASSET,
  CONSTRUCTION_ASSET,
  CANDIDATES_ASSET,
  SLOT_FILL_ASSET,
  PLANTING_ASSET,
  'grassTexture',
  'pavingTexture',
  'soilTexture',
] as const;

/**
 * Daylight, and now the building's only light.
 *
 * These levels were set when every exterior asset was drawn unlit and this rig
 * lit nothing but the ground and the planting. Under that arrangement a key of
 * 2.6 was fine, because no value here ever touched the facade.
 *
 * It does now, and the arithmetic is unforgiving: brick at 0.078 albedo takes
 * `albedo / π × intensity × 0.71` from a 28° sun, which at 2.6 landed the
 * sunlit elevation near sRGB 0.22 — a black silhouette against a bright sky
 * from every establishing pose. The key carries the facade, so it is set from
 * the facade and the ground follows.
 */
const EXTERIOR_ATMOSPHERE: Atmosphere = {
  fogColor: 0xbdd0e0,
  // The establishing poses sit 90 to 100 units out, so a 90-unit fog start put
  // the building into haze in the very first shot and washed it toward the sky
  // colour before it had been seen once. Fog should describe the far field, not
  // the subject.
  fogNear: 240,
  fogFar: 900,
  skyColor: 0x8fb4d8,
  groundColor: 0x4a5a36,
  // Pulled back as the key came up, so the extra light lands as modelling
  // rather than as a flat lift. A dark building under a bright sky needs its
  // contrast in the frames, balustrades and soffits, which is what ambient
  // washes out first.
  ambientIntensity: 0.55,
  keyColor: 0xfff2e0,
  keyIntensity: 5.6,
  // Must match SUN_VECTOR in tools/blender/exterior_building.py — Blender
  // (-50, -64, 44) maps to web (x, z, -y). The building's shading is baked from
  // that sun, so the real-time shadow it casts on the ground has to agree with
  // it or the two light the scene from different directions.
  keyOffset: [-50, 44, 64],
  environmentIntensity: 1,
  // Every asset bakes to p99 ≈ 0.57 specified with 0% clipped, so there is
  // headroom to spend here rather than in the bake, where it would clip.
  backgroundIntensity: 1,
  exposure: 1.18,
};

/** Seconds for a panel to cross the frame edge. */
const REVIEW_TRAVEL = 2.2;

/**
 * Held until the camera has finished its own move.
 *
 * The panels travel during the scene either side of the ones that show them,
 * where the review row is outside the frustum — but the *transition* into that
 * scene sweeps through poses that look west across open park, which is exactly
 * where the row parks. Starting the travel on arrival rather than on the cut
 * keeps the whole journey off camera.
 */
const REVIEW_HOLD = TRANSITION.cameraSeconds + 0.25;

class Exterior implements ZoneInstance {
  private readonly ground: Ground;
  private readonly realm: Realm;
  private readonly planting: Planting;
  private readonly building: Building;
  private readonly construction: Building;
  private readonly slotFill: Building;
  private readonly candidates: readonly Building[];
  private readonly parts: readonly Building[];
  private readonly horizon: Horizon = createHorizon();
  private readonly sky: Texture = createSkyTexture();
  private readonly environment: Texture;
  private presence = -1;

  constructor(private readonly context: ZoneContext) {
    const { assets, stage } = context;

    this.ground = createGround(assets.texture('grassTexture'));
    this.realm = createRealm({
      paving: assets.texture('pavingTexture'),
      soil: assets.texture('soilTexture'),
    });
    this.planting = createPlanting(assets.model(PLANTING_ASSET));
    stage.add(this.horizon.object, this.realm.object, this.planting.object);

    for (const id of [EXTERIOR_ASSET, CONSTRUCTION_ASSET, SLOT_FILL_ASSET, CANDIDATES_ASSET]) {
      sharpen(assets.model(id), context.quality.anisotropy);
    }

    this.building = createBuilding(assets.model(EXTERIOR_ASSET));
    this.construction = createBuilding(assets.model(CONSTRUCTION_ASSET));
    this.slotFill = createBuilding(assets.model(SLOT_FILL_ASSET));
    this.candidates = findParts(assets.model(CANDIDATES_ASSET), REVIEW.count).map(createBakedPart);

    this.parts = [this.building, this.construction, this.slotFill, ...this.candidates];
    stage.add(this.ground.object, ...this.parts.map((part) => part.object));

    // Act I is the building under construction with the bay still open. The
    // fill is Act IV's, and the options are parked off frame until the act
    // asks for them.
    this.slotFill.object.visible = false;
    this.setReview(0, false);

    const pmrem = new PMREMGenerator(context.renderer);
    this.environment = pmrem.fromEquirectangular(this.sky).texture;
    pmrem.dispose();

    context.world.setBackground(this.sky);
    context.world.setEnvironment(this.environment);
  }

  /**
   * Walks the review row on or off site, entirely outside the frame.
   *
   * The travel is never watched. It runs during the scene before the options
   * are discussed and the scene after, both of which face the building, and it
   * waits out the camera's own move first. What the audience sees is a stretch
   * of act with four panels standing on the promenade and a stretch without —
   * never the join.
   *
   * An earlier version travelled them into their own scene, so the row slid
   * across frame while the camera was still swinging onto it. Two things moving
   * at once reads as a slide transition rather than as objects being brought
   * out, which is the one thing this must not look like.
   */
  private setReview(presence: number, animate: boolean): void {
    // Only on a change of state. Every scene in the span reports the row as
    // present, and re-issuing the tween each time would restart a travel that
    // has already happened.
    if (presence === this.presence) return;
    this.presence = presence;

    const last = this.candidates.length - 1;

    this.candidates.forEach((candidate, index) => {
      const { object } = candidate;
      // Parked west, staggered east to west so the panel nearest the building
      // arrives first and the row builds away from it. Reversed, the far panels
      // would cross through the near ones on the way in.
      const parked = -(REVIEW.offstage + (last - index) * REVIEW.stagger);
      const x = parked * (1 - presence);

      gsap.killTweensOf(object.position);
      if (!animate) {
        object.position.x = x;
        object.visible = presence > 0;
        return;
      }

      object.visible = true;
      gsap.to(object.position, {
        x,
        duration: REVIEW_TRAVEL,
        delay: REVIEW_HOLD + (last - index) * 0.12,
        ease: 'power2.inOut',
        onComplete: () => {
          object.visible = presence > 0;
        },
      });
    });
  }

  setProgress(progress: number, animate: boolean): void {
    const onStage = progress >= REVIEW.from && progress <= REVIEW.to;
    this.setReview(onStage ? 1 : 0, animate);
  }

  dispose(): void {
    for (const candidate of this.candidates) gsap.killTweensOf(candidate.object.position);
    this.context.world.setBackground(null);
    this.context.world.setEnvironment(null);
    this.ground.dispose();
    this.horizon.dispose();
    this.realm.dispose();
    this.planting.dispose();
    for (const part of this.parts) part.dispose();
    this.environment.dispose();
    this.sky.dispose();
  }
}

export const exteriorZone: ZoneDefinition = {
  id: 'exterior',
  origin: ZONE_ORIGIN.exterior,
  atmosphere: EXTERIOR_ATMOSPHERE,
  // Wide enough to hold the building's shadow and the trees', which is most of
  // what sells the ground plane as ground.
  shadow: { radius: BUILDING_HEIGHT * 3.4, far: BUILDING_HEIGHT * 11 },
  create: (context) => new Exterior(context),
};
