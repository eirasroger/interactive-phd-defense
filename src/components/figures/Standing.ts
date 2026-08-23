import gsap from 'gsap';
import { DURATION, EASE, STAGGER, seconds } from '@/animations/timing';
import { STANDING_LIMITS, STANDING_ZONES, type StandingZone } from '@/content/act3';
import { el } from '@/utilities/dom';
import './standing.css';

export interface Standing {
  readonly element: HTMLElement;
  /** The one beat: all three zones are set out, and stay set out. */
  open(settle: boolean): gsap.core.Timeline;
}

interface Zone {
  readonly element: HTMLElement;
  readonly label: HTMLElement;
  readonly rule: HTMLElement;
  readonly parts: readonly HTMLElement[];
}

/**
 * The choreography, in seconds from the start of the beat.
 *
 * Reading order down a zone: what it is called, the rule that sets it out, then
 * what it holds. Everything arriving at once is one event; a short sequence is
 * something the eye can follow.
 */
const CUE = { label: 0, rule: 0.12, body: 0.3 } as const;

/** One zone begins after the one before it is most of the way through. */
const ZONE_STEP = 0.24;

const buildZone = (zone: StandingZone): Zone => {
  const label = el('span', { className: 'std-label', text: zone.label });
  const rule = el('div', { className: 'std-rule' });
  const rows = zone.rows.map((text) =>
    el('div', { className: 'std-row', children: [el('p', { text })] }),
  );
  // Where the zone's drawing goes. Reserved rather than left out, so the frame
  // is composed against the space the figure will take instead of being
  // re-composed around it later.
  const panel = el('div', { className: 'std-panel' });
  const body = el('div', { className: 'std-body', children: [...rows, panel] });

  const element = el('div', {
    className: 'std-zone',
    attrs: { 'data-zone': zone.key },
    children: [label, rule, body],
  });

  return { element, label, rule, parts: [...rows, panel] };
};

const buildLimits = (): Zone => {
  const label = el('span', { className: 'std-label', text: STANDING_LIMITS.label });
  const rule = el('div', { className: 'std-rule' });
  const items = STANDING_LIMITS.items.map((item) =>
    el('div', {
      className: 'std-item',
      children: [
        el('p', { className: 'std-item-lead', text: item.lead }),
        el('p', { className: 'std-item-note', text: item.note }),
      ],
    }),
  );
  const body = el('div', { className: 'std-items', children: items });

  const element = el('div', {
    className: 'std-zone',
    attrs: { 'data-zone': 'limits' },
    children: [label, rule, body],
  });

  return { element, label, rule, parts: items };
};

/**
 * The closing frame, in the language of C5's second beat.
 *
 * No card around anything. A zone is set out by its own name in the accent over
 * a hairline, and its content stands on the ground rather than inside a frame —
 * which is what lets three zones of different shapes sit on one surface without
 * reading as three boxes. Only a drawing gets a panel, and only because a
 * drawing needs a ground of its own to be read against.
 *
 * **One beat.** The three parts are one statement, and the frame only argues
 * while all three are on screen together: a contribution held up on its own
 * invites the limitation as an interruption rather than as the next thing said.
 * A build that lit them one at a time would spend the closing minute assembling
 * a picture the presenter is already talking over.
 */
export function createStanding(): Standing {
  const zones = [...STANDING_ZONES.map(buildZone), buildLimits()];

  const element = el('div', {
    className: 'std',
    children: zones.map((zone) => zone.element),
  });

  const all = zones.flatMap((zone) => [zone.element, zone.label, zone.rule, ...zone.parts]);

  return {
    element,

    open(settle) {
      gsap.killTweensOf(all);
      const timeline = gsap.timeline();
      const motion = settle ? 0 : 1;

      zones.forEach((zone, position) => {
        const at = seconds(position * ZONE_STEP) * motion;

        timeline.fromTo(
          zone.label,
          { opacity: motion ? 0 : 1, y: motion ? 8 : 0 },
          { opacity: 1, y: 0, duration: seconds(DURATION.slow) * motion, ease: EASE.enter },
          at + seconds(CUE.label) * motion,
        );

        // Drawn from the left rather than faded: a rule that appears is a
        // border, and a rule that is drawn is a zone being set out.
        timeline.fromTo(
          zone.rule,
          { scaleX: motion ? 0 : 1 },
          { scaleX: 1, duration: seconds(DURATION.cinematic) * motion, ease: 'power2.inOut' },
          at + seconds(CUE.rule) * motion,
        );

        timeline.fromTo(
          zone.parts as gsap.TweenTarget,
          { opacity: motion ? 0 : 1, y: motion ? 10 : 0 },
          {
            opacity: 1,
            y: 0,
            duration: seconds(DURATION.slow) * motion,
            ease: EASE.enter,
            stagger: seconds(STAGGER * 1.6) * motion,
          },
          at + seconds(CUE.body) * motion,
        );
      });

      return timeline;
    },
  };
}
