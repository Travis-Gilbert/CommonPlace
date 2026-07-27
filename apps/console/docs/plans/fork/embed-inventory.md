# SPEC-COMMONPLACE-FORK-1.0: FK9 embed inventory

Date: 2026-07-27

Upstream: `Mintplex-Labs/anythingllm-embed`

Upstream commit: `7e5c6afc0266a536dfeeae10b73747461b31ca44`

Parent gitlink: `Mintplex-Labs/anything-llm` commit
`633fc1960914298009134b40c25007cb422c7884`

Read-only source:
`/Volumes/SSD Samsung/commonplace-sources/anythingllm-embed`

This inventory was completed before any widget source was copied into or
edited in the independent fork. Git tree entries at the commit above are
authoritative. Ignored dependencies and untracked build output are excluded.
Lines are LF byte counts from Git blobs, so a binary asset can still report
lines when its bytes contain LF.

## Counts

| Verdict | Files | Lines |
|---|---:|---:|
| port | 59 | 6,584 |
| service | 0 | 0 |
| cut | 3 | 44 |
| **Total** | **62** | **6,628** |

The zero service count is intentional. This repository is a standalone browser
widget. It consumes history, reset, and streaming chat endpoints, but it does
not contain an Express, collector, CommonPlace, or Theorem server
implementation.

## Verdict meaning

- `port`: retain the file or its behavior in the independent widget fork.
- `service`: keep the file in a separately deployed server. No tracked file in
  this repository has this verdict.
- `cut`: do not copy the file into the independent fork.

The two AnythingLLM brand assets and its sponsor component are cut. The fork
must not depend on upstream trademark assets or send users to an upstream
promotional surface. The exact MIT license is a port and must remain present.
The request adapter, streaming state, markdown renderer, historical source
renderer, translations, and independent build configuration are all ports.

## Every tracked file

