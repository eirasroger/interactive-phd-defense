interface ElementOptions {
  className?: string;
  text?: string;
  attrs?: Record<string, string>;
  /** `Element` rather than `HTMLElement`, so a composition can hold an `svg`. */
  children?: readonly Element[];
}

export function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  options: ElementOptions = {},
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);

  if (options.className) node.className = options.className;
  if (options.text !== undefined) node.textContent = options.text;

  for (const [name, value] of Object.entries(options.attrs ?? {})) {
    node.setAttribute(name, value);
  }
  for (const child of options.children ?? []) {
    node.appendChild(child);
  }

  return node;
}

const SVG_NS = 'http://www.w3.org/2000/svg';

/**
 * The SVG counterpart of `el`.
 *
 * SVG elements need `createElementNS`; created with `createElement` they parse,
 * append and render nothing at all, which is a failure with no error attached
 * to it. Every attribute is a string here because SVG has no property mirror.
 */
export function svg<K extends keyof SVGElementTagNameMap>(
  tag: K,
  attrs: Record<string, string> = {},
): SVGElementTagNameMap[K] {
  const node = document.createElementNS(SVG_NS, tag);
  for (const [name, value] of Object.entries(attrs)) {
    node.setAttribute(name, value);
  }
  return node;
}
