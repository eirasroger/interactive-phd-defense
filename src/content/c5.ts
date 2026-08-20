/**
 * C5 — context-adaptive recommender. Data of record.
 *
 * Everything printed at this station is read from the paper. Where the paper
 * states a value in prose and draws it in a figure, the prose value governs,
 * because the figure is a box plot over perturbed inputs and its median is a
 * different quantity from the average the text quotes.
 *
 * Two things are deliberately drawn without numbers. Fig. 7's stakeholder
 * scores are only legible off the chart, so the stakeholder beat draws the
 * bands and the two crossings the text names and prints nothing. Fig. 8 labels
 * every cell, so the application beat prints all twenty.
 *
 * `assertPublished` checks the arithmetic that the wall asserts: the feature
 * count against its parts, the corpus against its sources and its split, every
 * model score against the expert band the paper says it falls inside, and the
 * one ranking crossing the application beat exists to show.
 */

/* ---- What the corridor hands over ----------------------------------------- */

export interface Upstream {
  readonly key: string;
  readonly station: string;
  readonly label: string;
  readonly note: string;
}

export const UPSTREAM: readonly Upstream[] = [
  {
    key: 'c1',
    station: 'C1',
    label: 'Evaluation indicators',
    note: 'The dimensions of the comparison',
  },
  {
    key: 'c2',
    station: 'C2',
    label: 'Structured product data',
    note: 'Declared values, read at scale',
  },
  {
    key: 'c3',
    station: 'C3',
    label: 'Admissible candidates',
    note: 'Alternatives that meet the requirements',
  },
  {
    key: 'c4',
    station: 'C4',
    label: 'Complete profiles',
    note: 'Estimates where information is incomplete',
  },
];

/* ---- The context the model is given ---------------------------------------- */

export const CONDITIONING = {
  archetypes: 8,
  applications: 4,
  combinations: 32,
} as const;

export interface ContextInput {
  readonly key: string;
  readonly label: string;
  readonly note: string;
  /**
   * Which conditioning channel the palette gives it. `who` is the actor, `what`
   * is the use. The opening beat introduces the two tones and the stakeholder
   * and application beats spend them, so the wall teaches the code once.
   */
  readonly channel: 'who' | 'what';
}

/**
 * The two inputs that carry the decision rather than the product.
 *
 * Neither is counted here. The archetypes are a fixed set, but the application
 * categories are defined per product category and the four used for concrete
 * were chosen as representative rather than exhaustive, so a count on the
 * opening beat would assert a taxonomy the work does not claim. The numbers
 * belong to the beats that evaluate them.
 */
export const CONTEXT_INPUTS: readonly ContextInput[] = [
  {
    key: 'stakeholder',
    label: 'Stakeholder priority',
    note: 'What the deciding actor values',
    channel: 'who',
  },
  {
    key: 'application',
    label: 'Application context',
    note: 'The intended use of the product',
    channel: 'what',
  },
];

export const OUTPUT = {
  label: 'A preference score for each alternative',
  note: 'Every score is formed against the others in the set',
} as const;

/** The two locators the opening beat writes over its incoming and its context. */
export const OPENING = {
  upstream: 'From the preceding contributions',
  context: 'Supplied with each decision',
} as const;

/**
 * The stage this contribution builds.
 *
 * Named on the wall before any of its mechanism is drawn, because the opening
 * beat has to say what the station is. The corridor's own pipeline ends here
 * and C3 already calls this stage by this name.
 */
export const STAGE = {
  index: 'The remaining stage',
  name: 'Recommendation',
  line: 'Turning the evidence into an ordering that fits the decision',
} as const;

/** The approach, named here and specified at the architecture beat. */
export const APPROACH = {
  claim:
    'The model learns this relationship from labelled decisions, so it adapts to each context without being re-specified for it.',
  moves: [
    'Learned from labelled decisions',
    'Attention across the candidate set',
    'Context as a model input',
  ] as readonly string[],
} as const;

/* ---- Why the relation is learned -------------------------------------------- */

/**
 * The heading of the supervision beat, read by `act2.ts`.
 *
 * It names the method, because nothing else in the station does: the relation
 * is conditioned on context and formed across an incomplete, unordered set, and
 * those three properties together are what a deep model is applied to. The
 * architecture that carries it is drawn at the beat after this one.
 */
