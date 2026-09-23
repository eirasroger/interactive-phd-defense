interface ElementOptions {
  className?: string;
  text?: string;
  attrs?: Record<string, string>;
  /** Typed as `Element` so children can include SVG. */
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
 * SVG version of `el`. Uses `createElementNS`, since SVG made with
 * `createElement` silently renders nothing.
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
