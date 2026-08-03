'use client';

// SOURCING: none. SPEC-COMMONPLACE-PRODUCTION-CUTOVER-1.0 GL6.
// Chat register body after the assistant-ui displacement. When the console
// proxies /chat to the workspace openwork door, this component is not what the
// browser paints. It remains the registry fallback for in-shell panes and for
// deploys where CONSOLE_WORKSPACE_URL is unset.

export function OpenworkChatRegister({
  reason = 'Open the Chat place at /chat. The vendored openwork register is served there under the console session.',
}: {
  readonly reason?: string;
}) {
  return (
    <div
      className="flex h-full min-h-0 flex-col items-center justify-center gap-3 bg-ij-editor p-6 text-ij-ink"
      data-register-impl="openwork.chat"
      data-openwork-chat-register
    >
      <p style={{ fontWeight: 'var(--rec-weight-cap)' }}>Openwork chat register</p>
      <p className="max-w-md text-center text-sm text-ij-ink-info">{reason}</p>
      <a
        className="h-ij-control rounded-ij-arc border border-ij-control-border px-3 leading-ij-control text-ij-link"
        href="/chat"
      >
        Open /chat
      </a>
    </div>
  );
}
