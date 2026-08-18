import gsap from 'gsap';
import { DURATION, EASE, STAGGER, seconds } from '@/animations/timing';
import { CATEGORIES, CORPUS, EXTRACTOR, HIGHLIGHTS, MODULES, SCHEMA } from '@/content/c2';
import { el } from '@/utilities/dom';
import { countUp, formatCount } from '@/utilities/count';
import { offsetBetween, stageScale } from '@/utilities/flip';
import { categoryTint, completionAt, createCorpusField } from './CorpusField';
import './c2-palette.css';
import './corpus.css';

const MOVE = {
  flight: DURATION.cinematic * 0.5,
  fill: DURATION.cinematic * 1.35,
  drift: 34,
} as const;

interface Leg {
  readonly highlight: HTMLElement;
  readonly token: HTMLElement;
  readonly head: HTMLElement;
  readonly fields: readonly HTMLElement[];
}

export interface Corpus {
  readonly element: HTMLElement;
  readonly beats: number;
  play(step: number, settle: boolean): gsap.core.Timeline | null;
}

/**
 * The extraction, and its verification.
 *
 * Beat one is a declaration with each group of indicators lit where it sits,
 * flying into the schema field it resolves into. Beat two is that record
 * repeated across the corpus, with the manually verified sample marked through
 * it: a language model is probabilistic, so extraction accuracy is measured
 * rather than assumed.
 */
