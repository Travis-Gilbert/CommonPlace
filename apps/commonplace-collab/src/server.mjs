import { mkdir, rename, writeFile } from 'node:fs/promises';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Database } from '@hocuspocus/extension-database';
import { Server } from '@hocuspocus/server';
import { SQLite } from '@hocuspocus/extension-sqlite';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, '..', '..', '..');

const host = process.env.COMMONPLACE_COLLAB_HOST ?? '127.0.0.1';
const port = Number.parseInt(process.env.PORT ?? process.env.COMMONPLACE_COLLAB_PORT ?? '1234', 10);
const dataDir = process.env.COMMONPLACE_COLLAB_DATA_DIR
  ?? join(repoRoot, '.commonplace', 'collab');
const sqlitePath = process.env.COMMONPLACE_COLLAB_SQLITE
  ?? join(dataDir, 'hocuspocus.sqlite');
const debugSnapshotDir = process.env.COMMONPLACE_COLLAB_DEBUG_SNAPSHOT_DIR ?? '';
const authDisabled = process.env.COMMONPLACE_COLLAB_AUTH_DISABLED === '1';
const legacyAuthToken = process.env.COMMONPLACE_COLLAB_TOKEN ?? '';
const tokenSecret = configuredTokenSecret();
const apiKey = process.env.COMMONPLACE_COLLAB_API_KEY
  ?? process.env.THEOREM_API_KEY
  ?? process.env.COMMONPLACE_API_KEY
  ?? 'dev-key';
const apiUrl = graphqlEndpoint(
  process.env.COMMONPLACE_COLLAB_API_URL
    ?? process.env.THEOREM_GRAPHQL_URL
    ?? 'http://127.0.0.1:50090',
);
const sqliteFallbackEnabled = process.env.COMMONPLACE_COLLAB_SQLITE_FALLBACK === '1';

const PAGE_CRDT_ENCODING = 'yjs-update-v1';

function configuredTokenSecret() {
  if (process.env.COMMONPLACE_COLLAB_TOKEN_SECRET?.trim()) {
    return process.env.COMMONPLACE_COLLAB_TOKEN_SECRET.trim();
  }
  if (process.env.NODE_ENV !== 'production') {
    return process.env.THEOREM_API_KEY
      ?? process.env.COMMONPLACE_API_KEY
      ?? process.env.AUTH_SECRET
      ?? 'dev-key';
  }
  return '';
}

if (!authDisabled && !legacyAuthToken && !tokenSecret) {
  throw new Error('COMMONPLACE_COLLAB_TOKEN_SECRET is required unless auth is disabled or COMMONPLACE_COLLAB_TOKEN is set.');
}

function cleanDocumentName(documentName) {
  return documentName
    .replace(/[^a-zA-Z0-9:._-]/g, '_')
    .replace(/_{2,}/g, '_')
    .slice(0, 180);
}

function pageIdFromDocumentName(documentName) {
  const marker = 'commonplace-page:';
  if (!documentName.startsWith(marker)) return null;
  return documentName.slice(marker.length) || null;
}

function graphqlEndpoint(value) {
  const trimmed = value.replace(/\/+$/, '');
  return trimmed.endsWith('/graphql') ? trimmed : `${trimmed}/graphql`;
}

function sign(payloadBase64) {
  return createHmac('sha256', tokenSecret).update(payloadBase64).digest('base64url');
}

function signaturesMatch(received, expected) {
  const receivedBytes = Buffer.from(received);
  const expectedBytes = Buffer.from(expected);
  if (receivedBytes.length !== expectedBytes.length) return false;
  return timingSafeEqual(receivedBytes, expectedBytes);
}

function verifySignedToken(token, documentName) {
  if (!token || typeof token !== 'string') return null;
  const [payloadBase64, signature, extra] = token.split('.');
  if (!payloadBase64 || !signature || extra) return null;
  if (!signaturesMatch(signature, sign(payloadBase64))) return null;

  let payload;
  try {
    payload = JSON.parse(Buffer.from(payloadBase64, 'base64url').toString('utf8'));
  } catch {
    return null;
  }

  const now = Math.floor(Date.now() / 1000);
  if (payload?.v !== 1) return null;
  if (payload.sub !== 'commonplace-collab') return null;
  if (payload.documentName !== documentName) return null;
  if (typeof payload.exp !== 'number' || payload.exp < now) return null;
  if (typeof payload.pageId !== 'string' || !payload.pageId) return null;
  if (pageIdFromDocumentName(documentName) !== payload.pageId) return null;
  return payload;
}

async function writeAtomic(path, bytes) {
  await mkdir(dirname(path), { recursive: true });
  const tempPath = `${path}.${process.pid}.${Date.now()}.tmp`;
  await writeFile(tempPath, bytes);
  await rename(tempPath, path);
}

