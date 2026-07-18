export type TheoremAddress = {
  tenant: string;
  kind: string;
  id: string;
  graphVersion?: number;
  span?: string;
};

export function theoremUri(address: TheoremAddress): string {
  const base = `theorem://${encodeURIComponent(address.tenant)}/${encodeURIComponent(address.kind)}/${encodeURIComponent(address.id)}`;
  const query = address.graphVersion === undefined ? '' : `?v=${address.graphVersion}`;
  const fragment = address.span ? `#${encodeURIComponent(address.span)}` : '';
  return `${base}${query}${fragment}`;
}

export function routeForTheoremUri(path: string): string {
  if (!path.toLowerCase().startsWith('theorem:')) return path;
  try {
    const url = new URL(path);
    if (url.protocol !== 'theorem:') return path;
    const [, encodedKind, encodedId] = url.pathname.split('/');
    if (!encodedKind || !encodedId) return '/';
    const kind = decodeURIComponent(encodedKind);
    const id = decodeURIComponent(encodedId);
    if (kind === 'proposal' || kind === 'agency.proposal') return `/proposal/${encodeURIComponent(id)}`;
    if (kind === 'thread' || kind === 'chat.thread') return `/thread/${encodeURIComponent(id)}`;
    return `/object/${encodeURIComponent(id)}`;
  } catch {
    return '/';
  }
}
