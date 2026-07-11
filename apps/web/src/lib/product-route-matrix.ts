export interface ProductRedirect {
  readonly source: string;
  readonly destination: string;
  readonly permanent: true;
  readonly has?: { readonly type: 'host'; readonly value: string }[];
}

export type RouteProbeMethod = 'GET' | 'HEAD' | 'OPTIONS' | 'POST';

export interface ProductRouteProbe {
  readonly id: string;
  readonly method: RouteProbeMethod;
  readonly path: string;
  readonly expectedStatus: number;
  readonly expectedLocation?: string;
  readonly bodyIncludes?: string;
  readonly cookie?: string;
}

export const PRODUCT_HOST = process.env.PRODUCT_HOST ?? 'app.theoremharness.com';
const productHostPattern = PRODUCT_HOST.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export const PRODUCT_REDIRECTS: readonly ProductRedirect[] = [
  {
    source: '/',
    destination: '/v2',
    permanent: true,
    has: [{ type: 'host', value: productHostPattern }],
  },
  {
    source: '/commonplace/notebooks',
    destination: '/v2/files',
    permanent: true,
  },
  {
    source: '/commonplace/projects',
    destination: '/v2/objects',
    permanent: true,
  },
  {
    source: '/commonplace/search',
    destination: '/v2/graph',
    permanent: true,
  },
  {
    source: '/v2/account',
    destination: '/v2/account/agents',
    permanent: true,
  },
];

export const PRODUCT_ROUTE_PROBES: readonly ProductRouteProbe[] = [
  {
    id: 'root-get-query',
    method: 'GET',
    path: '/?fo003=1&next=%2Fv2%2Fgraph',
    expectedStatus: 308,
    expectedLocation: '/v2?fo003=1&next=%2Fv2%2Fgraph',
  },
  {
    id: 'root-head-query',
    method: 'HEAD',
    path: '/?fo003=head',
    expectedStatus: 308,
    expectedLocation: '/v2?fo003=head',
  },
  {
    id: 'root-options',
    method: 'OPTIONS',
    path: '/',
    expectedStatus: 308,
    expectedLocation: '/v2',
  },
  {
    id: 'root-post-method-preserving',
    method: 'POST',
    path: '/?fo003=post',
    expectedStatus: 308,
    expectedLocation: '/v2?fo003=post',
  },
  {
    id: 'root-opaque-cookie',
    method: 'GET',
    path: '/?fo003=cookie',
    expectedStatus: 308,
    expectedLocation: '/v2?fo003=cookie',
    cookie: 'fo003=opaque',
  },
  {
    id: 'v2-canonical',
    method: 'GET',
    path: '/v2',
    expectedStatus: 200,
    bodyIncludes: 'Index',
  },
  {
    id: 'v2-files',
    method: 'GET',
    path: '/v2/files',
    expectedStatus: 200,
  },
  {
    id: 'v2-graph',
    method: 'GET',
    path: '/v2/graph',
    expectedStatus: 200,
  },
  {
    id: 'v2-objects',
    method: 'GET',
    path: '/v2/objects',
    expectedStatus: 200,
  },
  {
    id: 'v2-db',
    method: 'GET',
    path: '/v2/db',
    expectedStatus: 200,
  },
  {
    id: 'v2-db-movie',
    method: 'GET',
    path: '/v2/db/movie_database',
    expectedStatus: 200,
  },
  {
    id: 'v2-db-plant',
    method: 'GET',
    path: '/v2/db/plant_database',
    expectedStatus: 200,
  },
  {
    id: 'commonplace-compatibility',
    method: 'GET',
    path: '/commonplace',
    expectedStatus: 200,
  },
  {
    id: 'commonplace-mobile-compatibility',
    method: 'GET',
    path: '/commonplace/mobile',
    expectedStatus: 200,
  },
  {
    id: 'commonplace-notebooks-replacement',
    method: 'GET',
    path: '/commonplace/notebooks?fo003=notebooks',
    expectedStatus: 308,
    expectedLocation: '/v2/files?fo003=notebooks',
  },
  {
    id: 'commonplace-projects-replacement',
    method: 'GET',
    path: '/commonplace/projects?fo003=projects',
    expectedStatus: 308,
    expectedLocation: '/v2/objects?fo003=projects',
  },
  {
    id: 'commonplace-search-replacement',
    method: 'GET',
    path: '/commonplace/search?q=servo&fo003=search',
    expectedStatus: 308,
    expectedLocation: '/v2/graph?q=servo&fo003=search',
  },
  {
    id: 'account-query-preservation',
    method: 'GET',
    path: '/v2/account?fo003=account&next=%2Fv2%2Fsettings',
    expectedStatus: 308,
    expectedLocation: '/v2/account/agents?fo003=account&next=%2Fv2%2Fsettings',
  },
  {
    id: 'health',
    method: 'GET',
    path: '/api/healthz',
    expectedStatus: 200,
  },
  {
    id: 'auth-providers',
    method: 'GET',
    path: '/api/auth/providers',
    expectedStatus: 200,
  },
  {
    id: 'auth-session',
    method: 'GET',
    path: '/api/auth/session',
    expectedStatus: 200,
  },
  {
    id: 'auth-csrf',
    method: 'GET',
    path: '/api/auth/csrf',
    expectedStatus: 200,
  },
  {
    id: 'v2-db-api',
    method: 'GET',
    path: '/api/v2/db/movie_database',
    expectedStatus: 200,
  },
];

export function normalizeLocation(location: string, baseUrl: URL): string {
  const parsed = new URL(location, baseUrl);
  return `${parsed.pathname}${parsed.search}`;
}
