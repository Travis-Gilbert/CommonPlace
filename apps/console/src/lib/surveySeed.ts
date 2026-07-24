// SOURCING: @commonplace/block-view ObjectRef fixtures. This is an explicit
// demonstration corpus derived from committed CommonPlace sources plus one
// Observable Plot reference. It proves excerpts, persisted matched spans,
// provenance, source-shaped reconstructions, and evidence edges without
// presenting live harvested results. One capture carries a held copy of the
// source-authored GitHub Open Graph preview to prove the ingestion contract.

import type { JsonValue, ObjectRef } from '@commonplace/block-view/types';

export const SURVEY_TOPIC_ID = 'topic-evidence-research-surfaces';

interface CaptureSeed {
  readonly id: string;
  readonly title: string;
  readonly domain: string;
  readonly sourceUrl: string;
  readonly capturedAt: string;
  readonly kind: string;
  readonly sourceKind: 'article' | 'code' | 'document' | 'receipt' | 'visualization';
  readonly sourceAspectRatio: number;
  readonly sourceSnapshotUrl?: string;
  readonly sourceSnapshotAlt?: string;
  readonly sourcePreviewKind?: 'open_graph' | 'screenshot' | 'embedded_media';
  readonly sourcePreviewOriginUrl?: string;
  readonly sourcePreviewTitle?: string;
  readonly sourcePreviewDescription?: string;
  readonly sourceLines: readonly string[];
  readonly tags: readonly string[];
  readonly clusterId: string;
  readonly clusterLabel: string;
  readonly excerpt: string;
  readonly matches: readonly { readonly text: string; readonly feature: string }[];
  readonly entities: readonly string[];
  readonly mentions: readonly string[];
  readonly contentMarkdown: string;
}

interface HeldSourcePreview {
  readonly url: string;
  readonly alt: string;
  readonly kind: 'open_graph' | 'screenshot' | 'embedded_media';
  readonly aspectRatio: number;
  readonly originUrl?: string;
  readonly title?: string;
  readonly description?: string;
}

