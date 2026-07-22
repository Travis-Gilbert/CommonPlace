import type { JsonValue, ObjectRef } from '@commonplace/block-view/types';

export interface SurveyTopic {
  readonly id: string;
  readonly title: string;
  readonly description: string;
  readonly updated: string;
}

export interface MatchedSpan {
  readonly start: number;
  readonly end: number;
  readonly feature: string;
  readonly attribution: string;
}

export type SurveySourceKind = 'article' | 'code' | 'document' | 'receipt' | 'visualization';
export type SurveySourcePreviewKind = 'open_graph' | 'screenshot' | 'embedded_media';

export interface SurveyCapture {
  readonly id: string;
  readonly topicId: string;
  readonly title: string;
  readonly domain: string;
  readonly sourceUrl: string;
  readonly capturedAt: string;
  readonly kind: string;
  readonly clusterId: string;
  readonly clusterLabel: string;
  readonly excerpt: string;
  readonly contentMarkdown: string;
  readonly sourceKind: SurveySourceKind;
  readonly sourceAspectRatio: number;
  readonly sourceLines: readonly string[];
  readonly sourceSnapshotUrl?: string;
  readonly sourceSnapshotAlt?: string;
  readonly sourcePreviewKind?: SurveySourcePreviewKind;
  readonly sourcePreviewOriginUrl?: string;
  readonly sourcePreviewTitle?: string;
  readonly sourcePreviewDescription?: string;
  readonly tags: readonly string[];
  readonly matchedSpans: readonly MatchedSpan[];
  readonly mentions: readonly string[];
  readonly entities: readonly string[];
  readonly heroImage?: string;
  readonly heroImageAlt?: string;
}

export interface SurveyEdge {
  readonly id: string;
  readonly from: string;
  readonly to: string;
  readonly reason: string;
  readonly strength: number;
}

export interface SurveyCluster {
  readonly id: string;
  readonly label: string;
  readonly captures: readonly SurveyCapture[];
}

export interface SurveyModel {
  readonly topic: SurveyTopic | null;
  readonly captures: readonly SurveyCapture[];
  readonly edges: readonly SurveyEdge[];
  readonly clusters: readonly SurveyCluster[];
}

export interface ExcerptSegment {
  readonly text: string;
  readonly matched: boolean;
  readonly feature?: string;
  readonly attribution?: string;
}

export interface SurveyGalaxyNode {
  readonly capture: SurveyCapture;
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

const SOURCE_KINDS = new Set<SurveySourceKind>([
  'article',
  'code',
  'document',
  'receipt',
  'visualization',
]);
const SOURCE_PREVIEW_KINDS = new Set<SurveySourcePreviewKind>([
  'open_graph',
  'screenshot',
  'embedded_media',
]);
const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));
export const SURVEY_GALAXY_RADII = [9.5, 12.5, 15.5] as const;

function isJsonObject(value: JsonValue | undefined): value is Readonly<Record<string, JsonValue>> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function stringValue(value: JsonValue | undefined, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}

function numberValue(value: JsonValue | undefined, fallback = 0): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function stringList(value: JsonValue | undefined): readonly string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((candidate): candidate is string => typeof candidate === 'string');
}

function sourceKindValue(value: JsonValue | undefined): SurveySourceKind {
  const candidate = stringValue(value) as SurveySourceKind;
  return SOURCE_KINDS.has(candidate) ? candidate : 'article';
}

function sourcePreviewKindValue(value: JsonValue | undefined): SurveySourcePreviewKind | undefined {
  const candidate = stringValue(value) as SurveySourcePreviewKind;
  return SOURCE_PREVIEW_KINDS.has(candidate) ? candidate : undefined;
}

function normalizedSourceUrl(value: JsonValue | undefined): string {
  const candidate = stringValue(value).trim();
  if (!candidate) return '';
  try {
    const url = new URL(candidate);
    if (url.protocol !== 'https:' || url.username || url.password) return '';
    return url.href;
  } catch {
    return '';
  }
}

function normalizedHeldMediaUrl(value: JsonValue | undefined): string {
  const candidate = stringValue(value).trim();
  if (!candidate) return '';
  if (candidate.startsWith('/') && !candidate.startsWith('//')) return candidate;
  try {
    return new URL(candidate).protocol === 'blob:' ? candidate : '';
  } catch {
    return '';
  }
}

