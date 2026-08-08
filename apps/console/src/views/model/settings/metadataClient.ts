// SOURCING: none. Browser client for same-origin `/api/rest/metadata/*`.

import type {
  FacetDefWire,
  FieldMetadataWire,
  ObjectConformanceWire,
  ObjectMetadataWire,
  PromotionCandidateWire,
  TwentyFieldTypeToken,
} from '@commonplace/data-model-contracts';
import { objectFields } from '@commonplace/data-model-contracts';

async function metadataFetch<T>(
  path: string,
  init?: RequestInit,
): Promise<{ ok: true; data: T } | { ok: false; status: number; error: string }> {
  const response = await fetch(`/api/rest/metadata/${path.replace(/^\//, '')}`, {
    ...init,
    headers: {
      Accept: 'application/json',
      ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
      ...init?.headers,
    },
    cache: 'no-store',
  });
  const text = await response.text();
  let parsed: unknown = null;
  try {
    parsed = text ? JSON.parse(text) : null;
  } catch {
    parsed = { raw: text };
  }
  if (!response.ok) {
    const error =
      typeof parsed === 'object' &&
      parsed &&
      'error' in parsed &&
      typeof (parsed as { error: unknown }).error === 'string'
        ? (parsed as { error: string }).error
        : `metadata_${response.status}`;
    return { ok: false, status: response.status, error };
  }
  return { ok: true, data: parsed as T };
}

export async function listMetadataObjects(): Promise<ObjectMetadataWire[]> {
  const result = await metadataFetch<{
    objects?: { edges?: Array<{ node?: ObjectMetadataWire }> };
  }>('objects');
  if (!result.ok) throw new Error(result.error);
  return (result.data.objects?.edges ?? [])
    .map((edge) => edge.node)
    .filter((node): node is ObjectMetadataWire => Boolean(node))
    .map((node) => ({ ...node, fields: objectFields(node) }));
}

export async function patchMetadataObject(
  nameSingular: string,
  patch: Partial<Pick<ObjectMetadataWire, 'labelSingular' | 'labelPlural' | 'description' | 'isActive' | 'isSearchable'>>,
): Promise<ObjectMetadataWire> {
  const result = await metadataFetch<ObjectMetadataWire>(`objects/${encodeURIComponent(nameSingular)}`, {
    method: 'PATCH',
    body: JSON.stringify(patch),
  });
  if (!result.ok) throw new Error(result.error);
  return { ...result.data, fields: objectFields(result.data) };
}

export async function listFacets(): Promise<FacetDefWire[]> {
  const result = await metadataFetch<{ facets?: FacetDefWire[] }>('facets');
  if (!result.ok) throw new Error(result.error);
  return result.data.facets ?? [];
}

export async function createConformance(
  objectNameSingular: string,
  conformance: {
    facet: string;
    propertyMap: Record<string, string>;
    relationMap?: Record<string, string>;
  },
): Promise<ObjectConformanceWire> {
  const result = await metadataFetch<ObjectConformanceWire>(
    `objects/${encodeURIComponent(objectNameSingular)}/conformances`,
    { method: 'POST', body: JSON.stringify(conformance) },
  );
  if (!result.ok) throw new Error(result.error);
  return result.data;
}

export async function deleteConformance(
  objectNameSingular: string,
  facet: string,
): Promise<void> {
  const result = await metadataFetch<unknown>(
    `objects/${encodeURIComponent(objectNameSingular)}/conformances/${encodeURIComponent(facet)}`,
    { method: 'DELETE' },
  );
  if (!result.ok && result.status !== 204) throw new Error(result.error);
}

export async function patchMetadataField(
  objectNameSingular: string,
  fieldName: string,
  patch: Partial<{
    label: string;
    description: string;
    type: TwentyFieldTypeToken;
    isNullable: boolean;
    settings: FieldMetadataWire['settings'];
  }>,
): Promise<ObjectMetadataWire> {
  const result = await metadataFetch<ObjectMetadataWire>(
    `fields/${encodeURIComponent(objectNameSingular)}/${encodeURIComponent(fieldName)}`,
    { method: 'PATCH', body: JSON.stringify(patch) },
  );
  if (!result.ok) throw new Error(result.error);
  return { ...result.data, fields: objectFields(result.data) };
}

export async function demoteFieldIndex(
  objectNameSingular: string,
  fieldName: string,
): Promise<void> {
  const result = await metadataFetch<unknown>(
    `indexes/${encodeURIComponent(objectNameSingular)}/${encodeURIComponent(fieldName)}`,
    { method: 'DELETE' },
  );
  if (!result.ok && result.status !== 204) throw new Error(result.error);
}

export async function promoteFieldIndex(
  objectNameSingular: string,
  fieldName: string,
): Promise<void> {
  const result = await metadataFetch<unknown>(
    `indexes/${encodeURIComponent(objectNameSingular)}/${encodeURIComponent(fieldName)}`,
    { method: 'POST', body: JSON.stringify({ kind: 'user_marked' }) },
  );
  if (!result.ok) throw new Error(result.error);
}

export async function listPromotionCandidates(): Promise<PromotionCandidateWire[]> {
  const result = await metadataFetch<{ candidates?: PromotionCandidateWire[] }>(
    'promotion-candidates',
  );
  if (!result.ok) throw new Error(result.error);
  return result.data.candidates ?? [];
}