export function createCorpus(): Corpus {
  const tokens: HTMLElement[] = [];

  const highlightNodes = HIGHLIGHTS.map((highlight) => {
    const token = el('span', { className: 'cp-token' });
    tokens.push(token);
    return el('div', {
      className: 'cp-highlight',
      attrs: {
        'data-group': highlight.group,
        style:
          `left: ${highlight.x * 100}%; top: ${highlight.y * 100}%; ` +
          `width: ${highlight.w * 100}%`,
      },
      children: [
        el('span', { className: 'cp-highlight-locus', text: highlight.locus }),
        token,
      ],
    });
  });

  const page = el('div', {
    className: 'cp-page',
    children: [
      el('div', { className: 'cp-page-head' }),
      el('div', { className: 'cp-page-body' }),
      el('div', { className: 'cp-page-table' }),
      ...highlightNodes,
    ],
  });

  const source = el('div', {
    className: 'cp-source-column',
    children: [
      el('p', { className: 'cp-index', text: 'Environmental Product Declaration' }),
      page,
    ],
  });

  const rail = el('span', { className: 'cp-rail' });
  const stepNodes = EXTRACTOR.steps.map((step) => el('span', { className: 'cp-step', text: step }));
  const guardrail = el('p', { className: 'cp-guardrail', text: EXTRACTOR.guardrail });

  const extractor = el('div', {
    className: 'cp-extractor',
    children: [
      rail,
      el('div', {
        className: 'cp-steps',
        children: [el('span', { className: 'cp-model', text: EXTRACTOR.model }), ...stepNodes],
      }),
      guardrail,
    ],
  });

  const heads: HTMLElement[] = [];
  const fieldSets: HTMLElement[][] = [];

  const groupNodes = SCHEMA.map((group) => {
    const head = el('div', {
      className: 'cp-group-head',
      children: [
        el('span', { className: 'cp-group-mark' }),
        el('span', { className: 'cp-group-label', text: group.label }),
      ],
    });
    heads.push(head);

    const fields = group.fields.map((field) => el('span', { className: 'cp-field', text: field }));
    fieldSets.push(fields);

    return el('div', {
      className: 'cp-group',
      attrs: { 'data-group': group.key },
      children: [head, el('div', { className: 'cp-fields', children: fields })],
    });
  });

  const modules = el('p', {
    className: 'cp-modules',
    text: `Impact indicators are extracted per lifecycle module · ${MODULES}`,
  });

  const record = el('div', {
    className: 'cp-record',
    children: [
      el('p', { className: 'cp-index', text: 'Structured record, per product' }),
      el('div', { className: 'cp-groups', children: groupNodes }),
      modules,
    ],
  });

  const method = el('div', { className: 'cp-method', children: [source, extractor, record] });

  const readout = (
    label: string,
    tone: string,
  ): { readonly node: HTMLElement; readonly number: HTMLElement } => {
    const number = el('span', { className: 'cp-figure', text: '0' });
    return {
      node: el('div', {
        className: 'cp-readout',
        attrs: { 'data-tone': tone },
        children: [number, el('p', { className: 'cp-readout-label', text: label })],
      }),
      number,
    };
  };

  const total = readout('products extracted and structured', 'total');
  const checked = readout(
    'products manually verified against the source declaration, the sample size required for 95% confidence (Cochran, 1963)',
    'checked',
  );
  const errors = readout('discrepancies between extracted and declared values', 'clean');

  const ledger = el('div', {
    className: 'cp-ledger',
    children: [
      total.node,
      checked.node,
      errors.node,
      el('p', { className: 'cp-source', text: CORPUS.source }),
    ],
  });

  const field = createCorpusField();

  // The error count arrives on its own clock at the end. A second `from` on an
  // element already carrying one resolves its destination to that tween's start
  // value, which is zero.
  const arriving = [total.node, checked.node];

  const legendRows = CATEGORIES.map((category, rank) =>
    el('div', {
      className: 'cp-legend-item',
      children: [
        el('span', {
          className: 'cp-legend-swatch',
          attrs: { style: `background-color: ${categoryTint(rank)}` },
        }),
        el('span', { className: 'cp-legend-label', text: category.label }),
        el('span', {
          className: 'cp-legend-count',
          text: formatCount(category.count, { grouped: true }),
        }),
        el('span', {
          className: 'cp-legend-share',
          text: `${((category.count / CORPUS.products) * 100).toFixed(1)}%`,
        }),
      ],
    }),
  );

  const legend = el('div', { className: 'cp-legend', children: legendRows });

  const plot = el('div', {
    className: 'cp-plot',
    children: [el('div', { className: 'cp-canvas-frame', children: [field.element] }), legend],
  });

  const scale = el('div', { className: 'cp-scale', children: [ledger, plot] });
  const element = el('div', { className: 'cp', children: [method, scale] });

  const legs = (): Leg[] =>
    HIGHLIGHTS.map((highlight, index) => {
      const at = Math.max(
        0,
        SCHEMA.findIndex((group) => group.key === highlight.group),
      );
      return {
        highlight: highlightNodes[index] as HTMLElement,
        token: tokens[index] as HTMLElement,
        head: heads[at] as HTMLElement,
        fields: fieldSets[at] as HTMLElement[],
      };
    });

  const allFields = fieldSets.flat();
  const progress = { filled: 0, checked: 0 };
  const repaint = (): void => field.paint(progress.filled, progress.checked);

  const settleTo = (step: number): void => {
    gsap.set(element, { opacity: 1 });
    gsap.set(method, { opacity: step === 0 ? 1 : 0, x: 0 });
    gsap.set(scale, { opacity: step === 0 ? 0 : 1, x: 0 });
    gsap.set([source, extractor, record], { opacity: 1, y: 0 });
    gsap.set(page, { opacity: 1, y: 0 });
    gsap.set(highlightNodes, { opacity: 1, scaleX: 1 });
    gsap.set(tokens, { opacity: 0, x: 0, y: 0, scale: 1 });
    gsap.set([rail, ...stepNodes, guardrail, modules], { opacity: 1, y: 0, scaleY: 1 });
    gsap.set(allFields, { opacity: 1, y: 0 });
    gsap.set(heads, { opacity: 1 });
    gsap.set(legendRows, { opacity: 1, x: 0 });
    gsap.set(ledger.children, { opacity: 1, y: 0 });

    progress.filled = step === 0 ? 0 : 1;
    progress.checked = step === 0 ? 0 : 1;
    repaint();

    total.number.textContent = formatCount(step === 0 ? 0 : CORPUS.products, { grouped: true });
    checked.number.textContent = formatCount(step === 0 ? 0 : CORPUS.verified, { grouped: true });
    errors.number.textContent = formatCount(CORPUS.errors);
  };

  let shown = -1;

  return {
    element,
    beats: 2,

    play(step, settle) {
      if (settle) {
        settleTo(step);
        shown = step;
        return null;
      }

      const line = gsap.timeline();
      gsap.set(element, { opacity: 1 });

      if (step === 0) {
        const back = shown > 0;
        settleTo(0);
        shown = 0;

        if (back) {
          gsap.set(progress, { filled: 1, checked: 1 });
          repaint();
          return line
            .to(progress, {
              filled: 0,
              checked: 0,
              duration: seconds(DURATION.slow),
              ease: EASE.standard,
              onUpdate: repaint,
              overwrite: true,
            })
            .to(
              scale,
              { opacity: 0, duration: seconds(DURATION.normal), ease: EASE.exit, overwrite: true },
              0,
            )
            .fromTo(
              method,
              { opacity: 0, x: -MOVE.drift },
              {
                opacity: 1,
                x: 0,
                duration: seconds(DURATION.slow),
                ease: EASE.standard,
                overwrite: true,
              },
              seconds(DURATION.quick),
            );
        }

        // The page arrives whole and unmarked, because the point is that
        // nothing about it says which lines carry the quantities. The
        // highlights are the reading being imposed on it.
        line
          .from(element, { opacity: 0, duration: seconds(DURATION.normal), ease: EASE.enter }, 0)
          .from(page, { opacity: 0, y: 22, duration: seconds(DURATION.slow), ease: EASE.enter }, 0)
          .from(
            rail,
            {
              scaleY: 0,
              duration: seconds(DURATION.cinematic * 0.6),
              ease: EASE.enter,
              transformOrigin: 'top center',
            },
            seconds(DURATION.quick),
          )
          .from(
            stepNodes,
            {
              opacity: 0,
              y: 12,
              duration: seconds(DURATION.normal),
              ease: EASE.enter,
              stagger: seconds(STAGGER),
            },
            seconds(DURATION.quick),
          )
          .from(
            record,
            { opacity: 0, y: 22, duration: seconds(DURATION.slow), ease: EASE.enter },
            seconds(DURATION.quick),
          );

        const scaled = stageScale(element);
        gsap.set(allFields, { opacity: 0, y: 8 });
        gsap.set(heads, { opacity: 0 });
        gsap.set(modules, { opacity: 0 });

        for (const [index, leg] of legs().entries()) {
          const from = leg.token.getBoundingClientRect();
          const to = leg.head.getBoundingClientRect();
          const land = offsetBetween(from, to, scaled);
          const at = seconds(DURATION.slow + STAGGER * 2.2 * index);

          line
            .from(
              leg.highlight,
              {
                opacity: 0,
                scaleX: 0,
                duration: seconds(DURATION.normal),
                ease: EASE.enter,
                transformOrigin: 'left center',
              },
              at,
            )
            .fromTo(
              leg.token,
              { opacity: 0, scale: 0.4, x: 0, y: 0 },
              { opacity: 1, scale: 1, duration: seconds(DURATION.quick), ease: EASE.enter },
              at + seconds(DURATION.quick),
            )
            .to(
              leg.token,
              {
                x: land.x,
                y: land.y + to.height / scaled / 2,
                duration: seconds(MOVE.flight),
                ease: EASE.standard,
              },
              at + seconds(DURATION.quick),
            )
            .to(
              leg.token,
              { opacity: 0, scale: 0.5, duration: seconds(DURATION.quick), ease: EASE.exit },
              at + seconds(DURATION.quick + MOVE.flight * 0.82),
            )
            .to(
              leg.head,
              { opacity: 1, duration: seconds(DURATION.quick), ease: EASE.enter },
              at + seconds(DURATION.quick + MOVE.flight * 0.7),
            )
            .to(
              leg.fields,
              {
                opacity: 1,
                y: 0,
                duration: seconds(DURATION.normal),
                ease: EASE.enter,
                stagger: seconds(STAGGER * 0.7),
              },
              at + seconds(DURATION.quick + MOVE.flight * 0.8),
            );
        }

        line.to(
          modules,
          { opacity: 1, duration: seconds(DURATION.slow), ease: EASE.enter },
          '>-0.5',
        );

        return line;
      }

      settleTo(1);
      shown = 1;
      gsap.set(progress, { filled: 0, checked: 0 });
      repaint();
      total.number.textContent = formatCount(0, { grouped: true });
      checked.number.textContent = formatCount(0, { grouped: true });

      line
        .to(
          method,
          {
            opacity: 0,
            x: -MOVE.drift,
            duration: seconds(DURATION.normal),
            ease: EASE.exit,
            overwrite: true,
          },
          0,
        )
        .fromTo(
          scale,
          { opacity: 0 },
          { opacity: 1, duration: seconds(DURATION.normal), ease: EASE.enter, overwrite: true },
          seconds(DURATION.quick),
        )
        .from(
          arriving,
          {
            opacity: 0,
            y: 18,
            duration: seconds(DURATION.slow),
            ease: EASE.enter,
            stagger: seconds(STAGGER * 1.4),
          },
          seconds(DURATION.quick),
        )
        // The readout and the field share one clock and one easing, so the
        // number on the left is always the number of cells standing on the right.
        .to(
          progress,
          {
            filled: 1,
            duration: seconds(MOVE.fill),
            ease: 'power1.inOut',
            overwrite: true,
            onUpdate: () => {
              repaint();
              total.number.textContent = formatCount(Math.round(progress.filled * CORPUS.products), {
                grouped: true,
              });
            },
          },
          seconds(DURATION.quick),
        );

      // A legend row lights as its own band finishes laying down.
      gsap.set(legendRows, { opacity: 0, x: -10 });
      for (const [rank, row] of legendRows.entries()) {
        line.to(
          row,
          { opacity: 1, x: 0, duration: seconds(DURATION.normal), ease: EASE.enter },
          seconds(DURATION.quick) + seconds(MOVE.fill) * completionAt(rank) * 0.94,
        );
      }

      const verifyAt = seconds(DURATION.quick + MOVE.fill * 0.94);

      line
        .to(
          progress,
          {
            checked: 1,
            duration: seconds(DURATION.cinematic * 0.7),
            ease: 'power2.out',
            onUpdate: repaint,
          },
          verifyAt,
        )
        .add(
          countUp(checked.number, CORPUS.verified, seconds(DURATION.cinematic * 0.7), {
            grouped: true,
          }),
          verifyAt,
        )
        .from(
          errors.node,
          { opacity: 0, y: 14, duration: seconds(DURATION.slow), ease: EASE.enter },
          verifyAt + seconds(DURATION.normal),
        );

      return line;
    },
  };
}
