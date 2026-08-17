import gsap from 'gsap';
import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  Color,
  Group,
  Mesh,
  ShaderMaterial,
  UniformsLib,
  UniformsUtils,
} from 'three';
import { FLOW, FLOW_ROUTES, SECTION, type PlanPoint } from '@/config/corridor';

const TEAL = 0x2dd4a7;

const CORNER = { radius: 1.5, samples: 8 } as const;

/**
 * A channel, and what travels in it.
 *
 * Every route here is inference-time, so each carries discrete tokens moving at
 * a legible speed, and branches. The design-time edge C2 -> C5 is not drawn:
 * see `decisions.md` §40 and `world_design.md` §8.1.
 *
 * Drawn only once the roof is off. Ambient and always on, it put a saturated
 * teal strip down the middle of every station shot - a claim about the whole
 * pipeline made five times while the presenter talks about one contribution.
 *
 * Inlaid in the floor rather than at eye level: a horizontal ribbon 27 cm under
 * the camera floods the bottom of the frame (`learnings.md` §52).
 */
const CHANNEL = {
  y: SECTION.floor + 0.03,
  width: FLOW.width,
  speed: 2.6,
  pitch: 3.4,
  duty: 0.3,
  soft: 0.34,
  base: 0.22,
  lead: 1.0,
  edge: 0.42,
  fade: 1.6,
} as const;

const VERTEX = `
attribute float aU;
attribute float aV;
varying float vU;
varying float vV;
varying float vDepth;
void main() {
  vU = aU;
  vV = aV;
  vec4 seen = modelViewMatrix * vec4(position, 1.0);
  vDepth = -seen.z;
  gl_Position = projectionMatrix * seen;
}
`;

const FRAGMENT = `
uniform vec3 uColor;
uniform float uTime;
uniform float uSpeed;
uniform float uPitch;
uniform float uDuty;
uniform float uSoft;
uniform float uBase;
uniform float uLead;
uniform float uOrigin;
uniform float uHead;
uniform float uTrace;
uniform float uEdge;
uniform float uFade;
uniform float uSpan;
uniform float uReveal;
uniform vec3 fogColor;
uniform float fogNear;
uniform float fogFar;
varying float vU;
varying float vV;
varying float vDepth;
void main() {
  float core = smoothstep(0.0, uEdge, 1.0 - abs(vV));
  float ends = smoothstep(0.0, uFade, vU) * smoothstep(0.0, uFade, uSpan - vU);
  float phase = fract((vU - uTime * uSpeed) / uPitch);
  float token = 1.0 - smoothstep(uDuty, uDuty + uSoft, phase);
  float lead = uOrigin + vU - uHead;
  float wake = lead > 0.0 ? 4.2 : 11.0;
  float trace = uTrace * (1.0 - smoothstep(0.0, wake, abs(lead)));
  float level = uBase + token * token * uLead + trace * trace * 3.0;
  float haze = 1.0 - smoothstep(fogNear, fogFar, vDepth);
  float alpha = core * ends * haze * uReveal;
  if (alpha < 0.004) discard;
  gl_FragColor = vec4(uColor * level, alpha);
}
`;

export interface Flow {
  readonly object: Group;
  update(dt: number): void;
  /**
   * Draws the network and releases one token at the mouth, following it to C5
   * through both branches. Off, the ribbons are not drawn at all — in Act II
   * the flow does not exist. `settle` puts it at rest for a beat reached
   * backwards or by jump.
   */
  trace(on: boolean, settle: boolean): void;
  suspend(): void;
  dispose(): void;
}

/**
 * The pipeline, running. One ribbon per route, animated entirely in the fragment
 * shader against a shared clock, so the overhead pose costs what a station pose
 * costs. It belongs to the zone rather than any scene: sixteen scenes look at it.
 */