const HELD_SOURCE_PREVIEWS: Readonly<Record<string, HeldSourcePreview>> = {
  'capture-survey-brief': {
    url: '/survey/github-commonplace-survey-commit-og.png',
    alt: 'GitHub preview for the CommonPlace Survey design commit',
    kind: 'open_graph',
    aspectRatio: 2,
    originUrl: 'https://opengraph.githubassets.com/44e67fe9343a846ce2f6e6c446ee05067603857d703ec06b568c04092d9772c0/Travis-Gilbert/CommonPlace/commit/b66beba0bf58b6c93d599748edba3f3c799765b1',
    title: 'docs(console): DESIGN-SURVEY-SURFACE - the research surface; a topic opens as a Survey',
    description: 'The research surface; a topic opens as a Survey.',
  },
  'capture-margin-recall': {
    url: '/survey/source-previews/github-margin-recall.png',
    alt: 'GitHub source page for the Margin Recall plan',
    kind: 'screenshot',
    aspectRatio: 1.5,
  },
  'capture-topic-gate': {
    url: '/survey/source-previews/github-commonplace-repository.png',
    alt: 'GitHub repository page for CommonPlace',
    kind: 'screenshot',
    aspectRatio: 1.5,
  },
  'capture-block-view': {
    url: '/survey/source-previews/github-block-view-types.png',
    alt: 'GitHub source page for the Block View types',
    kind: 'screenshot',
    aspectRatio: 1.5,
  },
  'capture-intui': {
    url: '/survey/source-previews/github-int-ui-register.png',
    alt: 'GitHub source page for the Int UI register',
    kind: 'screenshot',
    aspectRatio: 1.5,
  },
  'capture-galley': {
    url: '/survey/source-previews/github-galley-doc-view.png',
    alt: 'GitHub source page for the Galley document view',
    kind: 'screenshot',
    aspectRatio: 1.5,
  },
  'capture-evidence-edges': {
    url: '/survey/source-previews/github-survey-spec.png',
    alt: 'GitHub source page for the Survey design specification',
    kind: 'screenshot',
    aspectRatio: 1.5,
  },
  'capture-observable': {
    url: '/survey/source-previews/observable-plot-og.jpg',
    alt: 'Observable Plot source-authored preview',
    kind: 'open_graph',
    aspectRatio: 1.6,
    originUrl: 'https://static.observableusercontent.com/thumbnail/64f414fef8a91248865f5759641b0cf537bc87c0aaf57dc368ffe673013eccaa.jpg',
    title: 'Observable Plot',
    description: 'The JavaScript library for exploratory data visualization.',
  },
  'capture-reduced-motion': {
    url: '/survey/source-previews/github-motion-tokens.png',
    alt: 'GitHub source page for the Console motion tokens',
    kind: 'screenshot',
    aspectRatio: 1.5,
  },
  'capture-link-ingest': {
    url: '/survey/source-previews/github-link-ingest.png',
    alt: 'GitHub source page for CommonPlace link ingestion',
    kind: 'screenshot',
    aspectRatio: 1.5,
  },
  'capture-preview-receipt': {
    url: '/survey/source-previews/github-survey-spec.png',
    alt: 'GitHub source page for the Survey preview receipt contract',
    kind: 'screenshot',
    aspectRatio: 1.5,
  },
  'capture-survey-contract': {
    url: '/survey/source-previews/github-console-host.png',
    alt: 'GitHub source page for the Console object host',
    kind: 'screenshot',
    aspectRatio: 1.5,
  },
  'capture-stellar-gallery': {
    url: '/survey/source-previews/21st-3d-image-gallery-og.png',
    alt: '21st.dev source-authored preview for the 3D Image Gallery',
    kind: 'open_graph',
    aspectRatio: 2,
    originUrl: 'https://21st.dev/api/og/component/moazamtrade/3d-image-gallery',
    title: '3D Image Gallery',
    description: 'The installed 21st.dev spatial gallery component.',
  },
  'capture-object-metadata': {
    url: '/survey/source-previews/github-api-schema.png',
    alt: 'GitHub source page for the CommonPlace API schema',
    kind: 'screenshot',
    aspectRatio: 1.5,
  },
  'capture-commonplace-readme': {
    url: '/survey/source-previews/github-commonplace-repository.png',
    alt: 'GitHub repository page for CommonPlace',
    kind: 'screenshot',
    aspectRatio: 1.5,
  },
};

function matchedSpans(
  excerpt: string,
  matches: CaptureSeed['matches'],
): JsonValue {
  return matches.flatMap(({ text, feature }) => {
    const start = excerpt.indexOf(text);
    if (start < 0) return [];
    return [{
      start,
      end: start + text.length,
      feature,
      attribution: 'topic relevance gate',
    }];
  }) as JsonValue;
}

function capture(seed: CaptureSeed): ObjectRef {
  const preview = HELD_SOURCE_PREVIEWS[seed.id];
  const sourceSnapshotUrl = preview?.url ?? seed.sourceSnapshotUrl;
  const sourceSnapshotAlt = preview?.alt ?? seed.sourceSnapshotAlt;
  const sourcePreviewKind = preview?.kind ?? seed.sourcePreviewKind;
  const sourcePreviewOriginUrl = preview?.originUrl
    ?? (preview?.kind === 'screenshot' ? seed.sourceUrl : seed.sourcePreviewOriginUrl);
  const sourcePreviewTitle = preview?.title ?? seed.sourcePreviewTitle;
  const sourcePreviewDescription = preview?.description ?? seed.sourcePreviewDescription;
  return {
    id: seed.id,
    type: 'capture',
    properties: {
      topic_id: SURVEY_TOPIC_ID,
      title: seed.title,
      domain: seed.domain,
      source_url: seed.sourceUrl,
      captured_at: seed.capturedAt,
      kind: seed.kind,
      source_kind: seed.sourceKind,
      source_aspect_ratio: preview?.aspectRatio ?? seed.sourceAspectRatio,
      ...(sourceSnapshotUrl ? { source_snapshot_url: sourceSnapshotUrl } : {}),
      ...(sourceSnapshotAlt ? { source_snapshot_alt: sourceSnapshotAlt } : {}),
      ...(sourcePreviewKind ? { source_preview_kind: sourcePreviewKind } : {}),
      ...(sourcePreviewOriginUrl ? { source_preview_origin_url: sourcePreviewOriginUrl } : {}),
      ...(sourcePreviewTitle ? { source_preview_title: sourcePreviewTitle } : {}),
      ...(sourcePreviewDescription ? { source_preview_description: sourcePreviewDescription } : {}),
      source_lines: seed.sourceLines,
      tags: seed.tags,
      cluster_id: seed.clusterId,
      cluster_label: seed.clusterLabel,
      excerpt: seed.excerpt,
      matched_spans: matchedSpans(seed.excerpt, seed.matches),
      entities: seed.entities,
      mentions: seed.mentions,
      content_markdown: seed.contentMarkdown,
    },
  };
}

