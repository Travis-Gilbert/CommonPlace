# Node: verify-pass2-live (verify)

## Blueprint
Execute and verify the live proxy and gallery queries without fallback using the env-gated smoke scripts.

## Scope
- `apps/console/scripts/smoke-metadata-rest.mjs`

## Obligations
- Verify `smoke-metadata-rest.mjs` runs with exit code 0 when metadata URL is configured.
- Ensure the proxy responds with live metadata payloads (not marked LocalDev).

## Claim
- **Controller:** agent
- **Claim State:** unclaimed
- **Work Log:** None

## Discharge Evidence
- **Proof Command:** `node apps/console/scripts/smoke-metadata-rest.mjs`
