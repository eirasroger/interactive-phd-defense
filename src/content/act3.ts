import type { CaptionContent } from '@/components/Caption';

/**
 * Act III copy. The heading is the claim column from `narrative.md`. Station
 * labels repeat the paper roles from Acts I and II so the plan view names each room.
 */
export const act3Captions = {
  whole: {
    eyebrow: 'Integrated pipeline',
    heading:
      'Extraction quality, compliance outcomes and inferred attributes propagate coherently to the recommendation.',
  },
} satisfies Record<string, CaptionContent>;

export const STATION_ROLES: Record<string, string> = {
  C1: 'Decision framework',
  C2: 'Empirical characterisation',
  C3: 'Screening agent',
  C4: 'Inference',
  C5: 'Context-adaptive recommender',
};


/* ---- Cross-cutting theme 1: artificial intelligence -------------------------- */

/**
 * One pipeline stage on the backbone: the task, the model family that does it,
 * and what makes the task different at this stage. Discussion slide, so it
 * carries no numbers or results.
 */
export interface BackboneNode {
  readonly key: 'extract' | 'screen' | 'estimate' | 'recommend';
  /** The task, in one word. */
  readonly verb: string;
  readonly family: string;
  /** Why the task is different here. Never a number. */
  readonly need: string;
}

export const BACKBONE_NODES: readonly BackboneNode[] = [
  {
    key: 'extract',
    verb: 'Extract',
    family: 'Large language model',
    need: 'Unstructured sources, into records',
  },
  {
    key: 'screen',
    verb: 'Screen',
    family: 'LLM agent, human in the loop',
    need: 'An outcome that carries consequence',
  },
  {
    key: 'estimate',
    verb: 'Estimate',
    family: 'Deep learning',
    need: 'Evidence that is missing',
  },
  {
    key: 'recommend',
    verb: 'Recommend',
    family: 'Deep learning, labels from an LLM',
    need: 'Preference with no ground truth',
  },
];

/** Cross-cutting theme 1. One beat of about 30 seconds. */
export const BACKBONE = {
  eyebrow: 'Cross-cutting themes',
  heading: 'Artificial intelligence as the methodological backbone',
  line: 'A different method at each stage, decided by what the stage needs.',
} as const;

/* ---- Cross-cutting theme 2: conditions the architecture is designed around ---- */

/**
 * Cross-cutting theme 2. Missing evidence and context sensitivity share one
 * slide because both are properties of the problem that span every stage.
 */
export const CONDITIONS = {
  eyebrow: 'Cross-cutting themes',
  heading: 'Missing data and context as structural conditions',
  line: 'Both run the length of the pipeline, and both are answered at every stage.',
} as const;

/**
 * The two cards: a claim, then three supporting steps each. Plain sentences
 * with no numbers, method names or per-contribution detail.
 */
export const CARDS = {
  evidence: {
    heading: 'The missing-data thread',
    lead: 'The pipeline is built to run on incomplete information.',
    steps: [
      'It targets early design and early construction, where product decisions carry the most influence and the evidence is thinnest.',
      'Inference recovers part of what a product has not declared.',
      'The recommender accepts missing values as valid input and returns a recommendation anyway.',
    ],
  },
  context: {
    heading: 'Context sensitivity',
    lead: 'Context decides which indicators matter, and how much.',
    steps: [
      'Admissibility and feasibility settle which products can be considered at all.',
      'Application and stakeholder priority set the weight each indicator carries.',
      'The recommendation is therefore made for the needs of the project at hand.',
    ],
  },
} as const;

/* ---- The closing frame ------------------------------------------------------------- */

/**
 * The closing frame, titled after the matching thesis chapter. Three bands, one
 * per beat, under a fixed title. The full layout is present from the first beat
 * and each beat highlights one band.
 */
export const STANDING = {
  eyebrow: 'Discussion',
  heading: 'Implications, limitations, and future work',
} as const;

export type StandingIcon =
  | 'comparison'
  | 'context'
  | 'partial'
  | 'earlier'
  | 'declaration'
  | 'coverage'
  | 'threshold';

export interface StandingRow {
  /** Short name for the claim. */
  readonly lead: string;
  /** One sentence, sized to fit its column. */
  readonly note: string;
  readonly icon: StandingIcon;
}

export interface StandingBand {
  readonly key: 'knowledge' | 'practice';
  readonly label: string;
  readonly rows: readonly StandingRow[];
}

/**
 * The first two bands. Theoretical contributions are claims about the problem
 * class. Practical implications are ordered by distance from the decision.
 * Each note must fit in three lines of its column, or the row breaks.
 */
