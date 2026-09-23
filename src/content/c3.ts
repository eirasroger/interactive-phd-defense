/**
 * C3 screening agent data, plus the paper's rule engine run over Table 1's six EPDs.
 * `reconcile` and `evaluate` implement §2.4. `assertPublished` checks the results
 * against Tables 2-5 at load time.
 *
 * Regulation-only baselines come from scenarios where the user gave no value for
 * that indicator. The XC2 0.60 w/c ceiling comes from EN 206 itself; it changes
 * no published outcome.
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
  /** Axis range. Holds every bound and declared value with margin on both sides. */
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

/** Short labels for narrow columns. */
export const SHORT_LABEL: Readonly<Record<RequirementKey, string>> = {
  w_c_ratio: 'w/c',
  cement_content: 'Cement',
  strength: 'Strength',
  aggregate_size: 'Aggregate',
};

const bound = (kind: BoundKind, value: number, source: Source): Bound => ({ kind, value, source });

/**
 * §2.4 strictest-bound rule: the largest minimum, or the smallest maximum.
 * A single source governs on its own.
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

/** Authority order. A later source can only tighten a bound. */
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

/** Table 1, verbatim. EPD 4's aggregate size is "Not provided" in the paper. */
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
 * A declared value formatted for display. An undeclared value prints as a dash
 * with its unit, so it is never mistaken for zero.
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
 * An undeclared value cannot be verified, so `missing` counts as a fail.
 * The paper fails EPD 4 this way wherever aggregate size is governed.
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
 * Stages from portfolio to recommendation (Section 1). Decision tools assume
 * non-compliant products were already excluded by hand; screening does that step.
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
    key: 'recommendation',
    label: 'Recommendation',
    note: 'Preference is applied to a set that is already valid',
  },
] as const;

export interface Approach {
  readonly key: 'manual' | 'automated';
  readonly label: string;
  readonly description: string;
  readonly limitation: string;
}

/** The two established workflows and their limits. Sections 1 and 5.1. */
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

/** The proposed middle ground. Section 2.4. */
export const ARCHITECTURE = {
  label: 'Human-in-the-loop screening',
  parts: [
    { key: 'extract', agent: 'Language model', act: 'Extracts and normalises declared attributes' },
    { key: 'verify', agent: 'Operator', act: 'Validates every extracted value against its source' },
    { key: 'decide', agent: 'Rule engine', act: 'Executes the formalised clauses deterministically' },
  ],
} as const;

/**
 * Fig. 1's four inputs, described generically (no specific standard).
 * `source` sets the card colour and matches the reconciliation sources.
 * `path: 'direct'` marks the schema, which is digitised by hand and skips the model (§2.1).
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

/** Extraction output, grouped as in Fig. 1: requirements, and the products checked against them. */
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

/** Section 2.4: the only step where a human intervenes. */
export const CHECKPOINT = {
  label: 'Operator verification',
  detail: 'Every extracted value is checked against its source before a rule executes',
} as const;

export const ENGINE = {
  label: 'Performance screening engine',
  detail: 'One indicator at a time, against the strictest bound the sources agree on',
} as const;

/** Fig. 1's two end states and the compliance branch leading to each. */
export const OUTCOMES = [
  { key: 'considered', label: 'Product considered', branch: 'Yes' },
  { key: 'discarded', label: 'Product discarded', branch: 'No' },
] as const;

/**
 * EN 206, exposure class XC2. Cement and strength are the paper's scenario 1
 * constraints. The 0.60 w/c ceiling is the standard's own limit.
 */
export const EN206_XC2: BoundSet = {
  w_c_ratio: bound('max', 0.6, 'regulation'),
  cement_content: bound('min', 280, 'regulation'),
  strength: bound('min', 25, 'regulation'),
};

/**
 * Scenario 1, EN 206, no drawing (Table 2). The engine keeps the regulatory
 * cement floor and adopts the user's tighter w/c ceiling.
 */
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

/** EN 206, exposure class XC1. Regulatory baseline from Table 2, scenario 2. */
export const EN206_XC1: BoundSet = {
  w_c_ratio: bound('max', 0.65, 'regulation'),
  cement_content: bound('min', 260, 'regulation'),
  strength: bound('min', 20, 'regulation'),
};

/** AS 3600, exposure class A2. Regulatory baseline from Table 3, scenario 2. */
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
  /** Exposure class for "indoor application" under this jurisdiction. */
  readonly exposureClass: string;
  readonly drawing: boolean;
  readonly sources: SourceBounds;
  /** Change from the previous condition. */
  readonly change: string;
}

/**
 * Scenario 2 under three conditions. It is the only Table 5 case where both the
 * jurisdiction switch and the added drawing each flip a different product's verdict.
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

/** Scenario 2 without and with the drawing. Table 5, case 2, columns (a) and (c). */
export const DEMONSTRATION: readonly Condition[] = CONDITIONS.filter(
  (condition) => condition.jurisdiction === 'EN 206',
);

export interface Handover {
  readonly key: string;
  readonly label: string;
  readonly body: string;
}

/** The station's outputs. */
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
