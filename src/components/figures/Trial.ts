import gsap from 'gsap';
import { DURATION, EASE, STAGGER, seconds } from '@/animations/timing';
import {
  EQUAL,
  FAMILIES,
  METRICS,
  PROFILES,
  SCENARIOS,
  rank,
  type Family,
  type Profile,
  type Scenario,
} from '@/content/c1';
import { el } from '@/utilities/dom';
import { offsetBetween, stageScale } from '@/utilities/flip';
import './family-palette.css';
import './trial.css';

export interface TrialSpec {
  readonly src: string;
  readonly alt: string;
}

const STEPS: readonly Profile[] = [
  EQUAL,
  EQUAL,
  PROFILES.find((profile) => profile.key === 'cost') as Profile,
];

const PLATE = ['54%', '34%', '34%'] as const;

const LIFESPAN: Readonly<Record<string, string>> = {
  timber: '50 yr',
  plaster: '50 yr',
  synthetic: '10 yr',
  wool: '10 yr',
  wood: '10 yr',
};

interface Row {
  readonly element: HTMLElement;
  readonly rank: HTMLElement;
  readonly bands: ReadonlyMap<Family, HTMLElement>;
}

interface Group {
  readonly scenario: Scenario;
  readonly rows: HTMLElement;
  readonly byKey: ReadonlyMap<string, Row>;
}

const familyOf = (metricKey: string): Family | null =>
  METRICS.find((metric) => metric.key === metricKey)?.family ?? null;

export interface Trial {
  readonly element: HTMLElement;
  readonly beats: number;
  play(step: number, settle: boolean): gsap.core.Timeline | null;
}

/**
 * One panel for the whole case study: the model stays on screen and the column
 * beside it becomes the ranking. The chips and the rows are the same five
 * products, so the rows travel from where the chips were standing.
 */
