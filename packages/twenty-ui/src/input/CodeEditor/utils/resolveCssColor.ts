// SOURCING: none — pure logic, no upstream component applies. Required by the
// TU2 reskin: theme values are now `var(--ij-*)` references rather than literal
// colors, and Monaco's theme API takes hex strings only.
//
// The browser is the only correct resolver here. A custom property can nest
// (`--ij-ink` -> `--ij-gray-12`), and the register uses `oklch()` and
// `color-mix()`, which no string parser should try to evaluate. Setting the
// expression on a probe element and reading back the computed `color` hands the
// whole job to the engine and returns a plain `rgb()`.

const HEX_BYTE = (value: number) =>
  Math.max(0, Math.min(255, Math.round(value))).toString(16).padStart(2, '0');

let probe: HTMLSpanElement | undefined;

function getProbe(container: HTMLElement): HTMLSpanElement {
  if (probe === undefined || probe.parentElement !== container) {
    probe?.remove();
    probe = document.createElement('span');
    probe.style.display = 'none';
    container.appendChild(probe);
  }
  return probe;
}

/**
 * Resolve any CSS color expression to `#rrggbb` or `#rrggbbaa`.
 *
 * `container` scopes the resolution, which matters: the console's light
 * register lives on `[data-register="intui"][data-theme="light"]`, so a probe
 * mounted on `document.documentElement` would read dark values while a light
 * editor is on screen. Pass the editor's own element.
 */
export const resolveCssColor = (
  color: string,
  container?: HTMLElement | null,
): string => {
  const trimmed = color.trim();
  if (trimmed === 'transparent') return '#00000000';
  if (/^#[0-9a-fA-F]{3,8}$/.test(trimmed)) return trimmed;

  // No DOM (server render, tests): return the expression untouched rather than
  // inventing a color. Monaco is client-only, so this path never paints.
  if (typeof document === 'undefined') return trimmed;

  const host = container ?? document.body ?? document.documentElement;
  const element = getProbe(host);
  element.style.color = '';
  element.style.color = trimmed;
  if (element.style.color === '') return trimmed;

  const computed = window.getComputedStyle(element).color;
  const match = computed.match(
    /rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)(?:[,/\s]+([\d.%]+))?\s*\)/,
  );
  if (match === null) return computed || trimmed;

  const [, r, g, b, a] = match;
  const base = `#${HEX_BYTE(Number(r))}${HEX_BYTE(Number(g))}${HEX_BYTE(Number(b))}`;
  if (a === undefined) return base;
  const alpha = a.endsWith('%') ? Number(a.slice(0, -1)) / 100 : Number(a);
  if (!Number.isFinite(alpha) || alpha >= 1) return base;
  return `${base}${HEX_BYTE(alpha * 255)}`;
};
