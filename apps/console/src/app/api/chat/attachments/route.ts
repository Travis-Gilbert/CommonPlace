// SOURCING: none. Attachment upload with real byte progress (CH5). No
// fabricated progress intervals.

import { randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const UPLOAD_DIR = path.join(process.cwd(), '.data', 'chat-attachments');

const GLOBAL_KEY = Symbol.for('commonplace.console.chat-attachments');

interface AttachmentMeta {
  readonly id: string;
  readonly name: string;
  readonly size: number;
  readonly type: string;
  readonly path: string;
  readonly createdAt: number;
}

function registry(): Map<string, AttachmentMeta> {
  const root = globalThis as typeof globalThis & { [GLOBAL_KEY]?: Map<string, AttachmentMeta> };
  root[GLOBAL_KEY] ??= new Map();
  return root[GLOBAL_KEY]!;
}

export async function POST(request: Request): Promise<Response> {
  try {
    const form = await request.formData();
    const file = form.get('file');
    if (!(file instanceof File)) {
      return Response.json({ error: 'file_required' }, { status: 400 });
    }
    await mkdir(UPLOAD_DIR, { recursive: true });
    const id = randomUUID();
    const safeName = file.name.replace(/[^\w.\-]+/g, '_');
    const dest = path.join(UPLOAD_DIR, `${id}-${safeName}`);
    const buffer = Buffer.from(await file.arrayBuffer());
    await writeFile(dest, buffer);
    const meta: AttachmentMeta = {
      id,
      name: file.name,
      size: buffer.byteLength,
      type: file.type || 'application/octet-stream',
      path: dest,
      createdAt: Date.now(),
    };
    registry().set(id, meta);
    return Response.json({
      id: meta.id,
      name: meta.name,
      size: meta.size,
      type: meta.type,
    });
  } catch (error) {
    return Response.json(
      {
        error: 'attachment_upload_failed',
        message: error instanceof Error ? error.message : 'upload failed',
      },
      { status: 502 },
    );
  }
}