export const LEARNED_CLAIM =
  'No benchmark data set exists for this task, and the deep model applied to it is trained on labelled decisions.';

/** What was done about it, and the line the beat opens on. */
export const CORPUS_CLAIM =
  'The corpus was built from three sources, each labelled by a different method.';

/* ---- Supervision ----------------------------------------------------------- */

export interface LabelSource {
  readonly key: string;
  readonly label: string;
  readonly count: number;
  /** Share of the group-weighted loss. §3.3.2 gives 2/5, 2/5, 1/5. */
  readonly weight: number;
  /** The provenance, set as the card's micro-label. */
  readonly produced: string;
  /**
   * The one fact the diagram beside it cannot draw.
   *
   * Each card carries a figure of its own labelling method, so a line restating
   * that method is a line the reader has already read. Where the figure says
   * everything, the card carries no fact at all.
   */
  readonly fact?: string;
  /** What the group puts into the trained model. */
  readonly contributes: string;
}

export const SOURCES: readonly LabelSource[] = [
  {
    key: 'control',
    label: 'Control cases',
    count: 24000,
    weight: 0.4,
    produced: 'Established analytically',
    contributes:
      'Deterministic anchor points, and a diagnostic against degenerate preference patterns.',
  },
  {
    key: 'generated',
    label: 'Generated cases',
    count: 18602,
    weight: 0.4,
    produced: 'Labelled by gpt-4.1',
    fact: 'Prompt engineering proceeded iteratively against expert feedback. A random sample of 500 labels was then read back to confirm the preference patterns were coherent.',
    contributes: 'The breadth of decision contexts, at a volume only automated labelling reaches.',
  },
  {
    key: 'expert',
    label: 'Expert cases',
    count: 272,
    weight: 0.2,
    produced: 'Six practitioners, industry and academic',
    fact: 'Every case was built by hand from real product declarations to hold a complex decision context.',
    contributes: 'Tacit judgement, and the independent signal the generated labels are read against.',
  },
];

/**
 * How the generated set was sampled, §4.2.
 *
 * The archetype mix is the part a committee tends to ask about: a tenth of the
 * scenarios carry more than one priority, and those are the ones that put
 * conflicting objectives in front of the model deliberately.
 */
export const GENERATION = {
  model: 'gpt-4.1',
  missingRate: 0.01,
  inspected: 500,
  archetypeMix: [
    { count: 1, share: 0.9 },
    { count: 2, share: 0.075 },
    { count: 3, share: 0.025 },
  ] as readonly { readonly count: number; readonly share: number }[],
} as const;

export const CORPUS = { total: 42874, train: 30011, test: 12863 } as const;

/**
 * Table 1. The split is 70/30 drawn separately inside each source, which is
 * what makes the test partition answerable: all three label types sit on both
 * sides of it, and the five cross-validation folds preserve those proportions.
 */
export const SPLIT = {
  train: 0.7,
  folds: 5,
  perSource: {
    control: { train: 16800, test: 7200 },
    generated: { train: 13021, test: 5581 },
    expert: { train: 190, test: 82 },
  } as Readonly<Record<string, { readonly train: number; readonly test: number }>>,
  note: 'Drawn inside each source, so control, generated and expert labels are all represented on both sides of it.',
} as const;

/**
 * What a group's weight is worth against what it contributed.
 *
 * The expert group is 0.63% of the scenarios and a fifth of the objective, and
 * the ratio between those two is the argument for weighting by source at all.
 * Derived from the counts above rather than written as a constant, so the two
 * cannot drift apart.
 */
export interface Influence {
  readonly key: string;
  readonly label: string;
  readonly volume: number;
  readonly objective: number;
  readonly amplification: number;
}

/** What the two bands are, written beside them rather than above and below. */
export const INFLUENCE_BANDS = {
  volume: 'How much data each source supplied',
  objective: 'How much each source weighs in training',
} as const;

export const INFLUENCE: readonly Influence[] = SOURCES.map((source) => {
  const volume = source.count / CORPUS.total;
  return {
    key: source.key,
    label: source.label,
    volume,
    objective: source.weight,
    amplification: source.weight / volume,
  };
});

