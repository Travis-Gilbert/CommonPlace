# Node: verify-pass3-substrate (verify)

## Blueprint
Verify that the new frontend Part 4 & 6 features correctly interact with the substrate and pass all integration test gates.

## Scope
- `apps/console/src/views/program/programClient.test.ts`
- `apps/console/package.json`

## Obligations
- Write unit tests covering sweep serializations and cache-pressure payload mappings.
- Run complete browser-complete visual regression and console gates checking layout, token, and contract integrity.

## Claim
- **Controller:** agent
- **Claim State:** unclaimed
- **Work Log:** None

## Discharge Evidence
- **Proof Command:** `npm --prefix apps/console run gates && npx vitest run src/views/program`
