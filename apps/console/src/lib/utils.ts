// SOURCING: shadcn/ui `cn` (ui.shadcn.com, MIT), the canonical class merger
// every registry component imports from the `utils` alias in components.json.
// clsx resolves conditional class expressions; tailwind-merge resolves the
// later-wins conflict so a caller's className actually overrides a CVA variant
// rather than landing in an undefined order. Both are ledger rows; nothing here
// is hand-rolled and nothing here paints.

import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