/* ---- Architecture ---------------------------------------------------------- */

export const FEATURES = {
  attributes: 18,
  perAttribute: 3,
  triplet: ['Value', 'Present', 'Relevant'] as const,
  stakeholder: 8,
  application: 4,
  total: 66,
} as const;

export interface Layer {
  readonly key: string;
  readonly label: string;
  readonly detail: string;
}

export const PIPELINE: readonly Layer[] = [
  {
    key: 'encode',
    label: 'Encoder',
    detail: '256, 128, 64, each layer normalised',
  },
  {
    key: 'attend',
    label: 'Set Transformer blocks',
    detail: 'Two blocks, two heads, attention across every candidate',
  },
  {
    key: 'context',
    label: 'Global context',
    detail: 'The mean of the set, folded back into each candidate',
  },
  {
    key: 'score',
    label: 'Scoring head',
    detail: 'One preference score per candidate, between zero and one',
  },
];

export const MODEL = {
  parameters: 167361,
  minAlternatives: 2,
  maxAlternatives: 5,
  invariance: 'Permutation invariant',
  invarianceNote: 'The order candidates arrive in leaves the scores untouched',
} as const;

/* ---- Relational scoring ---------------------------------------------------- */

export interface Scored {
  readonly id: string;
  readonly score: number;
  /**
   * How far ±10% on the inputs moves the score. §5.2 reports low variability at
   * both extremes and high variability in the middle, so this carries three
   * steps and never a measured width.
   */
  readonly spread: 'narrow' | 'wide';
}

export interface CandidateSet {
  readonly key: string;
  readonly entering: string | null;
  readonly products: readonly Scored[];
}

/**
 * §5.2, read from the prose. Adding C leaves A and B separated by less than the
 * model's own mean absolute error, and adding D restores a clear order above
 * them while A and B stay together.
 */
export const SETS: readonly CandidateSet[] = [
  {
    key: 'pair',
    entering: null,
    products: [
      { id: 'A', score: 0.72, spread: 'wide' },
      { id: 'B', score: 0.32, spread: 'wide' },
    ],
  },
  {
    key: 'trio',
    entering: 'C',
    products: [
      { id: 'A', score: 0.44, spread: 'wide' },
      { id: 'B', score: 0.41, spread: 'wide' },
      { id: 'C', score: 0.86, spread: 'wide' },
    ],
  },
  {
    key: 'quartet',
    entering: 'D',
    products: [
      { id: 'A', score: 0.44, spread: 'wide' },
      { id: 'B', score: 0.41, spread: 'wide' },
      { id: 'C', score: 0.86, spread: 'wide' },
      { id: 'D', score: 0.95, spread: 'narrow' },
    ],
  },
];

/** The model's mean absolute error, which is the width A and B end up inside. */
export const MARGIN = 0.05;

/**
 * The three readings of the relational beat.
 *
 * Spoken by the caption over the panel rather than printed inside it: a line on
 * the wall and the same line in the heading above it is the same sentence
 * twice, and the panel is the picture the heading is about.
 */
export const RELATIONAL = {
  pair: 'Two candidates, and the ordering between them is clear.',
  trio: 'A stronger candidate arrives, and the two below it close to within the margin of error.',
  quartet: 'A stronger one again, and the order above the margin holds.',
} as const;

/* ---- Expert evaluation ------------------------------------------------------ */

export interface Judgement {
  readonly id: string;
  readonly expert: number;
  /** δ(1 − c) on the reported confidence, as the paper's own footnote defines. */
  readonly uncertainty: number;
  readonly model: number;
}

/** Table 3: balanced stakeholder, standard structural application. */
export const PANEL: readonly Judgement[] = [
  { id: 'A', expert: 0.6, uncertainty: 0.13, model: 0.61 },
  { id: 'B', expert: 0.44, uncertainty: 0.14, model: 0.42 },
  { id: 'C', expert: 0.78, uncertainty: 0.12, model: 0.83 },
  { id: 'D', expert: 0.91, uncertainty: 0.07, model: 0.96 },
  { id: 'E', expert: 0.05, uncertainty: 0.11, model: 0.06 },
];

