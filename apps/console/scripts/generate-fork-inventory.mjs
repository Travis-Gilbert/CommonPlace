#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const SCRIPT_PATH = fileURLToPath(import.meta.url);
const CONSOLE_ROOT = path.resolve(path.dirname(SCRIPT_PATH), "..");
const OUTPUT_PATH = path.join(
  CONSOLE_ROOT,
  "docs",
  "plans",
  "fork",
  "inventory.md"
);
const INVENTORY_ROOTS = ["frontend/src", "server", "collector"];
const ROOT_ORDER = new Map(
  INVENTORY_ROOTS.map((root, index) => [root, index])
);
const VERDICTS = ["port", "service", "cut"];
const REGULAR_FILE_MODES = new Set(["100644", "100755"]);
const MAX_GIT_BUFFER = 128 * 1024 * 1024;

const GENERAL_SETTINGS_PROVIDER_CUTS = [
  "LLMPreference",
  "EmbeddingPreference",
  "EmbeddingTextSplitterPreference",
  "VectorDatabase",
  "TranscriptionPreference",
  "AudioPreference",
  "ModelRouters",
  "Connections",
  "MobileConnections",
];

const COMPONENT_PROVIDER_CUTS = [
  "LLMSelection",
  "EmbeddingSelection",
  "VectorDBSelection",
  "TranscriptionSelection",
  "DataConnectorOption",
  "ProviderPrivacy",
  "SpeechToText",
  "TextToSpeech",
  "CommunityHub",
];

const COMPONENT_CUT_REASONS = {
  CommunityHub:
    "The upstream Community Hub distribution surface is outside the Theorem product.",
  DataConnectorOption:
    "The provider-neutral connector chooser is replaced by the collector service flow.",
  ProviderPrivacy:
    "Provider disclosure UI is removed because Theorem owns the provider boundary.",
};

const ADDITIONAL_PROVIDER_UI_CUTS = [
  "frontend/src/components/WorkspaceChat/ChatContainer/PromptInput/LLMSelector",
  "frontend/src/pages/OnboardingFlow/Steps/LLMPreference",
  "frontend/src/pages/WorkspaceSettings/AgentConfig/AgentLLMSelection",
  "frontend/src/pages/WorkspaceSettings/ChatSettings/WorkspaceLLMSelection",
];

const VECTOR_PROVIDER_CUTS = [
  "astra",
  "chroma",
  "chromacloud",
  "lance",
  "milvus",
  "pgvector",
  "pinecone",
  "qdrant",
  "weaviate",
  "zilliz",
];

const LEGACY_VECTOR_TIER_FILES = new Set([
  "server/jobs/embedding-worker.js",
  "server/models/vectors.js",
  "server/utils/EmbeddingWorkerManager.js",
  "server/utils/vectorStore/resetAllVectorStores.js",
]);

function printUsage() {
  console.log(
    [
      "Usage:",
      "  node apps/console/scripts/generate-fork-inventory.mjs --source <anything-llm-checkout> [--check]",
      "",
      "Options:",
      "  --source <path>  AnythingLLM Git checkout. May also be set with ANYTHING_LLM_SOURCE.",
      "  --check          Verify that inventory.md matches generated output.",
      "  --help           Show this message.",
    ].join("\n")
  );
}

function parseArguments(argv) {
  let source = process.env.ANYTHING_LLM_SOURCE;
  let check = false;

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];

    if (argument === "--check") {
      check = true;
      continue;
    }

    if (argument === "--help") {
      printUsage();
      process.exit(0);
    }

    if (argument === "--source") {
      source = argv[index + 1];
      if (!source) {
        throw new Error("--source requires a path");
      }
      index += 1;
      continue;
    }

    throw new Error(`Unknown argument: ${argument}`);
  }

  if (!source) {
    throw new Error(
      "Set --source or ANYTHING_LLM_SOURCE to an AnythingLLM Git checkout"
    );
  }

  return { source: path.resolve(source), check };
}

function runGit(source, arguments_, encoding = "utf8") {
  return execFileSync("git", ["-C", source, ...arguments_], {
    encoding,
    maxBuffer: MAX_GIT_BUFFER,
    stdio: ["ignore", "pipe", "pipe"],
  });
}

