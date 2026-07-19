// SOURCING: none. Route entry; the shell composition mounts here.
import { ConsoleApp } from '@/components/ConsoleApp';
import { readProactivityGraph } from '@/lib/server/proactivity-harness';

export default async function Page() {
  const projection = await readProactivityGraph();
  return (
    <ConsoleApp
      initialProactivity={projection.ok
        ? { graph: projection.graph, error: null }
        : { graph: null, error: projection.error }}
    />
  );
}
