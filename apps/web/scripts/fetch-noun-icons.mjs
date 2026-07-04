// Noun Project fetch (OAuth 1.0a, 2-legged HMAC-SHA1).
// Run: node --env-file=.env.local scripts/fetch-noun-icons.mjs <term>
// Probes whether the current API plan/trial returns SVG (detail include_svg +
// download endpoint). If SVG is available, this becomes the bulk populator for
// the node-type icon registry. Secrets come from gitignored .env.local.

import crypto from 'node:crypto';

const KEY = process.env.NOUN_PROJECT_KEY;
const SECRET = process.env.NOUN_PROJECT_SECRET;
if (!KEY || !SECRET) {
  console.error('Missing NOUN_PROJECT_KEY / NOUN_PROJECT_SECRET (run with --env-file=.env.local)');
  process.exit(1);
}

const pe = (s) =>
  encodeURIComponent(String(s)).replace(/[!*'()]/g, (c) => '%' + c.charCodeAt(0).toString(16).toUpperCase());

function authHeader(method, url, params) {
  const oauth = {
    oauth_consumer_key: KEY,
    oauth_nonce: crypto.randomBytes(16).toString('hex'),
    oauth_signature_method: 'HMAC-SHA1',
    oauth_timestamp: Math.floor(Date.now() / 1000).toString(),
    oauth_version: '1.0',
  };
  const all = { ...params, ...oauth };
  const baseParams = Object.keys(all)
    .sort()
    .map((k) => `${pe(k)}=${pe(all[k])}`)
    .join('&');
  const base = [method.toUpperCase(), pe(url), pe(baseParams)].join('&');
  oauth.oauth_signature = crypto.createHmac('sha1', `${pe(SECRET)}&`).update(base).digest('base64');
  return (
    'OAuth ' +
    Object.keys(oauth)
      .sort()
      .map((k) => `${pe(k)}="${pe(oauth[k])}"`)
      .join(', ')
  );
}

async function getRaw(url, params) {
  const qs = Object.keys(params)
    .map((k) => `${pe(k)}=${pe(params[k])}`)
    .join('&');
  const res = await fetch(`${url}${qs ? `?${qs}` : ''}`, {
    headers: { Authorization: authHeader('GET', url, params) },
  });
  const text = await res.text();
  return { status: res.status, contentType: res.headers.get('content-type'), text };
}

async function getJson(url, params) {
  const r = await getRaw(url, params);
  if (r.status < 200 || r.status >= 300) throw new Error(`HTTP ${r.status}: ${r.text.slice(0, 200)}`);
  return JSON.parse(r.text);
}

const term = process.argv[2] || 'file';
try {
  const data = await getJson('https://api.thenounproject.com/v2/icon', { query: term, limit: '1', styles: 'line' });
  const hit = data.icons?.[0];
  if (!hit) {
    console.log(`no icon for "${term}"`);
    process.exit(0);
  }

  const det = await getJson(`https://api.thenounproject.com/v2/icon/${hit.id}`, { include_svg: '1' });
  const iconUrl = det.icon?.icon_url ?? det.icon_url ?? null;

  const dl = await getRaw(`https://api.thenounproject.com/v2/icon/${hit.id}/download`, {
    filetype: 'svg',
    color: '000000',
  });

  console.log(
    JSON.stringify(
      {
        term,
        id: hit.id,
        name: hit.term,
        detail_icon_url: iconUrl ? `${iconUrl.slice(0, 60)}...` : null,
        download_status: dl.status,
        download_bytes: dl.text.length,
        download_head: dl.text.slice(0, 90),
      },
      null,
      2,
    ),
  );
} catch (e) {
  console.error('FAILED:', e.message);
  process.exit(1);
}
