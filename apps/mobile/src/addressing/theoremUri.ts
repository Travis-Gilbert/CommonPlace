import { readInstanceSettings } from '@/api/instance';
import { theoremUri } from './theoremUriCore';

export { routeForTheoremUri, theoremUri, type TheoremAddress } from './theoremUriCore';

export async function objectTheoremUri(input: { id: string; kind: string; graphVersion?: number }): Promise<string> {
  const settings = await readInstanceSettings();
  return theoremUri({
    tenant: settings.tenant ?? 'Travis-Gilbert',
    kind: input.kind,
    id: input.id,
    graphVersion: input.graphVersion,
  });
}
