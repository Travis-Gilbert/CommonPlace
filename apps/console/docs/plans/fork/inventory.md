# SPEC-COMMONPLACE-FORK-1.0: FK1 inventory and cut list

Date: 2026-07-27

Upstream: `Mintplex-Labs/anything-llm`

Upstream commit: `633fc1960914298009134b40c25007cb422c7884`

Generation command:

```sh
node apps/console/scripts/generate-fork-inventory.mjs --source <anything-llm-checkout>
```

This inventory is classification only. No source file from AnythingLLM has been copied into the CommonPlace worktree. The generator reads tracked blobs from the named upstream commit and writes only this document.

Scope is every tracked regular file in `frontend/src`, `server`, and `collector` at the commit above. Git tree entries are authoritative, so ignored dependencies and untracked build output are excluded. Lines are LF byte counts from Git blobs. Binary assets can therefore report zero lines.

## Counts

| Root | Port files | Service files | Cut files | Total files | Lines |
|---|---:|---:|---:|---:|---:|
| `frontend/src` | 549 | 0 | 144 | 693 | 147,874 |
| `server` | 0 | 282 | 257 | 539 | 114,792 |
| `collector` | 0 | 71 | 0 | 71 | 12,783 |
| **Total** | **549** | **353** | **401** | **1,303** | **275,449** |

| Verdict | Files | Lines |
|---|---:|---:|
| port | 549 | 126,535 |
| service | 353 | 76,525 |
| cut | 401 | 72,389 |

Total scope: 1,303 files and 275,449 lines.

## Verdict meaning

- `port`: translate surviving frontend behavior into `apps/console`, TypeScript, the App Router, and the component register.
- `service`: keep or adapt the behavior in the standalone Express or collector service. This verdict does not authorize a Next port.
- `cut`: do not copy the upstream file. The named behavior is replaced or outside the product boundary.

## Known cuts

### Frontend provider configuration

The following nine `frontend/src/pages/GeneralSettings` directories are cut: `LLMPreference`, `EmbeddingPreference`, `EmbeddingTextSplitterPreference`, `VectorDatabase`, `TranscriptionPreference`, `AudioPreference`, `ModelRouters`, `Connections`, `MobileConnections`.

The following nine top-level `frontend/src/components` directories are cut: `LLMSelection`, `EmbeddingSelection`, `VectorDBSelection`, `TranscriptionSelection`, `DataConnectorOption`, `ProviderPrivacy`, `SpeechToText`, `TextToSpeech`, `CommunityHub`.

Provider and model selectors nested in onboarding, workspace settings, and the chat composer are also cut. The Harness owns execution and model routing, so the fork has no provider selection UI.

These are destination verdicts, not proof that each directory can be deleted before its consumers move. Onboarding, workspace settings, chat tools, and document connector flows still import several cut components at the pinned commit. Their surviving parents must be ported away from those dependencies before the cut is applied.

### Vector and embedding providers

All ten upstream provider directories below `server/utils/vectorDbProviders` are cut: `astra`, `chroma`, `chromacloud`, `lance`, `milvus`, `pgvector`, `pinecone`, `qdrant`, `weaviate`, `zilliz`. The base adapter contract is retained only as a seam for `rustyred`; no second provider is retained.

The upstream `EmbeddingEngines` implementations are cut because `commonplace::IngestPipeline` owns embedding and ingestion. The legacy embedding worker, vector model, and vector reset utility are cut with that tier.

### Agent and LLM providers

The complete `server/utils/agents/aibitat` tree and its focused tests are cut. The Harness is the only executor and supplies plans, runs, receipts, coordination, and memory.

Every upstream connector under `server/utils/AiProviders` is cut. These connectors are not routed by the Harness, and retaining them would create a second model execution layer.

### Browser ML and audio providers

The server-side native embedding and reranking paths are cut, including the `@xenova/transformers` dependency chain that brings in `onnxruntime-web`. The server manifest and lockfile remain service files but must be pruned and regenerated during implementation.

The collector remains a service in this inventory, but the verdict does not mean it runs unchanged as a network peer. The pinned source shares its upload hot directory, output storage, and rotating integrity keys with Express. FK7 must make those service boundaries explicit. Its local Whisper dependency is collector-side document parsing, not the removed server embedding path.

The upstream server speech-to-text and text-to-speech provider tiers are cut together with their provider-selection UI.

## `frontend/src`

