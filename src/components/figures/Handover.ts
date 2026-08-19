import gsap from 'gsap';
import { DURATION, EASE, STAGGER, seconds } from '@/animations/timing';
import {
  AUTHORITY_LABEL,
  CONDITIONS,
  DEMONSTRATION,
  EPDS,
  HANDOVER,
  REQUIREMENTS,
  SHORT_LABEL,
  readingOf,
  verdictsFor,
  type Check,
  type Handover as HandoverEntry,
  type Verdict,
} from '@/content/c3';
import { el } from '@/utilities/dom';
import './c3-palette.css';
import './handover.css';

export interface Handover {
  readonly element: HTMLElement;
  readonly beats: number;
  play(step: number, settle: boolean): gsap.core.Timeline | null;
}

const screened = (): readonly Verdict[] => {
  const condition = DEMONSTRATION[DEMONSTRATION.length - 1];
  if (!condition) throw new Error('C3: the demonstration declares no conditions.');
  return verdictsFor(condition);
};

const quantity = (check: Check): string => {
  const sign = check.requirement.kind === 'max' ? '≤' : '≥';
  const value = check.requirement.unit
    ? `${Math.round(check.bound.value)} ${check.requirement.unit}`
    : check.bound.value.toFixed(2);
  return `${sign} ${value}`;
};

const entryFor = (key: string): HandoverEntry => {
  const entry = HANDOVER.find((candidate) => candidate.key === key);
  if (!entry) throw new Error(`C3: the handover declares no output "${key}".`);
  return entry;
};

const label = (text: string): HTMLElement => el('p', { className: 'hv-label', text });
const body = (text: string): HTMLElement => el('p', { className: 'hv-body', text });

/**
 * A product, drawn the way the field drew it.
 *
 * Same surface, same verdict tint, same reading strip, so the two the screening
 * kept read as the two objects that were on the wall a beat ago rather than as
 * a list of their names.
 */
const survivorCard = (verdict: Verdict): HTMLElement =>
  el('div', {
    className: 'c3-product hv-survivor',
    attrs: { 'data-status': 'pass' },
    children: [
      el('span', { className: 'hv-survivor-name', text: verdict.epd.label }),
      el('div', {
        className: 'hv-survivor-readings',
        children: REQUIREMENTS.map((requirement) =>
          el('span', {
            className: 'hv-survivor-reading',
            text: readingOf(verdict.epd, requirement.key),
          }),
        ),
      }),
    ],
  });

/**
 * The set that survived, and the fraction of the portfolio it is.
 *
 * This is the station's product, so it takes the weight of the composition: one
 * tall card carrying the count at display size over the two products it counts.
 */
function candidateCard(): HTMLElement {
  const survivors = screened().filter((verdict) => verdict.pass);
  const entry = entryFor('candidates');

  return el('div', {
    className: 'hv-card hv-candidates',
    children: [
      label(entry.label),
      el('div', {
        className: 'hv-hero',
        children: [
          el('span', { className: 'hv-hero-count', text: String(survivors.length) }),
          el('span', { className: 'hv-hero-of', text: `/ ${EPDS.length}` }),
        ],
      }),
      body(entry.body),
      el('div', { className: 'hv-survivors', children: survivors.map(survivorCard) }),
    ],
  });
}

/**
 * One product's checks under the final condition, with the source that set each
 * bound. This is the record the engine writes, not a summary of it.
 */
function logCard(): HTMLElement {
  const kept = screened().find((verdict) => verdict.pass);
  if (!kept) throw new Error('C3: the demonstration leaves no product to log.');
  const entry = entryFor('log');

  const heads = ['Indicator', 'Constraint', 'Set by', 'Check'].map((text) =>
    el('span', { className: 'hv-log-head', text }),
  );

  return el('div', {
    className: 'hv-card hv-log-card',
    children: [
      el('div', {
        className: 'hv-card-head',
        children: [label(entry.label), el('span', { className: 'hv-log-subject', text: kept.epd.label })],
      }),
      body(entry.body),
      el('div', {
        className: 'hv-log',
        children: [
          el('div', { className: 'hv-log-row hv-log-heads', children: heads }),
          ...kept.checks.map((check) =>
            el('div', {
              className: 'hv-log-row',
              attrs: { 'data-source': check.bound.source, 'data-status': check.status },
              children: [
                el('span', {
                  className: 'hv-log-indicator',
                  text: SHORT_LABEL[check.requirement.key],
                }),
                el('span', { className: 'hv-log-bound', text: quantity(check) }),
                el('span', {
                  className: 'hv-log-source',
                  text: AUTHORITY_LABEL[check.bound.source],
                }),
                el('span', { className: 'hv-log-verdict', text: check.status }),
              ],
            }),
          ),
        ],
      }),
    ],
  });
}

