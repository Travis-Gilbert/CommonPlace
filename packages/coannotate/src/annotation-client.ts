// The annotation client (SPEC-PREVIEW-COANNOTATION D4/D6). A thin, transport-
// agnostic client over an injected GraphQL fetcher: it builds the operations and
// maps responses to the domain `Annotation`. This is the TS side of the contract
// the CommonPlace `commonplace-api` resolvers (PT-031) implement over the Rust
// `create_annotation` / `annotations_for` / `resolve_annotation` store methods.
//
// Fetch is injected so the op-building and mapping are pure and testable with no
// network.

import type { Annotation, Anchor, AuthorKind, Resolution } from './types.ts';
import { parseAnchor } from './types.ts';

/** Run a GraphQL op. Returns the `data` object (the client unwraps the field). */
export type GraphqlFetcher = (
  query: string,
  variables: Record<string, unknown>,
) => Promise<unknown>;

export interface CreateAnnotationInput {
  targetId: string;
  body: string;
  anchor: Anchor;
  author?: string;
  authorKind: AuthorKind;
}

export interface ReplyInput {
  parentId: string;
  body: string;
  author?: string;
  authorKind: AuthorKind;
}

export interface ResolveInput {
  id: string;
  by: string;
  receipt?: string;
}

const FIELDS =
  'id targetId author authorKind anchor body resolved resolution { by receipt } createdAtMs';

export const CREATE_ANNOTATION = `mutation CreateAnnotation($input: CreateAnnotationInput!) { createAnnotation(input: $input) { ${FIELDS} } }`;
export const REPLY_ANNOTATION = `mutation ReplyAnnotation($input: ReplyAnnotationInput!) { replyAnnotation(input: $input) { ${FIELDS} } }`;
export const RESOLVE_ANNOTATION = `mutation ResolveAnnotation($input: ResolveAnnotationInput!) { resolveAnnotation(input: $input) { ${FIELDS} } }`;
export const ANNOTATIONS_FOR_TARGET = `query AnnotationsForTarget($targetId: ID!) { annotationsForTarget(targetId: $targetId) { ${FIELDS} } }`;

export function buildCreateAnnotation(input: CreateAnnotationInput): {
  query: string;
  variables: Record<string, unknown>;
} {
  return {
    query: CREATE_ANNOTATION,
    variables: {
      input: {
        targetId: input.targetId,
        body: input.body,
        // The anchor is the wire-parity shape (matches Rust `Anchor`).
        anchor: input.anchor,
        author: input.author ?? null,
        authorKind: input.authorKind,
      },
    },
  };
}

export function annotationFromGraphql(node: unknown): Annotation | null {
  if (typeof node !== 'object' || node === null) return null;
  const n = node as Record<string, unknown>;
  if (typeof n.id !== 'string' || typeof n.body !== 'string') return null;
  return {
    id: n.id,
    targetId: typeof n.targetId === 'string' ? n.targetId : undefined,
    author: typeof n.author === 'string' ? n.author : undefined,
    authorKind: n.authorKind === 'user' || n.authorKind === 'head' ? n.authorKind : undefined,
    anchor: parseAnchor(n.anchor) ?? undefined,
    body: n.body,
    resolved: n.resolved === true,
    resolution: resolutionFromGraphql(n.resolution),
    createdAtMs: typeof n.createdAtMs === 'number' ? n.createdAtMs : 0,
  };
}

function resolutionFromGraphql(value: unknown): Resolution | undefined {
  if (typeof value !== 'object' || value === null) return undefined;
  const r = value as Record<string, unknown>;
  if (typeof r.by !== 'string') return undefined;
  return { by: r.by, ...(typeof r.receipt === 'string' ? { receipt: r.receipt } : {}) };
}

async function pick(
  fetch: GraphqlFetcher,
  query: string,
  variables: Record<string, unknown>,
  field: string,
): Promise<unknown> {
  const data = await fetch(query, variables);
  if (typeof data === 'object' && data !== null && field in (data as Record<string, unknown>)) {
    return (data as Record<string, unknown>)[field];
  }
  // Fetcher already returned the field payload (some clients unwrap `data`).
  return data;
}

export async function createAnnotation(
  fetch: GraphqlFetcher,
  input: CreateAnnotationInput,
): Promise<Annotation | null> {
  const { query, variables } = buildCreateAnnotation(input);
  return annotationFromGraphql(await pick(fetch, query, variables, 'createAnnotation'));
}

export async function replyToAnnotation(
  fetch: GraphqlFetcher,
  input: ReplyInput,
): Promise<Annotation | null> {
  const variables = {
    input: {
      parentId: input.parentId,
      body: input.body,
      author: input.author ?? null,
      authorKind: input.authorKind,
    },
  };
  return annotationFromGraphql(await pick(fetch, REPLY_ANNOTATION, variables, 'replyAnnotation'));
}

export async function resolveAnnotation(
  fetch: GraphqlFetcher,
  input: ResolveInput,
): Promise<Annotation | null> {
  const variables = {
    input: { id: input.id, by: input.by, receipt: input.receipt ?? null },
  };
  return annotationFromGraphql(await pick(fetch, RESOLVE_ANNOTATION, variables, 'resolveAnnotation'));
}

export async function annotationsForTarget(
  fetch: GraphqlFetcher,
  targetId: string,
): Promise<Annotation[]> {
  const raw = await pick(fetch, ANNOTATIONS_FOR_TARGET, { targetId }, 'annotationsForTarget');
  if (!Array.isArray(raw)) return [];
  return raw.map(annotationFromGraphql).filter((a): a is Annotation => a !== null);
}
