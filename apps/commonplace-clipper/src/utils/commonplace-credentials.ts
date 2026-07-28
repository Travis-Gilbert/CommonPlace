export const COMMONPLACE_CAPTURE_CREDENTIAL_KEY = 'commonplaceCaptureCredentialV1';

export interface CaptureCredential {
	token: string;
	apiBase: string;
	revision: string;
}

export interface CaptureCredentialState {
	current?: CaptureCredential;
	pending?: CaptureCredential;
}

function parseCredential(value: unknown): CaptureCredential | undefined {
	if (!value || typeof value !== 'object') return undefined;
	const candidate = value as Record<string, unknown>;
	if (
		typeof candidate.token !== 'string'
		|| typeof candidate.apiBase !== 'string'
		|| typeof candidate.revision !== 'string'
		|| !candidate.revision
	) {
		return undefined;
	}
	return {
		token: candidate.token,
		apiBase: candidate.apiBase,
		revision: candidate.revision,
	};
}

export function parseCaptureCredentialState(
	value: unknown,
): CaptureCredentialState {
	if (!value || typeof value !== 'object') return {};
	const candidate = value as Record<string, unknown>;
	return {
		...(parseCredential(candidate.current)
			? { current: parseCredential(candidate.current) }
			: {}),
		...(parseCredential(candidate.pending)
			? { pending: parseCredential(candidate.pending) }
			: {}),
	};
}

export function captureCredentialFor(
	state: CaptureCredentialState,
	revision: string,
	apiBase: string,
): CaptureCredential | undefined {
	if (!revision) return undefined;
	return [state.pending, state.current].find(
		(credential) =>
			credential?.revision === revision
			&& credential.apiBase === apiBase,
	);
}

export function reconcileCaptureCredentialState(
	state: CaptureCredentialState,
	revision: string,
	apiBase: string,
): CaptureCredentialState {
	const committed = captureCredentialFor(state, revision, apiBase);
	if (committed) return { current: committed };
	return state.current ? { current: state.current } : {};
}
