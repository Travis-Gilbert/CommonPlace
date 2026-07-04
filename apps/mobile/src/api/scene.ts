/**
 * Scene seam: theorem-gateway `sceneForInput` -> `GET /scene/{id}` (self-contained
 * HTML rendered in a WebView). Text answers always render first; scenes are an
 * explicit affordance on top.
 */
import { readInstanceSettings } from './instance';

export type SceneRef = { sceneId: string; url: string };

export async function sceneForInput(input: string): Promise<SceneRef | null> {
  const s = await readInstanceSettings();
  if (!s.gatewayUrl) return null;
  const base = s.gatewayUrl.replace(/\/$/, '');
  const res = await fetch(`${base}/graphql`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      query: `query($input:String!,$scope:AgentScope!){ sceneForInput(input:$input,scope:$scope){ sceneId url } }`,
      variables: { input, scope: 'TENANT' },
    }),
  });
  if (!res.ok) throw new Error(`gateway HTTP ${res.status}`);
  const json = await res.json();
  if (json.errors?.length) throw new Error(json.errors[0].message);
  const ref = json.data?.sceneForInput as SceneRef | undefined;
  if (!ref) return null;
  // The gateway may return a relative /scene/{id} path.
  const url = ref.url.startsWith('http') ? ref.url : `${base}${ref.url}`;
  return { sceneId: ref.sceneId, url };
}
