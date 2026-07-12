# Record 005: Growth Layer CommonPlace Port

## Status

Approved for implementation on 2026-07-10.

## Decision

The Growth Layer product surface belongs in CommonPlace v2 at `/v2/growth`, with a dedicated item under the Harness rail. Theorem remains the source of truth for Growth mechanics, signing, identity, and lineage. CommonPlace exposes those mechanics through its canonical GraphQL edge and renders them with the porcelain console register.

## Alternatives considered

### Keep the legacy harness-console surface

Rejected because `apps/harness-console` is the migration source, not the intended product home.

### Call a Growth REST route directly from the browser

Rejected because CommonPlace already has one browser-facing GraphQL front door. A direct REST path would create a second schema and authentication path.

### Copy the Growth mechanics into CommonPlace

Rejected because duplicated XP, readiness, signing, and lineage logic could disagree with Theorem. CommonPlace should own the product projection, not a second mechanics engine.

## Design solver result

- Primary domain: UI foundations
- Specialized domain: WebGL data visualization for Mathematics only
- HTML and CSS own layout, text, controls, and state
- SVG owns deterministic card art and static graphic fallbacks
- Canvas or WebGL owns only the enhanced live graph
- All material graph information has a semantic DOM equivalent

## Product rules

- Private harness owner first
- Marketplace and lineage publication fields are individually opt-in
- Collectible card is the single high-craft exception inside the restrained CommonPlace shell
- No shipped fixtures or URL mock flags
- Missing backend capability renders an honest unavailable state
- The legacy Growth UI remains in place until the CommonPlace port passes its acceptance oracles

## Acceptance criteria

1. `/v2/growth` is reachable from the Harness rail.
2. The frontend reads a typed Growth snapshot through `/api/theorem/graphql` only.
3. Card, Timeline, Mathematics, Stamp, and Marketplace expose live, empty, stale, error, and unavailable states as applicable.
4. Note Stamp snapshots persist through the CommonPlace write path.
5. Tabs satisfy the ARIA Authoring Practices keyboard contract.
6. Mathematics exposes a DOM equivalent, static fallback, reduced-motion mode, and renderer cleanup.
7. CSS uses the console register with no unapproved raw colors or one-off system values.
8. Rust, TypeScript, build, static design, rendered accessibility, and browser acceptance checks pass or report an external live gate precisely.