const CAPTURES: readonly ObjectRef[] = [
  capture({
    id: 'capture-survey-brief',
    title: 'The Survey makes the research image the product',
    domain: 'github.com',
    sourceUrl: 'https://github.com/Travis-Gilbert/CommonPlace/commit/b66beba0bf58b6c93d599748edba3f3c799765b1',
    capturedAt: '2026-07-17',
    kind: 'design brief',
    sourceKind: 'document',
    sourceAspectRatio: 2,
    sourceLines: [
      '# DESIGN-SURVEY-SURFACE',
      'The research surface: how a standing topic harvest opens.',
      'The Survey makes the research image the product.',
    ],
    tags: ['survey', 'product thesis'],
    clusterId: '01-salience',
    clusterLabel: 'Salience and scope',
    excerpt: 'The excerpt is scoped to why it was captured. The topic relevance gate knows which spans matched, and those spans render highlighted in the learned gold register.',
    matches: [
      { text: 'scoped to why it was captured', feature: 'semantic scope' },
      { text: 'spans matched', feature: 'persisted salience' },
    ],
    entities: ['Survey', 'relevance gate', 'matched spans'],
    mentions: ['@standing-topics', '@margin-recall'],
    contentMarkdown: '# The Survey\n\nThe excerpt is scoped to why it was captured. The topic relevance gate knows which spans matched. Those spans render highlighted in the learned gold register.\n\nEvery connection carries a worded reason so the board shows its evidence.',
  }),
  capture({
    id: 'capture-margin-recall',
    title: 'Margin recall supplies expanded highlights',
    domain: 'github.com',
    sourceUrl: 'https://github.com/Travis-Gilbert/CommonPlace/tree/main/docs/plans/handoff-margin-recall',
    capturedAt: '2026-07-13',
    kind: 'implementation plan',
    sourceKind: 'document',
    sourceAspectRatio: 0.86,
    sourceLines: [
      '# HANDOFF-MARGIN-RECALL',
      'Expanded highlights, keeps, and annotations.',
      'Selection is budgeted and carried with source evidence.',
    ],
    tags: ['margin recall', 'salience'],
    clusterId: '01-salience',
    clusterLabel: 'Salience and scope',
    excerpt: 'Margin recall is the upstream producer of expanded highlights, keeps, and annotations. Selection is budgeted, placed, and carried with its source evidence.',
    matches: [
      { text: 'expanded highlights', feature: 'highlight source' },
      { text: 'source evidence', feature: 'provenance' },
    ],
    entities: ['margin recall', 'highlight', 'source evidence'],
    mentions: ['@survey', '@recall'],
    contentMarkdown: '# Margin recall\n\nMargin recall supplies the expanded highlights and source evidence that a Survey can carry into its clipping cards. The source selection stays budgeted and attributable.',
  }),
  capture({
    id: 'capture-topic-gate',
    title: 'The relevance gate persists its explanation',
    domain: 'github.com',
    sourceUrl: 'https://github.com/Travis-Gilbert/CommonPlace',
    capturedAt: '2026-07-15',
    kind: 'topic receipt',
    sourceKind: 'receipt',
    sourceAspectRatio: 1.15,
    sourceLines: [
      'topic: evidence research surfaces',
      'matched_span: feature attribution',
      'confidence: persisted',
      'source_ref: retained',
    ],
    tags: ['Data Wave', 'topic gate'],
    clusterId: '01-salience',
    clusterLabel: 'Salience and scope',
    excerpt: 'A standing topic keeps the matched span, feature attribution, confidence, and source reference together at capture time. Reconstruction does not guess later.',
    matches: [
      { text: 'feature attribution', feature: 'explanation' },
      { text: 'does not guess later', feature: 'reconstruction safety' },
    ],
    entities: ['standing topic', 'feature attribution', 'capture'],
    mentions: ['@topic-gate', '@provenance'],
    contentMarkdown: '# Topic gate receipt\n\nThe persisted record keeps matched spans and feature attribution beside the source reference. The Survey reads that receipt directly and never reconstructs salience from a title alone.',
  }),
  capture({
    id: 'capture-block-view',
    title: 'A surface is arrangement data',
    domain: 'github.com',
    sourceUrl: 'https://github.com/Travis-Gilbert/CommonPlace/blob/main/packages/block-view/src/types.ts',
    capturedAt: '2026-07-12',
    kind: 'source code',
    sourceKind: 'code',
    sourceAspectRatio: 1.48,
    sourceLines: [
      'export interface ViewDescriptor {',
      '  readonly id: string;',
      '  readonly accepts: ViewAcceptance;',
      '  readonly render: ViewRenderer;',
      '}',
    ],
    tags: ['TypeScript', 'block view'],
    clusterId: '02-composition',
    clusterLabel: 'Surface composition',
    excerpt: 'Every pane is a view instance resolved by descriptor over an ObjectQuery against a BlockHost. The arrangement is an object, not component state.',
    matches: [
      { text: 'view instance resolved by descriptor', feature: 'descriptor seam' },
      { text: 'arrangement is an object', feature: 'surface persistence' },
    ],
    entities: ['ViewDescriptor', 'ObjectQuery', 'BlockHost'],
    mentions: ['@block-view', '@console'],
    contentMarkdown: '# Block view contract\n\nEvery pane is resolved by descriptor over an ObjectQuery. The shell persists arrangement objects, so a Survey lands as a registered view rather than a new page path.',
  }),
  capture({
    id: 'capture-intui',
    title: 'One material system around content',
    domain: 'github.com',
    sourceUrl: 'https://github.com/Travis-Gilbert/CommonPlace/blob/main/apps/console/src/styles/int-ui-register.css',
    capturedAt: '2026-07-11',
    kind: 'design register',
    sourceKind: 'code',
    sourceAspectRatio: 1.42,
    sourceLines: [
      '// Int UI register tokens consumed as var references',
      'background: var(--ij-frame);',
      'color: var(--ij-gold);',
      'border-color: var(--ij-divider);',
    ],
    tags: ['Int UI', 'design system'],
    clusterId: '02-composition',
    clusterLabel: 'Surface composition',
    excerpt: 'Canvas ground and chrome stay in the Int UI register. Source material remains content, while gold is reserved for learned judgments and matched spans.',
    matches: [
      { text: 'Int UI register', feature: 'material source' },
      { text: 'gold is reserved', feature: 'accent grammar' },
    ],
    entities: ['Int UI', 'learned gold', 'content register'],
    mentions: ['@design-register', '@survey'],
    contentMarkdown: '# Register discipline\n\nThe canvas ground and chrome stay in Int UI. Clippings remain source material. Gold appears only where the system learned or matched something.',
  }),
  capture({
    id: 'capture-galley',
    title: 'Open captures read as documents',
    domain: 'github.com',
    sourceUrl: 'https://github.com/Travis-Gilbert/CommonPlace/blob/main/apps/console/src/views/GalleyDocView.tsx',
    capturedAt: '2026-07-10',
    kind: 'renderer note',
    sourceKind: 'code',
    sourceAspectRatio: 1.32,
    sourceLines: [
      '<Galley',
      '  doc={document.body}',
      '  template="article"',
      '  className="galley--bare"',
      '/>',
    ],
    tags: ['Galley', 'reading view'],
    clusterId: '02-composition',
    clusterLabel: 'Surface composition',
    excerpt: 'Documents render through Galley, mounted bare inside the editor well. The host owns geometry while the document keeps its publication voice.',
    matches: [
      { text: 'render through Galley', feature: 'reading renderer' },
      { text: 'publication voice', feature: 'document fidelity' },
    ],
    entities: ['Galley', 'document', 'editor well'],
    mentions: ['@galley', '@reading-view'],
    contentMarkdown: '# Reading view\n\nOpening a clipping graduates it from a miniature into a full Galley document. Provenance, mentions, and action context remain beside the source.',
  }),
  capture({
    id: 'capture-evidence-edges',
    title: 'Connections are claims with reasons',
    domain: 'github.com',
    sourceUrl: 'https://github.com/Travis-Gilbert/CommonPlace/blob/main/docs/plans/console/12-DESIGN-SURVEY-SURFACE.md',
    capturedAt: '2026-07-16',
    kind: 'graph evidence',
    sourceKind: 'document',
    sourceAspectRatio: 0.74,
    sourceLines: [
      '## Evidenced connections',
      'Every edge carries a worded reason.',
      'Density is budgeted to the strongest local evidence.',
    ],
    tags: ['evidence edge', 'graph'],
    clusterId: '03-evidence',
    clusterLabel: 'Evidence and overview',
    excerpt: 'Every edge between clippings carries a worded reason such as shared entities, citation, same author, or temporal adjacency. Density is budgeted.',
    matches: [
      { text: 'worded reason', feature: 'edge evidence' },
      { text: 'Density is budgeted', feature: 'readability budget' },
    ],
    entities: ['evidence edge', 'shared entity', 'density budget'],
    mentions: ['@graph', '@provenance'],
    contentMarkdown: '# Evidenced connections\n\nThe Survey does not draw unexplained lines. Every connection has a reason, and the renderer limits each clipping to its strongest local evidence.',
  }),
  capture({
    id: 'capture-observable',
    title: 'The harvest explains itself at a glance',
    domain: 'observablehq.com',
    sourceUrl: 'https://observablehq.com/plot/',
    capturedAt: '2026-07-17',
    kind: 'visualization note',
    sourceKind: 'visualization',
    sourceAspectRatio: 1.5,
    sourceLines: [
      'Observable Plot',
      'Kinds over time',
      'Direct labels',
      'Source distribution',
    ],
    tags: ['Observable Plot', 'summary'],
    clusterId: '03-evidence',
    clusterLabel: 'Evidence and overview',
    excerpt: 'A directly labeled harvest summary counts capture kinds and keeps top entities and source distribution visible without asking color alone to carry meaning.',
    matches: [
      { text: 'directly labeled', feature: 'accessible visualization' },
      { text: 'without asking color alone', feature: 'palette safety' },
    ],
    entities: ['Observable Plot', 'summary', 'direct labels'],
    mentions: ['@survey', '@data-visualization'],
    contentMarkdown: '# Harvest summary\n\nThe summary uses direct labels and a single learned-register series. Kind counts, top entities, and source distribution answer what the harvest contains in one glance.',
  }),
  capture({
    id: 'capture-reduced-motion',
    title: 'Depth is optional, information is not',
    domain: 'github.com',
    sourceUrl: 'https://github.com/Travis-Gilbert/CommonPlace/blob/main/apps/console/src/motion/motion-tokens.ts',
    capturedAt: '2026-07-14',
    kind: 'accessibility contract',
    sourceKind: 'code',
    sourceAspectRatio: 1.4,
    sourceLines: [
      'const reduced = media || preview;',
      'if (reduced) {',
      '  return settledFlatLayout;',
      '}',
    ],
    tags: ['accessibility', 'reduced motion'],
    clusterId: '03-evidence',
    clusterLabel: 'Evidence and overview',
    excerpt: 'Reduced motion renders the same clippings, highlights, clusters, and reasons in a settled flat grid. Only perspective and lift disappear.',
    matches: [
      { text: 'settled flat grid', feature: 'reduced motion' },
      { text: 'Only perspective and lift disappear', feature: 'information parity' },
    ],
    entities: ['reduced motion', 'flat grid', 'information parity'],
    mentions: ['@accessibility', '@motion-register'],
    contentMarkdown: '# Reduced motion\n\nThe flat grid is not a lesser information product. It preserves clipping content, matched spans, cluster grouping, and evidence reasons while removing depth and lift.',
  }),
  capture({
    id: 'capture-link-ingest',
    title: 'Link ingestion keeps source and extraction together',
    domain: 'github.com',
    sourceUrl: 'https://github.com/Travis-Gilbert/CommonPlace/blob/main/crates/commonplace/src/ingest.rs',
    capturedAt: '2026-07-17',
    kind: 'source code',
    sourceKind: 'code',
    sourceAspectRatio: 1.54,
    sourceLines: [
      'IngestBody::Link { url, text }',
      'extract(url, text)',
      'metadata: extraction.receipt',
      'source_ref: retained',
    ],
    tags: ['ingestion', 'provenance'],
    clusterId: '01-salience',
    clusterLabel: 'Salience and scope',
    excerpt: 'Link ingestion preserves the canonical URL beside extraction metadata and source text. Preview discovery remains provenance instead of becoming client-only decoration.',
    matches: [
      { text: 'canonical URL', feature: 'source identity' },
      { text: 'Preview discovery remains provenance', feature: 'preview receipt' },
    ],
    entities: ['IngestBody', 'canonical URL', 'extraction metadata'],
    mentions: ['@ingestion', '@preview-hold'],
    contentMarkdown: '# Link ingest\n\nA link capture retains its canonical source reference and the extraction receipt. Preview discovery belongs to that receipt, not to a later browser-only fetch.',
  }),
  capture({
    id: 'capture-preview-receipt',
    title: 'Preview media is held with its discovery receipt',
    domain: 'github.com',
    sourceUrl: 'https://github.com/Travis-Gilbert/CommonPlace/blob/main/docs/plans/console/12-DESIGN-SURVEY-SURFACE.md',
    capturedAt: '2026-07-17',
    kind: 'ingestion receipt',
    sourceKind: 'receipt',
    sourceAspectRatio: 1.18,
    sourceLines: [
      'preview_kind: open_graph',
      'origin_url: retained',
      'held_blob: content addressed',
      'render_url: same origin',
    ],
    tags: ['Open Graph', 'held media'],
    clusterId: '01-salience',
    clusterLabel: 'Salience and scope',
    excerpt: 'The preview receipt distinguishes the source-authored Open Graph URL from the held render asset. The browser receives the held asset and the origin remains attributable.',
    matches: [
      { text: 'source-authored Open Graph URL', feature: 'source preview' },
      { text: 'held render asset', feature: 'stable media' },
    ],
    entities: ['Open Graph', 'held asset', 'preview receipt'],
    mentions: ['@provenance', '@blob-store'],
    contentMarkdown: '# Preview receipt\n\nThe receipt names the preview kind, its discovery URL, and the held blob used for rendering. This keeps source authorship and system custody distinct.',
  }),
  capture({
    id: 'capture-survey-contract',
    title: 'The Console host keeps Survey objects behind one query',
    domain: 'github.com',
    sourceUrl: 'https://github.com/Travis-Gilbert/CommonPlace/blob/main/apps/console/src/lib/console-host.ts',
    capturedAt: '2026-07-17',
    kind: 'source code',
    sourceKind: 'code',
    sourceAspectRatio: 1.64,
    sourceLines: [
      'class ConsoleBlockHost implements BlockHost {',
      '  resolve(query: ObjectQuery)',
      '  return topicScopedObjects;',
      '}',
    ],
    tags: ['media safety', 'Survey contract'],
    clusterId: '02-composition',
    clusterLabel: 'Surface composition',
    excerpt: 'The Console host serves a topic and its captures through one ObjectQuery. Preview provenance and held media remain properties on the same evidence-bearing objects.',
    matches: [
      { text: 'through one ObjectQuery', feature: 'host contract' },
      { text: 'same evidence-bearing objects', feature: 'provenance cohesion' },
    ],
    entities: ['ConsoleBlockHost', 'ObjectQuery', 'held media'],
    mentions: ['@console-host', '@survey'],
    contentMarkdown: '# Console object host\n\nThe Survey resolves one topic-scoped ObjectQuery. Captures carry source preview provenance and held render assets as object properties.',
  }),
  capture({
    id: 'capture-stellar-gallery',
    title: 'The installed gallery owns the spatial composition',
    domain: '21st.dev',
    sourceUrl: 'https://21st.dev/moazamtrade/3d-image-gallery/default',
    capturedAt: '2026-07-17',
    kind: 'component source',
    sourceKind: 'code',
    sourceAspectRatio: 1.46,
    sourceLines: [
      '<CardProvider>',
      '  <StarfieldBackground />',
      '  <CardGalaxy />',
      '  <OrbitControls />',
      '</CardProvider>',
    ],
    tags: ['21st.dev', '3D gallery'],
    clusterId: '02-composition',
    clusterLabel: 'Surface composition',
    excerpt: 'The installed 21st.dev gallery supplies the starfield baseline, golden-ratio placement, and camera controls. Indexer keeps the spatial composition while replacing the demo ground with a quiet pegboard.',
    matches: [
      { text: 'supplies the starfield baseline', feature: 'component baseline' },
      { text: 'replacing the demo ground', feature: 'CommonPlace adapter' },
    ],
    entities: ['CardGalaxy', 'OrbitControls', '21st.dev'],
    mentions: ['@spatial-ui', '@survey'],
    contentMarkdown: '# 3D Image Gallery\n\nThe installed component remains the scene baseline. The Survey supplies capture data, source rendering, evidence edges, accessibility fallback, and Int UI material.',
  }),
  capture({
    id: 'capture-object-metadata',
    title: 'Object metadata carries preview provenance end to end',
    domain: 'github.com',
    sourceUrl: 'https://github.com/Travis-Gilbert/CommonPlace/blob/main/apps/commonplace-api/src/schema.rs',
    capturedAt: '2026-07-17',
    kind: 'schema note',
    sourceKind: 'document',
    sourceAspectRatio: 0.84,
    sourceLines: [
      'ItemGql.extra',
      'source_preview_kind',
      'source_preview_origin_url',
      'source_snapshot_url',
    ],
    tags: ['object metadata', 'GraphQL'],
    clusterId: '03-evidence',
    clusterLabel: 'Evidence and overview',
    excerpt: 'Capture preview fields travel as object metadata beside the source reference. The Survey reads held media and origin provenance from one evidence-bearing object.',
    matches: [
      { text: 'object metadata', feature: 'projection seam' },
      { text: 'one evidence-bearing object', feature: 'provenance cohesion' },
    ],
    entities: ['ItemGql', 'ObjectRef', 'preview provenance'],
    mentions: ['@graphql', '@object-store'],
    contentMarkdown: '# Object metadata\n\nThe object projection carries the source URL, preview discovery, held asset URL, and capture annotations together so the renderer does not re-scrape the page.',
  }),
  capture({
    id: 'capture-commonplace-readme',
    title: 'CommonPlace keeps research surfaces object backed',
    domain: 'github.com',
    sourceUrl: 'https://github.com/Travis-Gilbert/CommonPlace',
    capturedAt: '2026-07-16',
    kind: 'repository overview',
    sourceKind: 'article',
    sourceAspectRatio: 1.08,
    sourceLines: [
      'CommonPlace',
      'Object-backed research surfaces',
      'Evidence remains attributable',
      'Views compose over shared data',
    ],
    tags: ['CommonPlace', 'research surface'],
    clusterId: '03-evidence',
    clusterLabel: 'Evidence and overview',
    excerpt: 'CommonPlace treats the Survey as a view over captured objects rather than a presentation-only gallery. Source previews, tags, matched spans, and connections remain queryable data.',
    matches: [
      { text: 'view over captured objects', feature: 'surface architecture' },
      { text: 'remain queryable data', feature: 'evidence persistence' },
    ],
    entities: ['CommonPlace', 'Survey', 'captured objects'],
    mentions: ['@repository', '@research-surface'],
    contentMarkdown: '# CommonPlace\n\nThe Survey is an object-backed research surface. Its spatial presentation can change without losing the captures, source previews, annotations, or evidenced relationships underneath it.',
  }),
];