/** The jurisdictions the case study encodes, and the slot the next one takes. */
function ruleSetCard(): HTMLElement {
  const encoded = [...new Set(CONDITIONS.map((condition) => condition.jurisdiction))];
  const entry = entryFor('ruleset');

  return el('div', {
    className: 'hv-card hv-ruleset-card',
    children: [
      label(entry.label),
      body(entry.body),
      el('div', {
        className: 'hv-rulesets',
        children: [
          ...encoded.map((jurisdiction) =>
            el('div', {
              className: 'hv-ruleset',
              children: [
                el('span', { className: 'hv-ruleset-name', text: jurisdiction }),
                el('span', { className: 'hv-ruleset-note', text: 'encoded' }),
              ],
            }),
          ),
          el('div', {
            className: 'hv-ruleset',
            attrs: { 'data-open': 'true' },
            children: [
              el('span', { className: 'hv-ruleset-name', text: '+' }),
              el('span', { className: 'hv-ruleset-note', text: 'next' }),
            ],
          }),
        ],
      }),
    ],
  });
}

/**
 * What the station produces.
 *
 * Three equal rows said these outputs are the same kind of thing, and they are
 * not. One is a set of products and it is the reason the station exists; the
 * other two are the account of how that set was arrived at and the file that
 * would have to be written to arrive at a different one. The composition is
 * weighted accordingly: the candidate set takes a full-height card of its own
 * and the other two stack beside it.
 */
export function createHandover(): Handover {
  const candidates = candidateCard();
  const log = logCard();
  const rules = ruleSetCard();

  const index = el('p', { className: 'c3-index', text: 'What leaves the station' });
  const element = el('div', {
    className: 'c3 hv',
    children: [
      index,
      el('div', {
        className: 'hv-layout',
        children: [
          candidates,
          el('div', { className: 'hv-column', children: [log, rules] }),
        ],
      }),
    ],
  });

  const hero = candidates.querySelector('.hv-hero') as HTMLElement;
  const survivors = [...candidates.querySelectorAll('.hv-survivor')] as HTMLElement[];
  const logRows = [...log.querySelectorAll('.hv-log-row')] as HTMLElement[];
  const tiles = [...rules.querySelectorAll('.hv-ruleset')] as HTMLElement[];
  const cards = [candidates, log, rules];

  const settleTo = (): void => {
    gsap.set(element, { opacity: 1 });
    gsap.set([index, ...cards, hero, ...survivors, ...logRows, ...tiles], {
      opacity: 1,
      x: 0,
      y: 0,
      scale: 1,
    });
  };

  return {
    element,
    beats: 1,

    play(_step, settle) {
      if (settle) {
        settleTo();
        return null;
      }

      const line = gsap.timeline();
      gsap.set(element, { opacity: 1 });

      return line
        .from(index, { opacity: 0, y: 8, duration: seconds(DURATION.normal), ease: EASE.enter }, 0)
        .from(
          cards,
          {
            opacity: 0,
            y: 24,
            duration: seconds(DURATION.slow),
            ease: EASE.enter,
            stagger: seconds(STAGGER * 1.6),
          },
          seconds(DURATION.quick * 0.4),
        )
        // The count is the claim, so it arrives before the products it counts.
        .from(
          hero,
          {
            opacity: 0,
            scale: 0.86,
            duration: seconds(DURATION.slow * 0.8),
            ease: EASE.enter,
          },
          seconds(DURATION.normal),
        )
        .from(
          survivors,
          {
            opacity: 0,
            x: -22,
            duration: seconds(DURATION.slow * 0.7),
            ease: EASE.enter,
            stagger: seconds(STAGGER * 1.8),
          },
          seconds(DURATION.slow * 0.75),
        )
        .from(
          logRows,
          {
            opacity: 0,
            y: 10,
            duration: seconds(DURATION.normal),
            ease: EASE.enter,
            stagger: seconds(STAGGER * 0.8),
          },
          seconds(DURATION.slow * 0.85),
        )
        .from(
          tiles,
          {
            opacity: 0,
            y: 12,
            duration: seconds(DURATION.normal),
            ease: EASE.enter,
            stagger: seconds(STAGGER * 1.4),
          },
          seconds(DURATION.cinematic * 0.85),
        );
    },
  };
}
