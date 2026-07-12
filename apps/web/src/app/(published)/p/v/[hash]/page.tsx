import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { gqlPublishedBlockVersion, type PublishedBlockGql } from '@/lib/commonplace-graphql';
import { PublishedBody } from '../../../_components/PublishedBody';
import { VerifiedBlock } from '../../../_components/VerifiedBlock';
import styles from '../../../published.module.css';

export const dynamic = 'force-dynamic';

type Params = { params: Promise<{ hash: string }> };

function blockText(block: PublishedBlockGql): string | null {
  const payload = block.payload as { text?: string | null } | null;
  const text = payload?.text;
  return typeof text === 'string' && text.trim().length > 0 ? text : null;
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { hash } = await params;
  const block = await gqlPublishedBlockVersion(decodeURIComponent(hash));
  if (!block) return { title: 'CommonPlace', robots: { index: false, follow: false } };
  // Permanent version URLs are not indexed; the alias is the canonical entry.
  return {
    title: `${block.title} (version) · CommonPlace`,
    robots: { index: false, follow: false },
  };
}

/**
 * Permanent, version-addressed projection (HANDOFF-PUBLISH D1). A version URL
 * that was ever public resolves forever, even after the alias is unpublished or
 * re-pointed. It is a frozen snapshot: no doorway, no live visibility.
 */
export default async function PublishedVersionPage({ params }: Params) {
  const { hash } = await params;
  const block = await gqlPublishedBlockVersion(decodeURIComponent(hash));
  if (!block) notFound();

  const text = blockText(block);
  return (
    <article className={styles.page}>
      <div className={styles.kicker}>{block.shapeId} · pinned version</div>
      <h1 className={styles.title}>{block.title}</h1>
      <PublishedBody payload={block.payload} text={text} kind={block.shapeId} />
      <VerifiedBlock
        blockId={block.blockId}
        versionHash={block.versionHash}
        visibility={block.visibility}
        conformance={block.conformance}
        attestation={block.attestation}
        signatureVerified={block.signatureVerified}
      />
    </article>
  );
}
