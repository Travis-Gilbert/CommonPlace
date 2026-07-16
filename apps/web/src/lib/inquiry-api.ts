// SOURCING: none — pure logic, no upstream component applies

import type {
  CreateInquiryResponse,
  DelegateInquiryResponse,
  GetInquiryResponse,
  InquirySurface,
  InterpretationTarget,
  InterpretInquiryResponse,
  RetrievalBudget,
} from '@/lib/inquiry-types';

const INQUIRIES_BASE = '/api/theorem/inquiries';

class InquiryApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly payload?: unknown,
  ) {
    super(message);
    this.name = 'InquiryApiError';
  }
}

async function inquiryFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
    cache: 'no-store',
  });
  const text = await res.text();
  let payload: unknown = null;
  if (text) {
    try {
      payload = JSON.parse(text) as unknown;
    } catch {
      payload = { message: text };
    }
  }
  if (!res.ok) {
    const message =
      typeof payload === 'object' &&
      payload !== null &&
      'message' in payload &&
      typeof (payload as { message: unknown }).message === 'string'
        ? (payload as { message: string }).message
        : `Inquiry request failed (${res.status})`;
    throw new InquiryApiError(res.status, message, payload);
  }
  return payload as T;
}

export interface CreateInquiryParams {
  query: string;
  surface?: InquirySurface;
  scope_refs?: string[];
  retrieval_budget?: RetrievalBudget;
  parent_snapshot_id?: string | null;
}

export async function createInquiry(
  params: CreateInquiryParams,
): Promise<CreateInquiryResponse> {
  return inquiryFetch<CreateInquiryResponse>(INQUIRIES_BASE, {
    method: 'POST',
    body: JSON.stringify({
      query: params.query,
      surface: params.surface ?? 'index',
      scope_refs: params.scope_refs ?? [],
      retrieval_budget: params.retrieval_budget ?? 'standard',
      parent_snapshot_id: params.parent_snapshot_id ?? null,
    }),
  });
}

export async function fetchInquiry(id: string): Promise<GetInquiryResponse> {
  return inquiryFetch<GetInquiryResponse>(`${INQUIRIES_BASE}/${encodeURIComponent(id)}`);
}

export async function interpretInquiry(
  id: string,
  target: InterpretationTarget,
): Promise<InterpretInquiryResponse> {
  return inquiryFetch<InterpretInquiryResponse>(
    `${INQUIRIES_BASE}/${encodeURIComponent(id)}/interpretations`,
    {
      method: 'POST',
      body: JSON.stringify({ target }),
    },
  );
}

export async function delegateInquiry(
  id: string,
  body: { binding_id?: string; task: string },
): Promise<DelegateInquiryResponse> {
  return inquiryFetch<DelegateInquiryResponse>(
    `${INQUIRIES_BASE}/${encodeURIComponent(id)}/delegate`,
    {
      method: 'POST',
      body: JSON.stringify({
        binding_id: body.binding_id ?? 'agent:theorem',
        task: body.task,
      }),
    },
  );
}

export async function pinEvidence(
  inquiryId: string,
  artifactId: string,
): Promise<{ ok: boolean; artifact_id: string; lifecycle: string }> {
  return inquiryFetch(
    `${INQUIRIES_BASE}/${encodeURIComponent(inquiryId)}/evidence/${encodeURIComponent(artifactId)}/pin`,
    { method: 'POST', body: JSON.stringify({}) },
  );
}

export { InquiryApiError };
