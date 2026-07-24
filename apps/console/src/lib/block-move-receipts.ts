// SOURCING: none. DOM-visible move receipt counter for B10 acceptance #7.

const ATTR = 'data-block-move-receipts';

/** Increment the document-level count of applied block move receipts. */
export function recordBlockMoveReceipts(count: number): void {
  if (typeof document === 'undefined' || count <= 0) return;
  const current = Number(document.documentElement.getAttribute(ATTR) ?? '0');
  document.documentElement.setAttribute(ATTR, String(current + count));
}

export function readBlockMoveReceiptCount(): number {
  if (typeof document === 'undefined') return 0;
  return Number(document.documentElement.getAttribute(ATTR) ?? '0');
}

export function resetBlockMoveReceipts(): void {
  if (typeof document === 'undefined') return;
  document.documentElement.setAttribute(ATTR, '0');
}
