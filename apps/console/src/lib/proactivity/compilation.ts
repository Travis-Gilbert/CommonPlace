// SOURCING: zod. ACP text must be reduced to a narrowly typed, reviewable
// candidate set before the Console stages it. Invalid model output remains a
// named failed compilation; it never becomes a permissive graph patch.

import { z } from 'zod';
import type { ProactivityCompilationCandidate } from './types';

export const proactivityCompilationCandidatesSchema = z.array(z.object({
  kind: z.enum(['watch', 'judgment', 'response']),
  label: z.string().trim().min(1).max(500),
  condition: z.string().trim().min(1).max(500).optional(),
  class: z.string().trim().min(1).max(500).optional(),
  actionClass: z.string().trim().min(1).max(500).optional(),
}).strict()).min(1).max(12);

const compilationEnvelopeSchema = z.object({
  candidates: proactivityCompilationCandidatesSchema,
}).strict();

function unframeJson(text: string): string {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  return (fenced?.[1] ?? text).trim();
}

/** Parse the model's constrained JSON result without accepting surrounding
 * natural language or silently inventing a candidate set. */
export function parseProactivityCompilation(text: string): readonly ProactivityCompilationCandidate[] {
  const parsed = JSON.parse(unframeJson(text)) as unknown;
  return compilationEnvelopeSchema.parse(parsed).candidates;
}
