/**
 * C5: context-adaptive recommender. All values come from the paper. Where prose
 * and a figure differ, the prose value is used (the figures are box plots).
 *
 * `assertPublished` checks the printed arithmetic against the paper at load.
 */

/* ---- Inputs from earlier contributions ------------------------------------ */

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

/* ---- Context inputs --------------------------------------------------------- */

export const CONDITIONING = {
  archetypes: 8,
  applications: 4,
  combinations: 32,
} as const;

export interface ContextInput {
  readonly key: string;
  readonly label: string;
  readonly note: string;
  /** Colour channel: `who` is the actor, `what` is the use. Reused by later beats. */
  readonly channel: 'who' | 'what';
}

/**
 * The two decision inputs. No counts shown here: the four applications used
 * for concrete are a representative sample of a per-category set.
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

/** Opening-beat labels over the upstream inputs and the context inputs. */
export const OPENING = {
  upstream: 'From the preceding contributions',
  context: 'Supplied with each decision',
} as const;

/** The pipeline stage this contribution builds. C3 uses the same name. */
export const STAGE = {
  index: 'The remaining stage',
  name: 'Recommendation',
  line: 'Turning the evidence into an ordering that fits the decision',
} as const;

/** The approach in brief. Detailed at the architecture beat. */
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

/** Supervision beat heading, read by `act2.ts`. */
export const LEARNED_CLAIM =
  'No benchmark data set exists for this task, and the deep model applied to it is trained on labelled decisions.';

/** Opening line of the supervision beat. */
export const CORPUS_CLAIM =
  'The corpus was built from three sources, each labelled by a different method.';

/* ---- Supervision ----------------------------------------------------------- */

