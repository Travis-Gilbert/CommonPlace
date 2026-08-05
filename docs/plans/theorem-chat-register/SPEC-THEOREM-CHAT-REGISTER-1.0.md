# SPEC-THEOREM-CHAT-REGISTER-1.0 (draft skeleton for CR-003)

Status: **draft — fill under CR-003**. This skeleton locks the decisions from
[`PLAN.md`](./PLAN.md) so implementation cannot silently widen or shrink scope.

## 1. Problem

Commonplace Studio’s Copilot `defaultChatAgent` hole and console `/chat`
(OpenWork) must become **one** Theorem chat register. Two hosts, one package.

## 2. Package (to name in CR-003)

| Field | Value (fill) |
|---|---|
| Package path | `packages/…` or `apps/…` |
| Export surface | composer + thread + session opener |
| Transport | Theorem ACP / heads (not OpenWork→opencode) |
| `register_impl` | e.g. `theorem.chat` (final string in CR-003) |

## 3. Mounts

| Host | Seam | Acceptance |
|---|---|---|
| Commonplace Studio | Agent/chat panel (post Copilot retirement) | Signed-in `/IDE` shows Theorem register; ACP session against `/workspace/repo` |
| Console | `/chat` (+ registry descriptors that today point at `openwork.chat`) | Stamp is Theorem `register_impl`; doctor green |

## 4. Explicit non-goal

Do **not** set `product.json` `defaultChatAgent` to `commonplace.theorem-vscode`
until the pack implements VS Code Chat participant / host APIs. Overlay deletion
+ our register UI is the honest cut.

## 5. Retirement inventory (expand in CR-003)

- [ ] `openwork.chat` register stamps (`OpenworkChatRegister`, middleware)
- [ ] Workspace OpenWork `:8787` as product `/chat` host (retire or gate)
- [ ] opencode / LLM-only happy path behind OpenWork
- [ ] assistant-ui-only chat components superseded by this register (if still reachable)
- [ ] Doctor / `.commonplace-canonical` / register-manifest rows

## 6. Oracles

- Package tests (CR-004)
- Live `/IDE` panel smoke (CR-005)
- Live `/chat` stamp + `check-register-manifest` + doctor (CR-006)
- EXECUTE-REPORT (CR-007)