export const AGREEMENT = {
  experts: 6,
  scenarios: 32,
  tau: '0.911',
  tauLabel: 'Rank agreement with the panel',
  topMatch: '96.4%',
  topLabel: 'Same leading product',
  clear: '100%',
  clearLabel: 'Agreement where the panel was decided',
  residual:
    'The distance that remains sits in the middle of the field, where the experts also parted from each other.',
} as const;

/* ---- Who is deciding -------------------------------------------------------- */

/**
 * §5.3 without numbers. Fig. 7's values are only readable off the chart, and
 * the claim needs none of them: three tiers hold across all eight archetypes,
 * and the only thing that moves is the gap inside the middle tier.
 */
export const TIERS = [
  { key: 'upper', label: 'Upper tier', members: ['D', 'C'], note: 'Holds across all eight' },
  { key: 'middle', label: 'Contested', members: ['A', 'B'], note: 'The gap here is what moves' },
  { key: 'lower', label: 'Near zero', members: ['E'], note: 'Holds across all eight' },
] as const;

export interface Archetype {
  readonly key: string;
  readonly code: string;
  readonly label: string;
  /** Where A and B sit relative to each other under this priority. */
  readonly gap: 'closed' | 'open';
  readonly reading: string;
}

export const ARCHETYPES: readonly Archetype[] = [
  {
    key: 'comfort',
    code: 'S3',
    label: 'Occupant comfort focused',
    gap: 'closed',
    reading: 'B reaches A on the strength of its performance attributes',
  },
  {
    key: 'circular',
    code: 'S5',
    label: 'Circular economy advocate',
    gap: 'open',
    reading: 'A pulls clear on the strength of its end-of-life profile',
  },
];

export const STAKEHOLDER_CLAIM =
  'Stakeholder priority decides the margin between candidates that are already close.';

/* ---- What it is for ---------------------------------------------------------- */

export type ProductId = 'A' | 'B' | 'C' | 'D' | 'E';

export const PRODUCTS: readonly ProductId[] = ['A', 'B', 'C', 'D', 'E'];

export interface Application {
  readonly key: string;
  readonly label: string;
  readonly scores: Readonly<Record<ProductId, number>>;
}

/** Fig. 8, every cell as printed, under a balanced stakeholder profile. */
export const APPLICATIONS: readonly Application[] = [
  {
    key: 'standard',
    label: 'Standard structural',
    scores: { A: 0.61, B: 0.42, C: 0.83, D: 0.96, E: 0.06 },
  },
  {
    key: 'acoustic',
    label: 'Acoustic insulation',
    scores: { A: 0.5, B: 0.48, C: 0.86, D: 0.97, E: 0.06 },
  },
  {
    key: 'thermal',
    label: 'Thermal insulation',
    scores: { A: 0.78, B: 0.42, C: 0.76, D: 0.94, E: 0.06 },
  },
  {
    key: 'finish',
    label: 'Architectural finish',
    scores: { A: 0.6, B: 0.46, C: 0.86, D: 0.93, E: 0.07 },
  },
];

export const CROSSING = {
  from: 'standard',
  to: 'thermal',
  pair: ['A', 'C'] as const,
  reading: 'Low density is the attribute the context asks for, and A carries it.',
  held: 'D keeps the lead in all four.',
} as const;

export const APPLICATION_CLAIM =
  'Application context decides which attributes are the ones that count.';

/* ---- What the model reads ------------------------------------------------------ */

export interface Salience {
  readonly key: string;
  readonly label: string;
  /** Top ten by mean absolute SHAP value, in order, from Fig. 10. */
  readonly order: readonly string[];
  readonly concentration: string;
}

/** The indicator names, so a slope line can follow one indicator across columns. */
export const INDICATORS = {
  cost: 'Life cycle costs',
  gwp: 'Global warming potential',
  origin: 'Circular origin',
  landfill: 'Inert landfilling',
  water: 'Water depletion',
  recycling: 'Recycling',
  cement: 'Cement content',
  strength: 'Compressive strength',
  freshwater: 'Freshwater use',
  aggregate: 'Maximum aggregate size',
  density: 'Density',
  slump: 'Consistency',
  biodiversity: 'Biodiversity',
  hazardous: 'Hazardous waste',
} as const;

export type IndicatorKey = keyof typeof INDICATORS;

