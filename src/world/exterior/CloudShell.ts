import gsap from 'gsap';
import {
  BackSide,
  Color,
  GLSL3,
  Mesh,
  ShaderMaterial,
  SphereGeometry,
  Vector2,
  Vector3,
  type Data3DTexture,
  type PerspectiveCamera,
} from 'three';
import { seconds } from '@/animations/timing';
import type { QualitySettings } from '@/config/quality';
import type { Atmosphere } from '@/engine/render/atmosphere';
import { createCloudNoise } from './cloudNoise';

/** Arbitrary: depth testing is off, so this only has to enclose the eye. */
const RADIUS = 50;
const RENDER_ORDER = 900;

/**
 * Linear gain, so ACES hands the cloud back as white.
 *
 * Learnings §59 puts ~2.8x at white for this exposure and this sits under it:
 * ACES compresses hard above about 0.8 linear, so a field driven to the
 * clipping point lands its brightest cloud and its deepest mass a few percent
 * apart and the whole thing goes to ghost. Referenced to the air's own exposure
 * so the descent's grading cannot move it.
 */
const GAIN = 2.1;

/** World metres per repeat of the noise texture. Sets the size of a mass. */
const TILE_METRES = 250;
/**
 * How far down a ray the march is willing to go before it gives up.
 *
 * Not a step size: the march spans the *deck*, not a fixed distance from the
 * eye. A ray aimed steeply down crosses seventy metres of cloud and a ray aimed
 * near the horizon crosses hundreds, and a fixed stride either wastes its whole
 * budget in the air above the deck on the shallow one or oversamples the steep
 * one. Solving for where the ray enters and leaves the slab and dividing *that*
 * span by the step count spends every sample inside the cloud, which is most of
 * why thirty steps is enough to hold a horizon.
 *
 * This is the far cap on that span, and so the distance at which the deck
 * stops being drawn and becomes the air's own haze.
 */
const MAX_DISTANCE = 620;
/**
 * Ceiling on the stride, and so — times the step count — how far the march
 * reaches before the bank gives way to haze.
 *
 * **Generous, because the mip chain makes a long stride safe.** This was seven
 * while the field was sampled at full resolution, since anything longer stippled;
 * with each stride now reading the field pre-averaged at its own scale, the cap
 * is free to buy distance instead of paying for detail nothing could resolve.
 * Reach is what keeps the far deck closed — cut it and the bank breaks up and
 * the ground shows through.
 */
const MAX_STEP = 14;
const LIGHT_STEP_METRES = 20;
const EXTINCTION = 0.095;
const LIGHT_EXTINCTION = 0.14;
/**
 * Which horizontal slice of the noise decides the shape of the deck's top.
 *
 * Arbitrary, and it only has to be *fixed*: read at the sample's own height the
 * field varies vertically as well, and the roof it produces would then depend
 * on where you were standing when you asked. Drifted by the wind's vertical
 * component so the crowns evolve rather than only translate.
 */
const SLICE = 0.31;
/** How hard the finer bands carve the boundary into turrets. */
const ERODE = 0.58;

/** Where plan coverage becomes a tower rather than clear air. */
const THRESHOLD = 0.33;

/** Frequency of the carving bands against the body's own. */
/**
 * Frequency of the carving bands against the body's own.
 *
 * **Bounded by the ray step, not by taste.** The texture's finer channels have
 * periods of eight and sixteen cells, which over a 250 m tile is detail at
 * thirty and sixteen metres. Multiplied up to 3.4 they became nine and five,
 * far under the stride the march can afford — and a jittered march sampling
 * below its own detail does not soften, it stipples. Kept near one, the carving
 * lands at a scale the ray can actually resolve.
 */
const DETAIL_SCALE = 1.5;

/** Edge of the noise texture, in voxels. Mirrors `cloudNoise.ts`. */
const NOISE_SIZE = 64;

