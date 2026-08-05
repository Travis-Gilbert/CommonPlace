# Patch queue

**Patch count: 3** (build-only + Copilot product-host retirement; see
`LEDGER.md`). Capability still lives in `apps/theorem-vscode` and the overlay.

| Patch | Why |
| --- | --- |
| `0001-mangler-keep-session-changes-overrides-protected.patch` | `-min` mangler refuses public overrides of protected methods |
| `0002-reh-web-unminified-skip-mangler.patch` | Unminified reh-web still ran mangling and OOM'd the Railway builder |
| `0003-retire-default-chat-agent-copilot.patch` | Deleting upstream `defaultChatAgent` needs null-checks; retitles web walkthrough |

Patches are applied in filename order by `scripts/build.sh`, named
`NNNN-short-name.patch`, and each one must have a `LEDGER.md` entry naming its
reason, the upstream issue, and the condition that would let it be deleted.
`scripts/ledger-gate.sh` fails the build otherwise.

Before adding one, re-read named choice 1: a capability lands here only after a
written finding that the extension API cannot express it.
