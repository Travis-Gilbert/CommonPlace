'use client';

import { useShellStore } from '@/lib/shell-store';
import { useThreadStore } from '@/lib/thread-store';

export function actionInstructionFromThreadText(rawText: string): string | null {
  const text = rawText.trim();
  if (!/^\/do\b/i.test(text)) return null;
  return text.replace(/^\/do\b/i, '').trim();
}

export async function submitThreadText(rawText: string): Promise<void> {
  const text = rawText.trim();
  if (!text) return;
  const instruction = actionInstructionFromThreadText(text);
  if (instruction !== null) {
    useShellStore.getState().openActionSheet({
      instruction,
      chips: [],
    });
    return;
  }
  await useThreadStore.getState().send(text);
}
