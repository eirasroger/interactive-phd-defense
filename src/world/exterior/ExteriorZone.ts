import gsap from 'gsap';
import { PMREMGenerator, type Texture } from 'three';
import { ZONE_ORIGIN } from '@/config/layout';
import { TRANSITION } from '@/config/presentation';
import type { Atmosphere } from '@/engine/render/atmosphere';
import type { ZoneContext, ZoneDefinition, ZoneInstance } from '@/engine/world/types';
import { createBakedPart, createBuilding, findParts, sharpen, type Building } from './building';
import { createCanopyField } from './canopy';
import { createLake, type Lake } from './lake';
import { createParkland, type Parkland } from './parkland';
import { createPavilion, type Pavilion } from './pavilion';
import { createPlanting, type Planting } from './planting';
import { createRealm, type Realm } from './realm';
import { createBankside, type Bankside } from './bankside';
import { createBridge, type Bridge } from './bridge';
import { createPlayground, type Playground } from './playground';
import { createRiver, type River } from './river';
import { BUILDING_HEIGHT, REVIEW } from './site';
import { createSkyTexture } from './sky';
import { createTerrain, type Terrain } from './terrain';
import { createWoodland, type Woodland } from './woodland';

/** Asset ids every Act I scene declares, so they resolve before the zone mounts. */
export const EXTERIOR_ASSET = 'exteriorBuilding';
export const CONSTRUCTION_ASSET = 'exteriorConstruction';
export const CANDIDATES_ASSET = 'facadeCandidates';
export const SLOT_FILL_ASSET = 'facadeSlotFill';
export const PLANTING_ASSET = 'exteriorPlanting';
export const PARK_ASSET = 'parkAssets';

