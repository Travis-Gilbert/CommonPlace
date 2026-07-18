import { routeForTheoremUri } from '@/addressing/theoremUri';

export function redirectSystemPath({ path }: { path: string; initial: boolean }): string {
  return routeForTheoremUri(path);
}
