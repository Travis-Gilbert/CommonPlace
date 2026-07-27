"use strict";

const { harnessError } = require("./errors");
const { normalizeAgentScope, workspaceScope } = require("./scope");

const REQUIRED_CONTEXT_METHODS = Object.freeze([
  "loadHistory",
  "loadParsedFiles",
  "loadPinnedDocuments",
  "loadWorkspaceRagMemory",
  "loadUserMemories",
]);
const REQUIRED_PERSISTENCE_METHODS = Object.freeze([
  "beginTurn",
  "recordToolInvocation",
  "commitTurn",
  "failTurn",
]);

class HarnessAgentBridge {
  #contextSource;
  #persistence;
  #receiptVerifier;
  #runner;
  #toolSurface;

  constructor({
    contextSource,
    persistence,
    receiptVerifier,
    runner,
    toolSurface,
  } = {}) {
    requireMethods(contextSource, REQUIRED_CONTEXT_METHODS, "context source");
    requireMethods(persistence, REQUIRED_PERSISTENCE_METHODS, "persistence");
    requireMethods(
      receiptVerifier,
      ["verifyRunReceipt"],
      "run receipt verifier"
    );
    requireMethods(runner, ["runTurn"], "turn runner");
    requireMethods(toolSurface, ["definitions", "execute"], "tool surface");
    this.#contextSource = contextSource;
    this.#persistence = persistence;
    this.#receiptVerifier = receiptVerifier;
    this.#runner = runner;
    this.#toolSurface = toolSurface;
  }

  async runTurn(input) {
    const scope = normalizeAgentScope(input);
    const prompt = stripAgentCommand(input.prompt);
    const attachments = normalizeAttachments(input.attachments);
    let turnId = null;
    let committed = false;
    const toolInvocations = [];

    try {
      const reservation = await this.#persistence.beginTurn({
        scope,
        prompt,
        attachments,
      });
      turnId = turnIdentity(reservation);

