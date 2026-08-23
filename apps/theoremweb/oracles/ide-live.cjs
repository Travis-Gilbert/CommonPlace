#!/usr/bin/env node
"use strict";

const crypto = require("node:crypto");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { execFileSync } = require("node:child_process");

function invariant(condition, message) {
  if (!condition) throw new Error(message);
}

function requiredEnvironment(name) {
  const value = process.env[name];
  invariant(value, `${name} is required for --live`);
  return value;
}

function sha256(file) {
  return crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");
}

function sanitizedUrl(value) {
  const url = new URL(value);
  url.username = "";
  url.password = "";
  url.search = "";
  url.hash = "";
  return url.toString();
}

function within(root, candidate) {
  const relative = path.relative(fs.realpathSync(root), fs.realpathSync(candidate));
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

function codeServerHeaders() {
  const headersFile = process.env.THEOREMWEB_CODE_SERVER_HEADERS_FILE;
  if (!headersFile) return {};
  const headers = JSON.parse(fs.readFileSync(headersFile, "utf8"));
  invariant(
    headers &&
      typeof headers === "object" &&
      !Array.isArray(headers) &&
      Object.values(headers).every((value) => typeof value === "string"),
    "THEOREMWEB_CODE_SERVER_HEADERS_FILE must contain a JSON object of strings",
  );
  return headers;
}

async function verifyCodeServer(url) {
  const response = await fetch(url, { redirect: "follow", headers: codeServerHeaders() });
  invariant(response.ok, `code-server returned HTTP ${response.status}`);
  const document = await response.text();
  invariant(!new URL(response.url).pathname.includes("/login"), "code-server returned its login page");
  invariant(
    /workbench\.web\.main|monaco-workbench|workbench/i.test(document),
    "code-server response did not identify a workbench",
  );
  return response.url;
}

function verifyAgentFs(root) {
  invariant(fs.statSync(root).isDirectory(), "THEOREMWEB_AGENTFS_ROOT is not a directory");
  const directory = fs.mkdtempSync(path.join(root, ".theoremweb-ide-oracle-"));
  const file = path.join(directory, "saved-from-ide.txt");
  const contents = `theoremweb-ide-live:${crypto.randomUUID()}\n`;
  try {
    fs.writeFileSync(file, contents, { encoding: "utf8", flag: "wx" });
    invariant(fs.readFileSync(file, "utf8") === contents, "AgentFS write did not round-trip");
    return { root: fs.realpathSync(root), file: fs.realpathSync(file) };
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
}

function verifyExtension(binary, vsix, extensionsDirectory) {
  invariant(fs.statSync(vsix).isFile(), "THEOREMWEB_VSIX is not a file");
  const isolation = extensionsDirectory
    ? ["--extensions-dir", extensionsDirectory]
    : [];
  execFileSync(binary, [...isolation, "--install-extension", vsix, "--force"], {
    stdio: "pipe",
  });
  const extensions = execFileSync(binary, [...isolation, "--list-extensions", "--show-versions"], {
    encoding: "utf8",
  });
  invariant(
    extensions.split(/\r?\n/).some((line) => line.startsWith("commonplace.theorem-vscode@")),
    "installed extension list omitted commonplace.theorem-vscode",
  );
  return sha256(vsix);
}

function verifyUiReceipt(receiptFile, agentFsRoot) {
  const receipt = JSON.parse(fs.readFileSync(receiptFile, "utf8"));
  invariant(receipt.oracle === "TheoremWeb IDE live UI", "UI receipt names the wrong oracle");
  invariant(receipt.code_server_workbench_booted === true, "code-server workbench was not witnessed");
  invariant(receipt.agentfs_edit_saved === true, "AgentFS edit was not witnessed as saved");
  invariant(receipt.agentfs_file_opened, "UI receipt omitted the opened AgentFS file");
  invariant(
    within(agentFsRoot, receipt.agentfs_file_opened),
    "opened file was outside THEOREMWEB_AGENTFS_ROOT",
  );

  for (const preference of [
    "dom_serviceworker_enabled",
    "dom_indexeddb_enabled",
    "dom_intersection_observer_enabled",
  ]) {
    invariant(receipt.servo_preferences?.[preference] === true, `${preference} was not enabled`);
  }

  const extension = receipt.extension_webview;
  invariant(extension, "UI receipt omitted extension_webview");
  const rendered = extension.state === "rendered";
  const namedDegrade =
    extension.state === "degraded" &&
    extension.renderer === "system_webview" &&
    typeof extension.failing_capability === "string" &&
    extension.failing_capability.length > 0;
  invariant(rendered || namedDegrade, "extension webview neither rendered nor named its degradation");

  invariant(receipt.graph_panel?.tenant_connected === true, "graph panel did not connect a tenant");
  invariant(receipt.graph_panel.live_agent_chunks > 0, "graph panel observed no live agent work");
  invariant(receipt.graph_panel.steer_accepted === true, "graph panel steer was not accepted");
  return receipt;
}

async function main() {
  invariant(process.argv.includes("--live"), "ide-live.cjs requires --live");
  const codeServerUrl = requiredEnvironment("THEOREMWEB_CODE_SERVER_URL");
  const agentFsRoot = requiredEnvironment("THEOREMWEB_AGENTFS_ROOT");
  const vscodeBinary = requiredEnvironment("THEOREMWEB_VSCODE_BIN");
  const vsix = requiredEnvironment("THEOREMWEB_VSIX");
  const uiReceiptFile = requiredEnvironment("THEOREMWEB_IDE_UI_RECEIPT");
  const extensionsDirectory = process.env.THEOREMWEB_VSCODE_EXTENSIONS_DIR;

  const [workbenchUrl, agentFs, extensionSha256] = await Promise.all([
    verifyCodeServer(codeServerUrl),
    Promise.resolve(verifyAgentFs(agentFsRoot)),
    Promise.resolve(verifyExtension(vscodeBinary, vsix, extensionsDirectory)),
  ]);
  const witness = verifyUiReceipt(uiReceiptFile, agentFsRoot);

  process.stdout.write(
    `${JSON.stringify(
      {
        oracle: "live_ide_substrate",
        code_server_url: sanitizedUrl(workbenchUrl),
        agentfs_root: agentFs.root,
        agentfs_round_trip: true,
        extension_vsix_sha256: extensionSha256,
        extension_install_scope: extensionsDirectory ? "isolated_directory" : "editor_profile",
        servo_preferences: witness.servo_preferences,
        extension_webview: witness.extension_webview,
        graph_panel: witness.graph_panel,
        host: os.hostname(),
      },
      null,
      2,
    )}\n`,
  );
}

main().catch((error) => {
  process.stderr.write(`${error.stack ?? error.message}\n`);
  process.exitCode = 1;
});
