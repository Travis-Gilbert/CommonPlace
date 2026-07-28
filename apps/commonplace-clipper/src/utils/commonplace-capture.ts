import {
	COMMONPLACE_CAPTURE_CONTRACT_VERSION,
	captureEndpoint,
	createCaptureQueue,
	type CaptureEnvelope,
	type CaptureQueueEntry,
	type CaptureReceipt,
	type CaptureSendResult,
} from '@commonplace/capture-client';
import browser from './browser-polyfill';
import {
	COMMONPLACE_CAPTURE_CREDENTIAL_KEY,
	captureCredentialFor,
	parseCaptureCredentialState,
} from './commonplace-credentials';

export const COMMONPLACE_CAPTURE_ALARM = 'commonplace-capture-drain-v1';
export const COMMONPLACE_CAPTURE_QUEUE_KEY = 'commonplaceCaptureQueueV1';
export { COMMONPLACE_CAPTURE_CONTRACT_VERSION };
export { COMMONPLACE_CAPTURE_CREDENTIAL_KEY };
export type { CaptureEnvelope };

interface StorageArea {
	get(keys?: string | string[] | null): Promise<Record<string, unknown>>;
	set(items: Record<string, unknown>): Promise<void>;
}

interface CaptureSettings {
	apiBase: string;
	apiToken: string;
}

interface CaptureServiceOptions {
	localStorage?: StorageArea;
	syncStorage?: StorageArea;
	fetchImpl?: typeof fetch;
	retryBaseMs?: number;
}

export interface EnqueueCaptureResult {
	ok: true;
	queued: boolean;
	state: CaptureQueueEntry['state'];
	receipt?: CaptureReceipt;
}

function queueStorage(area: StorageArea) {
	return {
		async read(): Promise<CaptureQueueEntry[]> {
			const stored = await area.get(COMMONPLACE_CAPTURE_QUEUE_KEY);
			const entries = stored[COMMONPLACE_CAPTURE_QUEUE_KEY];
			return Array.isArray(entries) ? entries as CaptureQueueEntry[] : [];
		},
		async write(entries: CaptureQueueEntry[]): Promise<void> {
			await area.set({ [COMMONPLACE_CAPTURE_QUEUE_KEY]: entries });
		},
	};
}

async function captureSettings(
	syncArea: StorageArea,
	localArea: StorageArea,
): Promise<CaptureSettings> {
	const [stored, credentials] = await Promise.all([
		syncArea.get('general_settings'),
		localArea.get(COMMONPLACE_CAPTURE_CREDENTIAL_KEY),
	]);
	const settings = stored.general_settings as {
		commonplaceEndpointUrl?: unknown;
		commonplaceCredentialRevision?: unknown;
	} | undefined;
	const apiBase = typeof settings?.commonplaceEndpointUrl === 'string'
		? settings.commonplaceEndpointUrl
		: '';
	const revision = typeof settings?.commonplaceCredentialRevision === 'string'
		? settings.commonplaceCredentialRevision
		: '';
	const credential = captureCredentialFor(
		parseCaptureCredentialState(
			credentials[COMMONPLACE_CAPTURE_CREDENTIAL_KEY],
		),
		revision,
		apiBase,
	);
	return {
		apiBase,
		apiToken: credential?.token ?? '',
	};
}

function envelopeForWire(envelope: CaptureEnvelope): CaptureEnvelope {
	const { local_file_paths: _localFilePaths, ...wireEnvelope } = envelope;
	return {
		...wireEnvelope,
		idempotency_key: envelope.idempotency_key || envelope.client_id,
	};
}

function responseError(status: number, body: string): string {
	const trimmed = body.trim();
	return trimmed
		? `CommonPlace capture failed with ${status}: ${trimmed.slice(0, 240)}`
		: `CommonPlace capture failed with ${status}`;
}

export function createBrowserCaptureService(
	options: CaptureServiceOptions = {},
) {
	const localStorage = options.localStorage ?? browser.storage.local;
	const syncStorage = options.syncStorage ?? browser.storage.sync;
	const fetchImpl = options.fetchImpl ?? fetch;

	const queue = createCaptureQueue({
		storage: queueStorage(localStorage),
		retryBaseMs: options.retryBaseMs,
		send: async (envelope): Promise<CaptureSendResult> => {
			const settings = await captureSettings(syncStorage, localStorage);
			const endpoint = captureEndpoint(settings.apiBase);
			if (!endpoint) {
				return {
					ok: false,
					retryable: true,
					error: 'CommonPlace API base is not configured',
				};
			}

			const headers: Record<string, string> = {
				'Content-Type': 'application/json',
			};
			if (settings.apiToken) {
				headers.Authorization = `Bearer ${settings.apiToken}`;
			}

			const response = await fetchImpl(endpoint, {
				method: 'POST',
				headers,
				body: JSON.stringify(envelopeForWire(envelope)),
			});
			const body = await response.text();
			if (!response.ok) {
				return {
					ok: false,
					status: response.status,
					error: responseError(response.status, body),
				};
			}

			const payload = body ? JSON.parse(body) as CaptureReceipt : undefined;
			return {
				ok: true,
				receipt: payload,
			};
		},
	});

	return {
		async enqueue(envelope: CaptureEnvelope): Promise<EnqueueCaptureResult> {
			await queue.enqueue(envelope);
			const drained = await queue.drain();
			const entry = drained.find((candidate) => candidate.id === envelope.client_id);
			return {
				ok: true,
				queued: entry?.state !== 'sent',
				state: entry?.state ?? 'kept',
				...(entry?.receipt ? { receipt: entry.receipt } : {}),
			};
		},
		drain: () => queue.drain(),
		list: () => queue.list(),
	};
}

const backgroundCaptureService = createBrowserCaptureService();

export function enqueueCommonplaceCapture(
	envelope: CaptureEnvelope,
): Promise<EnqueueCaptureResult> {
	return backgroundCaptureService.enqueue(envelope);
}

export function drainCommonplaceCaptures(): Promise<CaptureQueueEntry[]> {
	return backgroundCaptureService.drain();
}
