import { ImageResponse } from 'next/og';

export const runtime = 'nodejs';
export const alt = 'A published block on CommonPlace';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

const GQL_URL = (process.env.THEOREM_GRAPHQL_URL ?? 'http://localhost:50090/graphql').replace(
  /\/graphql\/?$/,
  '/graphql',
);
const API_KEY = process.env.THEOREM_API_KEY ?? 'dev-key';

async function fetchTitleKind(alias: string): Promise<{ title: string; kind: string }> {
  try {
    const res = await fetch(GQL_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': API_KEY },
      body: JSON.stringify({
        query: `query($a:String!){ publishedBlock(alias:$a, countView:false){ status block{ title shapeId } } }`,
        variables: { a: alias },
      }),
      cache: 'no-store',
    });
    const json = await res.json();
    const block = json?.data?.publishedBlock?.block;
    if (block) return { title: block.title, kind: block.shapeId };
  } catch {
    // fall through to the generic card
  }
  return { title: 'CommonPlace', kind: 'block' };
}

/**
 * Social card for a published block (HANDOFF-PUBLISH D2). Generated from the
 * block title and kind so a link paste into a chat client shows an on brand
 * card. Satori supports flexbox only, so every node declares display flex.
 */
export default async function OgImage({ params }: { params: Promise<{ alias: string }> }) {
  const { alias } = await params;
  const { title, kind } = await fetchTitleKind(alias);

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          background: '#f7f0e6',
          color: '#23201b',
          padding: '80px',
          fontFamily: 'Georgia, serif',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '18px' }}>
          <div
            style={{
              display: 'flex',
              width: '22px',
              height: '22px',
              borderRadius: '50%',
              background: '#c49a4a',
            }}
          />
          <div
            style={{
              display: 'flex',
              fontSize: '26px',
              letterSpacing: '4px',
              textTransform: 'uppercase',
              color: '#6b6459',
            }}
          >
            {kind}
          </div>
        </div>
        <div style={{ display: 'flex', fontSize: '72px', lineHeight: 1.1, fontWeight: 600 }}>
          {title.slice(0, 120)}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div style={{ display: 'flex', width: '40px', height: '6px', background: '#7a2733' }} />
          <div style={{ display: 'flex', fontSize: '30px', color: '#7a2733' }}>CommonPlace</div>
        </div>
      </div>
    ),
    size,
  );
}