| File | Verdict | Lines | Reason |
|---|---:|---:|---|
| `frontend/src/App.jsx` | port | 47 | Port the surviving frontend behavior into the typed console page architecture. |
| `frontend/src/AuthContext.jsx` | port | 79 | Port the surviving frontend behavior into the typed console page architecture. |
| `frontend/src/EmbeddingProgressContext.jsx` | port | 240 | Port the surviving frontend behavior into the typed console page architecture. |
| `frontend/src/LogoContext.jsx` | port | 56 | Port the surviving frontend behavior into the typed console page architecture. |
| `frontend/src/PWAContext.jsx` | port | 93 | Port the surviving frontend behavior into the typed console page architecture. |
| `frontend/src/PfpContext.jsx` | port | 30 | Port the surviving frontend behavior into the typed console page architecture. |
| `frontend/src/ThemeContext.jsx` | port | 16 | Port the surviving frontend behavior into the typed console page architecture. |
| `frontend/src/components/CanViewChatHistory/index.jsx` | port | 50 | Port the surviving frontend behavior into the typed console page architecture. |
| `frontend/src/components/ChangeWarning/index.jsx` | port | 61 | Port the surviving frontend behavior into the typed console page architecture. |
| `frontend/src/components/ChatBubble/index.jsx` | port | 31 | Port the surviving frontend behavior into the typed console page architecture. |
| `frontend/src/components/CommunityHub/PublishEntityModal/AgentFlows/index.jsx` | cut | 261 | The upstream Community Hub distribution surface is outside the Theorem product. |
| `frontend/src/components/CommunityHub/PublishEntityModal/SlashCommands/index.jsx` | cut | 257 | The upstream Community Hub distribution surface is outside the Theorem product. |
| `frontend/src/components/CommunityHub/PublishEntityModal/SystemPrompts/index.jsx` | cut | 251 | The upstream Community Hub distribution surface is outside the Theorem product. |
| `frontend/src/components/CommunityHub/PublishEntityModal/index.jsx` | cut | 49 | The upstream Community Hub distribution surface is outside the Theorem product. |
| `frontend/src/components/CommunityHub/UnauthenticatedHubModal/index.jsx` | cut | 40 | The upstream Community Hub distribution surface is outside the Theorem product. |
| `frontend/src/components/ContextualSaveBar/index.jsx` | port | 32 | Port the surviving frontend behavior into the typed console page architecture. |
| `frontend/src/components/DataConnectorOption/media/confluence.jpeg` | cut | 12 | The provider-neutral connector chooser is replaced by the collector service flow. |
| `frontend/src/components/DataConnectorOption/media/drupalwiki.jpg` | cut | 27 | The provider-neutral connector chooser is replaced by the collector service flow. |
| `frontend/src/components/DataConnectorOption/media/github.svg` | cut | 4 | The provider-neutral connector chooser is replaced by the collector service flow. |
| `frontend/src/components/DataConnectorOption/media/gitlab.svg` | cut | 7 | The provider-neutral connector chooser is replaced by the collector service flow. |
| `frontend/src/components/DataConnectorOption/media/index.js` | cut | 21 | The provider-neutral connector chooser is replaced by the collector service flow. |
| `frontend/src/components/DataConnectorOption/media/link.svg` | cut | 0 | The provider-neutral connector chooser is replaced by the collector service flow. |
| `frontend/src/components/DataConnectorOption/media/obsidian.png` | cut | 490 | The provider-neutral connector chooser is replaced by the collector service flow. |
| `frontend/src/components/DataConnectorOption/media/paperless-ngx.jpeg` | cut | 148 | The provider-neutral connector chooser is replaced by the collector service flow. |
| `frontend/src/components/DataConnectorOption/media/youtube.svg` | cut | 10 | The provider-neutral connector chooser is replaced by the collector service flow. |
| `frontend/src/components/DefaultChat/index.jsx` | port | 116 | Port the surviving frontend behavior into the typed console page architecture. |
| `frontend/src/components/EmbeddingSelection/AzureAiOptions/index.jsx` | cut | 55 | Provider-neutral selection UI is outside the Theorem product boundary. |
| `frontend/src/components/EmbeddingSelection/CohereOptions/index.jsx` | cut | 98 | Provider-neutral selection UI is outside the Theorem product boundary. |
| `frontend/src/components/EmbeddingSelection/EmbedderItem/index.jsx` | cut | 37 | Provider-neutral selection UI is outside the Theorem product boundary. |
| `frontend/src/components/EmbeddingSelection/GeminiOptions/index.jsx` | cut | 103 | Provider-neutral selection UI is outside the Theorem product boundary. |
| `frontend/src/components/EmbeddingSelection/GenericOpenAiOptions/index.jsx` | cut | 228 | Provider-neutral selection UI is outside the Theorem product boundary. |
| `frontend/src/components/EmbeddingSelection/LMStudioOptions/index.jsx` | cut | 313 | Provider-neutral selection UI is outside the Theorem product boundary. |
| `frontend/src/components/EmbeddingSelection/LemonadeOptions/index.jsx` | cut | 267 | Provider-neutral selection UI is outside the Theorem product boundary. |
| `frontend/src/components/EmbeddingSelection/LiteLLMOptions/index.jsx` | cut | 199 | Provider-neutral selection UI is outside the Theorem product boundary. |
| `frontend/src/components/EmbeddingSelection/LocalAiOptions/index.jsx` | cut | 285 | Provider-neutral selection UI is outside the Theorem product boundary. |
| `frontend/src/components/EmbeddingSelection/MistralAiOptions/index.jsx` | cut | 44 | Provider-neutral selection UI is outside the Theorem product boundary. |
| `frontend/src/components/EmbeddingSelection/NativeEmbeddingOptions/index.jsx` | cut | 100 | Provider-neutral selection UI is outside the Theorem product boundary. |
| `frontend/src/components/EmbeddingSelection/OllamaOptions/index.jsx` | cut | 279 | Provider-neutral selection UI is outside the Theorem product boundary. |
| `frontend/src/components/EmbeddingSelection/OpenAiOptions/index.jsx` | cut | 51 | Provider-neutral selection UI is outside the Theorem product boundary. |
| `frontend/src/components/EmbeddingSelection/OpenRouterOptions/index.jsx` | cut | 96 | Provider-neutral selection UI is outside the Theorem product boundary. |
| `frontend/src/components/EmbeddingSelection/VoyageAiOptions/index.jsx` | cut | 56 | Provider-neutral selection UI is outside the Theorem product boundary. |
| `frontend/src/components/ErrorBoundaryFallback/index.jsx` | port | 93 | Port the surviving frontend behavior into the typed console page architecture. |
| `frontend/src/components/Footer/index.jsx` | port | 143 | Port the surviving frontend behavior into the typed console page architecture. |
| `frontend/src/components/ImageLightbox/index.jsx` | port | 115 | Port the surviving frontend behavior into the typed console page architecture. |
| `frontend/src/components/KeyboardShortcutsHelp/index.jsx` | port | 60 | Port the surviving frontend behavior into the typed console page architecture. |
| `frontend/src/components/LLMSelection/AnthropicAiOptions/index.jsx` | cut | 151 | Provider-neutral selection UI is outside the Theorem product boundary. |
| `frontend/src/components/LLMSelection/ApiPieOptions/index.jsx` | cut | 101 | Provider-neutral selection UI is outside the Theorem product boundary. |
| `frontend/src/components/LLMSelection/AwsBedrockLLMOptions/index.jsx` | cut | 181 | Provider-neutral selection UI is outside the Theorem product boundary. |
| `frontend/src/components/LLMSelection/AwsBedrockLLMOptions/regions.js` | cut | 211 | Provider-neutral selection UI is outside the Theorem product boundary. |
| `frontend/src/components/LLMSelection/AzureAiOptions/index.jsx` | cut | 128 | Provider-neutral selection UI is outside the Theorem product boundary. |
| `frontend/src/components/LLMSelection/CerebrasLLMOptions/index.jsx` | cut | 109 | Provider-neutral selection UI is outside the Theorem product boundary. |
| `frontend/src/components/LLMSelection/CohereAiOptions/index.jsx` | cut | 100 | Provider-neutral selection UI is outside the Theorem product boundary. |
| `frontend/src/components/LLMSelection/CometApiLLMOptions/index.jsx` | cut | 155 | Provider-neutral selection UI is outside the Theorem product boundary. |
| `frontend/src/components/LLMSelection/DeepSeekOptions/index.jsx` | cut | 100 | Provider-neutral selection UI is outside the Theorem product boundary. |
| `frontend/src/components/LLMSelection/DockerModelRunnerOptions/index.jsx` | cut | 386 | Provider-neutral selection UI is outside the Theorem product boundary. |
| `frontend/src/components/LLMSelection/FireworksAiOptions/index.jsx` | cut | 109 | Provider-neutral selection UI is outside the Theorem product boundary. |
| `frontend/src/components/LLMSelection/FoundryOptions/index.jsx` | cut | 110 | Provider-neutral selection UI is outside the Theorem product boundary. |
| `frontend/src/components/LLMSelection/GeminiLLMOptions/index.jsx` | cut | 138 | Provider-neutral selection UI is outside the Theorem product boundary. |
| `frontend/src/components/LLMSelection/GenericOpenAiOptions/index.jsx` | cut | 201 | Provider-neutral selection UI is outside the Theorem product boundary. |
| `frontend/src/components/LLMSelection/GiteeAIOptions/index.jsx` | cut | 116 | Provider-neutral selection UI is outside the Theorem product boundary. |
| `frontend/src/components/LLMSelection/GroqAiOptions/index.jsx` | cut | 114 | Provider-neutral selection UI is outside the Theorem product boundary. |
| `frontend/src/components/LLMSelection/KoboldCPPOptions/index.jsx` | cut | 224 | Provider-neutral selection UI is outside the Theorem product boundary. |
| `frontend/src/components/LLMSelection/LLMItem/index.jsx` | cut | 37 | Provider-neutral selection UI is outside the Theorem product boundary. |
| `frontend/src/components/LLMSelection/LLMProviderOption/index.jsx` | cut | 37 | Provider-neutral selection UI is outside the Theorem product boundary. |
| `frontend/src/components/LLMSelection/LMStudioOptions/index.jsx` | cut | 335 | Provider-neutral selection UI is outside the Theorem product boundary. |
| `frontend/src/components/LLMSelection/LemonadeOptions/index.jsx` | cut | 446 | Provider-neutral selection UI is outside the Theorem product boundary. |
| `frontend/src/components/LLMSelection/LiteLLMOptions/index.jsx` | cut | 148 | Provider-neutral selection UI is outside the Theorem product boundary. |
| `frontend/src/components/LLMSelection/LocalAiOptions/index.jsx` | cut | 219 | Provider-neutral selection UI is outside the Theorem product boundary. |
| `frontend/src/components/LLMSelection/MinimaxOptions/index.jsx` | cut | 97 | Provider-neutral selection UI is outside the Theorem product boundary. |
| `frontend/src/components/LLMSelection/MistralOptions/index.jsx` | cut | 105 | Provider-neutral selection UI is outside the Theorem product boundary. |
| `frontend/src/components/LLMSelection/ModelRouterOptions/index.jsx` | cut | 74 | Provider-neutral selection UI is outside the Theorem product boundary. |
| `frontend/src/components/LLMSelection/MoonshotAiOptions/index.jsx` | cut | 117 | Provider-neutral selection UI is outside the Theorem product boundary. |
| `frontend/src/components/LLMSelection/NovitaLLMOptions/index.jsx` | cut | 145 | Provider-neutral selection UI is outside the Theorem product boundary. |
| `frontend/src/components/LLMSelection/NvidiaNimOptions/index.jsx` | cut | 11 | Provider-neutral selection UI is outside the Theorem product boundary. |
| `frontend/src/components/LLMSelection/NvidiaNimOptions/managed.jsx` | cut | 7 | Provider-neutral selection UI is outside the Theorem product boundary. |
| `frontend/src/components/LLMSelection/NvidiaNimOptions/remote.jsx` | cut | 130 | Provider-neutral selection UI is outside the Theorem product boundary. |
| `frontend/src/components/LLMSelection/OMLXOptions/index.jsx` | cut | 310 | Provider-neutral selection UI is outside the Theorem product boundary. |
| `frontend/src/components/LLMSelection/OllamaLLMOptions/index.jsx` | cut | 367 | Provider-neutral selection UI is outside the Theorem product boundary. |
| `frontend/src/components/LLMSelection/OpenAiOptions/index.jsx` | cut | 107 | Provider-neutral selection UI is outside the Theorem product boundary. |
| `frontend/src/components/LLMSelection/OpenRouterOptions/index.jsx` | cut | 142 | Provider-neutral selection UI is outside the Theorem product boundary. |
| `frontend/src/components/LLMSelection/PPIOLLMOptions/index.jsx` | cut | 100 | Provider-neutral selection UI is outside the Theorem product boundary. |
| `frontend/src/components/LLMSelection/PerplexityOptions/index.jsx` | cut | 90 | Provider-neutral selection UI is outside the Theorem product boundary. |
| `frontend/src/components/LLMSelection/PrivateModeOptions/index.jsx` | cut | 129 | Provider-neutral selection UI is outside the Theorem product boundary. |
| `frontend/src/components/LLMSelection/SambaNovaOptions/index.jsx` | cut | 103 | Provider-neutral selection UI is outside the Theorem product boundary. |
| `frontend/src/components/LLMSelection/TextGenWebUIOptions/index.jsx` | cut | 51 | Provider-neutral selection UI is outside the Theorem product boundary. |
| `frontend/src/components/LLMSelection/TogetherAiOptions/index.jsx` | cut | 114 | Provider-neutral selection UI is outside the Theorem product boundary. |
| `frontend/src/components/LLMSelection/XAiLLMOptions/index.jsx` | cut | 114 | Provider-neutral selection UI is outside the Theorem product boundary. |
| `frontend/src/components/LLMSelection/ZAiLLMOptions/index.jsx` | cut | 114 | Provider-neutral selection UI is outside the Theorem product boundary. |
| `frontend/src/components/ModalWrapper/index.jsx` | port | 35 | Port the surviving frontend behavior into the typed console page architecture. |
| `frontend/src/components/Modals/DisplayRecoveryCodeModal/index.jsx` | port | 91 | Port the surviving frontend behavior into the typed console page architecture. |
| `frontend/src/components/Modals/ManageWorkspace/DataConnectors/ConnectorOption/index.jsx` | port | 25 | Port the surviving frontend behavior into the typed console page architecture. |
| `frontend/src/components/Modals/ManageWorkspace/DataConnectors/Connectors/Confluence/index.jsx` | port | 295 | Port the surviving frontend behavior into the typed console page architecture. |
| `frontend/src/components/Modals/ManageWorkspace/DataConnectors/Connectors/DrupalWiki/index.jsx` | port | 190 | Port the surviving frontend behavior into the typed console page architecture. |
| `frontend/src/components/Modals/ManageWorkspace/DataConnectors/Connectors/Github/index.jsx` | port | 319 | Port the surviving frontend behavior into the typed console page architecture. |
| `frontend/src/components/Modals/ManageWorkspace/DataConnectors/Connectors/Gitlab/index.jsx` | port | 346 | Port the surviving frontend behavior into the typed console page architecture. |
| `frontend/src/components/Modals/ManageWorkspace/DataConnectors/Connectors/Obsidian/index.jsx` | port | 175 | Port the surviving frontend behavior into the typed console page architecture. |
| `frontend/src/components/Modals/ManageWorkspace/DataConnectors/Connectors/PaperlessNgx/index.jsx` | port | 124 | Port the surviving frontend behavior into the typed console page architecture. |
| `frontend/src/components/Modals/ManageWorkspace/DataConnectors/Connectors/WebsiteDepth/index.jsx` | port | 135 | Port the surviving frontend behavior into the typed console page architecture. |
| `frontend/src/components/Modals/ManageWorkspace/DataConnectors/Connectors/Youtube/index.jsx` | port | 102 | Port the surviving frontend behavior into the typed console page architecture. |
| `frontend/src/components/Modals/ManageWorkspace/DataConnectors/index.jsx` | port | 120 | Port the surviving frontend behavior into the typed console page architecture. |
| `frontend/src/components/Modals/ManageWorkspace/Documents/Directory/ContextMenu/index.jsx` | port | 79 | Port the surviving frontend behavior into the typed console page architecture. |
| `frontend/src/components/Modals/ManageWorkspace/Documents/Directory/FileRow/index.jsx` | port | 53 | Port the surviving frontend behavior into the typed console page architecture. |
| `frontend/src/components/Modals/ManageWorkspace/Documents/Directory/FolderRow/index.jsx` | port | 87 | Port the surviving frontend behavior into the typed console page architecture. |
| `frontend/src/components/Modals/ManageWorkspace/Documents/Directory/FolderSelectionPopup/index.jsx` | port | 24 | Port the surviving frontend behavior into the typed console page architecture. |
| `frontend/src/components/Modals/ManageWorkspace/Documents/Directory/MoveToFolderIcon.jsx` | port | 44 | Port the surviving frontend behavior into the typed console page architecture. |
| `frontend/src/components/Modals/ManageWorkspace/Documents/Directory/NewFolderModal/index.jsx` | port | 91 | Port the surviving frontend behavior into the typed console page architecture. |
| `frontend/src/components/Modals/ManageWorkspace/Documents/Directory/index.jsx` | port | 389 | Port the surviving frontend behavior into the typed console page architecture. |
| `frontend/src/components/Modals/ManageWorkspace/Documents/Directory/utils.js` | port | 62 | Port the surviving frontend behavior into the typed console page architecture. |
| `frontend/src/components/Modals/ManageWorkspace/Documents/UploadFile/FileUploadProgress/index.jsx` | port | 151 | Port the surviving frontend behavior into the typed console page architecture. |
| `frontend/src/components/Modals/ManageWorkspace/Documents/UploadFile/index.jsx` | port | 161 | Port the surviving frontend behavior into the typed console page architecture. |
| `frontend/src/components/Modals/ManageWorkspace/Documents/WorkspaceDirectory/WorkspaceFileRow/index.jsx` | port | 270 | Port the surviving frontend behavior into the typed console page architecture. |
| `frontend/src/components/Modals/ManageWorkspace/Documents/WorkspaceDirectory/index.jsx` | port | 635 | Port the surviving frontend behavior into the typed console page architecture. |
| `frontend/src/components/Modals/ManageWorkspace/Documents/index.jsx` | port | 260 | Port the surviving frontend behavior into the typed console page architecture. |
| `frontend/src/components/Modals/ManageWorkspace/index.jsx` | port | 177 | Port the surviving frontend behavior into the typed console page architecture. |
| `frontend/src/components/Modals/NewWorkspace.jsx` | port | 98 | Port the surviving frontend behavior into the typed console page architecture. |
| `frontend/src/components/Modals/Password/MultiUserAuth.jsx` | port | 365 | Port the surviving frontend behavior into the typed console page architecture. |
| `frontend/src/components/Modals/Password/SingleUserAuth.jsx` | port | 127 | Port the surviving frontend behavior into the typed console page architecture. |
| `frontend/src/components/Modals/Password/index.jsx` | port | 128 | Port the surviving frontend behavior into the typed console page architecture. |
| `frontend/src/components/Preloader.jsx` | port | 18 | Port the surviving frontend behavior into the typed console page architecture. |
| `frontend/src/components/PrivateRoute/index.jsx` | port | 165 | Port the surviving frontend behavior into the typed console page architecture. |
| `frontend/src/components/ProviderPrivacy/constants.js` | cut | 417 | Provider disclosure UI is removed because Theorem owns the provider boundary. |
| `frontend/src/components/ProviderPrivacy/index.jsx` | cut | 119 | Provider disclosure UI is removed because Theorem owns the provider boundary. |
| `frontend/src/components/SettingsButton/index.jsx` | port | 47 | Port the surviving frontend behavior into the typed console page architecture. |
| `frontend/src/components/SettingsSidebar/MenuOption/index.jsx` | port | 199 | Port the surviving frontend behavior into the typed console page architecture. |
| `frontend/src/components/SettingsSidebar/index.jsx` | port | 522 | Port the surviving frontend behavior into the typed console page architecture. |
| `frontend/src/components/Sidebar/ActiveWorkspaces/ThreadContainer/ThreadItem/index.jsx` | port | 280 | Port the surviving frontend behavior into the typed console page architecture. |
| `frontend/src/components/Sidebar/ActiveWorkspaces/ThreadContainer/hooks.js` | port | 61 | Port the surviving frontend behavior into the typed console page architecture. |
| `frontend/src/components/Sidebar/ActiveWorkspaces/ThreadContainer/index.jsx` | port | 241 | Port the surviving frontend behavior into the typed console page architecture. |
| `frontend/src/components/Sidebar/ActiveWorkspaces/index.jsx` | port | 233 | Port the surviving frontend behavior into the typed console page architecture. |
| `frontend/src/components/Sidebar/SearchBox/index.jsx` | port | 216 | Port the surviving frontend behavior into the typed console page architecture. |
| `frontend/src/components/Sidebar/SidebarToggle/index.jsx` | port | 111 | Port the surviving frontend behavior into the typed console page architecture. |
| `frontend/src/components/Sidebar/index.jsx` | port | 240 | Port the surviving frontend behavior into the typed console page architecture. |
| `frontend/src/components/SpeechToText/BrowserNative/index.jsx` | cut | 9 | Provider-neutral selection UI is outside the Theorem product boundary. |
| `frontend/src/components/SpeechToText/DeepgramOptions/index.jsx` | cut | 89 | Provider-neutral selection UI is outside the Theorem product boundary. |
| `frontend/src/components/SpeechToText/GenericOpenAiOptions/index.jsx` | cut | 66 | Provider-neutral selection UI is outside the Theorem product boundary. |
| `frontend/src/components/SpeechToText/GroqOptions/index.jsx` | cut | 87 | Provider-neutral selection UI is outside the Theorem product boundary. |
| `frontend/src/components/SpeechToText/LemonadeOptions/index.jsx` | cut | 222 | Provider-neutral selection UI is outside the Theorem product boundary. |
| `frontend/src/components/SpeechToText/OpenAiOptions/index.jsx` | cut | 87 | Provider-neutral selection UI is outside the Theorem product boundary. |
| `frontend/src/components/TextToSpeech/BrowserNative/index.jsx` | cut | 9 | Provider-neutral selection UI is outside the Theorem product boundary. |
| `frontend/src/components/TextToSpeech/ElevenLabsOptions/index.jsx` | cut | 109 | Provider-neutral selection UI is outside the Theorem product boundary. |
| `frontend/src/components/TextToSpeech/KokoroOptions/index.jsx` | cut | 168 | Provider-neutral selection UI is outside the Theorem product boundary. |
| `frontend/src/components/TextToSpeech/OpenAiGenericOptions/index.jsx` | cut | 90 | Provider-neutral selection UI is outside the Theorem product boundary. |
| `frontend/src/components/TextToSpeech/OpenAiOptions/index.jsx` | cut | 49 | Provider-neutral selection UI is outside the Theorem product boundary. |
| `frontend/src/components/TextToSpeech/PiperTTSOptions/index.jsx` | cut | 220 | Provider-neutral selection UI is outside the Theorem product boundary. |
| `frontend/src/components/TranscriptionSelection/GenericOpenAiOptions/index.jsx` | cut | 62 | Provider-neutral selection UI is outside the Theorem product boundary. |
| `frontend/src/components/TranscriptionSelection/NativeTranscriptionOptions/index.jsx` | cut | 88 | Provider-neutral selection UI is outside the Theorem product boundary. |
| `frontend/src/components/TranscriptionSelection/OpenAiOptions/index.jsx` | cut | 41 | Provider-neutral selection UI is outside the Theorem product boundary. |
| `frontend/src/components/UserIcon/index.jsx` | port | 42 | Port the surviving frontend behavior into the typed console page architecture. |
| `frontend/src/components/UserIcon/user.svg` | port | 12 | Port the surviving frontend behavior into the typed console page architecture. |
| `frontend/src/components/UserIcon/workspace.svg` | port | 20 | Port the surviving frontend behavior into the typed console page architecture. |
| `frontend/src/components/UserMenu/AccountModal/index.jsx` | port | 378 | Port the surviving frontend behavior into the typed console page architecture. |
| `frontend/src/components/UserMenu/UserButton/index.jsx` | port | 139 | Port the surviving frontend behavior into the typed console page architecture. |
| `frontend/src/components/UserMenu/index.jsx` | port | 10 | Port the surviving frontend behavior into the typed console page architecture. |
| `frontend/src/components/VectorDBSelection/AstraDBOptions/index.jsx` | cut | 41 | Provider-neutral selection UI is outside the Theorem product boundary. |
| `frontend/src/components/VectorDBSelection/ChromaCloudOptions/index.jsx` | cut | 53 | Provider-neutral selection UI is outside the Theorem product boundary. |
| `frontend/src/components/VectorDBSelection/ChromaDBOptions/index.jsx` | cut | 51 | Provider-neutral selection UI is outside the Theorem product boundary. |
| `frontend/src/components/VectorDBSelection/LanceDBOptions/index.jsx` | cut | 11 | Provider-neutral selection UI is outside the Theorem product boundary. |
| `frontend/src/components/VectorDBSelection/MilvusDBOptions/index.jsx` | cut | 52 | Provider-neutral selection UI is outside the Theorem product boundary. |
| `frontend/src/components/VectorDBSelection/PGVectorOptions/index.jsx` | cut | 103 | Provider-neutral selection UI is outside the Theorem product boundary. |
| `frontend/src/components/VectorDBSelection/PineconeDBOptions/index.jsx` | cut | 38 | Provider-neutral selection UI is outside the Theorem product boundary. |
| `frontend/src/components/VectorDBSelection/QDrantDBOptions/index.jsx` | cut | 38 | Provider-neutral selection UI is outside the Theorem product boundary. |
| `frontend/src/components/VectorDBSelection/VectorDBItem/index.jsx` | cut | 37 | Provider-neutral selection UI is outside the Theorem product boundary. |
| `frontend/src/components/VectorDBSelection/WeaviateDBOptions/index.jsx` | cut | 38 | Provider-neutral selection UI is outside the Theorem product boundary. |
| `frontend/src/components/VectorDBSelection/ZillizCloudOptions/index.jsx` | cut | 38 | Provider-neutral selection UI is outside the Theorem product boundary. |
| `frontend/src/components/WorkspaceChat/ChatContainer/ChatHistory/Chartable/CustomCell.jsx` | port | 38 | Port the surviving frontend behavior into the typed console page architecture. |
| `frontend/src/components/WorkspaceChat/ChatContainer/ChatHistory/Chartable/CustomTooltip.jsx` | port | 89 | Port the surviving frontend behavior into the typed console page architecture. |
| `frontend/src/components/WorkspaceChat/ChatContainer/ChatHistory/Chartable/chart-utils.js` | port | 98 | Port the surviving frontend behavior into the typed console page architecture. |
| `frontend/src/components/WorkspaceChat/ChatContainer/ChatHistory/Chartable/index.jsx` | port | 482 | Port the surviving frontend behavior into the typed console page architecture. |
| `frontend/src/components/WorkspaceChat/ChatContainer/ChatHistory/Citation/index.jsx` | port | 421 | Port the surviving frontend behavior into the typed console page architecture. |
| `frontend/src/components/WorkspaceChat/ChatContainer/ChatHistory/ClarifyingQuestion/ChoiceForm.jsx` | port | 169 | Port the surviving frontend behavior into the typed console page architecture. |
| `frontend/src/components/WorkspaceChat/ChatContainer/ChatHistory/ClarifyingQuestion/Footer.jsx` | port | 93 | Port the surviving frontend behavior into the typed console page architecture. |
| `frontend/src/components/WorkspaceChat/ChatContainer/ChatHistory/ClarifyingQuestion/Header.jsx` | port | 97 | Port the surviving frontend behavior into the typed console page architecture. |
| `frontend/src/components/WorkspaceChat/ChatContainer/ChatHistory/ClarifyingQuestion/InputForm.jsx` | port | 66 | Port the surviving frontend behavior into the typed console page architecture. |
| `frontend/src/components/WorkspaceChat/ChatContainer/ChatHistory/ClarifyingQuestion/SurveyBody.jsx` | port | 82 | Port the surviving frontend behavior into the typed console page architecture. |
| `frontend/src/components/WorkspaceChat/ChatContainer/ChatHistory/ClarifyingQuestion/index.jsx` | port | 273 | Port the surviving frontend behavior into the typed console page architecture. |
| `frontend/src/components/WorkspaceChat/ChatContainer/ChatHistory/ClarifyingQuestion/utils.js` | port | 61 | Port the surviving frontend behavior into the typed console page architecture. |
| `frontend/src/components/WorkspaceChat/ChatContainer/ChatHistory/FileDownloadCard/index.jsx` | port | 126 | Port the surviving frontend behavior into the typed console page architecture. |
| `frontend/src/components/WorkspaceChat/ChatContainer/ChatHistory/HistoricalMessage/Actions/ActionMenu/index.jsx` | port | 76 | Port the surviving frontend behavior into the typed console page architecture. |
| `frontend/src/components/WorkspaceChat/ChatContainer/ChatHistory/HistoricalMessage/Actions/DeleteMessage/index.jsx` | port | 49 | Port the surviving frontend behavior into the typed console page architecture. |
| `frontend/src/components/WorkspaceChat/ChatContainer/ChatHistory/HistoricalMessage/Actions/EditMessage/index.jsx` | port | 176 | Port the surviving frontend behavior into the typed console page architecture. |
| `frontend/src/components/WorkspaceChat/ChatContainer/ChatHistory/HistoricalMessage/Actions/RenderMetrics/index.jsx` | port | 125 | Port the surviving frontend behavior into the typed console page architecture. |
| `frontend/src/components/WorkspaceChat/ChatContainer/ChatHistory/HistoricalMessage/Actions/TTSButton/asyncTts.jsx` | port | 92 | Port the surviving frontend behavior into the typed console page architecture. |
| `frontend/src/components/WorkspaceChat/ChatContainer/ChatHistory/HistoricalMessage/Actions/TTSButton/index.jsx` | port | 41 | Port the surviving frontend behavior into the typed console page architecture. |
| `frontend/src/components/WorkspaceChat/ChatContainer/ChatHistory/HistoricalMessage/Actions/TTSButton/native.jsx` | port | 56 | Port the surviving frontend behavior into the typed console page architecture. |
| `frontend/src/components/WorkspaceChat/ChatContainer/ChatHistory/HistoricalMessage/Actions/TTSButton/piperTTS.jsx` | port | 88 | Port the surviving frontend behavior into the typed console page architecture. |
| `frontend/src/components/WorkspaceChat/ChatContainer/ChatHistory/HistoricalMessage/Actions/index.jsx` | port | 144 | Port the surviving frontend behavior into the typed console page architecture. |
| `frontend/src/components/WorkspaceChat/ChatContainer/ChatHistory/HistoricalMessage/HistoricalClarifyingQuestions/index.jsx` | port | 35 | Port the surviving frontend behavior into the typed console page architecture. |
| `frontend/src/components/WorkspaceChat/ChatContainer/ChatHistory/HistoricalMessage/HistoricalOutputs/index.jsx` | port | 21 | Port the surviving frontend behavior into the typed console page architecture. |
| `frontend/src/components/WorkspaceChat/ChatContainer/ChatHistory/HistoricalMessage/index.jsx` | port | 356 | Port the surviving frontend behavior into the typed console page architecture. |
| `frontend/src/components/WorkspaceChat/ChatContainer/ChatHistory/MessageActionsContext.jsx` | port | 87 | Port the surviving frontend behavior into the typed console page architecture. |
| `frontend/src/components/WorkspaceChat/ChatContainer/ChatHistory/ModelRouteNotification/index.jsx` | port | 66 | Port the surviving frontend behavior into the typed console page architecture. |
| `frontend/src/components/WorkspaceChat/ChatContainer/ChatHistory/PromptReply/index.jsx` | port | 108 | Port the surviving frontend behavior into the typed console page architecture. |
| `frontend/src/components/WorkspaceChat/ChatContainer/ChatHistory/ScheduledJobCreatedCard/index.jsx` | port | 52 | Port the surviving frontend behavior into the typed console page architecture. |
| `frontend/src/components/WorkspaceChat/ChatContainer/ChatHistory/StatusResponse/index.jsx` | port | 99 | Port the surviving frontend behavior into the typed console page architecture. |
| `frontend/src/components/WorkspaceChat/ChatContainer/ChatHistory/ThoughtContainer/index.jsx` | port | 219 | Port the surviving frontend behavior into the typed console page architecture. |
| `frontend/src/components/WorkspaceChat/ChatContainer/ChatHistory/ToolApprovalRequest/index.jsx` | port | 226 | Port the surviving frontend behavior into the typed console page architecture. |
| `frontend/src/components/WorkspaceChat/ChatContainer/ChatHistory/index.jsx` | port | 325 | Port the surviving frontend behavior into the typed console page architecture. |
| `frontend/src/components/WorkspaceChat/ChatContainer/ChatSettingsMenu/CopyLinkToChat/index.jsx` | port | 92 | Port the surviving frontend behavior into the typed console page architecture. |
| `frontend/src/components/WorkspaceChat/ChatContainer/ChatSettingsMenu/Export/index.jsx` | port | 95 | Port the surviving frontend behavior into the typed console page architecture. |
| `frontend/src/components/WorkspaceChat/ChatContainer/ChatSettingsMenu/Memories/index.jsx` | port | 41 | Port the surviving frontend behavior into the typed console page architecture. |
| `frontend/src/components/WorkspaceChat/ChatContainer/ChatSettingsMenu/TextSize/index.jsx` | port | 81 | Port the surviving frontend behavior into the typed console page architecture. |
| `frontend/src/components/WorkspaceChat/ChatContainer/ChatSettingsMenu/index.jsx` | port | 79 | Port the surviving frontend behavior into the typed console page architecture. |
| `frontend/src/components/WorkspaceChat/ChatContainer/ChatSidebar/index.jsx` | port | 93 | Port the surviving frontend behavior into the typed console page architecture. |
| `frontend/src/components/WorkspaceChat/ChatContainer/ChatTooltips/index.jsx` | port | 130 | Port the surviving frontend behavior into the typed console page architecture. |
| `frontend/src/components/WorkspaceChat/ChatContainer/DnDWrapper/FileUploadWarningModal/index.jsx` | port | 106 | Port the surviving frontend behavior into the typed console page architecture. |
| `frontend/src/components/WorkspaceChat/ChatContainer/DnDWrapper/dnd-icon.png` | port | 17 | Port the surviving frontend behavior into the typed console page architecture. |
| `frontend/src/components/WorkspaceChat/ChatContainer/DnDWrapper/index.jsx` | port | 479 | Port the surviving frontend behavior into the typed console page architecture. |
| `frontend/src/components/WorkspaceChat/ChatContainer/MemoriesSidebar/MemoriesContext.jsx` | port | 132 | Port the surviving frontend behavior into the typed console page architecture. |
| `frontend/src/components/WorkspaceChat/ChatContainer/MemoriesSidebar/MemoryCard/CardMenu/index.jsx` | port | 71 | Port the surviving frontend behavior into the typed console page architecture. |
| `frontend/src/components/WorkspaceChat/ChatContainer/MemoriesSidebar/MemoryCard/index.jsx` | port | 86 | Port the surviving frontend behavior into the typed console page architecture. |
| `frontend/src/components/WorkspaceChat/ChatContainer/MemoriesSidebar/MemoryModal/index.jsx` | port | 107 | Port the surviving frontend behavior into the typed console page architecture. |
| `frontend/src/components/WorkspaceChat/ChatContainer/MemoriesSidebar/MemoryTabs/index.jsx` | port | 73 | Port the surviving frontend behavior into the typed console page architecture. |
| `frontend/src/components/WorkspaceChat/ChatContainer/MemoriesSidebar/PersonalizationToggle/index.jsx` | port | 73 | Port the surviving frontend behavior into the typed console page architecture. |
| `frontend/src/components/WorkspaceChat/ChatContainer/MemoriesSidebar/index.jsx` | port | 137 | Port the surviving frontend behavior into the typed console page architecture. |
| `frontend/src/components/WorkspaceChat/ChatContainer/PromptInput/AgentMenu/index.jsx` | port | 116 | Port the surviving frontend behavior into the typed console page architecture. |
| `frontend/src/components/WorkspaceChat/ChatContainer/PromptInput/AttachItem/ParsedFilesMenu/index.jsx` | port | 197 | Port the surviving frontend behavior into the typed console page architecture. |
| `frontend/src/components/WorkspaceChat/ChatContainer/PromptInput/AttachItem/index.jsx` | port | 148 | Port the surviving frontend behavior into the typed console page architecture. |
| `frontend/src/components/WorkspaceChat/ChatContainer/PromptInput/Attachments/index.jsx` | port | 247 | Port the surviving frontend behavior into the typed console page architecture. |
| `frontend/src/components/WorkspaceChat/ChatContainer/PromptInput/LLMSelector/ChatModelSelection/index.jsx` | cut | 103 | Provider and model selection moves to the Harness execution boundary. |
| `frontend/src/components/WorkspaceChat/ChatContainer/PromptInput/LLMSelector/LLMSelector/index.jsx` | cut | 54 | Provider and model selection moves to the Harness execution boundary. |
| `frontend/src/components/WorkspaceChat/ChatContainer/PromptInput/LLMSelector/RouterPickerSelection/index.jsx` | cut | 64 | Provider and model selection moves to the Harness execution boundary. |
| `frontend/src/components/WorkspaceChat/ChatContainer/PromptInput/LLMSelector/SetupProvider/index.jsx` | cut | 115 | Provider and model selection moves to the Harness execution boundary. |
| `frontend/src/components/WorkspaceChat/ChatContainer/PromptInput/LLMSelector/action.jsx` | cut | 135 | Provider and model selection moves to the Harness execution boundary. |
| `frontend/src/components/WorkspaceChat/ChatContainer/PromptInput/LLMSelector/index.jsx` | cut | 201 | Provider and model selection moves to the Harness execution boundary. |
| `frontend/src/components/WorkspaceChat/ChatContainer/PromptInput/LLMSelector/utils.js` | cut | 60 | Provider and model selection moves to the Harness execution boundary. |
| `frontend/src/components/WorkspaceChat/ChatContainer/PromptInput/SpeechToText/BrowserNative/index.jsx` | port | 91 | Port the surviving frontend behavior into the typed console page architecture. |
| `frontend/src/components/WorkspaceChat/ChatContainer/PromptInput/SpeechToText/MicButton/index.jsx` | port | 85 | Port the surviving frontend behavior into the typed console page architecture. |
| `frontend/src/components/WorkspaceChat/ChatContainer/PromptInput/SpeechToText/ServerSTT/index.jsx` | port | 132 | Port the surviving frontend behavior into the typed console page architecture. |
| `frontend/src/components/WorkspaceChat/ChatContainer/PromptInput/SpeechToText/index.jsx` | port | 36 | Port the surviving frontend behavior into the typed console page architecture. |
| `frontend/src/components/WorkspaceChat/ChatContainer/PromptInput/SpeechToText/useSilenceDetector.js` | port | 69 | Port the surviving frontend behavior into the typed console page architecture. |
| `frontend/src/components/WorkspaceChat/ChatContainer/PromptInput/StopGenerationButton/index.jsx` | port | 31 | Port the surviving frontend behavior into the typed console page architecture. |
| `frontend/src/components/WorkspaceChat/ChatContainer/PromptInput/StopGenerationButton/stop.svg` | port | 4 | Port the surviving frontend behavior into the typed console page architecture. |
| `frontend/src/components/WorkspaceChat/ChatContainer/PromptInput/TextSizeMenu/index.jsx` | port | 119 | Port the surviving frontend behavior into the typed console page architecture. |
| `frontend/src/components/WorkspaceChat/ChatContainer/PromptInput/ToolsMenu/Tabs/AgentSkills/SkillRow/index.jsx` | port | 36 | Port the surviving frontend behavior into the typed console page architecture. |
| `frontend/src/components/WorkspaceChat/ChatContainer/PromptInput/ToolsMenu/Tabs/AgentSkills/SkillSection/index.jsx` | port | 57 | Port the surviving frontend behavior into the typed console page architecture. |
| `frontend/src/components/WorkspaceChat/ChatContainer/PromptInput/ToolsMenu/Tabs/AgentSkills/index.jsx` | port | 297 | Port the surviving frontend behavior into the typed console page architecture. |
| `frontend/src/components/WorkspaceChat/ChatContainer/PromptInput/ToolsMenu/Tabs/AgentSkills/skillRegistry.js` | port | 92 | Port the surviving frontend behavior into the typed console page architecture. |
| `frontend/src/components/WorkspaceChat/ChatContainer/PromptInput/ToolsMenu/Tabs/AgentSkills/useAgentSkillsState.js` | port | 198 | Port the surviving frontend behavior into the typed console page architecture. |
| `frontend/src/components/WorkspaceChat/ChatContainer/PromptInput/ToolsMenu/Tabs/AgentSkills/useSkillSections.js` | port | 195 | Port the surviving frontend behavior into the typed console page architecture. |
| `frontend/src/components/WorkspaceChat/ChatContainer/PromptInput/ToolsMenu/Tabs/AgentSkills/useSubSkillPreferences.js` | port | 80 | Port the surviving frontend behavior into the typed console page architecture. |
| `frontend/src/components/WorkspaceChat/ChatContainer/PromptInput/ToolsMenu/Tabs/SlashCommands/SlashCommandRow/index.jsx` | port | 119 | Port the surviving frontend behavior into the typed console page architecture. |
| `frontend/src/components/WorkspaceChat/ChatContainer/PromptInput/ToolsMenu/Tabs/SlashCommands/SlashPresets/AddPresetModal.jsx` | port | 131 | Port the surviving frontend behavior into the typed console page architecture. |
| `frontend/src/components/WorkspaceChat/ChatContainer/PromptInput/ToolsMenu/Tabs/SlashCommands/SlashPresets/EditPresetModal.jsx` | port | 155 | Port the surviving frontend behavior into the typed console page architecture. |
| `frontend/src/components/WorkspaceChat/ChatContainer/PromptInput/ToolsMenu/Tabs/SlashCommands/SlashPresets/constants.js` | port | 1 | Port the surviving frontend behavior into the typed console page architecture. |
| `frontend/src/components/WorkspaceChat/ChatContainer/PromptInput/ToolsMenu/Tabs/SlashCommands/index.jsx` | port | 223 | Port the surviving frontend behavior into the typed console page architecture. |
| `frontend/src/components/WorkspaceChat/ChatContainer/PromptInput/ToolsMenu/index.jsx` | port | 201 | Port the surviving frontend behavior into the typed console page architecture. |
| `frontend/src/components/WorkspaceChat/ChatContainer/PromptInput/ToolsMenu/useToolsMenuItems.js` | port | 32 | Port the surviving frontend behavior into the typed console page architecture. |
| `frontend/src/components/WorkspaceChat/ChatContainer/PromptInput/index.jsx` | port | 554 | Port the surviving frontend behavior into the typed console page architecture. |
| `frontend/src/components/WorkspaceChat/ChatContainer/SourcesSidebar/MobileCitationModal/SourceDetailView/index.jsx` | port | 56 | Port the surviving frontend behavior into the typed console page architecture. |
| `frontend/src/components/WorkspaceChat/ChatContainer/SourcesSidebar/MobileCitationModal/index.jsx` | port | 56 | Port the surviving frontend behavior into the typed console page architecture. |
| `frontend/src/components/WorkspaceChat/ChatContainer/SourcesSidebar/SourceItem/index.jsx` | port | 38 | Port the surviving frontend behavior into the typed console page architecture. |
| `frontend/src/components/WorkspaceChat/ChatContainer/SourcesSidebar/index.jsx` | port | 76 | Port the surviving frontend behavior into the typed console page architecture. |
| `frontend/src/components/WorkspaceChat/ChatContainer/TextSizeMenu/index.jsx` | port | 103 | Port the surviving frontend behavior into the typed console page architecture. |
| `frontend/src/components/WorkspaceChat/ChatContainer/WorkspaceModelPicker/index.jsx` | port | 155 | Port the surviving frontend behavior into the typed console page architecture. |
| `frontend/src/components/WorkspaceChat/ChatContainer/index.jsx` | port | 550 | Port the surviving frontend behavior into the typed console page architecture. |
| `frontend/src/components/WorkspaceChat/LoadingChat/index.jsx` | port | 60 | Port the surviving frontend behavior into the typed console page architecture. |
| `frontend/src/components/WorkspaceChat/index.jsx` | port | 199 | Port the surviving frontend behavior into the typed console page architecture. |
| `frontend/src/components/contexts/TTSProvider.jsx` | port | 136 | Port the surviving frontend behavior into the typed console page architecture. |
| `frontend/src/components/lib/CTAButton/index.jsx` | port | 16 | Port the surviving frontend behavior into the typed console page architecture. |
| `frontend/src/components/lib/ModelTable/index.jsx` | port | 359 | Port the surviving frontend behavior into the typed console page architecture. |
| `frontend/src/components/lib/ModelTable/layout.jsx` | port | 80 | Port the surviving frontend behavior into the typed console page architecture. |
| `frontend/src/components/lib/ModelTable/loading.jsx` | port | 18 | Port the surviving frontend behavior into the typed console page architecture. |
| `frontend/src/components/lib/MonoProviderIcon/index.jsx` | port | 107 | Port the surviving frontend behavior into the typed console page architecture. |
| `frontend/src/components/lib/QuickActions/index.jsx` | port | 57 | Port the surviving frontend behavior into the typed console page architecture. |
| `frontend/src/components/lib/SuggestedMessages/index.jsx` | port | 32 | Port the surviving frontend behavior into the typed console page architecture. |
| `frontend/src/components/lib/Toggle/index.jsx` | port | 230 | Port the surviving frontend behavior into the typed console page architecture. |
| `frontend/src/hooks/useAppVersion.js` | port | 20 | Port the surviving frontend behavior into the typed console page architecture. |
| `frontend/src/hooks/useAutoScroll.js` | port | 159 | Port the surviving frontend behavior into the typed console page architecture. |
| `frontend/src/hooks/useChatContainerQuickScroll.js` | port | 50 | Port the surviving frontend behavior into the typed console page architecture. |
| `frontend/src/hooks/useCommunityHubAuth.js` | port | 30 | Port the surviving frontend behavior into the typed console page architecture. |
| `frontend/src/hooks/useCopyText.js` | port | 18 | Port the surviving frontend behavior into the typed console page architecture. |
| `frontend/src/hooks/useGetProvidersModels.js` | port | 93 | Port the surviving frontend behavior into the typed console page architecture. |
| `frontend/src/hooks/useLanguageOptions.js` | port | 20 | Port the surviving frontend behavior into the typed console page architecture. |
| `frontend/src/hooks/useLoginMode.js` | port | 18 | Port the surviving frontend behavior into the typed console page architecture. |
| `frontend/src/hooks/useLogo.js` | port | 7 | Port the surviving frontend behavior into the typed console page architecture. |
| `frontend/src/hooks/useModal.js` | port | 10 | Port the surviving frontend behavior into the typed console page architecture. |
| `frontend/src/hooks/useOnboardingComplete.js` | port | 16 | Port the surviving frontend behavior into the typed console page architecture. |
| `frontend/src/hooks/usePfp.js` | port | 7 | Port the surviving frontend behavior into the typed console page architecture. |
| `frontend/src/hooks/usePolling.js` | port | 52 | Port the surviving frontend behavior into the typed console page architecture. |
| `frontend/src/hooks/usePrefersDarkMode.js` | port | 9 | Port the surviving frontend behavior into the typed console page architecture. |
| `frontend/src/hooks/usePromptInputStorage.js` | port | 77 | Port the surviving frontend behavior into the typed console page architecture. |
| `frontend/src/hooks/useProviderEndpointAutoDiscovery.js` | port | 113 | Port the surviving frontend behavior into the typed console page architecture. |
| `frontend/src/hooks/useQuery.js` | port | 3 | Port the surviving frontend behavior into the typed console page architecture. |
| `frontend/src/hooks/useScrollActiveItemIntoView.js` | port | 30 | Port the surviving frontend behavior into the typed console page architecture. |
| `frontend/src/hooks/useSimpleSSO.js` | port | 35 | Port the surviving frontend behavior into the typed console page architecture. |
| `frontend/src/hooks/useTextSize.js` | port | 38 | Port the surviving frontend behavior into the typed console page architecture. |
| `frontend/src/hooks/useTheme.js` | port | 86 | Port the surviving frontend behavior into the typed console page architecture. |
| `frontend/src/hooks/useTimeoutProgress.js` | port | 47 | Port the surviving frontend behavior into the typed console page architecture. |
| `frontend/src/hooks/useUser.js` | port | 18 | Port the surviving frontend behavior into the typed console page architecture. |
| `frontend/src/hooks/useWebPushNotifications.js` | port | 131 | Port the surviving frontend behavior into the typed console page architecture. |
| `frontend/src/i18n.js` | port | 21 | Port the surviving frontend behavior into the typed console page architecture. |
| `frontend/src/index.css` | port | 1,184 | Port the surviving frontend behavior into the typed console page architecture. |
| `frontend/src/locales/ar/common.js` | port | 1,899 | Port the surviving frontend behavior into the typed console page architecture. |
| `frontend/src/locales/ca/common.js` | port | 1,954 | Port the surviving frontend behavior into the typed console page architecture. |
| `frontend/src/locales/cs/common.js` | port | 1,925 | Port the surviving frontend behavior into the typed console page architecture. |
| `frontend/src/locales/da/common.js` | port | 1,926 | Port the surviving frontend behavior into the typed console page architecture. |
| `frontend/src/locales/de/common.js` | port | 1,965 | Port the surviving frontend behavior into the typed console page architecture. |
| `frontend/src/locales/en/common.js` | port | 1,900 | Port the surviving frontend behavior into the typed console page architecture. |
| `frontend/src/locales/es/common.js` | port | 1,972 | Port the surviving frontend behavior into the typed console page architecture. |
| `frontend/src/locales/et/common.js` | port | 1,883 | Port the surviving frontend behavior into the typed console page architecture. |
| `frontend/src/locales/fa/common.js` | port | 1,915 | Port the surviving frontend behavior into the typed console page architecture. |
| `frontend/src/locales/findUnusedTranslations.mjs` | port | 216 | Port the surviving frontend behavior into the typed console page architecture. |
| `frontend/src/locales/fr/common.js` | port | 1,951 | Port the surviving frontend behavior into the typed console page architecture. |
| `frontend/src/locales/he/common.js` | port | 1,862 | Port the surviving frontend behavior into the typed console page architecture. |
| `frontend/src/locales/id/common.js` | port | 1,923 | Port the surviving frontend behavior into the typed console page architecture. |
| `frontend/src/locales/it/common.js` | port | 1,975 | Port the surviving frontend behavior into the typed console page architecture. |
| `frontend/src/locales/ja/common.js` | port | 1,914 | Port the surviving frontend behavior into the typed console page architecture. |
| `frontend/src/locales/ko/common.js` | port | 1,880 | Port the surviving frontend behavior into the typed console page architecture. |
| `frontend/src/locales/lo/common.js` | port | 1,827 | Port the surviving frontend behavior into the typed console page architecture. |
| `frontend/src/locales/lt/common.js` | port | 1,931 | Port the surviving frontend behavior into the typed console page architecture. |
| `frontend/src/locales/lv/common.js` | port | 1,938 | Port the surviving frontend behavior into the typed console page architecture. |
| `frontend/src/locales/nl/common.js` | port | 1,947 | Port the surviving frontend behavior into the typed console page architecture. |
| `frontend/src/locales/normalizeEn.mjs` | port | 163 | Port the surviving frontend behavior into the typed console page architecture. |
| `frontend/src/locales/pl/common.js` | port | 1,946 | Port the surviving frontend behavior into the typed console page architecture. |
| `frontend/src/locales/pt_BR/common.js` | port | 1,920 | Port the surviving frontend behavior into the typed console page architecture. |
| `frontend/src/locales/resources.js` | port | 128 | Port the surviving frontend behavior into the typed console page architecture. |
| `frontend/src/locales/ro/common.js` | port | 1,951 | Port the surviving frontend behavior into the typed console page architecture. |
| `frontend/src/locales/ru/common.js` | port | 1,956 | Port the surviving frontend behavior into the typed console page architecture. |
| `frontend/src/locales/tr/common.js` | port | 1,937 | Port the surviving frontend behavior into the typed console page architecture. |
| `frontend/src/locales/verifyTranslations.mjs` | port | 101 | Port the surviving frontend behavior into the typed console page architecture. |
| `frontend/src/locales/vn/common.js` | port | 1,925 | Port the surviving frontend behavior into the typed console page architecture. |
| `frontend/src/locales/zh/common.js` | port | 1,812 | Port the surviving frontend behavior into the typed console page architecture. |
| `frontend/src/locales/zh_TW/common.js` | port | 1,807 | Port the surviving frontend behavior into the typed console page architecture. |
| `frontend/src/main.jsx` | port | 440 | Port the surviving frontend behavior into the typed console page architecture. |
| `frontend/src/media/agents/file-system.png` | port | 612 | Port the surviving frontend behavior into the typed console page architecture. |
| `frontend/src/media/agents/generate-charts.png` | port | 599 | Port the surviving frontend behavior into the typed console page architecture. |
| `frontend/src/media/agents/generate-save-files.png` | port | 608 | Port the surviving frontend behavior into the typed console page architecture. |
| `frontend/src/media/agents/mcp-logo.svg` | port | 0 | Port the surviving frontend behavior into the typed console page architecture. |
| `frontend/src/media/agents/rag-memory.png` | port | 572 | Port the surviving frontend behavior into the typed console page architecture. |
| `frontend/src/media/agents/scheduled-jobs.png` | port | 807 | Port the surviving frontend behavior into the typed console page architecture. |
| `frontend/src/media/agents/scrape-websites.png` | port | 545 | Port the surviving frontend behavior into the typed console page architecture. |
| `frontend/src/media/agents/sql-agent.png` | port | 538 | Port the surviving frontend behavior into the typed console page architecture. |
| `frontend/src/media/agents/view-summarize.png` | port | 593 | Port the surviving frontend behavior into the typed console page architecture. |
| `frontend/src/media/animations/agent-animation.webm` | port | 759 | Port the surviving frontend behavior into the typed console page architecture. |
| `frontend/src/media/animations/agent-static.png` | port | 181 | Port the surviving frontend behavior into the typed console page architecture. |
| `frontend/src/media/animations/router-animation.webm` | port | 146 | Port the surviving frontend behavior into the typed console page architecture. |
| `frontend/src/media/animations/thinking-animation.webm` | port | 848 | Port the surviving frontend behavior into the typed console page architecture. |
| `frontend/src/media/animations/thinking-static.png` | port | 238 | Port the surviving frontend behavior into the typed console page architecture. |
| `frontend/src/media/announcements/placeholder-1.png` | port | 93 | Port the surviving frontend behavior into the typed console page architecture. |
| `frontend/src/media/announcements/placeholder-2.png` | port | 111 | Port the surviving frontend behavior into the typed console page architecture. |
| `frontend/src/media/announcements/placeholder-3.png` | port | 86 | Port the surviving frontend behavior into the typed console page architecture. |
| `frontend/src/media/dataConnectors/confluence.png` | port | 72 | Port the surviving frontend behavior into the typed console page architecture. |
| `frontend/src/media/dataConnectors/drupalwiki.png` | port | 93 | Port the surviving frontend behavior into the typed console page architecture. |
| `frontend/src/media/dataConnectors/obsidian.png` | port | 148 | Port the surviving frontend behavior into the typed console page architecture. |
| `frontend/src/media/dataConnectors/paperlessngx.png` | port | 97 | Port the surviving frontend behavior into the typed console page architecture. |
| `frontend/src/media/embeddingprovider/voyageai.png` | port | 83 | Port the surviving frontend behavior into the typed console page architecture. |
| `frontend/src/media/illustrations/community-hub.png` | port | 40 | Port the surviving frontend behavior into the typed console page architecture. |
| `frontend/src/media/illustrations/login-logo-light.svg` | port | 45 | Port the surviving frontend behavior into the typed console page architecture. |
| `frontend/src/media/illustrations/login-logo.svg` | port | 45 | Port the surviving frontend behavior into the typed console page architecture. |
| `frontend/src/media/llmprovider/anthropic.png` | port | 81 | Port the surviving frontend behavior into the typed console page architecture. |
| `frontend/src/media/llmprovider/apipie.png` | port | 114 | Port the surviving frontend behavior into the typed console page architecture. |
| `frontend/src/media/llmprovider/azure.png` | port | 142 | Port the surviving frontend behavior into the typed console page architecture. |
| `frontend/src/media/llmprovider/bedrock.png` | port | 241 | Port the surviving frontend behavior into the typed console page architecture. |
| `frontend/src/media/llmprovider/cerebras.png` | port | 140 | Port the surviving frontend behavior into the typed console page architecture. |
| `frontend/src/media/llmprovider/cohere.png` | port | 545 | Port the surviving frontend behavior into the typed console page architecture. |
| `frontend/src/media/llmprovider/cometapi.png` | port | 136 | Port the surviving frontend behavior into the typed console page architecture. |
| `frontend/src/media/llmprovider/deepseek.png` | port | 123 | Port the surviving frontend behavior into the typed console page architecture. |
| `frontend/src/media/llmprovider/docker-model-runner.png` | port | 66 | Port the surviving frontend behavior into the typed console page architecture. |
| `frontend/src/media/llmprovider/fireworksai.jpeg` | port | 10 | Port the surviving frontend behavior into the typed console page architecture. |
| `frontend/src/media/llmprovider/foundry-local.png` | port | 83 | Port the surviving frontend behavior into the typed console page architecture. |
| `frontend/src/media/llmprovider/gemini.png` | port | 138 | Port the surviving frontend behavior into the typed console page architecture. |
| `frontend/src/media/llmprovider/generic-openai.png` | port | 140 | Port the surviving frontend behavior into the typed console page architecture. |
| `frontend/src/media/llmprovider/giteeai.png` | port | 23 | Port the surviving frontend behavior into the typed console page architecture. |
| `frontend/src/media/llmprovider/groq.png` | port | 7 | Port the surviving frontend behavior into the typed console page architecture. |
| `frontend/src/media/llmprovider/koboldcpp.png` | port | 60 | Port the surviving frontend behavior into the typed console page architecture. |
| `frontend/src/media/llmprovider/lemonade.png` | port | 225 | Port the surviving frontend behavior into the typed console page architecture. |
| `frontend/src/media/llmprovider/litellm.png` | port | 197 | Port the surviving frontend behavior into the typed console page architecture. |
| `frontend/src/media/llmprovider/lmstudio.png` | port | 347 | Port the surviving frontend behavior into the typed console page architecture. |
| `frontend/src/media/llmprovider/localai.png` | port | 645 | Port the surviving frontend behavior into the typed console page architecture. |
| `frontend/src/media/llmprovider/minimax.png` | port | 170 | Port the surviving frontend behavior into the typed console page architecture. |
| `frontend/src/media/llmprovider/mistral.jpeg` | port | 15 | Port the surviving frontend behavior into the typed console page architecture. |
| `frontend/src/media/llmprovider/moonshotai.png` | port | 272 | Port the surviving frontend behavior into the typed console page architecture. |
| `frontend/src/media/llmprovider/novita.png` | port | 8 | Port the surviving frontend behavior into the typed console page architecture. |
| `frontend/src/media/llmprovider/nvidia-nim.png` | port | 188 | Port the surviving frontend behavior into the typed console page architecture. |
| `frontend/src/media/llmprovider/ollama.png` | port | 133 | Port the surviving frontend behavior into the typed console page architecture. |
| `frontend/src/media/llmprovider/omlx.png` | port | 48 | Port the surviving frontend behavior into the typed console page architecture. |
| `frontend/src/media/llmprovider/openai.png` | port | 282 | Port the surviving frontend behavior into the typed console page architecture. |
| `frontend/src/media/llmprovider/openrouter.jpeg` | port | 31 | Port the surviving frontend behavior into the typed console page architecture. |
| `frontend/src/media/llmprovider/perplexity.png` | port | 106 | Port the surviving frontend behavior into the typed console page architecture. |
| `frontend/src/media/llmprovider/ppio.png` | port | 21 | Port the surviving frontend behavior into the typed console page architecture. |
| `frontend/src/media/llmprovider/privatemode.png` | port | 72 | Port the surviving frontend behavior into the typed console page architecture. |
| `frontend/src/media/llmprovider/sambanova.png` | port | 189 | Port the surviving frontend behavior into the typed console page architecture. |
| `frontend/src/media/llmprovider/text-generation-webui.png` | port | 991 | Port the surviving frontend behavior into the typed console page architecture. |
| `frontend/src/media/llmprovider/togetherai.png` | port | 19 | Port the surviving frontend behavior into the typed console page architecture. |
| `frontend/src/media/llmprovider/xai.png` | port | 72 | Port the surviving frontend behavior into the typed console page architecture. |
| `frontend/src/media/llmprovider/zai.png` | port | 58 | Port the surviving frontend behavior into the typed console page architecture. |
| `frontend/src/media/logo/anything-llm-dark.png` | port | 25 | Port the surviving frontend behavior into the typed console page architecture. |
| `frontend/src/media/logo/anything-llm-icon.png` | port | 608 | Port the surviving frontend behavior into the typed console page architecture. |
| `frontend/src/media/logo/anything-llm-infinity.png` | port | 5 | Port the surviving frontend behavior into the typed console page architecture. |
| `frontend/src/media/logo/anything-llm.png` | port | 18 | Port the surviving frontend behavior into the typed console page architecture. |
| `frontend/src/media/ttsproviders/deepgram.png` | port | 179 | Port the surviving frontend behavior into the typed console page architecture. |
| `frontend/src/media/ttsproviders/elevenlabs.png` | port | 18 | Port the surviving frontend behavior into the typed console page architecture. |
| `frontend/src/media/ttsproviders/generic-openai.png` | port | 140 | Port the surviving frontend behavior into the typed console page architecture. |
| `frontend/src/media/ttsproviders/kokoro.png` | port | 82 | Port the surviving frontend behavior into the typed console page architecture. |
| `frontend/src/media/ttsproviders/piper.png` | port | 65 | Port the surviving frontend behavior into the typed console page architecture. |
| `frontend/src/media/vectordbs/astraDB.png` | port | 4 | Port the surviving frontend behavior into the typed console page architecture. |
| `frontend/src/media/vectordbs/chroma.png` | port | 3 | Port the surviving frontend behavior into the typed console page architecture. |
| `frontend/src/media/vectordbs/lancedb.png` | port | 86 | Port the surviving frontend behavior into the typed console page architecture. |
| `frontend/src/media/vectordbs/milvus.png` | port | 13 | Port the surviving frontend behavior into the typed console page architecture. |
| `frontend/src/media/vectordbs/pgvector.png` | port | 194 | Port the surviving frontend behavior into the typed console page architecture. |
| `frontend/src/media/vectordbs/pinecone.png` | port | 9 | Port the surviving frontend behavior into the typed console page architecture. |
| `frontend/src/media/vectordbs/qdrant.png` | port | 95 | Port the surviving frontend behavior into the typed console page architecture. |
| `frontend/src/media/vectordbs/weaviate.png` | port | 147 | Port the surviving frontend behavior into the typed console page architecture. |
| `frontend/src/media/vectordbs/zilliz.png` | port | 86 | Port the surviving frontend behavior into the typed console page architecture. |
| `frontend/src/models/admin.js` | port | 238 | Port the surviving frontend behavior into the typed console page architecture. |
| `frontend/src/models/agentFlows.js` | port | 149 | Port the surviving frontend behavior into the typed console page architecture. |
| `frontend/src/models/agentSkillWhitelist.js` | port | 21 | Port the surviving frontend behavior into the typed console page architecture. |
| `frontend/src/models/appearance.js` | port | 70 | Port the surviving frontend behavior into the typed console page architecture. |
| `frontend/src/models/browserExtensionApiKey.js` | port | 42 | Port the surviving frontend behavior into the typed console page architecture. |
| `frontend/src/models/communityHub.js` | port | 233 | Port the surviving frontend behavior into the typed console page architecture. |
| `frontend/src/models/dataConnector.js` | port | 233 | Port the surviving frontend behavior into the typed console page architecture. |
| `frontend/src/models/document.js` | port | 38 | Port the surviving frontend behavior into the typed console page architecture. |
| `frontend/src/models/embed.js` | port | 80 | Port the surviving frontend behavior into the typed console page architecture. |
| `frontend/src/models/experimental/agentPlugins.js` | port | 57 | Port the surviving frontend behavior into the typed console page architecture. |
| `frontend/src/models/experimental/liveSync.js` | port | 59 | Port the surviving frontend behavior into the typed console page architecture. |
| `frontend/src/models/files.js` | port | 26 | Port the surviving frontend behavior into the typed console page architecture. |
| `frontend/src/models/googleAgentSkills.js` | port | 45 | Port the surviving frontend behavior into the typed console page architecture. |
| `frontend/src/models/invite.js` | port | 27 | Port the surviving frontend behavior into the typed console page architecture. |
| `frontend/src/models/mcpServers.js` | port | 97 | Port the surviving frontend behavior into the typed console page architecture. |
| `frontend/src/models/memory.js` | port | 108 | Port the surviving frontend behavior into the typed console page architecture. |
| `frontend/src/models/mobile.js` | port | 70 | Port the surviving frontend behavior into the typed console page architecture. |
| `frontend/src/models/modelRouter.js` | port | 126 | Port the surviving frontend behavior into the typed console page architecture. |
| `frontend/src/models/outlookAgent.js` | port | 65 | Port the surviving frontend behavior into the typed console page architecture. |
| `frontend/src/models/promptHistory.js` | port | 84 | Port the surviving frontend behavior into the typed console page architecture. |
| `frontend/src/models/scheduledJobs.js` | port | 127 | Port the surviving frontend behavior into the typed console page architecture. |
| `frontend/src/models/system.js` | port | 900 | Port the surviving frontend behavior into the typed console page architecture. |
| `frontend/src/models/systemPromptVariable.js` | port | 106 | Port the surviving frontend behavior into the typed console page architecture. |
| `frontend/src/models/telegram.js` | port | 176 | Port the surviving frontend behavior into the typed console page architecture. |
| `frontend/src/models/utils/dmrUtils.js` | port | 77 | Port the surviving frontend behavior into the typed console page architecture. |
| `frontend/src/models/utils/lemonadeUtils.js` | port | 115 | Port the surviving frontend behavior into the typed console page architecture. |
| `frontend/src/models/workspace.js` | port | 623 | Port the surviving frontend behavior into the typed console page architecture. |
| `frontend/src/models/workspaceThread.js` | port | 213 | Port the surviving frontend behavior into the typed console page architecture. |
| `frontend/src/pages/404.jsx` | port | 25 | Port the surviving frontend behavior into the typed console page architecture. |
| `frontend/src/pages/Admin/AgentBuilder/AddBlockMenu/index.jsx` | port | 85 | Port the surviving frontend behavior into the typed console page architecture. |
| `frontend/src/pages/Admin/AgentBuilder/BlockList/index.jsx` | port | 343 | Port the surviving frontend behavior into the typed console page architecture. |
| `frontend/src/pages/Admin/AgentBuilder/HeaderMenu/index.jsx` | port | 148 | Port the surviving frontend behavior into the typed console page architecture. |
| `frontend/src/pages/Admin/AgentBuilder/VariableInput/index.jsx` | port | 140 | Port the surviving frontend behavior into the typed console page architecture. |
| `frontend/src/pages/Admin/AgentBuilder/index.jsx` | port | 396 | Port the surviving frontend behavior into the typed console page architecture. |
| `frontend/src/pages/Admin/AgentBuilder/nodes/ApiCallNode/index.jsx` | port | 283 | Port the surviving frontend behavior into the typed console page architecture. |
| `frontend/src/pages/Admin/AgentBuilder/nodes/CodeNode/index.jsx` | port | 56 | Port the surviving frontend behavior into the typed console page architecture. |
| `frontend/src/pages/Admin/AgentBuilder/nodes/FileNode/index.jsx` | port | 72 | Port the surviving frontend behavior into the typed console page architecture. |
| `frontend/src/pages/Admin/AgentBuilder/nodes/FinishNode/index.jsx` | port | 10 | Port the surviving frontend behavior into the typed console page architecture. |
| `frontend/src/pages/Admin/AgentBuilder/nodes/FlowInfoNode/index.jsx` | port | 66 | Port the surviving frontend behavior into the typed console page architecture. |
| `frontend/src/pages/Admin/AgentBuilder/nodes/LLMInstructionNode/index.jsx` | port | 42 | Port the surviving frontend behavior into the typed console page architecture. |
| `frontend/src/pages/Admin/AgentBuilder/nodes/StartNode/index.jsx` | port | 105 | Port the surviving frontend behavior into the typed console page architecture. |
| `frontend/src/pages/Admin/AgentBuilder/nodes/WebScrapingNode/index.jsx` | port | 95 | Port the surviving frontend behavior into the typed console page architecture. |
| `frontend/src/pages/Admin/AgentBuilder/nodes/WebsiteNode/index.jsx` | port | 68 | Port the surviving frontend behavior into the typed console page architecture. |
| `frontend/src/pages/Admin/AgentBuilder/useAvailableVariables.jsx` | port | 20 | Port the surviving frontend behavior into the typed console page architecture. |
| `frontend/src/pages/Admin/Agents/AgentFlows/FlowPanel.jsx` | port | 115 | Port the surviving frontend behavior into the typed console page architecture. |
| `frontend/src/pages/Admin/Agents/AgentFlows/index.jsx` | port | 59 | Port the surviving frontend behavior into the typed console page architecture. |
| `frontend/src/pages/Admin/Agents/AgentSkillSettings/AgentClarifyingQuestions.jsx` | port | 108 | Port the surviving frontend behavior into the typed console page architecture. |
| `frontend/src/pages/Admin/Agents/AgentSkillSettings/AgentSkillReranker.jsx` | port | 102 | Port the surviving frontend behavior into the typed console page architecture. |
| `frontend/src/pages/Admin/Agents/AgentSkillSettings/MaxToolCallStack.jsx` | port | 65 | Port the surviving frontend behavior into the typed console page architecture. |
| `frontend/src/pages/Admin/Agents/AgentSkillSettings/index.jsx` | port | 56 | Port the surviving frontend behavior into the typed console page architecture. |
| `frontend/src/pages/Admin/Agents/Badges/default.jsx` | port | 17 | Port the surviving frontend behavior into the typed console page architecture. |
| `frontend/src/pages/Admin/Agents/CreateFileSkillPanel/index.jsx` | port | 192 | Port the surviving frontend behavior into the typed console page architecture. |
| `frontend/src/pages/Admin/Agents/DefaultSkillPanel/index.jsx` | port | 51 | Port the surviving frontend behavior into the typed console page architecture. |
| `frontend/src/pages/Admin/Agents/FileSystemSkillPanel/index.jsx` | port | 332 | Port the surviving frontend behavior into the typed console page architecture. |
| `frontend/src/pages/Admin/Agents/GMailSkillPanel/gmail.png` | port | 104 | Port the surviving frontend behavior into the typed console page architecture. |
| `frontend/src/pages/Admin/Agents/GMailSkillPanel/index.jsx` | port | 448 | Port the surviving frontend behavior into the typed console page architecture. |
| `frontend/src/pages/Admin/Agents/GMailSkillPanel/utils.js` | port | 136 | Port the surviving frontend behavior into the typed console page architecture. |
| `frontend/src/pages/Admin/Agents/GenericSkillPanel/index.jsx` | port | 46 | Port the surviving frontend behavior into the typed console page architecture. |
| `frontend/src/pages/Admin/Agents/GoogleCalendarSkillPanel/google-calendar.png` | port | 84 | Port the surviving frontend behavior into the typed console page architecture. |
| `frontend/src/pages/Admin/Agents/GoogleCalendarSkillPanel/index.jsx` | port | 457 | Port the surviving frontend behavior into the typed console page architecture. |
| `frontend/src/pages/Admin/Agents/GoogleCalendarSkillPanel/utils.js` | port | 114 | Port the surviving frontend behavior into the typed console page architecture. |
| `frontend/src/pages/Admin/Agents/Imported/ImportedSkillConfig/index.jsx` | port | 251 | Port the surviving frontend behavior into the typed console page architecture. |
| `frontend/src/pages/Admin/Agents/Imported/SkillList/index.jsx` | port | 61 | Port the surviving frontend behavior into the typed console page architecture. |
| `frontend/src/pages/Admin/Agents/MCPServers/ServerPanel.jsx` | port | 315 | Port the surviving frontend behavior into the typed console page architecture. |
| `frontend/src/pages/Admin/Agents/MCPServers/index.jsx` | port | 187 | Port the surviving frontend behavior into the typed console page architecture. |
| `frontend/src/pages/Admin/Agents/OutlookSkillPanel/index.jsx` | port | 667 | Port the surviving frontend behavior into the typed console page architecture. |
| `frontend/src/pages/Admin/Agents/OutlookSkillPanel/outlook.png` | port | 229 | Port the surviving frontend behavior into the typed console page architecture. |
| `frontend/src/pages/Admin/Agents/OutlookSkillPanel/utils.js` | port | 90 | Port the surviving frontend behavior into the typed console page architecture. |
| `frontend/src/pages/Admin/Agents/SQLConnectorSelection/DBConnection.jsx` | port | 75 | Port the surviving frontend behavior into the typed console page architecture. |
| `frontend/src/pages/Admin/Agents/SQLConnectorSelection/SQLConnectionModal.jsx` | port | 526 | Port the surviving frontend behavior into the typed console page architecture. |
| `frontend/src/pages/Admin/Agents/SQLConnectorSelection/icons/mssql.png` | port | 187 | Port the surviving frontend behavior into the typed console page architecture. |
| `frontend/src/pages/Admin/Agents/SQLConnectorSelection/icons/mysql.png` | port | 71 | Port the surviving frontend behavior into the typed console page architecture. |
| `frontend/src/pages/Admin/Agents/SQLConnectorSelection/icons/postgresql.png` | port | 194 | Port the surviving frontend behavior into the typed console page architecture. |
| `frontend/src/pages/Admin/Agents/SQLConnectorSelection/index.jsx` | port | 223 | Port the surviving frontend behavior into the typed console page architecture. |
| `frontend/src/pages/Admin/Agents/WebSearchSelection/SearchProviderItem/index.jsx` | port | 27 | Port the surviving frontend behavior into the typed console page architecture. |
| `frontend/src/pages/Admin/Agents/WebSearchSelection/SearchProviderOptions/index.jsx` | port | 551 | Port the surviving frontend behavior into the typed console page architecture. |
| `frontend/src/pages/Admin/Agents/WebSearchSelection/icons/baidu.png` | port | 169 | Port the surviving frontend behavior into the typed console page architecture. |
| `frontend/src/pages/Admin/Agents/WebSearchSelection/icons/bing.png` | port | 320 | Port the surviving frontend behavior into the typed console page architecture. |
| `frontend/src/pages/Admin/Agents/WebSearchSelection/icons/brave.png` | port | 123 | Port the surviving frontend behavior into the typed console page architecture. |
| `frontend/src/pages/Admin/Agents/WebSearchSelection/icons/crw.png` | port | 169 | Port the surviving frontend behavior into the typed console page architecture. |
| `frontend/src/pages/Admin/Agents/WebSearchSelection/icons/duckduckgo.png` | port | 687 | Port the surviving frontend behavior into the typed console page architecture. |
| `frontend/src/pages/Admin/Agents/WebSearchSelection/icons/exa.png` | port | 181 | Port the surviving frontend behavior into the typed console page architecture. |
| `frontend/src/pages/Admin/Agents/WebSearchSelection/icons/perplexity.png` | port | 106 | Port the surviving frontend behavior into the typed console page architecture. |
| `frontend/src/pages/Admin/Agents/WebSearchSelection/icons/searchapi.png` | port | 7 | Port the surviving frontend behavior into the typed console page architecture. |
| `frontend/src/pages/Admin/Agents/WebSearchSelection/icons/searxng.png` | port | 26 | Port the surviving frontend behavior into the typed console page architecture. |
| `frontend/src/pages/Admin/Agents/WebSearchSelection/icons/serpapi.png` | port | 414 | Port the surviving frontend behavior into the typed console page architecture. |
| `frontend/src/pages/Admin/Agents/WebSearchSelection/icons/serper.png` | port | 169 | Port the surviving frontend behavior into the typed console page architecture. |
| `frontend/src/pages/Admin/Agents/WebSearchSelection/icons/serply.png` | port | 7 | Port the surviving frontend behavior into the typed console page architecture. |
| `frontend/src/pages/Admin/Agents/WebSearchSelection/icons/tavily.svg` | port | 0 | Port the surviving frontend behavior into the typed console page architecture. |
| `frontend/src/pages/Admin/Agents/WebSearchSelection/index.jsx` | port | 313 | Port the surviving frontend behavior into the typed console page architecture. |
| `frontend/src/pages/Admin/Agents/index.jsx` | port | 870 | Port the surviving frontend behavior into the typed console page architecture. |
| `frontend/src/pages/Admin/Agents/skills.jsx` | port | 156 | Port the surviving frontend behavior into the typed console page architecture. |
| `frontend/src/pages/Admin/Agents/utils.js` | port | 33 | Port the surviving frontend behavior into the typed console page architecture. |
| `frontend/src/pages/Admin/DefaultSystemPrompt/index.jsx` | port | 270 | Port the surviving frontend behavior into the typed console page architecture. |
| `frontend/src/pages/Admin/ExperimentalFeatures/Features/LiveSync/manage/DocumentSyncQueueRow/index.jsx` | port | 44 | Port the surviving frontend behavior into the typed console page architecture. |
| `frontend/src/pages/Admin/ExperimentalFeatures/Features/LiveSync/manage/index.jsx` | port | 94 | Port the surviving frontend behavior into the typed console page architecture. |
| `frontend/src/pages/Admin/ExperimentalFeatures/Features/LiveSync/toggle.jsx` | port | 83 | Port the surviving frontend behavior into the typed console page architecture. |
| `frontend/src/pages/Admin/ExperimentalFeatures/features.js` | port | 9 | Port the surviving frontend behavior into the typed console page architecture. |
| `frontend/src/pages/Admin/ExperimentalFeatures/index.jsx` | port | 301 | Port the surviving frontend behavior into the typed console page architecture. |
| `frontend/src/pages/Admin/Invitations/InviteRow/index.jsx` | port | 79 | Port the surviving frontend behavior into the typed console page architecture. |
| `frontend/src/pages/Admin/Invitations/NewInviteModal/index.jsx` | port | 217 | Port the surviving frontend behavior into the typed console page architecture. |
| `frontend/src/pages/Admin/Invitations/index.jsx` | port | 112 | Port the surviving frontend behavior into the typed console page architecture. |
| `frontend/src/pages/Admin/Logging/LogRow/index.jsx` | port | 116 | Port the surviving frontend behavior into the typed console page architecture. |
| `frontend/src/pages/Admin/Logging/index.jsx` | port | 162 | Port the surviving frontend behavior into the typed console page architecture. |
| `frontend/src/pages/Admin/SystemPromptVariables/AddVariableModal/index.jsx` | port | 129 | Port the surviving frontend behavior into the typed console page architecture. |
| `frontend/src/pages/Admin/SystemPromptVariables/VariableRow/EditVariableModal/index.jsx` | port | 133 | Port the surviving frontend behavior into the typed console page architecture. |
| `frontend/src/pages/Admin/SystemPromptVariables/VariableRow/index.jsx` | port | 120 | Port the surviving frontend behavior into the typed console page architecture. |
| `frontend/src/pages/Admin/SystemPromptVariables/index.jsx` | port | 120 | Port the surviving frontend behavior into the typed console page architecture. |
| `frontend/src/pages/Admin/Users/NewUserModal/index.jsx` | port | 168 | Port the surviving frontend behavior into the typed console page architecture. |
| `frontend/src/pages/Admin/Users/UserRow/EditUserModal/index.jsx` | port | 180 | Port the surviving frontend behavior into the typed console page architecture. |
| `frontend/src/pages/Admin/Users/UserRow/index.jsx` | port | 103 | Port the surviving frontend behavior into the typed console page architecture. |
| `frontend/src/pages/Admin/Users/index.jsx` | port | 188 | Port the surviving frontend behavior into the typed console page architecture. |
| `frontend/src/pages/Admin/Workspaces/NewWorkspaceModal/index.jsx` | port | 81 | Port the surviving frontend behavior into the typed console page architecture. |
| `frontend/src/pages/Admin/Workspaces/WorkspaceRow/index.jsx` | port | 64 | Port the surviving frontend behavior into the typed console page architecture. |
| `frontend/src/pages/Admin/Workspaces/index.jsx` | port | 125 | Port the surviving frontend behavior into the typed console page architecture. |
| `frontend/src/pages/GeneralSettings/ApiKeys/ApiKeyRow/index.jsx` | port | 73 | Port the surviving frontend behavior into the typed console page architecture. |
| `frontend/src/pages/GeneralSettings/ApiKeys/NewApiKeyModal/index.jsx` | port | 160 | Port the surviving frontend behavior into the typed console page architecture. |
| `frontend/src/pages/GeneralSettings/ApiKeys/index.jsx` | port | 137 | Port the surviving frontend behavior into the typed console page architecture. |
| `frontend/src/pages/GeneralSettings/AudioPreference/index.jsx` | cut | 45 | Provider configuration is removed because Theorem owns the substrate. |
| `frontend/src/pages/GeneralSettings/AudioPreference/stt.jsx` | cut | 238 | Provider configuration is removed because Theorem owns the substrate. |
| `frontend/src/pages/GeneralSettings/AudioPreference/tts.jsx` | cut | 236 | Provider configuration is removed because Theorem owns the substrate. |
| `frontend/src/pages/GeneralSettings/BrowserExtensionApiKey/BrowserExtensionApiKeyRow/index.jsx` | port | 109 | Port the surviving frontend behavior into the typed console page architecture. |
| `frontend/src/pages/GeneralSettings/BrowserExtensionApiKey/NewBrowserExtensionApiKeyModal/index.jsx` | port | 129 | Port the surviving frontend behavior into the typed console page architecture. |
| `frontend/src/pages/GeneralSettings/BrowserExtensionApiKey/index.jsx` | port | 151 | Port the surviving frontend behavior into the typed console page architecture. |
| `frontend/src/pages/GeneralSettings/ChatEmbedWidgets/EmbedChats/ChatRow/index.jsx` | port | 182 | Port the surviving frontend behavior into the typed console page architecture. |
| `frontend/src/pages/GeneralSettings/ChatEmbedWidgets/EmbedChats/MarkdownRenderer.jsx` | port | 88 | Port the surviving frontend behavior into the typed console page architecture. |
| `frontend/src/pages/GeneralSettings/ChatEmbedWidgets/EmbedChats/index.jsx` | port | 237 | Port the surviving frontend behavior into the typed console page architecture. |
| `frontend/src/pages/GeneralSettings/ChatEmbedWidgets/EmbedConfigs/EmbedRow/CodeSnippetModal/index.jsx` | port | 126 | Port the surviving frontend behavior into the typed console page architecture. |
| `frontend/src/pages/GeneralSettings/ChatEmbedWidgets/EmbedConfigs/EmbedRow/EditEmbedModal/index.jsx` | port | 127 | Port the surviving frontend behavior into the typed console page architecture. |
| `frontend/src/pages/GeneralSettings/ChatEmbedWidgets/EmbedConfigs/EmbedRow/index.jsx` | port | 157 | Port the surviving frontend behavior into the typed console page architecture. |
| `frontend/src/pages/GeneralSettings/ChatEmbedWidgets/EmbedConfigs/NewEmbedModal/index.jsx` | port | 357 | Port the surviving frontend behavior into the typed console page architecture. |
| `frontend/src/pages/GeneralSettings/ChatEmbedWidgets/EmbedConfigs/index.jsx` | port | 97 | Port the surviving frontend behavior into the typed console page architecture. |
| `frontend/src/pages/GeneralSettings/ChatEmbedWidgets/index.jsx` | port | 154 | Port the surviving frontend behavior into the typed console page architecture. |
| `frontend/src/pages/GeneralSettings/Chats/ChatRow/index.jsx` | port | 102 | Port the surviving frontend behavior into the typed console page architecture. |
| `frontend/src/pages/GeneralSettings/Chats/MarkdownRenderer.jsx` | port | 88 | Port the surviving frontend behavior into the typed console page architecture. |
| `frontend/src/pages/GeneralSettings/Chats/index.jsx` | port | 285 | Port the surviving frontend behavior into the typed console page architecture. |
| `frontend/src/pages/GeneralSettings/CommunityHub/Authentication/UserItems/index.jsx` | port | 103 | Port the surviving frontend behavior into the typed console page architecture. |
| `frontend/src/pages/GeneralSettings/CommunityHub/Authentication/index.jsx` | port | 206 | Port the surviving frontend behavior into the typed console page architecture. |
| `frontend/src/pages/GeneralSettings/CommunityHub/Authentication/useUserItems.js` | port | 40 | Port the surviving frontend behavior into the typed console page architecture. |
| `frontend/src/pages/GeneralSettings/CommunityHub/ImportItem/Steps/Completed/index.jsx` | port | 46 | Port the surviving frontend behavior into the typed console page architecture. |
| `frontend/src/pages/GeneralSettings/CommunityHub/ImportItem/Steps/Introduction/index.jsx` | port | 76 | Port the surviving frontend behavior into the typed console page architecture. |
| `frontend/src/pages/GeneralSettings/CommunityHub/ImportItem/Steps/PullAndReview/HubItem/AgentFlow.jsx` | port | 80 | Port the surviving frontend behavior into the typed console page architecture. |
| `frontend/src/pages/GeneralSettings/CommunityHub/ImportItem/Steps/PullAndReview/HubItem/AgentSkill.jsx` | port | 190 | Port the surviving frontend behavior into the typed console page architecture. |
| `frontend/src/pages/GeneralSettings/CommunityHub/ImportItem/Steps/PullAndReview/HubItem/SlashCommand.jsx` | port | 79 | Port the surviving frontend behavior into the typed console page architecture. |
| `frontend/src/pages/GeneralSettings/CommunityHub/ImportItem/Steps/PullAndReview/HubItem/SystemPrompt.jsx` | port | 106 | Port the surviving frontend behavior into the typed console page architecture. |
| `frontend/src/pages/GeneralSettings/CommunityHub/ImportItem/Steps/PullAndReview/HubItem/Unknown.jsx` | port | 39 | Port the surviving frontend behavior into the typed console page architecture. |
| `frontend/src/pages/GeneralSettings/CommunityHub/ImportItem/Steps/PullAndReview/HubItem/index.js` | port | 15 | Port the surviving frontend behavior into the typed console page architecture. |
| `frontend/src/pages/GeneralSettings/CommunityHub/ImportItem/Steps/PullAndReview/index.jsx` | port | 86 | Port the surviving frontend behavior into the typed console page architecture. |
| `frontend/src/pages/GeneralSettings/CommunityHub/ImportItem/Steps/index.jsx` | port | 77 | Port the surviving frontend behavior into the typed console page architecture. |
| `frontend/src/pages/GeneralSettings/CommunityHub/ImportItem/index.jsx` | port | 106 | Port the surviving frontend behavior into the typed console page architecture. |
| `frontend/src/pages/GeneralSettings/CommunityHub/Trending/HubItems/HubItemCard/agentFlow.jsx` | port | 40 | Port the surviving frontend behavior into the typed console page architecture. |
| `frontend/src/pages/GeneralSettings/CommunityHub/Trending/HubItems/HubItemCard/agentSkill.jsx` | port | 45 | Port the surviving frontend behavior into the typed console page architecture. |
| `frontend/src/pages/GeneralSettings/CommunityHub/Trending/HubItems/HubItemCard/generic.jsx` | port | 45 | Port the surviving frontend behavior into the typed console page architecture. |
| `frontend/src/pages/GeneralSettings/CommunityHub/Trending/HubItems/HubItemCard/index.jsx` | port | 20 | Port the surviving frontend behavior into the typed console page architecture. |
| `frontend/src/pages/GeneralSettings/CommunityHub/Trending/HubItems/HubItemCard/slashCommand.jsx` | port | 45 | Port the surviving frontend behavior into the typed console page architecture. |
| `frontend/src/pages/GeneralSettings/CommunityHub/Trending/HubItems/HubItemCard/systemPrompt.jsx` | port | 38 | Port the surviving frontend behavior into the typed console page architecture. |
| `frontend/src/pages/GeneralSettings/CommunityHub/Trending/HubItems/index.jsx` | port | 135 | Port the surviving frontend behavior into the typed console page architecture. |
| `frontend/src/pages/GeneralSettings/CommunityHub/Trending/index.jsx` | port | 29 | Port the surviving frontend behavior into the typed console page architecture. |
| `frontend/src/pages/GeneralSettings/CommunityHub/utils.js` | port | 43 | Port the surviving frontend behavior into the typed console page architecture. |
| `frontend/src/pages/GeneralSettings/Connections/TelegramBot/ConnectedView/ConnectedBotCard/index.jsx` | cut | 26 | Provider configuration is removed because Theorem owns the substrate. |
| `frontend/src/pages/GeneralSettings/Connections/TelegramBot/ConnectedView/DetailsSection/index.jsx` | cut | 89 | Provider configuration is removed because Theorem owns the substrate. |
| `frontend/src/pages/GeneralSettings/Connections/TelegramBot/ConnectedView/DisconnectedView/index.jsx` | cut | 157 | Provider configuration is removed because Theorem owns the substrate. |
| `frontend/src/pages/GeneralSettings/Connections/TelegramBot/ConnectedView/UsersSection/index.jsx` | cut | 148 | Provider configuration is removed because Theorem owns the substrate. |
| `frontend/src/pages/GeneralSettings/Connections/TelegramBot/ConnectedView/index.jsx` | cut | 55 | Provider configuration is removed because Theorem owns the substrate. |
| `frontend/src/pages/GeneralSettings/Connections/TelegramBot/SetupView/CreateBotSection/index.jsx` | cut | 100 | Provider configuration is removed because Theorem owns the substrate. |
| `frontend/src/pages/GeneralSettings/Connections/TelegramBot/SetupView/index.jsx` | cut | 100 | Provider configuration is removed because Theorem owns the substrate. |
| `frontend/src/pages/GeneralSettings/Connections/TelegramBot/index.jsx` | cut | 100 | Provider configuration is removed because Theorem owns the substrate. |
| `frontend/src/pages/GeneralSettings/EmbeddingPreference/index.jsx` | cut | 399 | Provider configuration is removed because Theorem owns the substrate. |
| `frontend/src/pages/GeneralSettings/EmbeddingTextSplitterPreference/index.jsx` | cut | 205 | Provider configuration is removed because Theorem owns the substrate. |
| `frontend/src/pages/GeneralSettings/LLMPreference/index.jsx` | cut | 661 | Provider configuration is removed because Theorem owns the substrate. |
| `frontend/src/pages/GeneralSettings/MobileConnections/ConnectionModal/bg.png` | cut | 1,215 | Provider configuration is removed because Theorem owns the substrate. |
| `frontend/src/pages/GeneralSettings/MobileConnections/ConnectionModal/gplay-badge.svg` | cut | 54 | Provider configuration is removed because Theorem owns the substrate. |
| `frontend/src/pages/GeneralSettings/MobileConnections/ConnectionModal/index.jsx` | cut | 161 | Provider configuration is removed because Theorem owns the substrate. |
| `frontend/src/pages/GeneralSettings/MobileConnections/DeviceRow/index.jsx` | cut | 90 | Provider configuration is removed because Theorem owns the substrate. |
| `frontend/src/pages/GeneralSettings/MobileConnections/index.jsx` | cut | 123 | Provider configuration is removed because Theorem owns the substrate. |
| `frontend/src/pages/GeneralSettings/ModelRouters/LLMProviderModelPicker/index.jsx` | cut | 282 | Provider configuration is removed because Theorem owns the substrate. |
| `frontend/src/pages/GeneralSettings/ModelRouters/NewRouterModal/index.jsx` | cut | 184 | Provider configuration is removed because Theorem owns the substrate. |
| `frontend/src/pages/GeneralSettings/ModelRouters/RouterRulesPage/index.jsx` | cut | 78 | Provider configuration is removed because Theorem owns the substrate. |
| `frontend/src/pages/GeneralSettings/ModelRouters/RuleBuilder/RuleForm/CalculatedFields/index.jsx` | cut | 338 | Provider configuration is removed because Theorem owns the substrate. |
| `frontend/src/pages/GeneralSettings/ModelRouters/RuleBuilder/RuleForm/LLMDescriptionField/index.jsx` | cut | 23 | Provider configuration is removed because Theorem owns the substrate. |
| `frontend/src/pages/GeneralSettings/ModelRouters/RuleBuilder/RuleForm/index.jsx` | cut | 231 | Provider configuration is removed because Theorem owns the substrate. |
| `frontend/src/pages/GeneralSettings/ModelRouters/RuleBuilder/RuleRow/index.jsx` | cut | 198 | Provider configuration is removed because Theorem owns the substrate. |
| `frontend/src/pages/GeneralSettings/ModelRouters/RuleBuilder/index.jsx` | cut | 239 | Provider configuration is removed because Theorem owns the substrate. |
| `frontend/src/pages/GeneralSettings/ModelRouters/index.jsx` | cut | 243 | Provider configuration is removed because Theorem owns the substrate. |
| `frontend/src/pages/GeneralSettings/PrivacyAndData/index.jsx` | port | 130 | Port the surviving frontend behavior into the typed console page architecture. |
| `frontend/src/pages/GeneralSettings/ScheduledJobs/JobFormModal/CronBuilder.jsx` | port | 196 | Port the surviving frontend behavior into the typed console page architecture. |
| `frontend/src/pages/GeneralSettings/ScheduledJobs/JobFormModal/FormActions.jsx` | port | 28 | Port the surviving frontend behavior into the typed console page architecture. |
| `frontend/src/pages/GeneralSettings/ScheduledJobs/JobFormModal/JobDescription.jsx` | port | 57 | Port the surviving frontend behavior into the typed console page architecture. |
| `frontend/src/pages/GeneralSettings/ScheduledJobs/JobFormModal/JobSchedule.jsx` | port | 89 | Port the surviving frontend behavior into the typed console page architecture. |
| `frontend/src/pages/GeneralSettings/ScheduledJobs/JobFormModal/ToolsSelector.jsx` | port | 352 | Port the surviving frontend behavior into the typed console page architecture. |
| `frontend/src/pages/GeneralSettings/ScheduledJobs/JobFormModal/index.jsx` | port | 163 | Port the surviving frontend behavior into the typed console page architecture. |
| `frontend/src/pages/GeneralSettings/ScheduledJobs/RunDetailPage.jsx` | port | 434 | Port the surviving frontend behavior into the typed console page architecture. |
| `frontend/src/pages/GeneralSettings/ScheduledJobs/RunHistoryPage.jsx` | port | 165 | Port the surviving frontend behavior into the typed console page architecture. |
| `frontend/src/pages/GeneralSettings/ScheduledJobs/components/CollapsibleSection.jsx` | port | 71 | Port the surviving frontend behavior into the typed console page architecture. |
| `frontend/src/pages/GeneralSettings/ScheduledJobs/components/GeneratedFileCard.jsx` | port | 134 | Port the surviving frontend behavior into the typed console page architecture. |
| `frontend/src/pages/GeneralSettings/ScheduledJobs/components/JobRow.jsx` | port | 107 | Port the surviving frontend behavior into the typed console page architecture. |
| `frontend/src/pages/GeneralSettings/ScheduledJobs/components/RunRow.jsx` | port | 101 | Port the surviving frontend behavior into the typed console page architecture. |
| `frontend/src/pages/GeneralSettings/ScheduledJobs/components/StatusBadge.jsx` | port | 51 | Port the surviving frontend behavior into the typed console page architecture. |
| `frontend/src/pages/GeneralSettings/ScheduledJobs/components/ToolCallCard.jsx` | port | 144 | Port the surviving frontend behavior into the typed console page architecture. |
| `frontend/src/pages/GeneralSettings/ScheduledJobs/index.jsx` | port | 242 | Port the surviving frontend behavior into the typed console page architecture. |
| `frontend/src/pages/GeneralSettings/ScheduledJobs/utils/cron.js` | port | 277 | Port the surviving frontend behavior into the typed console page architecture. |
| `frontend/src/pages/GeneralSettings/Security/index.jsx` | port | 345 | Port the surviving frontend behavior into the typed console page architecture. |
| `frontend/src/pages/GeneralSettings/Settings/Branding/index.jsx` | port | 40 | Port the surviving frontend behavior into the typed console page architecture. |
| `frontend/src/pages/GeneralSettings/Settings/Chat/index.jsx` | port | 42 | Port the surviving frontend behavior into the typed console page architecture. |
| `frontend/src/pages/GeneralSettings/Settings/Interface/index.jsx` | port | 34 | Port the surviving frontend behavior into the typed console page architecture. |
| `frontend/src/pages/GeneralSettings/Settings/components/AutoScroll/index.jsx` | port | 38 | Port the surviving frontend behavior into the typed console page architecture. |
| `frontend/src/pages/GeneralSettings/Settings/components/AutoSpeak/index.jsx` | port | 47 | Port the surviving frontend behavior into the typed console page architecture. |
| `frontend/src/pages/GeneralSettings/Settings/components/AutoSubmit/index.jsx` | port | 44 | Port the surviving frontend behavior into the typed console page architecture. |
| `frontend/src/pages/GeneralSettings/Settings/components/ChatRenderHTML/index.jsx` | port | 44 | Port the surviving frontend behavior into the typed console page architecture. |
| `frontend/src/pages/GeneralSettings/Settings/components/CustomAppName/index.jsx` | port | 103 | Port the surviving frontend behavior into the typed console page architecture. |
| `frontend/src/pages/GeneralSettings/Settings/components/CustomLogo/index.jsx` | port | 149 | Port the surviving frontend behavior into the typed console page architecture. |
| `frontend/src/pages/GeneralSettings/Settings/components/CustomSiteSettings/index.jsx` | port | 121 | Port the surviving frontend behavior into the typed console page architecture. |
| `frontend/src/pages/GeneralSettings/Settings/components/FooterCustomization/NewIconForm/index.jsx` | port | 117 | Port the surviving frontend behavior into the typed console page architecture. |
| `frontend/src/pages/GeneralSettings/Settings/components/FooterCustomization/index.jsx` | port | 86 | Port the surviving frontend behavior into the typed console page architecture. |
| `frontend/src/pages/GeneralSettings/Settings/components/LanguagePreference/index.jsx` | port | 39 | Port the surviving frontend behavior into the typed console page architecture. |
| `frontend/src/pages/GeneralSettings/Settings/components/ShowScrollbar/index.jsx` | port | 44 | Port the surviving frontend behavior into the typed console page architecture. |
| `frontend/src/pages/GeneralSettings/Settings/components/SpellCheck/index.jsx` | port | 38 | Port the surviving frontend behavior into the typed console page architecture. |
| `frontend/src/pages/GeneralSettings/Settings/components/SupportEmail/index.jsx` | port | 98 | Port the surviving frontend behavior into the typed console page architecture. |
| `frontend/src/pages/GeneralSettings/Settings/components/ThemePreference/index.jsx` | port | 31 | Port the surviving frontend behavior into the typed console page architecture. |
| `frontend/src/pages/GeneralSettings/TranscriptionPreference/index.jsx` | cut | 247 | Provider configuration is removed because Theorem owns the substrate. |
| `frontend/src/pages/GeneralSettings/VectorDatabase/index.jsx` | cut | 341 | Provider configuration is removed because Theorem owns the substrate. |
| `frontend/src/pages/Invite/NewUserModal/index.jsx` | port | 109 | Port the surviving frontend behavior into the typed console page architecture. |
| `frontend/src/pages/Invite/index.jsx` | port | 56 | Port the surviving frontend behavior into the typed console page architecture. |
| `frontend/src/pages/Login/SSO/simple.jsx` | port | 53 | Port the surviving frontend behavior into the typed console page architecture. |
| `frontend/src/pages/Login/index.jsx` | port | 36 | Port the surviving frontend behavior into the typed console page architecture. |
| `frontend/src/pages/Main/Home/index.jsx` | port | 348 | Port the surviving frontend behavior into the typed console page architecture. |
| `frontend/src/pages/Main/index.jsx` | port | 21 | Port the surviving frontend behavior into the typed console page architecture. |
| `frontend/src/pages/OnboardingFlow/Steps/DataHandling/index.jsx` | port | 36 | Port the surviving frontend behavior into the typed console page architecture. |
| `frontend/src/pages/OnboardingFlow/Steps/Home/components/OnboardingLogoSVG.jsx` | port | 80 | Port the surviving frontend behavior into the typed console page architecture. |
| `frontend/src/pages/OnboardingFlow/Steps/Home/index.jsx` | port | 56 | Port the surviving frontend behavior into the typed console page architecture. |
| `frontend/src/pages/OnboardingFlow/Steps/LLMPreference/index.jsx` | cut | 477 | Provider and model selection moves to the Harness execution boundary. |
| `frontend/src/pages/OnboardingFlow/Steps/Survey/index.jsx` | port | 286 | Port the surviving frontend behavior into the typed console page architecture. |
| `frontend/src/pages/OnboardingFlow/Steps/UserSetup/index.jsx` | port | 355 | Port the surviving frontend behavior into the typed console page architecture. |
| `frontend/src/pages/OnboardingFlow/Steps/index.jsx` | port | 142 | Port the surviving frontend behavior into the typed console page architecture. |
| `frontend/src/pages/OnboardingFlow/index.jsx` | port | 21 | Port the surviving frontend behavior into the typed console page architecture. |
| `frontend/src/pages/WorkspaceChat/index.jsx` | port | 72 | Port the surviving frontend behavior into the typed console page architecture. |
| `frontend/src/pages/WorkspaceSettings/AgentConfig/AgentLLMSelection/AgentLLMItem/index.jsx` | cut | 188 | Provider and model selection moves to the Harness execution boundary. |
| `frontend/src/pages/WorkspaceSettings/AgentConfig/AgentLLMSelection/index.jsx` | cut | 217 | Provider and model selection moves to the Harness execution boundary. |
| `frontend/src/pages/WorkspaceSettings/AgentConfig/AgentModelSelection/index.jsx` | port | 183 | Port the surviving frontend behavior into the typed console page architecture. |
| `frontend/src/pages/WorkspaceSettings/AgentConfig/index.jsx` | port | 148 | Port the surviving frontend behavior into the typed console page architecture. |
| `frontend/src/pages/WorkspaceSettings/ChatSettings/ChatHistorySettings/index.jsx` | port | 30 | Port the surviving frontend behavior into the typed console page architecture. |
| `frontend/src/pages/WorkspaceSettings/ChatSettings/ChatModeSelection/index.jsx` | port | 75 | Port the surviving frontend behavior into the typed console page architecture. |
| `frontend/src/pages/WorkspaceSettings/ChatSettings/ChatPromptSettings/ChatPromptHistory/PromptHistoryItem/index.jsx` | port | 133 | Port the surviving frontend behavior into the typed console page architecture. |
| `frontend/src/pages/WorkspaceSettings/ChatSettings/ChatPromptSettings/ChatPromptHistory/index.jsx` | port | 117 | Port the surviving frontend behavior into the typed console page architecture. |
| `frontend/src/pages/WorkspaceSettings/ChatSettings/ChatPromptSettings/index.jsx` | port | 268 | Port the surviving frontend behavior into the typed console page architecture. |
| `frontend/src/pages/WorkspaceSettings/ChatSettings/ChatQueryRefusalResponse/index.jsx` | port | 32 | Port the surviving frontend behavior into the typed console page architecture. |
| `frontend/src/pages/WorkspaceSettings/ChatSettings/ChatTemperatureSettings/index.jsx` | port | 43 | Port the surviving frontend behavior into the typed console page architecture. |
| `frontend/src/pages/WorkspaceSettings/ChatSettings/WorkspaceLLMSelection/ChatModelSelection/index.jsx` | cut | 125 | Provider and model selection moves to the Harness execution boundary. |
| `frontend/src/pages/WorkspaceSettings/ChatSettings/WorkspaceLLMSelection/RouterSelection/index.jsx` | cut | 75 | Provider and model selection moves to the Harness execution boundary. |
| `frontend/src/pages/WorkspaceSettings/ChatSettings/WorkspaceLLMSelection/WorkspaceLLMItem/index.jsx` | cut | 186 | Provider and model selection moves to the Harness execution boundary. |
| `frontend/src/pages/WorkspaceSettings/ChatSettings/WorkspaceLLMSelection/index.jsx` | cut | 230 | Provider and model selection moves to the Harness execution boundary. |
| `frontend/src/pages/WorkspaceSettings/ChatSettings/index.jsx` | port | 95 | Port the surviving frontend behavior into the typed console page architecture. |
| `frontend/src/pages/WorkspaceSettings/GeneralAppearance/DeleteWorkspace/index.jsx` | port | 53 | Port the surviving frontend behavior into the typed console page architecture. |
| `frontend/src/pages/WorkspaceSettings/GeneralAppearance/SuggestedChatMessages/index.jsx` | port | 200 | Port the surviving frontend behavior into the typed console page architecture. |
| `frontend/src/pages/WorkspaceSettings/GeneralAppearance/WorkspaceName/index.jsx` | port | 29 | Port the surviving frontend behavior into the typed console page architecture. |
| `frontend/src/pages/WorkspaceSettings/GeneralAppearance/index.jsx` | port | 70 | Port the surviving frontend behavior into the typed console page architecture. |
| `frontend/src/pages/WorkspaceSettings/Members/AddMemberModal/index.jsx` | port | 163 | Port the surviving frontend behavior into the typed console page architecture. |
| `frontend/src/pages/WorkspaceSettings/Members/WorkspaceMemberRow/index.jsx` | port | 15 | Port the surviving frontend behavior into the typed console page architecture. |
| `frontend/src/pages/WorkspaceSettings/Members/index.jsx` | port | 91 | Port the surviving frontend behavior into the typed console page architecture. |
| `frontend/src/pages/WorkspaceSettings/VectorDatabase/DocumentSimilarityThreshold/index.jsx` | port | 32 | Port the surviving frontend behavior into the typed console page architecture. |
| `frontend/src/pages/WorkspaceSettings/VectorDatabase/MaxContextSnippets/index.jsx` | port | 33 | Port the surviving frontend behavior into the typed console page architecture. |
| `frontend/src/pages/WorkspaceSettings/VectorDatabase/ResetDatabase/index.jsx` | port | 48 | Port the surviving frontend behavior into the typed console page architecture. |
| `frontend/src/pages/WorkspaceSettings/VectorDatabase/VectorCount/index.jsx` | port | 38 | Port the surviving frontend behavior into the typed console page architecture. |
| `frontend/src/pages/WorkspaceSettings/VectorDatabase/VectorDBIdentifier/index.jsx` | port | 12 | Port the surviving frontend behavior into the typed console page architecture. |
| `frontend/src/pages/WorkspaceSettings/VectorDatabase/VectorSearchMode/index.jsx` | port | 51 | Port the surviving frontend behavior into the typed console page architecture. |
| `frontend/src/pages/WorkspaceSettings/VectorDatabase/index.jsx` | port | 69 | Port the surviving frontend behavior into the typed console page architecture. |
| `frontend/src/pages/WorkspaceSettings/index.jsx` | port | 150 | Port the surviving frontend behavior into the typed console page architecture. |
| `frontend/src/utils/chat/agent.js` | port | 447 | Port the surviving frontend behavior into the typed console page architecture. |
| `frontend/src/utils/chat/hljs-libraries/svelte.js` | port | 48 | Port the surviving frontend behavior into the typed console page architecture. |
| `frontend/src/utils/chat/index.js` | port | 203 | Port the surviving frontend behavior into the typed console page architecture. |
| `frontend/src/utils/chat/markdown.js` | port | 83 | Port the surviving frontend behavior into the typed console page architecture. |
| `frontend/src/utils/chat/messageToSpeech.js` | port | 90 | Port the surviving frontend behavior into the typed console page architecture. |
| `frontend/src/utils/chat/plugins/markdown-katex.js` | port | 245 | Port the surviving frontend behavior into the typed console page architecture. |
| `frontend/src/utils/chat/purify.js` | port | 8 | Port the surviving frontend behavior into the typed console page architecture. |
| `frontend/src/utils/chat/themes/github-dark.css` | port | 125 | Port the surviving frontend behavior into the typed console page architecture. |
| `frontend/src/utils/chat/themes/github.css` | port | 125 | Port the surviving frontend behavior into the typed console page architecture. |
| `frontend/src/utils/clipboard.js` | port | 25 | Port the surviving frontend behavior into the typed console page architecture. |
| `frontend/src/utils/constants.js` | port | 82 | Port the surviving frontend behavior into the typed console page architecture. |
| `frontend/src/utils/directories.js` | port | 47 | Port the surviving frontend behavior into the typed console page architecture. |
| `frontend/src/utils/keyboardShortcuts.js` | port | 135 | Port the surviving frontend behavior into the typed console page architecture. |
| `frontend/src/utils/numbers.js` | port | 89 | Port the surviving frontend behavior into the typed console page architecture. |
| `frontend/src/utils/paths.js` | port | 258 | Port the surviving frontend behavior into the typed console page architecture. |
| `frontend/src/utils/piperTTS/index.js` | port | 138 | Port the surviving frontend behavior into the typed console page architecture. |
| `frontend/src/utils/piperTTS/worker.js` | port | 94 | Port the surviving frontend behavior into the typed console page architecture. |
| `frontend/src/utils/request.js` | port | 26 | Port the surviving frontend behavior into the typed console page architecture. |
| `frontend/src/utils/session.js` | port | 15 | Port the surviving frontend behavior into the typed console page architecture. |
| `frontend/src/utils/toast.js` | port | 57 | Port the surviving frontend behavior into the typed console page architecture. |
| `frontend/src/utils/types.js` | port | 22 | Port the surviving frontend behavior into the typed console page architecture. |
| `frontend/src/utils/username.js` | port | 17 | Port the surviving frontend behavior into the typed console page architecture. |