export const STANDING_BANDS: readonly StandingBand[] = [
  {
    key: 'knowledge',
    label: 'Theoretical contributions',
    rows: [
      {
        lead: 'Relative comparison as the evaluation logic for early design',
        note: 'Comparison across candidates is established as a valid mode of evaluation where absolute accounting cannot be supported, its validity resting on evidence assembled consistently for each.',
        icon: 'comparison',
      },
      {
        lead: 'Context integrated into the recommendation itself',
        note: 'The recommendation is conditioned on the application and on the priorities of the project, so the ranking is produced for the case at hand.',
        icon: 'context',
      },
      {
        lead: 'Evaluation under incomplete evidence',
        note: 'Uncertainty and partial information are treated as working conditions of early design, so products are ranked without requiring complete declarations.',
        icon: 'partial',
      },
    ],
  },
  {
    key: 'practice',
    label: 'Practical implications',
    rows: [
      {
        lead: 'Design and procurement',
        note: 'An operational instrument for sustainable and circular selection at the stage the decision is taken, which was not previously available.',
        icon: 'earlier',
      },
      {
        lead: 'Manufacturers',
        note: 'The analysis shows where documentation is reported inconsistently, and what must be stated more precisely for products to be compared on equal terms.',
        icon: 'declaration',
      },
      {
        lead: 'Programme operators',
        note: 'Coverage and categorisation consistency across the corpus are quantified, showing where reporting requirements would benefit from harmonisation.',
        icon: 'coverage',
      },
      {
        lead: 'Regulators',
        note: 'Verification at the product specification level can be automated, and its reliability is set by the scope of mandatory disclosure.',
        icon: 'threshold',
      },
    ],
  },
];

/**
 * The third band, laid out as a matrix: three limitations across, with a
 * limitation row and a future-work row below. Regulatory scope is left for Q&A.
 */
export const STANDING_LIMITS = {
  label: 'Limitations and future work',
  /** Row labels shown in the gutter. */
  rows: { limit: 'Limitation', next: 'Future work' },
  items: [
    {
      lead: 'EPDs as the evidence base',
      limit:
        'For some construction products an EPD does not carry the whole picture, and the rest of the evidence sits in separate documents.',
      next: 'Associating the documents that describe one product, and adapting the pipeline once the digital product passport carries them together.',
    },
    {
      lead: 'Concrete as the case study',
      limit:
        'The pipeline was exercised on concrete, chosen for the relevance of the product and for the maturity of its declarations.',
      next: 'Extension to other construction products, where performance indicators differ, to establish whether transfer learning is sufficient or deeper adaptation is warranted.',
    },
    {
      lead: 'Attributes covered by inference',
      limit: 'Inference was demonstrated for end-of-life attributes and for global warming potential.',
      next: 'Extension to technical performance and cost, which vary with application context and with market conditions.',
    },
  ],
} as const;

/* ---- The conclusions ---------------------------------------------------------------- */

/**
 * The last frame of the talk: four findings side by side, each with its
 * evidence. Panels keep a fixed position for the whole scene and each beat opens
 * one in place. The fifth conclusion sums up the other four, so it is the
 * `line` under the heading.
 */
export const CONCLUSIONS = {
  eyebrow: 'Conclusions',
  heading: 'Conclusions',
  line: 'The five contributions function as one traceable architecture.',
} as const;

export interface ConclusionPanel {
  readonly key: 'comparison' | 'sequence' | 'evidence' | 'context';
  readonly index: string;
  /** The claim. */
  readonly lead: string;
  /** The supporting evidence, also shown by the panel's drawing. */
  readonly note: string;
}

export const CONCLUSION_PANELS: readonly ConclusionPanel[] = [
  {
    key: 'comparison',
    index: '01',
    lead: 'Relative comparison is the evaluation logic early design can sustain.',
    note: 'Absolute quantification needs complete product data that arrives only once design is settled. The ordering across alternatives holds where the values cannot.',
  },
  {
    key: 'sequence',
    index: '02',
    lead: 'Feasibility and preference are distinct operations, resolved in sequence.',
    note: 'Screening establishes which products are admissible under the governing constraints. Preference is evaluated only over what passes.',
  },
  {
    key: 'evidence',
    index: '03',
    lead: 'Incomplete evidence is characterised, and then carried forward.',
    note: 'The extent and distribution of unreported information were measured across the corpus. Inference recovers part of it, and what stays uncertain remains visible.',
  },
  {
    key: 'context',
    index: '04',
    lead: 'Preference is relational, and conditioned on the context of the decision.',
    note: 'The same candidate set ranks differently under different applications and priorities, and the model adapts without anyone quantifying weights in advance.',
  },
];
