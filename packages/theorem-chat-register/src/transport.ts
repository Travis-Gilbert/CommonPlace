// SOURCING: none. SPEC-THEOREM-CHAT-REGISTER-1.0 §2 ChatTransport.
/**
 * Injectable transport: console posts to `/api/chat/stream`; Studio uses hosted
 * ACP. The register never imports OpenWork or opencode.
 */

export type ChatTransport = {
  /** Open (or resume) a session. Returns a stable session id. */
  openSession(): Promise<string>;
  /**
   * Send one user turn. Call `onDelta` with assistant text chunks as they
   * arrive; resolve when the turn completes.
   */
  prompt(
    sessionId: string,
    text: string,
    onDelta: (chunk: string) => void,
  ): Promise<void>;
  dispose(): void;
};
