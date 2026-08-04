# Patch queue

**Patch count: 2** (build-only; see `LEDGER.md`). Target state remains zero
capability patches.

| Patch | Why |
| --- | --- |
| `0001-mangler-keep-session-changes-overrides-protected.patch` | `-min` mangler refuses public overrides of protected methods |
| `0002-reh-web-unminified-skip-mangler.patch` | Unminified reh-web still ran mangling and OOM'd the Railway builder |

Patches are applied in filename order by `scripts/build.sh`, named
`NNNN-short-name.patch`, and each one must have a `LEDGER.md` entry naming its
reason, the upstream issue, and the condition that would let it be deleted.
`scripts/ledger-gate.sh` fails the build otherwise.

Before adding one, re-read named choice 1: a capability lands here only after a
written finding that the extension API cannot express it.
