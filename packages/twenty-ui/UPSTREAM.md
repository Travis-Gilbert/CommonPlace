# Upstream pin

| Field | Value |
|---|---|
| Source repository | `https://github.com/twentyhq/twenty.git` |
| Subpath | `packages/twenty-ui` |
| Commit SHA | `b754e15331c6472d772b1bbe448469f811b28afd` |
| Upstream version | `1.0.0-alpha.1` |
| Upstream license | MIT (`packages/twenty-ui/LICENSE`, and the MIT carve-out declared in the monorepo root LICENSE) |
| Vendored on | 2026-08-01 |
| Vendored under | `SPEC-COMMONPLACE-TWENTY-UI-FORK-1.0` TU1 |

## Restoring the upstream remote

The remote is retained for cherry-picks. Add it when missing:

```
git remote add twenty https://github.com/twentyhq/twenty.git
git fetch twenty --depth 1
```

To diff this fork against the pinned upstream subtree:

```
git diff b754e15331c6472d772b1bbe448469f811b28afd -- packages/twenty-ui
```

## The license bright line

Only `packages/twenty-ui` crosses into this repository. Nothing from
`twenty-front`, `twenty-server`, or any file carrying the `/* @license Enterprise */`
marker is vendored, copied, referenced, or imported, ever. The boundary is
mechanical: `apps/console/scripts/check-twenty-fence.mjs` fails CI when any
import resolves into a Twenty path other than `packages/twenty-ui`.

MIT does not license trademarks. Twenty's marks and identity-carrying brand
assets, and third-party company marks that upstream vendored, are removed. See
`MODIFICATIONS.md` for the removal list.
