'use client';

import { useMemo } from 'react';
import { FileSystem, type FileSystemItem } from '@/components/ui/file-system';
import { useApiData } from '@/lib/commonplace-api';
import { gqlItems, type ItemGql } from '@/lib/commonplace-graphql';
import { useCapture } from '@/lib/providers/capture-provider';
import { useDrawer } from '@/lib/providers/drawer-provider';

function normalizeObjectPath(path: string | null | undefined): string | null {
  const clean = path?.trim().replace(/^\/+/, '').replace(/\/+$/, '');
  return clean || null;
}

function pathSegment(value: string): string {
  return (
    value
      .trim()
      .replace(/^\/+|\/+$/g, '')
      .replace(/[/\\?#]+/g, '-')
      .replace(/\s+/g, ' ')
      .slice(0, 96) || 'untitled'
  );
}

function pathName(path: string): string {
  const index = path.lastIndexOf('/');
  return index === -1 ? path : path.slice(index + 1);
}

function filePathFor(item: ItemGql): string {
  const existingPath = normalizeObjectPath(item.path);
  if (existingPath) return existingPath;

  const folder = pathSegment(item.collections[0] ?? item.kind ?? 'items');
  const name = pathSegment(item.title || item.id);
  return `${folder}/${name}`;
}

function metadataFor(item: ItemGql): Record<string, string> {
  return Object.fromEntries(
    [
      ['Kind', item.kind],
      ['Residency', item.residency],
      ['Source', item.source ?? ''],
      ['Classification', item.classification ?? ''],
      ['Tags', item.tags.join(', ')],
    ].filter(([, value]) => value),
  );
}

function isoFromMs(ms: number): string | undefined {
  return ms ? new Date(ms).toISOString() : undefined;
}

function toFileSystemItem(item: ItemGql): FileSystemItem {
  const path = filePathFor(item);
  return {
    kind: 'file',
    id: item.id,
    key: item.blobHash ?? item.id,
    path,
    name: item.title || pathName(path),
    contentType: item.mime ?? undefined,
    createdAt: isoFromMs(item.createdAtMs),
    updatedAt: isoFromMs(item.updatedAtMs),
    metadata: metadataFor(item),
  };
}

export default function FilesView() {
  const { captureVersion } = useCapture();
  const { openDrawer } = useDrawer();
  const { data: items } = useApiData(() => gqlItems(), [captureVersion]);
  const fileItems = useMemo(() => (items ?? []).map(toFileSystemItem), [items]);

  return (
    <div className="h-full overflow-hidden p-4">
      <FileSystem
        items={fileItems}
        title="Commonplace"
        defaultView="columns"
        className="h-full"
        onFileOpen={(file) => {
          if (file.id) openDrawer(file.id);
        }}
      />
    </div>
  );
}