| File | Verdict | Lines | Reason |
|---|---:|---:|---|
| `.gitignore` | port | 25 | Retain independent dependency and build output exclusions. |
| `LICENSE` | port | 20 | Preserve the upstream MIT copyright and permission notice verbatim. |
| `README.md` | port | 124 | Rewrite setup and integration guidance for the independent fork while retaining provenance. |
| `index.html` | port | 16 | Retain the local development host page and adapt its fork configuration. |
| `jsconfig.json` | port | 10 | Retain editor and source alias configuration. |
| `package.json` | port | 55 | Adapt package identity and scripts for an independent build and test boundary. |
| `postcss.config.js` | port | 9 | Retain the widget CSS build pipeline. |
| `scripts/updateHljs.mjs` | port | 34 | Retain the deterministic syntax highlighter bundle update utility. |
| `src/App.jsx` | port | 74 | Retain widget mounting, open state, position, and dimensions with fork naming. |
| `src/assets/anything-llm-dark.png` | cut | 22 | Remove the upstream trademark asset from the hard fork. |
| `src/assets/anything-llm-icon.svg` | cut | 5 | Replace the upstream trademark icon with a fork-owned neutral mark. |
| `src/components/ChatWindow/ChatContainer/ChatHistory/HistoricalMessage/Actions/index.jsx` | port | 43 | Retain source actions and accessible interaction behavior. |
| `src/components/ChatWindow/ChatContainer/ChatHistory/HistoricalMessage/index.jsx` | port | 148 | Retain historical response, source citation, timestamp, and error rendering. |
| `src/components/ChatWindow/ChatContainer/ChatHistory/PromptReply/index.jsx` | port | 186 | Retain streamed response, source citation, thought, and error rendering. |
| `src/components/ChatWindow/ChatContainer/ChatHistory/index.jsx` | port | 166 | Retain ordered history, streaming replacement, suggestions, and scroll behavior. |
| `src/components/ChatWindow/ChatContainer/PromptInput/index.jsx` | port | 106 | Retain message composition and send behavior. |
| `src/components/ChatWindow/ChatContainer/index.jsx` | port | 149 | Retain history loading, stream state, and chat submission orchestration. |
| `src/components/ChatWindow/Header/index.jsx` | port | 162 | Retain configurable header, reset, close, and support behavior with fork defaults. |
| `src/components/ChatWindow/index.jsx` | port | 102 | Retain the chat window composition and optional footer boundary. |
| `src/components/Head.jsx` | port | 131 | Retain isolated widget styles and external built stylesheet loading. |
| `src/components/OpenButton/index.jsx` | port | 35 | Retain the configurable launcher button. |
| `src/components/ResetChat/index.jsx` | port | 43 | Retain session reset behavior. |
| `src/components/SessionId/index.jsx` | port | 12 | Retain optional development session visibility. |
| `src/components/Sponsor/index.jsx` | cut | 17 | Remove the upstream promotional surface from the hard fork. |
| `src/hooks/chat/useChatHistory.js` | port | 27 | Retain initial history loading behavior. |
| `src/hooks/useOpen.js` | port | 16 | Retain widget open and close state. |
| `src/hooks/useScriptAttributes.js` | port | 109 | Extend the script configuration contract for fork server URL and authentication. |
| `src/hooks/useSessionId.js` | port | 29 | Retain anonymous session continuity. |
| `src/i18n.js` | port | 32 | Retain localized widget initialization. |
| `src/index.css` | port | 32 | Retain the widget stylesheet entry point. |
| `src/locales/ar/common.js` | port | 13 | Retain Arabic interface messages. |
| `src/locales/da/common.js` | port | 13 | Retain Danish interface messages. |
| `src/locales/de/common.js` | port | 13 | Retain German interface messages. |
| `src/locales/en/common.js` | port | 12 | Retain and adapt English interface messages. |
| `src/locales/es/common.js` | port | 13 | Retain Spanish interface messages. |
| `src/locales/fa/common.js` | port | 13 | Retain Persian interface messages. |
| `src/locales/fr/common.js` | port | 13 | Retain French interface messages. |
| `src/locales/he/common.js` | port | 13 | Retain Hebrew interface messages. |
| `src/locales/it/common.js` | port | 13 | Retain Italian interface messages. |
| `src/locales/ja/common.js` | port | 13 | Retain Japanese interface messages. |
| `src/locales/ko/common.js` | port | 13 | Retain Korean interface messages. |
| `src/locales/nl/common.js` | port | 13 | Retain Dutch interface messages. |
| `src/locales/normalizeEn.mjs` | port | 157 | Retain the localization maintenance utility. |
| `src/locales/pt_BR/common.js` | port | 13 | Retain Brazilian Portuguese interface messages. |
| `src/locales/resources.js` | port | 92 | Retain the language resource registry. |
| `src/locales/ru/common.js` | port | 13 | Retain Russian interface messages. |
| `src/locales/tr/common.js` | port | 13 | Retain Turkish interface messages. |
| `src/locales/verifyTranslations.mjs` | port | 100 | Retain the independent translation verification gate. |
| `src/locales/vn/common.js` | port | 13 | Retain Vietnamese interface messages. |
| `src/locales/zh/common.js` | port | 13 | Retain Simplified Chinese interface messages. |
| `src/locales/zh_TW/common.js` | port | 13 | Retain Traditional Chinese interface messages. |
| `src/main.jsx` | port | 37 | Retain library bootstrapping and adapt global identity and style discovery. |
| `src/models/chatService.js` | port | 109 | Retain history, reset, and SSE requests behind configurable fork URL and auth. |
| `src/utils/chat/hljs.js` | port | 88 | Retain the self-contained syntax language registry. |
| `src/utils/chat/index.js` | port | 120 | Retain streamed message and source state handling. |
| `src/utils/chat/markdown.js` | port | 68 | Retain sanitized markdown and safe external link rendering. |
| `src/utils/chat/purify.js` | port | 8 | Retain DOMPurify sanitization before HTML insertion. |
| `src/utils/constants.js` | port | 15 | Adapt widget event and generated stylesheet naming. |
| `src/utils/date.js` | port | 15 | Retain timestamp formatting. |
| `tailwind.config.js` | port | 103 | Retain the isolated CSS namespace and source scan. |
| `vite.config.js` | port | 68 | Adapt the UMD library and artifact names for the independent fork. |
| `yarn.lock` | port | 3,476 | Retain the exact dependency resolution until an intentional lock refresh. |

## Inventory verification

The source checkout was detached at the gitlink commit and its push URL was
disabled before inventory:

```text
HEAD: 7e5c6afc0266a536dfeeae10b73747461b31ca44
origin fetch: https://github.com/Mintplex-Labs/anythingllm-embed.git
origin push: DISABLED
tracked files: 62
LF line bytes: 6628
```

The destination repository did not exist when this inventory was completed.
