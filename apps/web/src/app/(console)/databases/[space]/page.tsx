import { notFound } from 'next/navigation';
import { join } from 'node:path';
import { importSpace } from '@/lib/block-view/anytype/import';
import { withSeeds } from '@/lib/block-view/database/seed';
import { DatabaseSurface } from '@/lib/block-view/database/DatabaseSurface';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const SPACES = new Set(['movie_database', 'plant_database']);
const EXPORTS = 'src/lib/block-view/anytype/exports';

export default async function DbSpacePage({ params }: { params: Promise<{ space: string }> }) {
  const { space } = await params;
  if (!SPACES.has(space)) notFound();
  const graph = withSeeds(importSpace(join(process.cwd(), EXPORTS, space), space));
  return <DatabaseSurface graph={graph} />;
}
