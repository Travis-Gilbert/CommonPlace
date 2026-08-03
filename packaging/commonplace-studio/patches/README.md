# Patch queue

Empty, and that is the target state.

Patches are applied in filename order by `scripts/build.sh`, named
`NNNN-short-name.patch`, and each one must have a `LEDGER.md` entry naming its
reason, the upstream issue, and the condition that would let it be deleted.
`scripts/ledger-gate.sh` fails the build otherwise.

Before adding one, re-read named choice 1: a capability lands here only after a
written finding that the extension API cannot express it.
