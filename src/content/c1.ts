/**
 * C1 — decision framework. Data of record.
 *
 * Every quantity is Table 5 of the paper, verbatim. Ordinal positions are the
 * scales declared in Tables 2 and 3. Two values are assumptions and are marked
 * as such: the plaster partition's undeclared circular fraction, and the
 * biogenic fractions read off the inventories rather than stated outright.
 *
 * `PROFILES` carries only the stakeholder cases whose published outcome the
 * model below reproduces exactly. Table 6's water (3x) and comfort (8x) cases
 * are deliberately absent.
 */

export type Family = 'circularity' | 'environmental' | 'economic' | 'performance';

export type Scale =
  | { readonly kind: 'ratio' }
  | { readonly kind: 'fraction' }
  | { readonly kind: 'ordinal'; readonly levels: number; readonly bestIsLow: boolean };

export interface Metric {
  readonly key: string;
  readonly label: string;
  readonly family: Family;
  readonly scale: Scale | null;
  readonly unit?: string;
  /** What the metric resolves into. Shown on the framework beat. */
  readonly parts?: readonly string[];
}

export const FAMILIES: readonly { readonly key: Family; readonly label: string }[] = [
  { key: 'circularity', label: 'Circularity' },
  { key: 'environmental', label: 'Environmental' },
  { key: 'economic', label: 'Economic' },
  { key: 'performance', label: 'Performance' },
];

export const METRICS: readonly Metric[] = [
  {
    key: 'C-1',
    label: 'Circular origin',
    family: 'circularity',
    scale: { kind: 'fraction' },
    unit: '0 to 100% circular',
  },
  {
    key: 'C-2',
    label: 'Disassembly potential',
    family: 'circularity',
    scale: { kind: 'ordinal', levels: 3, bestIsLow: true },
    parts: ['Easy', 'Difficult', 'Impossible'],
  },
  {
    key: 'C-3',
    label: 'End-of-life pathway',
    family: 'circularity',
    scale: { kind: 'ordinal', levels: 9, bestIsLow: true },
    parts: [
      'Reuse',
      'Reconditioning',
      'Recycling',
      'Composting',
      'Valorisation',
      'Incineration',
      'Inert landfill',
      'Hazardous waste',
      'Not recoverable',
    ],
  },
  {
    key: 'P-1',
    label: 'Material health',
    family: 'performance',
    scale: { kind: 'ordinal', levels: 7, bestIsLow: false },
    parts: ['No', 'Unknown', 'Basic', 'Bronze', 'Silver', 'Gold', 'Platinum'],
  },
  {
    key: 'P-2',
    label: 'Inventory of materials',
    family: 'performance',
    scale: null,
    parts: ['Composition by mass', 'Expected lifespan'],
  },
  {
    key: 'P-3',
    label: 'Nutrient type',
    family: 'performance',
    scale: { kind: 'fraction' },
    parts: ['Biogenic', 'Technical', 'Mixed'],
  },
  {
    key: 'S-1',
    label: 'Technical performance',
    family: 'performance',
    scale: null,
    unit: 'From the DoP, by product category',
    parts: ['Reaction to fire', 'Thermal', 'Acoustic', 'Slip resistance', 'etc.'],
  },
  {
    key: 'G-1',
    label: 'Embedded GHG',
    family: 'environmental',
    scale: { kind: 'ratio' },
    unit: 'kg CO₂e / declared unit',
    parts: ['A1 to A5', 'C1 to C4', 'D'],
  },
  {
    key: 'W-1',
    label: 'Water footprint',
    family: 'environmental',
    scale: { kind: 'ratio' },
    unit: 'm³ / declared unit',
    parts: ['A1 to A5', 'C1 to C4'],
  },
  {
    key: 'B-1',
    label: 'Biodiversity',
    family: 'environmental',
    scale: { kind: 'ratio' },
    unit: '0 to 1 score',
    parts: ['Climate change', 'Acidification', 'Abiotic depletion', 'Eutrophication'],
  },
  {
    key: 'L-1',
    label: 'Lifecycle cost',
    family: 'economic',
    scale: { kind: 'ratio' },
    unit: 'Currency / declared unit / lifespan',
    parts: ['Product', 'Construction', 'Maintenance', 'End of life'],
  },
];

export const SCORED: readonly Metric[] = METRICS.filter((metric) => metric.scale !== null);

export type Tier = 'primary' | 'secondary' | 'tertiary' | 'none';

export interface Candidate {
  readonly key: string;
  readonly label: string;
  readonly values: Readonly<Record<string, number | null>>;
  readonly readouts: Readonly<Record<string, string>>;
  readonly tiers: Readonly<Record<string, Tier>>;
  readonly gate: readonly string[];
}

export interface Scenario {
  readonly key: string;
  readonly label: string;
  readonly element: string;
  readonly area: string;
  readonly candidates: readonly Candidate[];
}