export function createFlow(): Flow {
  const object = new Group();
  object.name = 'flow';
  object.visible = false;

  const lengths = new Map<number, number>();
  const built = FLOW_ROUTES.map((route) => {
    const geometry = ribbon(route.points, CHANNEL.width, CHANNEL.y);
    const span = geometry.userData['span'] as number;
    lengths.set(route.stage, Math.max(lengths.get(route.stage) ?? 0, span));
    return { route, geometry, span };
  });

  const origins = new Map<number, number>();
  let reached = 0;
  for (const stage of [...lengths.keys()].sort((a, b) => a - b)) {
    origins.set(stage, reached);
    reached += lengths.get(stage) ?? 0;
  }

  const materials = built.map(({ route, geometry, span }) => {
    const material = channel(origins.get(route.stage) ?? 0, span);
    const mesh = new Mesh(geometry, material);
    mesh.name = `flow:${route.key}`;
    mesh.renderOrder = 2;
    object.add(mesh);
    return material;
  });

  const network = reached;
  let clock = 0;
  let running: gsap.core.Tween | null = null;
  const shown = { level: 0 };
  let fading: gsap.core.Tween | null = null;

  const set = (name: string, value: number): void => {
    for (const material of materials) {
      const uniform = material.uniforms[name];
      if (uniform) uniform.value = value;
    }
  };

  const show = (on: boolean, settle: boolean): void => {
    fading?.kill();
    fading = null;

    if (!on || settle) {
      shown.level = on ? 1 : 0;
      set('uReveal', shown.level);
      object.visible = on;
      return;
    }

    object.visible = true;
    fading = gsap.fromTo(
      shown,
      { level: 0 },
      {
        level: 1,
        duration: REVEAL.seconds,
        delay: REVEAL.delay,
        ease: 'power2.out',
        onUpdate: () => set('uReveal', shown.level),
      },
    );
  };

  return {
    object,

    update(dt) {
      clock += dt;
      set('uTime', clock);
    },

    trace(on, settle) {
      if (on && running) return;

      running?.kill();
      running = null;

      show(on, settle);

      if (!on) {
        set('uTrace', 0);
        return;
      }

      set('uTrace', 1);

      const head = { at: -TRACE_WAKE };
      running = gsap.fromTo(
        head,
        { at: -TRACE_WAKE },
        {
          at: network + TRACE_WAKE,
          duration: TRACE_SECONDS,
          ease: 'none',
          repeat: -1,
          repeatDelay: TRACE_REST,
          onUpdate: () => set('uHead', head.at),
        },
      );
      if (settle) running.progress(0.5);
    },

    suspend() {
      running?.kill();
      running = null;
      fading?.kill();
      fading = null;
    },

    dispose() {
      running?.kill();
      fading?.kill();
      for (const material of materials) material.dispose();
      for (const { geometry } of built) geometry.dispose();
    },
  };
}

const TRACE_SECONDS = 6.4;
const TRACE_REST = 1.4;
/** How far the pulse's tail reaches behind it, and how far it starts outside. */
const TRACE_WAKE = 12;

const REVEAL = { delay: 3.0, seconds: 1.8 } as const;

function channel(origin: number, span: number): ShaderMaterial {
  const spec = CHANNEL;
  return new ShaderMaterial({
    uniforms: UniformsUtils.merge([
      UniformsLib.fog,
      {
        uColor: { value: new Color(TEAL) },
        uTime: { value: 0 },
        uSpeed: { value: spec.speed },
        uPitch: { value: spec.pitch },
        uDuty: { value: spec.duty },
        uSoft: { value: spec.soft },
        uBase: { value: spec.base },
        uLead: { value: spec.lead },
        uOrigin: { value: origin },
        uHead: { value: -1e4 },
        uTrace: { value: 0 },
        uEdge: { value: spec.edge },
        uFade: { value: spec.fade },
        uSpan: { value: span },
        uReveal: { value: 0 },
      },
    ]),
    vertexShader: VERTEX,
    fragmentShader: FRAGMENT,
    transparent: true,
    blending: AdditiveBlending,
    depthWrite: false,
    fog: true,
  });
}