function resolveSource(source) {
  const topLevel = runGit(source, ["rev-parse", "--show-toplevel"]).trim();
  const expected = path.resolve(source);

  if (path.resolve(topLevel) !== expected) {
    throw new Error(
      `--source must name the checkout root. Git resolved ${topLevel}`
    );
  }

  return topLevel;
}

function parseTreeEntry(entry) {
  const separator = entry.indexOf("\t");
  if (separator === -1) {
    throw new Error(`Could not parse git ls-tree entry: ${entry}`);
  }

  const metadata = entry.slice(0, separator).split(" ");
  if (metadata.length !== 3) {
    throw new Error(`Could not parse git ls-tree metadata: ${entry}`);
  }

  const [mode, type, objectId] = metadata;
  const filePath = entry.slice(separator + 1);
  return { mode, type, objectId, path: filePath };
}

function listTrackedRegularFiles(source, commit) {
  const tree = runGit(
    source,
    [
      "ls-tree",
      "-r",
      "-z",
      "--full-tree",
      commit,
      "--",
      ...INVENTORY_ROOTS,
    ],
    "buffer"
  );

  const entries = tree
    .toString("utf8")
    .split("\0")
    .filter(Boolean)
    .map(parseTreeEntry)
    .filter(
      ({ mode, type }) =>
        type === "blob" && REGULAR_FILE_MODES.has(mode)
    );

  const paths = new Set(entries.map((entry) => entry.path));
  if (paths.size !== entries.length) {
    throw new Error("Git returned duplicate tracked paths");
  }

  return entries;
}

function isUnder(filePath, prefix) {
  return filePath === prefix || filePath.startsWith(`${prefix}/`);
}

function firstMatchingPrefix(filePath, prefixes) {
  return prefixes.find((prefix) => isUnder(filePath, prefix));
}

function classify(filePath) {
  for (const directory of GENERAL_SETTINGS_PROVIDER_CUTS) {
    const prefix = `frontend/src/pages/GeneralSettings/${directory}`;
    if (isUnder(filePath, prefix)) {
      return {
        verdict: "cut",
        reason: "Provider configuration is removed because Theorem owns the substrate.",
      };
    }
  }

  for (const directory of COMPONENT_PROVIDER_CUTS) {
    const prefix = `frontend/src/components/${directory}`;
    if (isUnder(filePath, prefix)) {
      return {
        verdict: "cut",
        reason:
          COMPONENT_CUT_REASONS[directory] ??
          "Provider-neutral selection UI is outside the Theorem product boundary.",
      };
    }
  }

  if (firstMatchingPrefix(filePath, ADDITIONAL_PROVIDER_UI_CUTS)) {
    return {
      verdict: "cut",
      reason: "Provider and model selection moves to the Harness execution boundary.",
    };
  }

  for (const provider of VECTOR_PROVIDER_CUTS) {
    const prefix = `server/utils/vectorDbProviders/${provider}`;
    if (isUnder(filePath, prefix)) {
      return {
        verdict: "cut",
        reason: `The ${provider} adapter is removed because RustyRed is the sole content substrate.`,
      };
    }
  }

  if (
    isUnder(filePath, "server/__tests__/utils/vectorDbProviders") ||
    isUnder(filePath, "server/__tests__/utils/agents/aibitat")
  ) {
    return {
      verdict: "cut",
      reason: "The tested upstream implementation is removed by the fork boundary.",
    };
  }

  if (isUnder(filePath, "server/utils/agents/aibitat")) {
    return {
      verdict: "cut",
      reason: "The Harness replaces the aibitat executor, plugins, providers, and memory loop.",
    };
  }

  if (isUnder(filePath, "server/utils/AiProviders")) {
    return {
      verdict: "cut",
      reason: "The upstream LLM connector is not routed because the Harness owns execution.",
    };
  }

  if (isUnder(filePath, "server/utils/EmbeddingEngines/native")) {
    return {
      verdict: "cut",
      reason: "The browser ML embedding path is removed; IngestPipeline owns embedding.",
    };
  }

  if (isUnder(filePath, "server/utils/EmbeddingEngines")) {
    return {
      verdict: "cut",
      reason: "The upstream embedding connector is removed; IngestPipeline owns embedding.",
    };
  }

  if (isUnder(filePath, "server/utils/EmbeddingRerankers/native")) {
    return {
      verdict: "cut",
      reason: "The browser ML reranker is removed with the onnxruntime-web path.",
    };
  }

  if (
    isUnder(filePath, "server/utils/SpeechToText") ||
    isUnder(filePath, "server/utils/TextToSpeech") ||
    isUnder(filePath, "server/__tests__/utils/TextToSpeech")
  ) {
    return {
      verdict: "cut",
      reason: "The upstream audio provider tier is removed with provider selection.",
    };
  }

  if (isUnder(filePath, "server/storage/models")) {
    return {
      verdict: "cut",
      reason: "The upstream local browser ML model store is not part of the service.",
    };
  }

  if (LEGACY_VECTOR_TIER_FILES.has(filePath)) {
    return {
      verdict: "cut",
      reason: "The legacy vector ingestion path is replaced by commonplace IngestPipeline.",
    };
  }

  if (filePath === "server/utils/vectorDbProviders/base.js") {
    return {
      verdict: "service",
      reason: "Retain only as the seam for the new RustyRed content adapter.",
    };
  }

  if (filePath.startsWith("frontend/src/")) {
    return {
      verdict: "port",
      reason: "Port the surviving frontend behavior into the typed console page architecture.",
    };
  }

  if (filePath.startsWith("collector/")) {
    return {
      verdict: "service",
      reason: "Run in the collector service and feed parsed output to IngestPipeline.",
    };
  }

  if (filePath.startsWith("server/")) {
    return {
      verdict: "service",
      reason: "Retain in the Express service and adapt it to Theorem boundaries.",
    };
  }

  throw new Error(`No inventory root matched ${filePath}`);
}