export const SALIENCE: readonly Salience[] = [
  {
    key: 'standard',
    label: 'Standard structural',
    order: [
      'cost',
      'gwp',
      'origin',
      'landfill',
      'water',
      'recycling',
      'cement',
      'strength',
      'freshwater',
      'aggregate',
    ],
    concentration: 'Importance spread across many indicators',
  },
  {
    key: 'thermal',
    label: 'Thermal insulation',
    order: [
      'density',
      'gwp',
      'cost',
      'water',
      'landfill',
      'freshwater',
      'recycling',
      'origin',
      'biodiversity',
      'hazardous',
    ],
    concentration: 'A steep fall after the top three',
  },
  {
    key: 'finish',
    label: 'Architectural finish',
    order: [
      'origin',
      'slump',
      'aggregate',
      'gwp',
      'cost',
      'water',
      'landfill',
      'freshwater',
      'recycling',
      'biodiversity',
    ],
    concentration: 'A steep fall after the top three',
  },
];

/** How many ranks a column draws before an indicator drops to the muted lane. */
export const SHOWN_RANKS = 5;

export const SALIENCE_CLAIM =
  'These orderings came out of the labelled data, and they agree with what the experts said they do.';

/* ---- What the contribution settles ---------------------------------------------- */

export interface Settlement {
  readonly key: string;
  readonly glyph: 'bands' | 'scale';
  readonly claim: string;
  readonly figure: string;
}

export interface Transfer {
  readonly key: string;
  readonly label: string;
  readonly status: 'carries' | 'redefined';
  readonly note: string;
}

export const SETTLES = {
  headline: 'The recommendation adapts to the decision without being reconfigured for it.',
  body: 'One trained model covers thirty-two combinations of who is deciding and what the product is for.',
  points: [
    {
      key: 'panel',
      glyph: 'bands',
      claim: 'Six experts ranked thirty-two scenarios and the model reached their order',
      figure: 'Kendall τ 0.911',
    },
    {
      key: 'baseline',
      glyph: 'scale',
      claim:
        'Equal weighting and the model agree on the leading product, and the model separates the ones behind it',
      figure: 'Against C1',
    },
  ] as readonly Settlement[],
  reach: {
    label: 'What carries to another product category',
    evaluated: 'Concrete',
    components: [
      {
        key: 'sustainability',
        label: 'Sustainability indicators',
        status: 'carries',
        note: 'Defined at product level for every category',
      },
      {
        key: 'archetypes',
        label: 'Stakeholder archetypes',
        status: 'carries',
        note: 'Decision priorities hold across categories',
      },
      {
        key: 'architecture',
        label: 'Set Transformer',
        status: 'carries',
        note: 'Permutation invariance is a property of the task',
      },
      {
        key: 'performance',
        label: 'Performance indicators',
        status: 'redefined',
        note: 'Read from the standard that governs the category',
      },
    ] as readonly Transfer[],
  },
} as const;

/* ---- Assertions -------------------------------------------------------------- */

