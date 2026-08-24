import type { CaptionContent } from '@/components/Caption';

/**
 * Act III copy.
 *
 * The heading is `narrative.md`'s claim column verbatim, as everywhere else.
 * The station labels are the roles the papers were introduced under in Act I
 * and walked through in Act II — the plan view names them again because from
 * sixty metres up a room is a rectangle, and the whole beat is recognition.
 */
export const act3Captions = {
  whole: {
    eyebrow: 'Act III · The Overlook',
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


/* ---- Cross-cutting theme 1 — artificial intelligence ------------------------- */

/**
 * One vertebra of the backbone: what the pipeline asks for here, which family of
 * model answers, and the condition that makes the ask different from the one
 * beside it.
 *
 * This is a discussion slide, so it carries no quantity, no result and no
 * contribution. Those were all made once already, at the station that owns them,
 * and a second telling in Act III would be the talk repeating itself with fewer
 * minutes left. What is left is the only thing the connection between the
 * stations adds: one body of methods runs the length of the pipeline and takes a
 * different form at each of them, because each of them needs a different thing.
 *
 * **The family is named, because the committee will ask.** Reading the four in
 * order is the answer: a language model, then a language model driven as an
 * agent with a person in it, then supervised deep learning, then supervised deep
 * learning whose labels a language model produced. The two families and the way
 * they combine are the shape of the argument, so they are set as text rather
 * than encoded in the drawing.
 */
export interface BackboneNode {
  readonly key: 'extract' | 'screen' | 'estimate' | 'recommend';
  /** What is asked. One word. */
  readonly verb: string;
  /** Which family of model answers. */
  readonly family: string;
  /** Why the ask is different here. Never a number. */
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

/**
 * Cross-cutting theme 1, and the whole of it.
 *
 * One beat, half a minute, one idea: the backbone runs the length of the
 * pipeline and it is a different bone at every joint.
 */
export const BACKBONE = {
  eyebrow: 'Act III · Cross-cutting',
  heading: 'Artificial intelligence as the methodological backbone',
  line: 'A different method at each stage, decided by what the stage needs.',
} as const;

/* ---- Cross-cutting theme 2 — the conditions the architecture is designed around ---- */

/**
 * Cross-cutting theme 2, and why two sections share one slide.
 *
 * Missing evidence and context sensitivity are the same kind of claim: neither
 * belongs to a stage, both were taken as properties of the problem, and the
 * architecture answers each of them the whole way down. Argued apart they are
 * two more slides about the pipeline; argued together they are one statement
 * about how it was designed.
 */
export const CONDITIONS = {
  eyebrow: 'Act III · Cross-cutting',
  heading: 'Missing data and context as structural conditions',
  line: 'Both run the length of the pipeline, and both are answered at every stage.',
} as const;

/**
 * The two cards.
 *
 * Both are a claim, then the three things that make it true. They are shaped
 * alike because they are the same kind of statement, and the difference between
 * them is carried by the drawing rather than by the layout.
 *
 * Plain sentences. Every line here is a decision the committee can put a
 * question to, and a sentence they have to decode gets asked about for the wrong
 * reason. No quantity, no method name, no per-contribution detail: all three
 * were made once already at the station that owns them.
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
 * The closing frame, titled as the thesis titles the chapter behind it.
 *
 * Three bands on one surface, one per beat, and the title does not change
 * between them. What the work establishes, what it is good for, and where it
 * stops are read against each other: a contribution with no stated limit is a
 * claim, and a limit with no stated contribution is an apology. The frame is
 * composed whole from the first beat and each beat lights one band of it, so
 * the presenter is filling a composition rather than assembling one.
 */
export const STANDING = {
  eyebrow: 'Act III · Closing',
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
  /** The name this claim gets when it comes back as a question. */
  readonly lead: string;
  /** One sentence, cut to the column it is set in. */
  readonly note: string;
  readonly icon: StandingIcon;
}

export interface StandingBand {
  readonly key: 'knowledge' | 'practice';
  readonly label: string;
  readonly rows: readonly StandingRow[];
}

/**
 * The first two bands.
 *
 * Theoretical contributions carries three claims and no more. An earlier pass
 * had five, two of which were methodological sequencing rather than knowledge,
 * and one of which restated the first in different words. A theoretical
 * contribution is a claim about the problem class; how the pipeline is ordered
 * internally is a method, and it is argued at the station that owns it.
 *
 * Practical implications is ordered by distance from the decision. Design and
 * procurement act on the recommendation; the three after them act on the
 * evidence it runs on.
 *
 * Every note is cut to three lines on the column it is set in. A band is read
 * across in one glance and then talked over, and a fourth line in one column of
 * four is the thing that breaks the row.
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
 * The third band, read as a matrix rather than as a list.
 *
 * Three boundaries across, and two named rows down: what the work does not
 * cover, and the research that covers it. An earlier pass ran the two sentences
 * one under the other inside a single entry and left the reader to work out
 * which was which from the colour alone, which is a legend nobody was given.
 * Naming the two rows in the gutter costs two words and removes the question.
 *
 * Three columns. Regulatory scope is a real boundary and a minor one, and
 * giving it a quarter of the closing frame would rank it with the evidence base
 * and the case study. It is a spoken answer if the question comes.
 */
export const STANDING_LIMITS = {
  label: 'Limitations and future work',
  /** The two rows, named in the gutter. */
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
