import gsap from 'gsap';
import { DURATION, EASE, STAGGER, seconds } from '@/animations/timing';
import {
  DECODER,
  EMBEDDING_STEPS,
  ENCODER,
  OBJECTIVES,
  PREDICTOR,
  SCALARS,
  TARGET,
  TOTAL,
  TRAINING,
  WORD2VEC,
  WORKED,
  type Stage,
} from '@/content/c4';
import { el, svg } from '@/utilities/dom';
import './c4-palette.css';
import './model.css';

export interface Model {
  readonly element: HTMLElement;
  readonly beats: number;
  play(step: number, settle: boolean): gsap.core.Timeline | null;
}

/* ---- Vectors ------------------------------------------------------------- */

/**
 * Illustrative stand-in for a Word2Vec vector, hashed from the term (FNV-1a).
 * The same term always gives the same shape and different terms give
 * different ones.
 */
const vectorFor = (term: string, count: number): readonly number[] => {
  let seed = 2166136261;
  for (const character of term) {
    seed ^= character.charCodeAt(0);
    seed = Math.imul(seed, 16777619);
  }

  return Array.from({ length: count }, (_, index) => {
    const mixed = Math.imul(seed ^ Math.imul(index + 1, 2654435761), 2246822519);
    return ((mixed >>> 8) / 0x800000 - 1) * 0.92;
  });
};

/** Element-wise mean. Builds a material from its terms. */
const meanOf = (vectors: readonly (readonly number[])[]): readonly number[] => {
  const [first] = vectors;
  if (!first) return [];
  return first.map(
    (_, index) => vectors.reduce((sum, vector) => sum + (vector[index] ?? 0), 0) / vectors.length,
  );
};

/** Weighted sum with weights in percent. Builds a product from its materials. */
const weightedSum = (
  entries: readonly { readonly vector: readonly number[]; readonly weight: number }[],
): readonly number[] => {
  const [first] = entries;
  if (!first) return [];
  return first.vector.map((_, index) =>
    entries.reduce((sum, entry) => sum + (entry.vector[index] ?? 0) * (entry.weight / 100), 0),
  );
};

/**
 * Coefficients drawn per strip. 300 bars would fill a 190 px lane solid. All
 * strips share the count so the product strip is the exact weighted sum of the
 * material strips.
 */
const COEFFICIENTS = 40;

/** A vector drawn as signed bars about a midline. */
const vectorStrip = (values: readonly number[], scale: string): HTMLElement =>
  el('div', {
    className: 'md-vec',
    attrs: { 'data-scale': scale },
    children: values.map((value) =>
      el('span', {
        className: 'md-coef',
        attrs: {
          'data-sign': value < 0 ? 'down' : 'up',
          style: `--extent: ${(Math.abs(value) * 50).toFixed(2)}%`,
        },
      }),
    ),
  });

/* ---- The graph ------------------------------------------------------------ */

const BOARD = { width: 1400, height: 390 } as const;

/** Column height scales with layer width, so the funnel matches the network. */
const heightOf = (units: number): number => 26 + 130 * (units / 300);

interface Node {
  readonly key: string;
  readonly x: number;
  readonly y: number;
  readonly units: number;
  readonly label: string;
  readonly detail: string;
  /** Where the caption sits relative to the column. */
  readonly caption: 'above' | 'below';
}

const stageNamed = (stages: readonly Stage[], key: string): Stage => {
  const found = stages.find((stage) => stage.key === key);
  if (!found) throw new Error(`C4: the architecture declares no stage "${key}".`);
  return found;
};

const SPINE = 190;
const UPPER = 92;
const LOWER = 292;

/**
 * Network layout. Widths come from `content/c4.ts`. Decoder and predictor both
 * branch from the shared latent column.
 */
