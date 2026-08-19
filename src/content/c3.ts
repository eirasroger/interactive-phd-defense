/**
 * C3 — screening agent. Data of record.
 *
 * The engine below is not a description of the paper's rule engine. It is the
 * rule engine: `reconcile` implements §2.4's strictest-bound rule and
 * `evaluate` implements its pass/fail comparison, run over Table 1's six EPDs.
 * `assertPublished` checks the output against Table 2, Table 3, Table 4 and the
 * case-2 column of Table 5 at load time.
 *
 * Every regulation-only baseline here (EN 206 §XC1: 0.65 / 260 / 20, EN 206
 * §XC2: 280 / 25, AS 3600 §A2: 320 / 25) is read off a scenario where the paper
 * states the user supplied nothing for that indicator, so the published
 * "screening constraint" for it is the regulation's own value with nothing to
 * reconcile against.
 *
 * One value comes from the standard rather than the paper. EN 206 caps the
 * water-to-cement ratio at 0.60 for exposure class XC2, and scenario 1's
 * operator proposes 0.53. The paper prints only the resolved constraint, so
 * without the standard's own ceiling the reconciliation has a contest in one
 * direction and a walkover in the other. It is marked `EN206_XC2` and it
 * changes no published outcome: 0.53 governs either way.
 */

export type BoundKind = 'min' | 'max';
export type Source = 'regulation' | 'drawing' | 'user';

export interface Bound {
  readonly kind: BoundKind;
  readonly value: number;
  readonly source: Source;
}

export type RequirementKey = 'w_c_ratio' | 'cement_content' | 'strength' | 'aggregate_size';

export interface Requirement {
  readonly key: RequirementKey;
  readonly label: string;
  readonly unit: string;
  readonly kind: BoundKind;
  /**
   * The span an axis draws this indicator over. Chosen to hold every bound and
   * every declared value in the case study with room either side, so a mark
   * never lands on the end of its own scale.
   */
  readonly domain: readonly [number, number];
}

export const REQUIREMENTS: readonly Requirement[] = [
  { key: 'w_c_ratio', label: 'Water-to-cement ratio', unit: '', kind: 'max', domain: [0.4, 0.7] },
  {
    key: 'cement_content',
    label: 'Cement content',
    unit: 'kg/m³',
    kind: 'min',
    domain: [150, 450],
  },
  { key: 'strength', label: 'Characteristic strength', unit: 'MPa', kind: 'min', domain: [0, 50] },
  {
    key: 'aggregate_size',
    label: 'Maximum aggregate size',
    unit: 'mm',
    kind: 'max',
    domain: [10, 32],
  },
] as const;

/** Column-width names, for anywhere the full label will not fit. */
export const SHORT_LABEL: Readonly<Record<RequirementKey, string>> = {
  w_c_ratio: 'w/c',
  cement_content: 'Cement',
  strength: 'Strength',
  aggregate_size: 'Aggregate',
};

const bound = (kind: BoundKind, value: number, source: Source): Bound => ({ kind, value, source });

/**
 * §2.4's strictest-bound rule: the maximum of the minimums, the minimum of the
 * maximums. Where only one source speaks to an indicator, that source governs
 * on its own.
 */
export function reconcile(
  kind: BoundKind,
  bounds: readonly (Bound | undefined)[],
): Bound | undefined {
  const present = bounds.filter((entry): entry is Bound => entry !== undefined);
  if (present.length === 0) return undefined;
  return kind === 'min'
    ? present.reduce((strictest, entry) => (entry.value > strictest.value ? entry : strictest))
    : present.reduce((strictest, entry) => (entry.value < strictest.value ? entry : strictest));
}

export type BoundSet = Partial<Record<RequirementKey, Bound>>;

export interface SourceBounds {
  readonly regulation?: BoundSet;
  readonly drawing?: BoundSet;
  readonly user?: BoundSet;
}