/**
 * Henyey-Greenstein asymmetry: how forward-biased the scattering is.
 *
 * Cloud droplets are far larger than the wavelength, so they throw light
 * overwhelmingly in the direction it was already going. This is the number that
 * makes a crown blinding when the sun is behind it and its core nearly black at
 * the same moment, which is the entire look of a backlit cumulus and something
 * no exposure adjustment can fake.
 */
const HG = 0.62;

/**
 * Drift of the sampling position, in texture units per second.
 *
 * **This is the "moves slightly", and it is why the field is sampled in world
 * space.** Sliding a panorama moves the picture. Moving the sample position
 * moves the eye's relationship to a volume, so masses change shape, pass one
 * another and open up. Slow enough that nobody would call it an animation, and
 * present enough that the frame is never dead.
 */
const WIND = { x: 0.0031, y: 0.0011, z: -0.0022 } as const;

/**
 * The bank: the world heights its bases sit at and its tallest crowns reach.
 *
 * **This is the change that made it read as cloud at all.** Every earlier cut
 * put the camera *inside* an unbounded volume, and from inside a cloud there
 * are no silhouettes — scattering is isotropic, every direction looks the same,
 * and what the eye is handed is a fog with no form in it. A cloud is only
 * legible as a cloud when you can see its *shape* against something brighter,
 * which means seeing it from outside. A chamber, not an immersion.
 *
 * So the field is a layer with a floor and a ceiling, the camera stands above
 * the ceiling looking across the tops, and the sun lights them from above:
 * bright crowns, shaded flanks, silhouettes receding into haze. The descent
 * then sinks through the deck and comes out underneath it, which is also what
 * finally hides the empty ground past the edge of the built world — the deck is
 * opaque at every shallow angle, so the horizon is never in frame at all.
 */
const BAND = { base: 46, top: 262 } as const;

/** Slack on the marched slab, so the feathered base is inside it. */
const FEATHER = 12;

/**
 * When the cloud lets go, against the descent it happens inside.
 *
 * **It gets out of the way early, and that is the point of the beat.** An
 * earlier cut held it solid through the first half of a seven-second move, on
 * the reasoning that cloud has a base and an aircraft comes out of it all at
 * once. True of aeroplanes and wrong here: it spent four seconds of the opening
 * on a white frame with nothing happening in it. The cloud is the *title's*
 * ground, not the descent's — once the card has gone, the sooner the world is
 * visible the better, and the rest of the fall is a flight down to the water.
 */
const OPENING = { holds: 0.35, over: 1.7, closes: 0.55 } as const;

/** Sun on the crowns, and the sky's own light filling the flanks. */
const SUN_COLOR = 0xfff2dc;
const AMBIENT_COLOR = 0x46566e;
/** What the deck fades into with distance, and the value of the air itself. */
const HAZE_COLOR = 0x9db2c9;
const HAZE = { near: 150, far: 780 } as const;

const VERTEX = /* glsl */ `
out vec3 vWorld;

void main() {
  vec4 world = modelMatrix * vec4(position, 1.0);
  vWorld = world.xyz;
  gl_Position = projectionMatrix * viewMatrix * world;
}
`;

