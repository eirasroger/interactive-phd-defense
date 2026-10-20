import type { CaptionContent } from '@/components/Caption';

/**
 * Act III copy. The heading is the claim column from `narrative.md`. Station
 * labels repeat the paper roles from Acts I and II so the plan view names each room.
 */
export const act3Captions = {
  whole: {
    eyebrow: 'Integrated pipeline',
    heading: 'The five contributions form one integrated pipeline.',
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
    need: 'Documents into records',
  },
  {
    key: 'screen',
    verb: 'Screen',
    family: 'LLM agent, human in the loop',
    need: 'Decisions with consequences',
  },
  {
    key: 'estimate',
    verb: 'Estimate',
    family: 'Deep learning',
    need: 'Missing evidence',
  },
  {
    key: 'recommend',
    verb: 'Recommend',
    family: 'Deep learning, labels from an LLM',
    need: 'No ground truth for preference',
  },
];

/** Cross-cutting theme 1. One beat of about 30 seconds. */
export const BACKBONE = {
  eyebrow: 'Cross-cutting themes',
  heading: 'Artificial intelligence across the pipeline',
  line: 'A different method at each stage.',
} as const;

/* ---- Cross-cutting theme 2: conditions the architecture is designed around ---- */

/**
 * Cross-cutting theme 2. Missing evidence and context sensitivity share one
 * slide because both are properties of the problem that span every stage.
 */
export const CONDITIONS = {
  eyebrow: 'Cross-cutting themes',
  heading: 'Missing data and context',
  line: 'Both are handled at every stage.',
} as const;

/**
 * The two cards: a claim, then three supporting steps each. Plain sentences
 * with no numbers, method names or per-contribution detail.
 */
export const CARDS = {
  evidence: {
    heading: 'Missing data',
    lead: 'The pipeline works with incomplete information.',
    steps: [
      'Early design is when decisions matter most and data is thinnest.',
      'Inference recovers part of the missing data.',
      'The recommender accepts missing values.',
    ],
  },
  context: {
    heading: 'Context',
    lead: 'Context sets which indicators matter, and how much.',
    steps: [
      'Screening sets which products are admissible.',
      'Application and priorities set the indicator weights.',
      'The recommendation fits the project at hand.',
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
        lead: 'Relative comparison for early design',
        note: 'Comparing candidates is valid before absolute values are available.',
        icon: 'comparison',
      },
      {
        lead: 'Context inside the recommendation',
        note: 'The ranking depends on application and priorities.',
        icon: 'context',
      },
      {
        lead: 'Evaluation with incomplete evidence',
        note: 'Products are ranked without complete declarations.',
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
        note: 'A tool for sustainable and circular selection when the decision is made.',
        icon: 'earlier',
      },
      {
        lead: 'Manufacturers',
        note: 'Shows where declarations are inconsistent or incomplete.',
        icon: 'declaration',
      },
      {
        lead: 'Programme operators',
        note: 'Quantifies where reporting should be harmonised.',
        icon: 'coverage',
      },
      {
        lead: 'Regulators',
        note: 'Product-level compliance checks can be automated.',
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
      limit: 'Some product evidence sits outside the EPD.',
      next: 'Link the documents of each product, and adopt the digital product passport.',
    },
    {
      lead: 'Concrete as the case study',
      limit: 'The pipeline was tested on concrete.',
      next: 'Extend to other products and test transfer learning.',
    },
    {
      lead: 'Attributes covered by inference',
      limit: 'Inference covered end of life and global warming potential.',
      next: 'Extend to technical performance and cost.',
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
  line: 'The five contributions work as one traceable pipeline.',
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
    lead: 'Early design calls for relative comparison.',
    note: 'Absolute values arrive too late. The ranking between alternatives is available earlier.',
  },
  {
    key: 'sequence',
    index: '02',
    lead: 'Screening comes before preference.',
    note: 'Only admissible products are ranked.',
  },
  {
    key: 'evidence',
    index: '03',
    lead: 'Missing evidence is measured and carried forward.',
    note: 'Inference recovers part of it. What stays uncertain remains visible.',
  },
  {
    key: 'context',
    index: '04',
    lead: 'Preference depends on context.',
    note: 'The same candidates rank differently by application and priority, with no fixed weights.',
  },
];
