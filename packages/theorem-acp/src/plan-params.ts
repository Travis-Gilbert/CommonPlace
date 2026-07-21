/**
 * Promotion parameter candidates: string literals and target references in
 * task specs are flagged for review during save-as-program.
 */

import type { PlanCanvasSnapshot, PlanTask } from './plan-state';

export type ParamCandidateKind = 'literal' | 'target_ref';

export type ParamCandidate = {
  id: string;
  kind: ParamCandidateKind;
  taskId: string;
  field: 'title' | 'description' | 'acceptance';
  value: string;
  label: string;
};

const TARGET_REF = /\b(?:task|plan|run|program|theorem):[A-Za-z0-9_./:@-]+\b/g;
const QUOTED_LITERAL = /"([^"\n]{2,120})"|'([^'\n]{2,120})'/g;

export type ParamBindings = Record<string, string>;

export function extractParamCandidates(snapshot: PlanCanvasSnapshot): ParamCandidate[] {
  const candidates: ParamCandidate[] = [];
  const seen = new Set<string>();
  for (const task of snapshot.tasks) {
    if (task.status === 'superseded') continue;
    pushField(candidates, seen, task, 'title', task.title);
    pushField(candidates, seen, task, 'description', task.description);
    for (const criterion of task.acceptanceCriteria) {
      pushField(candidates, seen, task, 'acceptance', criterion);
    }
  }
  return candidates;
}

export function applyParamBindings(
  snapshot: PlanCanvasSnapshot,
  candidates: readonly ParamCandidate[],
  bindings: ParamBindings,
): PlanCanvasSnapshot {
  const replacements = candidates
    .map((candidate) => {
      const next = bindings[candidate.id];
      if (typeof next !== 'string' || next === candidate.value) return null;
      return { ...candidate, next, previous: candidate.value };
    })
    .filter((item): item is ParamCandidate & { next: string; previous: string } => item !== null);

  if (replacements.length === 0) return snapshot;

  const tasks = snapshot.tasks.map((task) => {
    let title = task.title;
    let description = task.description;
    let acceptanceCriteria = [...task.acceptanceCriteria];
    for (const replacement of replacements) {
      if (replacement.taskId !== task.id) continue;
      if (replacement.field === 'title') title = title.split(replacement.previous).join(replacement.next);
      if (replacement.field === 'description') {
        description = description.split(replacement.previous).join(replacement.next);
      }
      if (replacement.field === 'acceptance') {
        acceptanceCriteria = acceptanceCriteria.map((criterion) =>
          criterion.split(replacement.previous).join(replacement.next));
      }
    }
    return { ...task, title, description, acceptanceCriteria };
  });

  return { ...snapshot, tasks };
}

function pushField(
  candidates: ParamCandidate[],
  seen: Set<string>,
  task: PlanTask,
  field: ParamCandidate['field'],
  text: string,
): void {
  if (!text.trim()) return;
  for (const match of text.matchAll(TARGET_REF)) {
    const value = match[0];
    const id = `${task.id}:${field}:ref:${value}`;
    if (seen.has(id)) continue;
    seen.add(id);
    candidates.push({
      id,
      kind: 'target_ref',
      taskId: task.id,
      field,
      value,
      label: `${task.alias} ${field} target`,
    });
  }
  for (const match of text.matchAll(QUOTED_LITERAL)) {
    const value = match[1] ?? match[2];
    if (!value) continue;
    const id = `${task.id}:${field}:lit:${value}`;
    if (seen.has(id)) continue;
    seen.add(id);
    candidates.push({
      id,
      kind: 'literal',
      taskId: task.id,
      field,
      value,
      label: `${task.alias} ${field} literal`,
    });
  }
}
