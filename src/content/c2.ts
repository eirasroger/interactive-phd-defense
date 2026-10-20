/**
 * C2 data: empirical characterisation. All values come from the published paper
 * (Table 1, Table 3, section 3.3). Values the paper does not publish are omitted.
 * `assertPublished()` checks the category counts and Cochran sample at load.
 */

export const CORPUS = {
  products: 8463,
  /** Products checked by hand against the source declaration. */
  verified: 368,
  errors: 0,
  confidence: 0.95,
  precision: 0.05,
  /** Share of the corpus declared in Europe. */
  europe: 0.7,
  source: 'The International EPD System · Type III · EN 15804+A2 · PCR 2019:14',
} as const;

/** Digital product passport rollout dates, from section 1 of the paper. */
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

/** Years before construction products get passports. */
export const INTERIM = { from: 2026, to: 2030 } as const;

/** Data the evaluation framework needs for each candidate. */
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

/** Fig. 3, in tree map order. */
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
 * Pathway value class, used for colour. `recovery` returns material to use,
 * `energy` burns it for energy, `loss` keeps nothing, `origin` is upstream.
 */
export type Worth = 'origin' | 'recovery' | 'energy' | 'loss';

export interface Pathway {
  readonly key: string;
  readonly label: string;
  readonly worth: Worth;
  /** Products whose declaration reports this metric. */
  readonly n: number;
  readonly mean: number;
  readonly median: number;
  readonly max: number;
  /** Recovery other than recycling. */
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

/** Sum of mean shares for all recovery pathways, recycling included. */
export const RECOVERED = PATHWAYS.filter((pathway) => pathway.worth === 'recovery').reduce(
  (sum, pathway) => sum + pathway.mean,
  0,
);

/** Sum of mean shares for recovery pathways other than recycling. */
export const BEYOND_RECYCLING = PATHWAYS.filter((pathway) => pathway.beyondRecycling).reduce(
  (sum, pathway) => sum + pathway.mean,
  0,
);

/** Disassembly score, section 3.3.2. 0 is easy, 2 is impossible. */
export const DISMANTLE = { mean: 1.5, median: 2, best: 0, worst: 2 } as const;

/**
 * Circular origin and end-of-life recycling (%) for the three categories where
 * the paper publishes both. The gap between them is the decoupling.
 */
export const DECOUPLED = [
  { key: 'insulation', label: 'Thermal and acoustic insulation', origin: 46.0, recycling: 4.3 },
  { key: 'structural', label: 'Structural systems', origin: 35.9, recycling: 22.8 },
  { key: 'coating', label: 'Coating and cladding', origin: 8.6, recycling: 9.6 },
] as const;

/** The paper's two reasons recycled material is not recovered again. */
export const BLOCKERS = [
  {
    key: 'degradation',
    label: 'Material degradation',
    body: 'Gypsum and some polymers degrade over repeated cycles.',
  },
  {
    key: 'infrastructure',
    label: 'Missing processing capacity',
    body: 'Without specialised processors, recovery defaults to landfill.',
  },
] as const;

export interface Stage {
  readonly key: string;
  readonly label: string;
  /** Share of total lifecycle burden (%). Section 3.4 puts A1-A3 at 80-98%. */
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

/** Published product stage range (%). */
export const PRODUCT_BAND = { low: 80, high: 98 } as const;

/** Module D offsets (%) for environmental and biodiversity burden. */
export const OFFSETS = [
  {
    key: 'environmental',
    label: 'Environmental burden',
    value: 15,
    note: 'Module D offsets 10 to 15%.',
  },
  {
    key: 'biodiversity',
    label: 'Biodiversity burden',
    value: 1,
    note: 'Module D offsets about 1%.',
  },
] as const;

/**
 * Table 3, product stage GWP in kg CO2e per kg. The mean-median gap shows the
 * spread within each category.
 */
export const GWP_BY_CATEGORY = [
  { key: 'pavements', label: 'Pavements', mean: 1.2, median: 0.16 },
  { key: 'partitions', label: 'Partitions', mean: 1.3, median: 0.26 },
  { key: 'carpentry', label: 'Carpentry', mean: 4.8, median: 1.2 },
] as const;

/**
 * Example declaration wordings and the pathway label each maps to. The same
 * word can mean different outcomes, so extraction needs a language model.
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
 * Output schema for every product. Biodiversity indicators are part of the
 * environmental group. Performance comes from the Declaration of Performance.
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

/** Lifecycle modules. Each impact field is stored per module. */
export const MODULES = 'A1–A3 · A4 · A5 · C1 · C2 · C3 · C4 · D';

export interface Highlight {
  /** Position and width as fractions of page size (0 to 1). */
  readonly x: number;
  readonly y: number;
  readonly w: number;
  /** Schema group key. */
  readonly group: string;
  /** Location in the document. */
  readonly locus: string;
}

/** Where each schema group appears on a sample declaration page. */
export const HIGHLIGHTS: readonly Highlight[] = [
  { x: 0.1, y: 0.11, w: 0.44, group: 'identity', locus: 'Cover page' },
  { x: 0.1, y: 0.3, w: 0.62, group: 'composition', locus: 'Table' },
  { x: 0.52, y: 0.46, w: 0.38, group: 'environmental', locus: 'Table' },
  { x: 0.1, y: 0.62, w: 0.55, group: 'performance', locus: 'Declaration of Performance' },
  { x: 0.1, y: 0.82, w: 0.7, group: 'circularity', locus: 'Narrative section' },
];

export const EXTRACTOR = {
  model: 'gpt-4o-2024-08-06',
  guardrail: 'Missing indicators are returned as null.',
  steps: ['Acquire · Selenium', 'Flatten · PyMuPDF', 'Structure · LLM'],
} as const;

/** Cochran (1963) sample size with finite population correction. */
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
