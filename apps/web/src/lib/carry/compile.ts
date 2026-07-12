/**
 * Compile a session bundle into the existing cited packet (HANDOFF-CARRY C1.2).
 *
 * The bundle's wire shape is `evidence_bundle`'s cited packet (records + trace +
 * degraded). Anchors and connection explanations ride in each record's metadata,
 * which the tool passes through, so a carried quote stays anchored to its exact
 * source passage downstream. `bundleToRecords` is a pure mapping (unit-tested);
 * `compileBundle` sends it through the `/api/theorem/evidence-bundle` proxy and
 * falls back to a locally-assembled degraded packet when the harness is down.
 */

import type { BundleItem, SessionBundle } from './bundle-store';

/** One cited record in the compiled packet. Metadata carries the provenance. */
export interface CitedRecord {
  id: string;
  kind: string;
  content: string;
  metadata: Record<string, unknown>;
}

/** The cited packet: the existing evidence_bundle wire shape. */
export interface CitedPacket {
  records: CitedRecord[];
  trace: unknown[];
  degraded: boolean;
  sessionId?: string;
  note?: string;
}

/** The human-readable content for an item, by kind. Never bare: always tied to
 *  its anchor in metadata. */
function contentFor(item: BundleItem): string {
  switch (item.kind) {
    case 'highlight':
    case 'keep':
      return item.anchor.quote ?? item.anchor.title ?? item.anchor.url;
    case 'margin_thread':
      return (item.thread ?? []).map((m) => `${m.author}: ${m.text}`).join('\n');
    case 'page_kept':
      return item.anchor.title ?? item.anchor.url;
    case 'entity_intersect':
      return (item.entities ?? []).join(', ');
    default:
      return item.anchor.quote ?? item.anchor.url;
  }
}

/**
 * Map bundle items to cited records. Pure and deterministic: every field of
 * provenance the bundle captured (source url, title, fragment, connection
 * explanation, receipt ids, entities, thread, capture time) rides in metadata,
 * so nothing arrives downstream as bare text.
 */
export function bundleToRecords(items: BundleItem[]): CitedRecord[] {
  return items.map((item) => ({
    id: item.id,
    kind: item.kind,
    content: contentFor(item),
    metadata: {
      sourceUrl: item.anchor.url,
      sourceTitle: item.anchor.title,
      anchorQuote: item.anchor.quote,
      anchorFragment: item.anchor.fragment,
      connectionExplanation: item.connectionExplanation,
      receiptIds: item.receiptIds,
      entities: item.entities,
      thread: item.thread,
      capturedAt: item.at,
      ...(item.meta ?? {}),
    },
  }));
}

/** Assemble the packet locally from real records, marked degraded. Used as the
 *  fallback when the harness proxy is unreachable. */
function localPacket(records: CitedRecord[], sessionId: string): CitedPacket {
  return {
    records,
    trace: [],
    degraded: true,
    sessionId,
    note: 'compiled locally; evidence_bundle harness unavailable',
  };
}

/**
 * Compile the bundle through the evidence_bundle proxy. Returns the cited packet
 * with metadata intact. On any proxy failure, returns the locally-assembled
 * degraded packet (the same records, honestly flagged) so carry never blocks on
 * the harness being reachable.
 */
export async function compileBundle(
  bundle: SessionBundle,
  fetchImpl: typeof fetch = fetch,
): Promise<CitedPacket> {
  const records = bundleToRecords(bundle.items);
  try {
    const res = await fetchImpl('/api/theorem/evidence-bundle', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId: bundle.sessionId, records }),
    });
    if (!res.ok) return localPacket(records, bundle.sessionId);
    const packet = (await res.json()) as CitedPacket;
    // The proxy guarantees the packet shape; keep our records if it returned none.
    return {
      records: Array.isArray(packet.records) && packet.records.length > 0 ? packet.records : records,
      trace: Array.isArray(packet.trace) ? packet.trace : [],
      degraded: packet.degraded === true,
      sessionId: bundle.sessionId,
      note: packet.note,
    };
  } catch {
    return localPacket(records, bundle.sessionId);
  }
}
