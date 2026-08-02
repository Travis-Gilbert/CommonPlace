import { loopbackFetch } from "./server-fetch.js";

const LOCAL_MODELS_URL = "http://localhost:8791/models";

/**
 * SPEC-COMMONPLACE-OPENWORK-FORK-1.0 OW1: severed.
 *
 * Upstream defaulted to `https://models.openworklabs.com/` whenever
 * `OPENWORK_DEV_MODE !== "1"`, which meant every non-dev session start fetched a
 * model catalog from a third-party host. That default is removed.
 *
 * Resolution order in this fork:
 *   1. `OPENCODE_MODELS_URL`, if explicitly set. The operator opted in.
 *   2. The local inference stack, if it answers on loopback.
 *   3. Empty string, meaning "no catalog override" — the caller omits the env
 *      var entirely and opencode falls back to its own built-in catalog.
 *
 * No host is contacted that the operator did not name.
 */
type ResolveOpencodeModelsUrlOptions = {
  env?: NodeJS.ProcessEnv;
  fetchModels?: (input: string, init?: RequestInit) => Promise<{ ok: boolean }>;
};

export async function resolveOpencodeModelsUrl(
  options: ResolveOpencodeModelsUrlOptions = {},
): Promise<string> {
  const env = options.env ?? process.env;
  const override = env.OPENCODE_MODELS_URL?.trim();
  if (override) return override;

  try {
    const response = await (options.fetchModels ?? loopbackFetch)(`${LOCAL_MODELS_URL}/api.json`, {
      signal: AbortSignal.timeout(1_000),
    });
    if (response.ok) return LOCAL_MODELS_URL;
  } catch {
    // No local inference stack running. Fall through to "no override".
  }

  return "";
}