function stableHash(text: string): number {
  let hash = 5381;
  for (let index = 0; index < text.length; index += 1) {
    hash = ((hash << 5) + hash + text.charCodeAt(index)) >>> 0;
  }
  return hash;
}

export function normalizeMatchedSpans(
  excerpt: string,
  value: JsonValue | undefined,
): readonly MatchedSpan[] {
  if (!Array.isArray(value)) return [];
  const spans = value
    .flatMap((candidate): MatchedSpan[] => {
      if (!isJsonObject(candidate)) return [];
      const start = numberValue(candidate.start, -1);
      const end = numberValue(candidate.end, -1);
      if (!Number.isInteger(start) || !Number.isInteger(end)) return [];
      if (start < 0 || end <= start || end > excerpt.length) return [];
      return [{
        start,
        end,
        feature: stringValue(candidate.feature, 'relevance'),
        attribution: stringValue(candidate.attribution, 'topic relevance gate'),
      }];
    })
    .sort((left, right) => left.start - right.start || left.end - right.end);

  const nonOverlapping: MatchedSpan[] = [];
  let cursor = 0;
  for (const span of spans) {
    if (span.start < cursor) continue;
    nonOverlapping.push(span);
    cursor = span.end;
  }
  return nonOverlapping;
}

export function excerptSegments(
  excerpt: string,
  spans: readonly MatchedSpan[],
): readonly ExcerptSegment[] {
  const segments: ExcerptSegment[] = [];
  let cursor = 0;
  for (const span of spans) {
    if (span.start > cursor) {
      segments.push({ text: excerpt.slice(cursor, span.start), matched: false });
    }
    segments.push({
      text: excerpt.slice(span.start, span.end),
      matched: true,
      feature: span.feature,
      attribution: span.attribution,
    });
    cursor = span.end;
  }
  if (cursor < excerpt.length) {
    segments.push({ text: excerpt.slice(cursor), matched: false });
  }
  return segments;
}

function parseCapture(object: ObjectRef): SurveyCapture | null {
  const topicId = stringValue(object.properties.topic_id);
  const excerpt = stringValue(object.properties.excerpt);
  if (!topicId || !excerpt) return null;
  const heroImage = normalizedHeldMediaUrl(object.properties.hero_image);
  const heroImageAlt = stringValue(object.properties.hero_image_alt);
  const sourceSnapshotUrl = normalizedHeldMediaUrl(object.properties.source_snapshot_url);
  const sourceSnapshotAlt = stringValue(object.properties.source_snapshot_alt);
  const sourcePreviewKind = sourcePreviewKindValue(object.properties.source_preview_kind);
  const sourcePreviewOriginUrl = normalizedSourceUrl(object.properties.source_preview_origin_url);
  const sourcePreviewTitle = stringValue(object.properties.source_preview_title);
  const sourcePreviewDescription = stringValue(object.properties.source_preview_description);
  const sourceAspectRatio = numberValue(object.properties.source_aspect_ratio, 0.82);
  return {
    id: object.id,
    topicId,
    title: stringValue(object.properties.title, object.id),
    domain: stringValue(object.properties.domain, 'captured source'),
    sourceUrl: normalizedSourceUrl(object.properties.source_url),
    capturedAt: stringValue(object.properties.captured_at),
    kind: stringValue(object.properties.kind, 'capture'),
    clusterId: stringValue(object.properties.cluster_id, 'unclustered'),
    clusterLabel: stringValue(object.properties.cluster_label, 'Unclustered'),
    excerpt,
    contentMarkdown: stringValue(object.properties.content_markdown, excerpt),
    sourceKind: sourceKindValue(object.properties.source_kind),
    sourceAspectRatio: sourceAspectRatio > 0 ? sourceAspectRatio : 0.82,
    sourceLines: stringList(object.properties.source_lines),
    tags: stringList(object.properties.tags),
    matchedSpans: normalizeMatchedSpans(excerpt, object.properties.matched_spans),
    mentions: stringList(object.properties.mentions),
    entities: stringList(object.properties.entities),
    ...(heroImage ? { heroImage } : {}),
    ...(heroImageAlt ? { heroImageAlt } : {}),
    ...(sourceSnapshotUrl ? { sourceSnapshotUrl } : {}),
    ...(sourceSnapshotAlt ? { sourceSnapshotAlt } : {}),
    ...(sourcePreviewKind ? { sourcePreviewKind } : {}),
    ...(sourcePreviewOriginUrl ? { sourcePreviewOriginUrl } : {}),
    ...(sourcePreviewTitle ? { sourcePreviewTitle } : {}),
    ...(sourcePreviewDescription ? { sourcePreviewDescription } : {}),
  };
}

