/**
 * C2 — empirical characterisation. Data of record.
 *
 * Every quantity is the published paper. Table 1 carries the circularity
 * distributions, Table 3 the product-stage impacts by category, and the
 * per-category figures are the ones stated in section 3.3. Nothing here is
 * interpolated: where the paper publishes a figure for one category and stays
 * silent for another, the silent one is absent.
 *
 * `assertPublished()` runs at module load. The category counts have to sum to
 * the corpus, and the verification sample has to fall out of Cochran's formula
 * at the stated parameters.
 */

export const CORPUS = {
  products: 8463,
  /** Manually verified, item by item, against the source declaration. */
  verified: 368,
  errors: 0,
  confidence: 0.95,
  precision: 0.05,
  /** Share of the corpus declared in Europe. */
  europe: 0.7,
  source: 'The International EPD System · Type III · EN 15804+A2 · PCR 2019:14',
} as const;

/**
 * Why the work could not wait for the infrastructure.
 *
 * Digital product passports would supply structured product data directly.
 * Construction products are at the back of that queue, and selection decisions
 * are being taken across the whole of the interim. Every date is the paper's
 * own section 1.
 */
export const TIMELINE = [
  { year: 2019, label: 'EN 15804+A2', note: 'Common standard for Type III declarations' },
  { year: 2024, label: 'ESPR adopted', note: 'Digital product passports mandated' },
  {
    year: 2026,
    label: 'First digital product passports',
    note: 'Batteries and consumer electronics',
  },
  { year: 2030, label: 'Construction products', note: 'Full rollout projected' },
] as const;

/** The span the contribution exists to cover. */
export const INTERIM = { from: 2026, to: 2030 } as const;

/** What the evaluation framework requires of every candidate. */
export const DEMANDS = [
  'Material composition',
  'Environmental impact',
  'Technical performance',
  'End-of-life pathway',
  'Service life',
] as const;

export interface Category {
  readonly key: string;
  readonly label: string;
  readonly count: number;
}

/** Fig. 3, in the order the tree map ranks them. */
export const CATEGORIES: readonly Category[] = [
  { key: 'structural', label: 'Structural systems', count: 2499 },
  { key: 'coating', label: 'Coating and cladding', count: 1597 },
  { key: 'building', label: 'Building systems', count: 779 },
  { key: 'pavements', label: 'Pavements', count: 624 },
  { key: 'enclosures', label: 'Enclosures', count: 623 },
  { key: 'insulation', label: 'Thermal and acoustic insulation', count: 605 },
  { key: 'partitions', label: 'Partitions', count: 528 },
  { key: 'carpentry', label: 'Carpentry', count: 399 },
  { key: 'misc', label: 'Miscellanea', count: 382 },
  { key: 'roofing', label: 'Roofing systems', count: 242 },
  { key: 'furniture', label: 'Furniture', count: 185 },
];

/**
 * What a pathway is worth, which is what colours it.
 *
 * `recovery` returns the material to use, whether as itself or as feedstock.
 * `energy` keeps the calories and destroys the material. `loss` keeps nothing.
 * `origin` is upstream and belongs to none of them.
 */
export type Worth = 'origin' | 'recovery' | 'energy' | 'loss';

export interface Pathway {
  readonly key: string;
  readonly label: string;
  readonly worth: Worth;
  /** Products whose declaration mentions this metric at all. */
  readonly n: number;
  readonly mean: number;
  readonly median: number;
  readonly max: number;
  /** Recovery that is something other than recycling. */
  readonly beyondRecycling?: boolean;
}

/** Table 1, upstream. */
export const ORIGIN: Pathway = {
  key: 'origin',
  label: 'Circular origin',
  worth: 'origin',
  n: 2974,
  mean: 13.9,
  median: 0,
  max: 100,
};

/** Table 1, downstream, ordered by mean. */
export const PATHWAYS: readonly Pathway[] = [
  {
    key: 'landfill',
    label: 'Inert and non-hazardous landfill',
    worth: 'loss',
    n: 7019,
    mean: 48.9,
    median: 30,
    max: 100,
  },
  {
    key: 'recycling',
    label: 'Recycling',
    worth: 'recovery',
    n: 5337,
    mean: 36.8,
    median: 9,
    max: 100,
  },
  {
    key: 'incineration',
    label: 'Incineration',
    worth: 'energy',
    n: 1435,
    mean: 8.5,
    median: 0,
    max: 100,
  },
  {
    key: 'unrecoverable',
    label: 'Not recoverable',
    worth: 'loss',
    n: 191,
    mean: 1.8,
    median: 0,
    max: 100,
  },
  {
    key: 'valorisation',
    label: 'Valorisation and filling',
    worth: 'recovery',
    n: 433,
    mean: 1.5,
    median: 0,
    max: 100,
    beyondRecycling: true,
  },
  {
    key: 'reuse',
    label: 'Reuse',
    worth: 'recovery',
    n: 95,
    mean: 0.7,
    median: 0,
    max: 100,
    beyondRecycling: true,
  },
  {
    key: 'hazardous',
    label: 'Hazardous waste',
    worth: 'loss',
    n: 81,
    mean: 0.5,
    median: 0,
    max: 100,
  },
  {
    key: 'composting',
    label: 'Composting',
    worth: 'recovery',
    n: 4,
    mean: 0.0,
    median: 0,
    max: 81,
    beyondRecycling: true,
  },
  {
    key: 'reconditioning',
    label: 'Reconditioning',
    worth: 'recovery',
    n: 1,
    mean: 0.0,
    median: 0,
    max: 5,
    beyondRecycling: true,
  },
];