const NODES: readonly Node[] = [
  {
    key: 'input',
    x: 70,
    y: SPINE,
    units: stageNamed(ENCODER, 'input').units,
    label: 'Product embedding',
    detail: 'Weighted material vector',
    caption: 'below',
  },
  {
    key: 'encode',
    x: 220,
    y: SPINE,
    units: stageNamed(ENCODER, 'hidden').units,
    label: 'Encoder',
    detail: 'LeakyReLU, dropout',
    caption: 'below',
  },
  {
    key: 'latent',
    x: 360,
    y: SPINE,
    units: stageNamed(ENCODER, 'latent').units,
    label: 'Latent space',
    detail: 'Shared by both objectives',
    caption: 'below',
  },
  {
    key: 'scalars',
    x: 360,
    y: 300,
    units: SCALARS.length,
    label: 'Design attributes',
    detail: 'Two scalars',
    caption: 'below',
  },
  {
    key: 'decode',
    x: 530,
    y: UPPER,
    units: stageNamed(DECODER, 'hidden').units,
    label: 'Decoder',
    detail: 'Mirror of the encoder',
    caption: 'below',
  },
  {
    key: 'reconstruct',
    x: 700,
    y: UPPER,
    units: stageNamed(DECODER, 'output').units,
    label: 'Reconstruction',
    detail: 'Compared against the input',
    caption: 'below',
  },
  {
    key: 'concat',
    x: 530,
    y: LOWER,
    units: stageNamed(PREDICTOR, 'input').units,
    label: 'Concatenation',
    detail: 'Latent space and scalars',
    caption: 'above',
  },
  {
    key: 'predict',
    x: 700,
    y: LOWER,
    units: stageNamed(PREDICTOR, 'hidden').units,
    label: 'Predictor',
    detail: 'Norm, LeakyReLU, dropout',
    caption: 'below',
  },
  {
    key: 'output',
    x: 860,
    y: LOWER,
    units: stageNamed(PREDICTOR, 'output').units,
    label: 'Pathway distribution',
    detail: 'Softmax',
    caption: 'below',
  },
] as const;

const EDGES: readonly (readonly [string, string])[] = [
  ['input', 'encode'],
  ['encode', 'latent'],
  ['latent', 'decode'],
  ['decode', 'reconstruct'],
  ['latent', 'concat'],
  ['scalars', 'concat'],
  ['concat', 'predict'],
  ['predict', 'output'],
] as const;

const HALF_WIDTH = 11;

const nodeNamed = (key: string): Node => {
  const found = NODES.find((node) => node.key === key);
  if (!found) throw new Error(`C4: the graph declares no node "${key}".`);
  return found;
};

/** Filled ribbon joining the full height of two columns. */
const ribbonPath = (from: Node, to: Node): string => {
  const x1 = from.x + HALF_WIDTH;
  const x2 = to.x - HALF_WIDTH;
  const bend = (x2 - x1) * 0.5;
  const t1 = from.y - heightOf(from.units) / 2;
  const b1 = from.y + heightOf(from.units) / 2;
  const t2 = to.y - heightOf(to.units) / 2;
  const b2 = to.y + heightOf(to.units) / 2;

  return (
    `M ${x1} ${t1} C ${x1 + bend} ${t1}, ${x2 - bend} ${t2}, ${x2} ${t2} ` +
    `L ${x2} ${b2} C ${x2 - bend} ${b2}, ${x1 + bend} ${b1}, ${x1} ${b1} Z`
  );
};

/** Board coordinates as CSS percentages, to place HTML text over the SVG. */
const atBoard = (x: number, y: number): string =>
  `left: ${((x / BOARD.width) * 100).toFixed(3)}%; top: ${((y / BOARD.height) * 100).toFixed(3)}%`;

/* ---- The panel ------------------------------------------------------------ */

/**
 * C4 model panel, two beats on one dark field: the composition embedding, then
 * the network architecture.
 */
