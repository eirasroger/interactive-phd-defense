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
 * What the work contributes, what it is for, and where it stops.
 *
 * Three zones on one frame, because the three are read against each other: a
 * contribution with no stated limit is a claim, and a limit with no stated
 * contribution is an apology. The pair above are what the work adds and what it
 * is good for; the one across the foot is said about both of them.
 *
 * **Placeholder.** Every line below is structure, not content. Nothing here is a
 * finding and none of it should be defended until the presenter has written it:
 * a line on this frame is a claim about the work, and an invented one reads as a
 * result.
 */
export const STANDING = {
  eyebrow: 'Act III · Closing',
  heading: 'Contribution, implications, and where the work stops',
  line: 'What the thesis adds, what it is good for, and what it does not settle.',
} as const;

export interface StandingZone {
  readonly key: 'knowledge' | 'practice';
  readonly label: string;
  readonly rows: readonly string[];
}

export const STANDING_ZONES: readonly StandingZone[] = [
  {
    key: 'knowledge',
    label: 'Contribution to knowledge',
    rows: [
      'Placeholder. The first thing established that was not established before.',
      'Placeholder. The second.',
      'Placeholder. The third.',
    ],
  },
  {
    key: 'practice',
    label: 'Practical implications',
    rows: [
      'Placeholder. Who can act on this, and on which decision.',
      'Placeholder. What it changes about how that decision is made.',
      'Placeholder. What adoption asks for.',
    ],
  },
];

/**
 * The foot of the frame, as short entries rather than a list.
 *
 * A limitation set as a bullet reads as a concession; set as an entry with a
 * lead and a line under it, it reads as a boundary the work knows it has. Four
 * across, on the measure of both zones above.
 */
export const STANDING_LIMITS = {
  label: 'Limitations and future work',
  items: [
    { lead: 'Placeholder', note: 'What the evidence does not cover.' },
    { lead: 'Placeholder', note: 'What the method assumes.' },
    { lead: 'Placeholder', note: 'Where the results may not carry.' },
    { lead: 'Placeholder', note: 'The next question this opens.' },
  ],
} as const;
