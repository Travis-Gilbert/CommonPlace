import type { AgencyEvidence, AgencyProposal, ApprovalReceipt } from '@/agency/types';

import { gql } from './client';

const PROPOSAL_FIELDS = `
  id tenantId whatChanged goalRefs stakeRefs actionClass executorId
  effectContractId effectContractHash disclosures { id text } payloadHash previewRef targetIdentity
  evidenceRefs counterEvidenceRefs assumptionEnvironments assumptionLabelComplete constraintRefs verifierReceiptRefs
  riskTier permission reversibility sourceGraphVersion preconditionHash basisHash expiresAtMs state
`;

function requiredTenant(tenantId: string): string {
  const tenant = tenantId.trim();
  if (!tenant || tenant.toLowerCase() === 'default') {
    throw new Error('Agency proposals require an explicit non-default tenant binding.');
  }
  return tenant;
}

export async function fetchAgencyProposals(tenantId: string, limit = 100): Promise<AgencyProposal[]> {
  const data = await gql<{ agencyProposals: AgencyProposal[] }>(
    `query AgencyProposals($tenantId: String!, $limit: Int) {
      agencyProposals(tenantId: $tenantId, limit: $limit) { ${PROPOSAL_FIELDS} }
    }`,
    { tenantId: requiredTenant(tenantId), limit: Math.min(Math.max(limit, 1), 100) },
  );
  return data.agencyProposals;
}

export async function fetchAgencyProposal(tenantId: string, proposalId: string): Promise<AgencyProposal | null> {
  const proposals = await fetchAgencyProposals(tenantId);
  return proposals.find((proposal) => proposal.id === proposalId) ?? null;
}

export async function fetchAgencyEvidence(input: {
  tenantId: string;
  proposalId: string;
  reference: string;
}): Promise<AgencyEvidence> {
  const data = await gql<{ agencyEvidence: AgencyEvidence }>(
    `query AgencyEvidence($tenantId: String!, $proposalId: String!, $reference: String!) {
      agencyEvidence(tenantId: $tenantId, proposalId: $proposalId, reference: $reference) {
        reference source archiveContentHash archiveBody
      }
    }`,
    { ...input, tenantId: requiredTenant(input.tenantId) },
  );
  return data.agencyEvidence;
}

export async function approveAgencyProposal(input: {
  tenantId: string;
  proposalId: string;
  userSignatureRef: string;
  expiresAtMs: number;
}): Promise<ApprovalReceipt> {
  const data = await gql<{ approveAgencyProposal: ApprovalReceipt }>(
    `mutation ApproveAgencyProposal($input: AgencyProposalApprovalInput!) {
      approveAgencyProposal(input: $input) { approvalReceiptId proposal { ${PROPOSAL_FIELDS} } }
    }`,
    { input: { ...input, tenantId: requiredTenant(input.tenantId) } },
  );
  return data.approveAgencyProposal;
}

export async function dismissAgencyProposal(input: {
  tenantId: string;
  proposalId: string;
  reason: string;
}): Promise<AgencyProposal> {
  const data = await gql<{ dismissAgencyProposal: AgencyProposal }>(
    `mutation DismissAgencyProposal($input: AgencyProposalDecisionInput!) {
      dismissAgencyProposal(input: $input) { ${PROPOSAL_FIELDS} }
    }`,
    { input: { ...input, tenantId: requiredTenant(input.tenantId) } },
  );
  return data.dismissAgencyProposal;
}

export async function suppressAgencyProposal(input: {
  tenantId: string;
  proposalId: string;
  reason: string;
}): Promise<string> {
  const data = await gql<{ suppressAgencyProposal: string }>(
    `mutation SuppressAgencyProposal($input: AgencyProposalDecisionInput!) {
      suppressAgencyProposal(input: $input)
    }`,
    { input: { ...input, tenantId: requiredTenant(input.tenantId) } },
  );
  return data.suppressAgencyProposal;
}
