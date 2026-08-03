import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

async function main() {
  const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
  const outputRoot = resolve(packageRoot, "dist/npm");
  const sourcePackage = JSON.parse(
    await readFile(resolve(packageRoot, "package.json"), "utf8")
  );

  const publishedPackage = {
    name: sourcePackage.name,
    version: sourcePackage.version,
    description: sourcePackage.description,
    type: sourcePackage.type,
    bin: sourcePackage.bin,
    repository: sourcePackage.repository,
    homepage: sourcePackage.homepage,
    bugs: sourcePackage.bugs,
    keywords: sourcePackage.keywords,
    license: sourcePackage.license,
    publishConfig: sourcePackage.publishConfig
  };

  await rm(outputRoot, { recursive: true, force: true });
  await mkdir(resolve(outputRoot, "bin"), { recursive: true });
  await mkdir(resolve(outputRoot, "dist/bin"), { recursive: true });
  await cp(
    resolve(packageRoot, "bin/openwork-server.mjs"),
    resolve(outputRoot, "bin/openwork-server.mjs")
  );

  // Every compiled binary, not just the publishing machine's. Copying the one
  // unsuffixed binary produced a package that claimed to be platform-neutral
  // and handed an incompatible executable to every other CPU and OS.
  await cp(resolve(packageRoot, "dist/bin"), resolve(outputRoot, "dist/bin"), {
    recursive: true
  });

  // The JavaScript the bin wrapper falls back to when no binary matches. It
  // needs Bun on the host, which is a real requirement, but it is a working
  // path rather than a wrong-architecture crash.
  for (const entry of ["cli.js", "opencode-plugins"]) {
    const source = resolve(packageRoot, "dist", entry);
    if (!existsSync(source)) {
      throw new Error(
        `Missing dist/${entry}. Run \`pnpm build\` before publishing: the package needs a portable fallback for platforms without a matching binary.`
      );
    }
    await cp(source, resolve(outputRoot, "dist", entry), { recursive: true });
  }

  await cp(resolve(packageRoot, "README.md"), resolve(outputRoot, "README.md"));
  await writeFile(
    resolve(outputRoot, "package.json"),
    `${JSON.stringify(publishedPackage, null, 2)}\n`
  );

  const pnpmCli = process.env.npm_execpath;
  if (!pnpmCli) throw new Error("pnpm executable path is unavailable");

  const result = spawnSync(
    process.execPath,
    [pnpmCli, "--config.git-checks=false", "publish", ...process.argv.slice(2)],
    { cwd: outputRoot, stdio: "inherit" }
  );
  if (result.error) throw result.error;
  process.exit(result.status ?? 1);
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
