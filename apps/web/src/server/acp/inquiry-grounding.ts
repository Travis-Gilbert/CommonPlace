// SOURCING: none — pure logic, no upstream component applies
/**
 * Server-side inquiry grounding for console /chat before the ACP prompt.
 * Mirrors AgentThreadView's createInquiry + groundedChatPrompt path without
 * requiring a browser round-trip through /api/theorem/inquiries.
 */

import {
  forwardAuthHeaders,
  localInquiryUrl,
} from '@/app/api/theorem/inquiries/_upstream';
import { groundedChatPrompt } from '@/lib/inquiry-agent-bridge';
import type { CreateInquiryResponse, InquirySnapshot } from '@/lib/inquiry-types';

export async function groundChatPrompt(
  userText: string,
  authRequest?: Request,
): Promise<{ prompt: string; snapshot: InquirySnapshot | null }> {
  try {
    const res = await fetch(localInquiryUrl('/v1/inquiries'), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...forwardAuthHeaders(authRequest ?? new Request('http://localhost')),
      },
      body: JSON.stringify({
        query: userText,
        surface: 'chat',
        scope_refs: [],
        retrieval_budget: 'standard',
        parent_snapshot_id: null,
      }),
      cache: 'no-store',
    });
    if (!res.ok) {
      return { prompt: userText, snapshot: null };
    }
    const payload = (await res.json()) as CreateInquiryResponse;
    if (!payload?.snapshot) {
      return { prompt: userText, snapshot: null };
    }
    return {
      prompt: groundedChatPrompt(userText, payload.snapshot),
      snapshot: payload.snapshot,
    };
  } catch {
    return { prompt: userText, snapshot: null };
  }
}