export function createModel(): Model {
  /* -- State one: composition into a vector -- */

  const widest = Math.max(...WORKED.map((material) => material.terms.length));

  const materials = WORKED.map((material) => {
    const termVectors = material.terms.map((term) => vectorFor(term, COEFFICIENTS));
    const vector = meanOf(termVectors);

    const terms = material.terms.map((term, index) =>
      el('div', {
        className: 'md-term',
        children: [
          el('span', { className: 'md-term-name', text: term }),
          vectorStrip(termVectors[index] ?? [], 'term'),
        ],
      }),
    );

    return {
      material,
      vector,
      terms,
      element: el('div', {
        className: 'md-lane',
        attrs: { 'data-key': material.declared },
        children: [
          el('div', {
            className: 'md-declared',
            children: [
              el('span', { className: 'md-declared-name', text: material.declared }),
              el('span', { className: 'md-declared-weight', text: `${material.weight}%` }),
            ],
          }),
          el('div', {
          className: 'md-terms',
          attrs: { style: `--terms: ${widest}` },
          children: terms,
        }),
          el('div', {
            className: 'md-material',
            children: [
              el('span', { className: 'md-material-label', text: 'Material embedding' }),
              vectorStrip(vector, 'material'),
            ],
          }),
        ],
      }),
    };
  });

  const product = weightedSum(
    materials.map((entry) => ({ vector: entry.vector, weight: entry.material.weight })),
  );

  const productStrip = vectorStrip(product, 'product');
  const productBlock = el('div', {
    className: 'md-product',
    children: [
      el('p', { className: 'md-product-label', text: 'Product embedding' }),
      productStrip,
      el('p', {
        className: 'md-product-detail',
        text: `${WORD2VEC.dimensions} dimensions per product`,
      }),
    ],
  });

  const brace = el('span', { className: 'md-brace' });

  const embed = el('div', {
    className: 'md-state',
    attrs: { 'data-state': 'embed' },
    children: [
      el('div', { className: 'md-lanes', children: materials.map((entry) => entry.element) }),
      el('div', { className: 'md-gather', children: [brace] }),
      productBlock,
    ],
  });

  /* -- State two: the architecture -- */

  const board = svg('svg', {
    class: 'md-board',
    viewBox: `0 0 ${BOARD.width} ${BOARD.height}`,
    preserveAspectRatio: 'xMidYMid meet',
  });

  const ribbons = EDGES.map(([from, to]) => {
    const path = svg('path', {
      class: 'md-ribbon',
      d: ribbonPath(nodeNamed(from), nodeNamed(to)),
      'data-from': from,
      'data-to': to,
    });
    board.appendChild(path);
    return path;
  });

  const columns = NODES.map((node) => {
    const height = heightOf(node.units);
    const rect = svg('rect', {
      class: 'md-column',
      'data-key': node.key,
      x: String(node.x - HALF_WIDTH),
      y: String(node.y - height / 2),
      width: String(HALF_WIDTH * 2),
      height: String(height),
      rx: '5',
    });
    board.appendChild(rect);
    return rect;
  });

  const captions = NODES.map((node) => {
    const height = heightOf(node.units);
    const offset = node.caption === 'above' ? node.y - height / 2 - 38 : node.y + height / 2 + 10;

    return el('div', {
      className: 'md-caption',
      attrs: { 'data-key': node.key, style: atBoard(node.x, offset) },
      children: [
        el('span', { className: 'md-caption-units', text: String(node.units) }),
        el('span', { className: 'md-caption-label', text: node.label }),
        el('span', { className: 'md-caption-detail', text: node.detail }),
      ],
    });
  });

  const objectives = OBJECTIVES.map((objective) => {
    const reconstruction = objective.key === 'reconstruction';

    return el('div', {
      className: 'md-objective',
      attrs: {
        'data-key': objective.key,
        style: atBoard(reconstruction ? 830 : 980, reconstruction ? UPPER : LOWER),
      },
      children: [
        el('span', { className: 'md-objective-label', text: objective.label }),
        el('span', {
          className: 'md-objective-weight c4-figure',
          text: `× ${objective.weight.toFixed(1)}`,
        }),
        el('span', { className: 'md-objective-body', text: objective.body }),
      ],
    });
  });

  // Both loss branches join at one point: the total loss.
  const converge = svg('path', {
    class: 'md-converge',
    d: `M 1032 ${UPPER} C 1130 ${UPPER}, 1140 ${SPINE}, 1214 ${SPINE} ` +
      `M 1182 ${LOWER} C 1206 ${LOWER}, 1200 ${SPINE}, 1214 ${SPINE}`,
  });
  board.appendChild(converge);

  const total = el('div', {
    className: 'md-total',
    attrs: { style: atBoard(1228, SPINE) },
    children: [
      el('span', { className: 'md-total-label', text: TOTAL.label }),
      el('span', { className: 'md-total-body', text: TOTAL.body }),
    ],
  });

  const graph = el('div', {
    className: 'md-state',
    attrs: { 'data-state': 'graph' },
    children: [
      el('div', {
        className: 'md-board-frame',
        children: [board, ...captions, ...objectives, total],
      }),
    ],
  });

  const field = el('div', { className: 'c4-field md-field', children: [embed, graph] });

  /* -- The white ground under it -- */

  const steps = EMBEDDING_STEPS.map((step, index) =>
    el('div', {
      className: 'md-step',
      children: [
        el('span', { className: 'md-step-index', text: String(index + 1).padStart(2, '0') }),
        el('span', { className: 'md-step-label', text: step.label }),
        el('span', { className: 'md-step-body', text: step.body }),
      ],
    }),
  );

  const embedFoot = el('div', {
    className: 'md-foot-state',
    attrs: { 'data-state': 'embed' },
    children: [el('div', { className: 'md-steps', children: steps })],
  });

  const facts: readonly (readonly [string, string])[] = [
    ['Optimiser', TRAINING.optimiser],
    ['Learning rate', `${TRAINING.learningRate}, ${TRAINING.schedule.toLowerCase()}`],
    ['Mini-batch', String(TRAINING.batch)],
    ['Early stopping', TRAINING.stopping],
    ['Converged', `Epoch ${TRAINING.convergedAt} of ${TRAINING.maximumEpochs}`],
  ];

  const factNodes = facts.map(([label, value]) =>
    el('div', {
      className: 'md-fact',
      children: [
        el('span', { className: 'md-fact-label', text: label }),
        el('span', { className: 'md-fact-value', text: value }),
      ],
    }),
  );

  const graphFoot = el('div', {
    className: 'md-foot-state',
    attrs: { 'data-state': 'graph' },
    children: [el('div', { className: 'md-facts', children: factNodes })],
  });

  const foot = el('div', { className: 'md-foot', children: [embedFoot, graphFoot] });

  const embedHead = el('p', { className: 'c4-index', text: 'A composition, made readable' });

  const graphHead = el('div', {
    className: 'md-head-block',
    children: [
      el('p', { className: 'md-target', text: TARGET.label }),
      el('p', { className: 'md-target-form', text: TARGET.form }),
    ],
  });

  const element = el('div', {
    className: 'c4 md',
    children: [
      el('div', { className: 'md-heads', children: [embedHead, graphHead] }),
      field,
      foot,
    ],
  });

  /* -- Motion -- */

  const termNodes = materials.flatMap((entry) => entry.terms);
  const materialBlocks = materials.map(
    (entry) => entry.element.lastElementChild as HTMLElement,
  );
  const declaredBlocks = materials.map((entry) => entry.element.firstElementChild as HTMLElement);
  const productCoefficients = [...productStrip.querySelectorAll<HTMLElement>('.md-coef')];
  // Excludes `productCoefficients` so no element gets two scaleY tweens.
  const coefficients = [...embed.querySelectorAll<HTMLElement>('.md-coef')].filter(
    (node) => !productStrip.contains(node),
  );

  const settleTo = (step: number): void => {
    const first = step === 0;
    gsap.set(element, { opacity: 1 });
    gsap.set(embedHead, { opacity: first ? 1 : 0, y: 0 });
    gsap.set(graphHead, { opacity: first ? 0 : 1, y: 0 });
    gsap.set(embed, { opacity: first ? 1 : 0 });
    gsap.set(graph, { opacity: first ? 0 : 1 });
    gsap.set(embedFoot, { opacity: first ? 1 : 0 });
    gsap.set(graphFoot, { opacity: first ? 0 : 1 });
    gsap.set([...declaredBlocks, ...termNodes, ...materialBlocks, productBlock], {
      opacity: 1,
      x: 0,
      y: 0,
    });
    gsap.set(coefficients, { opacity: 1, scaleY: 1 });
    gsap.set(brace, { opacity: 1, scaleY: 1 });
    gsap.set(steps, { opacity: 1, y: 0 });
    gsap.set(ribbons, { opacity: 1 });
    gsap.set(columns, { opacity: 1, scaleY: 1 });
    gsap.set([...captions, ...objectives, total, ...factNodes], {
      opacity: 1,
      x: 0,
      y: 0,
    });
    gsap.set(converge, { opacity: 1, strokeDashoffset: 0 });
  };

  const playEmbed = (): gsap.core.Timeline => {
    const line = gsap.timeline();
    gsap.set(embed, { opacity: 1 });
    gsap.set(embedFoot, { opacity: 1 });

    return line
      .to([graph, graphFoot], { opacity: 0, duration: seconds(DURATION.quick), ease: EASE.exit }, 0)
      .to(graphHead, { opacity: 0, duration: seconds(DURATION.quick), ease: 'power2.out' }, 0)
      .fromTo(
        embedHead,
        { opacity: 0, y: 8 },
        { opacity: 1, y: 0, duration: seconds(DURATION.normal), ease: EASE.enter },
        0,
      )
      .from(
        declaredBlocks,
        {
          opacity: 0,
          x: -16,
          duration: seconds(DURATION.slow),
          ease: EASE.enter,
          stagger: seconds(STAGGER * 1.6),
        },
        seconds(DURATION.quick * 0.5),
      )
      .from(
        termNodes,
        {
          opacity: 0,
          y: 12,
          duration: seconds(DURATION.normal),
          ease: EASE.enter,
          stagger: seconds(STAGGER * 1.2),
        },
        seconds(DURATION.normal * 0.9),
      )
      // Coefficients grow out of the midline to show their sign.
      .fromTo(
        coefficients,
        { scaleY: 0 },
        {
          scaleY: 1,
          duration: seconds(DURATION.normal),
          ease: EASE.enter,
          stagger: seconds(STAGGER * 0.035),
        },
        seconds(DURATION.normal * 1.1),
      )
      .from(
        materialBlocks,
        {
          opacity: 0,
          x: -14,
          duration: seconds(DURATION.slow),
          ease: EASE.enter,
          stagger: seconds(STAGGER * 1.6),
        },
        seconds(DURATION.slow * 0.9),
      )
      .fromTo(
        brace,
        { scaleY: 0 },
        {
          scaleY: 1,
          duration: seconds(DURATION.normal),
          ease: EASE.enter,
          transformOrigin: 'center center',
        },
        seconds(DURATION.slow * 1.15),
      )
      .from(
        productBlock,
        { opacity: 0, x: 20, duration: seconds(DURATION.slow), ease: EASE.enter },
        seconds(DURATION.slow * 1.2),
      )
      .fromTo(
        productCoefficients,
        { scaleY: 0 },
        {
          scaleY: 1,
          duration: seconds(DURATION.normal),
          ease: EASE.enter,
          stagger: seconds(STAGGER * 0.02),
        },
        seconds(DURATION.slow * 1.35),
      )
      .from(
        steps,
        {
          opacity: 0,
          y: 12,
          duration: seconds(DURATION.normal),
          ease: EASE.enter,
          stagger: seconds(STAGGER * 0.9),
        },
        seconds(DURATION.cinematic * 0.9),
      );
  };

  const playGraph = (): gsap.core.Timeline => {
    const line = gsap.timeline();
    gsap.set(graph, { opacity: 1 });
    gsap.set(graphFoot, { opacity: 1 });

    return line
      .to([embed, embedFoot], { opacity: 0, duration: seconds(DURATION.quick), ease: EASE.exit }, 0)
      .to(embedHead, { opacity: 0, duration: seconds(DURATION.quick), ease: 'power2.out' }, 0)
      .fromTo(
        graphHead,
        { opacity: 0, y: 8 },
        { opacity: 1, y: 0, duration: seconds(DURATION.normal), ease: EASE.enter },
        0,
      )
      // Columns appear before ribbons, so the shared latent column shows first.
      .fromTo(
        columns,
        { scaleY: 0 },
        {
          scaleY: 1,
          duration: seconds(DURATION.normal),
          ease: 'back.out(1.6)',
          transformOrigin: 'center center',
          stagger: seconds(STAGGER * 1.15),
        },
        seconds(DURATION.quick * 0.5),
      )
      .from(
        ribbons,
        {
          opacity: 0,
          duration: seconds(DURATION.slow),
          ease: EASE.enter,
          stagger: seconds(STAGGER * 1.15),
        },
        seconds(DURATION.quick * 0.9),
      )
      .from(
        captions,
        {
          opacity: 0,
          y: 8,
          duration: seconds(DURATION.normal),
          ease: EASE.enter,
          stagger: seconds(STAGGER * 1.15),
        },
        seconds(DURATION.normal * 1.1),
      )
      .from(
        objectives,
        {
          opacity: 0,
          x: -12,
          duration: seconds(DURATION.slow),
          ease: EASE.enter,
          stagger: seconds(STAGGER * 2),
        },
        seconds(DURATION.cinematic * 0.75),
      )
      .fromTo(
        converge,
        { strokeDashoffset: 260 },
        { strokeDashoffset: 0, duration: seconds(DURATION.slow), ease: EASE.standard },
        seconds(DURATION.cinematic * 0.95),
      )
      .from(
        total,
        { opacity: 0, x: 14, duration: seconds(DURATION.slow), ease: EASE.enter },
        seconds(DURATION.cinematic * 1.15),
      )
      .from(
        factNodes,
        {
          opacity: 0,
          y: 10,
          duration: seconds(DURATION.normal),
          ease: EASE.enter,
          stagger: seconds(STAGGER * 0.9),
        },
        seconds(DURATION.cinematic * 0.85),
      );
  };

  gsap.set(graph, { opacity: 0 });
  gsap.set(graphFoot, { opacity: 0 });
  gsap.set(graphHead, { opacity: 0 });

  return {
    element,
    beats: 2,

    play(step, settle) {
      if (settle) {
        settleTo(step);
        return null;
      }
      gsap.set(element, { opacity: 1 });
      return step === 0 ? playEmbed() : playGraph();
    },
  };
}
