# Node: pass2-live-smoke (work)

## Blueprint
Establish proxy metadata connection directly to live remote substrate REST endpoints (bypassing `LocalDevMetadataStore` in production) and wire real publications to the Commands Gallery.

## Scope
- `apps/console/src/lib/server/metadata-rest.ts`
- `apps/console/src/views/program/programClient.ts`
- `apps/console/src/views/CommandsGalleryView.tsx`

## Obligations
- Configure same-origin proxy to forward metadata calls directly to configured remote metadata URL in staging/production.
- Ensure the commands gallery pulls real monitor templates and published graphs from the substrate.

## Claim
- **Controller:** agent
- **Claim State:** unclaimed
- **Work Log:** None

## Discharge Evidence
- Proxy calls successfully handle and respond.
