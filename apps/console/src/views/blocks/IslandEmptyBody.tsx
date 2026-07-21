'use client';

// SOURCING: hand-roll. Designed empty state for declared blocks
// (HANDOFF-CONSOLE-BLOCK-SYSTEM B8): header band + body, never an error string.

export function IslandEmptyBody({
  title,
  detail,
}: {
  readonly title: string;
  readonly detail: string;
}) {
  return (
    <div
      data-island-empty
      className="flex h-full min-h-0 flex-col items-start justify-center gap-2 px-4 py-6 text-ij-ink"
    >
      <p
        className="text-[length:var(--ij-font-size)] font-medium text-ij-ink"
        style={{ fontFamily: 'var(--cp-font-human)', fontWeight: 600 }}
      >
        {title}
      </p>
      <p className="max-w-prose text-ij-ink-info" style={{ fontFamily: 'var(--ij-font-ui)' }}>
        {detail}
      </p>
    </div>
  );
}