/**
 * A plan polyline turns corners; it does not kink.
 *
 * Same rule the drawing follows in `ContributionMap`, and for the same reason:
 * a mitred right angle in a ribbon reads as two separate lines meeting, where a
 * turned one reads as one route changing direction.
 */
function rounded(points: readonly PlanPoint[], radius: number): PlanPoint[] {
  if (points.length < 3) return [...points];

  const out: PlanPoint[] = [points[0] as PlanPoint];

  for (let index = 1; index < points.length - 1; index += 1) {
    const previous = points[index - 1] as PlanPoint;
    const corner = points[index] as PlanPoint;
    const next = points[index + 1] as PlanPoint;

    const back = toward(corner, previous);
    const on = toward(corner, next);
    const reach = Math.min(radius, distance(corner, previous) / 2, distance(corner, next) / 2);

    const start: PlanPoint = [corner[0] + back[0] * reach, corner[1] + back[1] * reach];
    const end: PlanPoint = [corner[0] + on[0] * reach, corner[1] + on[1] * reach];

    out.push(start);
    for (let step = 1; step < CORNER.samples; step += 1) {
      const t = step / CORNER.samples;
      const a: PlanPoint = [
        start[0] + (corner[0] - start[0]) * t,
        start[1] + (corner[1] - start[1]) * t,
      ];
      const b: PlanPoint = [
        corner[0] + (end[0] - corner[0]) * t,
        corner[1] + (end[1] - corner[1]) * t,
      ];
      out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]);
    }
    out.push(end);
  }

  out.push(points[points.length - 1] as PlanPoint);
  return out;
}

/**
 * A flat ribbon through the plan, carrying its own arclength.
 *
 * `aU` is metres travelled and `aV` is −1 to 1 across, so the shader animates
 * against real distance: a token's speed is metres per second everywhere in the
 * network, whatever the route's shape, and the pitch that separates them is a
 * length the eye can compare against the building.
 *
 * The plan is authored with z running into the corridor; the world runs the
 * other way, and this is the one place that is turned round.
 */
function ribbon(points: readonly PlanPoint[], width: number, y: number): BufferGeometry {
  const path = rounded(points, CORNER.radius);
  const half = width / 2;

  const positions = new Float32Array(path.length * 6);
  const us = new Float32Array(path.length * 2);
  const vs = new Float32Array(path.length * 2);

  let travelled = 0;

  for (let index = 0; index < path.length; index += 1) {
    const here = path[index] as PlanPoint;
    if (index > 0) travelled += distance(here, path[index - 1] as PlanPoint);

    const before = path[index - 1] ?? here;
    const after = path[index + 1] ?? here;
    const tangent = toward(before, after);
    const normal: PlanPoint = [tangent[1], -tangent[0]];

    for (const side of [-1, 1]) {
      const vertex = (index * 2 + (side < 0 ? 0 : 1)) * 3;
      positions[vertex] = here[0] + normal[0] * half * side;
      positions[vertex + 1] = y;
      positions[vertex + 2] = -(here[1] + normal[1] * half * side);
      us[index * 2 + (side < 0 ? 0 : 1)] = travelled;
      vs[index * 2 + (side < 0 ? 0 : 1)] = side;
    }
  }

  const indices: number[] = [];
  for (let index = 0; index + 1 < path.length; index += 1) {
    const a = index * 2;
    indices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
  }

  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new BufferAttribute(positions, 3));
  geometry.setAttribute('aU', new BufferAttribute(us, 1));
  geometry.setAttribute('aV', new BufferAttribute(vs, 1));
  geometry.setIndex(indices);
  geometry.computeBoundingSphere();
  geometry.userData['span'] = travelled;
  return geometry;
}

const distance = (a: PlanPoint, b: PlanPoint): number => Math.hypot(b[0] - a[0], b[1] - a[1]);

function toward(from: PlanPoint, to: PlanPoint): PlanPoint {
  const reach = distance(from, to) || 1;
  return [(to[0] - from[0]) / reach, (to[1] - from[1]) / reach];
}