export interface LabelSource {
  readonly key: string;
  readonly label: string;
  readonly count: number;
  /** Share of the group-weighted loss. §3.3.2 gives 2/5, 2/5, 1/5. */
  readonly weight: number;
  /** Provenance, shown as the card's micro-label. */
  readonly produced: string;
  /** Extra fact the card's diagram cannot show. Omitted when the diagram covers it. */
  readonly fact?: string;
  /** What the group adds to the trained model. */
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
 * How the generated set was sampled, §4.2. A tenth of the scenarios combine
 * several priorities, which gives the model conflicting objectives.
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
 * Table 1. A 70/30 split made inside each source, so all three label types
 * appear in train and test. The five CV folds keep the same proportions.
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
 * Each source's share of the data against its share of the loss. The expert
 * group is 0.63% of the data and 20% of the loss. Derived from `SOURCES`.
 */
export interface Influence {
  readonly key: string;
  readonly label: string;
  readonly volume: number;
  readonly objective: number;
  readonly amplification: number;
}

/** Labels for the two influence bands. */
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

/**
 * The 18 attributes of a concrete alternative, §3.1.1 and §4.1. Eleven are
 * generic sustainability indicators. Seven are concrete-specific performance
 * properties from EN 206. Count checked against `FEATURES.attributes`.
 */
export interface AttributeFamily {
  readonly key: string;
  readonly label: string;
  /** Source standard, if any. */
  readonly source?: string;
  readonly attributes: readonly string[];
}

export const ATTRIBUTE_FAMILIES: readonly AttributeFamily[] = [
  {
    key: 'circularity',
    label: 'Circularity',
    attributes: [
      'Circular origin',
      'Recycling',
      'Incineration',
      'Inert landfilling',
      'Hazardous waste',
    ],
  },
  {
    key: 'environmental',
    label: 'Environmental',
    attributes: [
      'Global warming potential',
      'Water depletion potential',
      'Freshwater use',
      'Biodiversity impact',
    ],
  },
  {
    key: 'economic',
    label: 'Economic',
    attributes: ['Life cycle costs'],
  },
  {
    key: 'health',
    label: 'Health',
    attributes: ['Product health, C2C scoring'],
  },
  {
    key: 'performance',
    label: 'Performance',
    source: 'EN 206, tailored to concrete',
    attributes: [
      'Compressive strength class',
      'Consistency class',
      'Water-to-cement ratio',
      'Cementitious content',
      'Supplementary cementitious materials',
      'Maximum aggregate size',
      'Density',
    ],
  },
];

/** Label above the input vector list. */
export const CASE_STUDY = {
  label: 'The input vector for a concrete alternative',
} as const;

/** Architecture beat heading, read by `act2.ts`. Lists the forward pass in order. */
export const ARCHITECTURE_CLAIM =
  'The model encodes every alternative, compares them against each other, and scores each one against the whole set.';

export interface Layer {
  readonly key: string;
  readonly label: string;
  readonly detail: string;
}

export const PIPELINE: readonly Layer[] = [
  {
    key: 'encode',
    label: 'Encoder',
    detail: '256, 128, 64, each normalised, ReLU and dropout',
  },
  {
    key: 'attend',
    label: 'Set Transformer blocks',
    detail: 'Two blocks, two heads, attention across every candidate',
  },
  {
    key: 'context',
    label: 'Global context',
    detail: 'The mean embedding of the set, concatenated back onto each candidate',
  },
  {
    key: 'score',
    label: 'Scoring head',
    detail: 'Two-layer MLP and a sigmoid, one score per candidate between zero and one',
  },
];

/** Note under the architecture board. */
export const SHARED_CONTEXT =
  'The stakeholder archetype and the application are the same for every alternative in the set.';

export const MODEL = {
  parameters: 167361,
  minAlternatives: 2,
  maxAlternatives: 5,
  /** §3.3.1.2. Two Set Transformer blocks, two attention heads in each. */
  blocks: 2,
  heads: 2,
  invariance: 'Permutation invariant',
  invarianceNote: 'A change in the order alternatives arrive in leaves every score where it was',
} as const;

/* ---- Expert evaluation ------------------------------------------------------ */

export interface Judgement {
  readonly id: string;
  readonly expert: number;
  /** δ(1 − c) on the reported confidence, as defined in the paper's footnote. */
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

/** Model interval (its mean absolute error), printed in Table 3 beside every score. */
export const MODEL_UNCERTAINTY = 0.05;

/**
 * §5.1. Figures across all 32 scenarios, except the mean deviation, which is
 * for the `PANEL` scenario only.
 */
export const AGREEMENT = {
  experts: 6,
  scenarios: 32,
  scenario: 'Balanced priority, standard structural',
  figures: [
    {
      key: 'tau',
      figure: '0.911',
      label: "Mean Kendall's τ against expert rankings",
      note: 'SD 0.122',
    },
    {
      key: 'top',
      figure: '96.4%',
      label: "Model's first choice matches the expert's",
      note: 'Across all 32 scenarios',
    },
    {
      key: 'clear',
      figure: '100%',
      label: 'Agreement where experts clearly preferred or clearly rejected',
      note: 'Preference ≥ 0.75 or ≤ 0.25',
    },
    {
      key: 'deviation',
      figure: '0.028',
      label: 'Mean deviation from expert consensus',
      note: 'In the scenario drawn above',
    },
  ] as readonly { readonly key: string; readonly figure: string; readonly label: string; readonly note: string }[],
  residual:
    'What distance remains is concentrated in the mid-ranked alternatives, where the experts also parted from each other.',
} as const;

/** Section labels of the validation beat. */
export const VALIDATION_BLOCKS = {
  panel: 'Validation against the expert panel',
  behaviour: 'Model behaviour under context',
  importance: 'What the model weighs, by application',
} as const;

/**
 * The two conditioning inputs, each with its own heading. Stakeholder priority
 * shifts margins (§5.3). Application context can reorder the mid-tier (§5.4).
 */
export const BEHAVIOUR_STUDIES = {
  stakeholder: {
    title: 'Changing stakeholder priority',
    takeaway: 'A tie-breaker between contested candidates.',
  },
  application: {
    title: 'Changing application context',
    takeaway: 'Produces larger score shifts.',
  },
} as const;

/** Summary line under the behaviour beat. */
export const BEHAVIOUR_TAKEAWAY = 'Indicator weighting changes dynamically with context.';

export const VALIDATION_CLAIM =
  'The model is validated against expert judgement, and its behaviour analysed under changing priorities and applications.';

/* ---- Who is deciding -------------------------------------------------------- */

/**
 * §5.3: three tiers hold across all eight archetypes. Only the gap inside the
 * middle tier moves.
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

/**
 * Fig. 7: eight archetypes by five products. The figure has no value labels,
 * so scores (0 to 1) are read off the bars at chart precision.
 */
export interface StakeholderScenario {
  readonly code: string;
  readonly label: string;
  readonly scores: Readonly<Record<ProductId, number>>;
}

export const STAKEHOLDER_SCENARIOS: readonly StakeholderScenario[] = [
  { code: 'S1', label: 'Sustainability maximalist', scores: { A: 0.485, B: 0.375, C: 0.865, D: 0.978, E: 0.058 } },
  { code: 'S2', label: 'Cost-conscious developer', scores: { A: 0.643, B: 0.484, C: 0.822, D: 0.915, E: 0.075 } },
  { code: 'S3', label: 'Occupant comfort focused', scores: { A: 0.596, B: 0.531, C: 0.831, D: 0.948, E: 0.058 } },
  { code: 'S4', label: 'Health and safety focused', scores: { A: 0.526, B: 0.481, C: 0.833, D: 0.968, E: 0.046 } },
  { code: 'S5', label: 'Circular economy advocate', scores: { A: 0.512, B: 0.377, C: 0.826, D: 0.978, E: 0.070 } },
  { code: 'S6', label: 'Regulatory aligned', scores: { A: 0.6, B: 0.469, C: 0.81, D: 0.955, E: 0.056 } },
  { code: 'S7', label: 'Balanced optimiser', scores: { A: 0.625, B: 0.441, C: 0.831, D: 0.955, E: 0.058 } },
  { code: 'S8', label: 'Pragmatic contractor', scores: { A: 0.603, B: 0.503, C: 0.822, D: 0.942, E: 0.067 } },
];

/** The two archetypes named in §5.3: smallest and largest A-B gap. */
export const STAKEHOLDER_MARKED = ['S3', 'S5'] as const;

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

/** Indicator names by key, so a slope line can follow one indicator across columns. */
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
    concentration: 'Density dominates',
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

/**
 * Fig. 10 bar lengths, read off the chart at gridline precision. The order is
 * exact. Per §5.5, thermal and finish drop steeply after the top three, while
 * standard structural spreads importance across many indicators.
 */
export interface SalienceWeight {
  readonly key: IndicatorKey;
  readonly weight: number;
}

export const SALIENCE_WEIGHTS: Readonly<Record<string, readonly SalienceWeight[]>> = {
  standard: [
    { key: 'cost', weight: 0.0072 },
    { key: 'gwp', weight: 0.0068 },
    { key: 'origin', weight: 0.006 },
    { key: 'landfill', weight: 0.0058 },
    { key: 'water', weight: 0.0043 },
    { key: 'recycling', weight: 0.0035 },
  ],
  thermal: [
    { key: 'density', weight: 0.0135 },
    { key: 'gwp', weight: 0.008 },
    { key: 'cost', weight: 0.0068 },
    { key: 'water', weight: 0.006 },
    { key: 'landfill', weight: 0.005 },
    { key: 'freshwater', weight: 0.0038 },
  ],
  finish: [
    { key: 'origin', weight: 0.015 },
    { key: 'slump', weight: 0.014 },
    { key: 'aggregate', weight: 0.0098 },
    { key: 'gwp', weight: 0.0055 },
    { key: 'cost', weight: 0.005 },
    { key: 'water', weight: 0.0048 },
  ],
};

/**
 * Combined weight of the seven indicators outside the top ten (one bar in
 * Fig. 10). Small where importance is concentrated.
 */
export const SALIENCE_REMAINING: Readonly<Record<string, number>> = {
  standard: 0.0072,
  thermal: 0.0012,
  finish: 0.0038,
};

/** Widest bar across all panels, so the three share one scale. */
export const SALIENCE_MAX = 0.015;

/** Ranks shown per column before an indicator moves to the muted lane. */
export const SHOWN_RANKS = 5;

export const SALIENCE_CLAIM =
  'These orderings came out of the labelled data, and they agree with what the experts said they do.';

/* ---- Robustness to missing data ---------------------------------------------- */

/**
 * Table 4. Each condition removes whole attribute families for every
 * alternative. Health is never masked. `topChanged` is 0 in every row: the
 * top recommendation never changes.
 */
export interface Masking {
  readonly key: string;
  readonly label: string;
  readonly families: readonly string[];
  readonly tau: number;
  readonly tauSd: number;
  readonly topChanged: number;
  readonly maxDelta: number;
  readonly meanDelta: number;
  readonly reading: string;
}

export const MASKING: readonly Masking[] = [
  {
    key: 'cost',
    label: 'No cost data',
    families: ['economic'],
    tau: 0.894,
    tauSd: 0.101,
    topChanged: 0,
    maxDelta: 0.11,
    meanDelta: 0.055,
    reading: 'Cost is what separates alternatives whose profiles are otherwise close.',
  },
  {
    key: 'epd',
    label: 'No EPD data',
    families: ['environmental', 'circularity'],
    tau: 0.913,
    tauSd: 0.101,
    topChanged: 0,
    maxDelta: 0.181,
    meanDelta: 0.098,
    reading: 'The largest movement falls on the stakeholders who priced sustainability highest.',
  },
  {
    key: 'performance',
    label: 'No performance data',
    families: ['performance'],
    tau: 0.963,
    tauSd: 0.079,
    topChanged: 0,
    maxDelta: 0.203,
    meanDelta: 0.087,
    reading: 'Performance moves every alternative together, so the order survives it best.',
  },
];

export const ROBUSTNESS = {
  tests: CONDITIONING.combinations * MASKING.length,
  invariant: 'D' as ProductId,
  label: 'tests with a whole category of evidence removed',
  held: 'The leading recommendation held in every one.',
  encoding: 'An absent indicator is encoded as absent rather than filled in.',
} as const;

/* ---- What the contribution enables --------------------------------------------- */

/**
 * The three closing claims: what the tool lets a practitioner do.
 * `caption` is also the beat heading, read by `act2.ts`.
 */
export interface Enablement {
  readonly key: string;
  readonly index: string;
  readonly title: string;
  readonly caption: string;
  readonly body: string;
}

export const ENABLES: readonly Enablement[] = [
  {
    key: 'profile',
    index: '01',
    title: 'Beyond cost and availability',
    caption:
      'The recommendation is formed on the full environmental, circular, economic and performance profile of every alternative.',
    body: 'The full declared profile of every alternative. Environmental, circular, economic, health and performance, weighed together.',
  },
  {
    key: 'context',
    index: '02',
    title: 'Shaped by the context',
    caption:
      'Stakeholder priority and application context enter the model as inputs, so the recommendation is specific to the context it is made in.',
    body: 'Who is deciding, and what the product is for. The same candidates, ordered for the context in front of you.',
  },
  {
    key: 'incomplete',
    index: '03',
    title: 'Designed for uncertainty',
    caption:
      'Uncertainty is managed rather than avoided: the model is trained with whole categories of evidence removed.',
    body: 'Early-stage information is partial and inconsistent. Training removes whole categories of evidence, so the recommendation holds on what a project actually has.',
  },
];

export const ENABLES_EYEBROW = 'What this contribution enables';

/**
 * Illustrative orderings for the closing cards. They demonstrate the tool's
 * behaviour and are separate from the case study results.
 */
export const SHOWCASE = {
  cost: ['A', 'D', 'C', 'B', 'E'] as readonly ProductId[],
  recommended: ['D', 'C', 'A', 'B', 'E'] as readonly ProductId[],
  /** Second by cost, first by the full profile. */
  promoted: 'D' as ProductId,
  scores: { A: 0.61, B: 0.42, C: 0.83, D: 0.96, E: 0.06 } as Readonly<Record<ProductId, number>>,
  /** Scores with evidence categories removed. Each moves slightly; the order holds. */
  uncertain: { A: 0.65, B: 0.39, C: 0.79, D: 0.93, E: 0.09 } as Readonly<Record<ProductId, number>>,

  /**
   * Four decision contexts and their orderings. The leader changes three times.
   * `who` and `what` are dial positions.
   */
  contexts: [
    { who: 6, what: 0, order: ['D', 'C', 'A', 'B', 'E'] },
    { who: 0, what: 0, order: ['C', 'D', 'A', 'B', 'E'] },
    { who: 6, what: 2, order: ['A', 'C', 'D', 'B', 'E'] },
    { who: 6, what: 3, order: ['D', 'A', 'C', 'B', 'E'] },
  ] as readonly { readonly who: number; readonly what: number; readonly order: readonly ProductId[] }[],
} as const;

export const COST_LABELS = { cost: 'Cost only', model: 'Full picture' } as const;

/** Masking condition shown on the third card (removes two families). */
export const CLOSING_CONDITION = 'epd';

/** Context change shown on the second card, from Fig. 8. */
export const CONTEXT_MOVE = {
  who: 'Balanced optimiser',
  from: CROSSING.from,
  to: CROSSING.to,
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

  // Table 1: each source's split sums to its count, and all splits sum to the corpus split.
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

  const named = ATTRIBUTE_FAMILIES.reduce((sum, family) => sum + family.attributes.length, 0);
  if (named !== FEATURES.attributes) {
    throw new Error(
      `C5: the architecture beat names ${named} concrete attributes and the feature count ` +
        `is built from ${FEATURES.attributes}.`,
    );
  }

  // Fig. 7 values are read off a chart, so check them against the claims in §5.3.
  for (const scenario of STAKEHOLDER_SCENARIOS) {
    const { A, B, C, D, E } = scenario.scores;
    if (!(D > C && C > A && C > B && E < 0.1)) {
      throw new Error(
        `C5: ${scenario.code} is drawn out of the tier structure §5.3 states holds across all eight.`,
      );
    }
    if (A < B) {
      throw new Error(`C5: ${scenario.code} puts B above A, which Fig. 7 never does.`);
    }
  }

  const gapOf = (code: string): number => {
    const found = STAKEHOLDER_SCENARIOS.find((entry) => entry.code === code);
    if (!found) throw new Error(`C5: no stakeholder scenario "${code}".`);
    return found.scores.A - found.scores.B;
  };
  const [closest, widest] = STAKEHOLDER_MARKED;
  if (gapOf(closest) >= gapOf(widest)) {
    throw new Error(
      `C5: §5.3 names ${closest} as the archetype where B closes on A and ${widest} as the one ` +
        'where A pulls clear, and the drawn scores do not hold that.',
    );
  }

  for (const [context, bars] of Object.entries(SALIENCE_WEIGHTS)) {
    const published = SALIENCE.find((entry) => entry.key === context);
    if (!published) throw new Error(`C5: Fig. 10 has no context "${context}".`);
    for (const [index, bar] of bars.entries()) {
      if (published.order[index] !== bar.key) {
        throw new Error(
          `C5: ${context} draws ${bar.key} at rank ${index + 1} and Fig. 10 ranks ` +
            `${published.order[index]} there.`,
        );
      }
      const next = bars[index + 1];
      if (next && next.weight > bar.weight) {
        throw new Error(`C5: ${context} draws rank ${index + 2} longer than rank ${index + 1}.`);
      }
    }
  }

  const mix = GENERATION.archetypeMix.reduce((sum, entry) => sum + entry.share, 0);
  if (Math.abs(mix - 1) > 1e-9) {
    throw new Error(`C5: the archetype mix covers ${(mix * 100).toFixed(1)}% of the scenarios.`);
  }

  // §5.1: every model score is inside the expert band, and the model interval
  // is narrower than the expert interval for every product.
  for (const entry of PANEL) {
    if (MODEL_UNCERTAINTY >= entry.uncertainty) {
      throw new Error(
        `C5: product ${entry.id} is drawn with a model interval of ±${MODEL_UNCERTAINTY} against ` +
          `an expert interval of ±${entry.uncertainty}, and Table 3 has the model tighter.`,
      );
    }
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

  const familyKeys = new Set(ATTRIBUTE_FAMILIES.map((family) => family.key));
  for (const condition of MASKING) {
    for (const key of condition.families) {
      if (!familyKeys.has(key)) {
        throw new Error(`C5: "${condition.label}" removes family "${key}", which does not exist.`);
      }
    }
    if (condition.topChanged !== 0) {
      throw new Error(
        `C5: Table 4 reports the top-ranked product unchanged under every condition, and ` +
          `"${condition.label}" is drawn at ${condition.topChanged}%.`,
      );
    }
    if (condition.meanDelta > condition.maxDelta) {
      throw new Error(`C5: "${condition.label}" draws a mean shift above its own maximum.`);
    }
  }

  if (MASKING.some((condition) => condition.families.includes('health'))) {
    throw new Error('C5: Table 4 masks no health indicator, and the drawing removes one.');
  }

  if (!MASKING.some((condition) => condition.key === CLOSING_CONDITION)) {
    throw new Error(`C5: no published condition named "${CLOSING_CONDITION}".`);
  }

  for (const key of [CONTEXT_MOVE.from, CONTEXT_MOVE.to]) {
    if (!APPLICATIONS.some((entry) => entry.key === key)) {
      throw new Error(`C5: no application named "${key}".`);
    }
  }

  if (ROBUSTNESS.tests !== 96) {
    throw new Error(
      `C5: thirty-two combinations over three conditions make ninety-six tests, and the wall ` +
        `prints ${ROBUSTNESS.tests}.`,
    );
  }

  if (SHOWCASE.cost[0] === SHOWCASE.recommended[0]) {
    throw new Error(
      'C5: the first card exists to show the cheapest alternative and the recommended one being ' +
        'different, and the two columns lead with the same one.',
    );
  }
  if (SHOWCASE.cost.indexOf(SHOWCASE.promoted) !== 1 || SHOWCASE.recommended[0] !== SHOWCASE.promoted) {
    throw new Error(`C5: ${SHOWCASE.promoted} is drawn rising to first and does not start second.`);
  }
  for (const list of [SHOWCASE.cost, SHOWCASE.recommended]) {
    if (new Set(list).size !== PRODUCTS.length) {
      throw new Error('C5: a showcase ordering does not hold every alternative exactly once.');
    }
  }

  let leaders = 0;
  for (const [index, context] of SHOWCASE.contexts.entries()) {
    if (new Set(context.order).size !== PRODUCTS.length) {
      throw new Error(`C5: showcase context ${index} does not hold every alternative once.`);
    }
    const before = SHOWCASE.contexts[index - 1];
    if (before && before.order[0] !== context.order[0]) leaders += 1;
  }
  if (leaders < 2) {
    throw new Error(
      `C5: the second card exists to show the recommendation changing with the context, and the ` +
        `leading alternative changes ${leaders} times across the drawn settings.`,
    );
  }

  const shaken = [...SHOWCASE.recommended].sort(
    (left, right) => SHOWCASE.uncertain[right] - SHOWCASE.uncertain[left],
  );
  if (shaken.join('') !== SHOWCASE.recommended.join('')) {
    throw new Error(
      'C5: the third card moves every score a little and keeps the ordering, and the drawn ' +
        `values reorder to ${shaken.join('')}.`,
    );
  }
  for (const id of PRODUCTS) {
    if (Math.abs(SHOWCASE.uncertain[id] - SHOWCASE.scores[id]) > 0.06) {
      throw new Error(`C5: ${id} moves further under uncertainty than the card claims.`);
    }
  }

  if (ENABLES.length !== 3) {
    throw new Error(`C5: the closing beat is built for three claims and holds ${ENABLES.length}.`);
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
