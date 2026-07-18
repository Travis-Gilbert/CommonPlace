'use client';

import { useShellStore } from '@/lib/shell-store';
import { useThreadStore } from '@/lib/thread-store';

export async function submitThreadText(rawText: string): Promise<void> {
  const text = rawText.trim();
  if (!text) return;
  if (/^\/do\b/i.test(text)) {
    useShellStore.getState().openActionSheet({
      instruction: text.replace(/^\/do\b/i, '').trim(),
      chips: [],
    });
    return;
  }
  await useThreadStore.getState().send(text);
}
