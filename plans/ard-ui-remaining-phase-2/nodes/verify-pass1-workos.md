# Node: verify-pass1-workos (verify)

## Blueprint
Verify that the WorkOS provider session callback, parsing, and token exchanges correctly authenticate local test users and parse profiles.

## Scope
- `apps/console/src/lib/auth.ts`
- `apps/console/src/lib/auth.test.ts` (or mock-test equivalent)

## Obligations
- Verify session middleware protects dashboard route.
- Write unit tests or Mock provider configurations verifying WorkOS profile payload parsing into user accounts.

## Claim
- **Controller:** agent
- **Claim State:** unclaimed
- **Work Log:** None

## Discharge Evidence
- **Proof Command:** `npm --prefix apps/console run test` (including any mock auth-route tests)
