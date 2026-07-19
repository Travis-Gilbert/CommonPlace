'use client';

import { useCallback, useMemo, useState } from 'react';
import { deriveViewState } from '@/lib/commonplace-view-state';
import { useApiData } from '@/lib/commonplace-api';
import {
  approveAgencyProposal,
  dismissAgencyProposal,
  fetchAgencyEvidence,
  fetchAgencyProposals,
  suppressAgencyProposal,
  undoAgencyApproval,
  type AgencyAction,
  type AgencyEvidence,
  type AgencyProposalModel,
} from '@/lib/agencyProposal';
import { AgencyProposalRegistry } from './AgencyProposalRegistry';
import styles from './agencyProposal.module.css';

export default function AgencyProposalLens({
  tenantId,
  userSignatureRef,
}: {
  tenantId?: string;
  userSignatureRef?: string;
}) {
  const [pending, setPending] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [overrides, setOverrides] = useState<Record<string, AgencyProposalModel>>({});
  const [undoApproval, setUndoApproval] = useState<{
    proposal: AgencyProposalModel;
    approvalReceiptId: string;
  } | null>(null);
  const [evidence, setEvidence] = useState<AgencyEvidence | null>(null);
  const [evidenceError, setEvidenceError] = useState<string | null>(null);
  const { data, loading, error, refetch } = useApiData(
    () => {
      if (!tenantId) throw new Error('Choose a tenant before opening agency proposals.');
      return fetchAgencyProposals(tenantId);
    },
    [tenantId],
    { cacheKey: `agency-proposals:${tenantId ?? 'unbound'}` },
  );
  const projectedData = useMemo(
    () => data?.map((proposal) => overrides[proposal.id] ?? proposal),
    [data, overrides],
  );
  const state = useMemo(
    () => deriveViewState({ data: projectedData, loading, error: error?.message, retry: refetch, isEmpty: (items) => items.length === 0 }),
    [projectedData, loading, error, refetch],
  );

  const onAction = useCallback(async (action: AgencyAction, proposal: AgencyProposalModel) => {
    if (!tenantId || pending) return;
    setPending(`${action}:${proposal.id}`);
    setMessage(null);
    try {
      if (action === 'approve') {
        if (!userSignatureRef) throw new Error('A user signature reference is required for exact approval.');
        const optimistic = { ...proposal, state: 'authorized', permission: 'authorized_by_approval' };
        setOverrides((current) => ({ ...current, [proposal.id]: optimistic }));
        const approved = await approveAgencyProposal({
          tenantId,
          proposalId: proposal.id,
          userSignatureRef,
          expiresAtMs: Math.min(proposal.expiresAtMs, Date.now() + 30 * 60 * 1000),
        });
        setOverrides((current) => ({ ...current, [proposal.id]: approved.proposal }));
        setUndoApproval({ proposal: approved.proposal, approvalReceiptId: approved.approvalReceiptId });
        setMessage('Exact approval recorded. Execution still requires fresh preflight.');
      } else if (action === 'dismiss') {
        await dismissAgencyProposal({ tenantId, proposalId: proposal.id, reason: 'Dismissed in CommonPlace' });
        setMessage('Dismissed. It will not return unless its material basis changes.');
      } else if (action === 'suppress') {
        await suppressAgencyProposal({ tenantId, proposalId: proposal.id, reason: 'Suppressed in CommonPlace' });
        setMessage('Suppressed for this material basis.');
      } else {
        setMessage('Edits produce a replacement proposal and require a fresh exact approval.');
      }
      refetch();
    } catch (actionError) {
      if (action === 'approve') {
        setOverrides((current) => {
          const { [proposal.id]: _discarded, ...rest } = current;
          return rest;
        });
      }
      setMessage(actionError instanceof Error ? actionError.message : String(actionError));
    } finally {
      setPending(null);
    }
  }, [pending, refetch, tenantId, userSignatureRef]);

  const onUndoApproval = useCallback(async () => {
    if (!tenantId || !undoApproval || pending) return;
    const previous = undoApproval.proposal;
    const optimistic = { ...previous, state: 'awaiting_approval', permission: 'awaiting_approval' };
    setPending(`undo:${previous.id}`);
    setOverrides((current) => ({ ...current, [previous.id]: optimistic }));
    try {
      const reverted = await undoAgencyApproval({
        tenantId,
        proposalId: previous.id,
        approvalReceiptId: undoApproval.approvalReceiptId,
        reason: 'User withdrew exact approval in CommonPlace',
      });
      setOverrides((current) => ({ ...current, [previous.id]: reverted }));
      setUndoApproval(null);
      setMessage('Exact approval withdrawn. The proposal is awaiting review again.');
      refetch();
    } catch (undoError) {
      setOverrides((current) => ({ ...current, [previous.id]: previous }));
      setMessage(undoError instanceof Error ? undoError.message : String(undoError));
    } finally {
      setPending(null);
    }
  }, [pending, refetch, tenantId, undoApproval]);

  const onOpenEvidence = useCallback(async (proposal: AgencyProposalModel, reference: string) => {
    if (!tenantId) return;
    setEvidence(null);
    setEvidenceError(null);
    try {
      setEvidence(await fetchAgencyEvidence({ tenantId, proposalId: proposal.id, reference }));
    } catch (evidenceLoadError) {
      setEvidenceError(evidenceLoadError instanceof Error ? evidenceLoadError.message : String(evidenceLoadError));
    }
  }, [tenantId]);

  return (
    <div className={styles.lens} data-pending={pending ? 'true' : 'false'}>
      {message ? <div className={styles.actionMessage} role="status">{message}</div> : null}
      {undoApproval ? (
        <div className={styles.actionMessage} role="status">
          Approval is recorded. <button type="button" onClick={() => void onUndoApproval()}>Undo approval</button>
        </div>
      ) : null}
      {evidence ? <EvidenceSource evidence={evidence} onClose={() => setEvidence(null)} /> : null}
      {evidenceError ? <div className={styles.actionMessage} role="alert">{evidenceError}</div> : null}
      <AgencyProposalRegistry state={state} onRetry={refetch} onAction={(action, proposal) => void onAction(action, proposal)} onOpenEvidence={(proposal, reference) => void onOpenEvidence(proposal, reference)} />
    </div>
  );
}

function EvidenceSource({ evidence, onClose }: { evidence: AgencyEvidence; onClose: () => void }) {
  const sourceUrl = ['sourceUrl', 'url', 'originalUrl']
    .map((key) => evidence.source[key])
    .find((value): value is string => typeof value === 'string' && value.length > 0);

  return (
    <section className={styles.evidenceSource} aria-label="Archived evidence source">
      <div>
        <span className={styles.eyebrow}>Exact source</span>
        <h2>{evidence.reference}</h2>
        {sourceUrl ? <a href={sourceUrl} target="_blank" rel="noreferrer">Open captured source location</a> : null}
        {evidence.archiveContentHash ? <p>Archive: {evidence.archiveContentHash}</p> : <p>Source reference is retained; no local archive payload is available.</p>}
      </div>
      <button type="button" onClick={onClose}>Close source</button>
      {evidence.archiveBody ? <pre className={styles.archiveBody}>{evidence.archiveBody}</pre> : null}
    </section>
  );
}
