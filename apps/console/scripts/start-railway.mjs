// SOURCING: none. Deploy plumbing, mirrored from apps/web's start-railway.mjs.
// Public $PORT is the WebSocket-capable edge proxy. Next listens on an internal
// port so /IDE can upgrade to the workspace code-server door.

import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { assertRailwayEnvironment } from './railway-env.mjs';
import { startEdgeProxyFromEnv } from './edge-proxy.mjs';

assertRailwayEnvironment();

const appDir = resolve(dirname(fileURLToPath(import.meta.url)), '..');

const serverCandidates = [
  resolve(appDir, '.next/standalone/server.js'),
  resolve(appDir, '.next/standalone/apps/console/server.js'),
];

const serverPath = serverCandidates.find(existsSync);

if (!serverPath) {
  console.error(`Missing Railway standalone server. Checked: ${serverCandidates.join(', ')}`);
  process.exit(1);
}

const nextPort = Number(process.env.CONSOLE_NEXT_INTERNAL_PORT || 3010);
const publicPort = Number(process.env.PORT || 3000);

const child = spawn(process.execPath, [serverPath], {
  env: {
    ...process.env,
    PORT: String(nextPort),
    HOSTNAME: process.env.RAILWAY_BIND_HOST ?? '0.0.0.0',
  },
  stdio: 'inherit',
});

let shuttingDown = false;

function shutdown(code = 0, signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  if (!child.killed) {
    child.kill(signal || 'SIGTERM');
  }
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exit(code);
}

child.on('exit', (code, signal) => {
  if (signal) {
    shutdown(1, signal);
    return;
  }
  shutdown(code ?? 0);
});

const edge = await startEdgeProxyFromEnv({
  ...process.env,
  PORT: String(publicPort),
  CONSOLE_NEXT_INTERNAL_PORT: String(nextPort),
});

process.on('SIGTERM', () => {
  void edge.proxy.close().finally(() => shutdown(0, 'SIGTERM'));
});
process.on('SIGINT', () => {
  void edge.proxy.close().finally(() => shutdown(0, 'SIGINT'));
});