const FRAGMENT = /* glsl */ `
precision highp float;
precision highp sampler3D;

in vec3 vWorld;

// **Declared, not inherited.** GLSL ES 3.00 removed the built-in output, and unlike
// the GLSL1 path three.js does not alias it back in for a GLSL3 material — a
// shader written against it draws every frame and writes nowhere, silently and
// with no compile error to find it by. The mesh was rendering fifty-odd times a
// second into nothing at all.
layout(location = 0) out highp vec4 fragColor;

uniform sampler3D uNoise;
uniform float uTime;
uniform float uCover;
uniform float uGain;
uniform vec3 uSun;
uniform vec3 uSunColor;
uniform vec3 uAmbient;
uniform vec3 uHaze;
uniform vec2 uBand;

const float SCALE = ${(1 / TILE_METRES).toFixed(7)};
const float MAX_DISTANCE = ${MAX_DISTANCE.toFixed(1)};
const float MAX_STEP = ${MAX_STEP.toFixed(2)};
const float HAZE_NEAR = ${HAZE.near.toFixed(1)};
const float HAZE_FAR = ${HAZE.far.toFixed(1)};
const float LIGHT_STEP = ${LIGHT_STEP_METRES.toFixed(2)};
const float EXTINCTION = ${EXTINCTION.toFixed(4)};
const float LIGHT_EXTINCTION = ${LIGHT_EXTINCTION.toFixed(4)};
const float ERODE = ${ERODE.toFixed(3)};
const float SLICE = ${SLICE.toFixed(3)};
const float THRESHOLD = ${THRESHOLD.toFixed(3)};
const float DETAIL_SCALE = ${DETAIL_SCALE.toFixed(2)};
const float DETAIL_LOD = ${Math.log2(DETAIL_SCALE).toFixed(4)};
const float VOXEL_METRES = ${(TILE_METRES / NOISE_SIZE).toFixed(4)};
const float HG_G2 = ${(HG * HG).toFixed(5)};
const float HG_2G = ${(2 * HG).toFixed(5)};
const float HG_K = ${((1 - HG * HG) / (4 * Math.PI)).toFixed(6)};
const float FEATHER = ${FEATHER.toFixed(1)};
const vec3 WIND = vec3(${WIND.x.toFixed(5)}, ${WIND.y.toFixed(5)}, ${WIND.z.toFixed(5)});

// **Towers, not a deck.** A layer read from above is a landscape of low swells
// and it photographs as fog with a horizon. Convective cloud is the opposite
// shape: it stands *up*, it is read from the side against the sky, and its
// whole character is that every lobe is made of smaller lobes made of smaller
// ones again. Three things build that here.
//
// Where a tower stands is decided in plan, from one horizontal slice, so a
// column of air is either cloudy for its whole height or clear.
//
// How tall it grows and how it tapers is the vertical profile: pinched at the
// base where it is still rising, widest through the body, breaking up towards
// the crown. A tower over thick plan coverage climbs further than one over thin,
// which is what gives a bank its skyline instead of a flat ceiling.
//
// And the cauliflower is erosion. The fine bands are *subtracted* from the
// coarse body, remapped so the core keeps full density and only the boundary is
// carved — detail added on top thickens a cloud uniformly and reads as noise,
// detail taken away from the edges reads as turrets.
float density(vec3 p, float lod, bool carve) {
  vec3 q = p * SCALE + WIND * uTime;

  float height = clamp((p.y - uBand.x) / (uBand.y - uBand.x), 0.0, 1.0);

  // **The body is read in 3D, not in plan.** Taking the cross-section from a
  // horizontal slice and tapering it by height builds a cone: the section is the
  // same shape all the way up and only shrinks, which is a mountain rather than
  // a cloud. Sampling the volume itself gives every level its own lumpy outline.
  float shape = textureLod(uNoise, q, lod).r;

  // Plan coverage decides only how *tall* a column grows, so a bank has a
  // skyline instead of a flat ceiling.
  float reach = textureLod(uNoise, vec3(q.x, SLICE + WIND.y * uTime, q.z), lod).r;
  float ceiling = 0.24 + reach * 0.72;

  // Pinched where it is still rising, cut off where it has run out of lift. The
  // upper edge is deliberately short, so crowns break rather than taper away.
  // Pinched where it is still rising, cut off where it has run out of lift. The
  // upper edge is deliberately short, so crowns break rather than taper away.
  float profile = smoothstep(0.0, 0.17, height) * (1.0 - smoothstep(ceiling - 0.13, ceiling, height));
  if (profile <= 0.0) return 0.0;

  // Wider than it was: a narrow ramp between cloud and clear air is a step
  // edge, and a step edge is the one thing a fixed stride cannot sample without
  // aliasing however finely it is jittered.
  float body = smoothstep(THRESHOLD, THRESHOLD + 0.3, shape * profile);
  if (body <= 0.0) return 0.0;

  // **The light march does not carve.** Occlusion is an integral over tens of
  // metres and the turrets contribute nothing to it that survives the average,
  // so skipping the second lookup there halves the shading's texture traffic
  // and takes its noise out of the frame at the same time.
  if (!carve) return body;

  vec4 fine = textureLod(uNoise, q * DETAIL_SCALE, lod + DETAIL_LOD);
  float detail = fine.g * 0.5 + fine.b * 0.5;

  // Remap rather than plain subtraction: the core stays solid and the carving
  // is spent entirely on the boundary, which is where turrets live.
  float bite = detail * ERODE;
  return clamp((body - bite) / max(1.0 - bite, 0.05), 0.0, 1.0);
}

void main() {
  vec3 origin = cameraPosition;
  vec3 direction = normalize(vWorld - cameraPosition);

  // Where this ray enters and leaves the deck. Feathered faces are part of the
  // cloud, so the slab solved against is the full extent of the field.
  float low = uBand.x - FEATHER;
  float high = uBand.y;

  float near = 0.0;
  float far = MAX_DISTANCE;

  if (abs(direction.y) < 0.0005) {
    // Travelling flat: either inside the layer for the whole ray, or never.
    if (origin.y < low || origin.y > high) discard;
  } else {
    float a = (low - origin.y) / direction.y;
    float b = (high - origin.y) / direction.y;
    near = max(min(a, b), 0.0);
    far = min(max(a, b), MAX_DISTANCE);
    if (far <= near) discard;
  }

  // **Capped, because the span is what was aliasing.** A ray near the horizon
  // crosses most of a kilometre of bank, and dividing that by the step count
  // put thirty metres between samples in a field whose detail is finer than
  // that — which arrives as the crawling speckle a jittered march produces when
  // it is undersampling. Beyond the cap the far cloud is simply not drawn, and
  // the haze it would have faded into is already there.
  float stepSize = min((far - near) / float(STEPS), MAX_STEP);
  far = min(far, near + stepSize * float(STEPS));

  // How much of the field one stride covers, as a mip level. This is what ties
  // the detail the march reads to the detail it can actually resolve.
  float lod = max(log2(stepSize / VOXEL_METRES), 0.0);

  // Dithered start, so a fixed step does not lay banded shells across the
  // frame. The offset is under one step and the integration absorbs it.
  float jitter = fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233))) * 43758.5453);
  float t = near + jitter * stepSize;

  // How nearly this ray is looking down the sun's own direction, which is what
  // decides whether cloud in front of it glows or silhouettes.
  float mu = dot(direction, uSun);

  vec3 accumulated = vec3(0.0);
  float transmittance = 1.0;

  for (int i = 0; i < STEPS; i++) {
    vec3 p = origin + direction * t;
    float d = density(p, lod, true);

    if (d > 0.002) {
      // How much sun reaches this sample, by Beer's law along a short march
      // towards it. Two or three taps is enough: the field is smooth, and what
      // comes out is a soft gradient across a billow rather than a shadow edge.
      float occlusion = 0.0;
      for (int j = 1; j <= LIGHT_STEPS; j++) {
        occlusion += density(p + uSun * (float(j) * LIGHT_STEP), lod + 1.0, false);
      }
      float sunlight = exp(-occlusion * LIGHT_EXTINCTION * LIGHT_STEP);

      // Aerial perspective across the deck. Without it every crown out to the
      // far cap is lit the same and the field reads as a textured plane a few
      // metres wide; with it the far ones sink into the air and the deck gets
      // the one thing that tells the eye how big it is.
      // **Forward scattering, which is what a backlit cloud actually is.**
      // Beer's law alone gives a grey ball with a dark side; the reason a
      // cumulus edge against the sun is blinding while its core is nearly
      // black is that droplets throw light overwhelmingly *forwards*. The
      // phase term is that bias, and without it no amount of exposure produces
      // the rim.
      float phase = HG_K / pow(1.0 + HG_G2 - HG_2G * mu, 1.5);

      vec3 lit = uAmbient + uSunColor * sunlight * (0.35 + phase);
      lit = mix(lit, uHaze, smoothstep(HAZE_NEAR, HAZE_FAR, t));
      float alpha = 1.0 - exp(-d * EXTINCTION * stepSize);

      accumulated += transmittance * alpha * lit;
      transmittance *= 1.0 - alpha;

      if (transmittance < 0.012) break;
    }

    t += stepSize;
  }

  // **Premultiplied, and the alpha is the cloud's own coverage.** Filling the
  // gaps with a painted haze made the shell an opaque backdrop, so the only way
  // out of it was to dissolve the whole thing. Handing the compositor what the
  // march actually found instead means the deck occludes where it is thick and
  // lets the world through where it is not — which is how a descent *through* a
  // layer reads, near cloud clearing from the bottom of the frame first, with
  // no dissolve involved at all.
  float coverage = (1.0 - transmittance) * uCover;
  fragColor = vec4(accumulated * uGain * uCover, coverage);
}
`;

