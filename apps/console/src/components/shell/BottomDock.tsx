'use client';

// SOURCING: hand-roll. JetBrains Islands bottom dock silhouette (Terminal /
// Problems / Run). Honest empty frame until a real bottom tool window wires
// in; header and plane only, no theater.

export function BottomDock() {
  return (
    <section
      aria-label="Terminal"
      data-bottom-dock
      data-island="tool"
      data-paint-region="tool-window"
      className="flex h-ij-bottom-dock shrink-0 flex-col overflow-hidden rounded-ij-island bg-transparent"
    >
      <div
        data-tool-window-header
        data-paint-region="tool-window-header"
        className="flex h-ij-toolwindow-header shrink-0 items-center gap-2 border-b border-ij-seam bg-transparent px-3 text-ij-ink"
        style={{ fontFamily: 'var(--cp-font-human)', fontWeight: 600 }}
      >
        <span className="min-w-0 flex-1 truncate">Terminal</span>
        <span className="font-ij-mono text-ij-ink-info">zsh</span>
      </div>
      <div className="min-h-0 flex-1 px-3 py-2 font-ij-mono text-ij-ink-info" data-bottom-dock-body />
    </section>
  );
}
