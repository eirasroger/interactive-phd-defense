import gsap from 'gsap';
import { PMREMGenerator, type Object3D, type Texture } from 'three';
import { ZONE_ORIGIN } from '@/config/layout';
import { TRANSITION } from '@/config/presentation';
import { clouded, type Atmosphere } from '@/engine/render/atmosphere';
import type { ZoneContext, ZoneDefinition, ZoneInstance } from '@/engine/world/types';
import {
  createBakedPart,
  createBuilding,
  findByMaterial,
  findParts,
  sharpen,
  type Building,
} from './building';
import { createCanopyField } from './canopy';
import { createEntrance, ENTRANCE_TRAVEL_SECONDS, type Entrance } from './entrance';
import { createLake, type Lake } from './lake';
import { createParkland, type Parkland } from './parkland';
import { createPavilion, type Pavilion } from './pavilion';
import { createPlanting, type Planting } from './planting';
import { createRealm, type Realm } from './realm';
import { createBankside, type Bankside } from './bankside';
import { createBridge, type Bridge } from './bridge';
import { createPlayground, type Playground } from './playground';
import { createRiver, type River } from './river';
import { DOORS_AT } from '@/animations/entry';
import { seconds as scaled } from '@/animations/timing';
import { BUILDING_HEIGHT, CLOUD, CONSTRUCTION, REVIEW } from './site';
import { CloudShell } from './CloudShell';
import { createSkyTexture } from './sky';
import { createOutcrop, type StoneField } from './stones';
import { createTerrain, type Terrain } from './terrain';
import { createWoodland, type Woodland } from './woodland';

/** Asset ids every Act I scene declares, so they load before the zone mounts. */
export const EXTERIOR_ASSET = 'exteriorBuilding';
export const CONSTRUCTION_ASSET = 'exteriorConstruction';
export const DOORS_ASSET = 'exteriorDoors';
export const CANDIDATES_ASSET = 'facadeCandidates';
export const SLOT_FILL_ASSET = 'facadeSlotFill';
export const PLANTING_ASSET = 'exteriorPlanting';
export const PARK_ASSET = 'parkAssets';

