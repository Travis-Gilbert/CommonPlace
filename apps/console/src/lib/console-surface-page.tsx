// SOURCING: none. Shared console page: mounts ConsoleApp with server proactivity seed.
import { ConsoleApp } from '@/components/ConsoleApp';
import { readProactivityGraph } from '@/lib/server/proactivity-harness';
import { resolveHarnessPrincipal } from '@/lib/server/harness-principal';

export default async function ConsoleSurfacePage() {
  const [projection, principal] = await Promise.all([
    readProactivityGraph(),
    resolveHarnessPrincipal(),
  ]);
  return (
    <ConsoleApp
      initialTenant={principal.ok ? principal.principal.tenant : null}
      initialProactivity={projection.ok
        ? { graph: projection.graph, error: null }
        : { graph: null, error: projection.error }}
    />
  );
}
