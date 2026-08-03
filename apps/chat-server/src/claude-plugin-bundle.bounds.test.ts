import { afterEach, describe, expect, test } from "bun:test";

import { resolveClaudePluginBundle } from "./claude-plugin-bundle.js";
import { ApiError } from "./errors.js";

// The finding these cover: resolution walks a GitHub tree and downloads every
// component file. Authorization moved ahead of it, which stops a viewer, but a
// collaborator naming a repository that is not a plugin still reaches this
// code, and a preview that exhausts the host is an outage whether or not it
// wrote anything.

type Served = { port: number; stop: (closeActiveConnections?: boolean) => void };

const stops: Array<() => void> = [];
let previousEnv: Record<string, string | undefined> = {};

afterEach(() => {
  while (stops.length) stops.pop()?.();
  for (const [key, value] of Object.entries(previousEnv)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  previousEnv = {};
});

function setEnv(key: string, value: string) {
  if (!(key in previousEnv)) previousEnv[key] = process.env[key];
  process.env[key] = value;
}

/**
 * A GitHub that answers with whatever the test asks for.
 *
 * `rawRequests` is the assertion that matters for the refuse-early cases: a
 * limit that fires only after the downloads have happened has not bounded
 * anything.
 */
function startHostileGithub(files: Record<string, string>) {
  const rawRequests: string[] = [];
  const server = Bun.serve({
    hostname: "127.0.0.1",
    port: 0,
    fetch(request) {
      const url = new URL(request.url);
      if (url.pathname === "/repos/acme/plugin") {
        return Response.json({ default_branch: "main" });
      }
      if (url.pathname.startsWith("/repos/acme/plugin/git/trees/")) {
        return Response.json({
          tree: Object.keys(files).map((path) => ({ path, type: "blob", sha: `sha-${path}` })),
        });
      }
      const rawPrefix = "/acme/plugin/main/";
      if (url.pathname.startsWith(rawPrefix)) {
        const path = decodeURIComponent(url.pathname.slice(rawPrefix.length));
        rawRequests.push(path);
        const content = files[path];
        if (content !== undefined) return new Response(content);
      }
      return Response.json({ message: "not found" }, { status: 404 });
    },
  }) as Served;
  stops.push(() => server.stop(true));
  setEnv("OPENWORK_GITHUB_API_BASE", `http://127.0.0.1:${server.port}`);
  setEnv("OPENWORK_GITHUB_RAW_BASE", `http://127.0.0.1:${server.port}`);
  return { rawRequests };
}

const MANIFEST = JSON.stringify({ name: "plugin", displayName: "Plugin", version: "1.0.0" });

function pluginFiles(extra: Record<string, string>): Record<string, string> {
  return { ".claude-plugin/plugin.json": MANIFEST, ...extra };
}

async function resolveError(): Promise<ApiError> {
  try {
    await resolveClaudePluginBundle({ url: "https://github.com/acme/plugin" });
  } catch (error) {
    if (error instanceof ApiError) return error;
    throw error;
  }
  throw new Error("Expected resolution to be refused");
}

describe("bundle resolution bounds", () => {
  test("a bundle that fits still resolves", async () => {
    startHostileGithub(pluginFiles({
      "commands/standup.md": "---\ndescription: Standup\n---\n\nSummarize.",
    }));
    const bundle = await resolveClaudePluginBundle({ url: "https://github.com/acme/plugin" });
    expect(bundle.preview.name).toBe("Plugin");
    expect(bundle.preview.components.map((component) => component.name)).toContain("standup");
  });

  test("refuses a tree too large to be a plugin, before downloading anything", async () => {
    const files: Record<string, string> = pluginFiles({});
    for (let index = 0; index < 20_001; index += 1) files[`src/file-${index}.ts`] = "x";
    const { rawRequests } = startHostileGithub(files);

    const error = await resolveError();
    expect(error.status).toBe(413);
    expect(error.code).toBe("plugin_too_large");
    // Not one raw file was fetched: the tree listing alone was the refusal.
    expect(rawRequests).toHaveLength(0);
  });

  test("refuses more components than can be installed, before downloading them", async () => {
    // A manifest whose component directory is the whole repository. Each file
    // is tiny, so no per-file limit sees a problem; the count is the problem.
    const files: Record<string, string> = pluginFiles({});
    for (let index = 0; index < 501; index += 1) {
      files[`commands/command-${index}.md`] = "tiny";
    }
    const { rawRequests } = startHostileGithub(files);

    const error = await resolveError();
    expect(error.status).toBe(413);
    expect(error.code).toBe("plugin_too_large");
    // Only the manifest. The 501 components were never requested.
    expect(rawRequests).toEqual([".claude-plugin/plugin.json"]);
  });

  test("refuses a single component past the per-file ceiling", async () => {
    startHostileGithub(pluginFiles({
      "commands/huge.md": "x".repeat(512 * 1024 + 1),
    }));
    const error = await resolveError();
    expect(error.status).toBe(413);
    expect(error.code).toBe("plugin_too_large");
  });

  test("refuses a manifest past the per-file ceiling", async () => {
    // The first download of the resolution, and the one that runs before any
    // component count is even known.
    startHostileGithub({ ".claude-plugin/plugin.json": `{"name":"p","pad":"${"x".repeat(512 * 1024)}"}` });
    const error = await resolveError();
    expect(error.status).toBe(413);
    expect(error.code).toBe("plugin_too_large");
  });
});
