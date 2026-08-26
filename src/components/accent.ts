/**
 * The semantic accent vocabulary, and the only one.
 *
 * Green carries circularity and sustainability, blue carries AI and
 * computation, amber carries emphasis and whatever the act is pointing at as a
 * problem. `neutral` is the absence of a claim rather than a fourth colour.
 *
 * It lives here rather than on any one component because every composition in
 * the deck consumes it and none of them owns it. It used to be exported from
 * `figures/Statistic`, which meant a card chassis imported a numeral primitive
 * to name a colour.
 */
export type Accent = 'circular' | 'ai' | 'emphasis' | 'neutral';
