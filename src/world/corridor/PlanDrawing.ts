import { BufferAttribute, BufferGeometry, Color, Group, Mesh, ShaderMaterial } from 'three';
import { CELLS, SECTION, SWEEP, WALL, sweepFront, type Cell } from '@/config/corridor';

const INK = 0xe4e9f0;

/**
 * One tone for every floor. The C2-C5 foundation edge is not drawn here: a
 * darker C1 floor looks like a lighting fault. See `world_design.md` §8.1.
 */
const GROUND = 0x2f4152;

const FILL = { opacity: 0.9, lift: 0.005 } as const;

/**
 * Wall bands lie on the floor too. At wall height they project off their
 * floor plates from steep camera poses.
 */
const HEAD = 0.02;

const PLAN_VERTEX = `
varying float vRun;
varying float vAcross;
void main() {
  vRun = -position.z;
  vAcross = position.x;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const PLAN_FRAGMENT = `
uniform vec3 uColor;
uniform float uOpacity;
uniform float uFront;
uniform float uSoft;
uniform float uGrain;
varying float vRun;
varying float vAcross;
void main() {
  float grain = sin(vAcross * 0.31) * cos(vRun * 0.17 + 1.7);
  float front = uFront + grain * uSoft * uGrain;
  float alpha = uOpacity * smoothstep(front, front + uSoft, vRun);
  if (alpha < 0.004) discard;
  gl_FragColor = vec4(uColor, alpha);
}
`;

const ink = (color: number): ShaderMaterial =>
  new ShaderMaterial({
    uniforms: {
      uColor: { value: new Color(color) },
      uOpacity: { value: 0 },
      uFront: { value: sweepFront(0) },
      uSoft: { value: SWEEP.soft },
      uGrain: { value: SWEEP.grain },
    },
    vertexShader: PLAN_VERTEX,
    fragmentShader: PLAN_FRAGMENT,
    transparent: true,
    depthWrite: false,
    fog: false,
  });

interface Rect {
  readonly x0: number;
  readonly x1: number;
  readonly z0: number;
  readonly z1: number;
  readonly y: number;
}

export interface PlanDrawing {
  readonly object: Group;
  /** 0 the building, 1 the drawing. */
  setDrawn(level: number): void;
  /** 0 the whole figure, 1 an empty field. Independent of `setDrawn`. */
  setCleared(level: number): void;
  dispose(): void;
}

/**
 * The corridor as a plan drawing, shown from high overhead poses where the
 * baked shell looks wrong. Walls are bright bands, floors a dim ground. The
 * shell fades to black underneath and stays in place.
 *
 * Two draw calls: all bands in one merged geometry, all floors in another.
 */
export function createPlanDrawing(): PlanDrawing {
  const object = new Group();
  object.name = 'plan';
  object.visible = false;

  const walls = ink(INK);
  const ground = ink(GROUND);
  const bands = new Mesh(plate(wallBands()), walls);
  bands.renderOrder = 1;
  const floors = new Mesh(plate(floorPlates()), ground);
  floors.renderOrder = 0;

  object.add(floors, bands);

  let drawn = 0;
  let cleared = 0;

  const apply = (): void => {
    object.visible = drawn > 0.002 && cleared < 0.999;
    walls.uniforms['uOpacity']!.value = drawn;
    ground.uniforms['uOpacity']!.value = drawn * FILL.opacity;

    const front = sweepFront(cleared);
    walls.uniforms['uFront']!.value = front;
    ground.uniforms['uFront']!.value = front;
  };

  apply();

  return {
    object,

    setDrawn(level) {
      drawn = level;
      apply();
    },

    setCleared(level) {
      cleared = level;
      apply();
    },

    dispose() {
      bands.geometry.dispose();
      floors.geometry.dispose();
      walls.dispose();
      ground.dispose();
    },
  };
}

/** Every wall of the enfilade as a band. */
function wallBands(): Rect[] {
  const rects: Rect[] = [];
  const reach = WALL / 2;

  const y = SECTION.floor + HEAD;

  for (const cell of CELLS) {

    for (const side of [-1, 1]) {
      if (cell.opens.includes(side)) continue;
      const inner = cell.centre + side * cell.half;

      // A wing opens a pocket in the gallery wall. The wall continues past both
      // ends of the opening. (The Blender script skips the whole face only for
      // fitting placement.)
      for (const [from, to] of clear(cell, side)) {
        rects.push(span(inner, inner + side * WALL, from - reach, to + reach, y));
      }
    }

    for (const wing of cell.wings) {
      rects.push(
        span(wing.far, wing.far + wing.side * WALL, wing.y0 - reach, wing.y1 + reach, y),
        span(wing.near, wing.far + wing.side * WALL, wing.y0 - reach, wing.y0 + reach, y),
        span(wing.near, wing.far + wing.side * WALL, wing.y1 - reach, wing.y1 + reach, y),
      );
    }
  }

  // Only the end furthest from the axis extends to meet the side wall. The
  // other end already meets the narrower member's wall band.
  for (const { z, from, to } of jambs()) {
    const out = (edge: number, other: number): number =>
      Math.abs(edge) >= Math.abs(other) ? edge + Math.sign(edge || 1) * WALL : edge;
    rects.push(span(out(from, to), out(to, from), z - reach, z + reach, y));
  }

  return rects;
}

/** Stretches of a gallery wall outside its wing opening. */
function clear(cell: Cell, side: number): Array<[number, number]> {
  const wing = cell.wings.find((entry) => entry.side === side);
  if (!wing) return [[cell.y0, cell.y1]];
  return ([
    [cell.y0, wing.y0],
    [wing.y1, cell.y1],
  ] as Array<[number, number]>).filter(([from, to]) => to - from > 0.01);
}

/**
 * Cross walls, computed from the cells. At each station a span is solid where
 * exactly one side (ending or starting members) covers it. This handles jambs,
 * the terminal wall and the C3/C4 cross correctly.
 */
function jambs(): Array<{ z: number; from: number; to: number }> {
  const stations = [...new Set(CELLS.flatMap((cell) => [cell.y0, cell.y1]))].sort((a, b) => a - b);
  const found: Array<{ z: number; from: number; to: number }> = [];

  for (const z of stations) {
    // Station 0 is the open mouth into the vestibule.
    if (z === 0) continue;

    const ending = CELLS.filter((cell) => cell.y1 === z);
    const starting = CELLS.filter((cell) => cell.y0 === z);

    for (const [from, to] of exactlyOne(ending, starting)) {
      found.push({ z, from, to });
    }
  }

  return found;
}

/** Where one side of a station is covered and the other is not. */
function exactlyOne(ending: readonly Cell[], starting: readonly Cell[]): Array<[number, number]> {
  const edges = [...ending, ...starting].flatMap((cell) => [
    cell.centre - cell.half,
    cell.centre + cell.half,
  ]);
  const marks = [...new Set(edges)].sort((a, b) => a - b);
  const covers = (cells: readonly Cell[], at: number): boolean =>
    cells.some((cell) => at > cell.centre - cell.half && at < cell.centre + cell.half);

  const solid: Array<[number, number]> = [];
  for (let index = 0; index + 1 < marks.length; index += 1) {
    const [from, to] = [marks[index] as number, marks[index + 1] as number];
    const middle = (from + to) / 2;
    if (covers(ending, middle) === covers(starting, middle)) continue;
    const previous = solid[solid.length - 1];
    if (previous && previous[1] === from) solid[solid.length - 1] = [previous[0], to];
    else solid.push([from, to]);
  }
  return solid;
}

/** Floor plate of each member and its wings. */
function floorPlates(): Rect[] {
  const y = SECTION.floor + FILL.lift;
  return CELLS.flatMap((cell) => [
    span(cell.centre - cell.half, cell.centre + cell.half, cell.y0, cell.y1, y),
    ...cell.wings.map((wing) => span(wing.near, wing.far, wing.y0, wing.y1, y)),
  ]);
}

const span = (a: number, b: number, c: number, d: number, y: number): Rect => ({
  x0: Math.min(a, b),
  x1: Math.max(a, b),
  z0: Math.min(c, d),
  z1: Math.max(c, d),
  y,
});

/** Merges rects into one geometry. Plan z runs into the corridor, so world z is negated. */
function plate(rects: readonly Rect[]): BufferGeometry {
  const positions = new Float32Array(rects.length * 12);
  const indices: number[] = [];

  rects.forEach((rect, index) => {
    const corners = [
      [rect.x0, rect.z0],
      [rect.x1, rect.z0],
      [rect.x0, rect.z1],
      [rect.x1, rect.z1],
    ];
    corners.forEach(([x, z], corner) => {
      const at = (index * 4 + corner) * 3;
      positions[at] = x as number;
      positions[at + 1] = rect.y;
      positions[at + 2] = -(z as number);
    });
    const base = index * 4;
    indices.push(base, base + 1, base + 2, base + 2, base + 1, base + 3);
  });

  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeBoundingSphere();
  return geometry;
}