      const context = await this.#loadContext(scope, prompt);
      const callTool = async ({
        name,
        arguments: argumentsValue = {},
        toolCallId,
      }) => {
        const execution = logicalInvoke(name)
          ? {
              toolCallId: requireToolCallId(toolCallId),
            }
          : undefined;
        const result = await this.#toolSurface.execute(
          name,
          argumentsValue,
          scope,
          execution
        );
        if (logicalInvoke(name)) {
          const invocation = {
            provenance: cloneJson(result.provenance ?? null),
            receipt: cloneJson(result.receipt ?? null),
            sources: cloneJson(invocationSources(result)),
          };
          toolInvocations.push(invocation);
          await this.#persistence.recordToolInvocation({
            turnId,
            scope,
            invocation: cloneJson(invocation),
          });
        }
        return result;
      };

      const runnerResult = await this.#runner.runTurn({
        scope,
        prompt,
        history: context.history,
        documents: context.documents,
        memory: context.memory,
        citationCandidates: context.documentCitations,
        attachments,
        tools: this.#toolSurface.definitions(),
        callTool,
      });
      const response = normalizeRunnerResponse({
        runnerResult,
        attachments,
        citationCandidates: context.documentCitations,
        toolInvocations,
      });
      const receiptDecision = await this.#receiptVerifier.verifyRunReceipt({
        runReceipt: response.runReceipt,
        scope,
        turnId,
        toolInvocations: cloneJson(toolInvocations),
      });
      if (
        receiptDecision !== true &&
        record(receiptDecision)?.verified !== true
      ) {
        throw harnessError(
          "HARNESS_RUN_RECEIPT_UNVERIFIED",
          "Harness chat turn receipt could not be verified."
        );
      }

      await this.#persistence.commitTurn({
        turnId,
        scope,
        prompt,
        response,
      });
      committed = true;
      return Object.freeze({ turnId, ...response });
    } catch (error) {
      if (turnId !== null && !committed) {
        try {
          await this.#persistence.failTurn({
            turnId,
            scope,
            error: persistenceError(error),
            toolInvocations: cloneJson(toolInvocations),
          });
        } catch (auditError) {
          throw harnessError(
            "HARNESS_AUDIT_PERSISTENCE_FAILED",
            "Harness could not durably record the failed turn.",
            {
              cause: auditError,
              details: {
                retrySafe: false,
                completionState: "unknown",
                originalError: persistenceError(error),
                auditError: persistenceError(auditError),
                toolInvocations: cloneJson(toolInvocations),
              },
            }
          );
        }
      }
      throw error;
    }
  }

  async #loadContext(scope, prompt) {
    const history = await this.#contextSource.loadHistory(scope, { limit: 20 });
    if (!Array.isArray(history)) {
      throw harnessError(
        "HARNESS_CONTEXT_INVALID",
        "Agent history loader must return an array."
      );
    }

    const pinnedScope = workspaceScope(scope);
    const [parsedFiles, pinnedDocuments, workspaceRagMemory, userMemories] =
      await Promise.all([
        this.#contextSource.loadParsedFiles(scope),
        this.#contextSource.loadPinnedDocuments(pinnedScope),
        this.#contextSource.loadWorkspaceRagMemory(pinnedScope, {
          prompt,
          history,
        }),
        this.#contextSource.loadUserMemories(scope, { prompt, history }),
      ]);
    if (!Array.isArray(parsedFiles) || !Array.isArray(pinnedDocuments)) {
      throw harnessError(
        "HARNESS_CONTEXT_INVALID",
        "Parsed files and pinned documents must be arrays."
      );
    }
    if (!Array.isArray(workspaceRagMemory)) {
      throw harnessError(
        "HARNESS_CONTEXT_INVALID",
        "Workspace RAG memory loader must return an array."
      );
    }
    const userMemoryLanes = record(userMemories);
    if (
      !userMemoryLanes ||
      !Array.isArray(userMemoryLanes.global) ||
      !Array.isArray(userMemoryLanes.workspace)
    ) {
      throw harnessError(
        "HARNESS_CONTEXT_INVALID",
        "User memory loader must return explicit global and workspace arrays."
      );
    }

    const documentCitations = citationsFromDocuments(
      parsedFiles,
      pinnedDocuments
    );
    return {
      history,
      documents: Object.freeze({
        parsedFiles,
        pinnedDocuments,
      }),
      memory: Object.freeze({
        workspaceRag: workspaceRagMemory,
        user: userMemoryLanes,
      }),
      documentCitations,
    };
  }
}

function normalizeRunnerResponse({
  runnerResult,
  attachments,
  citationCandidates,
  toolInvocations,
}) {
  const result = record(runnerResult);
  if (!result || typeof result.text !== "string") {
    throw harnessError(
      "HARNESS_TURN_INVALID_RESULT",
      "Harness turn runner must return a text response."
    );
  }
  const runReceipt = record(result.runReceipt);
  if (!runReceipt || !receiptIdentity(runReceipt)) {
    throw harnessError(
      "HARNESS_RUN_RECEIPT_MISSING",
      "Harness chat turn must return its own run receipt."
    );
  }
  assertDistinctRunReceipt(runReceipt, toolInvocations);
  const metrics = result.metrics === undefined ? {} : record(result.metrics);
  if (!metrics) {
    throw harnessError(
      "HARNESS_TURN_INVALID_RESULT",
      "Harness turn metrics must be an object."
    );
  }

  const admittedCitations = dedupeCitations([
    ...citationCandidates,
    ...toolInvocations.flatMap((invocation) =>
      arrayOrEmpty(record(invocation)?.sources)
    ),
  ]);
  const sources = validateCitations(
    arrayOrEmpty(result.citations),
    admittedCitations
  );
  const response = {
    text: result.text,
    sources,
    type: "chat",
    attachments,
    metrics: cloneJson(metrics),
    runReceipt: cloneJson(runReceipt),
    toolInvocations: cloneJson(toolInvocations),
  };
  const outputs = arrayOrEmpty(result.outputs);
  const clarifyingQuestions = arrayOrEmpty(result.clarifyingQuestions);
  if (outputs.length > 0) response.outputs = cloneJson(outputs);
  if (clarifyingQuestions.length > 0) {
    response.clarifyingQuestions = cloneJson(clarifyingQuestions);
  }
  return Object.freeze(response);
}

