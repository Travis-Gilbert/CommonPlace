// SOURCING: none. Shared project and thread catalog types for CH3 / CH9.

export interface ChatProject {
  readonly id: string;
  name: string;
  description: string;
  /** Document object ids attached to the project. */
  documentIds: string[];
  /** Object types the project scopes queries to. */
  objectTypes: string[];
  updatedAt: number;
}

export interface ChatThreadSummary {
  readonly id: string;
  projectId: string;
  title: string;
  /** ACP session correlation id when the harness has one. Persisting this
   * value does not prove the backend can reconstruct the session. */
  sessionId: string | null;
  /** Always false until the backend supplies a verified session restoration
   * receipt. Transcript durability is independent of this capability. */
  sessionResumable: false;
  /** Capability pre-bound when the thread was launched from the sidebar. */
  capability: { kind: 'skill' | 'plugin'; id: string; name: string } | null;
  railCollapsed: boolean;
  updatedAt: number;
  /** Scroll position restored on reload (CH4). */
  scrollTop: number;
}

export interface ChatPersistedMessage {
  readonly id: string;
  readonly role: 'user' | 'assistant';
  readonly text: string;
  readonly incomplete?: boolean;
  readonly artifact?: ChatArtifactPayload | null;
}

export type ChatArtifactPayload =
  | { readonly kind: 'markdown'; readonly markdown: string }
  | { readonly kind: 'code'; readonly language: string; readonly code: string }
  | { readonly kind: 'records'; readonly queryTypes: readonly string[] }
  | { readonly kind: 'plan'; readonly steps: readonly { id: string; label: string; status: string }[] }
  | { readonly kind: 'data-model'; readonly title: string };

export interface ChatThreadRecord extends ChatThreadSummary {
  messages: ChatPersistedMessage[];
}

export interface ChatCatalog {
  projects: ChatProject[];
  threads: ChatThreadRecord[];
  activeProjectId: string | null;
}
