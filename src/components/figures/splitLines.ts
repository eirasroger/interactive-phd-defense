import './split-lines.css';

/**
 * Splits a block of text into its rendered lines, each in its own mask.
 *
 * **Why the whole apparatus, for a title.** A statement that translates up as
 * one block reads as a div moving. The same statement arriving line by line
 * reads as typesetting, and it is most of the difference between a composition
 * that looks made and one that looks rendered. There is no way to address a
 * rendered line in CSS, so the lines have to be found and wrapped.
 *
 * **Measured, not guessed.** Words go in as probes, their `offsetTop` says which
 * line each landed on, and the block is rebuilt one masked span per line. That
 * means the host must already be in the document and laid out when this runs —
 * see `measure()` on the components that use it — and it means the split has to
 * be redone if the webfont resolves afterwards and rewraps the text.
 *
 * Degrades honestly: with no layout to read, every probe reports `offsetTop` 0,
 * the whole statement comes back as a single line, and the reveal is the block
 * move it would have been anyway.
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

  // Insertion order follows the first word of each line, which is reading order.
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