function parseEdge(object: ObjectRef): SurveyEdge | null {
  const from = stringValue(object.properties.from);
  const to = stringValue(object.properties.to);
  const reason = stringValue(object.properties.reason);
  if (!from || !to || !reason) return null;
  return {
    id: object.id,
    from,
    to,
    reason,
    strength: Math.max(0, Math.min(1, numberValue(object.properties.strength, 0))),
  };
}

export function surveyModelFromObjects(objects: readonly ObjectRef[]): SurveyModel {
  const topicObject = objects.find((object) => object.type === 'topic');
  const topicId = topicObject?.id ?? stringValue(objects[0]?.properties.topic_id);
  const topic = topicObject
    ? {
        id: topicObject.id,
        title: stringValue(topicObject.properties.title, topicObject.id),
        description: stringValue(topicObject.properties.description),
        updated: stringValue(topicObject.properties.updated),
      }
    : null;
  const captures = objects
    .filter((object) => object.type === 'capture')
    .map(parseCapture)
    .filter((capture): capture is SurveyCapture => capture !== null && (!topicId || capture.topicId === topicId))
    .sort((left, right) => left.id.localeCompare(right.id));
  const captureIds = new Set(captures.map((capture) => capture.id));
  const edges = objects
    .filter((object) => object.type === 'survey-edge')
    .map(parseEdge)
    .filter((edge): edge is SurveyEdge => (
      edge !== null && captureIds.has(edge.from) && captureIds.has(edge.to)
    ));
  const clusterMap = new Map<string, SurveyCapture[]>();
  for (const capture of captures) {
    const cluster = clusterMap.get(capture.clusterId) ?? [];
    cluster.push(capture);
    clusterMap.set(capture.clusterId, cluster);
  }
  const clusters = [...clusterMap.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([id, grouped]) => ({ id, label: grouped[0]?.clusterLabel ?? id, captures: grouped }));
  return { topic, captures, edges, clusters };
}

export function budgetSurveyEdges(
  edges: readonly SurveyEdge[],
  strongestPerCapture = 2,
): readonly SurveyEdge[] {
  const count = new Map<string, number>();
  const selected: SurveyEdge[] = [];
  const ordered = [...edges].sort((left, right) => right.strength - left.strength || left.id.localeCompare(right.id));
  for (const edge of ordered) {
    if ((count.get(edge.from) ?? 0) >= strongestPerCapture) continue;
    if ((count.get(edge.to) ?? 0) >= strongestPerCapture) continue;
    selected.push(edge);
    count.set(edge.from, (count.get(edge.from) ?? 0) + 1);
    count.set(edge.to, (count.get(edge.to) ?? 0) + 1);
  }
  return selected;
}

export function layoutSurveyGalaxy(clusters: readonly SurveyCluster[]): readonly SurveyGalaxyNode[] {
  const captures = clusters.flatMap((cluster) => cluster.captures);
  const clusterIndex = new Map(clusters.map((cluster, index) => [cluster.id, index]));
  const denominator = Math.max(1, captures.length - 1);
  return captures.map((capture, index) => {
    const normalizedY = 1 - (index / denominator) * 2;
    const radiusAtY = Math.sqrt(Math.max(0, 1 - normalizedY * normalizedY));
    const phase = (stableHash(capture.clusterId) % 31) * 0.01;
    const theta = index * GOLDEN_ANGLE + phase;
    const radius = SURVEY_GALAXY_RADII[(clusterIndex.get(capture.clusterId) ?? 0) % SURVEY_GALAXY_RADII.length];
    return {
      capture,
      x: Math.cos(theta) * radiusAtY * radius,
      y: normalizedY * radius,
      z: Math.sin(theta) * radiusAtY * radius,
    };
  });
}