const TIMBER: Candidate = {
  key: 'timber',
  label: 'Timber partition',
  values: {
    'C-1': 0.84,
    'C-2': 0,
    'C-3': 0,
    'P-1': 2,
    'P-3': 0.84,
    'G-1': 4.9,
    'W-1': 10.8,
    'B-1': 0.13,
    'L-1': 44.4,
  },
  readouts: {
    'C-1': 'Mixed · 80–88% circular',
    'C-2': 'Easy (0)',
    'C-3': 'Reuse',
    'P-1': 'Basic (2)',
    'P-2': 'Wood 80–88%, water 5–9%, MUF 6–10%',
    'P-3': 'Mixed · 80–88% biogenic',
    'G-1': '4.9',
    'W-1': '10.8',
    'B-1': '0.13',
    'L-1': '44.4',
  },
  tiers: {
    'C-1': 'primary',
    'C-2': 'primary',
    'C-3': 'primary',
    'P-1': 'primary',
    'P-2': 'primary',
    'P-3': 'primary',
    'G-1': 'primary',
    'W-1': 'primary',
    'B-1': 'secondary',
    'L-1': 'primary',
  },
  gate: ['R2F A2-s1', 'λ 0.12 W/mK', 'SA 0.1 / 0.2', 'Lifespan 50 yr'],
};

const PLASTER: Candidate = {
  key: 'plaster',
  label: 'Plaster partition',
  values: {
    'C-1': 0.3,
    'C-2': 1,
    'C-3': 6,
    'P-1': 2,
    'P-3': 0,
    'G-1': 4.5,
    'W-1': 0.02,
    'B-1': 0.06,
    'L-1': 39.1,
  },
  readouts: {
    'C-1': 'Mixed · undeclared fraction',
    'C-2': 'Difficult (1)',
    'C-3': 'Inert, non-hazardous landfill',
    'P-1': 'Basic (2)',
    'P-2': 'Gypsum 96%, cardboard 2%, additives 2%',
    'P-3': 'Technical',
    'G-1': '4.5',
    'W-1': '0.02',
    'B-1': '0.06',
    'L-1': '39.1',
  },
  tiers: {
    'C-1': 'tertiary',
    'C-2': 'primary',
    'C-3': 'primary',
    'P-1': 'primary',
    'P-2': 'primary',
    'P-3': 'primary',
    'G-1': 'primary',
    'W-1': 'primary',
    'B-1': 'secondary',
    'L-1': 'primary',
  },
  gate: ['R2F D-s2', 'λ 0.23 W/mK', 'SA 0.05 / 0.05', 'Lifespan 50 yr'],
};

const SYNTHETIC: Candidate = {
  key: 'synthetic',
  label: 'Synthetic fibre carpet',
  values: {
    'C-1': 0,
    'C-2': 0,
    'C-3': 3,
    'P-1': 2,
    'P-3': 0,
    'G-1': 16.4,
    'W-1': 1.3,
    'B-1': 0.21,
    'L-1': 38.5,
  },
  readouts: {
    'C-1': 'Non-circular origin',
    'C-2': 'Easy (0)',
    'C-3': 'Recycling',
    'P-1': 'Basic (2)',
    'P-2': 'Mineral filler 52.4%, bitumen 15.3%, PA 13.5%',
    'P-3': 'Technical',
    'G-1': '16.4',
    'W-1': '1.3',
    'B-1': '0.21',
    'L-1': '38.5',
  },
  tiers: {
    'C-1': 'primary',
    'C-2': 'primary',
    'C-3': 'primary',
    'P-1': 'primary',
    'P-2': 'primary',
    'P-3': 'primary',
    'G-1': 'primary',
    'W-1': 'primary',
    'B-1': 'secondary',
    'L-1': 'primary',
  },
  gate: ['R2F B2-s1', 'SR Class DS', 'ACIN 20–30 dB', 'Lifespan 10 yr'],
};

const WOOL: Candidate = {
  key: 'wool',
  label: 'Wool carpet',
  values: {
    'C-1': 0.255,
    'C-2': 0,
    'C-3': 3,
    'P-1': 3,
    'P-3': 0,
    'G-1': 9.3,
    'W-1': 1.1,
    'B-1': 0.1,
    'L-1': 61.7,
  },
  readouts: {
    'C-1': 'Mixed · 25.5% Econyl',
    'C-2': 'Easy (0)',
    'C-3': 'Recycling',
    'P-1': 'Bronze (3)',
    'P-2': 'Econyl 25.5%, dolomite 21%, latex 18.5%',
    'P-3': 'Technical',
    'G-1': '9.3',
    'W-1': '1.1',
    'B-1': '0.10',
    'L-1': '61.7',
  },
  tiers: {
    'C-1': 'primary',
    'C-2': 'primary',
    'C-3': 'primary',
    'P-1': 'primary',
    'P-2': 'primary',
    'P-3': 'primary',
    'G-1': 'primary',
    'W-1': 'primary',
    'B-1': 'secondary',
    'L-1': 'primary',
  },
  gate: ['R2F Cfl-s1', 'SR Class DS', 'ACIN 19 dB', 'Lifespan 10 yr'],
};

