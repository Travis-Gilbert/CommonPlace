// Node-type icon registry (the "Capacities" idea): every graph node carries an
// icon for its TYPE, drawn inside the node. One registry, consumed by all graph
// views -- Ego injects the markup into SVG, Models renders <NodeTypeIcon>, and
// Network (cosmos) will rasterize it to a point image.
//
// Values are inner SVG markup for a 24x24 viewBox, drawn with currentColor so a
// single glyph reads light-on-node or dark-on-surface depending on where it's
// placed. These are placeholder line glyphs -- swap each value for the inner
// markup of a Noun Project SVG (keep the 24x24 box; set fill/stroke as needed)
// and every view updates at once.

const ICONS: Record<string, string> = {
  file: '<rect x="5" y="3" width="14" height="18" rx="2"/><line x1="8.5" y1="8" x2="15.5" y2="8"/><line x1="8.5" y1="12" x2="15.5" y2="12"/><line x1="8.5" y1="16" x2="13" y2="16"/>',
  note: '<rect x="4" y="4" width="16" height="16" rx="2"/><line x1="8" y1="9" x2="16" y2="9"/><line x1="8" y1="13" x2="14" y2="13"/>',
  task: '<rect x="4" y="4" width="16" height="16" rx="3"/><path d="M8 12.5l2.5 2.5 5-5.5"/>',
  clip: '<circle cx="8" cy="8" r="3"/><circle cx="16" cy="16" r="3"/><line x1="10.2" y1="10.2" x2="13.8" y2="13.8"/>',
  artifact: '<path d="M12 3l8 4.5v9L12 21l-8-4.5v-9z"/><path d="M12 12v9M4 7.5l8 4.5 8-4.5"/>',
  collection: '<path d="M4 8a2 2 0 0 1 2-2h3.5l2 2H18a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z"/>',
  image: '<rect x="4" y="4" width="16" height="16" rx="2"/><circle cx="9" cy="9" r="1.6"/><path d="M4.5 16.5l4-4 3.5 3.5 3-3 4.5 4.5"/>',
  event: '<rect x="4" y="5" width="16" height="15" rx="2"/><line x1="4" y1="9.5" x2="20" y2="9.5"/><line x1="8.5" y1="3" x2="8.5" y2="6.5"/><line x1="15.5" y1="3" x2="15.5" y2="6.5"/>',
  place: '<path d="M12 21s6.5-5.2 6.5-10.5a6.5 6.5 0 1 0-13 0C5.5 15.8 12 21 12 21z"/><circle cx="12" cy="10.5" r="2.4"/>',
  person: '<circle cx="12" cy="8" r="3.5"/><path d="M5.5 20a6.5 6.5 0 0 1 13 0"/>',
  project: '<path d="M4 6h16v12H4z"/><path d="M4 9.5h16M9 6v12"/>',
  record: '<ellipse cx="12" cy="6" rx="7" ry="2.6"/><path d="M5 6v12c0 1.4 3.1 2.6 7 2.6s7-1.2 7-2.6V6"/><path d="M5 12c0 1.4 3.1 2.6 7 2.6s7-1.2 7-2.6"/>',
  default: '<circle cx="12" cy="12" r="4"/>',
};

// file-ish and clip-ish families map onto one glyph.
const ALIASES: Record<string, keyof typeof ICONS | string> = {
  doc: 'file',
  link: 'clip',
  web_capture: 'clip',
  media: 'clip',
  thread: 'note',
  schema: 'record',
  node: 'default',
  edge: 'default',
  cluster: 'collection',
};

export function nodeIconMarkup(type: string | undefined): string {
  if (!type) return ICONS.default;
  const t = type.toLowerCase();
  if (ICONS[t]) return ICONS[t];
  if (ALIASES[t] && ICONS[ALIASES[t]]) return ICONS[ALIASES[t]];
  const base = t.split(/[_:-]/)[0];
  return ICONS[base] ?? (ALIASES[base] ? ICONS[ALIASES[base]] : undefined) ?? ICONS.default;
}

export function NodeTypeIcon({
  type,
  size = 16,
  className,
}: {
  type: string | undefined;
  size?: number;
  className?: string;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
      dangerouslySetInnerHTML={{ __html: nodeIconMarkup(type) }}
    />
  );
}
