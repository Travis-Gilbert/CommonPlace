// SOURCING: none. Route entry for saved views (CS6).
import { redirect } from 'next/navigation';
import { ConsoleApp } from '@/components/ConsoleApp';
import { readProactivityGraph } from '@/lib/server/proactivity-harness';
import { SEED_VIEW_SLUGS } from '@/lib/seed-views';

export default async function ViewPage({
  params,
}: {
  params: Promise<{ viewId: string }>;
}) {
  const { viewId } = await params;
  const slug = decodeURIComponent(viewId);
  if (!slug) redirect('/v/chat');

  const projection = await readProactivityGraph();
  return (
    <ConsoleApp
      initialViewId={slug}
      initialProactivity={projection.ok
        ? { graph: projection.graph, error: null }
        : { graph: null, error: projection.error }}
    />
  );
}

export function generateStaticParams() {
  return SEED_VIEW_SLUGS.map((viewId) => ({ viewId }));
}