export function governingFrom(sources: SourceBounds): BoundSet {
  const governing: { -readonly [K in RequirementKey]?: Bound } = {};
  for (const requirement of REQUIREMENTS) {
    const resolved = reconcile(requirement.kind, [
      sources.regulation?.[requirement.key],
      sources.drawing?.[requirement.key],
      sources.user?.[requirement.key],
    ]);
    if (resolved) governing[requirement.key] = resolved;
  }
  return governing;
}

/** Authority order. A later source may tighten a bound; it cannot loosen it. */
export const AUTHORITY: readonly Source[] = ['regulation', 'drawing', 'user'];

export const AUTHORITY_LABEL: Readonly<Record<Source, string>> = {
  regulation: 'Regulation',
  drawing: 'Drawing',
  user: 'Operator',
};

export interface Epd {
  readonly key: string;
  readonly label: string;
  readonly library: 'international' | 'australasia';
  readonly density: number;
  readonly wc: number;
  readonly cementContent: number;
  readonly strength: number;
  readonly aggregateSize: number | null;
}

/** Table 1, verbatim. EPD 4's aggregate size is the paper's own "Not provided". */
export const EPDS: readonly Epd[] = [
  {
    key: 'epd-1',
    label: 'EPD 1',
    library: 'international',
    density: 2400,
    wc: 0.53,
    cementContent: 321.6,
    strength: 30,
    aggregateSize: 20,
  },
  {
    key: 'epd-2',
    label: 'EPD 2',
    library: 'international',
    density: 2420,
    wc: 0.5,
    cementContent: 338,
    strength: 30,
    aggregateSize: 16,
  },
  {
    key: 'epd-3',
    label: 'EPD 3',
    library: 'international',
    density: 2419,
    wc: 0.46,
    cementContent: 362,
    strength: 35,
    aggregateSize: 20,
  },
  {
    key: 'epd-4',
    label: 'EPD 4',
    library: 'australasia',
    density: 2350,
    wc: 0.57,
    cementContent: 329,
    strength: 32,
    aggregateSize: null,
  },
  {
    key: 'epd-5',
    label: 'EPD 5',
    library: 'australasia',
    density: 2394,
    wc: 0.57,
    cementContent: 418,
    strength: 45,
    aggregateSize: 19,
  },
  {
    key: 'epd-6',
    label: 'EPD 6',
    library: 'australasia',
    density: 2400,
    wc: 0.54,
    cementContent: 312,
    strength: 25,
    aggregateSize: 19,
  },
] as const;

/**
 * A declared value as it is printed, wherever a product is drawn.
 *
 * The precision is the product's, not the constraint's: an undeclared indicator
 * keeps its unit and loses its number, because "no aggregate size" and
 * "aggregate size zero" are different claims and only one of them is true.
 */
export const readingOf = (epd: Epd, key: RequirementKey): string => {
  switch (key) {
    case 'w_c_ratio':
      return `${epd.wc.toFixed(2)} w/c`;
    case 'cement_content':
      return `${Math.round(epd.cementContent)} kg/m³`;
    case 'strength':
      return `${epd.strength} MPa`;
    case 'aggregate_size':
      return epd.aggregateSize === null ? '— mm' : `${epd.aggregateSize} mm`;
  }
};

export type Status = 'pass' | 'fail' | 'missing';

export interface Check {
  readonly requirement: Requirement;
  readonly bound: Bound;
  readonly status: Status;
  readonly value: number | null;
}

export interface Verdict {
  readonly epd: Epd;
  readonly checks: readonly Check[];
  readonly pass: boolean;
}

const READ: Readonly<Record<RequirementKey, (epd: Epd) => number | null>> = {
  w_c_ratio: (epd) => epd.wc,
  cement_content: (epd) => epd.cementContent,
  strength: (epd) => epd.strength,
  aggregate_size: (epd) => epd.aggregateSize,
};

/**
 * A product with no declared value for a governed indicator cannot be
 * verified against it. The paper's own scenarios fail EPD 4 for exactly this
 * reason wherever aggregate size is governed, so `missing` counts as `fail`.
 */