function countBlobLines(source, objectId, cache) {
  if (cache.has(objectId)) {
    return cache.get(objectId);
  }

  const contents = runGit(source, ["cat-file", "blob", objectId], "buffer");
  let lines = 0;
  for (const byte of contents) {
    if (byte === 0x0a) {
      lines += 1;
    }
  }

  cache.set(objectId, lines);
  return lines;
}

function inventoryRoot(filePath) {
  const root = INVENTORY_ROOTS.find((candidate) =>
    isUnder(filePath, candidate)
  );
  if (!root) {
    throw new Error(`No inventory root matched ${filePath}`);
  }
  return root;
}

function compareRecords(left, right) {
  const rootDifference =
    ROOT_ORDER.get(left.root) - ROOT_ORDER.get(right.root);
  if (rootDifference !== 0) {
    return rootDifference;
  }
  if (left.path < right.path) {
    return -1;
  }
  if (left.path > right.path) {
    return 1;
  }
  return 0;
}

function buildRecords(source, commit) {
  const lineCache = new Map();
  const records = listTrackedRegularFiles(source, commit)
    .map((entry) => {
      const classification = classify(entry.path);
      if (!VERDICTS.includes(classification.verdict)) {
        throw new Error(`Invalid verdict for ${entry.path}`);
      }

      return {
        path: entry.path,
        root: inventoryRoot(entry.path),
        lines: countBlobLines(source, entry.objectId, lineCache),
        ...classification,
      };
    })
    .sort(compareRecords);

  if (records.length === 0) {
    throw new Error("No tracked regular files found in inventory roots");
  }

  assertKnownCutCoverage(records);
  return records;
}

function assertKnownCutCoverage(records) {
  const requiredCutPrefixes = [
    ...GENERAL_SETTINGS_PROVIDER_CUTS.map(
      (directory) =>
        `frontend/src/pages/GeneralSettings/${directory}`
    ),
    ...COMPONENT_PROVIDER_CUTS.map(
      (directory) => `frontend/src/components/${directory}`
    ),
    ...ADDITIONAL_PROVIDER_UI_CUTS,
    ...VECTOR_PROVIDER_CUTS.map(
      (provider) => `server/utils/vectorDbProviders/${provider}`
    ),
    "server/utils/agents/aibitat",
    "server/utils/AiProviders",
    "server/utils/EmbeddingEngines/native",
    "server/utils/EmbeddingRerankers/native",
    "server/utils/SpeechToText",
    "server/utils/TextToSpeech",
  ];

  for (const prefix of requiredCutPrefixes) {
    const matches = records.filter((record) =>
      isUnder(record.path, prefix)
    );
    if (matches.length === 0) {
      throw new Error(`Required cut prefix has no tracked files: ${prefix}`);
    }
    if (matches.some((record) => record.verdict !== "cut")) {
      throw new Error(`Required cut prefix has a surviving file: ${prefix}`);
    }
  }
}

