// SOURCING: toolMeta registry pattern (fathah/hermes-desktop MIT shape),
// reimplemented against Theorem affordance names
// (SPEC-CONSOLE-COMPONENT-SOURCING-1.0 SC3). Unknown tools render through the
// default entry rather than raw JSON.

export type ToolMetaPresentation = 'json' | 'markdown' | 'text' | 'hidden';

export type ToolMeta = {
  readonly name: string;
  readonly label: string;
  readonly presentation: ToolMetaPresentation;
};

const DEFAULT_META: ToolMeta = {
  name: '*',
  label: 'Tool',
  presentation: 'json',
};

const REGISTRY: Record<string, ToolMeta> = {
  '*': DEFAULT_META,
  recall: { name: 'recall', label: 'Recall', presentation: 'markdown' },
  remember: { name: 'remember', label: 'Remember', presentation: 'text' },
  encode: { name: 'encode', label: 'Encode', presentation: 'text' },
  plan: { name: 'plan', label: 'Plan', presentation: 'markdown' },
  graphql_query: { name: 'graphql_query', label: 'GraphQL query', presentation: 'json' },
  graphql_mutate: { name: 'graphql_mutate', label: 'GraphQL mutate', presentation: 'json' },
};

export function getToolMeta(toolName: string): ToolMeta {
  return REGISTRY[toolName] ?? DEFAULT_META;
}

export function registerToolMeta(meta: ToolMeta): void {
  REGISTRY[meta.name] = meta;
}

export function listToolMeta(): readonly ToolMeta[] {
  return Object.values(REGISTRY).filter((entry) => entry.name !== '*');
}
