// SOURCING: none. SPEC-COMMONPLACE-CHAT-SHELL-1.2 SH6/SH7 context provenance.

export type ContextProvenance =
  | 'user'
  | 'retrieved'
  | 'encoded'
  | 'data-science';

export const CONTEXT_PROVENANCE_LABEL: Record<ContextProvenance, string> = {
  user: 'user added',
  retrieved: 'retrieved',
  encoded: 'encoded',
  'data-science': 'data science',
};

export interface ContextEntry {
  readonly id: string;
  readonly label: string;
  readonly objectType?: string;
  readonly provenance: ContextProvenance;
  readonly included: boolean;
  readonly unavailable?: boolean;
  readonly parentId?: string | null;
}

export interface ContextFolder {
  readonly id: string;
  readonly label: string;
  readonly entries: readonly ContextEntry[];
  readonly unavailable?: boolean;
}
