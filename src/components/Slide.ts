import gsap from 'gsap';
import { DURATION, EASE, STAGGER, seconds } from '@/animations/timing';
import type { Accent } from '@/components/figures/Statistic';
import { el } from '@/utilities/dom';
import './slide.css';

export interface SlideSpec {
  readonly eyebrow?: string;
  readonly heading: string;
  readonly accent?: Accent;
}

export interface Statement {
  readonly element: HTMLElement;
  play(settle?: boolean): gsap.core.Timeline;
  /**
   * Takes it back off. Instant, and only for beats reached backwards — a
   * statement that fades out on the way back is a statement being made twice.
   */
  hide(): void;
}

/**
 * The evidence column: panels sharing one cell, one visible at a time. The
 * outgoing panel leaves upward and the incoming arrives from below, so a swap
 * never reflows the composition.
 */
export interface EvidenceStack {
  readonly element: HTMLElement;
  add(content: HTMLElement): number;
  show(index: number, settle?: boolean): gsap.core.Timeline;
}

export interface Slide {
  readonly element: HTMLElement;
  readonly evidence: EvidenceStack;
  revealHead(settle?: boolean): gsap.core.Timeline;
  /** A short claim under the heading, led by an accent rule. Beat material. */
  addStatement(text: string, accent?: Accent): Statement;
}

/**
 * The standard two-column composition: claim on the left, what supports it on
 * the right. Scenes compose this rather than laying themselves out.
 */
export function createSlide(spec: SlideSpec): Slide {
  const accent = spec.accent ?? 'circular';

  const eyebrow = spec.eyebrow
    ? el('p', { className: 'slide-eyebrow', text: spec.eyebrow })
    : null;
  const heading = el('h2', { className: 'slide-heading', text: spec.heading });
  const statements = el('div', { className: 'slide-statements' });

  const head = el('div', {
    className: 'slide-head',
    children: [...(eyebrow ? [eyebrow] : []), heading, statements],
  });

  const evidenceRoot = el('div', { className: 'slide-evidence' });
  const panels: HTMLElement[] = [];
  let visible = -1;

  const evidence: EvidenceStack = {
    element: evidenceRoot,
    add(content) {
      const panel = el('div', { className: 'slide-panel', children: [content] });
      gsap.set(panel, { opacity: 0, yPercent: 6 });
      evidenceRoot.appendChild(panel);
      panels.push(panel);
      return panels.length - 1;
    },
    show(index, settle = false) {
      const timeline = gsap.timeline();
      const incoming = panels[index];
      const outgoing = visible >= 0 && visible !== index ? panels[visible] : null;
      visible = index;

      if (settle) {
        for (const [slot, panel] of panels.entries()) {
          gsap.set(
            panel,
            slot === index
              ? { opacity: 1, yPercent: 0, pointerEvents: 'auto' }
              : { opacity: 0, yPercent: 6, pointerEvents: 'none' },
          );
        }
        return timeline;
      }

      // `overwrite` is required: two quick clicks leave the previous beat's
      // fade-in still running when this one's fade-out ends, and the panel
      // that just left comes back.
      if (outgoing) {
        timeline.to(outgoing, {
          opacity: 0,
          yPercent: -8,
          pointerEvents: 'none',
          duration: seconds(DURATION.normal),
          ease: EASE.exit,
          overwrite: true,
        });
      }
      if (incoming) {
        timeline.to(
          incoming,
          {
            opacity: 1,
            yPercent: 0,
            pointerEvents: 'auto',
            duration: seconds(DURATION.slow),
            ease: EASE.enter,
            overwrite: true,
          },
          outgoing ? seconds(DURATION.quick) : 0,
        );
      }

      return timeline;
    },
  };

  const element = el('div', {
    className: 'slide',
    attrs: { 'data-accent': accent },
    children: [head, evidenceRoot],
  });

  return {
    element,
    evidence,

    revealHead(settle = false) {
      const parts = [...(eyebrow ? [eyebrow] : []), heading];
      const timeline = gsap.timeline();

      if (settle) {
        gsap.set(parts, { opacity: 1, y: 0 });
        return timeline;
      }

      return timeline.from(parts, {
        y: 26,
        opacity: 0,
        duration: seconds(DURATION.slow),
        ease: EASE.enter,
        stagger: seconds(STAGGER),
      });
    },

    addStatement(text, statementAccent) {
      const rule = el('span', { className: 'slide-statement-rule' });
      const body = el('span', { className: 'slide-statement-text', text });
      const node = el('p', {
        className: 'slide-statement',
        attrs: { 'data-accent': statementAccent ?? accent },
        children: [rule, body],
      });
      gsap.set(node, { opacity: 0 });
      statements.appendChild(node);

      return {
        element: node,

        hide() {
          gsap.killTweensOf([node, rule, body]);
          gsap.set(node, { opacity: 0 });
        },

        play(settle = false) {
          const timeline = gsap.timeline();
          if (settle) {
            gsap.set(node, { opacity: 1 });
            gsap.set(body, { opacity: 1, y: 0 });
            gsap.set(rule, { scaleY: 1 });
            return timeline;
          }
          return timeline
            .set(node, { opacity: 1 })
            .fromTo(
              rule,
              { scaleY: 0 },
              { scaleY: 1, duration: seconds(DURATION.slow), ease: EASE.enter, overwrite: true },
            )
            .fromTo(
              body,
              { opacity: 0, y: 16 },
              {
                opacity: 1,
                y: 0,
                duration: seconds(DURATION.slow),
                ease: EASE.enter,
                overwrite: true,
              },
              seconds(DURATION.instant),
            );
        },
      };
    },
  };
}
