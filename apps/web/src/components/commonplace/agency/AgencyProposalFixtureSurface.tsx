'use client';

import type { AgencyProposalModel } from '@/lib/agencyProposal';
import { viewState } from '@/lib/commonplace-view-state';
import { AgencyProposalRegistry } from './AgencyProposalRegistry';

/** Fixture-only second consumer that proves the card and why-trace are reusable. */
export function AgencyProposalFixtureSurface({ proposal }: { proposal: AgencyProposalModel }) {
  return <AgencyProposalRegistry state={viewState.success([proposal])} />;
}
