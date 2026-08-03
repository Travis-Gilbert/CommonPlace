'use client';

// SOURCING: none. Fallback when the Railway edge proxy has no IDE upstream.
// Production paints code-server through /IDE (WebSocket edge), not this body.

export function IdeRegister({
  reason = 'Open the IDE place at /IDE. The workspace code-server door is served there under the console session.',
}: {
  readonly reason?: string;
}) {
  return (
    <div
      className="flex h-full min-h-0 flex-col items-center justify-center gap-3 bg-ij-editor p-6 text-ij-ink"
      data-register-impl="code-server.ide"
      data-ide-register
    >
      <p style={{ fontWeight: 'var(--rec-weight-cap)' }}>IDE register</p>
      <p className="max-w-md text-center text-sm text-ij-ink-info">{reason}</p>
      <a
        className="h-ij-control rounded-ij-arc border border-ij-control-border px-3 leading-ij-control text-ij-link"
        href="/IDE"
      >
        Open /IDE
      </a>
      <p className="max-w-md text-center text-xs text-ij-ink-info">
        Graph-native CodeMirror editing stays on /workspace. This door is the full VS Code workbench.
      </p>
    </div>
  );
}