function citationsFromDocuments(parsedFiles, pinnedDocuments) {
  const parsed = parsedFiles
    .map((document, index) => documentCitation(document, "parsed-file", index))
    .filter(Boolean);
  const pinned = pinnedDocuments
    .map((document, index) =>
      documentCitation(document, "pinned-document", index)
    )
    .filter(Boolean);
  return dedupeCitations([...parsed, ...pinned]);
}

function documentCitation(value, kind, index) {
  const document = record(value);
  if (!document) return null;
  const metadata = record(document.metadata) ?? {};
  const text = firstText(document.pageContent, document.content, document.text);
  if (!text) return null;
  const title =
    firstText(document.title, metadata.title, document.name) ??
    (kind === "parsed-file" ? "Uploaded Document" : "Pinned Document");
  const id =
    firstText(document.id, document.docId, metadata.id, metadata.docId) ??
    `${kind}:${index}`;
  return {
    id,
    title,
    text,
    chunkSource:
      firstText(
        document.source,
        document.path,
        metadata.source,
        metadata.path,
        metadata.url
      ) ?? kind,
    contextKind: kind,
  };
}

function normalizeAttachments(value) {
  if (value === undefined || value === null) return Object.freeze([]);
  if (!Array.isArray(value)) {
    throw harnessError(
      "HARNESS_ATTACHMENTS_INVALID",
      "Agent attachments must be an array."
    );
  }
  return Object.freeze(
    value.map((attachment) => {
      const item = record(attachment);
      if (
        !item ||
        !firstText(item.name) ||
        !firstText(item.mime) ||
        !firstText(item.contentString)
      ) {
        throw harnessError(
          "HARNESS_ATTACHMENTS_INVALID",
          "Each attachment requires name, mime, and contentString."
        );
      }
      return Object.freeze({
        name: item.name,
        mime: item.mime,
        contentString: item.contentString,
      });
    })
  );
}

function stripAgentCommand(message) {
  if (typeof message !== "string") {
    throw harnessError(
      "HARNESS_PROMPT_INVALID",
      "Agent prompt must be a string."
    );
  }
  const stripped = message.replace(/^@agent\s*/, "").trim();
  return stripped || "Hello!";
}

function turnIdentity(reservation) {
  if (
    (typeof reservation === "string" && reservation.trim()) ||
    (typeof reservation === "number" && Number.isFinite(reservation))
  ) {
    return reservation;
  }
  const identity = record(reservation)?.id;
  if (
    (typeof identity === "string" && identity.trim()) ||
    (typeof identity === "number" && Number.isFinite(identity))
  ) {
    return identity;
  }
  throw harnessError(
    "HARNESS_PERSISTENCE_INVALID",
    "Persistence beginTurn must return a turn identity."
  );
}

function receiptIdentity(receipt) {
  return firstText(receipt.runId, receipt.run_id, receipt.id);
}

function assertDistinctRunReceipt(runReceipt, toolInvocations) {
  const runId = receiptIdentity(runReceipt);
  const toolReceiptIds = new Set();
  for (const invocation of toolInvocations) {
    collectReceiptIds(record(invocation)?.receipt, toolReceiptIds);
  }
  if (toolReceiptIds.has(runId)) {
    throw harnessError(
      "HARNESS_RUN_RECEIPT_REUSED",
      "A tool invocation receipt cannot be reused as the chat turn receipt."
    );
  }
}