function check(requirement: Requirement, governing: Bound, epd: Epd): Check {
  const value = READ[requirement.key](epd);
  if (value === null) return { requirement, bound: governing, status: 'missing', value };
  const status: Status =
    requirement.kind === 'min'
      ? value >= governing.value
        ? 'pass'
        : 'fail'
      : value <= governing.value
        ? 'pass'
        : 'fail';
  return { requirement, bound: governing, status, value };
}

export function evaluate(epd: Epd, governing: BoundSet): Verdict {
  const checks = REQUIREMENTS.map((requirement) => {
    const source = governing[requirement.key];
    return source ? check(requirement, source, epd) : null;
  }).filter((entry): entry is Check => entry !== null);

  return { epd, checks, pass: checks.every((entry) => entry.status === 'pass') };
}

/**
 * Why a screening stage exists ahead of ranking.
 *
 * Section 1: decision and optimisation tools assume the designer has already
 * excluded non-compliant products by hand. Where that exclusion has not
 * happened, a ranking is well-formed and inadmissible.
 */
export const FUNNEL = [
  {
    key: 'portfolio',
    label: 'Supplier portfolio',
    note: 'Hundreds of candidate mixes, each declared in its own document',
  },
  {
    key: 'screening',
    label: 'Regulatory screening',
    note: 'Deterministic pass or fail against the governing constraint',
  },
  {
    key: 'candidates',
    label: 'Admissible candidates',
    note: 'Every survivor satisfies every applicable clause',
  },
  {
    key: 'ranking',
    label: 'Ranking',
    note: 'Preference is applied to a set that is already valid',
  },
] as const;

export interface Approach {
  readonly key: 'manual' | 'automated';
  readonly label: string;
  readonly description: string;
  readonly limitation: string;
}

/** The two established workflows, and what each one costs. Sections 1 and 5.1. */
export const APPROACHES: readonly Approach[] = [
  {
    key: 'manual',
    label: 'Manual review',
    description:
      'Each product is cross-checked against each applicable clause, across documents that share no common format.',
    limitation: 'Time-consuming and error-prone at portfolio scale',
  },
  {
    key: 'automated',
    label: 'Full automation',
    description:
      'A general-purpose model receives the documents and returns the compliance verdict directly.',
    limitation: 'Hallucination and opacity leave the verdict unaccountable',
  },
] as const;

/** What the architecture puts between them. Section 2.4. */
export const ARCHITECTURE = {
  label: 'Human-in-the-loop screening',
  parts: [
    { key: 'extract', agent: 'Language model', act: 'Extracts and normalises declared attributes' },
    { key: 'verify', agent: 'Operator', act: 'Validates every extracted value against its source' },
    { key: 'decide', agent: 'Rule engine', act: 'Executes the formalised clauses deterministically' },
  ],
} as const;

/**
 * Fig. 1's inputs, in the four shapes they arrive in.
 *
 * Described as the tool takes them rather than as the case study supplies them:
 * the engine is indifferent to which standard is loaded, and naming EN 206 here
 * would make a general workflow look like a concrete one.
 *
 * `source` is the authority the input carries, and it is what colours the card.
 * Three of the four are the same three sources the reconciliation rule ranks, so
 * the palette introduced here is the palette read for the rest of the station.
 * `path` marks the one input no model touches: a regulatory schema is digitised
 * by hand into key-value pairs precisely so it cannot be misread (§2.1).
 */
export const DOCUMENTS = [
  {
    key: 'schema',
    label: 'Regulatory schema',
    detail: 'The governing standard, selected from a closed list',
    glyph: 'schema',
    source: 'regulation',
    path: 'direct',
  },
  {
    key: 'custom',
    label: 'Custom information',
    detail: 'Project scenario and operator constraints, free text',
    glyph: 'text',
    source: 'user',
    path: 'extracted',
  },
  {
    key: 'epd',
    label: 'Product declarations',
    detail: 'One document per candidate product',
    glyph: 'stack',
    source: 'epd',
    path: 'extracted',
  },
  {
    key: 'drawing',
    label: 'Drawings and specifications',
    detail: 'Project documentation, optional',
    glyph: 'drawing',
    source: 'drawing',
    path: 'extracted',
  },
] as const;

