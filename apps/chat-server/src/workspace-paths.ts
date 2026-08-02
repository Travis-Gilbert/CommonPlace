// SOURCING: node:fs/promises realpath — symlink resolution is the containment
// primitive and it is in the standard library. The npm packages that name this
// problem (is-path-inside, path-is-inside) compare strings and never touch the
// filesystem, so they cannot see a symlink and would not close the escape this
// module exists to close.
//
// This lives in its own module because there were two copies of the lexical
// check — routes/files.ts and extensions/openai-image-generation.ts — and a
// containment rule that exists twice is a containment rule that will be fixed
// once.
import { realpath } from "node:fs/promises";
import { basename, dirname, join, resolve, sep } from "node:path";

import { ApiError } from "./errors.js";

/**
 * Resolve `child` under `root`, rejecting anything that leaves the workspace.
 *
 * Two checks, not one. The lexical check collapses `..` and is enough for a
 * crafted path. It is not enough for a symlink: resolve() never touches the
 * filesystem, so a link inside the checkout pointing at /etc passes it, and
 * stat() and createReadStream() then follow the link. Only realpath() collapses
 * links, so the real target is what gets compared.
 *
 * The target need not exist — writes create files. So the nearest existing
 * ancestor is resolved and the unresolved tail re-appended, which catches a
 * symlinked parent directory as well as a symlinked file.
 *
 * Returns the real path, so callers open what was actually checked rather than
 * re-resolving the link a second time.
 */
export async function resolveSafeChildPath(root: string, child: string): Promise<string> {
  const rootResolved = resolve(root);
  const candidate = resolve(rootResolved, child);
  if (candidate === rootResolved) {
    throw new ApiError(400, "invalid_path", "Path must point to a file");
  }
  if (!candidate.startsWith(rootResolved + sep)) {
    throw new ApiError(400, "invalid_path", "Path traversal is not allowed");
  }

  // A root that is itself reached through a link (/tmp on macOS is the common
  // case) has to be compared in the same namespace as the candidate.
  const realRoot = await realpath(rootResolved).catch(() => rootResolved);

  const tail: string[] = [];
  let probe = candidate;
  for (;;) {
    const resolvedProbe = await realpath(probe).catch(() => null);
    if (resolvedProbe !== null) {
      const real = tail.length ? join(resolvedProbe, ...tail) : resolvedProbe;
      if (real !== realRoot && !real.startsWith(realRoot + sep)) {
        throw new ApiError(400, "invalid_path", "Path traversal is not allowed");
      }
      return real;
    }
    const parent = dirname(probe);
    if (parent === probe) {
      // Walked past the filesystem root without finding anything real.
      throw new ApiError(400, "invalid_path", "Path traversal is not allowed");
    }
    tail.unshift(basename(probe));
    probe = parent;
  }
}
