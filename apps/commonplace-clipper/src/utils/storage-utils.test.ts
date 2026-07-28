import browser from './browser-polyfill';
import { COMMONPLACE_CAPTURE_CREDENTIAL_KEY } from './commonplace-credentials';
import { loadSettings, saveSettings } from './storage-utils';

describe('CommonPlace credential storage', () => {
	afterEach(() => {
		vi.restoreAllMocks();
	});

	it('moves a legacy synced token into local-only storage', async () => {
		vi.spyOn(browser.storage.sync, 'get').mockResolvedValue({
			migrationVersion: 2,
			general_settings: {
				commonplaceEndpointUrl: 'https://api.example.test/ingest/capture',
				commonplaceApiToken: 'legacy-secret',
			},
		});
		vi.spyOn(browser.storage.local, 'get').mockResolvedValue({});
		const localSet = vi
			.spyOn(browser.storage.local, 'set')
			.mockResolvedValue();
		const syncSet = vi
			.spyOn(browser.storage.sync, 'set')
			.mockResolvedValue();

		const settings = await loadSettings();

		expect(settings.commonplaceApiToken).toBe('legacy-secret');
		const localCredential = localSet.mock.calls[0]?.[0] as {
			[COMMONPLACE_CAPTURE_CREDENTIAL_KEY]?: {
				current?: {
					token?: string;
					apiBase?: string;
					revision?: string;
				};
			};
		};
		const current = localCredential[COMMONPLACE_CAPTURE_CREDENTIAL_KEY]?.current;
		expect(current).toMatchObject({
			token: 'legacy-secret',
			apiBase: 'https://api.example.test',
			revision: expect.any(String),
		});
		expect(syncSet).toHaveBeenCalledWith({
			general_settings: {
				commonplaceEndpointUrl: 'https://api.example.test',
				commonplaceCredentialRevision: current?.revision,
			},
			migrationVersion: 3,
		});
	});

	it('writes the token locally and excludes it from synced settings', async () => {
		const localSet = vi
			.spyOn(browser.storage.local, 'set')
			.mockResolvedValue();
		vi.spyOn(browser.storage.local, 'get').mockResolvedValue({
			[COMMONPLACE_CAPTURE_CREDENTIAL_KEY]: {
				current: {
					token: 'old-secret',
					apiBase: 'https://old.example.test',
					revision: 'old-revision',
				},
			},
		});
		const syncSet = vi
			.spyOn(browser.storage.sync, 'set')
			.mockResolvedValue();

		await saveSettings({
			commonplaceApiToken: 'local-secret',
			commonplaceEndpointUrl: 'https://api.example.test',
		});

		expect(localSet).toHaveBeenCalledTimes(2);
		const pendingWrite = localSet.mock.calls[0]?.[0] as {
			[COMMONPLACE_CAPTURE_CREDENTIAL_KEY]?: {
				current?: { revision?: string };
				pending?: {
					token?: string;
					apiBase?: string;
					revision?: string;
				};
			};
		};
		const pending = pendingWrite[COMMONPLACE_CAPTURE_CREDENTIAL_KEY]?.pending;
		expect(pendingWrite[COMMONPLACE_CAPTURE_CREDENTIAL_KEY]?.current?.revision)
			.toBe('old-revision');
		expect(pending).toMatchObject({
			token: 'local-secret',
			apiBase: 'https://api.example.test',
			revision: expect.any(String),
		});
		const synced = syncSet.mock.calls[0]?.[0] as {
			general_settings?: Record<string, unknown>;
		};
		expect(synced.general_settings).not.toHaveProperty('commonplaceApiToken');
		expect(synced.general_settings?.commonplaceEndpointUrl)
			.toBe('https://api.example.test');
		expect(synced.general_settings?.commonplaceCredentialRevision)
			.toBe(pending?.revision);
		expect(localSet.mock.calls[1]?.[0]).toEqual({
			[COMMONPLACE_CAPTURE_CREDENTIAL_KEY]: {
				current: pending,
			},
		});
	});

	it('preserves the credential revision for unrelated settings changes', async () => {
		const current = {
			token: 'local-secret',
			apiBase: 'https://api.example.test',
			revision: 'stable-revision',
		};
		vi.spyOn(browser.storage.local, 'get').mockResolvedValue({
			[COMMONPLACE_CAPTURE_CREDENTIAL_KEY]: { current },
		});
		const localSet = vi
			.spyOn(browser.storage.local, 'set')
			.mockResolvedValue();
		const syncSet = vi
			.spyOn(browser.storage.sync, 'set')
			.mockResolvedValue();

		await saveSettings({
			commonplaceApiToken: current.token,
			commonplaceEndpointUrl: current.apiBase,
			showMoreActionsButton: true,
		});

		expect(localSet).not.toHaveBeenCalled();
		const synced = syncSet.mock.calls[0]?.[0] as {
			general_settings?: Record<string, unknown>;
		};
		expect(synced.general_settings?.commonplaceCredentialRevision)
			.toBe(current.revision);
	});

	it('serializes overlapping credential saves', async () => {
		const current = {
			token: 'old-secret',
			apiBase: 'https://old.example.test',
			revision: 'old-revision',
		};
		vi.spyOn(browser.storage.local, 'get').mockResolvedValue({
			[COMMONPLACE_CAPTURE_CREDENTIAL_KEY]: { current },
		});
		vi.spyOn(browser.storage.local, 'set').mockResolvedValue();
		let releaseFirstSync: (() => void) | undefined;
		const firstSyncBlocked = new Promise<void>((resolve) => {
			releaseFirstSync = resolve;
		});
		let markFirstSyncStarted: (() => void) | undefined;
		const firstSyncStarted = new Promise<void>((resolve) => {
			markFirstSyncStarted = resolve;
		});
		const syncSet = vi
			.spyOn(browser.storage.sync, 'set')
			.mockImplementation(async () => {
				if (syncSet.mock.calls.length === 1) {
					markFirstSyncStarted?.();
					await firstSyncBlocked;
				}
			});

		const first = saveSettings({
			commonplaceApiToken: 'first-secret',
			commonplaceEndpointUrl: 'https://first.example.test',
		});
		await firstSyncStarted;
		const second = saveSettings({
			commonplaceApiToken: 'second-secret',
			commonplaceEndpointUrl: 'https://second.example.test',
		});
		await Promise.resolve();

		expect(syncSet).toHaveBeenCalledTimes(1);
		releaseFirstSync?.();
		await Promise.all([first, second]);
		expect(syncSet).toHaveBeenCalledTimes(2);
		const secondSync = syncSet.mock.calls[1]?.[0] as {
			general_settings?: Record<string, unknown>;
		};
		expect(secondSync.general_settings?.commonplaceEndpointUrl)
			.toBe('https://second.example.test');
	});

	it('promotes pending credentials after the sync revision commits', async () => {
		const pending = {
			token: 'new-secret',
			apiBase: 'https://new.example.test',
			revision: 'new-revision',
		};
		vi.spyOn(browser.storage.sync, 'get').mockResolvedValue({
			migrationVersion: 3,
			general_settings: {
				commonplaceEndpointUrl: pending.apiBase,
				commonplaceCredentialRevision: pending.revision,
			},
		});
		vi.spyOn(browser.storage.local, 'get').mockResolvedValue({
			[COMMONPLACE_CAPTURE_CREDENTIAL_KEY]: {
				current: {
					token: 'old-secret',
					apiBase: 'https://old.example.test',
					revision: 'old-revision',
				},
				pending,
			},
		});
		const localSet = vi
			.spyOn(browser.storage.local, 'set')
			.mockResolvedValue();

		const settings = await loadSettings();

		expect(settings.commonplaceApiToken).toBe('new-secret');
		expect(localSet).toHaveBeenCalledWith({
			[COMMONPLACE_CAPTURE_CREDENTIAL_KEY]: { current: pending },
		});
	});

	it('discards pending credentials when the sync revision did not commit', async () => {
		const current = {
			token: 'old-secret',
			apiBase: 'https://old.example.test',
			revision: 'old-revision',
		};
		vi.spyOn(browser.storage.sync, 'get').mockResolvedValue({
			migrationVersion: 3,
			general_settings: {
				commonplaceEndpointUrl: current.apiBase,
				commonplaceCredentialRevision: current.revision,
			},
		});
		vi.spyOn(browser.storage.local, 'get').mockResolvedValue({
			[COMMONPLACE_CAPTURE_CREDENTIAL_KEY]: {
				current,
				pending: {
					token: 'new-secret',
					apiBase: 'https://new.example.test',
					revision: 'new-revision',
				},
			},
		});
		const localSet = vi
			.spyOn(browser.storage.local, 'set')
			.mockResolvedValue();

		const settings = await loadSettings();

		expect(settings.commonplaceApiToken).toBe('old-secret');
		expect(localSet).toHaveBeenCalledWith({
			[COMMONPLACE_CAPTURE_CREDENTIAL_KEY]: { current },
		});
	});
});