/**
 * The cloud the defence opens inside, raymarched.
 *
 * **Not a picture of cloud on a sphere, which is what this was.** Three earlier
 * cuts painted a fractal field onto an equirectangular panorama and hung it
 * around the camera, and every one read as a painted surface however the field
 * was tuned — because that is what it was. Two things give it away and neither
 * is reachable by tuning. A panorama has no depth, so its masses have no
 * relationship to one another and the eye finds no volume to be inside of. And
 * a panorama on a camera-centred sphere can only be *moved* by rotating it,
 * which slides the whole image rigidly; cloud does not slide, it evolves, and a
 * rigid slide is the clearest tell that a backdrop is a backdrop.
 *
 * The geometry here is a carrier and nothing else. Every fragment walks a ray
 * out from the eye through a tiling 3D density field, accumulating light front
 * to back and taking a short march towards the sun at each step to find how
 * much of it arrives. That buys the three things the painted versions could
 * not: masses that occlude each other and so read as distance, soft
 * self-shadowed billows that come from integrating a volume rather than from
 * blurring an edge, and — because the field is sampled in world space — real
 * parallax as the camera falls, with evolution from drifting the sample
 * position rather than turning the picture.
 *
 * **Drawn over the world rather than behind it.** Cloud the camera is inside
 * sits between the eye and everything else, so the world does not appear from
 * behind a curtain: it resolves through a medium that is thinning. Depth
 * testing is off for the same reason — from inside, the near bank covers a tree
 * at forty metres and a ridge at four hundred equally.
 *
 * The shell carries the *look*; `clouded()` in `atmosphere.ts` carries the
 * *depth*. Fading it alone would reveal a pin-sharp site behind a dissolving
 * veil, which is a wipe. Opening the fog underneath is what makes near things
 * arrive before far ones.
 */