function collectReceiptIds(value, identities) {
  if (Array.isArray(value)) {
    value.forEach((entry) => collectReceiptIds(entry, identities));
    return;
  }
  const source = record(value);
  if (!source) return;
  for (const [key, entry] of Object.entries(source)) {
    if (
      [
        "id",
        "node_id",
        "receipt_id",
        "receiptId",
        "invocation_id",
        "invocationId",
        "run_id",
        "runId",
      ].includes(key) &&
      typeof entry === "string" &&
      entry.trim()
    ) {
      identities.add(entry.trim());
    }
    collectReceiptIds(entry, identities);
  }
}

function persistenceError(error) {
  return Object.freeze(removeUndefined({
    code:
      typeof error?.code === "string"
        ? error.code
        : "HARNESS_TURN_FAILED",
    message:
      error instanceof Error && error.message
        ? error.message
        : "Harness turn failed.",
    details: cloneJson(error?.details),
  }));
}

function invocationSources(result) {
  const payload = record(result)?.result;
  const candidates = [
    ...arrayOrEmpty(record(payload)?.sources),
    ...arrayOrEmpty(record(payload)?.provenance),
  ];
  return dedupeCitations(candidates);
}

function validateCitations(citations, admitted) {
  const admittedByIdentity = new Map();
  for (const citation of admitted) {
    const identity = citationIdentity(citation);
    if (identity && !admittedByIdentity.has(identity)) {
      admittedByIdentity.set(identity, cloneJson(citation));
    }
  }
  const verified = [];
  for (const citation of citations) {
    const item = record(citation);
    const identity = citationIdentity(item);
    const canonical = identity ? admittedByIdentity.get(identity) : null;
    if (!item || !canonical) {
      throw harnessError(
        "HARNESS_CITATION_UNVERIFIED",
        "Harness runner returned a citation outside the admitted context and tool provenance."
      );
    }
    verified.push(canonical);
  }
  return dedupeCitations(verified);
}

function citationIdentity(value) {
  const item = record(value);
  if (!item) return null;
  const id = firstText(item.id, item.itemId, item.item_id);
  const source = firstText(
    item.chunkSource,
    item.source,
    item.path,
    item.url
  );
  return id && source ? `${id}\u0000${source}` : null;
}

function removeUndefined(value) {
  return Object.fromEntries(
    Object.entries(value).filter(([, entry]) => entry !== undefined)
  );
}

function requireMethods(value, methods, label) {
  if (!value || typeof value !== "object") {
    throw harnessError(
      "HARNESS_CONFIGURATION_INVALID",
      `Harness ${label} is required.`
    );
  }
  for (const method of methods) {
    if (typeof value[method] === "function") continue;
    throw harnessError(
      "HARNESS_CONFIGURATION_INVALID",
      `Harness ${label} must implement ${method}().`
    );
  }
}

function logicalInvoke(name) {
  return name === "invoke" || name === "@@mcp_invoke";
}

function requireToolCallId(toolCallId) {
  if (typeof toolCallId !== "string" || !toolCallId.trim()) {
    throw harnessError(
      "HARNESS_TOOL_CALL_ID_INVALID",
      "Harness invoke requires the runner's stable logical tool-call ID."
    );
  }
  return toolCallId.trim();
}

function dedupeCitations(citations) {
  const seen = new Set();
  const result = [];
  for (const citation of citations) {
    const item = record(citation);
    if (!item) continue;
    const key = `${String(item.id ?? "")}\u0000${String(
      item.chunkSource ?? ""
    )}\u0000${String(item.text ?? "")}`;
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(cloneJson(item));
  }
  return result;
}

function arrayOrEmpty(value) {
  return Array.isArray(value) ? value : [];
}

function firstText(...values) {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return null;
}

function cloneJson(value) {
  if (value === undefined) return undefined;
  return JSON.parse(JSON.stringify(value));
}

function record(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? value
    : null;
}

module.exports = {
  HarnessAgentBridge,
  REQUIRED_CONTEXT_METHODS,
  REQUIRED_PERSISTENCE_METHODS,
  citationsFromDocuments,
  normalizeRunnerResponse,
  stripAgentCommand,
};
