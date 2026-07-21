// SOURCING: clsx + tailwind-merge (shadcn cn helper). Class merge for register-
// token class strings; no color logic lives here.

import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