/**
 * What the extraction returns. Fig. 1 groups it into exactly these two, and the
 * grouping matters: one bundle sets the requirement, the other is measured
 * against it.
 */
export const RECORDS = [
  {
    key: 'requirements',
    label: 'Project requirements',
    fields: ['Exposure class', 'Element type', 'Declared constraints'],
  },
  {
    key: 'products',
    label: 'Product records',
    fields: ['Material composition', 'Water-to-cement ratio', 'Characteristic strength'],
  },
] as const;

/** Section 2.4: the interaction layer, and the only place a human intervenes. */
export const CHECKPOINT = {
  label: 'Operator verification',
  detail: 'Every extracted value is checked against its source before a rule executes',
} as const;

export const ENGINE = {
  label: 'Performance screening engine',
  detail: 'One indicator at a time, against the strictest bound the sources agree on',
} as const;

/** Fig. 1's two terminals, and the branch of the compliance check that reaches each. */
export const OUTCOMES = [
  { key: 'considered', label: 'Product considered', branch: 'Yes' },
  { key: 'discarded', label: 'Product discarded', branch: 'No' },
] as const;

/**
 * Scenario 1, EN 206, no drawing (Table 2). The user proposes a cement
 * minimum below the regulatory floor and a water-to-cement maximum below the
 * regulatory ceiling. The engine keeps the regulatory floor and adopts the
 * user's tighter ceiling.
 */
/**
 * EN 206, exposure class XC2. The cement floor and the strength class are the
 * paper's published screening constraints for scenario 1; the 0.60 ceiling is
 * the standard's own limiting value, and it is here so the reconciliation has
 * something for the operator's 0.53 to actually beat.
 */
export const EN206_XC2: BoundSet = {
  w_c_ratio: bound('max', 0.6, 'regulation'),
  cement_content: bound('min', 280, 'regulation'),
  strength: bound('min', 25, 'regulation'),
};

export const HIERARCHY_CASE = {
  input:
    'This concrete is specified for a structural foundation. The mix design must adhere to a maximum water-to-cement ratio of 0.53 and a minimum cement content of 200 kg/m³.',
  jurisdiction: 'EN 206',
  exposureClass: 'XC2',
  sources: {
    regulation: EN206_XC2,
    user: {
      cement_content: bound('min', 200, 'user'),
      w_c_ratio: bound('max', 0.53, 'user'),
    },
  } satisfies SourceBounds,
} as const;

export const HIERARCHY_GOVERNING = governingFrom(HIERARCHY_CASE.sources);

/** EN 206, exposure class XC1. Table 2's scenario 2 asks the user for nothing but aggregate size, so its screening constraints are the regulatory baseline on its own. */
export const EN206_XC1: BoundSet = {
  w_c_ratio: bound('max', 0.65, 'regulation'),
  cement_content: bound('min', 260, 'regulation'),
  strength: bound('min', 20, 'regulation'),
};

/** AS 3600, exposure class A2. Table 3's scenario 2, read the same way. */
export const AS3600_A2: BoundSet = {
  cement_content: bound('min', 320, 'regulation'),
  strength: bound('min', 25, 'regulation'),
};

const SCENARIO_2_USER: BoundSet = {
  aggregate_size: bound('max', 25, 'user'),
};

/** Table 4's drawing extraction for scenario 2. */
const SCENARIO_2_DRAWING: BoundSet = {
  w_c_ratio: bound('max', 0.55, 'drawing'),
  cement_content: bound('min', 325, 'drawing'),
  strength: bound('min', 25, 'drawing'),
  aggregate_size: bound('max', 20, 'drawing'),
};

export interface Condition {
  readonly key: string;
  readonly label: string;
  readonly jurisdiction: 'EN 206' | 'AS 3600';
  /** What the same "indoor application" description resolves to under it. */
  readonly exposureClass: string;
  readonly drawing: boolean;
  readonly sources: SourceBounds;
  /** What changed relative to the condition before it. */
  readonly change: string;
}