export function createTrial(spec: TrialSpec): Trial {
  const image = el('img', {
    className: 'trial-image',
    attrs: { src: spec.src, alt: spec.alt, decoding: 'async', draggable: 'false' },
  });
  const plate = el('div', { className: 'trial-plate', children: [image] });

  const chips = new Map<string, HTMLElement>();

  const scenarioNodes = SCENARIOS.map((scenario) => {
    const candidates = scenario.candidates.map((candidate) => {
      const chip = el('div', {
        className: 'trial-candidate',
        children: [
          el('span', { className: 'trial-candidate-mark' }),
          el('span', { text: candidate.label }),
          el('span', { className: 'trial-candidate-life', text: LIFESPAN[candidate.key] ?? '' }),
        ],
      });
      chips.set(candidate.key, chip);
      return chip;
    });

    return el('div', {
      className: 'trial-scenario',
      attrs: { 'data-scenario': scenario.key },
      children: [
        el('div', {
          className: 'trial-scenario-head',
          children: [
            el('span', { className: 'trial-key' }),
            el('span', { className: 'trial-scenario-label', text: scenario.label }),
            el('span', { className: 'trial-scenario-area', text: scenario.area }),
          ],
        }),
        el('div', { className: 'trial-candidates', children: candidates }),
      ],
    });
  });

  const scenarios = el('div', { className: 'trial-scenarios', children: scenarioNodes });

  const groups: Group[] = [];
  const groupNodes = SCENARIOS.map((scenario) => {
    const byKey = new Map<string, Row>();

    const rowNodes = scenario.candidates.map((candidate) => {
      const bands = new Map<Family, HTMLElement>();
      const bandNodes = FAMILIES.map(({ key }) => {
        const band = el('span', {
          className: 'trial-band',
          attrs: { 'data-family': key, style: 'width: 0%' },
        });
        bands.set(key, band);
        return band;
      });

      const rankNode = el('span', { className: 'trial-rank' });
      const element = el('div', {
        className: 'trial-row',
        attrs: { 'data-lead': 'false' },
        children: [
          rankNode,
          el('span', { className: 'trial-label', text: candidate.label }),
          el('div', { className: 'trial-track', children: bandNodes }),
        ],
      });

      byKey.set(candidate.key, { element, rank: rankNode, bands });
      return element;
    });

    const rows = el('div', { className: 'trial-rows', children: rowNodes });
    groups.push({ scenario, rows, byKey });

    return el('div', {
      className: 'trial-group',
      children: [
        el('div', {
          className: 'trial-group-head',
          children: [el('span', { className: 'trial-key' }), el('span', { text: scenario.label })],
        }),
        rows,
      ],
    });
  });

  for (const [index, node] of groupNodes.entries()) {
    node.dataset['scenario'] = SCENARIOS[index]?.key ?? '';
    node.classList.add('trial-scenario');
  }

  const profile = el('div', { className: 'trial-profile', text: EQUAL.label });
  const legend = el('div', {
    className: 'trial-legend',
    children: FAMILIES.map(({ key, label }) =>
      el('div', {
        className: 'trial-legend-item',
        attrs: { 'data-family': key },
        children: [el('span', { className: 'trial-legend-swatch' }), el('span', { text: label })],
      }),
    ),
  });

  const ranking = el('div', {
    className: 'trial-ranking',
    children: [profile, el('div', { className: 'trial-groups', children: groupNodes })],
  });

  const panel = el('div', { className: 'trial-panel', children: [scenarios, ranking] });
  const column = el('div', { className: 'trial-column', children: [panel, legend] });
  const element = el('div', { className: 'trial', children: [plate, column] });

  const allRows = (): Row[] => groups.flatMap((group) => [...group.byKey.values()]);

  /**
   * The step showing before this one. A defence gets questioned, so every step
   * is reachable from either side and has to animate from wherever it is.
   */
  let shown = -1;

  const writeState = (step: number): void => {
    const active = STEPS[step] ?? EQUAL;
    const family = familyOf(active.metric);

    profile.textContent = active.label;
    if (family) profile.dataset['family'] = family;
    else profile.removeAttribute('data-family');
    profile.dataset['weighted'] = String(family !== null);

    for (const group of groups) {
      const ranked = rank(group.scenario, active);
      const ceiling = Math.max(...ranked.map((entry) => entry.total));

      for (const [position, entry] of ranked.entries()) {
        const row = group.byKey.get(entry.candidate.key);
        if (!row) continue;
        group.rows.appendChild(row.element);
        row.rank.textContent = String(position + 1);
        row.element.dataset['lead'] = String(position === 0);

        for (const band of entry.bands) {
          const node = row.bands.get(band.family);
          if (!node) continue;
          node.style.width = `${ceiling === 0 ? 0 : (band.value / ceiling) * 100}%`;
          node.dataset['weighted'] = String(family === band.family);
        }
      }
    }
  };

  const settleTo = (step: number): void => {
    writeState(step);
    gsap.set(element, { opacity: 1 });
    gsap.set(plate, { width: PLATE[step] ?? PLATE[0], x: 0, opacity: 1, scale: 1 });
    gsap.set(scenarios, { opacity: step === 0 ? 1 : 0 });
    gsap.set(ranking, { opacity: step === 0 ? 0 : 1 });
    gsap.set([...chips.values()], { opacity: 1, x: 0, y: 0 });
    gsap.set(legend, { opacity: 1 });
    gsap.set([...legend.querySelectorAll('.trial-legend-item')], { opacity: 1, x: 0, y: 0 });
    for (const row of allRows()) {
      gsap.set(row.element, { opacity: 1, x: 0, y: 0 });
    }
  };

  return {
    element,
    beats: STEPS.length,

    play(step, settle) {
      if (settle) {
        settleTo(step);
        shown = step;
        return null;
      }

      const timeline = gsap.timeline();

      // A step never assumes the step before it finished: a fast click can drop
      // the tween that was raising these, and the model must stay on screen.
      gsap.set(element, { opacity: 1 });
      gsap.set(plate, { opacity: 1, scale: 1 });

      if (step === 0) {
        const back = shown > 0;
        const origins = back
          ? new Map(allRows().map((row) => [row, row.element.getBoundingClientRect()] as const))
          : null;

        settleTo(0);
        shown = 0;

        if (!back) {
          const swatches = [...legend.querySelectorAll<HTMLElement>('.trial-legend-item')];
          const cards = [...document.querySelectorAll<HTMLElement>('.fw-card[data-family]')];
          const scale = stageScale(element);

          for (const [index, swatch] of swatches.entries()) {
            const source = cards[index];
            if (!source) continue;
            const origin = source.getBoundingClientRect();
            const target = swatch.getBoundingClientRect();
            const lead = offsetBetween(target, origin, scale);
            timeline.fromTo(
              swatch,
              {
                x: lead.x + (origin.width - target.width) / 2 / scale,
                y: lead.y,
                opacity: 0,
              },
              {
                x: 0,
                y: 0,
                opacity: 1,
                duration: seconds(DURATION.slow),
                ease: EASE.enter,
                overwrite: true,
              },
              seconds(STAGGER * index),
            );
          }

          // Position 0 explicitly. The legend flights were queued first, so an
          // appended tween lands after them and the panel stays invisible for
          // as long as they run.
          return timeline
            .from(
              element,
              {
                opacity: 0,
                duration: seconds(DURATION.normal),
                ease: EASE.enter,
                overwrite: true,
              },
              0,
            )
            .from(
              plate,
              {
                opacity: 0,
                duration: seconds(DURATION.normal),
                ease: EASE.enter,
                overwrite: true,
              },
              0,
            )
            .from(
              scenarioNodes,
              {
                opacity: 0,
                y: 18,
                duration: seconds(DURATION.normal),
                ease: EASE.enter,
                overwrite: true,
                stagger: 0.09,
              },
              seconds(DURATION.instant),
            )
            .from(
              [...chips.values()],
              {
                opacity: 0,
                x: 14,
                duration: seconds(DURATION.normal),
                ease: EASE.enter,
                overwrite: true,
                stagger: seconds(STAGGER * 0.7),
              },
              '<0.12',
            );
        }

        timeline
          .fromTo(
            plate,
            { width: PLATE[1] },
            {
              width: PLATE[0],
              duration: seconds(DURATION.cinematic * 0.8),
              ease: EASE.standard,
              overwrite: true,
            },
            0,
          )
          .fromTo(
            ranking,
            { opacity: 1 },
            {
              opacity: 0,
              duration: seconds(DURATION.quick),
              ease: EASE.exit,
              overwrite: true,
            },
            0,
          )
          .fromTo(
            scenarios,
            { opacity: 0 },
            {
              opacity: 1,
              duration: seconds(DURATION.normal),
              ease: EASE.enter,
              overwrite: true,
            },
            seconds(DURATION.quick),
          );

        const backScale = stageScale(element);

        for (const [key, chip] of chips) {
          const row = groups
            .map((group) => group.byKey.get(key))
            .find((candidate): candidate is Row => candidate !== undefined);
          const origin = row ? origins?.get(row) : undefined;
          if (!origin) continue;
          const target = chip.getBoundingClientRect();
          const lead = offsetBetween(target, origin, backScale);
          timeline.fromTo(
            chip,
            { x: lead.x, y: lead.y },
            {
              x: 0,
              y: 0,
              duration: seconds(DURATION.cinematic * 0.8),
              ease: EASE.standard,
              overwrite: true,
            },
            0,
          );
        }

        return timeline;
      }

      if (step === 1 && shown <= 0) {
        const from = new Map(
          [...chips].map(([key, chip]) => [key, chip.getBoundingClientRect()] as const),
        );

        writeState(1);
        shown = 1;
        gsap.set(plate, { width: PLATE[1] });

        for (const row of allRows()) {
          gsap.set(row.element, { opacity: 1, x: 0, y: 0 });
        }

        timeline
          .fromTo(
            plate,
            { width: PLATE[0] },
            {
              width: PLATE[1],
              duration: seconds(DURATION.cinematic * 0.8),
              ease: EASE.standard,
              overwrite: true,
            },
            0,
          )
          .to(
            scenarios,
            { opacity: 0, duration: seconds(DURATION.quick), ease: EASE.exit, overwrite: true },
            0,
          )
          .fromTo(
            ranking,
            { opacity: 0 },
            {
              opacity: 1,
              duration: seconds(DURATION.normal),
              ease: EASE.enter,
              overwrite: true,
            },
            seconds(DURATION.quick),
          );

        const scale = stageScale(element);

        for (const group of groups) {
          for (const [key, row] of group.byKey) {
            const origin = from.get(key);
            if (!origin) continue;
            const target = row.element.getBoundingClientRect();
            const lead = offsetBetween(target, origin, scale);
            timeline.fromTo(
              row.element,
              { x: lead.x, y: lead.y },
              {
                x: 0,
                y: 0,
                duration: seconds(DURATION.cinematic * 0.8),
                ease: EASE.standard,
                overwrite: true,
              },
              0,
            );

            for (const [, band] of row.bands) {
              timeline.fromTo(
                band,
                { width: '0%' },
                {
                  width: band.style.width,
                  duration: seconds(DURATION.cinematic * 0.7),
                  ease: 'power2.out',
                  overwrite: true,
                },
                seconds(DURATION.normal),
              );
            }
          }
        }

        return timeline;
      }

      gsap.set(scenarios, { opacity: 0 });
      gsap.set(ranking, { opacity: 1 });
      gsap.set(plate, { width: PLATE[step] ?? PLATE[2] });

      const first = new Map(
        allRows().map((row) => [row, row.element.getBoundingClientRect()] as const),
      );
      const before = new Map(
        allRows().flatMap((row) =>
          [...row.bands.values()].map((band) => [band, band.style.width] as const),
        ),
      );

      writeState(step);
      shown = step;

      for (const row of allRows()) {
        const origin = first.get(row);
        if (!origin) continue;
        const target = row.element.getBoundingClientRect();
        const dy = (origin.top - target.top) / stageScale(element);

        if (Math.abs(dy) > 0.5) {
          timeline.fromTo(
            row.element,
            { y: dy },
            {
              y: 0,
              duration: seconds(DURATION.cinematic * 0.7),
              ease: EASE.standard,
              overwrite: true,
            },
            0,
          );
        }

        for (const [, band] of row.bands) {
          timeline.fromTo(
            band,
            { width: before.get(band) ?? '0%' },
            {
              width: band.style.width,
              duration: seconds(DURATION.cinematic * 0.7),
              ease: EASE.standard,
              overwrite: true,
            },
            0,
          );
        }
      }

      return timeline;
    },
  };
}
