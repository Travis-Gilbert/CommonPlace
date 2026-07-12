/**
 * Five-state view discipline (SPEC-UX-PHYSICS D4), mobile mirror of
 * apps/web/src/lib/commonplace-view-state.ts. Every read-bearing surface
 * resolves to exactly one of five states, so no surface can ship a raw spinner,
 * an undesigned empty, or a silent error. `partial` renders what already exists
 * while the rest streams. The wait-tier ladder (./waitTier) refines the
 * `loading` branch; it does not replace this union.
 *
 * Pure TS, no React. Same five statuses and discriminant shape as the web copy.
 */

export type ViewStatus = 'empty' | 'loading' | 'partial' | 'error' | 'success';

export type ViewState<T> =
  | { readonly status: 'empty' }
  | { readonly status: 'loading' }
  | { readonly status: 'partial'; readonly data: T }
  | { readonly status: 'error'; readonly message: string; readonly retry?: () => void }
  | { readonly status: 'success'; readonly data: T };

/** Constructors, so call sites never hand-shape the discriminant. */
export const viewState = {
  empty: (): ViewState<never> => ({ status: 'empty' }),
  loading: (): ViewState<never> => ({ status: 'loading' }),
  partial: <T>(data: T): ViewState<T> => ({ status: 'partial', data }),
  error: (message: string, retry?: () => void): ViewState<never> => ({ status: 'error', message, retry }),
  success: <T>(data: T): ViewState<T> => ({ status: 'success', data }),
} as const;

/** True for the two states that carry a data payload (partial and success). */
export function hasData<T>(state: ViewState<T>): state is Extract<ViewState<T>, { data: T }> {
  return state.status === 'partial' || state.status === 'success';
}

/** True once the surface has reached a resting state (nothing more is loading). */
export function isSettled<T>(state: ViewState<T>): boolean {
  return state.status === 'success' || state.status === 'error' || state.status === 'empty';
}

/** Map the data payload of the states that carry one; other states pass through. */
export function mapViewState<T, U>(state: ViewState<T>, fn: (data: T) => U): ViewState<U> {
  if (state.status === 'partial') return { status: 'partial', data: fn(state.data) };
  if (state.status === 'success') return { status: 'success', data: fn(state.data) };
  return state;
}

/**
 * Derive a ViewState from the pieces most read hooks already expose. Data present
 * with loading still true is `partial` (show what we have, keep revalidating);
 * data present with loading finished is `success` or `empty` (via isEmpty). This
 * is the seam that lets local-first reads render `partial` from cache while the
 * network revalidates in the background.
 */
export function deriveViewState<T>(input: {
  readonly data: T | null | undefined;
  readonly loading: boolean;
  readonly error?: string | null;
  readonly retry?: () => void;
  readonly isEmpty?: (data: T) => boolean;
}): ViewState<T> {
  const { data, loading, error, retry, isEmpty } = input;
  if (error) return { status: 'error', message: error, retry };
  if (data != null) {
    if (loading) return { status: 'partial', data };
    if (isEmpty?.(data)) return { status: 'empty' };
    return { status: 'success', data };
  }
  if (loading) return { status: 'loading' };
  return { status: 'empty' };
}
