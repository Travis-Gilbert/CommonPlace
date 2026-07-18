export type AgencyAction = 'approve' | 'edit' | 'dismiss' | 'suppress' | 'grant';

export type AgencyDisclosure = { id: string; text: string };

export type AgencyProposal = {
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
};

export type AgencyEvidence = {
  reference: string;
  source: Record<string, unknown>;
  archiveContentHash: string | null;
  archiveBody: string | null;
};

export type ApprovalReceipt = {
  approvalReceiptId: string;
  proposal: AgencyProposal;
};

export function isReversibleSwipe(proposal: AgencyProposal): boolean {
  return proposal.reversibility === 'reversible' || proposal.reversibility === 'reversible_effect';
}