/** Everything that returns material to use, recycling included. */
export const RECOVERED = PATHWAYS.filter((pathway) => pathway.worth === 'recovery').reduce(
  (sum, pathway) => sum + pathway.mean,
  0,
);

/** The part of that which is anything other than recycling. */
export const BEYOND_RECYCLING = PATHWAYS.filter((pathway) => pathway.beyondRecycling).reduce(
  (sum, pathway) => sum + pathway.mean,
  0,
);

/** Section 3.3.2. Zero is easy, two is impossible. */
export const DISMANTLE = { mean: 1.5, median: 2, best: 0, worst: 2 } as const;

/**
 * Circular origin against what is recovered at end of life, for the three
 * categories where the paper publishes both. The distance between the pair is
 * the decoupling, and how far it opens is a property of the category.
 */
export const DECOUPLED = [
  { key: 'insulation', label: 'Thermal and acoustic insulation', origin: 46.0, recycling: 4.3 },
  { key: 'structural', label: 'Structural systems', origin: 35.9, recycling: 22.8 },
  { key: 'coating', label: 'Coating and cladding', origin: 8.6, recycling: 9.6 },
] as const;

/** Why the returning material stops returning. Both explanations are the paper's. */
export const BLOCKERS = [
  {
    key: 'degradation',
    label: 'Material degradation',
    body: 'Gypsum and several polymer-based products lose recoverability over repeated cycles. Recycled content at the input does not imply recoverability at the output.',
  },
  {
    key: 'infrastructure',
    label: 'Absent transformation capacity',
    body: 'Pre-treatment, requalification and reprocessing require specialised transformation companies. Where these are absent, recovery defaults to landfilling.',
  },
] as const;

export interface Stage {
  readonly key: string;
  readonly label: string;
  /** Share of total lifecycle burden. Section 3.4 puts A1 to A3 at 80% to 98%. */
  readonly share: number;
  readonly group: 'product' | 'construction' | 'endoflife';
}

export const STAGES: readonly Stage[] = [
  { key: 'A1–A3', label: 'Product', share: 89, group: 'product' },
  { key: 'A4', label: 'Transport', share: 3.4, group: 'construction' },
  { key: 'A5', label: 'Construction', share: 3.1, group: 'construction' },
  { key: 'C1', label: 'Demolition', share: 0.6, group: 'endoflife' },
  { key: 'C2', label: 'Transport', share: 1.2, group: 'endoflife' },
  { key: 'C3', label: 'Processing', share: 1.6, group: 'endoflife' },
  { key: 'C4', label: 'Disposal', share: 1.1, group: 'endoflife' },
];

/** The band the paper actually publishes for the product stage. */
export const PRODUCT_BAND = { low: 80, high: 98 } as const;

/** Stage D, and the asymmetry that is the finding. */
export const OFFSETS = [
  {
    key: 'environmental',
    label: 'Environmental burden',
    value: 15,
    note: 'Module D offsets 10% to 15% of environmental impact.',
  },
  {
    key: 'biodiversity',
    label: 'Biodiversity burden',
    value: 1,
    note: 'Module D offsets approximately 1% of biodiversity impact.',
  },
] as const;

/**
 * Table 3, product stage GWP in kg CO2e per kg. Mean against median is the
 * point: the distance between them is the spread inside the category.
 */
export const GWP_BY_CATEGORY = [
  { key: 'pavements', label: 'Pavements', mean: 1.2, median: 0.16 },
  { key: 'partitions', label: 'Partitions', mean: 1.3, median: 0.26 },
  { key: 'carpentry', label: 'Carpentry', mean: 4.8, median: 1.2 },
] as const;

/**
 * How the same outcome gets written, and the label it has to resolve to.
 *
 * The wording is what makes the extraction a language problem: a declaration
 * saying "recycled" may mean manufacturing scrap returned to the line, a part
 * taken off and refitted, or genuine reprocessing into new feedstock. A schema
 * that keeps the manufacturer's word keeps the manufacturer's ambiguity.
 */
