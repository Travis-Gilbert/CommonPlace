import { createHash } from 'node:crypto';

const LIVE_TEST_FLAG = 'THEOREM_LIVE_TURN_TEST';
const DEFAULT_BASE_URL = 'https://v2.theoremharness.com';
const MAX_ERROR_BODY = 500;

function requiredEnvironment(name) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required for the authenticated live smoke.`);
  return value;
}

function parseEvent(block) {
  let event = 'message';
  const data = [];
  for (const line of block.split('\n')) {
    if (line.startsWith('event:')) event = line.slice(6).trim();
    if (line.startsWith('data:')) data.push(line.slice(5).trimStart());
  }
  if (data.length === 0) return null;
  const raw = data.join('\n');
  try {
    return { event, data: JSON.parse(raw) };
  } catch {
    return { event, data: raw };
  }
}

function substantiveText(data) {
  if (typeof data === 'string') return data;
  if (!data || typeof data !== 'object') return '';
  for (const key of ['delta', 'text', 'content']) {
    if (typeof data[key] === 'string') return data[key];
  }
  return '';
}

function acknowledgementIsSpecific(value) {
  if (typeof value !== 'string' || value.length === 0) return true;
  const sentenceCount = (value.match(/[.!?]/g) ?? []).length || 1;
  if (sentenceCount > 2) return false;
  const lower = value.toLowerCase();
  return ![
    'sure',
    'absolutely',
    'got it',
    'i understand',
    "i'd be happy",
    'i can help',
  ].some((prefix) => lower.startsWith(prefix));
}

async function authenticatedSession(baseUrl, cookie) {
  const response = await fetch(new URL('/api/auth/session', baseUrl), {
    headers: { Cookie: cookie, Accept: 'application/json' },
  });
  if (!response.ok) throw new Error(`Auth session returned HTTP ${response.status}.`);
  return response.json();
}

async function runTurn({ baseUrl, cookie, label, prompt, capability, expectedRoute }) {
  const started = performance.now();
  const response = await fetch(new URL('/api/chat/stream', baseUrl), {
    method: 'POST',
    headers: {
      Cookie: cookie,
      Accept: 'text/event-stream',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      content: [{ type: 'text', text: prompt }],
      ...(capability ? { capability } : {}),
    }),
  });
  if (!response.ok) {
    const body = (await response.text()).slice(0, MAX_ERROR_BODY);
    throw new Error(`${label} returned HTTP ${response.status}: ${body}`);
  }
  const turnId = response.headers.get('x-commonplace-turn-id');
  if (!turnId) throw new Error(`${label} omitted x-commonplace-turn-id.`);
  if (response.headers.get('x-commonplace-turn-mode') !== 'cohesive') {
    throw new Error(`${label} reached the direct path; the tenant rollout is not enabled.`);
  }
  if (!response.body) throw new Error(`${label} returned no event stream.`);

  const timings = {};
  const responseText = [];
  let prelude = null;
  let sawRunningActivity = false;
  let sawDone = false;
  const receiptStages = [];
  let buffer = '';
  const decoder = new TextDecoder();
  const reader = response.body.getReader();
  for (;;) {
    const { done, value } = await reader.read();
    buffer += decoder.decode(value, { stream: !done }).replaceAll('\r\n', '\n');
    for (;;) {
      const boundary = buffer.indexOf('\n\n');
      if (boundary < 0) break;
      const event = parseEvent(buffer.slice(0, boundary));
      buffer = buffer.slice(boundary + 2);
      if (!event) continue;
      const elapsed = Math.round((performance.now() - started) * 100) / 100;
      if (event.event === 'turn_prelude') {
        prelude = event.data;
        timings.prelude_ms ??= elapsed;
      } else if (event.event === 'turn_receipt') {
        if (event.data?.turn_id !== turnId || typeof event.data?.stage !== 'string') {
          throw new Error(`${label} emitted an invalid lifecycle receipt.`);
        }
        receiptStages.push(event.data.stage);
      } else if (event.event === 'activity' && event.data?.status === 'running') {
        sawRunningActivity = true;
        timings.composed_activity_ms ??= elapsed;
      } else if (event.event === 'done') {
        sawDone = true;
        timings.completion_ms ??= elapsed;
      } else if (event.event === 'error') {
        throw new Error(`${label} emitted an error event.`);
      } else {
        const text = substantiveText(event.data);
        if (text) {
          responseText.push(text);
          timings.first_substantive_token_ms ??= elapsed;
        }
      }
    }
    if (done) break;
  }

  if (!prelude || prelude.route !== expectedRoute) {
    throw new Error(`${label} routed to ${prelude?.route ?? 'nothing'}, expected ${expectedRoute}.`);
  }
  if (!acknowledgementIsSpecific(prelude.acknowledgement)) {
    throw new Error(`${label} published a generic or overlong acknowledgement.`);
  }
  if (!sawRunningActivity) throw new Error(`${label} emitted no real running activity.`);
  if (responseText.join('').trim().length === 0) {
    throw new Error(`${label} emitted no substantive composed response.`);
  }
  if (!sawDone) throw new Error(`${label} emitted no completion event.`);
  const expectedReceiptStages = [
    'router_completed',
    'prelude_published',
    'composed_run_started',
    'first_substantive_token',
    'completion',
  ];
  if (receiptStages.join(',') !== expectedReceiptStages.join(',')) {
    throw new Error(
      `${label} emitted lifecycle receipts ${receiptStages.join(',')}, expected ${expectedReceiptStages.join(',')}.`,
    );
  }
  if (
    timings.prelude_ms > timings.composed_activity_ms ||
    timings.composed_activity_ms > timings.first_substantive_token_ms ||
    timings.first_substantive_token_ms > timings.completion_ms
  ) {
    throw new Error(`${label} emitted lifecycle events out of order.`);
  }

  return {
    label,
    turn_id: turnId,
    route: prelude.route,
    acknowledgement_published: typeof prelude.acknowledgement === 'string',
    response_sha256: createHash('sha256').update(responseText.join('')).digest('hex'),
    receipt_stages: receiptStages,
    ...timings,
  };
}

async function main() {
  if (process.env[LIVE_TEST_FLAG] !== '1') {
    throw new Error(`${LIVE_TEST_FLAG}=1 is required to run against the live service.`);
  }
  const baseUrl = process.env.THEOREM_LIVE_TURN_URL?.trim() || DEFAULT_BASE_URL;
  const cookie = requiredEnvironment('THEOREM_LIVE_TURN_COOKIE');
  const expectedTenant = requiredEnvironment('THEOREM_LIVE_TURN_TENANT');
  const session = await authenticatedSession(baseUrl, cookie);
  const githubLogin = session?.user?.githubLogin;
  if (githubLogin !== expectedTenant) {
    throw new Error(
      `Authenticated GitHub identity resolved to ${githubLogin ?? 'none'}, expected ${expectedTenant}.`,
    );
  }
  if (expectedTenant.toLowerCase() === 'default') {
    throw new Error('The live smoke refuses the default tenant sentinel.');
  }

  const receipts = [];
  receipts.push(await runTurn({
    baseUrl,
    cookie,
    label: 'auto_chat',
    prompt: 'Reply conversationally in one sentence. Do not research the web and do not run a task.',
    expectedRoute: 'chat',
  }));
  receipts.push(await runTurn({
    baseUrl,
    cookie,
    label: 'auto_research',
    prompt: 'Research the current official release status of the Model Context Protocol and cite the source.',
    expectedRoute: 'research',
  }));
  receipts.push(await runTurn({
    baseUrl,
    cookie,
    label: 'explicit_theorem_override',
    prompt: 'Explain why the explicit destination must win over inferred research.',
    capability: { kind: 'theorem' },
    expectedRoute: 'chat',
  }));

  process.stdout.write(`${JSON.stringify({
    schema_version: 'commonplace-live-turn-smoke/1',
    base_url: baseUrl,
    authenticated_tenant: expectedTenant,
    direct_default_tenant_refused: true,
    receipts,
  }, null, 2)}\n`);
}

await main();
