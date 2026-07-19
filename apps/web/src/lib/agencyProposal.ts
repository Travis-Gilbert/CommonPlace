import { gql } from '@/lib/commonplace-graphql';

export type AgencyAction = 'approve' | 'edit' | 'dismiss' | 'suppress';

export interface AgencyDisclosure {
  id: string;
  text: string;
}

export interface AgencyProposalModel {
  id: string;
  tenantId: string;
  whatChanged: string;
  goalRefs: string[];
  stakeRefs: string[];
  actionClass: string;
  executorId: string;
  effectContractId: string;
  effectContractHash: string;
  disclosures: AgencyDisclosure[];
  payloadHash: string;
  previewRef: string;
  targetIdentity: string;
  evidenceRefs: string[];
  counterEvidenceRefs: string[];
  assumptionEnvironments: string[][];
  assumptionLabelComplete: boolean;
  constraintRefs: string[];
  verifierReceiptRefs: string[];
  riskTier: string;
  permission: string;
  reversibility: string;
  sourceGraphVersion: number;
  preconditionHash: string;
  basisHash: string;
  expiresAtMs: number;
  state: string;
}

export interface AgencyEvidence {
  reference: string;
  source: Record<string, unknown>;
  archiveContentHash: string | null;
  archiveBody: string | null;
}

interface AgencyProposalWire {
  id: string;
  tenantId: string;
  whatChanged: string;
  goalRefs: string[];
  stakeRefs: string[];
  actionClass: string;
  executorId: string;
  effectContractId: string;
  effectContractHash: string;
  disclosures: unknown;
  payloadHash: string;
  previewRef: string;
  targetIdentity: string;
  evidenceRefs: string[];
  counterEvidenceRefs: string[];
  assumptionEnvironments: unknown;
  assumptionLabelComplete: boolean;
  constraintRefs: string[];
  verifierReceiptRefs: string[];
  riskTier: unknown;
  permission: unknown;
  reversibility: unknown;
  sourceGraphVersion: number;
  preconditionHash: string;
  basisHash: string;
  expiresAtMs: number;
  state: unknown;
}

function requiredTenant(tenantId: string): string {
  const tenant = tenantId.trim();
  if (!tenant || tenant.toLowerCase() === 'default') {
    throw new Error('Agency proposals require an explicit non-default tenant binding.');
  }
  return tenant;
}

function stringValue(value: unknown, fallback = 'unknown'): string {
  return typeof value === 'string' && value.trim() ? value : fallback;
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === 'string') : [];
}

function disclosures(value: unknown): AgencyDisclosure[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry) => {
    if (!entry || typeof entry !== 'object') return [];
    const record = entry as Record<string, unknown>;
    const id = stringValue(record.id, 'disclosure');
    const text = stringValue(record.text, '');
    return text ? [{ id, text }] : [];
  });
}

function assumptionEnvironments(value: unknown): string[][] {
  return Array.isArray(value) ? value.map(stringArray).filter((environment) => environment.length > 0) : [];
}

export function agencyProposalFromWire(proposal: AgencyProposalWire): AgencyProposalModel {
  return {
    ...proposal,
    disclosures: disclosures(proposal.disclosures),
    assumptionEnvironments: assumptionEnvironments(proposal.assumptionEnvironments),
    assumptionLabelComplete: proposal.assumptionLabelComplete,
    riskTier: stringValue(proposal.riskTier),
    permission: stringValue(proposal.permission),
    reversibility: stringValue(proposal.reversibility),
    state: stringValue(proposal.state),
  };
}

const PROPOSAL_FIELDS = `
  id tenantId whatChanged goalRefs stakeRefs actionClass executorId
  effectContractId effectContractHash disclosures payloadHash previewRef targetIdentity
  evidenceRefs counterEvidenceRefs assumptionEnvironments assumptionLabelComplete constraintRefs verifierReceiptRefs
  riskTier permission reversibility sourceGraphVersion preconditionHash basisHash expiresAtMs state
`;

export async function fetchAgencyProposals(
  tenantId: string,
  limit = 100,
): Promise<AgencyProposalModel[]> {
  const data = await gql<{ agencyProposals: AgencyProposalWire[] }>(
    `query AgencyProposals($tenantId: String!, $limit: Int) {
      agencyProposals(tenantId: $tenantId, limit: $limit) { ${PROPOSAL_FIELDS} }
    }`,
    { tenantId: requiredTenant(tenantId), limit: Math.min(Math.max(limit, 1), 100) },
  );
  return data.agencyProposals.map(agencyProposalFromWire);
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
    {
      tenantId: requiredTenant(input.tenantId),
      proposalId: input.proposalId,
      reference: input.reference,
    },
  );
  return data.agencyEvidence;
}

export async function approveAgencyProposal(input: {
  tenantId: string;
  proposalId: string;
  userSignatureRef: string;
  expiresAtMs: number;
}): Promise<{ approvalReceiptId: string; proposal: AgencyProposalModel }> {
  const data = await gql<{
    approveAgencyProposal: { approvalReceiptId: string; proposal: AgencyProposalWire };
  }>(
    `mutation ApproveAgencyProposal($input: AgencyProposalApprovalInput!) {
      approveAgencyProposal(input: $input) { approvalReceiptId proposal { ${PROPOSAL_FIELDS} } }
    }`,
    {
      input: {
        tenantId: requiredTenant(input.tenantId),
        proposalId: input.proposalId,
        userSignatureRef: input.userSignatureRef,
        expiresAtMs: input.expiresAtMs,
      },
    },
  );
  return {
    approvalReceiptId: data.approveAgencyProposal.approvalReceiptId,
    proposal: agencyProposalFromWire(data.approveAgencyProposal.proposal),
  };
}

export async function undoAgencyApproval(input: {
  tenantId: string;
  proposalId: string;
  approvalReceiptId: string;
  reason: string;
}): Promise<AgencyProposalModel> {
  const data = await gql<{ undoAgencyApproval: AgencyProposalWire }>(
    `mutation UndoAgencyApproval($input: AgencyProposalApprovalUndoInput!) {
      undoAgencyApproval(input: $input) { ${PROPOSAL_FIELDS} }
    }`,
    {
      input: {
        tenantId: requiredTenant(input.tenantId),
        proposalId: input.proposalId,
        approvalReceiptId: input.approvalReceiptId,
        reason: input.reason,
      },
    },
  );
  return agencyProposalFromWire(data.undoAgencyApproval);
}

export async function dismissAgencyProposal(input: {
  tenantId: string;
  proposalId: string;
  reason: string;
}): Promise<AgencyProposalModel> {
  const data = await gql<{ dismissAgencyProposal: AgencyProposalWire }>(
    `mutation DismissAgencyProposal($input: AgencyProposalDecisionInput!) {
      dismissAgencyProposal(input: $input) { ${PROPOSAL_FIELDS} }
    }`,
    {
      input: {
        tenantId: requiredTenant(input.tenantId),
        proposalId: input.proposalId,
        reason: input.reason,
      },
    },
  );
  return agencyProposalFromWire(data.dismissAgencyProposal);
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
    {
      input: {
        tenantId: requiredTenant(input.tenantId),
        proposalId: input.proposalId,
        reason: input.reason,
      },
    },
  );
  return data.suppressAgencyProposal;
}
