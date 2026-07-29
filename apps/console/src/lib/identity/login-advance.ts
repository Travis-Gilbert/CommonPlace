// SOURCING: none. Pure post-auth advance for the login card. Chat and root
// routes require a signed active-workspace cookie; bouncing to /chat without
// minting that claim reloads /login in a tight loop.

export interface LoginAdvanceWorkspace {
  readonly id: string;
  readonly slug: string;
}

export function workspaceIdFromCallback(
  callbackUrl: string,
  workspaces: readonly LoginAdvanceWorkspace[],
): string | null {
  const match = /^\/workspace\/([^/?#]+)/.exec(callbackUrl);
  if (!match) return null;
  let ref: string;
  try {
    ref = decodeURIComponent(match[1] ?? '');
  } catch {
    return null;
  }
  const hit = workspaces.find(
    (workspace) => workspace.id === ref || workspace.slug === ref,
  );
  return hit?.id ?? null;
}

export async function advanceAuthenticatedLogin(input: {
  readonly onboardingComplete: boolean;
  readonly workspaces: readonly LoginAdvanceWorkspace[];
  readonly callbackUrl: string;
  readonly select: (workspaceId: string) => Promise<unknown>;
  readonly assign: (url: string) => void;
}): Promise<void> {
  if (!input.onboardingComplete || input.workspaces.length === 0) {
    input.assign('/onboarding');
    return;
  }
  const workspaceId =
    workspaceIdFromCallback(input.callbackUrl, input.workspaces)
    ?? input.workspaces[0]!.id;
  await input.select(workspaceId);
  input.assign(`/workspace/${encodeURIComponent(workspaceId)}/chat`);
}