export const EXTERIOR_ASSETS = [
  EXTERIOR_ASSET,
  CONSTRUCTION_ASSET,
  CANDIDATES_ASSET,
  SLOT_FILL_ASSET,
  PLANTING_ASSET,
  PARK_ASSET,
  'grassTexture',
  'meadowTexture',
  'soilTexture',
  'riverbedTexture',
  'clayTexture',
  'graniteTexture',
  'cobbleTexture',
  'gravelTexture',
  'clayNormal',
  'graniteNormal',
  'cobbleNormal',
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
  // Pale, faintly warm horizon haze. Must stay close to the `v = 0.5` stop in
  // `sky.ts`: distant ground fades to this and then gives way to the sky, and a
  // step between the two draws a line across the far field.
  fogColor: 0xcfe0ee,
  // Aerial perspective, not a curtain. `LAND.ridge` and the woodland belt close
  // the horizon by construction, so the fog does not have to hide anything — a
  // ramp short enough to do that also washes the belt itself to a grey wall,
  // which reads as weather rather than as distance.
  fogNear: 110,
  fogFar: 1400,
  skyColor: 0x9fc4ea,
  groundColor: 0x6a7a4e,
  // Lifted with the sun. A high sun leaves the north and east elevations taking
  // nothing but sky, and at 0.55 they went to silhouette — which is the same
  // failure the key was raised to fix, arriving from the other direction.
  ambientIntensity: 0.9,
  keyColor: 0xfff4e4,
  keyIntensity: 6.2,
  // A Nordic summer midday: roughly 48° elevation, from the west of the
  // approach so the +Z entrance elevation is lit rather than in its own shade.
  //
  // Free to choose: the only Blender bake is `type='AO'`, which is
  // sun-independent, so nothing in the exported textures carries a light
  // direction this could disagree with.
  keyOffset: [-50, 90, 64],
  // Lands as *colour* rather than as lift: at midday the shaded faces of a
  // building are lit almost entirely by a deep blue sky, and that blue in the
  // shadows is most of what separates daylight from a flat white key.
  //
  // Tuned against the panorama in `sky.ts` — the sun-to-sky *ratio* is the look,
  // so changing the sky is a retune here rather than a swap.
  environmentIntensity: 1.25,
  // Every asset bakes to p99 ≈ 0.57 specified with 0% clipped, so there is
  // headroom to spend here rather than in the bake, where it would clip.
  backgroundIntensity: 1,
  exposure: 1.1,
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
const REVIEW_HOLD = TRANSITION.camera.maxSeconds + 0.25;

class Exterior implements ZoneInstance {
  private readonly terrain: Terrain;
  private readonly lake: Lake;
  private readonly river: River;
  private readonly bridge: Bridge;
  private readonly pavilion: Pavilion;
  private readonly playground: Playground;
  private readonly woodland: Woodland;
  private readonly realm: Realm;
  private readonly planting: Planting;
  private readonly bankside: Bankside;
  private readonly parkland: Parkland;
  private readonly building: Building;
  private readonly construction: Building;
  private readonly slotFill: Building;
  private readonly candidates: readonly Building[];
  private readonly parts: readonly Building[];
  // Built from the key's own direction, so the sun in the panorama and the light
  // casting the shadows cannot disagree.
  private readonly sky: Texture = createSkyTexture(EXTERIOR_ATMOSPHERE.keyOffset);
  private readonly environment: Texture;
  private presence = -1;

  constructor(private readonly context: ZoneContext) {
    const { assets, stage } = context;

    this.lake = createLake();
    this.river = createRiver();
    this.bridge = createBridge();
    this.pavilion = createPavilion();
    this.playground = createPlayground();
    this.realm = createRealm({
      clay: { map: assets.texture('clayTexture'), normal: assets.texture('clayNormal') },
      granite: { map: assets.texture('graniteTexture'), normal: assets.texture('graniteNormal') },
      cobble: { map: assets.texture('cobbleTexture'), normal: assets.texture('cobbleNormal') },
      // No normal map of its own: loose gravel under planting is read at three
      // metres and its relief is below the threshold a normal buys anything at,
      // so the cobble's stands in rather than shipping a fourth map.
      gravel: { map: assets.texture('gravelTexture'), normal: assets.texture('cobbleNormal') },
    });

    // Three modules read the planting asset's node hierarchy directly, and all
    // three must run before `createPlanting` collapses it into instanced draws
    // and the individual templates stop being addressable. The woodland
    // photographs the trees onto billboards, the bankside clones species by
    // name, and the parkland instances whole trees into the park — none of them
    // ships an asset of its own.
    // **The planting is built before the ground it stands on**, and the order is
    // the design rather than an accident of construction. Grass does not grow
    // the same under a tree, and the only description of where the trees are is
    // the plan that just placed them — painting a matching map would be a second
    // description of one thing, agreeing until the seed changes.
    //
    // Nothing here needs the terrain *mesh*, only `heightAt`, which is a pure
    // function. So the dependency runs one way: the planting asks the ground
    // where it is, then the ground asks the planting what is standing on it.
    const canopy = createCanopyField();

    const flora = assets.model(PLANTING_ASSET).scene;
    this.woodland = createWoodland(context.renderer, flora, { canopy });
    this.bankside = createBankside(flora);
    this.parkland = createParkland(flora, assets.model(PARK_ASSET).scene, { canopy });
    this.planting = createPlanting(assets.model(PLANTING_ASSET), { canopy });

    this.terrain = createTerrain({
      grass: assets.texture('grassTexture'),
      soil: assets.texture('soilTexture'),
      riverbed: assets.texture('riverbedTexture'),
      canopy,
    });

    stage.add(
      this.terrain.object,
      this.lake.object,
      this.river.object,
      this.bridge.object,
      this.pavilion.object,
      this.playground.object,
      this.woodland.object,
      this.realm.object,
      this.planting.object,
      this.bankside.object,
      this.parkland.object,
    );

    for (const id of [EXTERIOR_ASSET, CONSTRUCTION_ASSET, SLOT_FILL_ASSET, CANDIDATES_ASSET]) {
      sharpen(assets.model(id), context.quality.anisotropy);
    }

    this.building = createBuilding(assets.model(EXTERIOR_ASSET));
    this.construction = createBuilding(assets.model(CONSTRUCTION_ASSET));
    this.slotFill = createBuilding(assets.model(SLOT_FILL_ASSET));
    this.candidates = findParts(assets.model(CANDIDATES_ASSET), REVIEW.count).map(createBakedPart);

    this.parts = [this.building, this.construction, this.slotFill, ...this.candidates];
    stage.add(...this.parts.map((part) => part.object));

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
    // Which way is away from the building, and therefore which way the row
    // walks off. The panels are exported at `REVIEW.baked` and stand at
    // `REVIEW.centre`, so every position here is that shift plus the travel.
    const away = Math.sign(REVIEW.centre[0]);
    const rest = REVIEW.centre[0] - REVIEW.baked;

    this.candidates.forEach((candidate, index) => {
      const { object } = candidate;
      // Staggered from the building outward, so the panel nearest it arrives
      // first and the row builds away. Reversed, the far panels would cross
      // through the near ones on the way in.
      const rank = away > 0 ? index : last - index;
      const parked = away * (REVIEW.offstage + rank * REVIEW.stagger);
      const x = rest + parked * (1 - presence);

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

  update(dt: number): void {
    this.planting.update(dt);
    this.parkland.update(dt);
    this.woodland.update(dt);
    this.lake.update(dt);
    this.river.update(dt);
  }

  dispose(): void {
    for (const candidate of this.candidates) gsap.killTweensOf(candidate.object.position);
    this.context.world.setBackground(null);
    this.context.world.setEnvironment(null);
    this.terrain.dispose();
    this.lake.dispose();
    this.river.dispose();
    this.bridge.dispose();
    this.pavilion.dispose();
    this.playground.dispose();
    this.woodland.dispose();
    this.realm.dispose();
    this.planting.dispose();
    this.bankside.dispose();
    this.parkland.dispose();
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
