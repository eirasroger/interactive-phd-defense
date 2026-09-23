import './split-lines.css';

/**
 * Splits text into its rendered lines, each wrapped in a mask span, so lines
 * can be revealed one by one. Each word's `offsetTop` gives its line.
 *
 * The host must be in the document and laid out (see `measure()` in callers).
 * Re-run the split if a webfont loads later and rewraps the text. With no
 * layout, all words report 0 and the text comes back as one line.
 */
export function splitLines(host: HTMLElement, text: string): HTMLElement[] {
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length === 0) return [];

  host.textContent = '';
  const probes = words.map((word) => {
    const probe = document.createElement('span');
    probe.className = 'split-probe';
    probe.textContent = word;
    host.appendChild(probe);
    host.appendChild(document.createTextNode(' '));
    return probe;
  });

  // Map insertion order is reading order.
  const rows = new Map<number, string[]>();
  probes.forEach((probe, index) => {
    const top = Math.round(probe.offsetTop);
    const row = rows.get(top);
    if (row) row.push(words[index] ?? '');
    else rows.set(top, [words[index] ?? '']);
  });

  host.textContent = '';
  return [...rows.values()].map((line) => {
    const mask = document.createElement('span');
    mask.className = 'split-line';
    const inner = document.createElement('span');
    inner.className = 'split-inner';
    inner.textContent = line.join(' ');
    mask.appendChild(inner);
    host.appendChild(mask);
    return inner;
  });
}
