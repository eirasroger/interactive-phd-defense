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
