import { writeFile } from 'node:fs/promises';
import {
  PRODUCT_ROUTE_PROBES,
  normalizeLocation,
  type ProductRouteProbe,
} from '../src/lib/product-route-matrix';

interface ProbeResult {
  readonly id: string;
  readonly method: string;
  readonly path: string;
  readonly status: number | null;
  readonly location: string | null;
  readonly durationMs: number;
  readonly requestId: string | null;
  readonly allow: string | null;
  readonly setCookieNames: readonly string[];
  readonly passed: boolean;
  readonly errors: readonly string[];
}

function requireBaseUrl(): URL {
  const value = process.env.ROUTE_MATRIX_BASE_URL;
  if (!value) {
    throw new Error('ROUTE_MATRIX_BASE_URL is required');
  }
  return new URL(value);
}

function requirePersonalBaseUrl(): URL {
  const value = process.env.ROUTE_MATRIX_PERSONAL_BASE_URL;
  if (!value) {
    throw new Error('ROUTE_MATRIX_PERSONAL_BASE_URL is required');
  }
  return new URL(value);
}

function readRepeatCount(): number {
  const value = process.env.ROUTE_MATRIX_REPEAT ?? '1';
  const repeatCount = Number.parseInt(value, 10);
  if (!Number.isSafeInteger(repeatCount) || repeatCount < 1 || repeatCount > 100) {
    throw new Error('ROUTE_MATRIX_REPEAT must be an integer from 1 to 100');
  }
  return repeatCount;
}

function readSetCookieNames(headers: Headers): readonly string[] {
  return headers
    .getSetCookie()
    .map((value) => value.slice(0, value.indexOf('=')))
    .filter(Boolean);
}

async function runProbe(
  baseUrl: URL,
  probe: ProductRouteProbe,
): Promise<ProbeResult> {
  const startedAt = performance.now();
  const errors: string[] = [];

  try {
    const headers = new Headers();
    if (probe.cookie) headers.set('cookie', probe.cookie);

    const response = await fetch(new URL(probe.path, baseUrl), {
      method: probe.method,
      headers,
      redirect: 'manual',
    });
    const locationHeader = response.headers.get('location');
    let location: string | null = null;
    if (locationHeader) {
      try {
        location = normalizeLocation(locationHeader, baseUrl);
      } catch (error) {
        errors.push(error instanceof Error ? error.message : String(error));
      }
    }
    const setCookieNames = readSetCookieNames(response.headers);

    if (response.status !== probe.expectedStatus) {
      errors.push(`expected status ${probe.expectedStatus}, received ${response.status}`);
    }
    if (probe.expectedLocation && location !== probe.expectedLocation) {
      errors.push(`expected Location ${probe.expectedLocation}, received ${location ?? '<none>'}`);
    }
    if (probe.expectedContentType) {
      const contentType = response.headers.get('content-type') ?? '';
      if (!contentType.startsWith(probe.expectedContentType)) {
        errors.push(`expected Content-Type ${probe.expectedContentType}, received ${contentType || '<none>'}`);
      }
    }
    if (probe.expectedAllow && response.headers.get('allow') !== probe.expectedAllow) {
      errors.push(
        `expected Allow ${probe.expectedAllow}, received ${response.headers.get('allow') ?? '<none>'}`,
      );
    }
    for (const requiredCookie of probe.requiredSetCookieNames ?? []) {
      if (!setCookieNames.includes(requiredCookie)) {
        errors.push(`missing Set-Cookie ${requiredCookie}`);
      }
    }
    if (probe.bodyIncludes && probe.method !== 'HEAD') {
      const body = await response.text();
      if (!body.includes(probe.bodyIncludes)) {
        errors.push(`response body does not include ${JSON.stringify(probe.bodyIncludes)}`);
      }
    }

    return {
      id: probe.id,
      method: probe.method,
      path: probe.path,
      status: response.status,
      location,
      durationMs: Math.round(performance.now() - startedAt),
      requestId:
        response.headers.get('x-railway-request-id') ?? response.headers.get('x-request-id'),
      allow: response.headers.get('allow'),
      setCookieNames,
      passed: errors.length === 0,
      errors,
    };
  } catch (error) {
    return {
      id: probe.id,
      method: probe.method,
      path: probe.path,
      status: null,
      location: null,
      durationMs: Math.round(performance.now() - startedAt),
      requestId: null,
      allow: null,
      setCookieNames: [],
      passed: false,
      errors: [error instanceof Error ? error.message : String(error)],
    };
  }
}

async function main(): Promise<void> {
  const baseUrl = requireBaseUrl();
  const personalBaseUrl = requirePersonalBaseUrl();
  const repeatCount = readRepeatCount();
  const samples: ProbeResult[][] = [];
  for (let index = 0; index < repeatCount; index += 1) {
    samples.push(
      await Promise.all(
        PRODUCT_ROUTE_PROBES.map((probe) =>
          runProbe(
            probe.target === 'personal' ? personalBaseUrl : baseUrl,
            probe,
          ),
        ),
      ),
    );
  }
  const results = samples.flat();
  const report = {
    baseUrl: baseUrl.href,
    personalBaseUrl: personalBaseUrl.href,
    revision: process.env.RAILWAY_GIT_COMMIT_SHA ?? process.env.GITHUB_SHA ?? null,
    generatedAt: new Date().toISOString(),
    repeatCount,
    passed: results.every(({ passed }) => passed),
    results,
  };
  const output = `${JSON.stringify(report, null, 2)}\n`;
  const reportPath = process.env.ROUTE_MATRIX_REPORT_PATH;

  if (reportPath) {
    await writeFile(reportPath, output, 'utf8');
  }
  process.stdout.write(output);

  if (!report.passed) process.exitCode = 1;
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`route matrix check failed: ${message}\n`);
  process.exitCode = 1;
});