function summarize(records, predicate = () => true) {
  const selected = records.filter(predicate);
  return {
    files: selected.length,
    lines: selected.reduce((total, record) => total + record.lines, 0),
  };
}

function formatNumber(value) {
  return new Intl.NumberFormat("en-US", {
    useGrouping: true,
  }).format(value);
}

function markdownCode(value) {
  return `\`${value.replaceAll("|", "\\|")}\``;
}

function escapeTableCell(value) {
  return value.replaceAll("|", "\\|").replaceAll("\n", " ");
}

function renderSummaryByRoot(records) {
  const rows = INVENTORY_ROOTS.map((root) => {
    const rootRecords = records.filter((record) => record.root === root);
    const verdictCounts = Object.fromEntries(
      VERDICTS.map((verdict) => [
        verdict,
        summarize(rootRecords, (record) => record.verdict === verdict).files,
      ])
    );
    const total = summarize(rootRecords);

    return `| ${markdownCode(root)} | ${formatNumber(verdictCounts.port)} | ${formatNumber(verdictCounts.service)} | ${formatNumber(verdictCounts.cut)} | ${formatNumber(total.files)} | ${formatNumber(total.lines)} |`;
  });

  const verdictCounts = Object.fromEntries(
    VERDICTS.map((verdict) => [
      verdict,
      summarize(records, (record) => record.verdict === verdict).files,
    ])
  );
  const total = summarize(records);
  rows.push(
    `| **Total** | **${formatNumber(verdictCounts.port)}** | **${formatNumber(verdictCounts.service)}** | **${formatNumber(verdictCounts.cut)}** | **${formatNumber(total.files)}** | **${formatNumber(total.lines)}** |`
  );

  return rows.join("\n");
}

function renderSummaryByVerdict(records) {
  return VERDICTS.map((verdict) => {
    const summary = summarize(
      records,
      (record) => record.verdict === verdict
    );
    return `| ${verdict} | ${formatNumber(summary.files)} | ${formatNumber(summary.lines)} |`;
  }).join("\n");
}

function renderInventorySection(root, records) {
  const rows = records
    .filter((record) => record.root === root)
    .map(
      (record) =>
        `| ${markdownCode(record.path)} | ${record.verdict} | ${formatNumber(record.lines)} | ${escapeTableCell(record.reason)} |`
    )
    .join("\n");

  return [
    `## ${markdownCode(root)}`,
    "",
    "| File | Verdict | Lines | Reason |",
    "|---|---:|---:|---|",
    rows,
  ].join("\n");
}

