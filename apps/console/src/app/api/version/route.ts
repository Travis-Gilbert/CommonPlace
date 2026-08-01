// SOURCING: none. Pure logic, no upstream component applies.
//
// Which commit this console is running. The sibling of /api/healthz: healthz
// says the process answers, version says what code is answering.
//
// On 2026-08-01 the console served a build that was weeks stale because two
// deployments had failed and Railway kept the last good image live. Nothing on
// the running service could report that, so "the console is up" and "the
// console has your change" were indistinguishable from outside.
//
// force-dynamic is load-bearing. Without it Next evaluates this handler during
// the build and freezes whatever process.env held then, which is the one value
// guaranteed to be wrong at request time.
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/** Trim, and treat blank as absent, so a set-but-empty var is not reported. */
function runtimeEnv(name: string): string | null {
  const value = process.env[name]?.trim();
  return value ? value : null;
}

export function GET() {
  return NextResponse.json({
    schema_version: 1,
    service: 'commonplace-console',
    git: {
      // Railway injects these into the running container per deployment. They
      // are not part of the configured variable set, so `railway variables`
      // does not list them; read them at request time.
      sha: runtimeEnv('RAILWAY_GIT_COMMIT_SHA') ?? runtimeEnv('GITHUB_SHA'),
      branch: runtimeEnv('RAILWAY_GIT_BRANCH') ?? runtimeEnv('GITHUB_REF_NAME'),
    },
    railway: {
      project_id: runtimeEnv('RAILWAY_PROJECT_ID'),
      service_id: runtimeEnv('RAILWAY_SERVICE_ID'),
      service_name: runtimeEnv('RAILWAY_SERVICE_NAME'),
      environment_name: runtimeEnv('RAILWAY_ENVIRONMENT_NAME'),
      replica_id: runtimeEnv('RAILWAY_REPLICA_ID'),
    },
  });
}