export const EXTERIOR_ASSETS = [
  EXTERIOR_ASSET,
  CONSTRUCTION_ASSET,
  DOORS_ASSET,
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
 * Exterior daylight. This also lights the building, so the key intensity is
 * set high enough for the dark brick facade to not read as a silhouette.
 */
const EXTERIOR_ATMOSPHERE: Atmosphere = {
  // Horizon haze. Must stay close to the `v = 0.5` stop in `sky.ts`, or a line
  // appears where distant ground meets the sky.
  fogColor: 0xcfe0ee,
  // Light distance haze. The ridge and woodland already close the horizon.
  fogNear: 110,
  fogFar: 1400,
  skyColor: 0x9fc4ea,
  groundColor: 0x6a7a4e,
  // High enough that the shaded facades do not go black.
  ambientIntensity: 0.9,
  keyColor: 0xfff4e4,
  keyIntensity: 6.2,
  // Nordic summer midday sun, about 48° up, from the west so the entrance face
  // is lit. The bake is AO only, so any sun direction works.
  keyOffset: [-50, 90, 64],
  // Adds blue sky light to the shadows. Tuned together with `sky.ts`, so
  // changing the sky means retuning this.
  environmentIntensity: 1.25,
  // Bakes peak around 0.57, so there is headroom for exposure here.
  backgroundIntensity: 1,
  exposure: 1.1,
};

/** Seconds for a panel to cross the frame edge. */
const REVIEW_TRAVEL = 2.2;

/**
 * Delay before the panels move, so the camera finishes its transition first.
 * The transition passes views where the panels would be visible.
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
  private readonly outcrop: StoneField;
  private readonly building: Building;
  /** Dark lining of the entrance recess. Hidden once the corridor is behind it. */
  private readonly lining: Object3D[];
  private readonly construction: Building;
  private readonly slotFill: Building;
  private readonly candidates: readonly Building[];
  private readonly entrance: Entrance;
  private readonly parts: readonly Building[];
  // Uses the key light direction so the sky's sun matches the shadows.
  private readonly sky: Texture = createSkyTexture(EXTERIOR_ATMOSPHERE.keyOffset);
  private readonly environment: Texture;
  /** Uses the exterior atmosphere so its lighting matches the sun and exposure. */
  private readonly cloud: CloudShell;
  private presence = -1;
  private scaffolded = true;
  private strike: gsap.core.Tween | null = null;
  private threshold: gsap.core.Tween | null = null;
  private beyond = false;

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
      // Reuses the cobble normal map. Gravel detail is too small to need its own.
      gravel: { map: assets.texture('gravelTexture'), normal: assets.texture('cobbleNormal') },
    });

    // Woodland, bankside and parkland read the planting asset's templates, so
    // they must run before `createPlanting` merges it into instanced meshes.
    // Planting is built before the terrain so the ground can darken under the
    // trees. Planting only needs `heightAt`.
    const canopy = createCanopyField();

    const flora = assets.model(PLANTING_ASSET).scene;
    this.woodland = createWoodland(context.renderer, flora, { canopy });
    this.bankside = createBankside(flora);
    this.parkland = createParkland(flora, assets.model(PARK_ASSET).scene, {
      canopy,
      // For the model/billboard swap. See `FAR` in `parkland.ts`.
      camera: context.camera,
      renderer: context.renderer,
    });
    this.planting = createPlanting(assets.model(PLANTING_ASSET), { canopy });

    this.terrain = createTerrain({
      grass: assets.texture('grassTexture'),
      soil: assets.texture('soilTexture'),
      riverbed: assets.texture('riverbedTexture'),
      canopy,
    });

    // After the terrain, since the slabs sit on its surface.
    this.outcrop = createOutcrop();

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
      this.outcrop.object,
    );

    for (const id of [
      EXTERIOR_ASSET,
      CONSTRUCTION_ASSET,
      SLOT_FILL_ASSET,
      CANDIDATES_ASSET,
      DOORS_ASSET,
    ]) {
      sharpen(assets.model(id), context.quality.anisotropy);
    }

    this.building = createBuilding(assets.model(EXTERIOR_ASSET));
    this.lining = findByMaterial(this.building.object, 'recess');
    this.construction = createBuilding(assets.model(CONSTRUCTION_ASSET));
    this.slotFill = createBuilding(assets.model(SLOT_FILL_ASSET));
    this.candidates = findParts(assets.model(CANDIDATES_ASSET), REVIEW.count).map(createBakedPart);
    this.entrance = createEntrance(assets.model(DOORS_ASSET));

    this.parts = [this.building, this.construction, this.slotFill, ...this.candidates];
    stage.add(...this.parts.map((part) => part.object), this.entrance.object);

    // Act I starts with the bay empty and the facade options off screen.
    this.slotFill.object.visible = false;
    this.setReview(0, false);

    const pmrem = new PMREMGenerator(context.renderer);
    this.environment = pmrem.fromEquirectangular(this.sky).texture;
    pmrem.dispose();

    context.world.setBackground(this.sky);
    context.world.setEnvironment(this.environment);

    this.cloud = new CloudShell(clouded(EXTERIOR_ATMOSPHERE), context.quality);
    stage.add(this.cloud.mesh);
  }

  /**
   * Moves the facade options on or off site. This always happens off screen,
   * during scenes that face the building, after the camera move ends.
   */
  private setReview(presence: number, animate: boolean): void {
    // Only on a change, so the tween is not restarted.
    if (presence === this.presence) return;
    this.presence = presence;

    const last = this.candidates.length - 1;
    // Direction away from the building. Positions are the offset from
    // `REVIEW.baked` to `REVIEW.centre`, plus the travel.
    const away = Math.sign(REVIEW.centre[0]);
    const rest = REVIEW.centre[0] - REVIEW.baked;

    this.candidates.forEach((candidate, index) => {
      const { object } = candidate;
      // The panel nearest the building arrives first, so panels never cross.
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

  /**
   * Removes or restores the scaffold. Going forward it waits for the camera to
   * reach `gaps` (which faces away). Going back it restores at once, before the
   * camera turns to face it. Both are instant cuts done off screen.
   */
  private setScaffold(standing: boolean, animate: boolean): void {
    if (standing === this.scaffolded) return;
    this.scaffolded = standing;

    this.strike?.kill();
    this.strike = null;

    if (!animate || standing) {
      this.construction.object.visible = standing;
      return;
    }

    this.strike = gsap.delayedCall(REVIEW_HOLD, () => {
      this.construction.object.visible = this.scaffolded;
    });
  }

  /**
   * The dark recess lining fakes depth from outside. Once the corridor is
   * present it must be hidden, because its floor lies in the same plane as the
   * corridor floor and shows as a dark band.
   */
  private setLining(): void {
    for (const part of this.lining) part.visible = !this.beyond;
  }

  /** Restores the sky and environment, which the corridor clears. */
  takeSky(): void {
    this.context.world.setBackground(this.sky);
    this.context.world.setEnvironment(this.environment);
  }

  setProgress(progress: number, animate: boolean): void {
    // Driven by deck position, so jumping back to the title closes the cloud.
    this.cloud.setCover(progress <= CLOUD.clears ? 1 : 0, animate);

    const onStage = progress >= REVIEW.from && progress <= REVIEW.to;
    this.setReview(onStage ? 1 : 0, animate);
    this.setScaffold(progress < CONSTRUCTION.struck, animate);
    // Doors stay shut in Act I, including after jumping back from the corridor.
    // `setThreshold` handles opening.
    this.entrance.open(0, 0);
    this.entrance.seal(!this.beyond);
    this.setLining();
  }

  setBeyond(present: boolean): void {
    this.beyond = present;
    this.entrance.seal(!present);
    this.setLining();
  }

  /**
   * Opens the doors at `DOORS_AT` of the camera move, so they are already
   * opening as the camera approaches. See `animations/entry.ts`. The timer is
   * killed with the zone.
   */
  setThreshold(open: boolean, seconds: number): void {
    this.entrance.seal(!open && !this.beyond);

    this.threshold?.kill();

    if (!open || seconds <= 0) {
      this.entrance.open(open ? 1 : 0, 0);
      return;
    }

    this.threshold = gsap.delayedCall(scaled(seconds * DOORS_AT), () => {
      this.entrance.open(1, ENTRANCE_TRAVEL_SECONDS);
    });
  }

  update(dt: number): void {
    this.cloud.update(dt, this.context.camera, this.context.world.exposure);
    this.planting.update(dt);
    this.parkland.update(dt);
    this.woodland.update(dt);
    this.lake.update(dt);
    this.river.update(dt);
  }

  suspend(): void {
    this.threshold?.kill();
    this.strike?.kill();
    for (const candidate of this.candidates) gsap.killTweensOf(candidate.object.position);
    this.beyond = false;
  }

  dispose(): void {
    for (const candidate of this.candidates) gsap.killTweensOf(candidate.object.position);
    this.strike?.kill();
    this.threshold?.kill();
    this.entrance.dispose();
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
    this.outcrop.dispose();
    for (const part of this.parts) part.dispose();
    this.cloud.dispose();
    this.environment.dispose();
    this.sky.dispose();
  }
}

export const exteriorZone: ZoneDefinition = {
  id: 'exterior',
  origin: ZONE_ORIGIN.exterior,
  atmosphere: EXTERIOR_ATMOSPHERE,
  // Covers the building's and trees' shadows.
  shadow: { radius: BUILDING_HEIGHT * 3.4, far: BUILDING_HEIGHT * 11 },
  create: (context) => new Exterior(context),
};
