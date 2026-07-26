// SOURCING: none. Pure logic. CH4 transcript pin rules.

export interface ScrollPinState {
  readonly pinned: boolean;
  readonly showReturn: boolean;
}

/** Distance from bottom (px) within which the transcript stays pinned. */
export const PIN_THRESHOLD_PX = 48;

export function scrollPinFromMetrics(params: {
  readonly scrollTop: number;
  readonly clientHeight: number;
  readonly scrollHeight: number;
  readonly streaming: boolean;
}): ScrollPinState {
  const distance = params.scrollHeight - (params.scrollTop + params.clientHeight);
  const nearBottom = distance <= PIN_THRESHOLD_PX;
  if (nearBottom) return { pinned: true, showReturn: false };
  return { pinned: false, showReturn: true };
}

export function shouldAutoScroll(pinned: boolean, streaming: boolean): boolean {
  return pinned && streaming;
}