export class CloudShell {
  private readonly noise: Data3DTexture;
  private readonly geometry = new SphereGeometry(RADIUS, 24, 16);
  private readonly material: ShaderMaterial;
  readonly mesh: Mesh;

  private tween: gsap.core.Tween | null = null;
  private elapsed = 0;

  constructor(
    private readonly air: Atmosphere,
    quality: QualitySettings,
  ) {
    this.noise = createCloudNoise();

    this.material = new ShaderMaterial({
      glslVersion: GLSL3,
      vertexShader: VERTEX,
      fragmentShader: FRAGMENT,
      // Compile-time so the loops unroll, which is worth a useful fraction of
      // the march on integrated graphics, and so the ladder can buy the frame
      // back on a machine that needs it.
      defines: {
        STEPS: String(quality.cloudSteps),
        LIGHT_STEPS: String(quality.cloudLightSteps),
      },
      uniforms: {
        uNoise: { value: this.noise },
        uTime: { value: 0 },
        uCover: { value: 1 },
        uGain: { value: GAIN },
        uSun: { value: new Vector3() },
        uSunColor: { value: new Color(SUN_COLOR) },
        uAmbient: { value: new Color(AMBIENT_COLOR) },
        uHaze: { value: new Color(HAZE_COLOR) },
        uBand: { value: new Vector2(BAND.base, BAND.top) },
      },
      transparent: true,
      // The march accumulates light already weighted by how much of the ray it
      // covered, which is a premultiplied colour by construction. Told
      // otherwise, three.js divides it back out against an alpha it does not
      // have and thin cloud blows out.
      premultipliedAlpha: true,
      depthTest: false,
      depthWrite: false,
      side: BackSide,
    });

    const sun = this.material.uniforms['uSun']?.value as Vector3;
    sun.set(air.keyOffset[0], air.keyOffset[1], air.keyOffset[2]).normalize();

    this.mesh = new Mesh(this.geometry, this.material);
    // Late in the transparent pass, so it covers everything the world drew.
    this.mesh.renderOrder = RENDER_ORDER;
    this.mesh.frustumCulled = false;
  }

