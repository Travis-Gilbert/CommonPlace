# SPEC-THEOREM-CHAT-REGISTER-1.0

Status: **normative for CR-003..007**. Decisions locked in
[`PLAN.md`](./PLAN.md). Do not silently widen into `IDefaultChatAgent`.

## 1. Problem

Commonplace Studio’s Copilot hole and console `/chat` (OpenWork / opencode)
must become **one** Theorem chat register. Two hosts, one package, one
`register_impl` stamp.

## 2. Package

| Field | Value |
|---|---|
| Package path | `packages/theorem-chat-register` |
| npm name | `@commonplace/theorem-chat-register` |
| Export surface | `REGISTER_IMPL`, `createChatSessionController`, `TheoremChatRegister`, `ChatTransport` |
| Transport | Theorem ACP / heads via injectable `ChatTransport` (console → `/api/chat/stream`; Studio → hosted ACP). **Not** OpenWork→opencode. |
| `register_impl` | `theorem.chat` |

### Public API (CR-004)

- `REGISTER_IMPL = 'theorem.chat'`
- `ChatTransport`: `{ openSession(), prompt(text), subscribe(listener), dispose() }`
- `createChatSessionController(transport)`: session open + one-turn prompt; pure logic, no React
- `TheoremChatRegister`: React shell with `data-register-impl="theorem.chat"`, composer, message list

Happy-path package dependencies must not include `openworklabs`, `@commonplace/chat` OpenWork UI, or `opencode`.

## 3. Mounts

| Host | Seam | Acceptance |
|---|---|---|
| Commonplace Studio | Theorem Chat webview / agent panel (`apps/theorem-vscode`) | Signed-in `/IDE` shows Theorem register UI; ACP session against `/workspace/repo`; no Copilot sign-in wall |
| Console | `/chat` (+ registry descriptors that formerly pointed at `openwork.chat`) | Stamp is `theorem.chat`; doctor + register-manifest green; middleware does **not** reverse-proxy OpenWork as the product body |

## 4. Explicit non-goal

Do **not** set `product.json` `defaultChatAgent` to `commonplace.theorem-vscode`
until the pack implements VS Code Chat participant / host APIs. Overlay deletion
(CR-001) + this register UI is the honest cut. Deferral **D1**.

## 5. Retirement inventory

| Item | Action |
|---|---|
| `openwork.chat` stamps (`OpenworkChatRegister`, middleware `x-register-impl` / `data-register-impl`) | Replace with `theorem.chat`; keep `OpenworkChatRegister` file only as a deprecated alias or delete call sites |
| Console `/chat` → workspace `:8787` OpenWork proxy (`CONSOLE_WORKSPACE_URL` middleware) | Disable product proxy; `/chat` renders Theorem register. Keep `CONSOLE_WORKSPACE_URL` for IDE derivation / doctor substrate probes if still needed |
| Workspace OpenWork `:8787` as product `/chat` host | Off product path. Process may remain for healthcheck until a follow-up moves health off OpenWork (record in CR-007) |
| opencode / LLM-only happy path behind OpenWork | Not the product `/chat` host |
| assistant-ui console shell chat (`ConsoleApp` / thread store → `/api/chat/stream`) | Remains the in-shell composer path; `/chat` register is the full-page place. Same ACP stream, not a second LLM |
| Doctor / `.commonplace-canonical` / `register-impl.ts` / register-manifest | `chat.surface` → `theorem.chat`; canonical package row points at `@commonplace/theorem-chat-register` |
| Historical OW* specs | Supersession notes only (deferral **D2** full archive) |

## 6. Oracles

| Gate | Command / proof |
|---|---|
| CR-003 | This SPEC names path, `register_impl`, seams, inventory |
| CR-004 | `pnpm --filter @commonplace/theorem-chat-register test` |
| CR-005 | Pack builds; webview stamped `theorem.chat`; session opener uses workspace cwd |
| CR-006 | Live `/chat` stamp `theorem.chat`; `node scripts/check-register-manifest.mjs`; doctor route ok |
| CR-007 | `docs/plans/theorem-chat-register/EXECUTE-REPORT.md` |

## 7. Rollback

- Re-enable OpenWork middleware behind an explicit env (`CONSOLE_OPENWORK_CHAT_PROXY=1`) only as emergency rollback; default is Theorem register.
- Studio pack: hide Theorem Chat view command if ACP URL unset; do not restore Copilot product keys.
