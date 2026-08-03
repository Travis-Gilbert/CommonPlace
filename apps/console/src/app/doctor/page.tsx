// SOURCING: none. SPEC-COMMONPLACE-PRODUCTION-CUTOVER-1.0 GL4.
// Human-glance doctor page. Same observations as /api/doctor.

import Link from 'next/link';

export const dynamic = 'force-dynamic';

type DoctorPayload = {
  ok: boolean;
  base: string;
  env: Array<{ key: string; lit: boolean; required: boolean }>;
  routes: Array<{
    id: string;
    route: string;
    expected_impl: string;
    status: number | null;
    observed_impl: string | null;
    ok: boolean;
  }>;
  resurrections: Array<{ id: string; path: string; absent: boolean }>;
  ow4_route_versus_zone?: string;
  error?: string;
};

async function loadDoctor(): Promise<DoctorPayload> {
  const base =
    process.env.DOCTOR_PUBLIC_BASE_URL?.replace(/\/$/, '') ||
    (process.env.RAILWAY_PUBLIC_DOMAIN
      ? `https://${process.env.RAILWAY_PUBLIC_DOMAIN}`
      : 'https://v2.theoremharness.com');
  try {
    const response = await fetch(`${base}/api/doctor`, { cache: 'no-store' });
    return (await response.json()) as DoctorPayload;
  } catch (error) {
    return {
      ok: false,
      base,
      env: [],
      routes: [],
      resurrections: [],
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

function Row({ ok, children }: { ok: boolean; children: React.ReactNode }) {
  return (
    <li
      data-doctor-row={ok ? 'green' : 'red'}
      className={`border-b border-ij-seam px-3 py-2 font-ij-mono text-sm ${ok ? 'text-ij-ink' : 'text-ij-danger'}`}
    >
      {ok ? 'ok' : 'FAIL'} · {children}
    </li>
  );
}

export default async function DoctorPage() {
  const doctor = await loadDoctor();
  return (
    <main
      data-doctor-page
      data-doctor-ok={doctor.ok ? 'true' : 'false'}
      className="min-h-screen bg-ij-ground text-ij-ink"
    >
      <header className="border-b border-ij-seam px-4 py-3">
        <p className="text-xs uppercase tracking-wide text-ij-ink-info">CommonPlace doctor</p>
        <h1 className="text-lg" style={{ fontWeight: 'var(--rec-weight-cap)' }}>
          {doctor.ok ? 'Green' : 'Red'} at {doctor.base}
        </h1>
        <p className="text-sm text-ij-ink-info">
          OW4 serving decision: {doctor.ow4_route_versus_zone ?? 'route'} on the console origin.
          Observations only. Harness receipts are not trusted here.
        </p>
        <p className="mt-2 text-sm">
          <Link className="text-ij-link underline" href="/api/doctor">
            /api/doctor JSON
          </Link>
        </p>
      </header>
      {doctor.error ? (
        <p className="px-4 py-3 text-ij-danger">{doctor.error}</p>
      ) : null}
      <section className="px-4 py-3">
        <h2 className="mb-2 text-sm uppercase text-ij-ink-info">Env contract</h2>
        <ul>
          {doctor.env.map((row) => (
            <Row key={row.key} ok={!row.required || row.lit}>
              {row.key} {row.lit ? 'lit' : 'down'}
              {row.required ? '' : ' (optional)'}
            </Row>
          ))}
        </ul>
      </section>
      <section className="px-4 py-3">
        <h2 className="mb-2 text-sm uppercase text-ij-ink-info">Register routes</h2>
        <ul>
          {doctor.routes.map((row) => (
            <Row key={row.id} ok={row.ok}>
              {row.route} expected {row.expected_impl}; observed {row.observed_impl ?? 'none'}; status{' '}
              {row.status ?? 'error'}
            </Row>
          ))}
        </ul>
      </section>
      <section className="px-4 py-3">
        <h2 className="mb-2 text-sm uppercase text-ij-ink-info">Resurrections</h2>
        <ul>
          {doctor.resurrections.map((row) => (
            <Row key={`${row.id}:${row.path}`} ok={row.absent}>
              {row.id} {row.path} {row.absent ? 'absent' : 'STILL PRESENT'}
            </Row>
          ))}
        </ul>
      </section>
    </main>
  );
}
