# Node: pass1-workos (work)

## Blueprint
Swap the Next-Auth provider in `auth.ts` from GitHub to WorkOS AuthKit, keeping the user session shell and existing layout navigation fully functional.

## Scope
- `apps/console/src/lib/auth.ts`
- `apps/console/package.json`

## Obligations
- Install `@auth/workos` or correct workos next-auth client provider dependency.
- Configure `WorkOSProvider` inside `auth.ts` with client secret and client ID env options.
- Maintain existing session user structure so header profile chips continue to render correctly.

## Claim
- **Controller:** agent
- **Claim State:** unclaimed
- **Work Log:** None

## Discharge Evidence
- Code compiled and verified by linter.
