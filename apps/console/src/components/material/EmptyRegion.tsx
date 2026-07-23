'use client';

// SOURCING: hand-roll. SPEC-MATERIAL-REGISTER-1.0 named choice 9 / D7:
// empty is a state with a shape: sunken floor, named cause, resolving action.

export type EmptyCause = 'no-results' | 'not-loaded' | 'not-connected';

const CAUSE_COPY: Record<EmptyCause, { title: string; detail: string }> = {
  'no-results': {
    title: 'No results.',
    detail: 'Cause: the current filter or query returned nothing.',
  },
  'not-loaded': {
    title: 'Nothing loaded.',
    detail: 'Cause: content has not been fetched or selected yet.',
  },
  'not-connected': {
    title: 'Not connected.',
    detail: 'Cause: the backing service is unreachable or not configured.',
  },
};

export function EmptyRegion({
  cause,
  title,
  detail,
  actionLabel,
  onAction,
  className = '',
}: {
  readonly cause: EmptyCause;
  readonly title?: string;
  readonly detail?: string;
  readonly actionLabel?: string;
  readonly onAction?: () => void;
  readonly className?: string;
}) {
  const defaults = CAUSE_COPY[cause];
  return (
    <div
      data-empty-cause={cause}
      data-elevation="sunken"
      className={`flex h-full min-h-0 flex-col items-start justify-center gap-2 bg-ij-editor text-ij-ink ${className}`.trim()}
    >
      <p
        className="text-ij-island-section font-ij-ui text-ij-ink"
        style={{ fontWeight: 600 }}
      >
        {title ?? defaults.title}
      </p>
      <p className="max-w-prose text-ij-ink-info font-ij-ui">{detail ?? defaults.detail}</p>
      {actionLabel && onAction ? (
        <button
          type="button"
          onClick={onAction}
          className="mt-1 h-ij-control rounded-ij-arc border border-ij-control-border bg-ij-raised px-3 text-ij-ink hover:bg-ij-hover-surface"
        >
          {actionLabel}
        </button>
      ) : null}
    </div>
  );
}