  /**
   * How much cloud is between the eye and the world, 0 to 1.
   *
   * Visibility follows the value rather than the tween, so a cleared shell
   * costs nothing for the remaining twenty scenes of the deck — which for a
   * raymarched material is the difference between a full-screen march every
   * frame and no draw call at all.
   */
  setCover(cover: number, animate: boolean): void {
    this.tween?.kill();
    this.tween = null;

    const uniform = this.material.uniforms['uCover'];
    if (!uniform) return;

    if (!animate) {
      uniform.value = cover;
      this.mesh.visible = cover > 0;
      return;
    }

    this.mesh.visible = true;
    // **Coming back is not the reverse of leaving.** Clearing takes its time
    // because that is what descending out of a base looks like. Played
    // backwards, a presenter jumping to the title card during questions watched
    // seconds of open world before the cloud closed over it; restoring is a
    // return to a state, so it is quick.
    const closing = cover > (uniform.value as number);

    this.tween = gsap.to(uniform, {
      value: cover,
      duration: seconds(closing ? OPENING.closes : OPENING.over),
      delay: closing ? 0 : seconds(OPENING.holds),
      // Linear on the way out. Every eased curve spends most of its length near
      // one end, which on a dissolve means either a long plateau or a snap.
      ease: closing ? 'power2.out' : 'none',
      onComplete: () => {
        this.mesh.visible = (uniform.value as number) > 0;
      },
    });
  }

  update(dt: number, camera: PerspectiveCamera, exposure: number): void {
    if (!this.mesh.visible) return;

    this.elapsed += dt;
    this.mesh.position.copy(camera.position);
    // The camera is in world space and the shell hangs off the zone group,
    // which stands at the zone origin. Copied straight across it lands an
    // origin away from the eye, and a back-faced sphere seen from outside draws
    // nothing at all.
    this.mesh.parent?.worldToLocal(this.mesh.position);

    const { uniforms } = this.material;
    if (uniforms['uTime']) uniforms['uTime'].value = this.elapsed;

    // **The cloud does not answer to the world's light.** Exposure moves with
    // the air, and the beat this opens onto is `recessed` — three tenths darker
    // than the zone it is in. Left alone the cloud dimmed with it and the
    // reveal played out behind a sheet of grey. `RenderPipeline` ends in an
    // `OutputPass`, so ACES runs over the whole framebuffer and no material can
    // opt out of it (learnings §59); cancelling the exposure in the shader's
    // own output is the only way to hold a value through the curve.
    if (uniforms['uGain']) {
      uniforms['uGain'].value = GAIN * (this.air.exposure / Math.max(exposure, 0.05));
    }
  }

  dispose(): void {
    this.tween?.kill();
    this.geometry.dispose();
    this.material.dispose();
    this.noise.dispose();
  }
}
