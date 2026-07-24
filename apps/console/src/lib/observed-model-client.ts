// SOURCING: none. Browser client for the same-origin observed model boundary.

import type { BlockHost, JsonValue } from '@commonplace/block-view/types';
import type {
  DeclaredModel,
  ObservedModel,
  PinReceipt,
  PinRequest,
  SchemaProposalDraft,
} from '@commonplace/data-model-contracts';

export interface ModelPayload {
  readonly observed: ObservedModel;
  readonly declared: DeclaredModel;
  readonly error?: string;
}

export interface PinPayload {
  readonly receipt: PinReceipt;
  readonly declared: DeclaredModel;
}

async function responseJson(response: Response): Promise<Record<string, unknown>> {
  const payload = await response.json().catch(() => null);
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    throw new Error('Observed model returned an invalid response.');
  }
  return payload as Record<string, unknown>;
}

function errorMessage(payload: Record<string, unknown>, fallback: string): string {
  return typeof payload.error === 'string' ? payload.error : fallback;
}

export async function fetchObservedModel(topicId: string): Promise<ModelPayload> {
  const response = await fetch(`/api/observed-model?topicId=${encodeURIComponent(topicId)}`, {
    cache: 'no-store',
  });
  const payload = await responseJson(response);
  const observed = payload.observed as ObservedModel | undefined;
  const declared = payload.declared as DeclaredModel | undefined;
  if (!observed || !declared) throw new Error(errorMessage(payload, 'Observed model is unavailable.'));
  return {
    observed,
    declared,
    ...(!response.ok ? { error: errorMessage(payload, 'Observed model is unavailable.') } : {}),
  };
}

async function syncDeclaredOverlay(host: BlockHost | undefined, declared: DeclaredModel): Promise<void> {
  if (!host) return;
  const topicId = declared.scope.kind === 'topic' ? declared.scope.topicId : undefined;
  const objects = [
    ...declared.objectTypes.map((item) => ({ type: 'object-type-metadata', item })),
    ...declared.fields.map((item) => ({ type: 'field-metadata', item })),
    ...declared.relations.map((item) => ({ type: 'relation-metadata', item })),
    ...declared.views.map((item) => ({ type: 'view-metadata', item })),
    ...declared.versions.map((item) => ({ type: 'schema-version', item })),
  ];
  const expectedIds = new Set(objects.map(({ item }) => item.id));
  const current = await host.query({
    types: [
      'object-type-metadata',
      'field-metadata',
      'relation-metadata',
      'view-metadata',
      'schema-version',
    ],
    ...(topicId
      ? { where: { kind: 'eq' as const, field: 'topic_id', value: topicId } }
      : {}),
  });
  for (const object of current.objects) {
    if (!expectedIds.has(object.id)) await host.emit({ kind: 'delete', id: object.id });
  }
  for (const { type, item } of objects) {
    await host.emit({
      kind: 'create',
      type,
      props: {
        ...(item as unknown as Record<string, JsonValue>),
        ...(topicId ? { topic_id: topicId } : {}),
      },
    });
  }
}

export async function postPin(request: PinRequest, host?: BlockHost): Promise<PinPayload> {
  const response = await fetch('/api/observed-model/pin', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
  });
  const payload = await responseJson(response);
  if (!response.ok) throw new Error(errorMessage(payload, 'Pin failed.'));
  const receipt = payload.receipt as PinReceipt | undefined;
  const declared = payload.declared as DeclaredModel | undefined;
  if (!receipt || !declared) throw new Error('Pin returned an invalid receipt.');
  await syncDeclaredOverlay(host, declared);
  return { receipt, declared };
}

export async function postUnpin(
  topicId: string,
  declaredId: string,
  host?: BlockHost,
): Promise<PinPayload> {
  const response = await fetch('/api/observed-model/unpin', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ topicId, declaredId }),
  });
  const payload = await responseJson(response);
  if (!response.ok) throw new Error(errorMessage(payload, 'Unpin failed.'));
  const receipt = payload.receipt as PinReceipt | undefined;
  const declared = payload.declared as DeclaredModel | undefined;
  if (!receipt || !declared) throw new Error('Unpin returned an invalid receipt.');
  await syncDeclaredOverlay(host, declared);
  return { receipt, declared };
}

export async function postSchemaProposal(
  topicId: string,
  request: string,
): Promise<SchemaProposalDraft> {
  const response = await fetch('/api/observed-model/propose', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ topicId, request }),
  });
  const payload = await responseJson(response);
  if (!response.ok) throw new Error(errorMessage(payload, 'Schema proposal failed.'));
  const draft = payload.draft as SchemaProposalDraft | undefined;
  if (!draft) throw new Error('Schema proposal returned an invalid draft.');
  return draft;
}