export const WORDINGS = [
  { text: 'Production offcuts returned to the mixer', label: 'Recycling' },
  { text: 'Recycled at end of life', label: 'Recycling' },
  { text: 'Material recovery and reprocessing', label: 'Recycling' },
  { text: 'Panels are dismantled and refitted', label: 'Reuse' },
  { text: 'Crushed and used as fill', label: 'Valorisation' },
] as const;

export interface SchemaGroup {
  readonly key: string;
  readonly label: string;
  readonly fields: readonly string[];
}

/**
 * What every product resolves to, whatever shape its declaration arrived in.
 *
 * Biodiversity indicators sit inside the environmental group: eutrophication,
 * acidification and abiotic depletion are environmental impact categories, and
 * GWP is read by both. Performance is its own group, because several product
 * categories disclose it in full — concrete carries cement content,
 * characteristic strength and aggregate size — and its source is the
 * Declaration of Performance, not the EPD.
 */
export const SCHEMA: readonly SchemaGroup[] = [
  {
    key: 'identity',
    label: 'Identity',
    fields: ['Product', 'Manufacturer', 'Country', 'Category', 'Declared unit', 'Service life'],
  },
  {
    key: 'composition',
    label: 'Composition',
    fields: ['Material inventory by mass', 'Health attributes', 'Conversion factors'],
  },
  {
    key: 'environmental',
    label: 'Environmental',
    fields: ['GWP', 'Freshwater use', 'Eutrophication', 'Acidification', 'Abiotic depletion'],
  },
  {
    key: 'performance',
    label: 'Performance',
    fields: ['Characteristic strength', 'Cement content', 'Aggregate size', 'Thermal conductivity'],
  },
  {
    key: 'circularity',
    label: 'Circularity',
    fields: ['Circular origin', 'Disassembly potential', 'End-of-life pathways'],
  },
];

/** Every impact field is carried per lifecycle module, which is why they add up. */
export const MODULES = 'A1–A3 · A4 · A5 · C1 · C2 · C3 · C4 · D';

export interface Highlight {
  /** Position on the page, as a fraction of its width and height. */
  readonly x: number;
  readonly y: number;
  readonly w: number;
  /** Which schema group it resolves into. */
  readonly group: string;
  /** Where in the document it sits. */
  readonly locus: string;
}

/**
 * Where each group of indicators sits on a declaration.
 *
 * Four different kinds of location, which is the extraction problem: the
 * document is laid out for a human reader and nothing in it marks which lines
 * carry the quantities.
 */
export const HIGHLIGHTS: readonly Highlight[] = [
  { x: 0.1, y: 0.11, w: 0.44, group: 'identity', locus: 'Cover page' },
  { x: 0.1, y: 0.3, w: 0.62, group: 'composition', locus: 'Table' },
  { x: 0.52, y: 0.46, w: 0.38, group: 'environmental', locus: 'Table' },
  { x: 0.1, y: 0.62, w: 0.55, group: 'performance', locus: 'Declaration of Performance' },
  { x: 0.1, y: 0.82, w: 0.7, group: 'circularity', locus: 'Narrative section' },
];

export const EXTRACTOR = {
  model: 'gpt-4o-2024-08-06',
  guardrail: 'Indicators absent from the source are returned as null. The model is instructed not to infer values.',
  steps: ['Acquire · Selenium', 'Flatten · PyMuPDF', 'Structure · LLM'],
} as const;

/** Cochran (1963), at the confidence and precision the paper declares. */
export function sampleSize(population: number, confidence: number, precision: number): number {
  if (confidence !== 0.95) throw new Error(`C2: no z-score on file for ${confidence}.`);
  const first = (1.96 * 1.96 * 0.25) / (precision * precision);
  return Math.ceil(first / (1 + (first - 1) / population));
}

function assertPublished(): void {
  const counted = CATEGORIES.reduce((sum, category) => sum + category.count, 0);
  if (counted !== CORPUS.products) {
    throw new Error(
      `C2: the category counts sum to ${counted}, and the corpus is ${CORPUS.products}.`,
    );
  }

  const required = sampleSize(CORPUS.products, CORPUS.confidence, CORPUS.precision);
  if (required !== CORPUS.verified) {
    throw new Error(
      `C2: Cochran's formula asks for ${required} products at ${CORPUS.confidence * 100}% ` +
        `confidence, and the paper verified ${CORPUS.verified}.`,
    );
  }

  for (const group of SCHEMA) {
    if (!HIGHLIGHTS.some((highlight) => highlight.group === group.key)) {
      throw new Error(`C2: the schema declares "${group.key}" and the page never highlights it.`);
    }
  }
}

assertPublished();