/**
 * Scenario 2 ("indoor application, 25 mm max aggregate") across three
 * conditions. Chosen over scenarios 1 and 3 because it is the one case in
 * Table 5 where both the jurisdiction switch and the drawing addition each
 * flip a product's verdict, on two different products.
 */
export const CONDITIONS: readonly Condition[] = [
  {
    key: 'en206',
    label: 'EN 206',
    jurisdiction: 'EN 206',
    exposureClass: 'XC1',
    drawing: false,
    sources: { regulation: EN206_XC1, user: SCENARIO_2_USER },
    change: 'Regulatory schema and one operator constraint',
  },
  {
    key: 'as3600',
    label: 'AS 3600',
    jurisdiction: 'AS 3600',
    exposureClass: 'A2',
    drawing: false,
    sources: { regulation: AS3600_A2, user: SCENARIO_2_USER },
    change: 'Jurisdiction switched, everything else held',
  },
  {
    key: 'en206-drawing',
    label: 'EN 206, with drawing',
    jurisdiction: 'EN 206',
    exposureClass: 'XC1',
    drawing: true,
    sources: { regulation: EN206_XC1, drawing: SCENARIO_2_DRAWING, user: SCENARIO_2_USER },
    change: 'Structural drawing added to the same EN 206 scenario',
  },
] as const;

export const SCENARIO_INPUT =
  'This concrete is specified for an indoor application. The mix design requires a maximum aggregate size of 25 mm.';

/**
 * Scenario 2 as two demonstrations: the operator's description on its own, then
 * the same six products once the structural drawing has been read. Table 5's
 * case-2 column, columns (a) and (c).
 */
export const DEMONSTRATION: readonly Condition[] = CONDITIONS.filter(
  (condition) => condition.jurisdiction === 'EN 206',
);

export interface Handover {
  readonly key: string;
  readonly label: string;
  readonly body: string;
}

/** What the station produces, and what each output is for. */
export const HANDOVER: readonly Handover[] = [
  {
    key: 'candidates',
    label: 'Candidate set',
    body: 'Every product carried forward satisfies every clause applicable to the declared scenario.',
  },
  {
    key: 'log',
    label: 'Decision log',
    body: 'Every check records the constraint, the source that set it, and the outcome.',
  },
  {
    key: 'ruleset',
    label: 'Rule set',
    body: 'A jurisdiction is a structured file of thresholds. Encoding another leaves the workflow unchanged.',
  },
];

export function verdictsFor(condition: Condition): readonly Verdict[] {
  const governing = governingFrom(condition.sources);
  return EPDS.map((epd) => evaluate(epd, governing));
}

function assertPublished(): void {
  const expected: Readonly<Record<string, readonly boolean[]>> = {
    en206: [true, true, true, false, true, true],
    as3600: [true, true, true, false, true, false],
    'en206-drawing': [false, true, true, false, false, false],
  };

  for (const condition of CONDITIONS) {
    const want = expected[condition.key];
    if (!want) throw new Error(`C3: no published verdict on file for "${condition.key}".`);
    const got = verdictsFor(condition).map((verdict) => verdict.pass);
    if (got.some((value, index) => value !== want[index])) {
      throw new Error(
        `C3: ${condition.key} computes [${got.join(', ')}], and Table 5's case 2 column ` +
          `publishes [${want.join(', ')}].`,
      );
    }
  }

  const wantGoverning: BoundSet = {
    w_c_ratio: bound('max', 0.53, 'user'),
    cement_content: bound('min', 280, 'regulation'),
    strength: bound('min', 25, 'regulation'),
  };
  for (const requirement of REQUIREMENTS) {
    const want = wantGoverning[requirement.key];
    if (!want) continue;
    const got = HIERARCHY_GOVERNING[requirement.key];
    if (!got || got.value !== want.value || got.source !== want.source) {
      throw new Error(
        `C3: the governing ${requirement.key} computes ` +
          `${got ? `${got.value} from ${got.source}` : 'nothing'}, and Table 2's scenario 1 ` +
          `publishes ${want.value} from ${want.source}.`,
      );
    }
  }
}

assertPublished();