## `server`

| File | Verdict | Lines | Reason |
|---|---:|---:|---|
| `server/.env.example` | service | 543 | Retain in the Express service and adapt it to Theorem boundaries. |
| `server/.flowconfig` | service | 30 | Retain in the Express service and adapt it to Theorem boundaries. |
| `server/.gitignore` | service | 36 | Retain in the Express service and adapt it to Theorem boundaries. |
| `server/.nvmrc` | service | 0 | Retain in the Express service and adapt it to Theorem boundaries. |
| `server/__tests__/models/documentSyncQueue.test.js` | service | 41 | Retain in the Express service and adapt it to Theorem boundaries. |
| `server/__tests__/models/systemPromptVariables.test.js` | service | 60 | Retain in the Express service and adapt it to Theorem boundaries. |
| `server/__tests__/models/user.test.js` | service | 58 | Retain in the Express service and adapt it to Theorem boundaries. |
| `server/__tests__/utils/MCP/hypervisor.test.js` | service | 156 | Retain in the Express service and adapt it to Theorem boundaries. |
| `server/__tests__/utils/MCP/index.test.js` | service | 194 | Retain in the Express service and adapt it to Theorem boundaries. |
| `server/__tests__/utils/SQLConnectors/connectionParser.test.js` | service | 177 | Retain in the Express service and adapt it to Theorem boundaries. |
| `server/__tests__/utils/TextSplitter/index.test.js` | service | 104 | Retain in the Express service and adapt it to Theorem boundaries. |
| `server/__tests__/utils/TextToSpeech/audioFormat.test.js` | cut | 46 | The upstream audio provider tier is removed with provider selection. |
| `server/__tests__/utils/agentFlows/executor.test.js` | service | 92 | Retain in the Express service and adapt it to Theorem boundaries. |
| `server/__tests__/utils/agents/aibitat/emitter.test.js` | cut | 150 | The tested upstream implementation is removed by the fork boundary. |
| `server/__tests__/utils/agents/aibitat/plugins/create-files/lib.test.js` | cut | 86 | The tested upstream implementation is removed by the fork boundary. |
| `server/__tests__/utils/agents/aibitat/providers/helpers/dereferenceSchema.test.js` | cut | 153 | The tested upstream implementation is removed by the fork boundary. |
| `server/__tests__/utils/agents/aibitat/providers/helpers/untooled.test.js` | cut | 86 | The tested upstream implementation is removed by the fork boundary. |
| `server/__tests__/utils/agents/defaults.test.js` | service | 131 | Retain in the Express service and adapt it to Theorem boundaries. |
| `server/__tests__/utils/agents/imported.test.js` | service | 130 | Retain in the Express service and adapt it to Theorem boundaries. |
| `server/__tests__/utils/chats/index.test.js` | service | 98 | Retain in the Express service and adapt it to Theorem boundaries. |
| `server/__tests__/utils/chats/openaiCompatible.test.js` | service | 253 | Retain in the Express service and adapt it to Theorem boundaries. |
| `server/__tests__/utils/chats/openaiHelpers.test.js` | service | 127 | Retain in the Express service and adapt it to Theorem boundaries. |
| `server/__tests__/utils/files/isWithin.test.js` | service | 230 | Retain in the Express service and adapt it to Theorem boundaries. |
| `server/__tests__/utils/helpers/azureOpenAiModelPref.test.js` | service | 55 | Retain in the Express service and adapt it to Theorem boundaries. |
| `server/__tests__/utils/helpers/convertTo.test.js` | service | 237 | Retain in the Express service and adapt it to Theorem boundaries. |
| `server/__tests__/utils/middleware/workspaceDeletionProtection.test.js` | service | 43 | Retain in the Express service and adapt it to Theorem boundaries. |
| `server/__tests__/utils/safeJSONStringify/safeJSONStringify.test.js` | service | 59 | Retain in the Express service and adapt it to Theorem boundaries. |
| `server/__tests__/utils/vectorDbProviders/pgvector/index.test.js` | cut | 78 | The tested upstream implementation is removed by the fork boundary. |
| `server/endpoints/admin.js` | service | 566 | Retain in the Express service and adapt it to Theorem boundaries. |
| `server/endpoints/agentFileServer.js` | service | 178 | Retain in the Express service and adapt it to Theorem boundaries. |
| `server/endpoints/agentFlows.js` | service | 200 | Retain in the Express service and adapt it to Theorem boundaries. |
| `server/endpoints/agentSkillWhitelist.js` | service | 82 | Retain in the Express service and adapt it to Theorem boundaries. |
| `server/endpoints/agentWebsocket.js` | service | 67 | Retain in the Express service and adapt it to Theorem boundaries. |
| `server/endpoints/api/admin/index.js` | service | 791 | Retain in the Express service and adapt it to Theorem boundaries. |
| `server/endpoints/api/auth/index.js` | service | 33 | Retain in the Express service and adapt it to Theorem boundaries. |
| `server/endpoints/api/document/index.js` | service | 1,218 | Retain in the Express service and adapt it to Theorem boundaries. |
| `server/endpoints/api/embed/index.js` | service | 409 | Retain in the Express service and adapt it to Theorem boundaries. |
| `server/endpoints/api/index.js` | service | 29 | Retain in the Express service and adapt it to Theorem boundaries. |
| `server/endpoints/api/openai/compatibility-test-script.cjs` | service | 79 | Retain in the Express service and adapt it to Theorem boundaries. |
| `server/endpoints/api/openai/helpers.js` | service | 50 | Retain in the Express service and adapt it to Theorem boundaries. |
| `server/endpoints/api/openai/index.js` | service | 336 | Retain in the Express service and adapt it to Theorem boundaries. |
| `server/endpoints/api/system/index.js` | service | 285 | Retain in the Express service and adapt it to Theorem boundaries. |
| `server/endpoints/api/userManagement/index.js` | service | 124 | Retain in the Express service and adapt it to Theorem boundaries. |
| `server/endpoints/api/workspace/index.js` | service | 1,031 | Retain in the Express service and adapt it to Theorem boundaries. |
| `server/endpoints/api/workspaceThread/index.js` | service | 668 | Retain in the Express service and adapt it to Theorem boundaries. |
| `server/endpoints/browserExtension.js` | service | 224 | Retain in the Express service and adapt it to Theorem boundaries. |
| `server/endpoints/chat.js` | service | 212 | Retain in the Express service and adapt it to Theorem boundaries. |
| `server/endpoints/communityHub.js` | service | 219 | Retain in the Express service and adapt it to Theorem boundaries. |
| `server/endpoints/document.js` | service | 111 | Retain in the Express service and adapt it to Theorem boundaries. |
| `server/endpoints/embed/index.js` | service | 110 | Retain in the Express service and adapt it to Theorem boundaries. |
| `server/endpoints/embedManagement.js` | service | 131 | Retain in the Express service and adapt it to Theorem boundaries. |
| `server/endpoints/experimental/imported-agent-plugins.js` | service | 65 | Retain in the Express service and adapt it to Theorem boundaries. |
| `server/endpoints/experimental/index.js` | service | 12 | Retain in the Express service and adapt it to Theorem boundaries. |
| `server/endpoints/experimental/liveSync.js` | service | 114 | Retain in the Express service and adapt it to Theorem boundaries. |
| `server/endpoints/extensions/index.js` | service | 197 | Retain in the Express service and adapt it to Theorem boundaries. |
| `server/endpoints/invite.js` | service | 81 | Retain in the Express service and adapt it to Theorem boundaries. |
| `server/endpoints/mcpServers.js` | service | 127 | Retain in the Express service and adapt it to Theorem boundaries. |
| `server/endpoints/memory.js` | service | 196 | Retain in the Express service and adapt it to Theorem boundaries. |
| `server/endpoints/mobile/index.js` | service | 160 | Retain in the Express service and adapt it to Theorem boundaries. |
| `server/endpoints/mobile/middleware/index.js` | service | 97 | Retain in the Express service and adapt it to Theorem boundaries. |
| `server/endpoints/mobile/utils/index.js` | service | 195 | Retain in the Express service and adapt it to Theorem boundaries. |
| `server/endpoints/modelRouter.js` | service | 204 | Retain in the Express service and adapt it to Theorem boundaries. |
| `server/endpoints/scheduledJobs.js` | service | 376 | Retain in the Express service and adapt it to Theorem boundaries. |
| `server/endpoints/system.js` | service | 1,552 | Retain in the Express service and adapt it to Theorem boundaries. |
| `server/endpoints/telegram.js` | service | 335 | Retain in the Express service and adapt it to Theorem boundaries. |
| `server/endpoints/utils.js` | service | 282 | Retain in the Express service and adapt it to Theorem boundaries. |
| `server/endpoints/utils/dockerModelRunnerUtils.js` | service | 94 | Retain in the Express service and adapt it to Theorem boundaries. |
| `server/endpoints/utils/googleAgentSkillEndpoints.js` | service | 70 | Retain in the Express service and adapt it to Theorem boundaries. |
| `server/endpoints/utils/lemonadeUtilsEndpoints.js` | service | 170 | Retain in the Express service and adapt it to Theorem boundaries. |
| `server/endpoints/utils/outlookAgentUtils.js` | service | 190 | Retain in the Express service and adapt it to Theorem boundaries. |
| `server/endpoints/webPush.js` | service | 27 | Retain in the Express service and adapt it to Theorem boundaries. |
| `server/endpoints/workspaceThreads.js` | service | 267 | Retain in the Express service and adapt it to Theorem boundaries. |
| `server/endpoints/workspaces.js` | service | 1,178 | Retain in the Express service and adapt it to Theorem boundaries. |
| `server/endpoints/workspacesParsedFiles.js` | service | 206 | Retain in the Express service and adapt it to Theorem boundaries. |
| `server/eslint.config.mjs` | service | 38 | Retain in the Express service and adapt it to Theorem boundaries. |
| `server/index.js` | service | 179 | Retain in the Express service and adapt it to Theorem boundaries. |
| `server/jobs/cleanup-generated-files.js` | service | 160 | Retain in the Express service and adapt it to Theorem boundaries. |
| `server/jobs/cleanup-orphan-documents.js` | service | 79 | Retain in the Express service and adapt it to Theorem boundaries. |
| `server/jobs/embedding-worker.js` | cut | 199 | The legacy vector ingestion path is replaced by commonplace IngestPipeline. |
| `server/jobs/extract-memories.js` | service | 192 | Retain in the Express service and adapt it to Theorem boundaries. |
| `server/jobs/handle-telegram-chat.js` | service | 67 | Retain in the Express service and adapt it to Theorem boundaries. |
| `server/jobs/helpers/index.js` | service | 54 | Retain in the Express service and adapt it to Theorem boundaries. |
| `server/jobs/helpers/memory-extraction-utils.js` | service | 366 | Retain in the Express service and adapt it to Theorem boundaries. |
| `server/jobs/helpers/scheduled-job-helper.js` | service | 111 | Retain in the Express service and adapt it to Theorem boundaries. |
| `server/jobs/run-scheduled-job.js` | service | 157 | Retain in the Express service and adapt it to Theorem boundaries. |
| `server/jobs/sync-watched-documents.js` | service | 209 | Retain in the Express service and adapt it to Theorem boundaries. |
| `server/jsconfig.json` | service | 14 | Retain in the Express service and adapt it to Theorem boundaries. |
| `server/middleware/httpLogger.js` | service | 23 | Retain in the Express service and adapt it to Theorem boundaries. |
| `server/models/agentSkillWhitelist.js` | service | 100 | Retain in the Express service and adapt it to Theorem boundaries. |
| `server/models/apiKeys.js` | service | 99 | Retain in the Express service and adapt it to Theorem boundaries. |
| `server/models/browserExtensionApiKey.js` | service | 190 | Retain in the Express service and adapt it to Theorem boundaries. |
| `server/models/cacheData.js` | service | 69 | Retain in the Express service and adapt it to Theorem boundaries. |
| `server/models/communityHub.js` | service | 213 | Retain in the Express service and adapt it to Theorem boundaries. |
| `server/models/documentSyncQueue.js` | service | 272 | Retain in the Express service and adapt it to Theorem boundaries. |
| `server/models/documentSyncRun.js` | service | 88 | Retain in the Express service and adapt it to Theorem boundaries. |
| `server/models/documents.js` | service | 364 | Retain in the Express service and adapt it to Theorem boundaries. |
| `server/models/embedChats.js` | service | 199 | Retain in the Express service and adapt it to Theorem boundaries. |
| `server/models/embedConfig.js` | service | 264 | Retain in the Express service and adapt it to Theorem boundaries. |
| `server/models/eventLogs.js` | service | 129 | Retain in the Express service and adapt it to Theorem boundaries. |
| `server/models/externalCommunicationConnector.js` | service | 110 | Retain in the Express service and adapt it to Theorem boundaries. |
| `server/models/invite.js` | service | 149 | Retain in the Express service and adapt it to Theorem boundaries. |
| `server/models/memory.js` | service | 451 | Retain in the Express service and adapt it to Theorem boundaries. |
| `server/models/mobileDevice.js` | service | 251 | Retain in the Express service and adapt it to Theorem boundaries. |
| `server/models/modelRouter.js` | service | 259 | Retain in the Express service and adapt it to Theorem boundaries. |
| `server/models/modelRouterRule.js` | service | 336 | Retain in the Express service and adapt it to Theorem boundaries. |
| `server/models/passwordRecovery.js` | service | 115 | Retain in the Express service and adapt it to Theorem boundaries. |
| `server/models/promptHistory.js` | service | 107 | Retain in the Express service and adapt it to Theorem boundaries. |
| `server/models/scheduledJob.js` | service | 499 | Retain in the Express service and adapt it to Theorem boundaries. |
| `server/models/scheduledJobRun.js` | service | 362 | Retain in the Express service and adapt it to Theorem boundaries. |
| `server/models/slashCommandsPresets.js` | service | 143 | Retain in the Express service and adapt it to Theorem boundaries. |
| `server/models/systemPromptVariables.js` | service | 375 | Retain in the Express service and adapt it to Theorem boundaries. |
| `server/models/systemSettings.js` | service | 1,214 | Retain in the Express service and adapt it to Theorem boundaries. |
| `server/models/telemetry.js` | service | 148 | Retain in the Express service and adapt it to Theorem boundaries. |
| `server/models/temporaryAuthToken.js` | service | 104 | Retain in the Express service and adapt it to Theorem boundaries. |
| `server/models/user.js` | service | 381 | Retain in the Express service and adapt it to Theorem boundaries. |
| `server/models/vectors.js` | cut | 79 | The legacy vector ingestion path is replaced by commonplace IngestPipeline. |
| `server/models/workspace.js` | service | 724 | Retain in the Express service and adapt it to Theorem boundaries. |
| `server/models/workspaceAgentInvocation.js` | service | 97 | Retain in the Express service and adapt it to Theorem boundaries. |
| `server/models/workspaceChats.js` | service | 386 | Retain in the Express service and adapt it to Theorem boundaries. |
| `server/models/workspaceParsedFiles.js` | service | 249 | Retain in the Express service and adapt it to Theorem boundaries. |
| `server/models/workspaceThread.js` | service | 151 | Retain in the Express service and adapt it to Theorem boundaries. |
| `server/models/workspaceUsers.js` | service | 103 | Retain in the Express service and adapt it to Theorem boundaries. |
| `server/models/workspacesSuggestedMessages.js` | service | 83 | Retain in the Express service and adapt it to Theorem boundaries. |
| `server/nodemon.json` | service | 5 | Retain in the Express service and adapt it to Theorem boundaries. |
| `server/package.json` | service | 127 | Retain in the Express service and adapt it to Theorem boundaries. |
| `server/prisma/migrations/20230921191814_init/migration.sql` | service | 125 | Retain in the Express service and adapt it to Theorem boundaries. |
| `server/prisma/migrations/20231101001441_init/migration.sql` | service | 2 | Retain in the Express service and adapt it to Theorem boundaries. |
| `server/prisma/migrations/20231101195421_init/migration.sql` | service | 11 | Retain in the Express service and adapt it to Theorem boundaries. |
| `server/prisma/migrations/20231129012019_add/migration.sql` | service | 2 | Retain in the Express service and adapt it to Theorem boundaries. |
| `server/prisma/migrations/20240113013409_init/migration.sql` | service | 2 | Retain in the Express service and adapt it to Theorem boundaries. |
| `server/prisma/migrations/20240118201333_init/migration.sql` | service | 2 | Retain in the Express service and adapt it to Theorem boundaries. |
| `server/prisma/migrations/20240202002020_init/migration.sql` | service | 37 | Retain in the Express service and adapt it to Theorem boundaries. |
| `server/prisma/migrations/20240206181106_init/migration.sql` | service | 13 | Retain in the Express service and adapt it to Theorem boundaries. |
| `server/prisma/migrations/20240206211916_init/migration.sql` | service | 11 | Retain in the Express service and adapt it to Theorem boundaries. |
| `server/prisma/migrations/20240208224848_init/migration.sql` | service | 24 | Retain in the Express service and adapt it to Theorem boundaries. |
| `server/prisma/migrations/20240210004405_init/migration.sql` | service | 2 | Retain in the Express service and adapt it to Theorem boundaries. |
| `server/prisma/migrations/20240216214639_init/migration.sql` | service | 2 | Retain in the Express service and adapt it to Theorem boundaries. |
| `server/prisma/migrations/20240219211018_init/migration.sql` | service | 2 | Retain in the Express service and adapt it to Theorem boundaries. |
| `server/prisma/migrations/20240301002308_init/migration.sql` | service | 2 | Retain in the Express service and adapt it to Theorem boundaries. |
| `server/prisma/migrations/20240326231053_init/migration.sql` | service | 2 | Retain in the Express service and adapt it to Theorem boundaries. |
| `server/prisma/migrations/20240405015034_init/migration.sql` | service | 2 | Retain in the Express service and adapt it to Theorem boundaries. |
| `server/prisma/migrations/20240412183346_init/migration.sql` | service | 24 | Retain in the Express service and adapt it to Theorem boundaries. |
| `server/prisma/migrations/20240425004220_init/migration.sql` | service | 30 | Retain in the Express service and adapt it to Theorem boundaries. |
| `server/prisma/migrations/20240430230707_init/migration.sql` | service | 2 | Retain in the Express service and adapt it to Theorem boundaries. |
| `server/prisma/migrations/20240510032311_init/migration.sql` | service | 15 | Retain in the Express service and adapt it to Theorem boundaries. |
| `server/prisma/migrations/20240618224346_init/migration.sql` | service | 26 | Retain in the Express service and adapt it to Theorem boundaries. |
| `server/prisma/migrations/20240821215625_init/migration.sql` | service | 2 | Retain in the Express service and adapt it to Theorem boundaries. |
| `server/prisma/migrations/20240824005054_init/migration.sql` | service | 15 | Retain in the Express service and adapt it to Theorem boundaries. |
| `server/prisma/migrations/20241003192954_init/migration.sql` | service | 2 | Retain in the Express service and adapt it to Theorem boundaries. |
| `server/prisma/migrations/20241029203722_init/migration.sql` | service | 12 | Retain in the Express service and adapt it to Theorem boundaries. |
| `server/prisma/migrations/20241029233509_init/migration.sql` | service | 5 | Retain in the Express service and adapt it to Theorem boundaries. |
| `server/prisma/migrations/20250102204948_init/migration.sql` | service | 2 | Retain in the Express service and adapt it to Theorem boundaries. |
| `server/prisma/migrations/20250226005538_init/migration.sql` | service | 2 | Retain in the Express service and adapt it to Theorem boundaries. |
| `server/prisma/migrations/20250318154720_init/migration.sql` | service | 18 | Retain in the Express service and adapt it to Theorem boundaries. |
| `server/prisma/migrations/20250506214129_init/migration.sql` | service | 13 | Retain in the Express service and adapt it to Theorem boundaries. |
| `server/prisma/migrations/20250709230835_init/migration.sql` | service | 2 | Retain in the Express service and adapt it to Theorem boundaries. |
| `server/prisma/migrations/20250725194841_init/migration.sql` | service | 17 | Retain in the Express service and adapt it to Theorem boundaries. |
| `server/prisma/migrations/20250808171557_init/migration.sql` | service | 23 | Retain in the Express service and adapt it to Theorem boundaries. |
| `server/prisma/migrations/20260130040204_init/migration.sql` | service | 2 | Retain in the Express service and adapt it to Theorem boundaries. |
| `server/prisma/migrations/20260313192859_init/migration.sql` | service | 10 | Retain in the Express service and adapt it to Theorem boundaries. |
| `server/prisma/migrations/20260319202916_init/migration.sql` | service | 12 | Retain in the Express service and adapt it to Theorem boundaries. |
| `server/prisma/migrations/20260406120000_init/migration.sql` | service | 2 | Retain in the Express service and adapt it to Theorem boundaries. |
| `server/prisma/migrations/20260423191158_init/migration.sql` | service | 29 | Retain in the Express service and adapt it to Theorem boundaries. |
| `server/prisma/migrations/20260424013043_init/migration.sql` | service | 22 | Retain in the Express service and adapt it to Theorem boundaries. |
| `server/prisma/migrations/20260520160208_init/migration.sql` | service | 46 | Retain in the Express service and adapt it to Theorem boundaries. |
| `server/prisma/migrations/migration_lock.toml` | service | 2 | Retain in the Express service and adapt it to Theorem boundaries. |
| `server/prisma/schema.prisma` | service | 487 | Retain in the Express service and adapt it to Theorem boundaries. |
| `server/prisma/seed.js` | service | 31 | Retain in the Express service and adapt it to Theorem boundaries. |
| `server/storage/README.md` | service | 23 | Retain in the Express service and adapt it to Theorem boundaries. |
| `server/storage/assets/anything-llm-invert.png` | service | 25 | Retain in the Express service and adapt it to Theorem boundaries. |
| `server/storage/assets/anything-llm.png` | service | 18 | Retain in the Express service and adapt it to Theorem boundaries. |
| `server/storage/documents/DOCUMENTS.md` | service | 10 | Retain in the Express service and adapt it to Theorem boundaries. |
| `server/storage/models/.gitignore` | cut | 16 | The upstream local browser ML model store is not part of the service. |
| `server/storage/models/README.md` | cut | 44 | The upstream local browser ML model store is not part of the service. |
| `server/storage/models/downloaded/.placeholder` | cut | 0 | The upstream local browser ML model store is not part of the service. |
| `server/swagger/dark-swagger.css` | service | 1,721 | Retain in the Express service and adapt it to Theorem boundaries. |
| `server/swagger/index.css` | service | 2 | Retain in the Express service and adapt it to Theorem boundaries. |
| `server/swagger/index.js` | service | 28 | Retain in the Express service and adapt it to Theorem boundaries. |
| `server/swagger/init.js` | service | 79 | Retain in the Express service and adapt it to Theorem boundaries. |
| `server/swagger/openapi.json` | service | 4,216 | Retain in the Express service and adapt it to Theorem boundaries. |
| `server/swagger/utils.js` | service | 56 | Retain in the Express service and adapt it to Theorem boundaries. |
| `server/utils/AiProviders/anthropic/index.js` | cut | 408 | The upstream LLM connector is not routed because the Harness owns execution. |
| `server/utils/AiProviders/apipie/index.js` | cut | 386 | The upstream LLM connector is not routed because the Harness owns execution. |
| `server/utils/AiProviders/azureOpenAi/index.js` | cut | 232 | The upstream LLM connector is not routed because the Harness owns execution. |
| `server/utils/AiProviders/bedrock/index.js` | cut | 271 | The upstream LLM connector is not routed because the Harness owns execution. |
| `server/utils/AiProviders/cerebras/index.js` | cut | 314 | The upstream LLM connector is not routed because the Harness owns execution. |
| `server/utils/AiProviders/cohere/index.js` | cut | 198 | The upstream LLM connector is not routed because the Harness owns execution. |
| `server/utils/AiProviders/cometapi/constants.js` | cut | 39 | The upstream LLM connector is not routed because the Harness owns execution. |
| `server/utils/AiProviders/cometapi/index.js` | cut | 445 | The upstream LLM connector is not routed because the Harness owns execution. |
| `server/utils/AiProviders/deepseek/index.js` | cut | 180 | The upstream LLM connector is not routed because the Harness owns execution. |
| `server/utils/AiProviders/dockerModelRunner/index.js` | cut | 520 | The upstream LLM connector is not routed because the Harness owns execution. |
| `server/utils/AiProviders/fireworksAi/index.js` | cut | 273 | The upstream LLM connector is not routed because the Harness owns execution. |
| `server/utils/AiProviders/foundry/index.js` | cut | 475 | The upstream LLM connector is not routed because the Harness owns execution. |
| `server/utils/AiProviders/gemini/defaultModels.js` | cut | 74 | The upstream LLM connector is not routed because the Harness owns execution. |
| `server/utils/AiProviders/gemini/index.js` | cut | 457 | The upstream LLM connector is not routed because the Harness owns execution. |
| `server/utils/AiProviders/gemini/syncStaticLists.mjs` | cut | 48 | The upstream LLM connector is not routed because the Harness owns execution. |
| `server/utils/AiProviders/genericOpenAi/index.js` | cut | 493 | The upstream LLM connector is not routed because the Harness owns execution. |
| `server/utils/AiProviders/giteeai/index.js` | cut | 245 | The upstream LLM connector is not routed because the Harness owns execution. |
| `server/utils/AiProviders/groq/index.js` | cut | 257 | The upstream LLM connector is not routed because the Harness owns execution. |
| `server/utils/AiProviders/koboldCPP/index.js` | cut | 264 | The upstream LLM connector is not routed because the Harness owns execution. |
| `server/utils/AiProviders/lemonade/index.js` | cut | 465 | The upstream LLM connector is not routed because the Harness owns execution. |
| `server/utils/AiProviders/liteLLM/index.js` | cut | 201 | The upstream LLM connector is not routed because the Harness owns execution. |
| `server/utils/AiProviders/lmStudio/index.js` | cut | 383 | The upstream LLM connector is not routed because the Harness owns execution. |
| `server/utils/AiProviders/localAi/index.js` | cut | 198 | The upstream LLM connector is not routed because the Harness owns execution. |
| `server/utils/AiProviders/minimax/index.js` | cut | 165 | The upstream LLM connector is not routed because the Harness owns execution. |
| `server/utils/AiProviders/mistral/index.js` | cut | 191 | The upstream LLM connector is not routed because the Harness owns execution. |
| `server/utils/AiProviders/modelMap/index.js` | cut | 213 | The upstream LLM connector is not routed because the Harness owns execution. |
| `server/utils/AiProviders/modelMap/legacy.js` | cut | 162 | The upstream LLM connector is not routed because the Harness owns execution. |
| `server/utils/AiProviders/modelRouter/index.js` | cut | 170 | The upstream LLM connector is not routed because the Harness owns execution. |
| `server/utils/AiProviders/moonshotAi/index.js` | cut | 176 | The upstream LLM connector is not routed because the Harness owns execution. |
| `server/utils/AiProviders/novita/index.js` | cut | 460 | The upstream LLM connector is not routed because the Harness owns execution. |
| `server/utils/AiProviders/nvidiaNim/index.js` | cut | 253 | The upstream LLM connector is not routed because the Harness owns execution. |
| `server/utils/AiProviders/ollama/index.js` | cut | 516 | The upstream LLM connector is not routed because the Harness owns execution. |
| `server/utils/AiProviders/omlx/index.js` | cut | 363 | The upstream LLM connector is not routed because the Harness owns execution. |
| `server/utils/AiProviders/openAi/index.js` | cut | 302 | The upstream LLM connector is not routed because the Harness owns execution. |
| `server/utils/AiProviders/openRouter/index.js` | cut | 567 | The upstream LLM connector is not routed because the Harness owns execution. |
| `server/utils/AiProviders/perplexity/index.js` | cut | 304 | The upstream LLM connector is not routed because the Harness owns execution. |
| `server/utils/AiProviders/perplexity/models.js` | cut | 24 | The upstream LLM connector is not routed because the Harness owns execution. |
| `server/utils/AiProviders/perplexity/scripts/.gitignore` | cut | 0 | The upstream LLM connector is not routed because the Harness owns execution. |
| `server/utils/AiProviders/perplexity/scripts/chat_models.txt` | cut | 5 | The upstream LLM connector is not routed because the Harness owns execution. |
| `server/utils/AiProviders/perplexity/scripts/parse.mjs` | cut | 49 | The upstream LLM connector is not routed because the Harness owns execution. |
| `server/utils/AiProviders/ppio/index.js` | cut | 274 | The upstream LLM connector is not routed because the Harness owns execution. |
| `server/utils/AiProviders/privatemode/index.js` | cut | 220 | The upstream LLM connector is not routed because the Harness owns execution. |
| `server/utils/AiProviders/sambanova/index.js` | cut | 273 | The upstream LLM connector is not routed because the Harness owns execution. |
| `server/utils/AiProviders/textGenWebUI/index.js` | cut | 197 | The upstream LLM connector is not routed because the Harness owns execution. |
| `server/utils/AiProviders/togetherAi/index.js` | cut | 263 | The upstream LLM connector is not routed because the Harness owns execution. |
| `server/utils/AiProviders/xai/index.js` | cut | 200 | The upstream LLM connector is not routed because the Harness owns execution. |
| `server/utils/AiProviders/zai/index.js` | cut | 184 | The upstream LLM connector is not routed because the Harness owns execution. |
| `server/utils/BackgroundWorkers/index.js` | service | 432 | Retain in the Express service and adapt it to Theorem boundaries. |
| `server/utils/DocumentManager/index.js` | service | 72 | Retain in the Express service and adapt it to Theorem boundaries. |
| `server/utils/EmbeddingEngines/azureOpenAi/index.js` | cut | 115 | The upstream embedding connector is removed; IngestPipeline owns embedding. |
| `server/utils/EmbeddingEngines/cohere/index.js` | cut | 101 | The upstream embedding connector is removed; IngestPipeline owns embedding. |
| `server/utils/EmbeddingEngines/gemini/index.js` | cut | 136 | The upstream embedding connector is removed; IngestPipeline owns embedding. |
| `server/utils/EmbeddingEngines/genericOpenAi/index.js` | cut | 171 | The upstream embedding connector is removed; IngestPipeline owns embedding. |
| `server/utils/EmbeddingEngines/lemonade/index.js` | cut | 99 | The upstream embedding connector is removed; IngestPipeline owns embedding. |
| `server/utils/EmbeddingEngines/liteLLM/index.js` | cut | 102 | The upstream embedding connector is removed; IngestPipeline owns embedding. |
| `server/utils/EmbeddingEngines/lmstudio/index.js` | cut | 122 | The upstream embedding connector is removed; IngestPipeline owns embedding. |
| `server/utils/EmbeddingEngines/localAi/index.js` | cut | 126 | The upstream embedding connector is removed; IngestPipeline owns embedding. |
| `server/utils/EmbeddingEngines/mistral/index.js` | cut | 41 | The upstream embedding connector is removed; IngestPipeline owns embedding. |
| `server/utils/EmbeddingEngines/native/constants.js` | cut | 63 | The browser ML embedding path is removed; IngestPipeline owns embedding. |
| `server/utils/EmbeddingEngines/native/index.js` | cut | 310 | The browser ML embedding path is removed; IngestPipeline owns embedding. |
| `server/utils/EmbeddingEngines/ollama/index.js` | cut | 140 | The upstream embedding connector is removed; IngestPipeline owns embedding. |
| `server/utils/EmbeddingEngines/openAi/index.js` | cut | 102 | The upstream embedding connector is removed; IngestPipeline owns embedding. |
| `server/utils/EmbeddingEngines/openRouter/index.js` | cut | 131 | The upstream embedding connector is removed; IngestPipeline owns embedding. |
| `server/utils/EmbeddingEngines/voyageAi/index.js` | cut | 71 | The upstream embedding connector is removed; IngestPipeline owns embedding. |
| `server/utils/EmbeddingRerankers/native/index.js` | cut | 257 | The browser ML reranker is removed with the onnxruntime-web path. |
| `server/utils/EmbeddingWorkerManager.js` | cut | 202 | The legacy vector ingestion path is replaced by commonplace IngestPipeline. |
| `server/utils/EncryptionManager/index.js` | service | 85 | Retain in the Express service and adapt it to Theorem boundaries. |
| `server/utils/MCP/hypervisor/index.js` | service | 553 | Retain in the Express service and adapt it to Theorem boundaries. |
| `server/utils/MCP/index.js` | service | 285 | Retain in the Express service and adapt it to Theorem boundaries. |
| `server/utils/PasswordRecovery/index.js` | service | 107 | Retain in the Express service and adapt it to Theorem boundaries. |
| `server/utils/PushNotifications/index.js` | service | 228 | Retain in the Express service and adapt it to Theorem boundaries. |
| `server/utils/SpeechToText/deepgram/index.js` | cut | 79 | The upstream audio provider tier is removed with provider selection. |
| `server/utils/SpeechToText/groq/index.js` | cut | 35 | The upstream audio provider tier is removed with provider selection. |
| `server/utils/SpeechToText/helpers.js` | cut | 36 | The upstream audio provider tier is removed with provider selection. |
| `server/utils/SpeechToText/index.js` | cut | 26 | The upstream audio provider tier is removed with provider selection. |
| `server/utils/SpeechToText/lemonade/index.js` | cut | 54 | The upstream audio provider tier is removed with provider selection. |
| `server/utils/SpeechToText/openAi/index.js` | cut | 28 | The upstream audio provider tier is removed with provider selection. |
| `server/utils/SpeechToText/openAiGeneric/index.js` | cut | 58 | The upstream audio provider tier is removed with provider selection. |
| `server/utils/TextSplitter/index.js` | service | 206 | Retain in the Express service and adapt it to Theorem boundaries. |
| `server/utils/TextToSpeech/audioFormat.js` | cut | 50 | The upstream audio provider tier is removed with provider selection. |
| `server/utils/TextToSpeech/elevenLabs/index.js` | cut | 54 | The upstream audio provider tier is removed with provider selection. |
| `server/utils/TextToSpeech/index.js` | cut | 21 | The upstream audio provider tier is removed with provider selection. |
| `server/utils/TextToSpeech/kokoro/index.js` | cut | 50 | The upstream audio provider tier is removed with provider selection. |
| `server/utils/TextToSpeech/openAi/index.js` | cut | 29 | The upstream audio provider tier is removed with provider selection. |
| `server/utils/TextToSpeech/openAiGeneric/index.js` | cut | 58 | The upstream audio provider tier is removed with provider selection. |
| `server/utils/agentFlows/executor.js` | service | 235 | Retain in the Express service and adapt it to Theorem boundaries. |
| `server/utils/agentFlows/executors/api-call.js` | service | 60 | Retain in the Express service and adapt it to Theorem boundaries. |
| `server/utils/agentFlows/executors/llm-instruction.js` | service | 47 | Retain in the Express service and adapt it to Theorem boundaries. |
| `server/utils/agentFlows/executors/web-scraping.js` | service | 111 | Retain in the Express service and adapt it to Theorem boundaries. |
| `server/utils/agentFlows/flowTypes.js` | service | 85 | Retain in the Express service and adapt it to Theorem boundaries. |
| `server/utils/agentFlows/index.js` | service | 288 | Retain in the Express service and adapt it to Theorem boundaries. |
| `server/utils/agents/aibitat/error.js` | cut | 18 | The Harness replaces the aibitat executor, plugins, providers, and memory loop. |
| `server/utils/agents/aibitat/example/.gitignore` | cut | 0 | The Harness replaces the aibitat executor, plugins, providers, and memory loop. |
| `server/utils/agents/aibitat/example/beginner-chat.js` | cut | 56 | The Harness replaces the aibitat executor, plugins, providers, and memory loop. |
| `server/utils/agents/aibitat/example/blog-post-coding.js` | cut | 55 | The Harness replaces the aibitat executor, plugins, providers, and memory loop. |
| `server/utils/agents/aibitat/example/websocket/index.html` | cut | 67 | The Harness replaces the aibitat executor, plugins, providers, and memory loop. |
| `server/utils/agents/aibitat/example/websocket/websock-branding-collab.js` | cut | 100 | The Harness replaces the aibitat executor, plugins, providers, and memory loop. |
| `server/utils/agents/aibitat/example/websocket/websock-multi-turn-chat.js` | cut | 91 | The Harness replaces the aibitat executor, plugins, providers, and memory loop. |
| `server/utils/agents/aibitat/index.js` | cut | 1,472 | The Harness replaces the aibitat executor, plugins, providers, and memory loop. |
| `server/utils/agents/aibitat/plugins/chat-history.js` | cut | 210 | The Harness replaces the aibitat executor, plugins, providers, and memory loop. |
| `server/utils/agents/aibitat/plugins/cli.js` | cut | 134 | The Harness replaces the aibitat executor, plugins, providers, and memory loop. |
| `server/utils/agents/aibitat/plugins/create-files/assets/anything-llm-invert.png` | cut | 25 | The Harness replaces the aibitat executor, plugins, providers, and memory loop. |
| `server/utils/agents/aibitat/plugins/create-files/assets/anything-llm.png` | cut | 18 | The Harness replaces the aibitat executor, plugins, providers, and memory loop. |
| `server/utils/agents/aibitat/plugins/create-files/docx/create-docx-file.js` | cut | 308 | The Harness replaces the aibitat executor, plugins, providers, and memory loop. |
| `server/utils/agents/aibitat/plugins/create-files/docx/test-themes.js` | cut | 298 | The Harness replaces the aibitat executor, plugins, providers, and memory loop. |
| `server/utils/agents/aibitat/plugins/create-files/docx/utils.js` | cut | 1,095 | The Harness replaces the aibitat executor, plugins, providers, and memory loop. |
| `server/utils/agents/aibitat/plugins/create-files/index.js` | cut | 23 | The Harness replaces the aibitat executor, plugins, providers, and memory loop. |
| `server/utils/agents/aibitat/plugins/create-files/lib.js` | cut | 333 | The Harness replaces the aibitat executor, plugins, providers, and memory loop. |
| `server/utils/agents/aibitat/plugins/create-files/pdf/create-pdf-file.js` | cut | 138 | The Harness replaces the aibitat executor, plugins, providers, and memory loop. |
| `server/utils/agents/aibitat/plugins/create-files/pdf/utils.js` | cut | 70 | The Harness replaces the aibitat executor, plugins, providers, and memory loop. |
| `server/utils/agents/aibitat/plugins/create-files/pptx/create-presentation.js` | cut | 353 | The Harness replaces the aibitat executor, plugins, providers, and memory loop. |
| `server/utils/agents/aibitat/plugins/create-files/pptx/section-agent.js` | cut | 257 | The Harness replaces the aibitat executor, plugins, providers, and memory loop. |
| `server/utils/agents/aibitat/plugins/create-files/pptx/test-themes.js` | cut | 143 | The Harness replaces the aibitat executor, plugins, providers, and memory loop. |
| `server/utils/agents/aibitat/plugins/create-files/pptx/themes.js` | cut | 181 | The Harness replaces the aibitat executor, plugins, providers, and memory loop. |
| `server/utils/agents/aibitat/plugins/create-files/pptx/utils.js` | cut | 378 | The Harness replaces the aibitat executor, plugins, providers, and memory loop. |
| `server/utils/agents/aibitat/plugins/create-files/text/create-text-file.js` | cut | 158 | The Harness replaces the aibitat executor, plugins, providers, and memory loop. |
| `server/utils/agents/aibitat/plugins/create-files/xlsx/create-excel-file.js` | cut | 367 | The Harness replaces the aibitat executor, plugins, providers, and memory loop. |
| `server/utils/agents/aibitat/plugins/create-files/xlsx/utils.js` | cut | 333 | The Harness replaces the aibitat executor, plugins, providers, and memory loop. |
| `server/utils/agents/aibitat/plugins/create-scheduled-job/cronUtils.js` | cut | 157 | The Harness replaces the aibitat executor, plugins, providers, and memory loop. |
| `server/utils/agents/aibitat/plugins/create-scheduled-job/index.js` | cut | 226 | The Harness replaces the aibitat executor, plugins, providers, and memory loop. |
| `server/utils/agents/aibitat/plugins/file-history.js` | cut | 37 | The Harness replaces the aibitat executor, plugins, providers, and memory loop. |
| `server/utils/agents/aibitat/plugins/filesystem/copy-file.js` | cut | 127 | The Harness replaces the aibitat executor, plugins, providers, and memory loop. |
| `server/utils/agents/aibitat/plugins/filesystem/create-directory.js` | cut | 84 | The Harness replaces the aibitat executor, plugins, providers, and memory loop. |
| `server/utils/agents/aibitat/plugins/filesystem/edit-file.js` | cut | 133 | The Harness replaces the aibitat executor, plugins, providers, and memory loop. |
| `server/utils/agents/aibitat/plugins/filesystem/get-file-info.js` | cut | 75 | The Harness replaces the aibitat executor, plugins, providers, and memory loop. |
| `server/utils/agents/aibitat/plugins/filesystem/index.js` | cut | 33 | The Harness replaces the aibitat executor, plugins, providers, and memory loop. |
| `server/utils/agents/aibitat/plugins/filesystem/lib.js` | cut | 787 | The Harness replaces the aibitat executor, plugins, providers, and memory loop. |
| `server/utils/agents/aibitat/plugins/filesystem/list-directory.js` | cut | 175 | The Harness replaces the aibitat executor, plugins, providers, and memory loop. |
| `server/utils/agents/aibitat/plugins/filesystem/move-file.js` | cut | 95 | The Harness replaces the aibitat executor, plugins, providers, and memory loop. |
| `server/utils/agents/aibitat/plugins/filesystem/read-multiple-files.js` | cut | 157 | The Harness replaces the aibitat executor, plugins, providers, and memory loop. |
| `server/utils/agents/aibitat/plugins/filesystem/read-text-file.js` | cut | 142 | The Harness replaces the aibitat executor, plugins, providers, and memory loop. |
| `server/utils/agents/aibitat/plugins/filesystem/search-files.js` | cut | 469 | The Harness replaces the aibitat executor, plugins, providers, and memory loop. |
| `server/utils/agents/aibitat/plugins/filesystem/write-text-file.js` | cut | 90 | The Harness replaces the aibitat executor, plugins, providers, and memory loop. |
| `server/utils/agents/aibitat/plugins/gmail/account/gmail-get-mailbox-stats.js` | cut | 75 | The Harness replaces the aibitat executor, plugins, providers, and memory loop. |
| `server/utils/agents/aibitat/plugins/gmail/drafts/gmail-create-draft-reply.js` | cut | 220 | The Harness replaces the aibitat executor, plugins, providers, and memory loop. |
| `server/utils/agents/aibitat/plugins/gmail/drafts/gmail-create-draft.js` | cut | 217 | The Harness replaces the aibitat executor, plugins, providers, and memory loop. |
| `server/utils/agents/aibitat/plugins/gmail/drafts/gmail-delete-draft.js` | cut | 87 | The Harness replaces the aibitat executor, plugins, providers, and memory loop. |
| `server/utils/agents/aibitat/plugins/gmail/drafts/gmail-get-draft.js` | cut | 84 | The Harness replaces the aibitat executor, plugins, providers, and memory loop. |
| `server/utils/agents/aibitat/plugins/gmail/drafts/gmail-list-drafts.js` | cut | 96 | The Harness replaces the aibitat executor, plugins, providers, and memory loop. |
| `server/utils/agents/aibitat/plugins/gmail/drafts/gmail-send-draft.js` | cut | 94 | The Harness replaces the aibitat executor, plugins, providers, and memory loop. |
| `server/utils/agents/aibitat/plugins/gmail/drafts/gmail-update-draft.js` | cut | 217 | The Harness replaces the aibitat executor, plugins, providers, and memory loop. |
| `server/utils/agents/aibitat/plugins/gmail/index.js` | cut | 73 | The Harness replaces the aibitat executor, plugins, providers, and memory loop. |
| `server/utils/agents/aibitat/plugins/gmail/lib.js` | cut | 573 | The Harness replaces the aibitat executor, plugins, providers, and memory loop. |
| `server/utils/agents/aibitat/plugins/gmail/search/gmail-get-inbox.js` | cut | 104 | The Harness replaces the aibitat executor, plugins, providers, and memory loop. |
| `server/utils/agents/aibitat/plugins/gmail/search/gmail-read-thread.js` | cut | 122 | The Harness replaces the aibitat executor, plugins, providers, and memory loop. |
| `server/utils/agents/aibitat/plugins/gmail/search/gmail-search.js` | cut | 121 | The Harness replaces the aibitat executor, plugins, providers, and memory loop. |
| `server/utils/agents/aibitat/plugins/gmail/send/gmail-reply-to-thread.js` | cut | 238 | The Harness replaces the aibitat executor, plugins, providers, and memory loop. |
| `server/utils/agents/aibitat/plugins/gmail/send/gmail-send-email.js` | cut | 242 | The Harness replaces the aibitat executor, plugins, providers, and memory loop. |
| `server/utils/agents/aibitat/plugins/gmail/threads/gmail-mark-read.js` | cut | 87 | The Harness replaces the aibitat executor, plugins, providers, and memory loop. |
| `server/utils/agents/aibitat/plugins/gmail/threads/gmail-mark-unread.js` | cut | 87 | The Harness replaces the aibitat executor, plugins, providers, and memory loop. |
| `server/utils/agents/aibitat/plugins/gmail/threads/gmail-move-to-archive.js` | cut | 89 | The Harness replaces the aibitat executor, plugins, providers, and memory loop. |
| `server/utils/agents/aibitat/plugins/gmail/threads/gmail-move-to-inbox.js` | cut | 89 | The Harness replaces the aibitat executor, plugins, providers, and memory loop. |
| `server/utils/agents/aibitat/plugins/gmail/threads/gmail-move-to-trash.js` | cut | 89 | The Harness replaces the aibitat executor, plugins, providers, and memory loop. |
| `server/utils/agents/aibitat/plugins/google-calendar/calendars/gcal-get-calendar.js` | cut | 79 | The Harness replaces the aibitat executor, plugins, providers, and memory loop. |
| `server/utils/agents/aibitat/plugins/google-calendar/calendars/gcal-list-calendars.js` | cut | 82 | The Harness replaces the aibitat executor, plugins, providers, and memory loop. |
| `server/utils/agents/aibitat/plugins/google-calendar/events/gcal-create-event.js` | cut | 233 | The Harness replaces the aibitat executor, plugins, providers, and memory loop. |
| `server/utils/agents/aibitat/plugins/google-calendar/events/gcal-get-event.js` | cut | 116 | The Harness replaces the aibitat executor, plugins, providers, and memory loop. |
| `server/utils/agents/aibitat/plugins/google-calendar/events/gcal-get-events-for-day.js` | cut | 117 | The Harness replaces the aibitat executor, plugins, providers, and memory loop. |
| `server/utils/agents/aibitat/plugins/google-calendar/events/gcal-get-events.js` | cut | 159 | The Harness replaces the aibitat executor, plugins, providers, and memory loop. |
| `server/utils/agents/aibitat/plugins/google-calendar/events/gcal-get-upcoming-events.js` | cut | 249 | The Harness replaces the aibitat executor, plugins, providers, and memory loop. |
| `server/utils/agents/aibitat/plugins/google-calendar/events/gcal-quick-add.js` | cut | 114 | The Harness replaces the aibitat executor, plugins, providers, and memory loop. |
| `server/utils/agents/aibitat/plugins/google-calendar/events/gcal-set-my-status.js` | cut | 125 | The Harness replaces the aibitat executor, plugins, providers, and memory loop. |
| `server/utils/agents/aibitat/plugins/google-calendar/events/gcal-update-event.js` | cut | 173 | The Harness replaces the aibitat executor, plugins, providers, and memory loop. |
| `server/utils/agents/aibitat/plugins/google-calendar/index.js` | cut | 40 | The Harness replaces the aibitat executor, plugins, providers, and memory loop. |
| `server/utils/agents/aibitat/plugins/google-calendar/lib.js` | cut | 288 | The Harness replaces the aibitat executor, plugins, providers, and memory loop. |
| `server/utils/agents/aibitat/plugins/http-socket.js` | cut | 251 | The Harness replaces the aibitat executor, plugins, providers, and memory loop. |
| `server/utils/agents/aibitat/plugins/index.js` | cut | 50 | The Harness replaces the aibitat executor, plugins, providers, and memory loop. |
| `server/utils/agents/aibitat/plugins/memory.js` | cut | 169 | The Harness replaces the aibitat executor, plugins, providers, and memory loop. |
| `server/utils/agents/aibitat/plugins/outlook/account/outlook-get-mailbox-stats.js` | cut | 78 | The Harness replaces the aibitat executor, plugins, providers, and memory loop. |
| `server/utils/agents/aibitat/plugins/outlook/drafts/outlook-create-draft.js` | cut | 232 | The Harness replaces the aibitat executor, plugins, providers, and memory loop. |
| `server/utils/agents/aibitat/plugins/outlook/drafts/outlook-delete-draft.js` | cut | 86 | The Harness replaces the aibitat executor, plugins, providers, and memory loop. |
| `server/utils/agents/aibitat/plugins/outlook/drafts/outlook-list-drafts.js` | cut | 80 | The Harness replaces the aibitat executor, plugins, providers, and memory loop. |
| `server/utils/agents/aibitat/plugins/outlook/drafts/outlook-send-draft.js` | cut | 82 | The Harness replaces the aibitat executor, plugins, providers, and memory loop. |
| `server/utils/agents/aibitat/plugins/outlook/drafts/outlook-update-draft.js` | cut | 132 | The Harness replaces the aibitat executor, plugins, providers, and memory loop. |
| `server/utils/agents/aibitat/plugins/outlook/index.js` | cut | 45 | The Harness replaces the aibitat executor, plugins, providers, and memory loop. |
| `server/utils/agents/aibitat/plugins/outlook/lib.js` | cut | 1,412 | The Harness replaces the aibitat executor, plugins, providers, and memory loop. |
| `server/utils/agents/aibitat/plugins/outlook/search/outlook-get-inbox.js` | cut | 75 | The Harness replaces the aibitat executor, plugins, providers, and memory loop. |
| `server/utils/agents/aibitat/plugins/outlook/search/outlook-read-thread.js` | cut | 131 | The Harness replaces the aibitat executor, plugins, providers, and memory loop. |
| `server/utils/agents/aibitat/plugins/outlook/search/outlook-search.js` | cut | 101 | The Harness replaces the aibitat executor, plugins, providers, and memory loop. |
| `server/utils/agents/aibitat/plugins/outlook/send/outlook-send-email.js` | cut | 222 | The Harness replaces the aibitat executor, plugins, providers, and memory loop. |
| `server/utils/agents/aibitat/plugins/rechart.js` | cut | 114 | The Harness replaces the aibitat executor, plugins, providers, and memory loop. |
| `server/utils/agents/aibitat/plugins/request-user-input.js` | cut | 265 | The Harness replaces the aibitat executor, plugins, providers, and memory loop. |
| `server/utils/agents/aibitat/plugins/router-classifier.js` | cut | 122 | The Harness replaces the aibitat executor, plugins, providers, and memory loop. |
| `server/utils/agents/aibitat/plugins/sql-agent/SQLConnectors/MSSQL.js` | cut | 114 | The Harness replaces the aibitat executor, plugins, providers, and memory loop. |
| `server/utils/agents/aibitat/plugins/sql-agent/SQLConnectors/MySQL.js` | cut | 83 | The Harness replaces the aibitat executor, plugins, providers, and memory loop. |
| `server/utils/agents/aibitat/plugins/sql-agent/SQLConnectors/Postgresql.js` | cut | 75 | The Harness replaces the aibitat executor, plugins, providers, and memory loop. |
| `server/utils/agents/aibitat/plugins/sql-agent/SQLConnectors/index.js` | cut | 80 | The Harness replaces the aibitat executor, plugins, providers, and memory loop. |
| `server/utils/agents/aibitat/plugins/sql-agent/SQLConnectors/utils.js` | cut | 182 | The Harness replaces the aibitat executor, plugins, providers, and memory loop. |
| `server/utils/agents/aibitat/plugins/sql-agent/get-table-schema.js` | cut | 115 | The Harness replaces the aibitat executor, plugins, providers, and memory loop. |
| `server/utils/agents/aibitat/plugins/sql-agent/index.js` | cut | 21 | The Harness replaces the aibitat executor, plugins, providers, and memory loop. |
| `server/utils/agents/aibitat/plugins/sql-agent/list-database.js` | cut | 49 | The Harness replaces the aibitat executor, plugins, providers, and memory loop. |
| `server/utils/agents/aibitat/plugins/sql-agent/list-table.js` | cut | 105 | The Harness replaces the aibitat executor, plugins, providers, and memory loop. |
| `server/utils/agents/aibitat/plugins/sql-agent/query.js` | cut | 101 | The Harness replaces the aibitat executor, plugins, providers, and memory loop. |
| `server/utils/agents/aibitat/plugins/summarize.js` | cut | 196 | The Harness replaces the aibitat executor, plugins, providers, and memory loop. |
| `server/utils/agents/aibitat/plugins/web-browsing.js` | cut | 1,343 | The Harness replaces the aibitat executor, plugins, providers, and memory loop. |
| `server/utils/agents/aibitat/plugins/web-scraping.js` | cut | 165 | The Harness replaces the aibitat executor, plugins, providers, and memory loop. |
| `server/utils/agents/aibitat/plugins/websocket.js` | cut | 410 | The Harness replaces the aibitat executor, plugins, providers, and memory loop. |
| `server/utils/agents/aibitat/providers/ai-provider.js` | cut | 739 | The Harness replaces the aibitat executor, plugins, providers, and memory loop. |
| `server/utils/agents/aibitat/providers/anthropic.js` | cut | 495 | The Harness replaces the aibitat executor, plugins, providers, and memory loop. |
| `server/utils/agents/aibitat/providers/apipie.js` | cut | 153 | The Harness replaces the aibitat executor, plugins, providers, and memory loop. |
| `server/utils/agents/aibitat/providers/azure.js` | cut | 114 | The Harness replaces the aibitat executor, plugins, providers, and memory loop. |
| `server/utils/agents/aibitat/providers/bedrock.js` | cut | 157 | The Harness replaces the aibitat executor, plugins, providers, and memory loop. |
| `server/utils/agents/aibitat/providers/cerebras.js` | cut | 209 | The Harness replaces the aibitat executor, plugins, providers, and memory loop. |
| `server/utils/agents/aibitat/providers/cohere.js` | cut | 169 | The Harness replaces the aibitat executor, plugins, providers, and memory loop. |
| `server/utils/agents/aibitat/providers/cometapi.js` | cut | 158 | The Harness replaces the aibitat executor, plugins, providers, and memory loop. |
| `server/utils/agents/aibitat/providers/deepseek.js` | cut | 214 | The Harness replaces the aibitat executor, plugins, providers, and memory loop. |
| `server/utils/agents/aibitat/providers/dockerModelRunner.js` | cut | 190 | The Harness replaces the aibitat executor, plugins, providers, and memory loop. |
| `server/utils/agents/aibitat/providers/fireworksai.js` | cut | 154 | The Harness replaces the aibitat executor, plugins, providers, and memory loop. |
| `server/utils/agents/aibitat/providers/foundry.js` | cut | 113 | The Harness replaces the aibitat executor, plugins, providers, and memory loop. |
| `server/utils/agents/aibitat/providers/gemini.js` | cut | 451 | The Harness replaces the aibitat executor, plugins, providers, and memory loop. |
| `server/utils/agents/aibitat/providers/genericOpenAi.js` | cut | 181 | The Harness replaces the aibitat executor, plugins, providers, and memory loop. |
| `server/utils/agents/aibitat/providers/giteeai.js` | cut | 148 | The Harness replaces the aibitat executor, plugins, providers, and memory loop. |
| `server/utils/agents/aibitat/providers/groq.js` | cut | 165 | The Harness replaces the aibitat executor, plugins, providers, and memory loop. |
| `server/utils/agents/aibitat/providers/helpers/classes.js` | cut | 16 | The Harness replaces the aibitat executor, plugins, providers, and memory loop. |
| `server/utils/agents/aibitat/providers/helpers/dereferenceSchema.js` | cut | 65 | The Harness replaces the aibitat executor, plugins, providers, and memory loop. |
| `server/utils/agents/aibitat/providers/helpers/tooled.js` | cut | 384 | The Harness replaces the aibitat executor, plugins, providers, and memory loop. |
| `server/utils/agents/aibitat/providers/helpers/untooled.js` | cut | 437 | The Harness replaces the aibitat executor, plugins, providers, and memory loop. |
| `server/utils/agents/aibitat/providers/index.js` | cut | 77 | The Harness replaces the aibitat executor, plugins, providers, and memory loop. |
| `server/utils/agents/aibitat/providers/koboldcpp.js` | cut | 157 | The Harness replaces the aibitat executor, plugins, providers, and memory loop. |
| `server/utils/agents/aibitat/providers/lemonade.js` | cut | 185 | The Harness replaces the aibitat executor, plugins, providers, and memory loop. |
| `server/utils/agents/aibitat/providers/litellm.js` | cut | 165 | The Harness replaces the aibitat executor, plugins, providers, and memory loop. |
| `server/utils/agents/aibitat/providers/lmstudio.js` | cut | 196 | The Harness replaces the aibitat executor, plugins, providers, and memory loop. |
| `server/utils/agents/aibitat/providers/localai.js` | cut | 169 | The Harness replaces the aibitat executor, plugins, providers, and memory loop. |
| `server/utils/agents/aibitat/providers/minimax.js` | cut | 186 | The Harness replaces the aibitat executor, plugins, providers, and memory loop. |
| `server/utils/agents/aibitat/providers/mistral.js` | cut | 153 | The Harness replaces the aibitat executor, plugins, providers, and memory loop. |
| `server/utils/agents/aibitat/providers/moonshotAi.js` | cut | 144 | The Harness replaces the aibitat executor, plugins, providers, and memory loop. |
| `server/utils/agents/aibitat/providers/novita.js` | cut | 189 | The Harness replaces the aibitat executor, plugins, providers, and memory loop. |
| `server/utils/agents/aibitat/providers/nvidiaNim.js` | cut | 101 | The Harness replaces the aibitat executor, plugins, providers, and memory loop. |
| `server/utils/agents/aibitat/providers/ollama.js` | cut | 608 | The Harness replaces the aibitat executor, plugins, providers, and memory loop. |
| `server/utils/agents/aibitat/providers/omlx.js` | cut | 171 | The Harness replaces the aibitat executor, plugins, providers, and memory loop. |
| `server/utils/agents/aibitat/providers/openai.js` | cut | 345 | The Harness replaces the aibitat executor, plugins, providers, and memory loop. |
| `server/utils/agents/aibitat/providers/openrouter.js` | cut | 173 | The Harness replaces the aibitat executor, plugins, providers, and memory loop. |
| `server/utils/agents/aibitat/providers/perplexity.js` | cut | 101 | The Harness replaces the aibitat executor, plugins, providers, and memory loop. |
| `server/utils/agents/aibitat/providers/ppio.js` | cut | 158 | The Harness replaces the aibitat executor, plugins, providers, and memory loop. |
| `server/utils/agents/aibitat/providers/privatemode.js` | cut | 159 | The Harness replaces the aibitat executor, plugins, providers, and memory loop. |
| `server/utils/agents/aibitat/providers/sambanova.js` | cut | 141 | The Harness replaces the aibitat executor, plugins, providers, and memory loop. |
| `server/utils/agents/aibitat/providers/textgenwebui.js` | cut | 152 | The Harness replaces the aibitat executor, plugins, providers, and memory loop. |
| `server/utils/agents/aibitat/providers/togetherai.js` | cut | 153 | The Harness replaces the aibitat executor, plugins, providers, and memory loop. |
| `server/utils/agents/aibitat/providers/xai.js` | cut | 153 | The Harness replaces the aibitat executor, plugins, providers, and memory loop. |
| `server/utils/agents/aibitat/providers/zai.js` | cut | 144 | The Harness replaces the aibitat executor, plugins, providers, and memory loop. |
| `server/utils/agents/aibitat/utils/dedupe.js` | cut | 152 | The Harness replaces the aibitat executor, plugins, providers, and memory loop. |
| `server/utils/agents/aibitat/utils/summarize.js` | cut | 168 | The Harness replaces the aibitat executor, plugins, providers, and memory loop. |
| `server/utils/agents/aibitat/utils/toolReranker.js` | cut | 225 | The Harness replaces the aibitat executor, plugins, providers, and memory loop. |
| `server/utils/agents/defaults.js` | service | 266 | Retain in the Express service and adapt it to Theorem boundaries. |
| `server/utils/agents/ephemeral.js` | service | 797 | Retain in the Express service and adapt it to Theorem boundaries. |
| `server/utils/agents/imported-manifest.schema.json` | service | 158 | Retain in the Express service and adapt it to Theorem boundaries. |
| `server/utils/agents/imported.js` | service | 365 | Retain in the Express service and adapt it to Theorem boundaries. |
| `server/utils/agents/index.js` | service | 931 | Retain in the Express service and adapt it to Theorem boundaries. |
| `server/utils/boot/MetaGenerator.js` | service | 376 | Retain in the Express service and adapt it to Theorem boundaries. |
| `server/utils/boot/eagerLoadContextWindows.js` | service | 45 | Retain in the Express service and adapt it to Theorem boundaries. |
| `server/utils/boot/index.js` | service | 96 | Retain in the Express service and adapt it to Theorem boundaries. |
| `server/utils/boot/markOnboarded.js` | service | 52 | Retain in the Express service and adapt it to Theorem boundaries. |
| `server/utils/boot/patchSdkTimeouts.js` | service | 98 | Retain in the Express service and adapt it to Theorem boundaries. |
| `server/utils/chats/agents.js` | service | 111 | Retain in the Express service and adapt it to Theorem boundaries. |
| `server/utils/chats/apiChatHandler.js` | service | 868 | Retain in the Express service and adapt it to Theorem boundaries. |
| `server/utils/chats/commands/reset.js` | service | 37 | Retain in the Express service and adapt it to Theorem boundaries. |
| `server/utils/chats/embed.js` | service | 301 | Retain in the Express service and adapt it to Theorem boundaries. |
| `server/utils/chats/exportChatToFile.js` | service | 258 | Retain in the Express service and adapt it to Theorem boundaries. |
| `server/utils/chats/index.js` | service | 134 | Retain in the Express service and adapt it to Theorem boundaries. |
| `server/utils/chats/openaiCompatible.js` | service | 537 | Retain in the Express service and adapt it to Theorem boundaries. |
| `server/utils/chats/stream.js` | service | 376 | Retain in the Express service and adapt it to Theorem boundaries. |
| `server/utils/collectorApi/index.js` | service | 366 | Retain in the Express service and adapt it to Theorem boundaries. |
| `server/utils/comKey/index.js` | service | 86 | Retain in the Express service and adapt it to Theorem boundaries. |
| `server/utils/database/index.js` | service | 114 | Retain in the Express service and adapt it to Theorem boundaries. |
| `server/utils/files/index.js` | service | 531 | Retain in the Express service and adapt it to Theorem boundaries. |
| `server/utils/files/logo.js` | service | 117 | Retain in the Express service and adapt it to Theorem boundaries. |
| `server/utils/files/multer.js` | service | 204 | Retain in the Express service and adapt it to Theorem boundaries. |
| `server/utils/files/pfp.js` | service | 63 | Retain in the Express service and adapt it to Theorem boundaries. |
| `server/utils/files/purgeDocument.js` | service | 91 | Retain in the Express service and adapt it to Theorem boundaries. |
| `server/utils/helpers/admin/index.js` | service | 56 | Retain in the Express service and adapt it to Theorem boundaries. |
| `server/utils/helpers/agents.js` | service | 35 | Retain in the Express service and adapt it to Theorem boundaries. |
| `server/utils/helpers/camelcase.js` | service | 143 | Retain in the Express service and adapt it to Theorem boundaries. |
| `server/utils/helpers/chat/LLMPerformanceMonitor.js` | service | 113 | Retain in the Express service and adapt it to Theorem boundaries. |
| `server/utils/helpers/chat/convertTo.js` | service | 259 | Retain in the Express service and adapt it to Theorem boundaries. |
| `server/utils/helpers/chat/index.js` | service | 448 | Retain in the Express service and adapt it to Theorem boundaries. |
| `server/utils/helpers/chat/responses.js` | service | 383 | Retain in the Express service and adapt it to Theorem boundaries. |
| `server/utils/helpers/customModels.js` | service | 1,383 | Retain in the Express service and adapt it to Theorem boundaries. |
| `server/utils/helpers/index.js` | service | 728 | Retain in the Express service and adapt it to Theorem boundaries. |
| `server/utils/helpers/portAvailabilityChecker.js` | service | 46 | Retain in the Express service and adapt it to Theorem boundaries. |
| `server/utils/helpers/search.js` | service | 94 | Retain in the Express service and adapt it to Theorem boundaries. |
| `server/utils/helpers/shell.js` | service | 25 | Retain in the Express service and adapt it to Theorem boundaries. |
| `server/utils/helpers/tiktoken.js` | service | 108 | Retain in the Express service and adapt it to Theorem boundaries. |
| `server/utils/helpers/updateENV.js` | service | 1,493 | Retain in the Express service and adapt it to Theorem boundaries. |
| `server/utils/http/index.js` | service | 141 | Retain in the Express service and adapt it to Theorem boundaries. |
| `server/utils/logger/index.js` | service | 66 | Retain in the Express service and adapt it to Theorem boundaries. |
| `server/utils/memories/index.js` | service | 139 | Retain in the Express service and adapt it to Theorem boundaries. |
| `server/utils/middleware/chatHistoryViewable.js` | service | 18 | Retain in the Express service and adapt it to Theorem boundaries. |
| `server/utils/middleware/communityHubDownloadsEnabled.js` | service | 77 | Retain in the Express service and adapt it to Theorem boundaries. |
| `server/utils/middleware/embedMiddleware.js` | service | 196 | Retain in the Express service and adapt it to Theorem boundaries. |
| `server/utils/middleware/featureFlagEnabled.js` | service | 24 | Retain in the Express service and adapt it to Theorem boundaries. |
| `server/utils/middleware/isSupportedRepoProviders.js` | service | 12 | Retain in the Express service and adapt it to Theorem boundaries. |
| `server/utils/middleware/multiUserProtected.js` | service | 107 | Retain in the Express service and adapt it to Theorem boundaries. |
| `server/utils/middleware/simpleSSOEnabled.js` | service | 84 | Retain in the Express service and adapt it to Theorem boundaries. |
| `server/utils/middleware/validApiKey.js` | service | 29 | Retain in the Express service and adapt it to Theorem boundaries. |
| `server/utils/middleware/validBrowserExtensionApiKey.js` | service | 51 | Retain in the Express service and adapt it to Theorem boundaries. |
| `server/utils/middleware/validWorkspace.js` | service | 53 | Retain in the Express service and adapt it to Theorem boundaries. |
| `server/utils/middleware/validatedRequest.js` | service | 115 | Retain in the Express service and adapt it to Theorem boundaries. |
| `server/utils/middleware/workspaceDeletionProtection.js` | service | 18 | Retain in the Express service and adapt it to Theorem boundaries. |
| `server/utils/prisma/PRISMA.md` | service | 47 | Retain in the Express service and adapt it to Theorem boundaries. |
| `server/utils/prisma/index.js` | service | 13 | Retain in the Express service and adapt it to Theorem boundaries. |
| `server/utils/router/index.js` | service | 653 | Retain in the Express service and adapt it to Theorem boundaries. |
| `server/utils/telegramBot/chat/agent.js` | service | 425 | Retain in the Express service and adapt it to Theorem boundaries. |
| `server/utils/telegramBot/chat/stream.js` | service | 471 | Retain in the Express service and adapt it to Theorem boundaries. |
| `server/utils/telegramBot/constants.js` | service | 23 | Retain in the Express service and adapt it to Theorem boundaries. |
| `server/utils/telegramBot/index.js` | service | 844 | Retain in the Express service and adapt it to Theorem boundaries. |
| `server/utils/telegramBot/utils/commands/handlers/handleAbort.js` | service | 15 | Retain in the Express service and adapt it to Theorem boundaries. |
| `server/utils/telegramBot/utils/commands/handlers/handleHelp.js` | service | 15 | Retain in the Express service and adapt it to Theorem boundaries. |
| `server/utils/telegramBot/utils/commands/handlers/handleHistory.js` | service | 80 | Retain in the Express service and adapt it to Theorem boundaries. |
| `server/utils/telegramBot/utils/commands/handlers/handleNewThread.js` | service | 35 | Retain in the Express service and adapt it to Theorem boundaries. |
| `server/utils/telegramBot/utils/commands/handlers/handleProof.js` | service | 202 | Retain in the Express service and adapt it to Theorem boundaries. |
| `server/utils/telegramBot/utils/commands/handlers/handleReset.js` | service | 32 | Retain in the Express service and adapt it to Theorem boundaries. |
| `server/utils/telegramBot/utils/commands/handlers/handleStart.js` | service | 19 | Retain in the Express service and adapt it to Theorem boundaries. |
| `server/utils/telegramBot/utils/commands/handlers/handleStatus.js` | service | 80 | Retain in the Express service and adapt it to Theorem boundaries. |
| `server/utils/telegramBot/utils/commands/handlers/showModelMenu.js` | service | 98 | Retain in the Express service and adapt it to Theorem boundaries. |
| `server/utils/telegramBot/utils/commands/handlers/showThreadMenu.js` | service | 120 | Retain in the Express service and adapt it to Theorem boundaries. |
| `server/utils/telegramBot/utils/commands/handlers/showWorkspaceMenu.js` | service | 84 | Retain in the Express service and adapt it to Theorem boundaries. |
| `server/utils/telegramBot/utils/commands/index.js` | service | 125 | Retain in the Express service and adapt it to Theorem boundaries. |
| `server/utils/telegramBot/utils/format.js` | service | 225 | Retain in the Express service and adapt it to Theorem boundaries. |
| `server/utils/telegramBot/utils/index.js` | service | 203 | Retain in the Express service and adapt it to Theorem boundaries. |
| `server/utils/telegramBot/utils/media.js` | service | 166 | Retain in the Express service and adapt it to Theorem boundaries. |
| `server/utils/telegramBot/utils/messageQueue.js` | service | 53 | Retain in the Express service and adapt it to Theorem boundaries. |
| `server/utils/telegramBot/utils/navigation/callbacks/handleBackSources.js` | service | 16 | Retain in the Express service and adapt it to Theorem boundaries. |
| `server/utils/telegramBot/utils/navigation/callbacks/handleBackWorkspaces.js` | service | 18 | Retain in the Express service and adapt it to Theorem boundaries. |
| `server/utils/telegramBot/utils/navigation/callbacks/handleModelCancel.js` | service | 14 | Retain in the Express service and adapt it to Theorem boundaries. |
| `server/utils/telegramBot/utils/navigation/callbacks/handleModelPagination.js` | service | 24 | Retain in the Express service and adapt it to Theorem boundaries. |
| `server/utils/telegramBot/utils/navigation/callbacks/handleModelSelect.js` | service | 52 | Retain in the Express service and adapt it to Theorem boundaries. |
| `server/utils/telegramBot/utils/navigation/callbacks/handleSourcePagination.js` | service | 24 | Retain in the Express service and adapt it to Theorem boundaries. |
| `server/utils/telegramBot/utils/navigation/callbacks/handleSourceSelect.js` | service | 106 | Retain in the Express service and adapt it to Theorem boundaries. |
| `server/utils/telegramBot/utils/navigation/callbacks/handleThreadPagination.js` | service | 26 | Retain in the Express service and adapt it to Theorem boundaries. |
| `server/utils/telegramBot/utils/navigation/callbacks/handleThreadSelect.js` | service | 43 | Retain in the Express service and adapt it to Theorem boundaries. |
| `server/utils/telegramBot/utils/navigation/callbacks/handleToolApproval.js` | service | 104 | Retain in the Express service and adapt it to Theorem boundaries. |
| `server/utils/telegramBot/utils/navigation/callbacks/handleWorkspaceCreate.js` | service | 33 | Retain in the Express service and adapt it to Theorem boundaries. |
| `server/utils/telegramBot/utils/navigation/callbacks/handleWorkspacePagination.js` | service | 26 | Retain in the Express service and adapt it to Theorem boundaries. |
| `server/utils/telegramBot/utils/navigation/callbacks/handleWorkspaceSelect.js` | service | 24 | Retain in the Express service and adapt it to Theorem boundaries. |
| `server/utils/telegramBot/utils/navigation/callbacks/index.js` | service | 59 | Retain in the Express service and adapt it to Theorem boundaries. |
| `server/utils/telegramBot/utils/navigation/index.js` | service | 36 | Retain in the Express service and adapt it to Theorem boundaries. |
| `server/utils/telegramBot/utils/verification.js` | service | 171 | Retain in the Express service and adapt it to Theorem boundaries. |
| `server/utils/telemetry/index.js` | service | 33 | Retain in the Express service and adapt it to Theorem boundaries. |
| `server/utils/userLocale.js` | service | 98 | Retain in the Express service and adapt it to Theorem boundaries. |
| `server/utils/vectorDbProviders/astra/ASTRA_SETUP.md` | cut | 22 | The astra adapter is removed because RustyRed is the sole content substrate. |
| `server/utils/vectorDbProviders/astra/index.js` | cut | 474 | The astra adapter is removed because RustyRed is the sole content substrate. |
| `server/utils/vectorDbProviders/base.js` | service | 202 | Retain only as the seam for the new RustyRed content adapter. |
| `server/utils/vectorDbProviders/chroma/index.js` | cut | 484 | The chroma adapter is removed because RustyRed is the sole content substrate. |
| `server/utils/vectorDbProviders/chromacloud/index.js` | cut | 158 | The chromacloud adapter is removed because RustyRed is the sole content substrate. |
| `server/utils/vectorDbProviders/lance/index.js` | cut | 511 | The lance adapter is removed because RustyRed is the sole content substrate. |
| `server/utils/vectorDbProviders/milvus/MILVUS_SETUP.md` | cut | 40 | The milvus adapter is removed because RustyRed is the sole content substrate. |
| `server/utils/vectorDbProviders/milvus/index.js` | cut | 434 | The milvus adapter is removed because RustyRed is the sole content substrate. |
| `server/utils/vectorDbProviders/pgvector/SETUP.md` | cut | 125 | The pgvector adapter is removed because RustyRed is the sole content substrate. |
| `server/utils/vectorDbProviders/pgvector/index.js` | cut | 850 | The pgvector adapter is removed because RustyRed is the sole content substrate. |
| `server/utils/vectorDbProviders/pinecone/PINECONE_SETUP.md` | cut | 24 | The pinecone adapter is removed because RustyRed is the sole content substrate. |
| `server/utils/vectorDbProviders/pinecone/index.js` | cut | 317 | The pinecone adapter is removed because RustyRed is the sole content substrate. |
| `server/utils/vectorDbProviders/qdrant/QDRANT_SETUP.md` | cut | 17 | The qdrant adapter is removed because RustyRed is the sole content substrate. |
| `server/utils/vectorDbProviders/qdrant/index.js` | cut | 442 | The qdrant adapter is removed because RustyRed is the sole content substrate. |
| `server/utils/vectorDbProviders/weaviate/WEAVIATE_SETUP.md` | cut | 17 | The weaviate adapter is removed because RustyRed is the sole content substrate. |
| `server/utils/vectorDbProviders/weaviate/index.js` | cut | 510 | The weaviate adapter is removed because RustyRed is the sole content substrate. |
| `server/utils/vectorDbProviders/zilliz/index.js` | cut | 36 | The zilliz adapter is removed because RustyRed is the sole content substrate. |
| `server/utils/vectorStore/resetAllVectorStores.js` | cut | 58 | The legacy vector ingestion path is replaced by commonplace IngestPipeline. |
| `server/yarn.lock` | service | 7,950 | Retain in the Express service and adapt it to Theorem boundaries. |

