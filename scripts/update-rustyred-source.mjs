#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const DEFAULT_REPO = "Travis-Gilbert/RustyRed-Graph-Database";
const DEFAULT_REF = "main";
const SOURCE_FILE = "packages/rustyred-contracts/rustyred-source.json";
const SHA_RE = /^[0-9a-f]{40}$/i;

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const args = parseArgs(process.argv.slice(2));

if (args.check) {
  checkSourceFile();
  process.exit(0);
}

const repo = args.repo ?? DEFAULT_REPO;
const ref = args.ref ?? DEFAULT_REF;
const sha = args.sha ?? resolveSha(repo, ref);

if (!SHA_RE.test(sha)) {
  throw new Error(`RustyRed SHA must be a 40-character hex commit, received: ${sha}`);
}

const sourceFile = resolve(rootDir, SOURCE_FILE);
const current = readJson(sourceFile);
const next = {
  schemaVersion: 1,
  source: {
    repo,
    ref,
    sha,
    url: `https://github.com/${repo}/tree/${sha}`,
  },
  updatedAt: args.updatedAt ?? new Date().toISOString(),
  dispatch: args.dispatchUrl
    ? {
        url: args.dispatchUrl,
      }
    : undefined,
  notes: [
    "This file is the CommonPlace-side source pin for RustyRed contracts.",
    "GitHub Actions updates it from RustyRed repository_dispatch events and opens a PR.",
    "Generated API clients and block/view contracts should be derived from this pin, not copied by hand.",
  ],
};

if (JSON.stringify(normalize(current)) === JSON.stringify(normalize(next))) {
  console.log(`RustyRed source is already pinned to ${repo}@${sha}.`);
  process.exit(0);
}

mkdirSync(dirname(sourceFile), { recursive: true });
writeFileSync(sourceFile, `${JSON.stringify(next, null, 2)}\n`);
console.log(`Pinned RustyRed source to ${repo}@${sha}.`);

function checkSourceFile() {
  const source = readJson(resolve(rootDir, SOURCE_FILE));
  if (source.schemaVersion !== 1) throw new Error("rustyred-source.json schemaVersion must be 1.");
  if (!source.source || typeof source.source !== "object") throw new Error("rustyred-source.json is missing source.");
  if (typeof source.source.repo !== "string" || !source.source.repo.includes("/")) {
    throw new Error("rustyred-source.json source.repo must be owner/repo.");
  }
  if (typeof source.source.ref !== "string" || !source.source.ref) {
    throw new Error("rustyred-source.json source.ref is required.");
  }
  if (typeof source.source.sha !== "string" || !SHA_RE.test(source.source.sha)) {
    throw new Error("rustyred-source.json source.sha must be a 40-character hex commit.");
  }
  if (typeof source.updatedAt !== "string" || Number.isNaN(Date.parse(source.updatedAt))) {
    throw new Error("rustyred-source.json updatedAt must be an ISO date string.");
  }
  console.log(`RustyRed source pin is valid: ${source.source.repo}@${source.source.sha}`);
}

function resolveSha(repo, ref) {
  const remote = `https://github.com/${repo}.git`;
  const output = execFileSync("git", ["ls-remote", remote, `refs/heads/${ref}`], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
  const [sha] = output.split(/\s+/);
  if (!sha) throw new Error(`Could not resolve ${repo}@${ref}.`);
  return sha;
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

function normalize(value) {
  const copy = JSON.parse(JSON.stringify(value));
  delete copy.updatedAt;
  delete copy.dispatch;
  return copy;
}

function parseArgs(rawArgs) {
  const parsed = {};
  for (let index = 0; index < rawArgs.length; index += 1) {
    const arg = rawArgs[index];
    if (!arg.startsWith("--")) continue;
    const key = arg.slice(2);
    if (key === "check") {
      parsed.check = true;
      continue;
    }
    const value = rawArgs[index + 1];
    if (!value || value.startsWith("--")) {
      throw new Error(`Missing value for --${key}`);
    }
    parsed[key] = value;
    index += 1;
  }
  return parsed;
}