function assertPublished(): void {
  const parts =
    FEATURES.attributes * FEATURES.perAttribute + FEATURES.stakeholder + FEATURES.application;
  if (parts !== FEATURES.total) {
    throw new Error(
      `C5: ${FEATURES.attributes} attributes at ${FEATURES.perAttribute} encodings, plus ` +
        `${FEATURES.stakeholder} and ${FEATURES.application}, make ${parts}, and the paper ` +
        `publishes ${FEATURES.total} input features.`,
    );
  }

  if (CONDITIONING.archetypes * CONDITIONING.applications !== CONDITIONING.combinations) {
    throw new Error(
      `C5: ${CONDITIONING.archetypes} archetypes over ${CONDITIONING.applications} ` +
        `applications make ${CONDITIONING.archetypes * CONDITIONING.applications}, and the ` +
        `paper evaluates ${CONDITIONING.combinations} combinations.`,
    );
  }


  const labelled = SOURCES.reduce((sum, source) => sum + source.count, 0);
  if (labelled !== CORPUS.total) {
    throw new Error(
      `C5: the three label sources hold ${labelled} scenarios and the corpus is published as ` +
        `${CORPUS.total}.`,
    );
  }

  if (CORPUS.train + CORPUS.test !== CORPUS.total) {
    throw new Error(
      `C5: the split holds ${CORPUS.train + CORPUS.test} scenarios and the corpus holds ` +
        `${CORPUS.total}.`,
    );
  }

  const weight = SOURCES.reduce((sum, source) => sum + source.weight, 0);
  if (Math.abs(weight - 1) > 1e-9) {
    throw new Error(`C5: the group weights sum to ${weight.toFixed(3)} and a loss needs 1.`);
  }

  // Table 1, read both ways: every source's split has to reconstruct its own
  // count, and the three splits together have to reconstruct the partition.
  let trained = 0;
  let tested = 0;
  for (const source of SOURCES) {
    const part = SPLIT.perSource[source.key];
    if (!part) throw new Error(`C5: Table 1 gives no split for "${source.key}".`);
    if (part.train + part.test !== source.count) {
      throw new Error(
        `C5: ${source.label} splits into ${part.train + part.test} and holds ${source.count}.`,
      );
    }
    trained += part.train;
    tested += part.test;
  }
  if (trained !== CORPUS.train || tested !== CORPUS.test) {
    throw new Error(
      `C5: the per-source splits sum to ${trained}/${tested} against a corpus split of ` +
        `${CORPUS.train}/${CORPUS.test}.`,
    );
  }

  const expert = INFLUENCE.find((entry) => entry.key === 'expert');
  if (!expert || expert.amplification < 30 || expert.amplification > 33) {
    throw new Error(
      'C5: the supervision beat prints the expert group at roughly thirty times its corpus ' +
        `share, and the counts give ${expert?.amplification.toFixed(1) ?? 'nothing'}.`,
    );
  }

  const mix = GENERATION.archetypeMix.reduce((sum, entry) => sum + entry.share, 0);
  if (Math.abs(mix - 1) > 1e-9) {
    throw new Error(`C5: the archetype mix covers ${(mix * 100).toFixed(1)}% of the scenarios.`);
  }

  for (const entry of PANEL) {
    const distance = Math.abs(entry.model - entry.expert);
    if (distance > entry.uncertainty + 1e-9) {
      throw new Error(
        `C5: product ${entry.id} is drawn at ${entry.model} against an expert band of ` +
          `${entry.expert} ± ${entry.uncertainty}, and §5.1 states every model score falls ` +
          `inside its band.`,
      );
    }
  }

  const application = (key: string): Application => {
    const found = APPLICATIONS.find((entry) => entry.key === key);
    if (!found) throw new Error(`C5: no application on file for "${key}".`);
    return found;
  };

  const [first, second] = CROSSING.pair;
  const before = application(CROSSING.from).scores;
  const after = application(CROSSING.to).scores;
  if (!(before[first] < before[second] && after[first] > after[second])) {
    throw new Error(
      `C5: the application beat exists to show ${first} passing ${second} between ` +
        `${CROSSING.from} and ${CROSSING.to}, and the published scores do not cross.`,
    );
  }

  const leader = (scores: Readonly<Record<ProductId, number>>): ProductId =>
    PRODUCTS.reduce((best, id) => (scores[id] > scores[best] ? id : best));
  for (const entry of APPLICATIONS) {
    if (leader(entry.scores) !== 'D') {
      throw new Error(
        `C5: ${entry.label} leads with ${leader(entry.scores)}, and §5.4 states D keeps the ` +
          `lead across all four applications.`,
      );
    }
  }

  const [, trio] = SETS;
  const gap = (trio?.products ?? []).filter((entry) => entry.id === 'A' || entry.id === 'B');
  const [a, b] = gap;
  if (!a || !b || Math.abs(a.score - b.score) > MARGIN) {
    throw new Error(
      `C5: §5.2 states A and B fall inside the model's margin of error once C is added, and ` +
        `the drawn scores are further apart than ${MARGIN}.`,
    );
  }

  for (const entry of SALIENCE) {
    for (const key of entry.order) {
      if (!(key in INDICATORS)) {
        throw new Error(`C5: ${entry.label} ranks "${key}", which is not a named indicator.`);
      }
    }
    if (new Set(entry.order).size !== entry.order.length) {
      throw new Error(`C5: ${entry.label} ranks an indicator twice.`);
    }
  }
}

assertPublished();
