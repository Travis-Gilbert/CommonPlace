import { readFile } from 'node:fs/promises';
import { join, basename, extname } from 'node:path';

export const runtime = 'nodejs';

const MIME: Record<string, string> = {
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.webp': 'image/webp', '.gif': 'image/gif', '.svg': 'image/svg+xml',
};
const EXPORTS = 'src/lib/block-view/anytype/exports';

export async function GET(_req: Request, { params }: { params: Promise<{ space: string; name: string }> }) {
  const { space, name } = await params;
  if (!/^[a-z_]+_database$/.test(space)) return new Response('not found', { status: 404 });
  const safe = basename(name); // block path traversal
  try {
    const buf = await readFile(join(process.cwd(), EXPORTS, space, 'files', safe));
    return new Response(new Uint8Array(buf), {
      headers: {
        'content-type': MIME[extname(safe).toLowerCase()] ?? 'application/octet-stream',
        'cache-control': 'public, max-age=3600',
      },
    });
  } catch {
    return new Response('not found', { status: 404 });
  }
}
