/**
 * Scientific and editorial content, kept separate from rendering code so text
 * can be revised without touching scene logic.
 *
 * Typed rather than JSON: missing or renamed fields fail at compile time.
 */

export interface PresentationMeta {
  readonly title: string;
  readonly author: string;
  readonly institution: string;
  /** TODO: confirm exact doctoral programme name. */
  readonly programme: string;
  /** TODO: supervisor names. */
  readonly supervisors: readonly string[];
  /** TODO: defense date. */
  readonly date: string;
}

export const meta: PresentationMeta = {
  title: 'Artificial Intelligence for Circular and Sustainable Product Decision-Support in Construction',
  author: 'Roger Vergés Eiras',
  institution: 'Universitat Politècnica de Catalunya',
  programme: 'Doctoral Programme',
  supervisors: [],
  date: '',
};

export interface ContextContent {
  readonly eyebrow: string;
  readonly heading: string;
  readonly body: readonly string[];
}

export const context: ContextContent = {
  eyebrow: 'Research context',
  heading: 'Material choices made today determine the circularity of the built environment for decades.',
  body: [
    'Construction consumes more raw material than any other sector, yet product selection still relies on fragmented, inconsistent and largely unstructured data.',
    'This work proposes an end-to-end pipeline that turns heterogeneous product information into ranked, preference-aware recommendations.',
  ],
};
