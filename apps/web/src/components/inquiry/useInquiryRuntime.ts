// SOURCING: none — pure logic, no upstream component applies

'use client';

import { useCallback, useState } from 'react';

import {
  createInquiry,
  delegateInquiry,
  fetchInquiry,
  interpretInquiry,
  pinEvidence,
  type CreateInquiryParams,
} from '@/lib/inquiry-api';
import type {
  DelegateInquiryResponse,
  InquiryInterpretation,
  InquirySnapshot,
  InterpretationTarget,
} from '@/lib/inquiry-types';

export function useInquiryRuntime() {
  const [inquiryId, setInquiryId] = useState<string | null>(null);
  const [snapshot, setSnapshot] = useState<InquirySnapshot | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [interpretation, setInterpretation] = useState<InquiryInterpretation | null>(null);
  const [agentResult, setAgentResult] = useState<DelegateInquiryResponse | null>(null);
  const [actionLoading, setActionLoading] = useState<'interpret' | 'delegate' | null>(null);

  const reset = useCallback(() => {
    setInquiryId(null);
    setSnapshot(null);
    setLoading(false);
    setError(null);
    setInterpretation(null);
    setAgentResult(null);
    setActionLoading(null);
  }, []);

  const startInquiry = useCallback(async (params: CreateInquiryParams) => {
    setLoading(true);
    setError(null);
    setInterpretation(null);
    setAgentResult(null);
    try {
      const created = await createInquiry(params);
      setInquiryId(created.inquiry_id);
      setSnapshot(created.snapshot);
      return created;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Inquiry could not start';
      setError(message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const refreshSnapshot = useCallback(async () => {
    if (!inquiryId) return null;
    const fetched = await fetchInquiry(inquiryId);
    setSnapshot(fetched.snapshot);
    return fetched.snapshot;
  }, [inquiryId]);

  const interpret = useCallback(
    async (target: InterpretationTarget, instruction?: string) => {
      if (!inquiryId) return null;
      setActionLoading('interpret');
      setError(null);
      try {
        const response = await interpretInquiry(inquiryId, target);
        setInterpretation(response.interpretation);
        return response;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Interpretation failed';
        setError(message);
        throw err;
      } finally {
        setActionLoading(null);
      }
    },
    [inquiryId],
  );

  const delegate = useCallback(
    async (task: string, bindingId = 'agent:theorem') => {
      if (!inquiryId) return null;
      setActionLoading('delegate');
      setError(null);
      try {
        const response = await delegateInquiry(inquiryId, { binding_id: bindingId, task });
        setAgentResult(response);
        return response;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Delegation failed';
        setError(message);
        throw err;
      } finally {
        setActionLoading(null);
      }
    },
    [inquiryId],
  );

  const pinArtifact = useCallback(
    async (artifactId: string) => {
      if (!inquiryId) return null;
      await pinEvidence(inquiryId, artifactId);
      return refreshSnapshot();
    },
    [inquiryId, refreshSnapshot],
  );

  return {
    inquiryId,
    snapshot,
    loading,
    error,
    interpretation,
    agentResult,
    actionLoading,
    startInquiry,
    refreshSnapshot,
    interpret,
    delegate,
    pinArtifact,
    reset,
  };
}
