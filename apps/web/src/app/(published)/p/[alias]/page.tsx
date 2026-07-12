import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { auth } from '@/lib/auth';
import { gqlPublishedBlock, type PublishedBlockGql } from '@/lib/commonplace-graphql';
import { Doorway } from '../../_components/Doorway';
import { GalleyContent } from '../../_components/GalleyContent';
import { VerifiedBlock } from '../../_components/VerifiedBlock';
import styles from '../../published.module.css';

export const dynamic = 'force-dynamic';

type Params = { params: Promise<{ alias: string }> };

async function viewerPrincipal(): Promise<string | null> {
  // A public/unlisted page must render even if auth is unconfigured or down, so
  // a failed session read degrades to anonymous rather than throwing. Instance
  // level identity today: the signed-in principal is the session user. Per-user
  // grant mapping rides on the ambient-identity work; until then a private grant
  // resolves only for a viewer whose id is in the grant.
  try {
    const session = await auth();
    return session?.user?.email ?? (session?.user as { id?: string } | undefined)?.id ?? null;
  } catch {
    return null;
  }
}

function blockText(block: PublishedBlockGql): string | null {
  const payload = block.payload as { text?: string | null } | null;
  const text = payload?.text;
  return typeof text === 'string' && text.trim().length > 0 ? text : null;
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { alias } = await params;
  const resolution = await gqlPublishedBlock(alias, await viewerPrincipal(), false);
  const block = resolution.block;
  if (!block || resolution.status !== 'ok') {
    return { title: 'CommonPlace', robots: { index: false, follow: false } };
  }
  const text = blockText(block);
  const description = text ? text.slice(0, 155) : `A published ${block.shapeId} on CommonPlace.`;
  // public is indexable; unlisted and private carry noindex (D3 P3.2).
  const indexable = block.visibility === 'PUBLIC';
  return {
    title: `${block.title} · CommonPlace`,
    description,
    robots: indexable ? undefined : { index: false, follow: false },
    openGraph: { title: block.title, description, type: 'article' },
  };
}

export default async function PublishedAliasPage({ params }: Params) {
  const { alias } = await params;
  const viewer = await viewerPrincipal();
  const resolution = await gqlPublishedBlock(alias, viewer, true);

  if (resolution.status === 'not_found') {
    notFound();
  }

  if (resolution.status === 'gone') {
    return (
      <div className={styles.state}>
        <h1 className={styles.stateTitle}>This page was unpublished</h1>
        <p className={styles.stateBody}>
          The author took this block down. Its content is no longer served here, though the block
          still exists in its origin space.
        </p>
        <a className={styles.doorwaySecondary} href="/">
          Go to CommonPlace
        </a>
      </div>
    );
  }

  if (resolution.status === 'forbidden') {
    const returnTo = `/p/${alias}`;
    return (
      <div className={styles.state}>
        <h1 className={styles.stateTitle}>This block is private</h1>
        <p className={styles.stateBody}>
          Sign in with an account that has been granted access to view it.
        </p>
        <a
          className={styles.doorwayPrimary}
          href={`/api/auth/signin?callbackUrl=${encodeURIComponent(returnTo)}`}
        >
          Sign in to continue
        </a>
      </div>
    );
  }

  const block = resolution.block!;
  const text = blockText(block);
  const signedIn = Boolean(viewer);
  const canFork = block.visibility !== 'PRIVATE';

  return (
    <article className={styles.page}>
      <div className={styles.kicker}>{block.shapeId}</div>
      <h1 className={styles.title}>{block.title}</h1>
      {text ? (
        <GalleyContent markdown={text} kind={block.shapeId} />
      ) : (
        <div className={`${styles.body} ${styles.bodyEmpty}`}>
          This block has no text content to display.
        </div>
      )}
      <VerifiedBlock
        blockId={block.blockId}
        versionHash={block.versionHash}
        visibility={block.visibility}
        conformance={block.conformance}
        attestation={block.attestation}
        signatureVerified={block.signatureVerified}
      />
      <Doorway alias={block.alias} signedIn={signedIn} canFork={canFork} />
    </article>
  );
}
