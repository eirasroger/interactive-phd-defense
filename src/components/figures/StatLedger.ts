import gsap from 'gsap';
import { DURATION, EASE, seconds } from '@/animations/timing';
import { el } from '@/utilities/dom';
import { createStatistic, type StatisticSpec } from './Statistic';
import './stat-ledger.css';

export interface StatGroupSpec {
  /** What the figures have in common. Two or three words. */
  readonly label: string;
  readonly stats: readonly StatisticSpec[];
}

export interface StatLedgerSpec {
  readonly groups: readonly StatGroupSpec[];
  readonly source?: string;
}

export interface StatLedger {
  readonly element: HTMLElement;
  play(settle?: boolean): gsap.core.Timeline;
}

/**
 * Figures arranged into named groups, divided by a rule.
 *
 * The grouping carries the argument: three numbers in a row are three facts,
 * where the same three split one against two are a contradiction.
 */
export function createStatLedger(spec: StatLedgerSpec): StatLedger {
  const dividers: HTMLElement[] = [];
  const labels: HTMLElement[] = [];
  const statistics = spec.groups.flatMap((group) => group.stats.map(createStatistic));

  const children: HTMLElement[] = [];
  let cursor = 0;

  for (const [index, group] of spec.groups.entries()) {
    if (index > 0) {
      const divider = el('span', { className: 'ledger-divider' });
      dividers.push(divider);
      children.push(divider);
    }

    const label = el('p', { className: 'ledger-label', text: group.label });
    labels.push(label);

    const stats = group.stats
      .map(() => statistics[cursor++]?.element)
      .filter((node): node is HTMLElement => node !== undefined);

    children.push(
      el('div', {
        className: 'ledger-group',
        children: [label, el('div', { className: 'ledger-stats', children: stats })],
      }),
    );
  }

  const body = el('div', { className: 'ledger-body', children });
  const source = spec.source ? el('p', { className: 'ledger-source', text: spec.source }) : null;

  const element = el('div', {
    className: 'ledger',
    children: [body, ...(source ? [source] : [])],
  });

  return {
    element,
    play(settle = false) {
      const timeline = gsap.timeline();

      if (settle) {
        gsap.set([...dividers, ...labels], { opacity: 1, scaleY: 1 });
        for (const statistic of statistics) timeline.add(statistic.play(true), 0);
        return timeline;
      }

      timeline
        .from(labels, {
          opacity: 0,
          y: 12,
          duration: seconds(DURATION.normal),
          ease: EASE.enter,
          stagger: 0.08,
        })
        .from(
          dividers,
          {
            scaleY: 0,
            duration: seconds(DURATION.slow),
            ease: EASE.enter,
            transformOrigin: 'top center',
          },
          0,
        );

      // One at a time: the eye can only follow one moving number.
      statistics.forEach((statistic, index) => {
        timeline.add(statistic.play(false), seconds(DURATION.quick) + index * 0.22);
      });

      return timeline;
    },
  };
}
