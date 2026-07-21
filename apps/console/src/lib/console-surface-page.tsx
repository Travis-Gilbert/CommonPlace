// SOURCING: none. Shared console page: mounts ConsoleApp with server proactivity seed.
import { ConsoleApp } from '@/components/ConsoleApp';
import { readProactivityGraph } from '@/lib/server/proactivity-harness';

export default async function ConsoleSurfacePage() {
  const projection = await readProactivityGraph();
  return (
    <ConsoleApp
      initialProactivity={projection.ok
        ? { graph: projection.graph, error: null }
        : { graph: null, error: projection.error }}
    />
  );
}