## `collector`

| File | Verdict | Lines | Reason |
|---|---:|---:|---|
| `collector/.env.example` | service | 9 | Run in the collector service and feed parsed output to IngestPipeline. |
| `collector/.gitignore` | service | 9 | Run in the collector service and feed parsed output to IngestPipeline. |
| `collector/.nvmrc` | service | 0 | Run in the collector service and feed parsed output to IngestPipeline. |
| `collector/__tests__/utils/WhisperProviders/ffmpeg/index.test.js` | service | 77 | Run in the collector service and feed parsed output to IngestPipeline. |
| `collector/__tests__/utils/downloadURIToFile/index.test.js` | service | 96 | Run in the collector service and feed parsed output to IngestPipeline. |
| `collector/__tests__/utils/extensions/Confluence/ConfluenceLoader.test.js` | service | 125 | Run in the collector service and feed parsed output to IngestPipeline. |
| `collector/__tests__/utils/url/index.test.js` | service | 197 | Run in the collector service and feed parsed output to IngestPipeline. |
| `collector/convertAudioToWav/index.js` | service | 54 | Run in the collector service and feed parsed output to IngestPipeline. |
| `collector/eslint.config.mjs` | service | 38 | Run in the collector service and feed parsed output to IngestPipeline. |
| `collector/extensions/index.js` | service | 239 | Run in the collector service and feed parsed output to IngestPipeline. |
| `collector/extensions/resync/index.js` | service | 197 | Run in the collector service and feed parsed output to IngestPipeline. |
| `collector/hotdir/__HOTDIR__.md` | service | 2 | Run in the collector service and feed parsed output to IngestPipeline. |
| `collector/index.js` | service | 228 | Run in the collector service and feed parsed output to IngestPipeline. |
| `collector/middleware/httpLogger.js` | service | 29 | Run in the collector service and feed parsed output to IngestPipeline. |
| `collector/middleware/setDataSigner.js` | service | 44 | Run in the collector service and feed parsed output to IngestPipeline. |
| `collector/middleware/verifyIntegrity.js` | service | 32 | Run in the collector service and feed parsed output to IngestPipeline. |
| `collector/nodemon.json` | service | 2 | Run in the collector service and feed parsed output to IngestPipeline. |
| `collector/package.json` | service | 68 | Run in the collector service and feed parsed output to IngestPipeline. |
| `collector/processLink/convert/generic.js` | service | 240 | Run in the collector service and feed parsed output to IngestPipeline. |
| `collector/processLink/helpers/htmlToMarkdown.js` | service | 203 | Run in the collector service and feed parsed output to IngestPipeline. |
| `collector/processLink/helpers/index.js` | service | 190 | Run in the collector service and feed parsed output to IngestPipeline. |
| `collector/processLink/index.js` | service | 47 | Run in the collector service and feed parsed output to IngestPipeline. |
| `collector/processRawText/index.js` | service | 83 | Run in the collector service and feed parsed output to IngestPipeline. |
| `collector/processSingleFile/convert/asAudio.js` | service | 83 | Run in the collector service and feed parsed output to IngestPipeline. |
| `collector/processSingleFile/convert/asDocx.js` | service | 63 | Run in the collector service and feed parsed output to IngestPipeline. |
| `collector/processSingleFile/convert/asEPub.js` | service | 61 | Run in the collector service and feed parsed output to IngestPipeline. |
| `collector/processSingleFile/convert/asImage.js` | service | 56 | Run in the collector service and feed parsed output to IngestPipeline. |
| `collector/processSingleFile/convert/asMbox.js` | service | 83 | Run in the collector service and feed parsed output to IngestPipeline. |
| `collector/processSingleFile/convert/asOfficeMime.js` | service | 59 | Run in the collector service and feed parsed output to IngestPipeline. |
| `collector/processSingleFile/convert/asPDF/PDFLoader/index.js` | service | 97 | Run in the collector service and feed parsed output to IngestPipeline. |
| `collector/processSingleFile/convert/asPDF/index.js` | service | 86 | Run in the collector service and feed parsed output to IngestPipeline. |
| `collector/processSingleFile/convert/asTxt.js` | service | 59 | Run in the collector service and feed parsed output to IngestPipeline. |
| `collector/processSingleFile/convert/asXlsx.js` | service | 193 | Run in the collector service and feed parsed output to IngestPipeline. |
| `collector/processSingleFile/index.js` | service | 95 | Run in the collector service and feed parsed output to IngestPipeline. |
| `collector/storage/.gitignore` | service | 1 | Run in the collector service and feed parsed output to IngestPipeline. |
| `collector/storage/tmp/.placeholder` | service | 0 | Run in the collector service and feed parsed output to IngestPipeline. |
| `collector/utils/EncryptionWorker/index.js` | service | 77 | Run in the collector service and feed parsed output to IngestPipeline. |
| `collector/utils/OCRLoader/index.js` | service | 355 | Run in the collector service and feed parsed output to IngestPipeline. |
| `collector/utils/OCRLoader/validLangs.js` | service | 155 | Run in the collector service and feed parsed output to IngestPipeline. |
| `collector/utils/WhisperProviders/GenericOpenAiWhisper.js` | service | 51 | Run in the collector service and feed parsed output to IngestPipeline. |
| `collector/utils/WhisperProviders/OpenAiWhisper.js` | service | 49 | Run in the collector service and feed parsed output to IngestPipeline. |
| `collector/utils/WhisperProviders/ffmpeg/index.js` | service | 114 | Run in the collector service and feed parsed output to IngestPipeline. |
| `collector/utils/WhisperProviders/localWhisper.js` | service | 197 | Run in the collector service and feed parsed output to IngestPipeline. |
| `collector/utils/comKey/index.js` | service | 54 | Run in the collector service and feed parsed output to IngestPipeline. |
| `collector/utils/constants.js` | service | 92 | Run in the collector service and feed parsed output to IngestPipeline. |
| `collector/utils/downloadURIToFile/index.js` | service | 90 | Run in the collector service and feed parsed output to IngestPipeline. |
| `collector/utils/extensions/Confluence/ConfluenceLoader/index.js` | service | 154 | Run in the collector service and feed parsed output to IngestPipeline. |
| `collector/utils/extensions/Confluence/index.js` | service | 292 | Run in the collector service and feed parsed output to IngestPipeline. |
| `collector/utils/extensions/DrupalWiki/DrupalWiki/index.js` | service | 338 | Run in the collector service and feed parsed output to IngestPipeline. |
| `collector/utils/extensions/DrupalWiki/index.js` | service | 102 | Run in the collector service and feed parsed output to IngestPipeline. |
| `collector/utils/extensions/ObsidianVault/index.js` | service | 95 | Run in the collector service and feed parsed output to IngestPipeline. |
| `collector/utils/extensions/PaperlessNgx/PaperlessNgxLoader/index.js` | service | 157 | Run in the collector service and feed parsed output to IngestPipeline. |
| `collector/utils/extensions/PaperlessNgx/index.js` | service | 128 | Run in the collector service and feed parsed output to IngestPipeline. |
| `collector/utils/extensions/RepoLoader/GithubRepo/RepoLoader/index.js` | service | 265 | Run in the collector service and feed parsed output to IngestPipeline. |
| `collector/utils/extensions/RepoLoader/GithubRepo/index.js` | service | 159 | Run in the collector service and feed parsed output to IngestPipeline. |
| `collector/utils/extensions/RepoLoader/GitlabRepo/RepoLoader/index.js` | service | 447 | Run in the collector service and feed parsed output to IngestPipeline. |
| `collector/utils/extensions/RepoLoader/GitlabRepo/index.js` | service | 261 | Run in the collector service and feed parsed output to IngestPipeline. |
| `collector/utils/extensions/RepoLoader/index.js` | service | 41 | Run in the collector service and feed parsed output to IngestPipeline. |
| `collector/utils/extensions/WebsiteDepth/index.js` | service | 211 | Run in the collector service and feed parsed output to IngestPipeline. |
| `collector/utils/extensions/YoutubeTranscript/YoutubeLoader/index.js` | service | 99 | Run in the collector service and feed parsed output to IngestPipeline. |
| `collector/utils/extensions/YoutubeTranscript/YoutubeLoader/youtube-transcript.js` | service | 246 | Run in the collector service and feed parsed output to IngestPipeline. |
| `collector/utils/extensions/YoutubeTranscript/index.js` | service | 219 | Run in the collector service and feed parsed output to IngestPipeline. |
| `collector/utils/files/index.js` | service | 254 | Run in the collector service and feed parsed output to IngestPipeline. |
| `collector/utils/files/mime.js` | service | 64 | Run in the collector service and feed parsed output to IngestPipeline. |
| `collector/utils/http/index.js` | service | 54 | Run in the collector service and feed parsed output to IngestPipeline. |
| `collector/utils/logger/index.js` | service | 68 | Run in the collector service and feed parsed output to IngestPipeline. |
| `collector/utils/runtimeSettings/index.js` | service | 97 | Run in the collector service and feed parsed output to IngestPipeline. |
| `collector/utils/shell.js` | service | 25 | Run in the collector service and feed parsed output to IngestPipeline. |
| `collector/utils/tokenizer/index.js` | service | 66 | Run in the collector service and feed parsed output to IngestPipeline. |
| `collector/utils/url/index.js` | service | 137 | Run in the collector service and feed parsed output to IngestPipeline. |
| `collector/yarn.lock` | service | 4,425 | Run in the collector service and feed parsed output to IngestPipeline. |
