import {
	COMMONPLACE_CAPTURE_CONTRACT_VERSION,
	COMMONPLACE_CAPTURE_CREDENTIAL_KEY,
	COMMONPLACE_CAPTURE_QUEUE_KEY,
	createBrowserCaptureService,
	type CaptureEnvelope,
} from './commonplace-capture';

function storageArea(initial: Record<string, unknown> = {}) {
	const values = structuredClone(initial);
	return {
		async get(keys?: string | string[] | null): Promise<Record<string, unknown>> {
			if (keys == null) return structuredClone(values);
			const requested = Array.isArray(keys) ? keys : [keys];
			return Object.fromEntries(
				requested
					.filter((key) => key in values)
					.map((key) => [key, structuredClone(values[key])]),
			);
		},
		async set(items: Record<string, unknown>): Promise<void> {
			Object.assign(values, structuredClone(items));
		},
		snapshot(): Record<string, unknown> {
			return structuredClone(values);
		},
	};
}

function envelope(clientId = 'clip-local-1'): CaptureEnvelope {
	return {
		client_id: clientId,
		title: 'Durable clip',
		body: '# Durable clip',
		object_type: 'source',
		capture_method: 'clipped',
		source: 'clipper',
		captured_at: '2026-07-28T12:00:00Z',
		source_url: 'https://example.test/article',
		properties: { topic: 'capture' },
	};
}

describe('CommonPlace browser capture service', () => {
	it('uses the versioned Capture 2.0 contract', () => {
		expect(COMMONPLACE_CAPTURE_CONTRACT_VERSION).toBe('commonplace-capture/v1');
	});

	it('persists offline work and drains it after a simulated browser restart', async () => {
		const local = storageArea({
			[COMMONPLACE_CAPTURE_CREDENTIAL_KEY]: {
				current: {
					token: 'test-token',
					apiBase: 'https://api.example.test/ingest/capture',
					revision: 'credential-v1',
				},
			},
		});
		const sync = storageArea({
			general_settings: {
				commonplaceEndpointUrl: 'https://api.example.test/ingest/capture',
				commonplaceCredentialRevision: 'credential-v1',
			},
		});
		const offline = createBrowserCaptureService({
			localStorage: local,
			syncStorage: sync,
			retryBaseMs: 0,
			fetchImpl: async () => {
				throw new TypeError('offline');
			},
		});

		const queued = await offline.enqueue(envelope());
		expect(queued.queued).toBe(true);
		expect(
			(local.snapshot()[COMMONPLACE_CAPTURE_QUEUE_KEY] as unknown[]).length,
		).toBe(1);

		const requests: Array<{
			url: string;
			body: CaptureEnvelope;
			authorization: string | null;
		}> = [];
		const restarted = createBrowserCaptureService({
			localStorage: local,
			syncStorage: sync,
			retryBaseMs: 0,
			fetchImpl: async (input, init) => {
				requests.push({
					url: String(input),
					body: JSON.parse(String(init?.body)) as CaptureEnvelope,
					authorization: new Headers(init?.headers).get('Authorization'),
				});
				return new Response(JSON.stringify({
					id: 'item-1',
					created: true,
					client_id: 'clip-local-1',
				}), { status: 200 });
			},
		});

		await restarted.drain();
		expect(requests).toHaveLength(1);
		expect(requests[0].url).toBe('https://api.example.test/ingest/capture');
		expect(requests[0].authorization).toBe('Bearer test-token');
		expect(requests[0].body.idempotency_key).toBe('clip-local-1');
		expect(requests[0].body).not.toHaveProperty('apiToken');
		expect(await restarted.list()).toEqual([]);
	});

	it('withholds a local token when sync redirects capture to another endpoint', async () => {
		const local = storageArea({
			[COMMONPLACE_CAPTURE_CREDENTIAL_KEY]: {
				current: {
					token: 'local-only-token',
					apiBase: 'https://trusted.example.test',
					revision: 'credential-v1',
				},
			},
		});
		const sync = storageArea({
			general_settings: {
				commonplaceEndpointUrl: 'https://redirected.example.test',
				commonplaceCredentialRevision: 'credential-v1',
			},
		});
		const requests: Array<{
			url: string;
			authorization: string | null;
		}> = [];
		const service = createBrowserCaptureService({
			localStorage: local,
			syncStorage: sync,
			retryBaseMs: 0,
			fetchImpl: async (input, init) => {
				requests.push({
					url: String(input),
					authorization: new Headers(init?.headers).get('Authorization'),
				});
				return new Response(JSON.stringify({
					id: 'item-2',
					created: true,
					client_id: 'clip-local-1',
				}), { status: 200 });
			},
		});

		await service.enqueue(envelope());

		expect(requests).toEqual([{
			url: 'https://redirected.example.test/ingest/capture',
			authorization: null,
		}]);
	});
});