function edge(
  id: string,
  from: string,
  to: string,
  reason: string,
  strength: number,
): ObjectRef {
  return {
    id,
    type: 'survey-edge',
    properties: { topic_id: SURVEY_TOPIC_ID, from, to, reason, strength },
  };
}

const EDGES: readonly ObjectRef[] = [
  edge('edge-survey-margin', 'capture-survey-brief', 'capture-margin-recall', 'Highlight source supplies the scoped spans', 0.96),
  edge('edge-survey-topic', 'capture-survey-brief', 'capture-topic-gate', 'Shared relevance gate requirement', 0.94),
  edge('edge-topic-block', 'capture-topic-gate', 'capture-block-view', 'Persisted evidence crosses the object contract', 0.86),
  edge('edge-block-galley', 'capture-block-view', 'capture-galley', 'Descriptor opens the reading renderer', 0.89),
  edge('edge-intui-galley', 'capture-intui', 'capture-galley', 'Shared editor well and bridge', 0.78),
  edge('edge-survey-edges', 'capture-survey-brief', 'capture-evidence-edges', 'The design brief defines evidenced connections', 0.91),
  edge('edge-edges-observable', 'capture-evidence-edges', 'capture-observable', 'Both reduce complexity through direct explanation', 0.82),
  edge('edge-observable-motion', 'capture-observable', 'capture-reduced-motion', 'Accessible information survives visual reduction', 0.87),
  edge('edge-intui-motion', 'capture-intui', 'capture-reduced-motion', 'Register discipline governs the fallback', 0.72),
  edge('edge-ingest-preview', 'capture-link-ingest', 'capture-preview-receipt', 'Link extraction discovers the source-authored preview', 0.93),
  edge('edge-preview-contract', 'capture-preview-receipt', 'capture-survey-contract', 'The receipt feeds the held-media boundary', 0.91),
  edge('edge-contract-gallery', 'capture-survey-contract', 'capture-stellar-gallery', 'The view contract supplies source artifacts to the spatial component', 0.88),
  edge('edge-preview-metadata', 'capture-preview-receipt', 'capture-object-metadata', 'Preview custody and provenance travel as object metadata', 0.9),
  edge('edge-metadata-readme', 'capture-object-metadata', 'capture-commonplace-readme', 'The repository architecture keeps evidence queryable', 0.77),
  edge('edge-margin-ingest', 'capture-margin-recall', 'capture-link-ingest', 'Both keep source evidence beside selected content', 0.81),
];

export function seedSurveyObjects(): ObjectRef[] {
  return [
    {
      id: SURVEY_TOPIC_ID,
      type: 'topic',
      properties: {
        topic_id: SURVEY_TOPIC_ID,
        title: 'Evidence centered research surfaces',
        description: 'How captured evidence becomes a readable, explainable research board.',
        updated: '2026-07-17',
        status: 'standing',
        capture_count: CAPTURES.length,
      },
    },
    ...CAPTURES,
    ...EDGES,
  ];
}
