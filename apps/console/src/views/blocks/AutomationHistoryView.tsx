'use client';

// SOURCING: jal-co/ui CommitGraph at components/jalco/commit-graph (B7 reskin).
// Run and dispatch ObjectRefs arrive through the host query seam (projected
// from harness status). Empty body is designed, never an error string.

import type { ObjectRef, ViewRenderProps } from '@commonplace/block-view/types';
import {
  CommitGraph,
  type CommitGraphCommit,
} from '@/components/jalco/commit-graph';
import { BlockEmptyBody } from './BlockEmptyBody';

function toCommit(object: ObjectRef): CommitGraphCommit {
  const refs = Array.isArray(object.properties.refs)
    ? object.properties.refs.map(String)
    : [];
  return {
    id: object.id,
    hash: String(object.properties.hash ?? object.id),
    message: String(object.properties.message ?? object.properties.title ?? object.id),
    author: object.properties.author ? String(object.properties.author) : undefined,
    date: object.properties.date ? String(object.properties.date) : undefined,
    refs,
  };
}

export function AutomationHistoryView({ set }: ViewRenderProps) {
  const commits = set.objects
    .slice()
    .sort((a, b) => Number(a.properties.order ?? 0) - Number(b.properties.order ?? 0))
    .map(toCommit);

  if (commits.length === 0) {
    return (
      <BlockEmptyBody
        title="Automation history"
        detail="No runs or dispatches in the harness status projection yet. When the status seam reports activity, it appears here as a commit rail."
      />
    );
  }

  return (
    <div data-automation-history className="flex h-full min-h-0 flex-col">
      <CommitGraph commits={commits} className="min-h-0 flex-1 border-0" />
    </div>
  );
}