async function writeDebugSnapshot(documentName, update) {
  if (!debugSnapshotDir) return;
  const safeName = cleanDocumentName(documentName);
  const pageId = pageIdFromDocumentName(documentName);
  const snapshotPath = join(debugSnapshotDir, `${safeName}.yjs`);
  const metadataPath = join(debugSnapshotDir, `${safeName}.json`);
  await writeAtomic(snapshotPath, update);
  await writeAtomic(
    metadataPath,
    JSON.stringify(
      {
        documentName,
        pageId,
        encoding: PAGE_CRDT_ENCODING,
        byteLength: update.byteLength,
        storedAt: new Date().toISOString(),
      },
      null,
      2,
    ),
  );
}

async function gql(query, variables = {}) {
  const response = await fetch(apiUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
    },
    body: JSON.stringify({ query, variables }),
  });
  if (!response.ok) {
    throw new Error(`commonplace-api ${response.status} ${response.statusText}`);
  }
  const body = await response.json();
  if (body.errors?.length) {
    throw new Error(body.errors.map((error) => error.message).join('; '));
  }
  return body.data;
}

async function fetchPageSnapshot(documentName) {
  const pageId = pageIdFromDocumentName(documentName);
  if (!pageId) return null;
  const data = await gql(
    `query($pageId:String!){
      pageCrdtSnapshot(pageId:$pageId){
        updateBase64
        encoding
        byteLen
      }
    }`,
    { pageId },
  );
  const snapshot = data?.pageCrdtSnapshot;
  if (!snapshot?.updateBase64) return null;
  if (snapshot.encoding !== PAGE_CRDT_ENCODING) {
    throw new Error(`unsupported page CRDT encoding ${snapshot.encoding}`);
  }
  return Buffer.from(snapshot.updateBase64, 'base64');
}

async function storePageSnapshot(documentName, state) {
  const pageId = pageIdFromDocumentName(documentName);
  if (!pageId) return;
  const update = Buffer.from(state);
  const updateBase64 = update.toString('base64');
  await gql(
    `mutation($input:StorePageCrdtSnapshotInputGql!){
      storePageCrdtSnapshot(input:$input){
        pageId
        blobHash
        byteLen
      }
    }`,
    {
      input: {
        pageId,
        updateBase64,
        encoding: PAGE_CRDT_ENCODING,
      },
    },
  );
  if (process.env.COMMONPLACE_COLLAB_COMPACT_ON_STORE === '1') {
    await gql(
      `mutation($pageId:String!){
        compactPageCrdtSnapshot(pageId:$pageId){
          pageId
          blobHash
          byteLen
        }
      }`,
      { pageId },
    );
  }
  await writeDebugSnapshot(documentName, update);
}

await mkdir(dataDir, { recursive: true });
if (debugSnapshotDir) {
  await mkdir(debugSnapshotDir, { recursive: true });
}

const extensions = [
  new Database({
    fetch: async ({ documentName }) => fetchPageSnapshot(documentName),
    store: async ({ documentName, state }) => storePageSnapshot(documentName, state),
  }),
];

if (sqliteFallbackEnabled) {
  extensions.push(
    new SQLite({
      database: sqlitePath,
    }),
  );
}

const server = new Server({
  address: host,
  port,
  timeout: 30000,
  debounce: 2000,
  maxDebounce: 10000,
  extensions,
  async onAuthenticate({ token, documentName }) {
    if (authDisabled) {
      return {
        documentName,
        auth: 'disabled',
      };
    }
    if (legacyAuthToken && token === legacyAuthToken) {
      return {
        documentName,
        auth: 'legacy-token',
        pageId: pageIdFromDocumentName(documentName),
      };
    }
    const payload = verifySignedToken(token, documentName);
    if (!payload) {
      throw new Error('Not authorized');
    }
    return {
      documentName,
      auth: 'signed-token',
      pageId: payload.pageId,
    };
  },
  async onListen() {
    console.log(`commonplace-collab listening on ws://${host}:${port}`);
    console.log(`commonplace-collab data dir ${dataDir}`);
    console.log(`commonplace-collab RustyRed API ${apiUrl}`);
    if (sqliteFallbackEnabled) {
      console.log(`commonplace-collab SQLite fallback ${sqlitePath}`);
    }
    if (debugSnapshotDir) {
      console.log(`commonplace-collab debug snapshots ${debugSnapshotDir}`);
    }
    if (process.env.COMMONPLACE_COLLAB_COMPACT_ON_STORE === '1') {
      console.log('commonplace-collab Rust yrs compaction on store enabled');
    }
  },
});

server.listen();