function renderInventory(commit, records) {
  const total = summarize(records);
  const sections = INVENTORY_ROOTS.map((root) =>
    renderInventorySection(root, records)
  ).join("\n\n");

  return `# SPEC-COMMONPLACE-FORK-1.0: FK1 inventory and cut list

Date: 2026-07-27

Upstream: \`Mintplex-Labs/anything-llm\`

Upstream commit: \`${commit}\`

Generation command:

\`\`\`sh
node apps/console/scripts/generate-fork-inventory.mjs --source <anything-llm-checkout>
\`\`\`

This inventory is classification only. No source file from AnythingLLM has been copied into the CommonPlace worktree. The generator reads tracked blobs from the named upstream commit and writes only this document.

Scope is every tracked regular file in \`frontend/src\`, \`server\`, and \`collector\` at the commit above. Git tree entries are authoritative, so ignored dependencies and untracked build output are excluded. Lines are LF byte counts from Git blobs. Binary assets can therefore report zero lines.

## Counts

| Root | Port files | Service files | Cut files | Total files | Lines |
|---|---:|---:|---:|---:|---:|
${renderSummaryByRoot(records)}

| Verdict | Files | Lines |
|---|---:|---:|
${renderSummaryByVerdict(records)}

Total scope: ${formatNumber(total.files)} files and ${formatNumber(total.lines)} lines.

## Verdict meaning

- \`port\`: translate surviving frontend behavior into \`apps/console\`, TypeScript, the App Router, and the component register.
- \`service\`: keep or adapt the behavior in the standalone Express or collector service. This verdict does not authorize a Next port.
- \`cut\`: do not copy the upstream file. The named behavior is replaced or outside the product boundary.

## Known cuts

### Frontend provider configuration

The following nine \`frontend/src/pages/GeneralSettings\` directories are cut: ${GENERAL_SETTINGS_PROVIDER_CUTS.map(markdownCode).join(", ")}.

The following nine top-level \`frontend/src/components\` directories are cut: ${COMPONENT_PROVIDER_CUTS.map(markdownCode).join(", ")}.

Provider and model selectors nested in onboarding, workspace settings, and the chat composer are also cut. The Harness owns execution and model routing, so the fork has no provider selection UI.

These are destination verdicts, not proof that each directory can be deleted before its consumers move. Onboarding, workspace settings, chat tools, and document connector flows still import several cut components at the pinned commit. Their surviving parents must be ported away from those dependencies before the cut is applied.

### Vector and embedding providers

All ten upstream provider directories below \`server/utils/vectorDbProviders\` are cut: ${VECTOR_PROVIDER_CUTS.map(markdownCode).join(", ")}. The base adapter contract is retained only as a seam for \`rustyred\`; no second provider is retained.

The upstream \`EmbeddingEngines\` implementations are cut because \`commonplace::IngestPipeline\` owns embedding and ingestion. The legacy embedding worker, vector model, and vector reset utility are cut with that tier.

### Agent and LLM providers

The complete \`server/utils/agents/aibitat\` tree and its focused tests are cut. The Harness is the only executor and supplies plans, runs, receipts, coordination, and memory.

Every upstream connector under \`server/utils/AiProviders\` is cut. These connectors are not routed by the Harness, and retaining them would create a second model execution layer.

### Browser ML and audio providers

The server-side native embedding and reranking paths are cut, including the \`@xenova/transformers\` dependency chain that brings in \`onnxruntime-web\`. The server manifest and lockfile remain service files but must be pruned and regenerated during implementation.

The collector remains a service in this inventory, but the verdict does not mean it runs unchanged as a network peer. The pinned source shares its upload hot directory, output storage, and rotating integrity keys with Express. FK7 must make those service boundaries explicit. Its local Whisper dependency is collector-side document parsing, not the removed server embedding path.

The upstream server speech-to-text and text-to-speech provider tiers are cut together with their provider-selection UI.

${sections}
`;
}

function writeOrCheck(output, check) {
  if (check) {
    let existing;
    try {
      existing = readFileSync(OUTPUT_PATH, "utf8");
    } catch {
      throw new Error(
        `${path.relative(process.cwd(), OUTPUT_PATH)} is missing. Run the generator without --check`
      );
    }
    if (existing !== output) {
      throw new Error(
        `${path.relative(process.cwd(), OUTPUT_PATH)} is stale. Run the generator without --check`
      );
    }
    return;
  }

  mkdirSync(path.dirname(OUTPUT_PATH), { recursive: true });
  writeFileSync(OUTPUT_PATH, output, "utf8");
}

function main() {
  const options = parseArguments(process.argv.slice(2));
  const source = resolveSource(options.source);
  const commit = runGit(source, ["rev-parse", "HEAD"]).trim();
  const records = buildRecords(source, commit);
  const output = renderInventory(commit, records);

  writeOrCheck(output, options.check);

  const relativeOutput = path.relative(process.cwd(), OUTPUT_PATH);
  const action = options.check ? "Verified" : "Wrote";
  console.log(
    `${action} ${relativeOutput}: ${records.length} tracked regular files, ${new Set(records.map((record) => record.path)).size} unique verdicts.`
  );
}

try {
  main();
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}
