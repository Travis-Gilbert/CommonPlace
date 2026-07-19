import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { agencyProposalFromWire, type AgencyProposalModel } from '@/lib/agencyProposal';
import { AgencyProposalFixtureSurface } from './AgencyProposalFixtureSurface';
import { WhyTrace } from './WhyTrace';

const fixture: AgencyProposalModel = {
  id: 'agency-proposal:appeal-deadline',
  tenantId: 'Travis-Gilbert',
  whatChanged: 'The appeal deadline moved earlier.',
  goalRefs: ['goal:protect-appeal'],
  stakeRefs: ['stake:appeal'],
  actionClass: 'email.prepare_draft',
  executorId: 'fixture.email.prepare_draft',
  effectContractId: 'email.prepare_draft',
  effectContractHash: 'contract:email-draft',
  disclosures: [{ id: 'visible-artifact', text: 'This creates a visible mailbox draft.' }],
  payloadHash: 'payload:1',
  previewRef: 'preview:email-draft-1',
  targetIdentity: 'mailbox:draft:appeal',
  evidenceRefs: ['cas:annotation:deadline'],
  counterEvidenceRefs: ['cas:annotation:deadline-ambiguous'],
  assumptionEnvironments: [['assumption:source-reliable']],
  assumptionLabelComplete: false,
  constraintRefs: ['constraint:appeal-window'],
  verifierReceiptRefs: ['verification:deadline'],
  riskTier: 'moderate',
  permission: 'awaiting_approval',
  reversibility: 'visible_artifact',
  sourceGraphVersion: 42,
  preconditionHash: 'precondition:1',
  basisHash: 'basis:1',
  expiresAtMs: 1_750_000_060_000,
  state: 'awaiting_approval',
};

describe('agency proposal registry', () => {
  it('renders the reusable fixture card and its full why trace without claiming an exhaustive label', () => {
    const card = renderToStaticMarkup(createElement(AgencyProposalFixtureSurface, { proposal: fixture }));
    const trace = renderToStaticMarkup(createElement(WhyTrace, { proposal: fixture, initiallyOpen: true }));

    expect(card).toContain('The appeal deadline moved earlier.');
    expect(card).toContain('This creates a visible mailbox draft.');
    expect(card).toContain('Approve');
    expect(card).toContain('Dismiss');
    expect(trace).toContain('cas:annotation:deadline');
    expect(trace).toContain('cas:annotation:deadline-ambiguous');
    expect(trace).toContain('assumption:source-reliable');
    expect(trace).toContain('Within the explored frontier');
    expect(trace).not.toContain('all possible');
  });

  it('normalizes the durable GraphQL projection rather than inventing authority fields client-side', () => {
    const projected = agencyProposalFromWire({
      ...fixture,
      disclosures: fixture.disclosures,
      assumptionEnvironments: fixture.assumptionEnvironments,
      riskTier: fixture.riskTier,
      permission: fixture.permission,
      reversibility: fixture.reversibility,
      state: fixture.state,
    });

    expect(projected.effectContractHash).toBe('contract:email-draft');
    expect(projected.assumptionLabelComplete).toBe(false);
    expect(projected.permission).toBe('awaiting_approval');
  });
});