const WOOD: Candidate = {
  key: 'wood',
  label: 'Wood flooring',
  values: {
    'C-1': 0,
    'C-2': 0,
    'C-3': 5,
    'P-1': 2,
    'P-3': 0.9,
    'G-1': 2.2,
    'W-1': 9.8,
    'B-1': 0.11,
    'L-1': 56.9,
  },
  readouts: {
    'C-1': 'Non-circular origin',
    'C-2': 'Easy (0)',
    'C-3': 'Incineration',
    'P-1': 'Basic (2)',
    'P-2': 'Wood >90%, water 8%, lacquers <2%',
    'P-3': 'Mixed · >90% biogenic',
    'G-1': '2.2',
    'W-1': '9.8',
    'B-1': '0.11',
    'L-1': '56.9',
  },
  tiers: {
    'C-1': 'primary',
    'C-2': 'primary',
    'C-3': 'primary',
    'P-1': 'primary',
    'P-2': 'primary',
    'P-3': 'primary',
    'G-1': 'primary',
    'W-1': 'primary',
    'B-1': 'secondary',
    'L-1': 'primary',
  },
  gate: ['R2F Cfl-s1', 'SR 0.4', 'ACIN 10–20 dB', 'Lifespan 10 yr'],
};

export const SCENARIOS: readonly Scenario[] = [
  {
    key: 'partitions',
    label: 'Indoor partitions',
    element: 'Scenario 1',
    area: '637.9 m²',
    candidates: [TIMBER, PLASTER],
  },
  {
    key: 'flooring',
    label: 'Flooring',
    element: 'Scenario 2',
    area: '927.8 m²',
    candidates: [SYNTHETIC, WOOL, WOOD],
  },
];

export interface Profile {
  readonly key: string;
  readonly label: string;
  readonly metric: string;
  readonly factor: number;
  /** Published winner per scenario. The model is asserted against it at load. */
  readonly wins: Readonly<Record<string, string>>;
}

export const EQUAL: Profile = {
  key: 'equal',
  label: 'Equal weighting',
  metric: '',
  factor: 1,
  wins: { partitions: 'timber', flooring: 'wood' },
};

export const PROFILES: readonly Profile[] = [
  {
    key: 'cost',
    label: 'Lifecycle cost ×10',
    metric: 'L-1',
    factor: 10,
    wins: { partitions: 'plaster', flooring: 'synthetic' },
  },
  {
    key: 'origin',
    label: 'Circular origin ×5',
    metric: 'C-1',
    factor: 5,
    wins: { partitions: 'timber', flooring: 'wool' },
  },
];

const goodness = (metric: Metric, value: number, best: number): number => {
  const scale = metric.scale;
  if (!scale) return 0;
  if (scale.kind === 'fraction') return value;
  if (scale.kind === 'ordinal') {
    const span = scale.levels - 1;
    return scale.bestIsLow ? 1 - value / span : value / span;
  }
  return value === 0 ? 1 : best / value;
};

export interface Band {
  readonly family: Family;
  readonly value: number;
}

export interface Ranked {
  readonly candidate: Candidate;
  readonly bands: readonly Band[];
  readonly total: number;
}

export function rank(scenario: Scenario, profile: Profile): readonly Ranked[] {
  const best = new Map<string, number>();
  for (const metric of SCORED) {
    if (metric.scale?.kind !== 'ratio') continue;
    const present = scenario.candidates
      .map((candidate) => candidate.values[metric.key])
      .filter((value): value is number => value !== null && value !== undefined);
    if (present.length > 0) best.set(metric.key, Math.min(...present));
  }

  const scored = scenario.candidates.map((candidate) => {
    const bands = FAMILIES.map(({ key }) => {
      const usable = SCORED.filter(
        (metric) => metric.family === key && candidate.values[metric.key] !== null,
      );
      if (usable.length === 0) return { family: key, value: 0 };

      const sum = usable.reduce((total, metric) => {
        const raw = candidate.values[metric.key] as number;
        const weight = profile.metric === metric.key ? profile.factor : 1;
        return total + weight * goodness(metric, raw, best.get(metric.key) ?? raw);
      }, 0);

      return { family: key, value: sum / usable.length };
    });

    return { candidate, bands, total: bands.reduce((sum, band) => sum + band.value, 0) };
  });

  return [...scored].sort((a, b) => b.total - a.total);
}

function assertPublished(): void {
  for (const profile of [EQUAL, ...PROFILES]) {
    for (const scenario of SCENARIOS) {
      const expected = profile.wins[scenario.key];
      const actual = rank(scenario, profile)[0]?.candidate.key;
      if (expected !== actual) {
        throw new Error(
          `C1: ${scenario.key} under "${profile.label}" ranks ${actual} first, but the ` +
            `paper publishes ${expected}. The model and the thesis disagree.`,
        );
      }
    }
  }
}

assertPublished();
