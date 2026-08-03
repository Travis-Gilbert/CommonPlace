// SOURCING: none. Resolves pack endpoint settings with env overrides for the
// hosted /IDE code-server door (Cursor-shaped: settings + process env).

import type { WorkspaceConfiguration } from 'vscode';

export interface TheoremPackConfig {
  readonly graphqlUrl: string;
  readonly invalidationsUrl?: string;
  readonly projectId?: string;
  readonly consoleOrigin: string;
  readonly agentUrl: string;
  readonly token?: string;
}

function env(name: string): string | undefined {
  try {
    const value = (globalThis as { process?: { env?: Record<string, string | undefined> } })
      .process
      ?.env?.[name]
      ?.trim();
    return value && value.length > 0 ? value : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Settings win only when env is unset. Hosted workspace entrypoint writes both;
 * env is the durable path that avoids putting secrets only in settings.json.
 */
export function resolveTheoremPackConfig(config: WorkspaceConfiguration): TheoremPackConfig {
  const graphqlUrl =
    env('THEOREM_EDITOR_GRAPHQL_URL')
    ?? config.get<string>('graphqlUrl')
    ?? 'https://commonplace-api-production.up.railway.app/graphql';

  const invalidationsUrl =
    env('THEOREM_EDITOR_INVALIDATIONS_URL')
    ?? (config.get<string>('invalidationsUrl') || undefined);

  const projectId =
    env('THEOREM_EDITOR_PROJECT_ID')
    ?? (config.get<string>('projectId') || undefined);

  const consoleOrigin =
    env('THEOREM_CONSOLE_ORIGIN')
    ?? config.get<string>('consoleOrigin')
    ?? 'https://v2.theoremharness.com';

  const agentUrl =
    env('THEOREM_ACP_WS_URL')
    ?? config.get<string>('agentUrl')
    ?? consoleOrigin;

  const token =
    env('THEOREM_EDITOR_API_KEY')
    ?? env('THEOREM_ACP_TOKEN')
    ?? (config.get<string>('token') || undefined);

  return {
    graphqlUrl,
    ...(invalidationsUrl ? { invalidationsUrl } : {}),
    ...(projectId ? { projectId } : {}),
    consoleOrigin,
    agentUrl,
    ...(token ? { token } : {}),
  };
}
